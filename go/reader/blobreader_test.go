package reader

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
)

var _ Reader = (*AzureBlobReader)(nil)

const testBlobURL = "https://acct.blob.core.windows.net/imports/daily/products.csv"

// fakeBody records whether the download stream was closed.
type fakeBody struct {
	io.Reader
	closed bool
}

func (b *fakeBody) Close() error {
	b.closed = true
	return nil
}

// openFake wires an AzureBlobReader to an in-memory stream instead of Azure.
func openFake(r *AzureBlobReader, content string) *fakeBody {
	body := &fakeBody{Reader: strings.NewReader(content)}
	r.open = func(context.Context) (io.ReadCloser, error) { return body, nil }
	return body
}

func TestAzureBlobReaderNames(t *testing.T) {
	r := NewAzureBlobReader(testBlobURL+"?sv=1&sig=abc", AzureAuth{})
	if got := r.Filename(); got != "products.csv" {
		t.Fatalf("Filename() = %q, want products.csv", got)
	}
	if got := r.Filepath(); got != testBlobURL+"?sv=1&sig=abc" {
		t.Fatalf("Filepath() = %q", got)
	}
}

func TestAzureBlobReaderScansLinesIncludingCRLF(t *testing.T) {
	r := NewAzureBlobReader(testBlobURL, AzureAuth{})
	openFake(r, "a,b\r\nc,d\ne,f")

	if err := r.Open(); err != nil {
		t.Fatal(err)
	}
	var lines []string
	for r.Scan() {
		lines = append(lines, r.Text())
	}
	if err := r.Err(); err != nil {
		t.Fatal(err)
	}
	want := []string{"a,b", "c,d", "e,f"}
	if len(lines) != len(want) {
		t.Fatalf("lines = %#v, want %#v", lines, want)
	}
	for i := range want {
		if lines[i] != want[i] {
			t.Fatalf("line %d = %q, want %q", i, lines[i], want[i])
		}
	}
}

func TestAzureBlobReaderScansWideLines(t *testing.T) {
	// Wider than bufio.Scanner's 64KiB default: proves the shared buffer
	// sizing is applied to blob streams too.
	wide := strings.Repeat("x", 200*1024)
	r := NewAzureBlobReader(testBlobURL, AzureAuth{})
	openFake(r, wide+"\nend")

	if err := r.Open(); err != nil {
		t.Fatal(err)
	}
	if !r.Scan() {
		t.Fatalf("Scan() = false, err = %v", r.Err())
	}
	if got := r.Text(); got != wide {
		t.Fatalf("wide line length = %d, want %d", len(got), len(wide))
	}
}

func TestAzureBlobReaderOpenErrorPropagates(t *testing.T) {
	r := NewAzureBlobReader(testBlobURL, AzureAuth{})
	openErr := errors.New("boom")
	r.open = func(context.Context) (io.ReadCloser, error) { return nil, openErr }

	if err := r.Open(); !errors.Is(err, openErr) {
		t.Fatalf("Open() = %v, want %v", err, openErr)
	}
}

func TestAzureBlobReaderCloseIsIdempotent(t *testing.T) {
	r := NewAzureBlobReader(testBlobURL, AzureAuth{})
	body := openFake(r, "a\n")

	if err := r.Open(); err != nil {
		t.Fatal(err)
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	if !body.closed {
		t.Fatal("download stream was not closed")
	}
	if err := r.Close(); err != nil {
		t.Fatalf("second Close() = %v, want nil", err)
	}
}

func TestAzureBlobReaderErrBeforeOpen(t *testing.T) {
	r := NewAzureBlobReader(testBlobURL, AzureAuth{})
	if err := r.Err(); err != nil {
		t.Fatalf("Err() before Open = %v, want nil", err)
	}
}

func TestSplitBlobURL(t *testing.T) {
	container, blobName, err := splitBlobURL(testBlobURL)
	if err != nil {
		t.Fatal(err)
	}
	if container != "imports" || blobName != "daily/products.csv" {
		t.Fatalf("split = %q / %q", container, blobName)
	}

	if _, _, err := splitBlobURL("https://acct.blob.core.windows.net/only-container"); err == nil {
		t.Fatal("expected missing blob name to fail")
	}
}

func TestWithSASToken(t *testing.T) {
	if got := withSASToken("https://a.b/c/d.csv", "sig=x"); got != "https://a.b/c/d.csv?sig=x" {
		t.Fatalf("got %q", got)
	}
	if got := withSASToken("https://a.b/c/d.csv", "?sig=x"); got != "https://a.b/c/d.csv?sig=x" {
		t.Fatalf("leading ? not trimmed: %q", got)
	}
	if got := withSASToken("https://a.b/c/d.csv?comp=1", "sig=x"); got != "https://a.b/c/d.csv?comp=1&sig=x" {
		t.Fatalf("existing query not preserved: %q", got)
	}
}

func TestHasSASQuery(t *testing.T) {
	if hasSASQuery(testBlobURL) {
		t.Fatal("plain URL should not report a SAS")
	}
	if !hasSASQuery(testBlobURL + "?sv=1&sig=abc") {
		t.Fatal("URL with sig should report a SAS")
	}
}
