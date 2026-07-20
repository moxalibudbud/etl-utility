package writer

import (
	"bufio"
	"errors"
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
		return nil, Permanent("open output", "", fmt.Errorf(`output filename is empty; set "filename"`))
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
		// Nothing exists yet at this point, so there is nothing to clean up;
		// the only question is whether retrying could help, which depends on
		// the cause (bad path/permissions vs. a transient OS error).
		return nil, Classify("open output", s.finalPath, err)
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
// partial file to promote or remove. Unlike closeAtomic, this mode writes
// straight into the final path, so a failure here cannot be rolled back to
// "nothing committed" — whatever was already flushed is sitting in the real
// output file. That is reported Unresolved unconditionally: the cause does
// not matter because there is no clean-vs-dirty branch to take, only a
// destination whose contents no longer match what the caller asked for.
func (s *LocalSink) closeAppend() error {
	if err := s.bw.Flush(); err != nil {
		_ = s.file.Close()
		s.file = nil
		return Unresolved("flush output", s.finalPath, err)
	}
	if err := s.file.Close(); err != nil {
		s.file = nil
		return Unresolved("close output", s.finalPath, err)
	}
	s.file = nil
	s.closed = true
	return nil
}

// closeAtomic flushes and syncs the partial file, then promotes it onto the
// final path with an atomic rename. Any failure along the way removes the
// partial file so a failed or incomplete document is never left looking
// final (design doc §8).
//
// Classification follows from whether that cleanup itself succeeded, not
// from the failure's cause: if the partial file was removed, the run is back
// to "nothing committed" and a retry is exactly as safe as the first attempt
// (KindTransient). If the partial could not be removed, a serverless worker
// has no later pass to catch it — the container is frozen or destroyed once
// the invocation returns — so that must escalate to KindUnresolved regardless
// of what the original error was.
func (s *LocalSink) closeAtomic() error {
	if err := s.bw.Flush(); err != nil {
		return s.failClose("flush output", err)
	}
	if err := s.file.Sync(); err != nil {
		return s.failClose("sync output", err)
	}
	if err := s.file.Close(); err != nil {
		s.file = nil
		return s.failClose("close output", err)
	}
	s.file = nil
	if err := os.Rename(s.partialPath, s.finalPath); err != nil {
		return s.failClose("promote output", err)
	}
	s.closed = true
	return nil
}

// failClose cleans up the partial file after a failed commit step and
// classifies the result per the comment on closeAtomic.
func (s *LocalSink) failClose(op string, err error) error {
	if cleanupErr := s.cleanupOnFailure(); cleanupErr != nil {
		return Unresolved(op, s.partialPath, fmt.Errorf("%w (cleanup also failed: %v)", err, cleanupErr))
	}
	return Transient(op, s.finalPath, err)
}

// Delete removes any partial and/or final output. It is idempotent and safe
// to call whether or not Start or Close ran. A failure to remove a file that
// was confirmed to exist is always Unresolved: there is no cause-dependent
// case here — the caller asked for the artifact to be gone and it is
// confirmed still present.
func (s *LocalSink) Delete() error {
	if s.file != nil {
		_ = s.bw.Flush()
		_ = s.file.Close()
		s.file = nil
	}

	var errs []error
	if s.mode == localSinkAtomic && s.partialPath != "" {
		if err := os.Remove(s.partialPath); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Errorf("partial %s: %w", s.partialPath, err))
		}
	}
	if s.finalPath != "" {
		if err := os.Remove(s.finalPath); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Errorf("final %s: %w", s.finalPath, err))
		}
	}
	if len(errs) == 0 {
		return nil
	}
	return Unresolved("delete output", s.finalPath, errors.Join(errs...))
}

// cleanupOnFailure closes the open file handle (if any) and removes the
// partial file, reporting whether the removal actually succeeded. It is used
// on the atomic-mode failure paths in Close, which must never leave a
// final-looking partial document behind (design doc §8) — and, unlike the
// previous version, must not swallow a failed removal, since that is exactly
// the case the caller needs to distinguish (KindUnresolved) from a clean
// rollback (KindTransient).
func (s *LocalSink) cleanupOnFailure() error {
	if s.file != nil {
		_ = s.file.Close()
		s.file = nil
	}
	if s.partialPath == "" {
		return nil
	}
	if err := os.Remove(s.partialPath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
