package etl

import (
	"encoding/json"
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

	res, err := Run(baseConfig(src, outDir))
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

	res, err := Run(baseConfig(src, outDir))
	if err != nil {
		t.Fatal(err)
	}
	if res.WithErrors {
		t.Error("expected no errors")
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
