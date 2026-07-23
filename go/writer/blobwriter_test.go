package writer

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"

	"flatfile-go/azureauth"
	"flatfile-go/line"
)

var _ Writer = (*AzureBlobWriter)(nil)

const testContainerURL = "https://acct.blob.core.windows.net/exports/daily"

// fakeBlob captures upload/delete calls so tests never contact Azure.
// startedURL/starts record the call itself; uploadedURL/uploadedData/
// completions record only once the fake has read body to EOF (i.e. after
// End closes the pipe) — this distinguishes "upload started" from "upload
// finished" the same way the real streaming client does.
type fakeBlob struct {
	mu           sync.Mutex
	startedURL   string
	starts       int
	uploadedURL  string
	uploadedData []byte
	completions  int
	deletedURL   string
	deletes      int
}

func newBlobWriterForTest(t *testing.T, opts OutputConfig) (*AzureBlobWriter, *fakeBlob) {
	t.Helper()
	opts.DestinationConfig = DestinationConfig{Type: DestinationAzureBlob, URL: testContainerURL}
	w := NewAzureBlobWriter(opts)
	fake := &fakeBlob{}
	w.sink.startUpload = func(_ context.Context, destURL string, body io.Reader) error {
		fake.mu.Lock()
		fake.startedURL = destURL
		fake.starts++
		fake.mu.Unlock()

		data, err := io.ReadAll(body)
		if err != nil {
			return err
		}

		fake.mu.Lock()
		fake.uploadedURL = destURL
		fake.uploadedData = data
		fake.completions++
		fake.mu.Unlock()
		return nil
	}
	w.sink.deleteBlob = func(_ context.Context, destURL string) error {
		fake.mu.Lock()
		fake.deletedURL = destURL
		fake.deletes++
		fake.mu.Unlock()
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
	if fake.starts != 1 {
		t.Fatalf("starts = %d, want 1 (upload begins on first Push)", fake.starts)
	}
	if fake.completions != 0 {
		t.Fatalf("upload completed before End: %d", fake.completions)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}

	if fake.completions != 1 {
		t.Fatalf("completions = %d, want 1", fake.completions)
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
	if fake.starts != 0 {
		t.Fatalf("starts = %d, want 0 for empty input", fake.starts)
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

// TestBlobWriterUploadFailureSurfacesThroughPush proves a background upload
// failure is not silently swallowed: since Push writes block until the
// upload goroutine reads a match, a goroutine that gives up unblocks the
// blocked write with the real error via CloseWithError, not a generic
// closed-pipe error.
func TestBlobWriterUploadFailureSurfacesThroughPush(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
	wantErr := errors.New("network reset")
	w.sink.startUpload = func(context.Context, string, io.Reader) error { return wantErr }

	sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)
	if err := w.Push(sl); !errors.Is(err, wantErr) {
		t.Fatalf("Push() error = %v, want %v", err, wantErr)
	}

	// End still runs first in the real ETL cleanup path (etl.cleanUp always
	// calls output.End() before output.Delete()); it must surface the same
	// upload error rather than block or double-report it.
	if err := w.End(); !errors.Is(err, wantErr) {
		t.Fatalf("End() error = %v, want %v", err, wantErr)
	}
	if err := w.Delete(); err != nil {
		t.Fatalf("delete after failed upload: %v", err)
	}
	if fake.deletes != 0 {
		t.Fatalf("deletes = %d, want 0 (nothing was ever committed)", fake.deletes)
	}
}

// TestBlobWriterDeleteAbortsUnfinishedUpload proves Delete does not deadlock
// or leave the background goroutine running when called before End (e.g. a
// caller that skips End entirely) — it must cancel the in-flight upload and
// wait for the goroutine to actually exit.
func TestBlobWriterDeleteAbortsUnfinishedUpload(t *testing.T) {
	w, fake := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
	started := make(chan struct{})
	w.sink.startUpload = func(_ context.Context, _ string, body io.Reader) error {
		close(started)
		_, err := io.ReadAll(body) // blocks until Delete aborts the pipe
		return err
	}

	sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)
	if err := w.Push(sl); err != nil {
		t.Fatalf("push: %v", err)
	}
	<-started

	if err := w.Delete(); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if fake.completions != 0 {
		t.Fatalf("completions = %d, want 0 (upload was aborted, not finished)", fake.completions)
	}
	if fake.deletes != 0 {
		t.Fatalf("deletes = %d, want 0 (nothing was ever committed)", fake.deletes)
	}
}

func TestBlobWriterPathStaysLocalForErrorReport(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv"})
	if w.Path() == "" || w.Path() == testContainerURL {
		t.Fatalf("Path = %q, want a local staging directory", w.Path())
	}
}

// TestBlobWriterCloseFailureClassifiedByAzureCause proves an upload failure
// is classified from Azure's response rather than given a blanket kind: per
// the design doc's chosen atomicity model, the blob does not exist until Put
// Block List commits, so an error at this point never leaves anything
// behind — the only open question is whether the cause (throttling vs. a
// rejected request) makes a retry worthwhile.
//
// The fake startUpload never reads body, so — exactly as in
// TestBlobWriterUploadFailureSurfacesThroughPush — the blocked pipe write
// inside Push is where the error actually surfaces, not End.
func TestBlobWriterCloseFailureClassifiedByAzureCause(t *testing.T) {
	tests := []struct {
		name   string
		status int
		want   ErrorKind
	}{
		{"throttled is transient", 503, KindTransient},
		{"rejected is permanent", 403, KindPermanent},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
			w.sink.startUpload = func(context.Context, string, io.Reader) error {
				return &azcore.ResponseError{StatusCode: tt.status}
			}
			sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)

			pushErr := w.Push(sl)
			if pushErr == nil {
				t.Fatal("expected the upload failure to surface through Push")
			}
			if got := KindOf(pushErr); got != tt.want {
				t.Fatalf("KindOf(Push() error) = %v, want %v", got, tt.want)
			}

			// End must report the same already-resolved failure, not block.
			if endErr := w.End(); endErr == nil || KindOf(endErr) != tt.want {
				t.Fatalf("KindOf(End() error) = %v, want %v", KindOf(endErr), tt.want)
			}
		})
	}
}

// TestBlobWriterDeleteFailureIsUnresolved proves that failing to remove an
// already-committed blob is reported Unresolved rather than classified by
// cause: the blob is confirmed to exist regardless of why the delete call
// itself failed, so a worker handler must reconcile it rather than treat the
// run as cleanly retryable.
func TestBlobWriterDeleteFailureIsUnresolved(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
	pushLine(t, w, "1005;ABC")
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	calls := 0
	w.sink.deleteBlob = func(context.Context, string) error {
		calls++
		return errors.New("delete rejected")
	}

	err := w.Delete()
	if err == nil {
		t.Fatal("expected the delete failure to surface")
	}
	if got := KindOf(err); got != KindUnresolved {
		t.Fatalf("KindOf(Delete() error) = %v, want KindUnresolved", got)
	}
	if calls != 1 {
		t.Fatalf("deleteBlob calls = %d, want 1 (the attempt was made)", calls)
	}
}

// TestBlobWriterDeleteRetriesUploadedStateAfterFailure is a regression test:
// the sink used to mark the blob as no-longer-uploaded before attempting the
// delete, so a failed delete would silently make a second Delete() call a
// no-op — the caller would see success on retry despite the blob still
// existing. The blob must stay "uploaded" until removal actually succeeds so
// a retry really retries.
func TestBlobWriterDeleteRetriesUploadedStateAfterFailure(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})
	pushLine(t, w, "1005;ABC")
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}

	calls := 0
	fail := true
	w.sink.deleteBlob = func(context.Context, string) error {
		calls++
		if fail {
			return errors.New("transient delete failure")
		}
		return nil
	}

	if err := w.Delete(); err == nil {
		t.Fatal("expected the first delete to fail")
	}
	fail = false
	if err := w.Delete(); err != nil {
		t.Fatalf("expected the retried delete to succeed, got %v", err)
	}
	if calls != 2 {
		t.Fatalf("deleteBlob calls = %d, want 2 (the retry must call deleteBlob again, not no-op)", calls)
	}
}

// TestBlobWriterStalledUploadIsTransient is the end-to-end proof that the
// Phase 3 time-limit plumbing works. It simulates a stalled network call by
// blocking startUpload on ctx.Done() without reading from the pipe — which also
// blocks the Push pipe-write. When the work deadline fires, the goroutine
// unblocks, closes the read side of the pipe with the context error, and Push
// returns. Both Push and End must surface KindTransient, not KindPermanent:
// this is what lets the caller retry rather than dead-letter a job that simply
// hit a slow network.
func TestBlobWriterStalledUploadIsTransient(t *testing.T) {
	w, _ := newBlobWriterForTest(t, OutputConfig{Filename: "out.csv", Template: "{ITEM}"})

	// Block without reading from body — simulates a hung SDK call.
	w.sink.startUpload = func(ctx context.Context, _ string, _ io.Reader) error {
		<-ctx.Done()
		return ctx.Err()
	}

	// Short work deadline; cleanup gets its own independent deadline (not a
	// child of work) so it still runs after work times out — mirroring
	// Budget.Deadlines exactly.
	work, cancelWork := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancelWork()
	cleanup, cancelCleanup := context.WithTimeout(context.WithoutCancel(context.Background()), 5*time.Second)
	defer cancelCleanup()
	w.SetDeadlineContexts(work, cleanup)

	sl := line.New("1005;ABC", line.LineConfig{Columns: []string{"LOC", "ITEM"}}, 1)

	// Push blocks on the pipe write until the work deadline fires (~80ms).
	pushErr := w.Push(sl)
	if pushErr == nil {
		t.Fatal("expected Push to fail when the work deadline fires")
	}
	if got := KindOf(pushErr); got != KindTransient {
		t.Fatalf("KindOf(Push error) = %v (%v), want KindTransient", got, pushErr)
	}

	// End must surface the same resolved failure, not block or panic.
	endErr := w.End()
	if endErr == nil {
		t.Fatal("expected End to report the upload failure")
	}
	if got := KindOf(endErr); got != KindTransient {
		t.Fatalf("KindOf(End error) = %v (%v), want KindTransient", got, endErr)
	}

	// Nothing was committed, so Delete must succeed without contacting Azure.
	if err := w.Delete(); err != nil {
		t.Fatalf("Delete after stalled upload: %v", err)
	}
}

// newJSONBlobWriterForTest builds a JSONWriter backed by an AzureBlobSink with
// stubbed Azure calls, mirroring newBlobWriterForTest for the json-generator path.
func newJSONBlobWriterForTest(t *testing.T, opts OutputConfig) (*JSONWriter, *fakeBlob) {
	t.Helper()
	opts.DestinationConfig = DestinationConfig{Type: DestinationAzureBlob, URL: testContainerURL}
	if opts.Path == "" {
		opts.Path = os.TempDir()
	}
	sink := NewAzureBlobSink(opts.URL, azureauth.AzureAuth{})
	jw, err := newJSONWriterWithSink(opts, sink)
	if err != nil {
		t.Fatalf("newJSONWriterWithSink: %v", err)
	}
	fake := &fakeBlob{}
	sink.startUpload = func(_ context.Context, destURL string, body io.Reader) error {
		fake.mu.Lock()
		fake.startedURL = destURL
		fake.starts++
		fake.mu.Unlock()
		data, err := io.ReadAll(body)
		if err != nil {
			return err
		}
		fake.mu.Lock()
		fake.uploadedURL = destURL
		fake.uploadedData = data
		fake.completions++
		fake.mu.Unlock()
		return nil
	}
	sink.deleteBlob = func(_ context.Context, destURL string) error {
		fake.mu.Lock()
		fake.deletedURL = destURL
		fake.deletes++
		fake.mu.Unlock()
		return nil
	}
	return jw, fake
}

// TestJSONBlobWriterNothingVisibleUntilEnd is the cloud atomicity proof for
// json-generator: block blob commits make the file visible only once
// UploadStream's final Put Block List succeeds. Before that moment the blob
// simply does not exist — a partial upload is invisible to any reader. The
// fake distinguishes "upload started" (starts==1) from "upload committed"
// (completions==1), mirroring how the real block blob SDK works.
func TestJSONBlobWriterNothingVisibleUntilEnd(t *testing.T) {
	w, fake := newJSONBlobWriterForTest(t, OutputConfig{
		FileGenerator: "json-generator",
		Filename:      "products.json",
		ArrayField:    "items",
		Template:      `{"sku":"{SKU}"}`,
	})
	sl := jsonTestLine("1005;A1;10;Widget", 1)
	if err := w.Push(sl); err != nil {
		t.Fatalf("push: %v", err)
	}
	fake.mu.Lock()
	starts, completions := fake.starts, fake.completions
	fake.mu.Unlock()
	if starts != 1 {
		t.Fatalf("starts = %d, want 1 (upload begins on first Push)", starts)
	}
	if completions != 0 {
		t.Fatalf("completions = %d before End: blob must not be visible mid-upload", completions)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if fake.completions != 1 {
		t.Fatalf("completions = %d after End, want 1", fake.completions)
	}
}

// TestJSONBlobWriterSuccessfulCompletion proves the json-generator + azure-blob
// path uploads a valid JSON document with the expected URL and structure.
func TestJSONBlobWriterSuccessfulCompletion(t *testing.T) {
	w, fake := newJSONBlobWriterForTest(t, OutputConfig{
		FileGenerator: "json-generator",
		Filename:      "products.json",
		ArrayField:    "items",
		Template:      `{"sku":"{SKU}","name":"{NAME}"}`,
	})
	if err := w.Push(jsonTestLine("1005;A1;10;Widget", 1)); err != nil {
		t.Fatalf("push 1: %v", err)
	}
	if err := w.Push(jsonTestLine("1006;B2;5;Gadget", 2)); err != nil {
		t.Fatalf("push 2: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if want := testContainerURL + "/products.json"; fake.uploadedURL != want {
		t.Fatalf("uploaded URL = %q, want %q", fake.uploadedURL, want)
	}
	var doc struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(fake.uploadedData, &doc); err != nil {
		t.Fatalf("uploaded data is not valid JSON: %v\n%s", err, fake.uploadedData)
	}
	if len(doc.Items) != 2 {
		t.Fatalf("items = %d, want 2", len(doc.Items))
	}
}

// TestJSONBlobWriterStructuredTemplateSuccessfulCompletion proves the
// structuredTemplate renderer is destination-independent: the same compiled
// template used by the local writer produces a valid, typed JSON document
// through the Azure Blob sink.
func TestJSONBlobWriterStructuredTemplateSuccessfulCompletion(t *testing.T) {
	w, fake := newJSONBlobWriterForTest(t, OutputConfig{
		FileGenerator: "json-generator",
		Filename:      "products.json",
		ArrayField:    "items",
		StructuredTemplate: StructuredTemplate{
			"SKU":      {Type: "string", Value: json.RawMessage(`"{SKU}"`)},
			"Quantity": {Type: "number", Value: json.RawMessage(`"{QTY}"`)},
			"Received": {Type: "boolean", Value: json.RawMessage(`true`)},
		},
	})
	if err := w.Push(jsonTestLine("1005;A1;10;Widget", 1)); err != nil {
		t.Fatalf("push: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if want := testContainerURL + "/products.json"; fake.uploadedURL != want {
		t.Fatalf("uploaded URL = %q, want %q", fake.uploadedURL, want)
	}
	var doc struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(fake.uploadedData, &doc); err != nil {
		t.Fatalf("uploaded data is not valid JSON: %v\n%s", err, fake.uploadedData)
	}
	if len(doc.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(doc.Items))
	}
	item := doc.Items[0]
	if item["SKU"] != "A1" || item["Quantity"] != float64(10) || item["Received"] != true {
		t.Fatalf("item = %#v", item)
	}
}

// TestJSONBlobWriterDeleteAbortsUnfinishedUpload proves Delete before End
// aborts the in-flight upload without deadlocking or leaving the goroutine
// running. Nothing is committed, so no blob-level delete is issued.
func TestJSONBlobWriterDeleteAbortsUnfinishedUpload(t *testing.T) {
	w, fake := newJSONBlobWriterForTest(t, OutputConfig{
		FileGenerator: "json-generator",
		Filename:      "out.json",
		Template:      `{"sku":"{SKU}"}`,
	})
	started := make(chan struct{})
	w.sink.(*AzureBlobSink).startUpload = func(_ context.Context, _ string, body io.Reader) error {
		close(started)
		_, err := io.ReadAll(body)
		return err
	}
	if err := w.Push(jsonTestLine("1005;A1;10;Widget", 1)); err != nil {
		t.Fatalf("push: %v", err)
	}
	<-started
	if err := w.Delete(); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if fake.completions != 0 {
		t.Fatalf("completions = %d, want 0 (upload aborted)", fake.completions)
	}
	if fake.deletes != 0 {
		t.Fatalf("deletes = %d, want 0 (nothing committed)", fake.deletes)
	}
}

// TestJSONBlobWriterFactoryRegistration confirms that Factory with
// json-generator + azure-blob produces a DeadlineAware Writer, completing the
// Phase 3 registration that lets RunContext inject the job's time budget.
func TestJSONBlobWriterFactoryRegistration(t *testing.T) {
	opts := OutputConfig{
		DestinationConfig: DestinationConfig{Type: DestinationAzureBlob, URL: testContainerURL},
		FileGenerator:     "json-generator",
		Filename:          "out.json",
		Template:          `{"sku":"{SKU}"}`,
	}
	w, err := Factory(opts)
	if err != nil {
		t.Fatalf("Factory: %v", err)
	}
	if _, ok := w.(DeadlineAware); !ok {
		t.Fatal("json-generator + azure-blob writer must implement DeadlineAware")
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
