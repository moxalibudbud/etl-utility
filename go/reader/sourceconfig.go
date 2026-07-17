package reader

import (
	"bytes"
	"encoding/json"
	"fmt"

	util "flatfile-go/utils"
)

// Source types accepted by SourceConfig.
const (
	SourceLocal     = "local"
	SourceAzureBlob = "azure-blob"
)

// SourceConfig identifies where the ETL reads from. The JSON wire form is
// either the legacy string (a local path, or an Azure blob URL) or an object:
//
//	"source": "/var/tmp/products.csv"
//	"source": {"type": "local", "path": "/var/tmp/products.csv"}
//	"source": {"type": "azure-blob", "url": "https://acct.blob.core.windows.net/c/p.csv",
//	           "auth": {"accountName": "acct", "accountKey": "..."}}
type SourceConfig struct {
	Type string     `json:"type,omitempty"` // "local" | "azure-blob"; empty = inferred
	Path string     `json:"path,omitempty"` // local file path
	URL  string     `json:"url,omitempty"`  // Azure blob URL
	Auth *AzureAuth `json:"auth,omitempty"` // caller-supplied Azure credentials
}

// SourceFromString normalizes the legacy string form (JSON string source or
// the CLI -source flag): URLs are treated as Azure blob sources, anything else
// as a local path.
func SourceFromString(s string) SourceConfig {
	if util.IsValidURL(s) {
		return SourceConfig{Type: SourceAzureBlob, URL: s}
	}
	return SourceConfig{Type: SourceLocal, Path: s}
}

// UnmarshalJSON accepts both wire forms. Object fields are decoded strictly:
// the CLI's DisallowUnknownFields does not reach inside a custom unmarshaler,
// so unknown keys are rejected here.
func (c *SourceConfig) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) > 0 && trimmed[0] == '"' {
		var s string
		if err := json.Unmarshal(trimmed, &s); err != nil {
			return err
		}
		*c = SourceFromString(s)
		return nil
	}

	type wire SourceConfig // drop methods to avoid recursing into UnmarshalJSON
	var w wire
	dec := json.NewDecoder(bytes.NewReader(trimmed))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&w); err != nil {
		return fmt.Errorf("invalid source config: %w", err)
	}
	*c = SourceConfig(w)
	return nil
}

// Validate infers an empty Type from which location field is set, then checks
// that exactly the fields required by the type are present. It is called by
// reader.New so every entrypoint fails before processing starts.
func (c *SourceConfig) Validate() error {
	if c.Type == "" {
		switch {
		case c.Path != "" && c.URL == "":
			c.Type = SourceLocal
		case c.URL != "" && c.Path == "":
			c.Type = SourceAzureBlob
		default:
			return fmt.Errorf("source: exactly one of path or url must be set")
		}
	}

	switch c.Type {
	case SourceLocal:
		if c.Path == "" {
			return fmt.Errorf("source: path is required when type is %q", SourceLocal)
		}
		if c.URL != "" {
			return fmt.Errorf("source: url must not be set when type is %q", SourceLocal)
		}
		if c.Auth != nil {
			return fmt.Errorf("source: auth is only valid when type is %q", SourceAzureBlob)
		}
	case SourceAzureBlob:
		if c.URL == "" {
			return fmt.Errorf("source: url is required when type is %q", SourceAzureBlob)
		}
		if c.Path != "" {
			return fmt.Errorf("source: path must not be set when type is %q", SourceAzureBlob)
		}
	default:
		return fmt.Errorf("source: unsupported type %q", c.Type)
	}
	return nil
}
