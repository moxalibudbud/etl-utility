// Command etl is the terminal/worker entrypoint for the flat-file ETL core.
//
// Usage modes (all funnel through etl.Run):
//
//	# 1. JSON config from a file
//	etl -config job.json
//
//	# 2. JSON config from stdin (e.g. a BullMQ worker or cloud function spawning the binary)
//	echo '{"source":"in.csv", ...}' | etl -config -
//
//	# 3. Plain flags for quick terminal runs
//	etl -source in.csv -columns BARCODE,SKU -mandatory BARCODE \
//	    -separator , -with-header -out-filename out.csv -out-separator ';'
//
// The JSON Result is written to stdout; errors go to stderr with a non-zero exit.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"flatfile-go/etl"
	"flatfile-go/line"
	"flatfile-go/writer"
)

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "etl:", err)
		os.Exit(1)
	}
}

func run(args []string, stdin io.Reader, stdout io.Writer) error {
	fs := flag.NewFlagSet("etl", flag.ContinueOnError)

	configPath := fs.String("config", "", `path to a JSON Config, or "-" to read from stdin`)
	source := fs.String("source", "", "source file path")
	columns := fs.String("columns", "", "comma-separated column names")
	mandatory := fs.String("mandatory", "", "comma-separated mandatory field names")
	separator := fs.String("separator", "", "input field separator (default ';')")
	withHeader := fs.Bool("with-header", false, "treat the first line as a header")
	reject := fs.Bool("reject-on-invalid", false, "mark the whole result invalid if any row is invalid")

	outPath := fs.String("out-path", "", "output directory (default: OS temp dir)")
	outFilename := fs.String("out-filename", "", "output file name")
	outSeparator := fs.String("out-separator", "", "output field separator (default '|')")
	header := fs.String("header", "", "output header template")
	footer := fs.String("footer", "", "output footer")
	tmpl := fs.String("template", "", "output row template")

	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg, err := buildConfig(configCLI{
		configPath:   *configPath,
		source:       *source,
		columns:      *columns,
		mandatory:    *mandatory,
		separator:    *separator,
		withHeader:   *withHeader,
		reject:       *reject,
		outPath:      *outPath,
		outFilename:  *outFilename,
		outSeparator: *outSeparator,
		header:       *header,
		footer:       *footer,
		template:     *tmpl,
	}, stdin)
	if err != nil {
		return err
	}

	result, err := etl.Run(cfg)
	if err != nil {
		return err
	}

	enc := json.NewEncoder(stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(result)
}

type configCLI struct {
	configPath   string
	source       string
	columns      string
	mandatory    string
	separator    string
	withHeader   bool
	reject       bool
	outPath      string
	outFilename  string
	outSeparator string
	header       string
	footer       string
	template     string
}

// buildConfig prefers an explicit JSON config (file or stdin) and otherwise
// assembles a Config from the individual flags.
func buildConfig(c configCLI, stdin io.Reader) (etl.Config, error) {
	if c.configPath != "" {
		return loadJSONConfig(c.configPath, stdin)
	}

	if c.source == "" {
		return etl.Config{}, fmt.Errorf("either -config or -source is required")
	}

	return etl.Config{
		Source: c.source,
		Output: etl.OutputConfig{
			Kind: writer.KindDefault,
			Options: writer.OutputOptions{
				Path:      c.outPath,
				Filename:  c.outFilename,
				Separator: c.outSeparator,
				Header:    c.header,
				Footer:    c.footer,
				Template:  c.template,
			},
		},
		Options: etl.Options{
			Line: line.Options{
				Columns:         splitCSV(c.columns),
				MandatoryFields: splitCSV(c.mandatory),
				Separator:       c.separator,
				WithHeader:      c.withHeader,
			},
			RejectOnInvalidRow: c.reject,
		},
	}, nil
}

func loadJSONConfig(path string, stdin io.Reader) (etl.Config, error) {
	var data []byte
	var err error
	if path == "-" {
		data, err = io.ReadAll(stdin)
	} else {
		data, err = os.ReadFile(path)
	}
	if err != nil {
		return etl.Config{}, err
	}

	var cfg etl.Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return etl.Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}
	return cfg, nil
}

func splitCSV(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.TrimSpace(p))
	}
	return out
}
