package etl

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"flatfile-go/line"
	"flatfile-go/reader"
	"flatfile-go/writer"
)

func writeFixture(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	src := filepath.Join(dir, "input.csv")
	if err := os.WriteFile(src, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return src
}

func baseConfig(source, outDir string) Config {
	return Config{
		Source: reader.SourceFromString(source),
		Output: writer.OutputConfig{
			DestinationConfig: writer.DestinationConfig{Path: outDir},
			FileGenerator:     "",
			Filename:          "out.csv",
			Separator:         ";",
			Header:            "sku;name",
			Footer:            "EOF",
		},
		Options: Options{
			Line: line.LineConfig{
				Columns:            []string{"BARCODE", "SKU", "NAME"},
				MandatoryFields:    []string{"BARCODE", "SKU"},
				IdentifierMappings: []line.Mapping{{Out: "barcode", Src: "BARCODE"}},
				OutputMappings:     []line.Mapping{{Out: "sku", Src: "SKU"}, {Out: "name", Src: "NAME"}},
				Separator:          ",",
				WithHeader:         true,
			},
		},
	}
}

func TestProcessHappyPathWithOneInvalidRow(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME\n"+ // header (line 1)
			"111,AAA,Widget A\n"+ // valid
			",BBB,Widget B\n"+ // invalid: empty BARCODE (line 3)
			"333,CCC,Widget C\n", // valid
	)

	// errorReport is opt-in (default off); enable it here because this test
	// asserts on the report's contents. See TestProcessErrorReportDisabledByDefault
	// for the off-by-default behavior.
	cfg := baseConfig(src, outDir)
	cfg.Output.Options = map[string]any{writer.OptionErrorReport: true}

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}

	if !res.Valid {
		t.Error("expected Valid=true (invalid rows are skipped by default)")
	}
	if !res.WithErrors || res.TotalErrors != 1 {
		t.Errorf("expected 1 error, got WithErrors=%v TotalErrors=%d", res.WithErrors, res.TotalErrors)
	}

	out, err := os.ReadFile(res.LocalOutputFile)
	if err != nil {
		t.Fatal(err)
	}
	// The footer is written raw with no leading newline (matches TS pushFooter),
	// so it concatenates directly onto the last row.
	wantOut := "sku;name\nAAA;Widget A\nCCC;Widget CEOF"
	if string(out) != wantOut {
		t.Errorf("output mismatch:\n got: %q\nwant: %q", string(out), wantOut)
	}

	errReport, err := os.ReadFile(res.LocalErrorReportFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(errReport), "ERROR AT LINE 3:") {
		t.Errorf("error report missing line 3 error: %q", string(errReport))
	}

	if res.Metadata["barcode"] != "111" || res.Metadata["SKU"] != "AAA" {
		t.Errorf("metadata sample/identifiers wrong: %#v", res.Metadata)
	}
}

// TestProcessErrorReportDisabledByDefault locks in that OptionErrorReport
// defaults to off: no report file is created or named in the result, but
// invalid-row counting (TotalErrors/WithErrors) is unaffected, since
// RejectOnInvalidRow depends on that count regardless of whether the file
// exists.
func TestProcessErrorReportDisabledByDefault(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME\n"+
			"111,AAA,Widget A\n"+
			",BBB,Widget B\n",
	)

	res, err := Run(baseConfig(src, outDir))
	if err != nil {
		t.Fatal(err)
	}

	if !res.WithErrors || res.TotalErrors != 1 {
		t.Errorf("expected counting to work without the report file, got WithErrors=%v TotalErrors=%d", res.WithErrors, res.TotalErrors)
	}
	if res.LocalErrorReportFile != "" || res.LocalErrorReportFilename != "" {
		t.Errorf("expected no report file path when disabled, got file=%q filename=%q", res.LocalErrorReportFile, res.LocalErrorReportFilename)
	}
	entries, err := os.ReadDir(outDir)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if strings.Contains(entry.Name(), "error") {
			t.Errorf("no error-report file should be written when disabled, found %q", entry.Name())
		}
	}
}

func TestProcessEmptyFile(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t, "")

	res, err := Run(baseConfig(src, outDir))
	if err != nil {
		t.Fatal(err)
	}

	if res.Valid {
		t.Error("empty file should be invalid")
	}
	// Output file should not exist (never pushed -> deleted/never created).
	if _, err := os.Stat(filepath.Join(outDir, "out.csv")); !os.IsNotExist(err) {
		t.Error("output file should not exist for empty input")
	}
}

func TestProcessRejectOnInvalidRow(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME\n"+
			"111,AAA,Widget A\n"+
			",BBB,Widget B\n",
	)

	cfg := baseConfig(src, outDir)
	cfg.Options.RejectOnInvalidRow = true

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Valid {
		t.Error("expected Valid=false when RejectOnInvalidRow and an error exists")
	}
	// Output deleted because the result is invalid.
	if _, err := os.Stat(filepath.Join(outDir, "out.csv")); !os.IsNotExist(err) {
		t.Error("output file should be deleted for an invalid result")
	}
}

func TestProcessNoErrorsDeletesErrorReport(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME\n"+
			"111,AAA,Widget A\n",
	)

	// Enabled explicitly: this test verifies the zero-errors delete path,
	// which only applies when the report is being written at all.
	cfg := baseConfig(src, outDir)
	cfg.Output.Options = map[string]any{writer.OptionErrorReport: true}

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.WithErrors {
		t.Error("expected no errors")
	}
	if res.LocalErrorReportFile == "" {
		t.Fatal("expected a report path to be named since the option is enabled")
	}
	if _, err := os.Stat(res.LocalErrorReportFile); !os.IsNotExist(err) {
		t.Error("error report should be deleted when there are zero errors")
	}
}

func TestProcessJSONGeneratorLocalOutput(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME\n"+
			"111,AAA,Widget A\n"+
			",BBB,Widget B\n"+
			"333,AAA,Widget A Duplicate\n",
	)

	cfg := baseConfig(src, outDir)
	cfg.Output.FileGenerator = "json-generator"
	cfg.Output.Filename = "products.json"
	cfg.Output.Header = `{"kind":"products"}`
	cfg.Output.Footer = ""
	cfg.Output.ArrayField = "items"
	cfg.Output.Template = ""

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Valid || !res.WithErrors || res.TotalErrors != 1 {
		t.Fatalf("result = %+v, want valid with one skipped invalid row", res)
	}

	content, err := os.ReadFile(res.LocalOutputFile)
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Kind  string              `json:"kind"`
		Items []map[string]string `json:"items"`
	}
	if err := json.Unmarshal(content, &got); err != nil {
		t.Fatalf("output is not valid JSON: %v\n%s", err, content)
	}
	if got.Kind != "products" || len(got.Items) != 2 {
		t.Fatalf("decoded output = %+v", got)
	}
	if got.Items[0]["sku"] != "AAA" || got.Items[1]["sku"] != "AAA" {
		t.Fatalf("duplicate valid rows should both be emitted: %#v", got.Items)
	}
}

// TestProcessJSONGeneratorStructuredTemplateOutput is the end-to-end
// CSV-to-typed-JSON case: a structuredTemplate resolves against the same
// source rows and mandatory-field validation as the string-template path
// above, but converts QTY to a JSON number and Received to a JSON boolean
// instead of leaving every field as a string.
func TestProcessJSONGeneratorStructuredTemplateOutput(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME,QTY\n"+
			"111,AAA,Widget A,7\n"+
			",BBB,Widget B,3\n"+
			"333,CCC,Widget C,not-a-number\n",
	)

	cfg := baseConfig(src, outDir)
	cfg.Output.FileGenerator = "json-generator"
	cfg.Output.Filename = "products.json"
	cfg.Output.Header = `{"kind":"products"}`
	cfg.Output.Footer = ""
	cfg.Output.ArrayField = "items"
	cfg.Output.Template = ""
	cfg.Output.StructuredTemplate = writer.StructuredTemplate{
		"sku":      {Type: "string", Value: json.RawMessage(`"{SKU}"`)},
		"quantity": {Type: "number", Value: json.RawMessage(`"{QTY}"`)},
		"received": {Type: "boolean", Value: json.RawMessage(`true`)},
	}
	cfg.Options.Line.Columns = []string{"BARCODE", "SKU", "NAME", "QTY"}

	res, err := Run(cfg)
	if err == nil || !strings.Contains(err.Error(), `field "quantity"`) {
		t.Fatalf("Run() error = %v, want a structured-field conversion error naming \"quantity\"", err)
	}
	if _, statErr := os.Stat(filepath.Join(outDir, "products.json")); !os.IsNotExist(statErr) {
		t.Fatalf("a failed row must not leave a final-looking output file, stat err = %v", statErr)
	}
	_ = res
}

// TestProcessJSONGeneratorStructuredTemplateValidRows proves the happy path:
// every row converts cleanly and the output document has typed, not
// stringified, numbers and booleans.
func TestProcessJSONGeneratorStructuredTemplateValidRows(t *testing.T) {
	outDir := t.TempDir()
	src := writeFixture(t,
		"BARCODE,SKU,NAME,QTY\n"+
			"111,AAA,Widget A,7\n"+
			",BBB,Widget B,3\n"+
			"333,CCC,Widget C,5\n",
	)

	cfg := baseConfig(src, outDir)
	cfg.Output.FileGenerator = "json-generator"
	cfg.Output.Filename = "products.json"
	cfg.Output.Header = `{"kind":"products"}`
	cfg.Output.Footer = ""
	cfg.Output.ArrayField = "items"
	cfg.Output.Template = ""
	cfg.Output.StructuredTemplate = writer.StructuredTemplate{
		"sku":      {Type: "string", Value: json.RawMessage(`"{SKU}"`)},
		"quantity": {Type: "number", Value: json.RawMessage(`"{QTY}"`)},
		"received": {Type: "boolean", Value: json.RawMessage(`true`)},
	}
	cfg.Options.Line.Columns = []string{"BARCODE", "SKU", "NAME", "QTY"}

	res, err := Run(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Valid || !res.WithErrors || res.TotalErrors != 1 {
		t.Fatalf("result = %+v, want valid with one skipped invalid (missing BARCODE) row", res)
	}

	content, err := os.ReadFile(res.LocalOutputFile)
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Kind  string           `json:"kind"`
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(content, &got); err != nil {
		t.Fatalf("output is not valid JSON: %v\n%s", err, content)
	}
	if got.Kind != "products" || len(got.Items) != 2 {
		t.Fatalf("decoded output = %+v", got)
	}
	if got.Items[0]["quantity"] != float64(7) || got.Items[0]["received"] != true {
		t.Fatalf("quantity/received must be typed JSON values, not strings: %#v", got.Items[0])
	}
}

// fakeWriter is a minimal writer.Writer double that lets cleanUp tests inject
// failures at End/Delete without touching the filesystem.
type fakeWriter struct {
	endErr, deleteErr       error
	endCalled, deleteCalled bool
}

func (f *fakeWriter) Push(*line.SourceLine) error { return nil }
func (f *fakeWriter) PushFooter() error           { return nil }
func (f *fakeWriter) End() error                  { f.endCalled = true; return f.endErr }
func (f *fakeWriter) Delete() error               { f.deleteCalled = true; return f.deleteErr }
func (f *fakeWriter) Filepath() string            { return "fake-output" }
func (f *fakeWriter) Filename() string            { return "fake-output" }
func (f *fakeWriter) Path() string                { return "" }

// fakeReader is a minimal reader.Reader double with no lines, used only to
// inject a Close failure.
type fakeReader struct {
	closeErr    error
	closeCalled bool
}

func (r *fakeReader) Open() error      { return nil }
func (r *fakeReader) Scan() bool       { return false }
func (r *fakeReader) Text() string     { return "" }
func (r *fakeReader) Err() error       { return nil }
func (r *fakeReader) Close() error     { r.closeCalled = true; return r.closeErr }
func (r *fakeReader) Filename() string { return "fake-source" }
func (r *fakeReader) Filepath() string { return "fake-source" }

// TestCleanUpAccumulatesAllFailures is a regression test for cleanUp's old
// short-circuiting behavior: returning on the first failing step used to
// skip the deletes entirely, so a failed End() left its artifact behind with
// no later pass to catch it (the pipeline targets serverless workers, where
// the process is frozen or destroyed right after Process returns). Every
// step must now run regardless of earlier failures, and every failure must
// be reachable from the returned error.
func TestCleanUpAccumulatesAllFailures(t *testing.T) {
	fw := &fakeWriter{endErr: errors.New("end failed"), deleteErr: errors.New("delete failed")}
	fr := &fakeReader{closeErr: errors.New("reader close failed")}
	er := writer.NewErrorReport("src", t.TempDir(), false)

	e := &ETL{reader: fr, output: fw, errorReport: er, valid: false}

	err := e.cleanUp(true) // force path, mirrors the failure branch in Process
	if err == nil {
		t.Fatal("expected a joined error")
	}
	if !fw.endCalled || !fw.deleteCalled || !fr.closeCalled {
		t.Fatalf("expected every cleanup step to run despite earlier failures: end=%v delete=%v readerClose=%v",
			fw.endCalled, fw.deleteCalled, fr.closeCalled)
	}
	if !errors.Is(err, fw.endErr) || !errors.Is(err, fw.deleteErr) || !errors.Is(err, fr.closeErr) {
		t.Fatalf("expected the joined error to reach all three causes, got %v", err)
	}
}

// TestCleanUpDeletesOutputWhenEndFailsEvenIfValid proves the new endErr != nil
// condition on the output.Delete() guard: previously only force or an invalid
// result triggered a delete, so a valid, non-forced run whose End() failed to
// finalize cleanly would leave the (incompletely written) output file in
// place, since the old code required !e.valid to delete it and there was no
// other route to a delete on this path.
func TestCleanUpDeletesOutputWhenEndFailsEvenIfValid(t *testing.T) {
	fw := &fakeWriter{endErr: errors.New("end failed")}
	fr := &fakeReader{}
	er := writer.NewErrorReport("src", t.TempDir(), false)

	e := &ETL{reader: fr, output: fw, errorReport: er, valid: true}

	_ = e.cleanUp(false) // not forced, and the result is otherwise valid
	if !fw.deleteCalled {
		t.Fatal("expected output.Delete() to run because End() failed, even though force=false and valid=true")
	}
}
