package reader

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
)

// AzureBlobReader streams an Azure blob line by line. It is the Go port of
// typescript/src/file-reader/blob-reader.ts, except credentials are supplied
// by the caller through AzureAuth instead of being read from the environment.
type AzureBlobReader struct {
	source  string // full blob URL
	auth    AzureAuth
	body    io.ReadCloser
	scanner *bufio.Scanner

	// ctx is the work context supplied by reader.New; it bounds the streaming
	// download to the job's time budget. The streaming Open/Scan/Close
	// lifecycle has no per-call context, so the request-scoped context is held
	// on the reader (as with the open func below). It defaults to
	// context.Background() for direct construction in tests.
	ctx context.Context

	// open acquires the blob byte stream. Tests replace it to exercise the
	// reader without contacting Azure.
	open func(ctx context.Context) (io.ReadCloser, error)
}

// NewAzureBlobReader returns a reader for the given blob URL using the
// caller-supplied credentials. reader.New overrides ctx with the run's work
// context; the Background default keeps direct construction (tests) working.
func NewAzureBlobReader(source string, auth AzureAuth) *AzureBlobReader {
	r := &AzureBlobReader{source: source, auth: auth, ctx: context.Background()}
	r.open = r.download
	return r
}

// Open starts the streaming download and prepares the scanner. The scanner
// setup matches LocalFileReader so line limits and CRLF handling are identical
// across sources.
func (r *AzureBlobReader) Open() error {
	body, err := r.open(r.ctx)
	if err != nil {
		return err
	}
	r.body = body
	sc := bufio.NewScanner(body)
	sc.Buffer(make([]byte, 0, 64*1024), maxLineBytes)
	r.scanner = sc
	return nil
}

func (r *AzureBlobReader) Scan() bool { return r.scanner.Scan() }

func (r *AzureBlobReader) Text() string { return r.scanner.Text() }

func (r *AzureBlobReader) Err() error {
	if r.scanner == nil {
		return nil
	}
	return r.scanner.Err()
}

func (r *AzureBlobReader) Close() error {
	if r.body == nil {
		return nil
	}
	err := r.body.Close()
	r.body = nil
	return err
}

func (r *AzureBlobReader) Filename() string {
	if u, err := url.Parse(r.source); err == nil {
		return path.Base(u.Path)
	}
	return path.Base(r.source)
}

func (r *AzureBlobReader) Filepath() string { return r.source }

// download builds the blob client for the identified auth mode and starts the
// streaming download. The response body is scanned incrementally; the whole
// blob is never buffered.
func (r *AzureBlobReader) download(ctx context.Context) (io.ReadCloser, error) {
	client, err := r.client()
	if err != nil {
		return nil, err
	}
	resp, err := client.DownloadStream(ctx, nil)
	if err != nil {
		if bloberror.HasCode(err, bloberror.BlobNotFound, bloberror.ContainerNotFound) {
			// Same message the TS BlobReader throws for a missing blob.
			return nil, fmt.Errorf("%s does not exist.", r.source)
		}
		return nil, err
	}
	return resp.Body, nil
}

func (r *AzureBlobReader) client() (*blob.Client, error) {
	authType, err := r.auth.Type()
	if err != nil {
		return nil, err
	}

	switch authType {
	case AzureAuthConnectionString:
		container, blobName, err := splitBlobURL(r.source)
		if err != nil {
			return nil, err
		}
		return blob.NewClientFromConnectionString(r.auth.ConnectionString, container, blobName, nil)
	case AzureAuthSharedKey:
		cred, err := blob.NewSharedKeyCredential(r.auth.AccountName, r.auth.AccountKey)
		if err != nil {
			return nil, err
		}
		return blob.NewClientWithSharedKeyCredential(r.source, cred, nil)
	case AzureAuthSAS:
		return blob.NewClientWithNoCredential(withSASToken(r.source, r.auth.SASToken), nil)
	default: // AzureAuthDefault
		if hasSASQuery(r.source) {
			// The URL already carries its own SAS; a bearer token must not be
			// sent alongside it.
			return blob.NewClientWithNoCredential(r.source, nil)
		}
		cred, err := azidentity.NewDefaultAzureCredential(nil)
		if err != nil {
			return nil, err
		}
		return blob.NewClient(r.source, cred, nil)
	}
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
