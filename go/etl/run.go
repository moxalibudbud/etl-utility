package etl

import "flatfile-go/writer"

// Config is the single JSON-serializable request that drives a run. It is the
// boundary shared by every surface (CLI args, a BullMQ worker spawning the
// binary with JSON on stdin, a cloud function, or an in-process helper call), so
// they all exercise the exact same core.
type Config struct {
	// Source is the local file path to read.
	Source string `json:"source"`
	// Output selects and configures the writer.
	Output writer.OutputConfig `json:"output"`
	// Options are the line rules + reject behaviour.
	Options Options `json:"options"`
}

// Run executes a Config end to end and returns the Result. This is the function
// every entrypoint funnels through.
func Run(cfg Config) (Result, error) {
	outputWriter, err := writer.Factory(cfg.Output)
	if err != nil {
		return Result{}, err
	}

	pipeline, err := New(cfg.Source, cfg.Options, outputWriter)
	if err != nil {
		return Result{}, err
	}
	return pipeline.Process()
}
