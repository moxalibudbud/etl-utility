package writer

import (
	"bufio"
	"os"
	"path/filepath"
)

// ErrorReport is the port of ErrorReport: a lazily-created "<source>.error.txt"
// file with a running invalid-row count. Laziness means no file is created when
// there are zero errors, so the ETL cleanup delete becomes a no-op.
//
// The file itself is opt-in (OptionErrorReport, default off). When disabled the
// report still counts invalid rows — RejectOnInvalidRow and Result.TotalErrors
// depend on that count and must behave identically either way — but never
// touches the filesystem and reports an empty path, so a caller cannot be
// handed a filename that was never written.
type ErrorReport struct {
	path        string
	filename    string
	enabled     bool
	file        *os.File
	bw          *bufio.Writer
	InvalidRows int
}

// NewErrorReport builds the report for a given source filename. The ".error.txt"
// suffix matches the TS ErrorReport constructor. An empty path defaults to the
// OS temp dir. When enabled is false the report counts rows without producing a
// file; see writer.ErrorReportEnabled for how callers derive it from config.
func NewErrorReport(sourceFilename, path string, enabled bool) *ErrorReport {
	if path == "" {
		path = os.TempDir()
	}
	return &ErrorReport{path: path, filename: sourceFilename + ".error.txt", enabled: enabled}
}

// Filename returns the report filename, or "" when the report is disabled and
// no file will exist.
func (e *ErrorReport) Filename() string {
	if !e.enabled {
		return ""
	}
	return e.filename
}

// Filepath returns the report path, or "" when the report is disabled.
func (e *ErrorReport) Filepath() string {
	if !e.enabled {
		return ""
	}
	return e.filePath()
}

// filePath is the unconditional on-disk location, used internally so the
// public accessors can stay empty while the report is disabled.
func (e *ErrorReport) filePath() string { return filepath.Join(e.path, e.filename) }

// Push counts an invalid row and, when the report is enabled, appends it
// (newline-terminated) to the report file.
func (e *ErrorReport) Push(line string) error {
	if !e.enabled {
		e.InvalidRows++
		return nil
	}
	if e.file == nil {
		f, err := os.OpenFile(e.filePath(), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o777)
		if err != nil {
			return Classify("open error report", e.filePath(), err)
		}
		e.file = f
		e.bw = bufio.NewWriter(f)
	}
	if _, err := e.bw.WriteString(line + "\n"); err != nil {
		return Classify("write error report", e.filePath(), err)
	}
	e.InvalidRows++
	return nil
}

// End flushes and closes the report file.
func (e *ErrorReport) End() error {
	if e.bw != nil {
		if err := e.bw.Flush(); err != nil {
			_ = e.file.Close()
			e.file = nil
			return Classify("flush error report", e.filePath(), err)
		}
	}
	if e.file != nil {
		err := e.file.Close()
		e.file = nil
		return Classify("close error report", e.filePath(), err)
	}
	return nil
}

// Delete removes the report file if it exists. A failure here is Unresolved
// rather than Permanent: the run leaves a file behind that the caller must
// reconcile, which on a warm serverless container accumulates in the scratch
// filesystem across invocations.
func (e *ErrorReport) Delete() error {
	if !e.enabled {
		return nil
	}
	if e.file != nil {
		_ = e.file.Close()
		e.file = nil
	}
	if _, err := os.Stat(e.filePath()); err != nil {
		return nil
	}
	if err := os.Remove(e.filePath()); err != nil {
		return Unresolved("delete error report", e.filePath(), err)
	}
	return nil
}
