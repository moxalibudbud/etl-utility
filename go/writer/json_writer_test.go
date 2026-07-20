package writer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"flatfile-go/line"
)

func jsonTestLine(raw string, lineNumber int) *line.SourceLine {
	return line.New(raw, line.LineConfig{
		Columns:        []string{"LOC", "SKU", "QTY", "NAME"},
		OutputMappings: []line.Mapping{{Out: "sku", Src: "SKU"}, {Out: "name", Src: "NAME"}},
		Separator:      ";",
	}, lineNumber)
}

func TestJSONWriterStreamsAndPromotesLocalFile(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "products_{metadata.store.code}.json",
		Header:            `{"store":"{LOC}","region":"{metadata.region}"}`,
		ArrayField:        "items",
		Template:          `{"sku":"{SKU}","name":"{NAME}","qty":{QTY},"store":"{data.metadata.store.code}"}`,
		Metadata: map[string]any{
			"region": "Middle East",
			"store":  map[string]any{"code": "DXB01"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	first := jsonTestLine(`1005;A"1;2;Widget \ Deluxe`, 2)
	if err := w.Push(first); err != nil {
		t.Fatalf("first push: %v", err)
	}
	if w.Filename() != "products_DXB01.json" {
		t.Fatalf("Filename = %q, want products_DXB01.json", w.Filename())
	}
	if _, err := os.Stat(filepath.Join(dir, "products_DXB01.json.partial")); err != nil {
		t.Fatalf("partial should exist before End: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "products_DXB01.json")); !os.IsNotExist(err) {
		t.Fatalf("final file should not exist before End, stat err = %v", err)
	}

	if err := w.Push(first); err != nil {
		t.Fatalf("duplicate push: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "products_DXB01.json.partial")); !os.IsNotExist(err) {
		t.Fatalf("partial should be gone after End, stat err = %v", err)
	}

	content, err := os.ReadFile(w.Filepath())
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Store  string           `json:"store"`
		Region string           `json:"region"`
		Items  []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(content, &got); err != nil {
		t.Fatalf("output is not valid JSON: %v\n%s", err, content)
	}
	if got.Store != "1005" || got.Region != "Middle East" {
		t.Fatalf("root = %+v, want rendered store and region", got)
	}
	if len(got.Items) != 2 {
		t.Fatalf("items length = %d, want duplicate rows preserved", len(got.Items))
	}
	if got.Items[0]["sku"] != `A"1` || got.Items[0]["name"] != `Widget \ Deluxe` || got.Items[0]["qty"] != float64(2) || got.Items[0]["store"] != "DXB01" {
		t.Fatalf("first item = %#v", got.Items[0])
	}
}

func TestJSONWriterNoRowsCreatesNoFile(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "empty.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatal(err)
	}
	if w.Filepath() != "" {
		t.Fatalf("Filepath = %q, want empty before first row", w.Filepath())
	}
	if _, err := os.Stat(filepath.Join(dir, "empty.json")); !os.IsNotExist(err) {
		t.Fatalf("empty output should not exist, stat err = %v", err)
	}
}

func TestJSONWriterDefaultRowsUseOutputMappings(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "mapped.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(w.Filepath())
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Lines []map[string]string `json:"lines"`
	}
	if err := json.Unmarshal(content, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Lines) != 1 || got.Lines[0]["sku"] != "SKU-1" || got.Lines[0]["name"] != "Widget" {
		t.Fatalf("mapped rows = %#v", got.Lines)
	}
	if _, exists := got.Lines[0]["LOC"]; exists {
		t.Fatalf("raw source column leaked into mapped row: %#v", got.Lines[0])
	}
}

func TestJSONWriterRejectsInvalidTemplatesAndRemovesPartial(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "bad.json",
		Template:          `{"sku":"{SKU}",}`,
	})
	if err != nil {
		t.Fatal(err)
	}
	err = w.Push(jsonTestLine("1005;SKU-1;2;Widget", 7))
	if err == nil || !strings.Contains(err.Error(), "source line 7") {
		t.Fatalf("Push() error = %v, want source line context", err)
	}
	if _, statErr := os.Stat(filepath.Join(dir, "bad.json.partial")); !os.IsNotExist(statErr) {
		t.Fatalf("partial should be removed after row error, stat err = %v", statErr)
	}
}

func TestJSONWriterRejectsRootArrayFieldCollision(t *testing.T) {
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: t.TempDir()},
		FileGenerator:     "json-generator",
		Filename:          "bad-root.json",
		Header:            `{"lines":[]}`,
	})
	if err != nil {
		t.Fatal(err)
	}
	err = w.Push(jsonTestLine("1005;SKU-1;2;Widget", 3))
	if err == nil || !strings.Contains(err.Error(), `arrayField "lines"`) {
		t.Fatalf("Push() error = %v, want arrayField collision", err)
	}
}

func TestJSONWriterEndIsIdempotent(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "idempotent.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("first End: %v", err)
	}
	first, err := os.ReadFile(w.Filepath())
	if err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("second End() should be a no-op, got: %v", err)
	}
	second, err := os.ReadFile(w.Filepath())
	if err != nil {
		t.Fatal(err)
	}
	if string(first) != string(second) {
		t.Fatalf("second End() modified output:\nfirst:  %s\nsecond: %s", first, second)
	}
}

func TestJSONWriterReplacesExistingOutput(t *testing.T) {
	dir := t.TempDir()
	final := filepath.Join(dir, "replace.json")
	if err := os.WriteFile(final, []byte(`{"stale":true}`), 0o644); err != nil {
		t.Fatal(err)
	}
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "replace.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatal(err)
	}

	content, err := os.ReadFile(final)
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Stale bool             `json:"stale"`
		Lines []map[string]any `json:"lines"`
	}
	if err := json.Unmarshal(content, &got); err != nil {
		t.Fatalf("output is not valid JSON: %v\n%s", err, content)
	}
	if got.Stale {
		t.Fatalf("stale content survived replacement: %s", content)
	}
	if len(got.Lines) != 1 {
		t.Fatalf("lines = %#v, want exactly the new row and nothing appended", got.Lines)
	}
}

func TestJSONWriterCleanupOnFlushFailure(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "flush-fail.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}

	// Simulate an I/O failure beneath the buffered writer: close the
	// underlying file out from under the sink so the pending Flush/Sync
	// in End() fails, exercising the "local write or flush" cleanup row
	// from the design doc's failure table.
	sink, ok := w.sink.(*LocalSink)
	if !ok {
		t.Fatalf("sink = %T, want *LocalSink", w.sink)
	}
	if err := sink.file.Close(); err != nil {
		t.Fatal(err)
	}

	if err := w.End(); err == nil {
		t.Fatal("End() should surface the underlying flush/sync failure")
	}
	if w.finalized {
		t.Fatal("writer should not be marked finalized after a failed End()")
	}
	if _, statErr := os.Stat(filepath.Join(dir, "flush-fail.json.partial")); !os.IsNotExist(statErr) {
		t.Fatalf("partial should be removed after End() failure, stat err = %v", statErr)
	}
	if _, statErr := os.Stat(filepath.Join(dir, "flush-fail.json")); !os.IsNotExist(statErr) {
		t.Fatalf("final output should not exist after End() failure, stat err = %v", statErr)
	}
}

func TestJSONWriterCleanupOnRenameFailure(t *testing.T) {
	dir := t.TempDir()
	final := filepath.Join(dir, "rename-fail.json")
	// Pre-create a non-empty directory at the destination path so the
	// rename from the .partial file can never succeed, exercising the
	// "finalization" cleanup row from the design doc's failure table.
	if err := os.Mkdir(final, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(final, "keep.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "rename-fail.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err == nil {
		t.Fatal("End() should surface the rename failure")
	}
	if _, statErr := os.Stat(filepath.Join(dir, "rename-fail.json.partial")); !os.IsNotExist(statErr) {
		t.Fatalf("partial should be removed after rename failure, stat err = %v", statErr)
	}
	if _, statErr := os.Stat(filepath.Join(final, "keep.txt")); statErr != nil {
		t.Fatalf("pre-existing destination should be untouched by a failed rename: %v", statErr)
	}
}

func TestJSONWriterDeleteIsIdempotentAndRemovesOutput(t *testing.T) {
	dir := t.TempDir()
	w, err := NewJSONWriter(OutputConfig{
		DestinationConfig: DestinationConfig{Path: dir},
		FileGenerator:     "json-generator",
		Filename:          "delete.json",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := w.Push(jsonTestLine("1005;SKU-1;2;Widget", 1)); err != nil {
		t.Fatal(err)
	}
	if err := w.End(); err != nil {
		t.Fatal(err)
	}
	if err := w.Delete(); err != nil {
		t.Fatal(err)
	}
	if err := w.Delete(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "delete.json")); !os.IsNotExist(err) {
		t.Fatalf("final output should be removed, stat err = %v", err)
	}
}
