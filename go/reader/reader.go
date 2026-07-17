// Package reader streams a source line by line. It abstracts the source kind
// behind a small interface so the ETL orchestrator is independent of where the
// bytes come from. Supported sources: local files and Azure Blob Storage.
package reader

import "fmt"

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
// from the environment here.
func New(cfg SourceConfig) (Reader, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	switch cfg.Type {
	case SourceAzureBlob:
		var auth AzureAuth
		if cfg.Auth != nil {
			auth = *cfg.Auth
		}
		return NewAzureBlobReader(cfg.URL, auth), nil
	case SourceLocal:
		return NewLocalFileReader(cfg.Path), nil
	default:
		// Unreachable after Validate, kept for defensive clarity.
		return nil, fmt.Errorf("source: unsupported type %q", cfg.Type)
	}
}
