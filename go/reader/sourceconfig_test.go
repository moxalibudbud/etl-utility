package reader

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSourceFromString(t *testing.T) {
	local := SourceFromString("/var/tmp/products.csv")
	if local.Type != SourceLocal || local.Path != "/var/tmp/products.csv" || local.URL != "" {
		t.Fatalf("local = %#v", local)
	}

	blob := SourceFromString("https://acct.blob.core.windows.net/imports/daily/products.csv")
	if blob.Type != SourceAzureBlob || blob.URL == "" || blob.Path != "" {
		t.Fatalf("blob = %#v", blob)
	}
}

func TestSourceConfigUnmarshalLegacyString(t *testing.T) {
	var cfg SourceConfig
	if err := json.Unmarshal([]byte(`"in.csv"`), &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Type != SourceLocal || cfg.Path != "in.csv" {
		t.Fatalf("cfg = %#v", cfg)
	}

	if err := json.Unmarshal([]byte(`"https://acct.blob.core.windows.net/c/b.csv"`), &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Type != SourceAzureBlob || cfg.URL != "https://acct.blob.core.windows.net/c/b.csv" {
		t.Fatalf("cfg = %#v", cfg)
	}
}

func TestSourceConfigUnmarshalObject(t *testing.T) {
	var cfg SourceConfig
	err := json.Unmarshal([]byte(`{
		"type": "azure-blob",
		"url": "https://acct.blob.core.windows.net/c/b.csv",
		"auth": {"accountName": "acct", "accountKey": "key"}
	}`), &cfg)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Type != SourceAzureBlob || cfg.URL != "https://acct.blob.core.windows.net/c/b.csv" {
		t.Fatalf("cfg = %#v", cfg)
	}
	if cfg.Auth == nil || cfg.Auth.AccountName != "acct" || cfg.Auth.AccountKey != "key" {
		t.Fatalf("Auth = %#v", cfg.Auth)
	}
}

func TestSourceConfigUnmarshalRejectsUnknownFields(t *testing.T) {
	var cfg SourceConfig
	err := json.Unmarshal([]byte(`{"path": "in.csv", "bogus": true}`), &cfg)
	if err == nil {
		t.Fatal("expected unknown field to fail")
	}
	if !strings.Contains(err.Error(), `unknown field "bogus"`) {
		t.Fatalf("error = %q, want unknown bogus field", err)
	}
}

func TestSourceConfigValidateInference(t *testing.T) {
	cfg := SourceConfig{Path: "in.csv"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	if cfg.Type != SourceLocal {
		t.Fatalf("Type = %q, want %q", cfg.Type, SourceLocal)
	}

	cfg = SourceConfig{URL: "https://acct.blob.core.windows.net/c/b.csv"}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	if cfg.Type != SourceAzureBlob {
		t.Fatalf("Type = %q, want %q", cfg.Type, SourceAzureBlob)
	}
}

func TestSourceConfigValidateErrors(t *testing.T) {
	tests := []struct {
		name string
		cfg  SourceConfig
	}{
		{name: "empty", cfg: SourceConfig{}},
		{name: "both path and url without type", cfg: SourceConfig{Path: "in.csv", URL: "https://a.b/c/d"}},
		{name: "local without path", cfg: SourceConfig{Type: SourceLocal}},
		{name: "local with url", cfg: SourceConfig{Type: SourceLocal, Path: "in.csv", URL: "https://a.b/c/d"}},
		{name: "local with auth", cfg: SourceConfig{Type: SourceLocal, Path: "in.csv", Auth: &AzureAuth{SASToken: "sig=x"}}},
		{name: "azure without url", cfg: SourceConfig{Type: SourceAzureBlob}},
		{name: "azure with path", cfg: SourceConfig{Type: SourceAzureBlob, URL: "https://a.b/c/d", Path: "in.csv"}},
		{name: "unsupported type", cfg: SourceConfig{Type: "s3", URL: "https://a.b/c/d"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.cfg.Validate(); err == nil {
				t.Fatalf("Validate() = nil, want error for %#v", tt.cfg)
			}
		})
	}
}

func TestNewDispatchesBySourceType(t *testing.T) {
	r, err := New(SourceConfig{Path: "in.csv"})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := r.(*LocalFileReader); !ok {
		t.Fatalf("reader = %T, want *LocalFileReader", r)
	}

	r, err = New(SourceConfig{
		URL:  "https://acct.blob.core.windows.net/c/b.csv",
		Auth: &AzureAuth{AccountName: "acct", AccountKey: "key"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := r.(*AzureBlobReader); !ok {
		t.Fatalf("reader = %T, want *AzureBlobReader", r)
	}

	if _, err := New(SourceConfig{}); err == nil {
		t.Fatal("expected invalid config to fail")
	}
}
