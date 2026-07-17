package writer

import (
	"context"
	"os"
	"testing"

	"flatfile-go/line"
)

var _ Writer = (*AzureBlobWriter)(nil)

const testContainerURL = "https://acct.blob.core.windows.net/exports/daily"

// fakeBlob captures upload/delete calls so tests never contact Azure.
type fakeBlob struct {
	uploadedURL  string
	uploadedData []byte
	uploads      int
	deletedURL   string
	deletes      int
}

func newBlobWriterForTest(t *testing.T, opts OutputConfig) (*AzureBlobWriter, *fakeBlob) {
	t.Helper()
	opts.DestinationConfig = DestinationConfig{Type: DestinationAzureBlob, URL: testContainerURL}
	w := NewAzureBlobWriter(opts)
	fake := &fakeBlob{}
	w.upload = func(_ context.Context, destURL string, data []byte) error {
		fake.uploadedURL = destURL
		fake.uploadedData = append([]byte(nil), data...)
		fake.uploads++
		return nil
	}
	w.deleteBlob = func(_ context.Context, destURL string) error {
		fake.deletedURL = destURL
		fake.deletes++
		return nil
	}
	return w, fake
}

func pushLine(t *testing.T, w *AzureBlobWriter, raw string) {
	t.Helper()
	sl := line.New(raw, line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)
	if err := w.Push(sl); err != nil {
		t.Fatalf("push: %v", err)
	}
}

func TestBlobWriterUploadsOnceOnEnd(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{
		Filename: "out_{LOC}.csv",
		Header:   "loc;item",
		Footer:   "\nEOF",
		Template: "{LOC};{ITEM}",
	})
	pushLine(t, w, "1005;ABC")
	pushLine(t, w, "1006;DEF")
	if err := w.PushFooter(); err != nil {
		t.Fatalf("push footer: %v", err)
	}
	if fake.uploads != 0 {
		t.Fatalf("uploaded before End: %d", fake.uploads)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}

	if fake.uploads != 1 {
		t.Fatalf("uploads = %d, want 1", fake.uploads)
	}
	if want := testContainerURL + "/out_1005.csv"; fake.uploadedURL != want {
		t.Fatalf("uploaded URL = %q, want %q", fake.uploadedURL, want)
	}
	if want := "loc;item\n1005;ABC\n1006;DEF\nEOF"; string(fake.uploadedData) != want {
		t.Fatalf("uploaded bytes = %q, want %q", fake.uploadedData, want)
	}
	if w.Filename() != "out_1005.csv" {
		t.Fatalf("Filename = %q", w.Filename())
	}
	if w.Filepath() != testContainerURL+"/out_1005.csv" {
		t.Fatalf("Filepath = %q", w.Filepath())
	}
}

func TestBlobWriterMatchesDefaultWriterBytes(t *testing.T) {
	opts := OutputConfig{
		Filename:  "out.csv",
		Header:    "loc;item",
		Footer:    "\nEOF",
		Separator: ";",
	}

	localOpts := opts
	localOpts.DestinationConfig = DestinationConfig{Path: t.TempDir()}
	local := NewDefaultWriter(localOpts)
	sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)
	if err := local.Push(sl); err != nil {
		t.Fatalf("local push: %v", err)
	}
	if err := local.PushFooter(); err != nil {
		t.Fatalf("local footer: %v", err)
	}
	if err := local.End(); err != nil {
		t.Fatalf("local end: %v", err)
	}
	t.Cleanup(func() { _ = local.Delete() })
	localBytes, err := os.ReadFile(local.Filepath())
	if err != nil {
		t.Fatalf("read local output: %v", err)
	}

	w, fake := newBlobWriterForTest(t, opts)
	pushLine(t, w, "1005;ABC")
	if err := w.PushFooter(); err != nil {
		t.Fatalf("blob footer: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("blob end: %v", err)
	}

	if string(fake.uploadedData) != string(localBytes) {
		t.Fatalf("blob bytes = %q, local bytes = %q", fake.uploadedData, localBytes)
	}
}

func TestBlobWriterLazyNoUploadOnEmptyInput(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Footer: "EOF"})
	if err := w.PushFooter(); err != nil {
		t.Fatalf("push footer: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if fake.uploads != 0 {
		t.Fatalf("uploads = %d, want 0 for empty input", fake.uploads)
	}
	if err := w.Delete(); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if fake.deletes != 0 {
		t.Fatalf("deletes = %d, want 0 when nothing was uploaded", fake.deletes)
	}
}

func TestBlobWriterDedupByUniqueKey(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{
		Filename:  "out.csv",
		UniqueKey: "LOC",
		Template:  "{LOC};{ITEM}",
	})
	pushLine(t, w, "1005;ABC")
	pushLine(t, w, "1005;DUPLICATE")
	pushLine(t, w, "1006;DEF")
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if want := "\n1005;ABC\n1006;DEF"; string(fake.uploadedData) != want {
		t.Fatalf("uploaded bytes = %q, want %q", fake.uploadedData, want)
	}
}

func TestBlobWriterDeleteRemovesUploadedBlob(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
	pushLine(t, w, "1005;ABC")
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if err := w.Delete(); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if fake.deletes != 1 || fake.deletedURL != testContainerURL+"/out.csv" {
		t.Fatalf("deletes = %d, URL = %q", fake.deletes, fake.deletedURL)
	}
}

func TestBlobWriterEmptyFilenameErrors(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{})
	sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)
	if err := w.Push(sl); err == nil {
		t.Fatal("expected error for empty filename")
	}
}

func TestBlobWriterPathStaysLocalForErrorReport(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv"})
	if w.Path() == "" || w.Path() == testContainerURL {
		t.Fatalf("Path = %q, want a local staging directory", w.Path())
	}
}

func TestJoinBlobURLPreservesQuery(t *testing.T) {
	tests := []struct {
		prefix, name, want string
	}{
		{"https://acct.blob.core.windows.net/exports", "out.csv", "https://acct.blob.core.windows.net/exports/out.csv"},
		{"https://acct.blob.core.windows.net/exports/", "out.csv", "https://acct.blob.core.windows.net/exports/out.csv"},
		{"https://acct.blob.core.windows.net/exports?sv=1&sig=abc", "out.csv", "https://acct.blob.core.windows.net/exports/out.csv?sv=1&sig=abc"},
	}
	for _, tt := range tests {
		if got := joinBlobURL(tt.prefix, tt.name); got != tt.want {
			t.Fatalf("joinBlobURL(%q, %q) = %q, want %q", tt.prefix, tt.name, got, tt.want)
		}
	}
}
