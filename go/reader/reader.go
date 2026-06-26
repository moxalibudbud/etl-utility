// Package reader streams a source line by line. It abstracts the source kind
// behind a small interface so cloud (Azure/S3) readers can be added later
// without touching the ETL orchestrator. Core scope: local files only.
package reader

import (
	"fmt"

	util "flatfile-go/utils"
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

// New builds a Reader for source. Remote/blob URLs are recognised but not yet
// supported in the Go core (deferred), so they return an explicit error rather
// than silently treating a URL as a local path.
func New(source string) (Reader, error) {
	if util.IsValidURL(source) {
		return nil, fmt.Errorf("remote/blob sources are not supported in the Go core yet: %s", source)
	}
	return NewLocalFileReader(source), nil
}
