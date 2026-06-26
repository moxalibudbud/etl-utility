package reader

import (
	"bufio"
	"os"
	"path/filepath"
)

// maxLineBytes bounds a single scanned line. bufio.Scanner defaults to 64KiB,
// which is too small for wide flat-file rows.
const maxLineBytes = 10 * 1024 * 1024

// LocalFileReader streams a local file with bufio.Scanner. ScanLines drops a
// trailing \r, giving the CRLF tolerance the Node readline crlfDelay provided.
type LocalFileReader struct {
	source  string
	file    *os.File
	scanner *bufio.Scanner
}

// NewLocalFileReader returns a reader for the given local path.
func NewLocalFileReader(source string) *LocalFileReader {
	return &LocalFileReader{source: source}
}

// Open opens the file and prepares the scanner. Equivalent to the FileReader
// existence check + createReadStream + readline interface setup.
func (r *LocalFileReader) Open() error {
	f, err := os.Open(r.source)
	if err != nil {
		return err
	}
	r.file = f
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), maxLineBytes)
	r.scanner = sc
	return nil
}

func (r *LocalFileReader) Scan() bool { return r.scanner.Scan() }

func (r *LocalFileReader) Text() string { return r.scanner.Text() }

func (r *LocalFileReader) Err() error {
	if r.scanner == nil {
		return nil
	}
	return r.scanner.Err()
}

func (r *LocalFileReader) Close() error {
	if r.file == nil {
		return nil
	}
	err := r.file.Close()
	r.file = nil
	return err
}

func (r *LocalFileReader) Filename() string { return filepath.Base(r.source) }

func (r *LocalFileReader) Filepath() string { return r.source }
