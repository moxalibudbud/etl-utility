package writer

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"

	"flatfile-go/azureauth"
	"flatfile-go/line"
)

// errUploadAborted closes the write side of the pipe when Delete cancels an
// upload that never reached End, unblocking any writer goroutine mid-write.
var errUploadAborted = errors.New("azure blob writer: upload aborted")

// AzureBlobWriter streams rendered output to a block blob through an io.Pipe:
// Push writes render into the pipe, and a background goroutine reads the
// other end via blockblob.UploadStream, so memory use stays bounded by the
// SDK's block buffers rather than the whole output. It mirrors
// AzureBlobReader: credentials are caller-supplied through
// azureauth.AzureAuth, and the same laziness contract as DefaultWriter
// applies — nothing is uploaded when no valid row was pushed, and the
// (possibly templated) blob name is rendered from the first row.
type AzureBlobWriter struct {
	opts OutputConfig
	auth azureauth.AzureAuth
	gen  *renderer

	pw       *io.PipeWriter
	done     chan error // the single result of the background upload
	started  bool       // beginUpload has run
	finished bool       // done has been drained (success, failure, or abort)
	uploaded bool       // the upload completed and committed a blob

	// startUpload and deleteBlob perform the Azure calls. Tests replace them
	// to exercise the writer without contacting Azure. startUpload runs in a
	// background goroutine and must read body to completion (or return an
	// error), since Push's pipe writes block until a matching read.
	startUpload func(ctx context.Context, destURL string, body io.Reader) error
	deleteBlob  func(ctx context.Context, destURL string) error
}

// NewAzureBlobWriter returns a writer that uploads to opts.URL (a
// container/prefix URL) joined with the rendered filename. Path stays local:
// it is only used by the sibling error report, defaulting to the OS temp dir
// exactly like DefaultWriter.
func NewAzureBlobWriter(opts OutputConfig) *AzureBlobWriter {
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	w := &AzureBlobWriter{opts: opts, gen: newRenderer(opts)}
	if opts.Auth != nil {
		w.auth = *opts.Auth
	}
	w.startUpload = w.uploadStream
	w.deleteBlob = w.deleteUploadedBlob
	return w
}

// Path returns the local staging directory used for the error report, not an
// Azure location; the output itself goes to the blob URL.
func (w *AzureBlobWriter) Path() string { return w.opts.Path }

func (w *AzureBlobWriter) Filename() string { return w.gen.Filename() }

// Filepath returns the full destination blob URL, empty until the first row
// has rendered the filename.
func (w *AzureBlobWriter) Filepath() string {
	if w.gen.Filename() == "" {
		return ""
	}
	return joinBlobURL(w.opts.URL, w.gen.Filename())
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
			return fmt.Errorf(`output filename is empty; set "filename"`)
		}
		w.beginUpload()
		if header := w.gen.header(sl); header != "" {
			if _, err := io.WriteString(w.pw, header); err != nil {
				return err
			}
		}
	}
	if exists {
		return nil
	}

	if _, err := io.WriteString(w.pw, w.gen.row(sl)); err != nil {
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
	_, err := io.WriteString(w.pw, footer)
	return err
}

// End closes the upload pipe, letting the background upload observe EOF and
// commit the blob, then waits for its result. Nothing is uploaded when no row
// was pushed, matching DefaultWriter's lazy file creation.
func (w *AzureBlobWriter) End() error {
	if !w.started || w.finished {
		return nil
	}
	_ = w.pw.Close()
	err := <-w.done
	w.finished = true
	if err != nil {
		return err
	}
	w.uploaded = true
	return nil
}

// Delete removes the uploaded blob. If called before End (an in-flight or
// never-finalized upload), it aborts the upload by closing the pipe with an
// error instead, so nothing is committed; the background goroutine is always
// awaited so Delete cannot return while it is still running.
func (w *AzureBlobWriter) Delete() error {
	if !w.started {
		return nil
	}
	if !w.finished {
		_ = w.pw.CloseWithError(errUploadAborted)
		<-w.done
		w.finished = true
	}
	if !w.uploaded {
		return nil
	}
	w.uploaded = false
	return w.deleteBlob(context.Background(), w.Filepath())
}

// beginUpload wires the pipe and starts the background upload. Called once,
// from Push, after the filename (and therefore the destination URL) is known.
func (w *AzureBlobWriter) beginUpload() {
	pr, pw := io.Pipe()
	w.pw = pw
	w.done = make(chan error, 1)
	destURL := w.Filepath()
	go func() {
		err := w.startUpload(context.Background(), destURL, pr)
		// Unblock any writer currently or later blocked on pw with the real
		// failure reason, not a generic closed-pipe error.
		_ = pr.CloseWithError(err)
		w.done <- err
	}()
	w.started = true
}

func (w *AzureBlobWriter) uploadStream(ctx context.Context, destURL string, body io.Reader) error {
	client, err := w.client(destURL)
	if err != nil {
		return err
	}
	_, err = client.UploadStream(ctx, body, nil)
	return err
}

func (w *AzureBlobWriter) deleteUploadedBlob(ctx context.Context, destURL string) error {
	client, err := w.client(destURL)
	if err != nil {
		return err
	}
	if _, err := client.Delete(ctx, nil); err != nil {
		if bloberror.HasCode(err, bloberror.BlobNotFound, bloberror.ContainerNotFound) {
			return nil // nothing to delete
		}
		return err
	}
	return nil
}

// client builds the block-blob client for the identified auth mode; the
// dispatch mirrors AzureBlobReader.client.
func (w *AzureBlobWriter) client(destURL string) (*blockblob.Client, error) {
	authType, err := w.auth.Type()
	if err != nil {
		return nil, err
	}

	switch authType {
	case azureauth.ConnectionString:
		container, blobName, err := splitBlobURL(destURL)
		if err != nil {
			return nil, err
		}
		return blockblob.NewClientFromConnectionString(w.auth.ConnectionString, container, blobName, nil)
	case azureauth.SharedKey:
		cred, err := blob.NewSharedKeyCredential(w.auth.AccountName, w.auth.AccountKey)
		if err != nil {
			return nil, err
		}
		return blockblob.NewClientWithSharedKeyCredential(destURL, cred, nil)
	case azureauth.SAS:
		return blockblob.NewClientWithNoCredential(withSASToken(destURL, w.auth.SASToken), nil)
	default: // azureauth.Default
		if hasSASQuery(destURL) {
			// The URL already carries its own SAS; a bearer token must not be
			// sent alongside it.
			return blockblob.NewClientWithNoCredential(destURL, nil)
		}
		cred, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			return nil, err
		}
		return blockblob.NewClient(destURL, cred, nil)
	}
}

// joinBlobURL appends the rendered filename to the container/prefix URL,
// preserving any query string (for example a SAS embedded in the URL).
func joinBlobURL(prefix, name string) string {
	u, err := url.Parse(prefix)
	if err != nil {
		return strings.TrimSuffix(prefix, "/") + "/" + name
	}
	return u.JoinPath(name).String()
}

// splitBlobURL extracts the container and blob name from a blob URL; the
// connection-string client needs them separately because the endpoint comes
// from the connection string.
func splitBlobURL(source string) (container, blobName string, err error) {
	u, err := url.Parse(source)
	if err != nil {
		return "", "", fmt.Errorf("invalid blob URL %q: %w", source, err)
	}
	container, blobName, ok := strings.Cut(strings.TrimPrefix(u.Path, "/"), "/")
	if !ok || container == "" || blobName == "" {
		return "", "", fmt.Errorf("blob URL %q must contain a container and blob name", source)
	}
	return container, blobName, nil
}

// withSASToken appends a caller-supplied SAS token to the blob URL, tolerating
// a leading "?" on the token and a URL that already has query parameters.
func withSASToken(source, token string) string {
	token = strings.TrimPrefix(token, "?")
	if strings.Contains(source, "?") {
		return source + "&" + token
	}
	return source + "?" + token
}

// hasSASQuery reports whether the URL already embeds a SAS signature.
func hasSASQuery(source string) bool {
	u, err := url.Parse(source)
	if err != nil {
		return false
	}
	return u.Query().Get("sig") != ""
}
