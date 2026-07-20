package writer

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"
)

var _ Sink = (*LocalSink)(nil)

// makeNonEmptyDir creates a directory at path containing one file, so a
// later os.Remove(path) or os.Rename(_, path) reliably fails cross-platform
// (ENOTEMPTY/EEXIST) without relying on filesystem permissions, which behave
// inconsistently under a root test runner.
func makeNonEmptyDir(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(path, "occupied"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLocalSinkAtomicCloseFailureIsTransientWhenCleanupSucceeds(t *testing.T) {
	dir := t.TempDir()
	s := NewAtomicLocalSink(dir)
	w, err := s.Start("out.json")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(w, "x"); err != nil {
		t.Fatal(err)
	}
	// Occupy the final path with a non-empty directory so the promotion
	// rename fails; nothing about the partial file itself is disturbed, so
	// its own cleanup should still succeed.
	makeNonEmptyDir(t, s.finalPath)

	err = s.Close()
	if err == nil {
		t.Fatal("expected rename onto an occupied path to fail")
	}
	if got := KindOf(err); got != KindTransient {
		t.Fatalf("KindOf(close error) = %v, want KindTransient (partial cleanup succeeded, so nothing was left committed)", got)
	}
	if _, statErr := os.Stat(s.partialPath); !os.IsNotExist(statErr) {
		t.Fatalf("partial file should have been removed on failure, stat err = %v", statErr)
	}
}

func TestLocalSinkFailCloseIsUnresolvedWhenPartialCleanupAlsoFails(t *testing.T) {
	dir := t.TempDir()
	s := NewAtomicLocalSink(dir)
	s.finalPath = filepath.Join(dir, "out.json")
	s.partialPath = filepath.Join(dir, "out.json.partial")
	// Occupy the partial path itself with a non-empty directory so
	// cleanupOnFailure's os.Remove cannot succeed either.
	makeNonEmptyDir(t, s.partialPath)

	err := s.failClose("promote output", errors.New("boom"))
	if err == nil {
		t.Fatal("expected an error")
	}
	if got := KindOf(err); got != KindUnresolved {
		t.Fatalf("KindOf(err) = %v, want KindUnresolved (the partial file could not be removed either)", got)
	}
}

func TestLocalSinkAppendCloseFailureIsAlwaysUnresolved(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalSink(dir)
	w, err := s.Start("out.csv")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(w, "x"); err != nil {
		t.Fatal(err)
	}
	// Force the flush to fail by closing the underlying fd out from under
	// the sink; the disk file itself is untouched (unlike atomic mode there
	// is no partial to roll back, so any failure here is Unresolved by
	// definition, not just by cause).
	if err := s.file.Close(); err != nil {
		t.Fatal(err)
	}

	err = s.Close()
	if err == nil {
		t.Fatal("expected flush against a closed file to fail")
	}
	if got := KindOf(err); got != KindUnresolved {
		t.Fatalf("KindOf(close error) = %v, want KindUnresolved (append mode writes in place; a failure here cannot be rolled back)", got)
	}
}

func TestLocalSinkDeleteFailureIsUnresolved(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalSink(dir)
	s.finalPath = filepath.Join(dir, "out.csv")
	makeNonEmptyDir(t, s.finalPath)

	err := s.Delete()
	if err == nil {
		t.Fatal("expected removing an occupied path to fail")
	}
	if got := KindOf(err); got != KindUnresolved {
		t.Fatalf("KindOf(delete error) = %v, want KindUnresolved (an artifact confirmed to exist could not be removed)", got)
	}
}

func TestLocalSinkStartFailureIsClassifiedNotUnconditionallyPermanent(t *testing.T) {
	// A file cannot be created inside a path component that is itself a
	// regular file, not a directory — this is a config-shaped failure (bad
	// output path), which Classify's fallback correctly reports as
	// KindPermanent: retrying the identical bad path helps nothing.
	dir := t.TempDir()
	blocker := filepath.Join(dir, "blocker")
	if err := os.WriteFile(blocker, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := NewAtomicLocalSink(blocker)

	_, err := s.Start("out.json")
	if err == nil {
		t.Fatal("expected open under a non-directory path to fail")
	}
	if got := KindOf(err); got != KindPermanent {
		t.Fatalf("KindOf(open error) = %v, want KindPermanent", got)
	}
}

func TestLocalSinkStartEmptyFilenameIsPermanent(t *testing.T) {
	s := NewLocalSink(t.TempDir())
	_, err := s.Start("")
	if got := KindOf(err); got != KindPermanent {
		t.Fatalf("KindOf(empty filename error) = %v, want KindPermanent", got)
	}
}
