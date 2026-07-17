package writer

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"flatfile-go/line"
	"flatfile-go/template"
)

const defaultLineSeparator = "|"

// DefaultWriter is the port of DefaultGenerator: a lazily-created delimited or
// templated text writer with optional uniqueKey de-duplication.
type DefaultWriter struct {
	opts     OutputConfig
	filename string
	file     *os.File
	bw       *bufio.Writer
	rowRefs  map[string]bool
}

// NewDefaultWriter constructs a DefaultWriter, defaulting Path to the OS temp dir
// (the TS default is the hard-coded /var/tmp).
func NewDefaultWriter(opts OutputConfig) *DefaultWriter {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	return &DefaultWriter{opts: opts, rowRefs: map[string]bool{}}
}

func (w *DefaultWriter) Path() string { return w.opts.Path }

func (w *DefaultWriter) Filename() string { return w.filename }

func (w *DefaultWriter) Filepath() string {
	if w.filename == "" {
		return ""
	}
	return filepath.Join(w.opts.Path, w.filename)
}

// Push writes one validated line, creating the file + header on first call.
func (w *DefaultWriter) Push(sl *line.SourceLine) error {
	exists := w.isRowExist(sl)

	if w.filename == "" {
		w.setFilename(sl)
	}
	if w.file == nil {
		if err := w.createStream(); err != nil {
			return err
		}
		if err := w.pushHeader(sl); err != nil {
			return err
		}
	}
	if exists {
		return nil
	}

	if _, err := w.bw.WriteString(w.buildRow(sl)); err != nil {
		return err
	}
	w.trackReference(sl)
	return nil
}

// PushFooter appends the footer, only if a file was actually opened.
func (w *DefaultWriter) PushFooter() error {
	if w.bw == nil || w.opts.Footer == "" {
		return nil
	}
	_, err := w.bw.WriteString(w.opts.Footer)
	return err
}

// End flushes and closes the underlying file.
func (w *DefaultWriter) End() error {
	if w.bw != nil {
		if err := w.bw.Flush(); err != nil {
			return err
		}
	}
	if w.file != nil {
		err := w.file.Close()
		w.file = nil
		return err
	}
	return nil
}

// Delete removes the output file if it exists.
func (w *DefaultWriter) Delete() error {
	if w.file != nil {
		_ = w.file.Close()
		w.file = nil
	}
	path := w.Filepath()
	if path == "" {
		return nil
	}
	if _, err := os.Stat(path); err != nil {
		return nil // nothing to delete
	}
	return os.Remove(path)
}

func (w *DefaultWriter) createStream() error {
	if w.filename == "" {
		return fmt.Errorf(`output filename is empty; set "filename"`)
	}
	f, err := os.OpenFile(w.Filepath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o777)
	if err != nil {
		return err
	}
	w.file = f
	w.bw = bufio.NewWriter(f)
	return nil
}

func (w *DefaultWriter) setFilename(sl *line.SourceLine) {
	w.filename = template.ReplaceWithFunction(
		template.ReplaceWithMap(w.opts.Filename, sl.JSONLine),
		w.buildMeta(sl),
	)
}

func (w *DefaultWriter) pushHeader(sl *line.SourceLine) error {
	if w.opts.Header == "" {
		return nil
	}
	header := template.ReplaceWithFunction(w.opts.Header, w.buildMeta(sl))
	_, err := w.bw.WriteString(header)
	return err
}

// buildRow renders a data row. The ETL orchestrator filters source header rows
// before calling Writer.Push.
func (w *DefaultWriter) buildRow(sl *line.SourceLine) string {
	var row string
	if w.opts.Template != "" {
		row = template.ReplaceWithFunction(
			template.ReplaceWithMap(w.opts.Template, sl.JSONLine),
			w.buildMeta(sl),
		)
	} else {
		row = buildLineFromOutput(sl.Output(), w.opts.Separator)
	}

	return "\n" + row
}

func (w *DefaultWriter) buildMeta(sl *line.SourceLine) map[string]any {
	meta := make(map[string]any, len(sl.AllData())+1)
	for k, v := range sl.AllData() {
		meta[k] = v
	}
	meta["metadata"] = w.opts.Metadata
	return meta
}

func (w *DefaultWriter) isRowExist(sl *line.SourceLine) bool {
	if w.opts.UniqueKey == "" {
		return false
	}
	return w.rowRefs[sl.JSONLine[w.opts.UniqueKey]]
}

func (w *DefaultWriter) trackReference(sl *line.SourceLine) {
	if w.opts.UniqueKey == "" {
		return
	}
	w.rowRefs[sl.JSONLine[w.opts.UniqueKey]] = true
}

// buildLineFromOutput joins ordered output values by separator.
// Port of utils/line-builder-from-line-keys.ts.
func buildLineFromOutput(output []line.KV, separator string) string {
	if separator == "" {
		separator = defaultLineSeparator
	}
	values := make([]string, 0, len(output))
	for _, kv := range output {
		values = append(values, kv.Value)
	}
	return strings.Join(values, separator)
}
