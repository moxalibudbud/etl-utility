package writer

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"

	"flatfile-go/line"
)

// DefaultWriter is the port of DefaultGenerator: a lazily-created delimited or
// templated text writer with optional uniqueKey de-duplication. Rendering is
// delegated to the shared renderer; this type owns only the local-disk sink.
type DefaultWriter struct {
	opts OutputConfig
	gen  *renderer
	file *os.File
	bw   *bufio.Writer
}

// NewDefaultWriter constructs a DefaultWriter, defaulting Path to the OS temp dir
// (the TS default is the hard-coded /var/tmp).
func NewDefaultWriter(opts OutputConfig) *DefaultWriter {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	return &DefaultWriter{opts: opts, gen: newRenderer(opts)}
}

func (w *DefaultWriter) Path() string { return w.opts.Path }

func (w *DefaultWriter) Filename() string { return w.gen.Filename() }

func (w *DefaultWriter) Filepath() string {
	if w.gen.Filename() == "" {
		return ""
	}
	return filepath.Join(w.opts.Path, w.gen.Filename())
}

// Push writes one validated line, creating the file + header on first call.
func (w *DefaultWriter) Push(sl *line.SourceLine) error {
	exists := w.gen.isRowExist(sl)

	if w.gen.Filename() == "" {
		w.gen.setFilename(sl)
	}
	if w.file == nil {
		if err := w.createStream(); err != nil {
			return err
		}
		if header := w.gen.header(sl); header != "" {
			if _, err := w.bw.WriteString(header); err != nil {
				return err
			}
		}
	}
	if exists {
		return nil
	}

	if _, err := w.bw.WriteString(w.gen.row(sl)); err != nil {
		return err
	}
	w.gen.trackReference(sl)
	return nil
}

// PushFooter appends the footer, only if a file was actually opened.
func (w *DefaultWriter) PushFooter() error {
	if w.bw == nil || w.gen.footer() == "" {
		return nil
	}
	_, err := w.bw.WriteString(w.gen.footer())
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
	if w.gen.Filename() == "" {
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
