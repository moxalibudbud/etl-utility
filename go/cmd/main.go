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

	"flatfile-go/etl"
	"flatfile-go/line"
	"flatfile-go/writer"
)

type options struct {
	configPath string
	source     string
}

type configData struct {
	Line   line.LineConfig     `json:"line"`
	Output writer.OutputConfig `json:"output"`
}

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "etl:", err)
		os.Exit(1)
	}
}

func run(args []string, _ io.Reader, stdout io.Writer) error {
	fs := flag.NewFlagSet("etl", flag.ContinueOnError)

	configPath := fs.String("config", "", `path to a JSON Config, or "-" to read from stdin`)
	source := fs.String("source", "", "source file path")

	if err := fs.Parse(args); err != nil {
		return err
	}

	if *source == "" && *configPath == "" {
		return fmt.Errorf("either -configPath or -source is required")
	}

	cfg, err := buildETLConfig(options{
		configPath: *configPath,
		source:     *source,
	})
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

// buildETLConfig prefers an explicit JSON config (file or stdin) and otherwise
// assembles a Config from the individual flags.
func buildETLConfig(opts options) (etl.Config, error) {
	var data []byte
	var err error
	data, err = os.ReadFile(opts.configPath)

	if err != nil {
		return etl.Config{}, err
	}

	var configData configData
	if err := json.Unmarshal(data, &configData); err != nil {
		return etl.Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}

	etlConfig := etl.Config{
		Source: opts.source,
		Output: configData.Output,
		Options: etl.Options{
			Line:               configData.Line,
			RejectOnInvalidRow: false, // TODO: parse from metadata
		},
	}

	return etlConfig, nil
}
