package writer

import (
	"fmt"
	"io"
	"os"

	"flatfile-go/line"
)

// DefaultWriter is the port of DefaultGenerator: a lazily-created delimited or
// templated text writer with optional uniqueKey de-duplication. Rendering is
// delegated to the shared renderer; a LocalSink (in its append mode, matching
// this writer's historical bytes-on-disk contract) owns the local-disk I/O.
type DefaultWriter struct {
	opts    OutputConfig
	gen     *renderer
	sink    *LocalSink
	out     io.Writer
	started bool
}

// NewDefaultWriter constructs a DefaultWriter, defaulting Path to the OS temp dir
// (the TS default is the hard-coded /var/tmp).
func NewDefaultWriter(opts OutputConfig) *DefaultWriter {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	return &DefaultWriter{opts: opts, gen: newRenderer(opts), sink: NewLocalSink(opts.Path)}
}

func (w *DefaultWriter) Path() string { return w.opts.Path }

// Options exposes the output-level toggles for writer.OptionsProvider.
func (w *DefaultWriter) Options() map[string]any { return w.opts.Options }

func (w *DefaultWriter) Filename() string { return w.gen.Filename() }

func (w *DefaultWriter) Filepath() string {
	if w.gen.Filename() == "" {
		return ""
	}
	return w.sink.Location(w.gen.Filename())
}

// Push writes one validated line, creating the file + header on first call.
func (w *DefaultWriter) Push(sl *line.SourceLine) error {
	exists := w.gen.isRowExist(sl)

	if w.gen.Filename() == "" {
		w.gen.setFilename(sl)
	}
	if !w.started {
		if w.gen.Filename() == "" {
			return Permanent("render output filename", "", fmt.Errorf(`output filename is empty; set "filename"`))
		}
		out, err := w.sink.Start(w.gen.Filename())
		if err != nil {
			return err
		}
		w.out = out
		w.started = true
		if header := w.gen.header(sl); header != "" {
			if _, err := io.WriteString(w.out, header); err != nil {
				return err
			}
		}
	}
	if exists {
		return nil
	}

	if _, err := io.WriteString(w.out, w.gen.row(sl)); err != nil {
		return err
	}
	w.gen.trackReference(sl)
	return nil
}

// PushFooter appends the footer, only if a file was actually opened.
func (w *DefaultWriter) PushFooter() error {
	if !w.started || w.gen.footer() == "" {
		return nil
	}
	_, err := io.WriteString(w.out, w.gen.footer())
	return err
}

// End flushes and closes the underlying file.
func (w *DefaultWriter) End() error {
	return w.sink.Close()
}

// Delete removes the output file if it exists.
func (w *DefaultWriter) Delete() error {
	return w.sink.Delete()
}
