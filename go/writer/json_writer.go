package writer

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"

	"flatfile-go/line"
)

// JSONWriter streams validated source lines into one local JSON document. It
// deliberately does not de-duplicate rows: every valid row pushed by the ETL
// orchestrator is serialized.
type JSONWriter struct {
	opts        OutputConfig
	filename    string
	file        *os.File
	bw          *bufio.Writer
	encoder     *jsonDocumentEncoder
	started     bool
	finalized   bool
	failed      bool
	partialPath string
	finalPath   string
}

func NewJSONWriter(opts OutputConfig) (*JSONWriter, error) {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	if opts.UniqueKey != "" {
		return nil, fmt.Errorf("output.uniqueKey is not supported for json-generator; deduplicate before writing JSON")
	}
	if opts.Footer != "" {
		return nil, fmt.Errorf("output.footer is not supported for json-generator")
	}
	if opts.Filename == "" {
		return nil, fmt.Errorf(`output filename is empty; set "filename"`)
	}
	return &JSONWriter{opts: opts}, nil
}

func (w *JSONWriter) Path() string { return w.opts.Path }

func (w *JSONWriter) Filename() string { return w.filename }

func (w *JSONWriter) Filepath() string {
	if w.finalPath == "" && w.filename != "" {
		return filepath.Join(w.opts.Path, w.filename)
	}
	return w.finalPath
}

func (w *JSONWriter) Push(sl *line.SourceLine) error {
	if w.failed {
		return fmt.Errorf("json writer is in a failed state")
	}
	if w.finalized {
		return fmt.Errorf("json writer is already finalized")
	}
	if !w.started {
		if err := w.start(sl); err != nil {
			w.failed = true
			w.cleanupPartial()
			return err
		}
	}
	if err := w.encoder.WriteRow(sl); err != nil {
		w.failed = true
		w.cleanupPartial()
		return err
	}
	return nil
}

func (w *JSONWriter) PushFooter() error {
	return nil
}

func (w *JSONWriter) End() error {
	if !w.started || w.finalized || w.failed {
		return nil
	}
	if err := w.encoder.Finalize(); err != nil {
		w.cleanupPartial()
		return err
	}
	if err := w.bw.Flush(); err != nil {
		w.cleanupPartial()
		return err
	}
	if err := w.file.Sync(); err != nil {
		w.cleanupPartial()
		return err
	}
	if err := w.file.Close(); err != nil {
		w.file = nil
		w.cleanupPartial()
		return err
	}
	w.file = nil
	if err := os.Rename(w.partialPath, w.finalPath); err != nil {
		w.cleanupPartial()
		return err
	}
	w.finalized = true
	return nil
}

func (w *JSONWriter) Delete() error {
	w.cleanupPartial()
	if w.finalPath == "" {
		return nil
	}
	if err := os.Remove(w.finalPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (w *JSONWriter) start(sl *line.SourceLine) error {
	w.filename = renderFilename(w.opts, sl)
	if w.filename == "" {
		return fmt.Errorf(`output filename is empty; set "filename"`)
	}
	w.finalPath = filepath.Join(w.opts.Path, w.filename)
	w.partialPath = w.finalPath + ".partial"

	f, err := os.OpenFile(w.partialPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o666)
	if err != nil {
		return err
	}
	w.file = f
	w.bw = bufio.NewWriter(f)

	encoder, err := newJSONDocumentEncoder(w.opts, w.bw)
	if err != nil {
		return err
	}
	w.encoder = encoder
	if err := w.encoder.Start(sl); err != nil {
		return err
	}
	w.started = true
	return nil
}

func (w *JSONWriter) cleanupPartial() {
	if w.bw != nil {
		_ = w.bw.Flush()
	}
	if w.file != nil {
		_ = w.file.Close()
		w.file = nil
	}
	if w.partialPath != "" {
		_ = os.Remove(w.partialPath)
	}
}
