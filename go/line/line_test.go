package line

import (
	"reflect"
	"testing"
)

func baseOpts() Options {
	return Options{
		Columns:         []string{"BARCODE", "SKU", "NAME"},
		MandatoryFields: []string{"BARCODE", "SKU"},
		Separator:       ",",
		WithHeader:      true,
	}
}

func TestNewParsesAndStripsQuotes(t *testing.T) {
	sl := New(`"123",ABC,"Widget"`, baseOpts(), 2)
	want := map[string]string{"BARCODE": "123", "SKU": "ABC", "NAME": "Widget"}
	if !reflect.DeepEqual(sl.JSONLine, want) {
		t.Errorf("JSONLine = %#v, want %#v", sl.JSONLine, want)
	}
}

func TestMissingTrailingColumnsBecomeEmpty(t *testing.T) {
	sl := New("123,ABC", baseOpts(), 2)
	if sl.JSONLine["NAME"] != "" {
		t.Errorf("missing column should be empty, got %q", sl.JSONLine["NAME"])
	}
}

func TestValidateMandatory(t *testing.T) {
	sl := New(",ABC,Widget", baseOpts(), 5) // BARCODE empty
	sl.Validate()
	if sl.IsValid() {
		t.Fatal("expected invalid line")
	}
	want := `ERROR AT LINE 5: Invalid BARCODE value of ""`
	if sl.Error() != want {
		t.Errorf("Error() = %q, want %q", sl.Error(), want)
	}
}

func TestValidLine(t *testing.T) {
	sl := New("123,ABC,Widget", baseOpts(), 2)
	sl.Validate()
	if !sl.IsValid() {
		t.Errorf("expected valid line, errors: %v", sl.Errors)
	}
}

func TestIsHeader(t *testing.T) {
	if !New("a,b,c", baseOpts(), 1).IsHeader() {
		t.Error("line 1 should be header when WithHeader is set")
	}
	if New("a,b,c", baseOpts(), 2).IsHeader() {
		t.Error("line 2 should not be a header")
	}
	noHeader := baseOpts()
	noHeader.WithHeader = false
	if New("a,b,c", noHeader, 1).IsHeader() {
		t.Error("line 1 should not be header when WithHeader is false")
	}
}

func TestOutputDefaultIsColumnsOrder(t *testing.T) {
	sl := New("123,ABC,Widget", baseOpts(), 2)
	got := sl.Output()
	want := []KV{{"BARCODE", "123"}, {"SKU", "ABC"}, {"NAME", "Widget"}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Output() = %#v, want %#v", got, want)
	}
}

func TestOutputMappingsOrderedWithDefaults(t *testing.T) {
	opts := baseOpts()
	opts.OutputMappings = []Mapping{
		{Out: "sku", Src: "SKU"},     // lookup
		{Out: "name", Src: "NAME"},   // lookup
		{Out: "active", Src: "true"}, // literal default (no such column)
	}
	sl := New("123,ABC,Widget", opts, 2)
	want := []KV{{"sku", "ABC"}, {"name", "Widget"}, {"active", "true"}}
	if got := sl.Output(); !reflect.DeepEqual(got, want) {
		t.Errorf("Output() = %#v, want %#v", got, want)
	}
}

func TestIdentifiers(t *testing.T) {
	opts := baseOpts()
	opts.IdentifierMappings = []Mapping{{Out: "barcode", Src: "BARCODE"}, {Out: "sku", Src: "SKU"}}
	sl := New("123,ABC,Widget", opts, 2)
	want := map[string]string{"barcode": "123", "sku": "ABC"}
	if got := sl.Identifiers(); !reflect.DeepEqual(got, want) {
		t.Errorf("Identifiers() = %#v, want %#v", got, want)
	}
}
