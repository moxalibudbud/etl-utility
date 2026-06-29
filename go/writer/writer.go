// Package writer produces output files from validated lines. Writers are lazy:
// the file and header are created on the first Push, so an all-invalid (or empty)
// input never produces an output file. A Writer interface plus a Factory mirror
// the TS FlatFileBaseLazy + FileGeneratorFactory, leaving room for JSON/Excel/
// cloud writers later without changing the ETL orchestrator.
package writer

import (
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

// OutputConfig configures a Writer. Filename is used verbatim; FilenameTemplate
// (when set) is rendered through the templating layers instead.
type OutputConfig struct {
	Type             string            `json:"fileGenerator"`
	Path             string            `json:"path"`
	Filename         string            `json:"filename"`
	FilenameTemplate string            `json:"filenameTemplate"`
	Separator        string            `json:"separator"`
	Header           string            `json:"header"`
	Footer           string            `json:"footer"`
	Template         string            `json:"template"`
	UniqueKey        string            `json:"uniqueKey"`
	Metadata         map[string]string `json:"metadata"`
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
