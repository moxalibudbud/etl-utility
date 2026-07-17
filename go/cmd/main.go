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
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"flatfile-go/etl"
)

type options struct {
	configPath   string
	configReader io.Reader
	source       string
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
		configPath:   *configPath,
		configReader: os.Stdin,
		source:       *source,
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

// buildETLConfig reads the canonical etl.Config JSON shape used by every
// entrypoint. A non-empty -source flag overrides Config.Source for convenience.
func buildETLConfig(opts options) (etl.Config, error) {
	if opts.configPath == "" {
		return etl.Config{}, fmt.Errorf("-config is required")
	}

	var data []byte
	var err error
	if opts.configPath == "-" {
		if opts.configReader == nil {
			return etl.Config{}, fmt.Errorf("config reader is required when -config is -")
		}
		data, err = io.ReadAll(opts.configReader)
	} else {
		data, err = os.ReadFile(opts.configPath)
	}
	if err != nil {
		return etl.Config{}, err
	}

	var cfg etl.Config
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cfg); err != nil {
		return etl.Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}

	if opts.source != "" {
		cfg.Source = opts.source
	}

	return cfg, nil
}
