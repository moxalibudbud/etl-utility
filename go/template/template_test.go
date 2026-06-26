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
