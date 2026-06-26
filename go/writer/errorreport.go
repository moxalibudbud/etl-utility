package writer

import (
	"bufio"
	"os"
	"path/filepath"
)

// ErrorReport is the port of ErrorReport: a lazily-created "<source>.error.txt"
// file with a running invalid-row count. Laziness means no file is created when
// there are zero errors, so the ETL cleanup delete becomes a no-op.
type ErrorReport struct {
	path        string
	filename    string
	file        *os.File
	bw          *bufio.Writer
	InvalidRows int
}

// NewErrorReport builds the report for a given source filename. The ".error.txt"
// suffix matches the TS ErrorReport constructor. An empty path defaults to the
// OS temp dir.
func NewErrorReport(sourceFilename, path string) *ErrorReport {
	if path == "" {
		path = os.TempDir()
	}
	return &ErrorReport{path: path, filename: sourceFilename + ".error.txt"}
}

func (e *ErrorReport) Filename() string { return e.filename }

func (e *ErrorReport) Filepath() string { return filepath.Join(e.path, e.filename) }

// Push appends a line (newline-terminated) and increments the invalid-row count.
func (e *ErrorReport) Push(line string) error {
	if e.file == nil {
		f, err := os.OpenFile(e.Filepath(), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o777)
		if err != nil {
			return err
		}
		e.file = f
		e.bw = bufio.NewWriter(f)
	}
	if _, err := e.bw.WriteString(line + "\n"); err != nil {
		return err
	}
	e.InvalidRows++
	return nil
}

// End flushes and closes the report file.
func (e *ErrorReport) End() error {
	if e.bw != nil {
		if err := e.bw.Flush(); err != nil {
			return err
		}
	}
	if e.file != nil {
		err := e.file.Close()
		e.file = nil
		return err
	}
	return nil
}

// Delete removes the report file if it exists.
func (e *ErrorReport) Delete() error {
	if e.file != nil {
		_ = e.file.Close()
		e.file = nil
	}
	if _, err := os.Stat(e.Filepath()); err != nil {
		return nil
	}
	return os.Remove(e.Filepath())
}
