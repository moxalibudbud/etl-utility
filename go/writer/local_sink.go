package writer

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// localSinkMode selects how a LocalSink commits its output. The two existing
// local writers have genuinely different on-disk contracts, so LocalSink
// parameterizes over both rather than picking one and changing the other's
// observable behavior.
type localSinkMode int

const (
	// localSinkAppend opens (and creates) the final file directly and
	// appends to it, matching DefaultWriter's historical behavior. There is
	// no partial file and no atomic promotion.
	localSinkAppend localSinkMode = iota
	// localSinkAtomic buffers into a "<final>.partial" sibling and promotes
	// it onto the final path with an atomic rename on Close, matching
	// JSONWriter's contract from the design doc's "Local output and atomic
	// completion" section.
	localSinkAtomic
)

// LocalSink is the local-disk Sink implementation shared by DefaultWriter
// (append mode) and JSONWriter (atomic mode).
type LocalSink struct {
	dir  string
	mode localSinkMode

	file        *os.File
	bw          *bufio.Writer
	partialPath string
	finalPath   string
	closed      bool
}

// NewLocalSink returns a LocalSink that appends directly to the final file,
// creating it if necessary. This preserves DefaultWriter's existing bytes.
func NewLocalSink(dir string) *LocalSink {
	return &LocalSink{dir: dir, mode: localSinkAppend}
}

// NewAtomicLocalSink returns a LocalSink that buffers into a temporary
// sibling file and atomically renames it onto the final path on a successful
// Close, matching JSONWriter's existing contract.
func NewAtomicLocalSink(dir string) *LocalSink {
	return &LocalSink{dir: dir, mode: localSinkAtomic}
}

func (s *LocalSink) Location(filename string) string {
	return filepath.Join(s.dir, filename)
}

func (s *LocalSink) Start(filename string) (io.Writer, error) {
	if filename == "" {
		return nil, fmt.Errorf(`output filename is empty; set "filename"`)
	}
	s.finalPath = filepath.Join(s.dir, filename)

	var f *os.File
	var err error
	switch s.mode {
	case localSinkAtomic:
		s.partialPath = s.finalPath + ".partial"
		f, err = os.OpenFile(s.partialPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o666)
	default:
		f, err = os.OpenFile(s.finalPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o777)
	}
	if err != nil {
		return nil, err
	}
	s.file = f
	s.bw = bufio.NewWriter(f)
	return s.bw, nil
}

func (s *LocalSink) Close() error {
	if s.file == nil || s.closed {
		return nil
	}
	if s.mode == localSinkAtomic {
		return s.closeAtomic()
	}
	return s.closeAppend()
}

// closeAppend flushes and closes the final file directly; there is no
// partial file to promote or remove.
func (s *LocalSink) closeAppend() error {
	if err := s.bw.Flush(); err != nil {
		_ = s.file.Close()
		s.file = nil
		return err
	}
	if err := s.file.Close(); err != nil {
		s.file = nil
		return err
	}
	s.file = nil
	s.closed = true
	return nil
}

// closeAtomic flushes and syncs the partial file, then promotes it onto the
// final path with an atomic rename. Any failure along the way removes the
// partial file so a failed or incomplete document is never left looking
// final (design doc §8).
func (s *LocalSink) closeAtomic() error {
	if err := s.bw.Flush(); err != nil {
		s.cleanupOnFailure()
		return err
	}
	if err := s.file.Sync(); err != nil {
		s.cleanupOnFailure()
		return err
	}
	if err := s.file.Close(); err != nil {
		s.file = nil
		s.cleanupOnFailure()
		return err
	}
	s.file = nil
	if err := os.Rename(s.partialPath, s.finalPath); err != nil {
		s.cleanupOnFailure()
		return err
	}
	s.closed = true
	return nil
}

// Delete removes any partial and/or final output. It is idempotent and safe
// to call whether or not Start or Close ran.
func (s *LocalSink) Delete() error {
	if s.file != nil {
		_ = s.bw.Flush()
		_ = s.file.Close()
		s.file = nil
	}
	if s.mode == localSinkAtomic && s.partialPath != "" {
		_ = os.Remove(s.partialPath)
	}
	if s.finalPath == "" {
		return nil
	}
	if err := os.Remove(s.finalPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// cleanupOnFailure closes the open file handle (if any) and removes the
// partial file. It is used on the atomic-mode failure paths in Close, which
// must never leave a final-looking partial document behind (design doc §8).
func (s *LocalSink) cleanupOnFailure() {
	if s.file != nil {
		_ = s.file.Close()
		s.file = nil
	}
	if s.partialPath != "" {
		_ = os.Remove(s.partialPath)
	}
}
