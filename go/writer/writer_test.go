package writer

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"

	"flatfile-go/line"
)

func TestOutputConfigUnmarshalFilenameShapes(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "flat string",
			in:   `{"filename": "out.csv"}`,
			want: "out.csv",
		},
		{
			name: "TS object form",
			in:   `{"filename": {"template": "x_{ITEM}.csv"}}`,
			want: "x_{ITEM}.csv",
		},
		{
			name: "legacy filenameTemplate key",
			in:   `{"filenameTemplate": "y_{ITEM}.csv"}`,
			want: "y_{ITEM}.csv",
		},
		{
			name: "legacy key keeps precedence when both set",
			in:   `{"filename": "static.csv", "filenameTemplate": "z_{ITEM}.csv"}`,
			want: "z_{ITEM}.csv",
		},
		{
			name: "absent filename",
			in:   `{"path": "/var/tmp"}`,
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var cfg OutputConfig
			if err := json.Unmarshal([]byte(tt.in), &cfg); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if cfg.Filename != tt.want {
				t.Fatalf("Filename = %q, want %q", cfg.Filename, tt.want)
			}
		})
	}
}

func TestOutputConfigUnmarshalRejectsBadFilename(t *testing.T) {
	var cfg OutputConfig
	if err := json.Unmarshal([]byte(`{"filename": 42}`), &cfg); err == nil {
		t.Fatal("expected error for non-string, non-object filename")
	}
}

func TestOutputConfigUnmarshalOtherFieldsUntouched(t *testing.T) {
	in := `{"fileGenerator": "default-generator", "separator": ";", "metadata": {"region": "MEA"}}`
	var cfg OutputConfig
	if err := json.Unmarshal([]byte(in), &cfg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if cfg.Type != "default-generator" || cfg.Separator != ";" || cfg.Metadata["region"] != "MEA" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestOutputConfigUnmarshalArbitraryJSONMetadata(t *testing.T) {
	in := `{"metadata":{"store":{"code":"DXB"},"regions":["MEA",2],"active":true,"empty":null}}`
	var cfg OutputConfig
	if err := json.Unmarshal([]byte(in), &cfg); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	store, ok := cfg.Metadata["store"].(map[string]any)
	if !ok || store["code"] != "DXB" {
		t.Fatalf("nested metadata = %#v", cfg.Metadata["store"])
	}
	regions, ok := cfg.Metadata["regions"].([]any)
	if !ok || len(regions) != 2 || regions[0] != "MEA" || regions[1] != float64(2) {
		t.Fatalf("array metadata = %#v", cfg.Metadata["regions"])
	}
	if cfg.Metadata["active"] != true {
		t.Fatalf("boolean metadata = %#v", cfg.Metadata["active"])
	}
	if value, exists := cfg.Metadata["empty"]; !exists || value != nil {
		t.Fatalf("null metadata = %#v, exists = %v", value, exists)
	}
}

// pushOne parses a single raw line and pushes it through a fresh DefaultWriter.
func pushOne(t *testing.T, opts OutputConfig, raw string, lineCfg line.LineConfig) *DefaultWriter {
	t.Helper()
	w := NewDefaultWriter(opts)
	sl := line.New(raw, lineCfg, 1)
	if err := w.Push(sl); err != nil {
		t.Fatalf("push: %v", err)
	}
	if err := w.End(); err != nil {
		t.Fatalf("end: %v", err)
	}
	t.Cleanup(func() { _ = w.Delete() })
	return w
}

func TestSetFilenameStaticPassthrough(t *testing.T) {
	w := pushOne(t,
		OutputConfig{Path: t.TempDir(), Filename: "item_master.csv"},
		"1005;ABC",
		line.LineConfig{Columns: []string{"LOC", "ITEM"}},
	)
	if got := w.Filename(); got != "item_master.csv" {
		t.Fatalf("Filename = %q, want static passthrough", got)
	}
}

func TestSetFilenameRendersLineDataAndFunctions(t *testing.T) {
	w := pushOne(t,
		OutputConfig{Path: t.TempDir(), Filename: "out_{LOC}_[timestamp].csv"},
		"1005;ABC",
		line.LineConfig{Columns: []string{"LOC", "ITEM"}},
	)
	if got := w.Filename(); !regexp.MustCompile(`^out_1005_\d+\.csv$`).MatchString(got) {
		t.Fatalf("Filename = %q, want out_1005_<timestamp>.csv", got)
	}
}

func TestMetadataAvailableToFilenameHeaderAndRowTemplates(t *testing.T) {
	dir := t.TempDir()
	w := pushOne(t,
		OutputConfig{
			Path:     dir,
			Filename: "[removeWhiteSpaces data.metadata.stores.0.code].txt",
			Header:   "[sanitizeString data.metadata.count]",
			Template: "[sanitizeString data.metadata.active]",
			Metadata: map[string]any{
				"stores": []any{map[string]any{"code": "DXB 01"}},
				"count":  42,
				"active": true,
			},
		},
		"1005;ABC",
		line.LineConfig{Columns: []string{"LOC", "ITEM"}},
	)
	if w.Filename() != "DXB01.txt" {
		t.Fatalf("Filename = %q, want DXB01.txt", w.Filename())
	}
	content, err := os.ReadFile(w.Filepath())
	if err != nil {
		t.Fatalf("read output: %v", err)
	}
	if got, want := string(content), "42\ntrue"; got != want {
		t.Fatalf("output = %q, want %q", got, want)
	}
}
