// Package writer produces output files from validated lines. Writers are lazy:
// the file and header are created on the first Push, so an all-invalid (or empty)
// input never produces an output file. A Writer interface plus a Factory mirror
// the TS FlatFileBaseLazy + FileGeneratorFactory, leaving room for JSON/Excel/
// cloud writers later without changing the ETL orchestrator.
package writer

import (
	"encoding/json"
	"fmt"

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

// OutputConfig configures a Writer. Filename is always rendered through the
// templating layers ({field} from the first pushed row, then [func ...]); a
// plain name contains no tokens and passes through unchanged.
type OutputConfig struct {
	Type      string            `json:"fileGenerator"`
	Path      string            `json:"path"`
	Filename  string            `json:"filename"`
	Separator string            `json:"separator"`
	Header    string            `json:"header"`
	Footer    string            `json:"footer"`
	Template  string            `json:"template"`
	UniqueKey string            `json:"uniqueKey"`
	Metadata  map[string]string `json:"metadata"`
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

// Factory returns a Writer for the given kind. An empty kind defaults to the
// delimited/template writer. Unsupported kinds (json/excel/dedup variants) return
// an explicit error.
func Factory(opts OutputConfig) (Writer, error) {
	switch opts.Type {
	case "default-generator", "":
		return NewDefaultWriter(opts), nil
	default:
		return nil, fmt.Errorf("writer type %q is not supported in the Go core yet", opts.Type)
	}
}
