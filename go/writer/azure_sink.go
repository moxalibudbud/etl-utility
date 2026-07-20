package writer

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"

	"flatfile-go/azureauth"
)

// errUploadAborted closes the write side of the pipe when Delete cancels an
// upload that never reached Close, unblocking any writer goroutine mid-write.
var errUploadAborted = errors.New("azure blob writer: upload aborted")

// AzureBlobSink streams written bytes to a block blob through an io.Pipe:
// Start returns the write side, and a background goroutine reads the other
// end via blockblob.UploadStream, so memory use stays bounded by the SDK's
// block buffers rather than the whole output. Credentials are
// caller-supplied through azureauth.AzureAuth, mirroring AzureBlobReader.
type AzureBlobSink struct {
	urlPrefix string
	auth      azureauth.AzureAuth

	pw       *io.PipeWriter
	done     chan error // the single result of the background upload
	destURL  string
	started  bool // beginUpload has run
	finished bool // done has been drained (success, failure, or abort)
	uploaded bool // the upload completed and committed a blob

	// startUpload and deleteBlob perform the Azure calls. Tests replace them
	// to exercise the sink without contacting Azure. startUpload runs in a
	// background goroutine and must read body to completion (or return an
	// error), since Start's pipe writes block until a matching read.
	startUpload func(ctx context.Context, destURL string, body io.Reader) error
	deleteBlob  func(ctx context.Context, destURL string) error
}

// NewAzureBlobSink returns a sink that uploads to urlPrefix (a container/
// prefix URL) joined with whatever filename Start is called with.
func NewAzureBlobSink(urlPrefix string, auth azureauth.AzureAuth) *AzureBlobSink {
	s := &AzureBlobSink{urlPrefix: urlPrefix, auth: auth}
	s.startUpload = s.uploadStream
	s.deleteBlob = s.deleteUploadedBlob
	return s
}

// Location joins the rendered filename onto the container/prefix URL,
// preserving any query string (for example a SAS embedded in the URL).
func (s *AzureBlobSink) Location(filename string) string {
	return joinBlobURL(s.urlPrefix, filename)
}

// Start wires the pipe and starts the background upload. Called once, after
// the filename (and therefore the destination URL) is known.
func (s *AzureBlobSink) Start(filename string) (io.Writer, error) {
	if filename == "" {
		return nil, fmt.Errorf(`output filename is empty; set "filename"`)
	}
	pr, pw := io.Pipe()
	s.pw = pw
	s.done = make(chan error, 1)
	s.destURL = s.Location(filename)
	go func() {
		err := s.startUpload(context.Background(), s.destURL, pr)
		// Unblock any writer currently or later blocked on pw with the real
		// failure reason, not a generic closed-pipe error.
		_ = pr.CloseWithError(err)
		s.done <- err
	}()
	s.started = true
	return pw, nil
}

// Close closes the upload pipe, letting the background upload observe EOF
// and commit the blob, then waits for its result.
func (s *AzureBlobSink) Close() error {
	if !s.started || s.finished {
		return nil
	}
	_ = s.pw.Close()
	err := <-s.done
	s.finished = true
	if err != nil {
		return err
	}
	s.uploaded = true
	return nil
}

// Delete removes the uploaded blob. If called before Close (an in-flight or
// never-finalized upload), it aborts the upload by closing the pipe with an
// error instead, so nothing is committed; the background goroutine is always
// awaited so Delete cannot return while it is still running.
func (s *AzureBlobSink) Delete() error {
	if !s.started {
		return nil
	}
	if !s.finished {
		_ = s.pw.CloseWithError(errUploadAborted)
		<-s.done
		s.finished = true
	}
	if !s.uploaded {
		return nil
	}
	s.uploaded = false
	return s.deleteBlob(context.Background(), s.destURL)
}

func (s *AzureBlobSink) uploadStream(ctx context.Context, destURL string, body io.Reader) error {
	client, err := s.client(destURL)
	if err != nil {
		return err
	}
	_, err = client.UploadStream(ctx, body, nil)
	return err
}

func (s *AzureBlobSink) deleteUploadedBlob(ctx context.Context, destURL string) error {
	client, err := s.client(destURL)
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
func (s *AzureBlobSink) client(destURL string) (*blockblob.Client, error) {
	authType, err := s.auth.Type()
	if err != nil {
		return nil, err
	}

	switch authType {
	case azureauth.ConnectionString:
		container, blobName, err := splitBlobURL(destURL)
		if err != nil {
			return nil, err
		}
		return blockblob.NewClientFromConnectionString(s.auth.ConnectionString, container, blobName, nil)
	case azureauth.SharedKey:
		cred, err := blob.NewSharedKeyCredential(s.auth.AccountName, s.auth.AccountKey)
		if err != nil {
			return nil, err
		}
		return blockblob.NewClientWithSharedKeyCredential(destURL, cred, nil)
	case azureauth.SAS:
		return blockblob.NewClientWithNoCredential(withSASToken(destURL, s.auth.SASToken), nil)
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
