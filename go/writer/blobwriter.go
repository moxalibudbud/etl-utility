package writer

import (
	"fmt"
	"io"
	"os"

	"flatfile-go/azureauth"
	"flatfile-go/line"
)

// AzureBlobWriter renders delimited/templated output the same way
// DefaultWriter does, but through an AzureBlobSink instead of local disk. It
// mirrors AzureBlobReader: the same laziness contract as DefaultWriter
// applies — nothing is uploaded when no valid row was pushed, and the
// (possibly templated) blob name is rendered from the first row.
type AzureBlobWriter struct {
	opts    OutputConfig
	gen     *renderer
	sink    *AzureBlobSink
	out     io.Writer
	started bool
}

// NewAzureBlobWriter returns a writer that uploads to opts.URL (a
// container/prefix URL) joined with the rendered filename. Path stays local:
// it is only used by the sibling error report, defaulting to the OS temp dir
// exactly like DefaultWriter.
func NewAzureBlobWriter(opts OutputConfig) *AzureBlobWriter {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	var auth azureauth.AzureAuth
	if opts.Auth != nil {
		auth = *opts.Auth
	}
	return &AzureBlobWriter{opts: opts, gen: newRenderer(opts), sink: NewAzureBlobSink(opts.URL, auth)}
}

// Path returns the local staging directory used for the error report, not an
// Azure location; the output itself goes to the blob URL.
func (w *AzureBlobWriter) Path() string { return w.opts.Path }

// Options exposes the output-level toggles for writer.OptionsProvider.
func (w *AzureBlobWriter) Options() map[string]any { return w.opts.Options }

func (w *AzureBlobWriter) Filename() string { return w.gen.Filename() }

// Filepath returns the full destination blob URL, empty until the first row
// has rendered the filename.
func (w *AzureBlobWriter) Filepath() string {
	if w.gen.Filename() == "" {
		return ""
	}
	return w.sink.Location(w.gen.Filename())
}

// Push streams one validated line into the upload pipe, rendering the
// filename and starting the background upload on first call. A pipe write
// only returns an error once the upload goroutine has given up (or the input
// is fully consumed), so an upload failure surfaces here as soon as the
// in-flight write can no longer be matched by a read.
func (w *AzureBlobWriter) Push(sl *line.SourceLine) error {
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

// PushFooter streams the footer, only if at least one row was pushed.
func (w *AzureBlobWriter) PushFooter() error {
	if !w.started {
		return nil
	}
	footer := w.gen.footer()
	if footer == "" {
		return nil
	}
	_, err := io.WriteString(w.out, footer)
	return err
}

// End closes the upload pipe, letting the background upload observe EOF and
// commit the blob, then waits for its result. Nothing is uploaded when no row
// was pushed, matching DefaultWriter's lazy file creation.
func (w *AzureBlobWriter) End() error {
	return w.sink.Close()
}

// Delete removes the uploaded blob (or aborts an in-flight upload).
func (w *AzureBlobWriter) Delete() error {
	return w.sink.Delete()
}
