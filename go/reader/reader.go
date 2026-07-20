// Package reader streams a source line by line. It abstracts the source kind
// behind a small interface so the ETL orchestrator is independent of where the
// bytes come from. Supported sources: local files and Azure Blob Storage.
package reader

import (
	"context"
	"fmt"
)

// Reader streams lines from a source. Open must be called before Scan.
type Reader interface {
	Open() error
	Scan() bool
	Text() string
	Err() error
	Close() error
	Filename() string
	Filepath() string
}

// New validates cfg and builds the Reader for its source type. Credentials for
// cloud sources travel inside cfg (see SourceConfig.Auth); nothing is read
// from the environment here. ctx is the work context: it bounds a streaming
// blob download so a stalled read fails on the job deadline instead of hanging
// until the host kills the whole process. A local source does not use it.
func New(ctx context.Context, cfg SourceConfig) (Reader, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	switch cfg.Type {
	case SourceAzureBlob:
		var auth AzureAuth
		if cfg.Auth != nil {
			auth = *cfg.Auth
		}
		r := NewAzureBlobReader(cfg.URL, auth)
		r.ctx = ctx
		return r, nil
	case SourceLocal:
		return NewLocalFileReader(cfg.Path), nil
	default:
		// Unreachable after Validate, kept for defensive clarity.
		return nil, fmt.Errorf("source: unsupported type %q", cfg.Type)
	}
}
