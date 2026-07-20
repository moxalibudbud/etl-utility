package template

import (
	"strings"
	"testing"
)

func TestReplaceWithMap(t *testing.T) {
	data := map[string]string{"name": "john", "id": "123"}
	tests := []struct {
		in, want string
	}{
		{"sample_{name}", "sample_john"},
		{"{name}-{id}", "john-123"},
		{"missing_{nope}", "missing_"}, // unknown key -> empty
		{"no tokens", "no tokens"},
	}
	for _, tc := range tests {
		if got := ReplaceWithMap(tc.in, data); got != tc.want {
			t.Errorf("ReplaceWithMap(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestReplaceWithDataPaths(t *testing.T) {
	data := map[string]any{
		"SKU":  "ABC",
		"name": "Widget",
		"metadata": map[string]any{
			"store":  map[string]any{"code": "DXB01"},
			"active": true,
			"count":  float64(42),
			"empty":  nil,
			"stores": []any{map[string]any{"code": "AUH02"}},
		},
	}
	tests := []struct {
		in   string
		want string
	}{
		{"{SKU}-{name}", "ABC-Widget"},
		{"{data.SKU}", "ABC"},
		{"{metadata.store.code}", "DXB01"},
		{"{data.metadata.store.code}", "DXB01"},
		{"{metadata.stores.0.code}", "AUH02"},
		{"{metadata.count}", "42"},
		{"{metadata.active}", "true"},
		{"missing_{metadata.missing}", "missing_"},
		{"null_{metadata.empty}", "null_"},
		{"container_{metadata.store}", "container_"},
	}
	for _, tt := range tests {
		if got := ReplaceWithData(tt.in, data); got != tt.want {
			t.Errorf("ReplaceWithData(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestReplaceWithFunctionTimestamp(t *testing.T) {
	got := ReplaceWithFunction("file_[timestamp].csv", nil)
	if !strings.HasPrefix(got, "file_") || !strings.HasSuffix(got, ".csv") {
		t.Fatalf("unexpected wrapper: %q", got)
	}
	digits := strings.TrimSuffix(strings.TrimPrefix(got, "file_"), ".csv")
	if len(digits) < 10 {
		t.Errorf("expected an epoch-ms timestamp, got %q", digits)
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			t.Errorf("timestamp not numeric: %q", digits)
			break
		}
	}
}

func TestReplaceWithFunctionUnknownKept(t *testing.T) {
	in := "keep_[doesNotExist arg]"
	if got := ReplaceWithFunction(in, nil); got != in {
		t.Errorf("unsupported function should be kept verbatim: got %q", got)
	}
}

func TestReplaceWithFunctionDataPath(t *testing.T) {
	data := map[string]any{
		"metadata": map[string]string{"region": "ME"},
	}
	got := ReplaceWithFunction("[sanitizeString data.metadata.region]", data)
	if got != "ME" {
		t.Errorf("data path resolution failed: got %q", got)
	}
}

func TestReplaceWithFunctionJSONMetadataPaths(t *testing.T) {
	data := map[string]any{
		"metadata": map[string]any{
			"stores": []any{map[string]any{"code": "DXB 01"}},
			"count":  float64(42),
			"active": true,
			"empty":  nil,
		},
	}
	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "nested array", path: "data.metadata.stores.0.code", want: "DXB01"},
		{name: "number", path: "data.metadata.count", want: "42"},
		{name: "boolean", path: "data.metadata.active", want: "true"},
		{name: "missing", path: "data.metadata.missing", want: "data.metadata.missing"},
		{name: "invalid array index", path: "data.metadata.stores.2.code", want: "data.metadata.stores.2.code"},
		{name: "non-numeric array index", path: "data.metadata.stores.first.code", want: "data.metadata.stores.first.code"},
		{name: "null", path: "data.metadata.empty", want: "data.metadata.empty"},
		{name: "container leaf", path: "data.metadata.stores", want: "data.metadata.stores"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ReplaceWithFunction("[removeWhiteSpaces "+tt.path+"]", data)
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestReplaceWithFunctionDateTime(t *testing.T) {
	got := ReplaceWithFunction("[dateTime YYYYMMDD]", nil)
	if len(got) != 8 {
		t.Fatalf("expected YYYYMMDD (8 chars), got %q", got)
	}
	for _, r := range got {
		if r < '0' || r > '9' {
			t.Errorf("dateTime not numeric: %q", got)
			break
		}
	}
}

func TestSanitizeHelpers(t *testing.T) {
	if got := RemoveWhiteSpaces("a b\tc\n"); got != "abc" {
		t.Errorf("RemoveWhiteSpaces = %q", got)
	}
	if got := ReplaceString("a.b.c", ".", "-"); got != "a-b-c" {
		t.Errorf("ReplaceString = %q", got)
	}
	if got := SanitizeString("a\x00b"); got != "a b" {
		t.Errorf("SanitizeString control char = %q", got)
	}
}
