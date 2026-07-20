package etl

import (
	"context"

	"flatfile-go/reader"
	"flatfile-go/writer"
)

// Config is the single JSON-serializable request that drives a run. It is the
// boundary shared by every surface (CLI args, a BullMQ worker spawning the
// binary with JSON on stdin, a cloud function, or an in-process helper call), so
// they all exercise the exact same core.
type Config struct {
	// Source is where to read from: the legacy JSON string (local path or blob
	// URL) or the typed object form (see reader.SourceConfig).
	Source reader.SourceConfig `json:"source"`
	// Output selects and configures the writer.
	Output writer.OutputConfig `json:"output"`
	// Options are the line rules + reject behaviour.
	Options Options `json:"options"`
}

// Run executes a Config end to end with the default time budget and no ambient
// deadline. It is the convenience form for callers (and tests) that do not need
// to control the budget; every real entrypoint should use RunContext so the run
// respects the host's execution ceiling.
func Run(cfg Config) (Result, error) {
	return RunContext(context.Background(), DefaultBudget(), cfg)
}

// RunContext executes a Config end to end under a time budget. It derives the
// work and cleanup contexts from b (see Budget.Deadlines), wires the work
// context into every deadline-aware destination (the blob upload/download), and
// runs the pipeline. base carries the host deadline where one exists (a Lambda
// invocation context, an HTTP request context); on a plain CLI it is
// context.Background().
func RunContext(base context.Context, b Budget, cfg Config) (Result, error) {
	work, cleanup, cancel := b.Deadlines(base)
	defer cancel()

	outputWriter, err := writer.Factory(cfg.Output)
	if err != nil {
		return Result{}, err
	}
	// Local writers ignore this; only network destinations (the blob writer)
	// implement DeadlineAware. Probing keeps the deadline out of the core
	// Writer interface, mirroring OptionsProvider.
	if da, ok := outputWriter.(writer.DeadlineAware); ok {
		da.SetDeadlineContexts(work, cleanup)
	}

	pipeline, err := New(work, cfg.Source, cfg.Options, outputWriter)
	if err != nil {
		return Result{}, err
	}
	return pipeline.Process()
}
