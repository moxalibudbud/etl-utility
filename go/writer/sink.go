package writer

import "io"

// Sink is the internal, destination-independent contract that format writers
// (delimited, JSON) compose with. It owns wherever bytes physically end up —
// a local file, a blob upload — but has no idea what the bytes mean; that
// stays with the renderer/encoder that calls it. This is the abstraction
// described in the Go JSON generator design doc's "Destination abstraction"
// section: it exists so adding a new output format does not require a new
// writer per destination, and adding a new destination does not require a
// new writer per format.
type Sink interface {
	// Start opens the destination for filename and returns a writer for it.
	// Called once, lazily, on the first accepted row (filename is only known
	// once it has been rendered against that row).
	Start(filename string) (io.Writer, error)

	// Close commits the destination. For a local sink this flushes, syncs,
	// and atomically promotes the buffered output; for a streaming sink it
	// closes the pipe and awaits the background upload's result. Close must
	// be idempotent and safe to call even if Start was never called.
	Close() error

	// Delete removes (local) or aborts/uncommits (blob) the destination. It
	// must be idempotent and safe to call at any point in the lifecycle,
	// including before Start or after a failed or successful Close.
	Delete() error

	// Location reports where filename resolves for this sink — a local path
	// or a blob URL — independent of whether the destination has been
	// created yet.
	Location(filename string) string
}
