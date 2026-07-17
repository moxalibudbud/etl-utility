package writer

import (
	"bytes"
	"context"
	"fmt"
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

// AzureBlobWriter renders output into an in-memory buffer and uploads it as a
// single block blob on End. It mirrors AzureBlobReader: credentials are
// caller-supplied through azureauth.AzureAuth, and the same laziness contract
// as DefaultWriter applies — nothing is uploaded when no valid row was pushed,
// and the (possibly templated) blob name is rendered from the first row.
//
// The whole rendered output is buffered in memory before the upload; bounded
// block streaming is future hardening, the SDK chunks the buffer internally.
type AzureBlobWriter struct {
	opts     OutputConfig
	auth     azureauth.AzureAuth
	gen      *renderer
	buf      bytes.Buffer
	started  bool
	uploaded bool

	// upload and deleteBlob perform the Azure calls. Tests replace them to
	// exercise the writer without contacting Azure.
	upload     func(ctx context.Context, destURL string, data []byte) error
	deleteBlob func(ctx context.Context, destURL string) error
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
	w.upload = w.uploadBlob
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

// Push buffers one validated line, rendering the filename + header on first call.
func (w *AzureBlobWriter) Push(sl *line.SourceLine) error {
	exists := w.gen.isRowExist(sl)

	if w.gen.Filename() == "" {
		w.gen.setFilename(sl)
	}
	if !w.started {
		if w.gen.Filename() == "" {
			return fmt.Errorf(`output filename is empty; set "filename"`)
		}
		w.buf.WriteString(w.gen.header(sl))
		w.started = true
	}
	if exists {
		return nil
	}

	w.buf.WriteString(w.gen.row(sl))
	w.gen.trackReference(sl)
	return nil
}

// PushFooter appends the footer, only if at least one row was pushed.
func (w *AzureBlobWriter) PushFooter() error {
	if !w.started {
		return nil
	}
	w.buf.WriteString(w.gen.footer())
	return nil
}

// End uploads the buffered output as one block blob. Nothing is uploaded when
// no row was pushed, matching DefaultWriter's lazy file creation.
func (w *AzureBlobWriter) End() error {
	if !w.started {
		return nil
	}
	if err := w.upload(context.Background(), w.Filepath(), w.buf.Bytes()); err != nil {
		return err
	}
	w.uploaded = true
	return nil
}

// Delete removes the uploaded blob, tolerating a blob that is already gone.
// Before End it only drops the buffer, mirroring DefaultWriter deleting only
// an existing file.
func (w *AzureBlobWriter) Delete() error {
	w.buf.Reset()
	if !w.uploaded {
		return nil
	}
	w.uploaded = false
	return w.deleteBlob(context.Background(), w.Filepath())
}

func (w *AzureBlobWriter) uploadBlob(ctx context.Context, destURL string, data []byte) error {
	client, err := w.client(destURL)
	if err != nil {
		return err
	}
	_, err = client.UploadBuffer(ctx, data, nil)
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
