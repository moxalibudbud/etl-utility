package writer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestErrorReportDisabledCountsWithoutWritingFile(t *testing.T) {
	dir := t.TempDir()
	er := NewErrorReport("input.csv", dir, false)

	if err := er.Push("ERROR AT LINE 1: bad row"); err != nil {
		t.Fatal(err)
	}
	if er.InvalidRows != 1 {
		t.Fatalf("InvalidRows = %d, want 1 (counting must work regardless of the file)", er.InvalidRows)
	}
	if er.Filename() != "" || er.Filepath() != "" {
		t.Fatalf("Filename/Filepath should be empty while disabled, got %q / %q", er.Filename(), er.Filepath())
	}
	if err := er.End(); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("expected no files written, found %v", entries)
	}
}

func TestErrorReportEnabledWritesFileAndCounts(t *testing.T) {
	dir := t.TempDir()
	er := NewErrorReport("input.csv", dir, true)

	if err := er.Push("ERROR AT LINE 1: bad row"); err != nil {
		t.Fatal(err)
	}
	if er.Filename() != "input.csv.error.txt" {
		t.Fatalf("Filename = %q, want input.csv.error.txt", er.Filename())
	}
	if err := er.End(); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(er.Filepath())
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "ERROR AT LINE 1: bad row\n" {
		t.Fatalf("content = %q", content)
	}
}

func TestErrorReportDeleteFailureIsUnresolved(t *testing.T) {
	dir := t.TempDir()
	er := NewErrorReport("input.csv", dir, true)
	if err := er.Push("ERROR AT LINE 1: bad row"); err != nil {
		t.Fatal(err)
	}
	if err := er.End(); err != nil {
		t.Fatal(err)
	}
	// Replace the report file with a non-empty directory at the same path so
	// Delete's os.Remove reliably fails without relying on permissions.
	if err := os.Remove(er.Filepath()); err != nil {
		t.Fatal(err)
	}
	makeNonEmptyDir(t, er.Filepath())

	err := er.Delete()
	if err == nil {
		t.Fatal("expected removing an occupied path to fail")
	}
	if got := KindOf(err); got != KindUnresolved {
		t.Fatalf("KindOf(Delete() error) = %v, want KindUnresolved", got)
	}
}

func TestErrorReportDeleteDisabledIsNoop(t *testing.T) {
	er := NewErrorReport("input.csv", t.TempDir(), false)
	if err := er.Push("ERROR AT LINE 1: bad row"); err != nil {
		t.Fatal(err)
	}
	if err := er.Delete(); err != nil {
		t.Fatalf("Delete() on a disabled report should always be a no-op, got %v", err)
	}
}

func TestErrorReportFilepathJoinsPathAndFilename(t *testing.T) {
	dir := t.TempDir()
	er := NewErrorReport("input.csv", dir, true)
	if want := filepath.Join(dir, "input.csv.error.txt"); er.Filepath() != want {
		t.Fatalf("Filepath() = %q, want %q", er.Filepath(), want)
	}
}
