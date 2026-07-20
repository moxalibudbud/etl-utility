// Package writer produces output files from validated lines. Writers are lazy:
// the file and header are created on the first Push, so an all-invalid (or empty)
// input never produces an output file. A Writer interface plus a Factory mirror
// the TS FlatFileBaseLazy + FileGeneratorFactory, leaving room for JSON/Excel/
// cloud writers later without changing the ETL orchestrator.
package writer

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"flatfile-go/azureauth"
	"flatfile-go/line"
)

// Writer is the output sink contract used by the ETL orchestrator.
type Writer interface {
	Push(sl *line.SourceLine) error
	PushFooter() error
	End() error
	Delete() error
	Filepath() string
	Filename() string
	Path() string
}

// DeadlineAware is implemented by writers whose destination performs network
// I/O that must respect the job's time budget. The ETL orchestrator probes for
// it and injects the work and cleanup contexts, keeping the deadline out of the
// core Writer interface (which every local writer and test double would
// otherwise have to satisfy). This mirrors the OptionsProvider probe. The work
// context bounds the upload; the cleanup context — reserved separately so it
// survives a work-deadline timeout — bounds the abort/delete.
type DeadlineAware interface {
	SetDeadlineContexts(work, cleanup context.Context)
}

// Destination types accepted by DestinationConfig. They mirror the source
// types in the reader package.
const (
	DestinationLocal     = "local"
	DestinationAzureBlob = "azure-blob"
)

// DestinationConfig identifies where writer output is stored. It mirrors
// reader.SourceConfig's flat shape and is embedded in OutputConfig, so the
// wire form stays flat:
//
//	"output": {"filename": "out.csv", "path": "/var/tmp"}
//	"output": {"type": "azure-blob", "url": "https://acct.blob.core.windows.net/exports/daily",
//	           "auth": {"accountName": "acct", "accountKey": "..."}, "filename": "out.csv"}
//
// Unlike the reader's URL (which names the exact blob to read), URL here is a
// container/prefix: the rendered Filename is appended to it, the blob-side
// analog of joining Path + Filename locally.
type DestinationConfig struct {
	Type string               `json:"type,omitempty"` // "local" | "azure-blob"; empty = inferred
	Path string               `json:"path,omitempty"` // local output directory
	URL  string               `json:"url,omitempty"`  // Azure container/prefix URL
	Auth *azureauth.AzureAuth `json:"auth,omitempty"` // caller-supplied Azure credentials
}

// Validate infers an empty Type from which location field is set, then checks
// that exactly the fields required by the type are present. Unlike the
// reader's SourceConfig, an entirely empty config is valid: it stays local
// and DefaultWriter falls back to the OS temp dir.
// Validate errors are always KindPermanent: they fire before any I/O, purely
// from the shape of the request, so retrying the identical config produces
// the identical rejection. A worker handler should dead-letter these
// immediately rather than spend a retry budget on them.
func (c *DestinationConfig) Validate() error {
	if c.Type == "" {
		switch {
		case c.URL != "" && c.Path == "":
			c.Type = DestinationAzureBlob
		case c.URL == "":
			c.Type = DestinationLocal
		default:
			return Permanent("validate output config", "", fmt.Errorf("output: path and url must not both be set"))
		}
	}

	switch c.Type {
	case DestinationLocal:
		if c.URL != "" {
			return Permanent("validate output config", "", fmt.Errorf("output: url must not be set when type is %q", DestinationLocal))
		}
		if c.Auth != nil {
			return Permanent("validate output config", "", fmt.Errorf("output: auth is only valid when type is %q", DestinationAzureBlob))
		}
	case DestinationAzureBlob:
		if c.URL == "" {
			return Permanent("validate output config", "", fmt.Errorf("output: url is required when type is %q", DestinationAzureBlob))
		}
		if c.Path != "" {
			return Permanent("validate output config", "", fmt.Errorf("output: path must not be set when type is %q", DestinationAzureBlob))
		}
	default:
		return Permanent("validate output config", "", fmt.Errorf("output: unsupported type %q", c.Type))
	}
	return nil
}

// OutputConfig configures a Writer. Filename is always rendered through the
// templating layers ({path} from the first pushed row, then [func ...]); a
// plain name contains no tokens and passes through unchanged. Template and
// Separator select mutually exclusive row-building modes: when Template is
// set, it takes precedence and Separator is ignored.
type OutputConfig struct {
	DestinationConfig

	FileGenerator string         `json:"fileGenerator"`
	Filename      string         `json:"filename"`
	Separator     string         `json:"separator"`
	Header        string         `json:"header"`
	Footer        string         `json:"footer"`
	Template      string         `json:"template"`
	ArrayField    string         `json:"arrayField"`
	UniqueKey     string         `json:"uniqueKey"`
	Metadata      map[string]any `json:"metadata"`

	// Options holds optional writer behavior toggles that are not part of the
	// document format itself. It is a map rather than typed fields so new
	// toggles can be added without another wire-shape migration, and every
	// option must default to the zero value so an absent map behaves like the
	// current default.
	//
	// Note this is "output.options", distinct from the top-level "options"
	// that carries the line rules:
	//
	//	{"output": {"options": {"errorReport": true}}, "options": {"line": {...}}}
	Options map[string]any `json:"options,omitempty"`
}

// Option keys recognized in OutputConfig.Options.
const (
	// OptionErrorReport enables writing the "<source>.error.txt" report file.
	// It defaults to false: the pipeline targets serverless workers where the
	// writable filesystem is a small ephemeral scratch space reused across
	// warm invocations, so producing a side file nobody collects is a leak,
	// not a feature. Invalid rows are still counted and still surface through
	// Result.TotalErrors and RejectOnInvalidRow when this is off.
	OptionErrorReport = "errorReport"
)

// BoolOption reads a boolean toggle from Options, returning def when the key
// is absent. A value of the wrong type is treated as absent rather than an
// error, keeping an unrecognized wire value from failing an otherwise valid
// run.
func (c OutputConfig) BoolOption(name string, def bool) bool {
	v, ok := c.Options[name]
	if !ok {
		return def
	}
	b, ok := v.(bool)
	if !ok {
		return def
	}
	return b
}

// OptionsProvider is implemented by writers constructed from an OutputConfig.
// ETL uses it to read output-level toggles without widening the Writer
// interface, which every writer and test double would then have to satisfy.
type OptionsProvider interface {
	Options() map[string]any
}

// ErrorReportEnabled reports whether w opted into writing an error-report
// file. Writers that carry no config (test doubles) get the default: off.
func ErrorReportEnabled(w Writer) bool {
	p, ok := w.(OptionsProvider)
	if !ok {
		return false
	}
	return OutputConfig{Options: p.Options()}.BoolOption(OptionErrorReport, false)
}

// UnmarshalJSON accepts the three historical wire shapes for the filename:
//
//	"filename": "out.csv"                     canonical flat string
//	"filename": {"template": "x_{ITEM}.csv"}  TS object form
//	"filenameTemplate": "x_{ITEM}.csv"        legacy Go key
//
// The legacy filenameTemplate key keeps its old precedence over filename when
// both are set.
func (c *OutputConfig) UnmarshalJSON(b []byte) error {
	type alias OutputConfig
	aux := struct {
		*alias
		Filename         json.RawMessage `json:"filename"`
		FilenameTemplate string          `json:"filenameTemplate"`
	}{alias: (*alias)(c)}
	if err := json.Unmarshal(b, &aux); err != nil {
		return err
	}

	if aux.FilenameTemplate != "" {
		c.Filename = aux.FilenameTemplate
		return nil
	}
	if len(aux.Filename) == 0 {
		return nil
	}
	var s string
	if err := json.Unmarshal(aux.Filename, &s); err == nil {
		c.Filename = s
		return nil
	}
	// TODO: Remove support for the TS object form in a future version. Keep
	// filename as the canonical flat string and filenameTemplate as the legacy
	// Go key.
	var obj struct {
		Template string `json:"template"`
	}
	if err := json.Unmarshal(aux.Filename, &obj); err != nil {
		return fmt.Errorf(`output filename must be a string or {"template": "..."}: %w`, err)
	}
	c.Filename = obj.Template
	return nil
}

// Factory returns a Writer for the given destination and generator kind. The
// destination axis (local vs azure-blob) is selected first; within each
// destination, an empty generator kind defaults to the delimited/template
// writer. json-generator is supported for both destinations. Other kinds
// (excel/dedup variants) return an explicit error.
func Factory(opts OutputConfig) (Writer, error) {
	if err := opts.Validate(); err != nil {
		return nil, err
	}
	switch opts.Type {
	case DestinationAzureBlob:
		return newBlobWriter(opts)
	case DestinationLocal:
		return newLocalWriter(opts)
	default:
		return nil, Permanent("build writer", "", fmt.Errorf("output: unsupported type %q", opts.Type))
	}
}

func newLocalWriter(opts OutputConfig) (Writer, error) {
	switch opts.FileGenerator {
	case "default-generator", "":
		return NewDefaultWriter(opts), nil
	case "json-generator":
		return NewJSONWriter(opts)
	default:
		return nil, Permanent("build writer", "", fmt.Errorf("writer type %q is not supported in the Go core yet", opts.FileGenerator))
	}
}

func newBlobWriter(opts OutputConfig) (Writer, error) {
	switch opts.FileGenerator {
	case "default-generator", "":
		return NewAzureBlobWriter(opts), nil
	case "json-generator":
		if opts.Path == "" {
			opts.Path = os.TempDir()
		}
		var auth azureauth.AzureAuth
		if opts.Auth != nil {
			auth = *opts.Auth
		}
		return newJSONWriterWithSink(opts, NewAzureBlobSink(opts.URL, auth))
	default:
		return nil, Permanent("build writer", "", fmt.Errorf("writer type %q is not supported in the Go core yet", opts.FileGenerator))
	}
}
