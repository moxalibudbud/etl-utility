package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeConfig(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestBuildETLConfigReadsCanonicalShapeFromFile(t *testing.T) {
	configPath := writeConfig(t, `{
		"source": "from-config.csv",
		"output": {
			"filename": "out.csv"
		},
		"options": {
			"line": {
				"columns": ["SKU"],
				"mandatoryFields": ["SKU"],
				"separator": ",",
				"withHeader": true
			},
			"rejectOnInvalidRow": true
		}
	}`)

	cfg, err := buildETLConfig(options{configPath: configPath})
	if err != nil {
		t.Fatal(err)
	}

	if cfg.Source != "from-config.csv" {
		t.Fatalf("Source = %q, want from-config.csv", cfg.Source)
	}
	if cfg.Output.Filename != "out.csv" {
		t.Fatalf("Output.Filename = %q, want out.csv", cfg.Output.Filename)
	}
	if got := cfg.Options.Line.Columns; len(got) != 1 || got[0] != "SKU" {
		t.Fatalf("Options.Line.Columns = %#v, want [SKU]", got)
	}
	if !cfg.Options.RejectOnInvalidRow {
		t.Fatal("RejectOnInvalidRow = false, want true")
	}
}

func TestBuildETLConfigReadsCanonicalShapeFromStdin(t *testing.T) {
	cfg, err := buildETLConfig(options{
		configPath: "-",
		configReader: strings.NewReader(`{
			"source": "stdin.csv",
			"output": {"filename": "stdin-out.csv"},
			"options": {"line": {"columns": ["SKU"]}}
		}`),
	})
	if err != nil {
		t.Fatal(err)
	}

	if cfg.Source != "stdin.csv" {
		t.Fatalf("Source = %q, want stdin.csv", cfg.Source)
	}
	if cfg.Output.Filename != "stdin-out.csv" {
		t.Fatalf("Output.Filename = %q, want stdin-out.csv", cfg.Output.Filename)
	}
}

func TestBuildETLConfigSourceFlagOverridesConfigSource(t *testing.T) {
	configPath := writeConfig(t, `{
		"source": "from-config.csv",
		"output": {"filename": "out.csv"},
		"options": {"line": {"columns": ["SKU"]}}
	}`)

	cfg, err := buildETLConfig(options{configPath: configPath, source: "from-flag.csv"})
	if err != nil {
		t.Fatal(err)
	}

	if cfg.Source != "from-flag.csv" {
		t.Fatalf("Source = %q, want from-flag.csv", cfg.Source)
	}
}

func TestBuildETLConfigRejectsRetiredCmdWrapperShape(t *testing.T) {
	configPath := writeConfig(t, `{
		"line": {"columns": ["SKU"]},
		"output": {"filename": "out.csv"}
	}`)

	_, err := buildETLConfig(options{configPath: configPath})
	if err == nil {
		t.Fatal("expected retired wrapper shape to fail")
	}
	if !strings.Contains(err.Error(), `unknown field "line"`) {
		t.Fatalf("error = %q, want unknown line field", err.Error())
	}
}

func TestBuildETLConfigRejectsTypeScriptEnvelope(t *testing.T) {
	configPath := writeConfig(t, `{
		"config": {
			"source": "input.csv",
			"output": {"filename": "out.csv"},
			"options": {"line": {"columns": ["SKU"]}}
		}
	}`)

	_, err := buildETLConfig(options{configPath: configPath})
	if err == nil {
		t.Fatal("expected TypeScript config envelope to fail")
	}
	if !strings.Contains(err.Error(), `unknown field "config"`) {
		t.Fatalf("error = %q, want unknown config field", err.Error())
	}
}
