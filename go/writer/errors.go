package writer

import (
	"context"
	"errors"
	"fmt"
	"net"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
)

// ErrorKind classifies a failure by the action the caller should take. The
// pipeline is designed to run as a serverless worker invocation, where the
// process is frozen or destroyed shortly after Process returns: the handler
// gets exactly one chance to route the failure, and it cannot rely on
// string-matching an opaque error to do it.
//
// The three kinds map one-to-one onto the only three decisions a handler
// actually makes.
type ErrorKind int

const (
	// KindPermanent means retrying the same input produces the same failure:
	// invalid configuration, an unrenderable template, a malformed row, or a
	// rejected request (auth, missing container, bad name). Route to a
	// dead-letter queue; do not burn retries.
	KindPermanent ErrorKind = iota

	// KindTransient means the operation could plausibly succeed on a retry:
	// throttling, a 5xx, a reset connection, a deadline. No output was
	// committed, so a retry is safe. Route to a retry with backoff.
	KindTransient

	// KindUnresolved means the run failed *and* the writer could not guarantee
	// it left the destination clean — a commit whose outcome is unknown, or a
	// cleanup delete that itself failed. A blind retry risks a duplicate or
	// half-replaced document, so route to reconciliation/alerting instead.
	//
	// This is the kind that only exists because cleanup can fail. It is
	// deliberately distinct from KindTransient: both are "not permanent", but
	// only one of them is safe to retry unattended.
	KindUnresolved
)

func (k ErrorKind) String() string {
	switch k {
	case KindTransient:
		return "transient"
	case KindUnresolved:
		return "unresolved"
	default:
		return "permanent"
	}
}

// Error is a writer failure annotated with routing information. Op and
// Location are carried because a handler resolving a KindUnresolved failure
// needs to know *what* to reconcile, not just that something went wrong.
type Error struct {
	Kind     ErrorKind
	Op       string // the operation that failed, e.g. "close output"
	Location string // destination path or blob URL, when known
	Err      error
}

func (e *Error) Error() string {
	msg := e.Op
	if e.Location != "" {
		if msg != "" {
			msg += " "
		}
		msg += e.Location
	}
	switch {
	case e.Err == nil && msg == "":
		return e.Kind.String()
	case e.Err == nil:
		return fmt.Sprintf("%s [%s]", msg, e.Kind)
	case msg == "":
		return fmt.Sprintf("%v [%s]", e.Err, e.Kind)
	default:
		return fmt.Sprintf("%s: %v [%s]", msg, e.Err, e.Kind)
	}
}

func (e *Error) Unwrap() error { return e.Err }

// Permanent annotates err as non-retryable. A nil err returns nil so call
// sites can wrap unconditionally.
func Permanent(op, location string, err error) error {
	return newError(KindPermanent, op, location, err)
}

// Transient annotates err as safely retryable.
func Transient(op, location string, err error) error {
	return newError(KindTransient, op, location, err)
}

// Unresolved annotates err as leaving the destination in an unknown state.
func Unresolved(op, location string, err error) error {
	return newError(KindUnresolved, op, location, err)
}

// Tag annotates err with kind without adding operation/location text. Use it
// for errors that already fully describe themselves — for example a JSON
// render error that embeds its own source line number and a preview of the
// rendered value — where wrapping with a second Op would stutter rather than
// add information. A nil err returns nil.
func Tag(kind ErrorKind, err error) error {
	if err == nil {
		return nil
	}
	return &Error{Kind: kind, Err: err}
}

// Classify annotates err with a kind inferred from its cause, used on paths
// (uploads, deletes) where retryability depends on what the remote returned
// rather than on the call site.
func Classify(op, location string, err error) error {
	if err == nil {
		return nil
	}
	return newError(classify(err), op, location, err)
}

func newError(kind ErrorKind, op, location string, err error) error {
	if err == nil {
		return nil
	}
	return &Error{Kind: kind, Op: op, Location: location, Err: err}
}

// KindOf reports how err should be routed. Errors that carry no explicit kind
// are classified from their cause, and anything unrecognized is reported as
// KindPermanent: an unknown failure is not proven safe to retry, and silently
// retrying it is the worse of the two mistakes.
//
// When err joins several failures (as ETL cleanup does), the most severe kind
// wins, ordered Unresolved > Transient > Permanent — a run that both failed
// and could not clean up needs reconciliation regardless of why it failed.
func KindOf(err error) ErrorKind {
	if err == nil {
		return KindPermanent
	}

	var worst ErrorKind
	var found bool

	var we *Error
	if errors.As(err, &we) {
		worst, found = we.Kind, true
	}

	// errors.As stops at the first match, so a joined error needs an explicit
	// walk to see every branch.
	if joined, ok := err.(interface{ Unwrap() []error }); ok {
		for _, sub := range joined.Unwrap() {
			k := KindOf(sub)
			if !found || severity(k) > severity(worst) {
				worst, found = k, true
			}
		}
	}

	if found {
		return worst
	}
	return classify(err)
}

func severity(k ErrorKind) int {
	switch k {
	case KindUnresolved:
		return 2
	case KindTransient:
		return 1
	default:
		return 0
	}
}

// IsRetryable reports whether err is safe to retry unattended. Only
// KindTransient qualifies: KindUnresolved is explicitly excluded because the
// destination state is unknown.
func IsRetryable(err error) bool { return KindOf(err) == KindTransient }

// classify infers a kind from an unannotated cause, primarily Azure SDK
// errors and network failures.
func classify(err error) ErrorKind {
	if err == nil {
		return KindPermanent
	}

	// A deadline or cancellation means the work was cut short, not rejected.
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return KindTransient
	}

	if bloberror.HasCode(err,
		bloberror.ServerBusy,
		bloberror.InternalError,
		bloberror.OperationTimedOut,
	) {
		return KindTransient
	}

	// Blob states that a retry cannot change.
	if bloberror.HasCode(err,
		bloberror.AuthenticationFailed,
		bloberror.AuthorizationFailure,
		bloberror.ContainerNotFound,
		bloberror.InvalidResourceName,
		bloberror.InsufficientAccountPermissions,
	) {
		return KindPermanent
	}

	var respErr *azcore.ResponseError
	if errors.As(err, &respErr) {
		switch respErr.StatusCode {
		case 408, 429, 500, 502, 503, 504:
			return KindTransient
		default:
			return KindPermanent
		}
	}

	// Timeouts and temporary network faults are worth another attempt;
	// anything else (DNS misconfiguration, refused connection) is treated as
	// permanent so a broken deployment fails fast instead of retrying.
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return KindTransient
	}

	return KindPermanent
}
