// Package etl orchestrates the streaming flat-file pipeline: read a source line
// by line, parse + validate each line, route valid non-header rows to the output
// writer and invalid rows to an error report, then finalize and clean up.
//
// It is the Go port of typescript/src/etl/etl.ts. The port intentionally fixes a
// few issues from the original (see plan): the footer is written before the run
// is considered done, cleanup runs synchronously before returning an error, and
// the two cleanup paths are unified into cleanUp(force).
package etl

import (
	"flatfile-go/line"
	"flatfile-go/reader"
	"flatfile-go/writer"
)

// Options is the port of ETLOptions (minus the file source, which is passed
// separately as the reader is constructed from it).
type Options struct {
	Line line.Options `json:"line"`
	// RejectOnInvalidRow: when true, any invalid row marks the whole result
	// invalid. When false (default) invalid rows are skipped.
	RejectOnInvalidRow bool `json:"rejectOnInvalidRow"`
}

// Result is the port of ETLResult.
type Result struct {
	Valid                    bool              `json:"valid"`
	WithErrors               bool              `json:"withErrors"`
	TotalErrors              int               `json:"totalErrors"`
	LocalOutputFile          string            `json:"localOutputFile"`
	LocalOutputFilename      string            `json:"localOutputFilename"`
	LocalErrorReportFile     string            `json:"localErrorReportFile"`
	LocalErrorReportFilename string            `json:"localErrorReportFilename"`
	Metadata                 map[string]string `json:"metadata"`
}

// ETL orchestrates one source -> output run.
type ETL struct {
	reader      reader.Reader
	output      writer.Writer
	errorReport *writer.ErrorReport

	opts  Options
	valid bool

	lineNo         int
	sampleLineData map[string]string
	identifiers    map[string]string
	sampleSet      bool
}

// New wires a reader for source, an error report alongside the output, and the
// provided output writer. The output writer is supplied by the caller (as in the
// TS constructor's second argument) so the writer kind/options are decoupled.
func New(source string, opts Options, output writer.Writer) (*ETL, error) {
	r, err := reader.New(source)
	if err != nil {
		return nil, err
	}
	return &ETL{
		reader:      r,
		output:      output,
		errorReport: writer.NewErrorReport(r.Filename(), output.Path()),
		opts:        opts,
		valid:       true,
	}, nil
}

// Process runs the full pipeline and returns the result.
func (e *ETL) Process() (Result, error) {
	if err := e.reader.Open(); err != nil {
		return Result{}, err
	}

	if err := e.processLines(); err != nil {
		_ = e.cleanUp(true) // force cleanup, then surface the error
		return Result{}, err
	}

	if err := e.output.PushFooter(); err != nil {
		_ = e.cleanUp(true)
		return Result{}, err
	}

	e.validateFinalResult()

	if err := e.cleanUp(false); err != nil {
		return Result{}, err
	}
	return e.getResult(), nil
}

func (e *ETL) processLines() error {
	for e.reader.Scan() {
		e.lineNo++
		sl := line.New(e.reader.Text(), e.opts.Line, e.lineNo)
		sl.Validate()

		if !sl.IsValid() {
			if err := e.errorReport.Push(sl.Error()); err != nil {
				return err
			}
		}

		if sl.IsValid() && !sl.IsHeader() {
			if err := e.output.Push(sl); err != nil {
				return err
			}
			if !e.sampleSet {
				e.sampleLineData = sl.JSONLine
				e.identifiers = sl.Identifiers()
				e.sampleSet = true
			}
		}
	}
	return e.reader.Err()
}

// validateFinalResult mirrors the TS method: an empty file is invalid, and when
// RejectOnInvalidRow is set any error invalidates the whole result.
func (e *ETL) validateFinalResult() {
	if !e.sampleSet {
		e.valid = false
		_ = e.errorReport.Push("Unable to get data. File content is empty")
		return
	}
	if e.opts.RejectOnInvalidRow && e.errorReport.InvalidRows > 0 {
		e.valid = false
	}
}

// cleanUp ends streams and deletes empty/invalid artifacts. With force=true both
// files are deleted unconditionally (the error path), unifying the TS cleanUp and
// forceCleanUp methods.
func (e *ETL) cleanUp(force bool) error {
	if err := e.output.End(); err != nil {
		return err
	}
	if err := e.errorReport.End(); err != nil {
		return err
	}
	if err := e.reader.Close(); err != nil {
		return err
	}

	if force || e.errorReport.InvalidRows == 0 {
		if err := e.errorReport.Delete(); err != nil {
			return err
		}
	}
	if force || !e.valid {
		if err := e.output.Delete(); err != nil {
			return err
		}
	}
	return nil
}

func (e *ETL) getResult() Result {
	metadata := make(map[string]string, len(e.sampleLineData)+len(e.identifiers))
	for k, v := range e.sampleLineData {
		metadata[k] = v
	}
	for k, v := range e.identifiers { // identifiers win on key collision (matches TS spread order)
		metadata[k] = v
	}

	return Result{
		Valid:                    e.valid,
		WithErrors:               e.errorReport.InvalidRows > 0,
		TotalErrors:              e.errorReport.InvalidRows,
		LocalOutputFile:          e.output.Filepath(),
		LocalOutputFilename:      e.output.Filename(),
		LocalErrorReportFile:     e.errorReport.Filepath(),
		LocalErrorReportFilename: e.errorReport.Filename(),
		Metadata:                 metadata,
	}
}
