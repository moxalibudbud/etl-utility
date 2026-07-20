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

	// workCtx bounds the upload and its commit; cleanupCtx bounds the abort/
	// delete and is independent of workCtx (see Budget.Deadlines) so cleanup
	// still runs after work hits its deadline. Both default to
	// context.Background() and are overridden via setDeadlineContexts.
	workCtx    context.Context
	cleanupCtx context.Context

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
	s := &AzureBlobSink{
		urlPrefix:  urlPrefix,
		auth:       auth,
		workCtx:    context.Background(),
		cleanupCtx: context.Background(),
	}
	s.startUpload = s.uploadStream
	s.deleteBlob = s.deleteUploadedBlob
	return s
}

// setDeadlineContexts injects the run's work and cleanup contexts. A nil
// context is ignored so a partial wiring never drops back to no deadline
// unintentionally.
func (s *AzureBlobSink) setDeadlineContexts(work, cleanup context.Context) {
	if work != nil {
		s.workCtx = work
	}
	if cleanup != nil {
		s.cleanupCtx = cleanup
	}
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
		return nil, Permanent("open output", "", fmt.Errorf(`output filename is empty; set "filename"`))
	}
	pr, pw := io.Pipe()
	s.pw = pw
	s.done = make(chan error, 1)
	s.destURL = s.Location(filename)
	go func() {
		// workCtx bounds the whole upload, including the final Put Block List
		// that Close awaits: a stalled upload fails on the job deadline rather
		// than running until the host kills the process.
		err := s.startUpload(s.workCtx, s.destURL, pr)
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
//
// A failure here is classified by cause via Classify rather than reported as
// a blanket kind: per the design doc's chosen atomicity model, the blob does
// not exist until UploadStream's internal Put Block List commits, so an
// error at this point means nothing was left behind — the only open question
// is whether the underlying cause (throttling vs. a rejected request) makes
// a retry worthwhile, and Azure's response tells us that.
func (s *AzureBlobSink) Close() error {
	if !s.started || s.finished {
		return nil
	}
	_ = s.pw.Close()
	err := <-s.done
	s.finished = true
	if err != nil {
		return Classify("commit blob", s.destURL, err)
	}
	s.uploaded = true
	return nil
}

// Delete removes the uploaded blob. If called before Close (an in-flight or
// never-finalized upload), it aborts the upload by closing the pipe with an
// error instead, so nothing is committed; the background goroutine is always
// awaited so Delete cannot return while it is still running.
//
// Unlike Close, a failure to remove an already-uploaded blob is always
// Unresolved regardless of cause: the blob is confirmed to exist (uploaded
// was true) and the caller's request to remove it did not succeed, which is
// exactly the state a worker handler must reconcile rather than retry blind
// (a retry that re-runs the whole pipeline would upload a duplicate document
// alongside the one this call failed to remove).
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
	if err := s.deleteBlob(s.cleanupCtx, s.destURL); err != nil {
		return Unresolved("delete blob", s.destURL, err)
	}
	s.uploaded = false
	return nil
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
