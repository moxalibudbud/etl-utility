package writer

import (
	"fmt"
	"os"

	"flatfile-go/line"
)

// JSONWriter streams validated source lines into one local JSON document. It
// deliberately does not de-duplicate rows: every valid row pushed by the ETL
// orchestrator is serialized.
//
// JSONWriter composes the destination-independent jsonDocumentEncoder with a
// Sink (an atomic LocalSink today, an AzureBlobSink once Phase 3 lands) — see
// the design doc's "Destination abstraction" section.
type JSONWriter struct {
	opts      OutputConfig
	sink      Sink
	filename  string
	encoder   *jsonDocumentEncoder
	started   bool
	finalized bool
	failed    bool
}

func NewJSONWriter(opts OutputConfig) (*JSONWriter, error) {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	if opts.UniqueKey != "" {
		return nil, Permanent("configure json writer", "", fmt.Errorf("output.uniqueKey is not supported for json-generator; deduplicate before writing JSON"))
	}
	if opts.Footer != "" {
		return nil, Permanent("configure json writer", "", fmt.Errorf("output.footer is not supported for json-generator"))
	}
	if opts.Filename == "" {
		return nil, Permanent("configure json writer", "", fmt.Errorf(`output filename is empty; set "filename"`))
	}
	return &JSONWriter{opts: opts, sink: NewAtomicLocalSink(opts.Path)}, nil
}

func (w *JSONWriter) Path() string { return w.opts.Path }

// Options exposes the output-level toggles for writer.OptionsProvider.
func (w *JSONWriter) Options() map[string]any { return w.opts.Options }

func (w *JSONWriter) Filename() string { return w.filename }

func (w *JSONWriter) Filepath() string {
	if w.filename == "" {
		return ""
	}
	return w.sink.Location(w.filename)
}

func (w *JSONWriter) Push(sl *line.SourceLine) error {
	if w.failed {
		return Permanent("push json row", w.Filepath(), fmt.Errorf("json writer is in a failed state"))
	}
	if w.finalized {
		return Permanent("push json row", w.Filepath(), fmt.Errorf("json writer is already finalized"))
	}
	if !w.started {
		if err := w.start(sl); err != nil {
			w.failed = true
			_ = w.sink.Delete()
			return err
		}
	}
	if err := w.encoder.WriteRow(sl); err != nil {
		w.failed = true
		_ = w.sink.Delete()
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
		_ = w.sink.Delete()
		return err
	}
	if err := w.sink.Close(); err != nil {
		_ = w.sink.Delete()
		return err
	}
	w.finalized = true
	return nil
}

func (w *JSONWriter) Delete() error {
	return w.sink.Delete()
}

func (w *JSONWriter) start(sl *line.SourceLine) error {
	w.filename = renderFilename(w.opts, sl)
	if w.filename == "" {
		return Permanent("render json filename", "", fmt.Errorf(`output filename is empty; set "filename"`))
	}

	out, err := w.sink.Start(w.filename)
	if err != nil {
		return err
	}

	encoder, err := newJSONDocumentEncoder(w.opts, out)
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
