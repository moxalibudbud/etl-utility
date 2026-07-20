package writer

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
)

func TestKindOfDefaultsUnannotatedErrorToPermanent(t *testing.T) {
	if got := KindOf(errors.New("boom")); got != KindPermanent {
		t.Fatalf("KindOf(plain error) = %v, want KindPermanent (unknown must not be assumed retryable)", got)
	}
}

func TestKindOfReadsExplicitAnnotation(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want ErrorKind
	}{
		{"permanent", Permanent("op", "loc", errors.New("x")), KindPermanent},
		{"transient", Transient("op", "loc", errors.New("x")), KindTransient},
		{"unresolved", Unresolved("op", "loc", errors.New("x")), KindUnresolved},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := KindOf(tt.err); got != tt.want {
				t.Fatalf("KindOf() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestKindOfJoinedErrorsEscalateToWorstSeverity(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want ErrorKind
	}{
		{
			"permanent+transient escalates to transient",
			errors.Join(Permanent("a", "", errors.New("x")), Transient("b", "", errors.New("y"))),
			KindTransient,
		},
		{
			"transient+unresolved escalates to unresolved",
			errors.Join(Transient("a", "", errors.New("x")), Unresolved("b", "", errors.New("y"))),
			KindUnresolved,
		},
		{
			"permanent+unresolved escalates to unresolved",
			errors.Join(Permanent("a", "", errors.New("x")), Unresolved("b", "", errors.New("y"))),
			KindUnresolved,
		},
		{
			"unannotated member defaults to permanent and does not hide a real unresolved",
			errors.Join(errors.New("plain"), Unresolved("b", "", errors.New("y"))),
			KindUnresolved,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := KindOf(tt.err); got != tt.want {
				t.Fatalf("KindOf() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsRetryableOnlyTrueForTransient(t *testing.T) {
	if !IsRetryable(Transient("op", "", errors.New("x"))) {
		t.Error("Transient should be retryable")
	}
	if IsRetryable(Permanent("op", "", errors.New("x"))) {
		t.Error("Permanent must not be retryable")
	}
	if IsRetryable(Unresolved("op", "", errors.New("x"))) {
		t.Error("Unresolved must not be retryable unattended, even though it is not Permanent")
	}
}

func TestTagPreservesSelfDescribingMessageWithoutStuttering(t *testing.T) {
	inner := fmt.Errorf("render JSON row at source line 42: %w; rendered value: {\"SKU\":\"ABC\",}", errors.New("invalid character '}' after object key"))
	tagged := Tag(KindPermanent, inner)

	if !errors.Is(tagged, inner) {
		t.Fatal("Tag must preserve the original error in the chain")
	}
	got := tagged.Error()
	want := inner.Error() + " [permanent]"
	if got != want {
		t.Fatalf("Tag().Error() = %q, want %q (no extra op/location text)", got, want)
	}
}

func TestTagNilReturnsNil(t *testing.T) {
	if err := Tag(KindPermanent, nil); err != nil {
		t.Fatalf("Tag(kind, nil) = %v, want nil", err)
	}
}

func TestPermanentTransientUnresolvedNilReturnsNil(t *testing.T) {
	if err := Permanent("op", "loc", nil); err != nil {
		t.Fatalf("Permanent(_, _, nil) = %v, want nil", err)
	}
	if err := Transient("op", "loc", nil); err != nil {
		t.Fatalf("Transient(_, _, nil) = %v, want nil", err)
	}
	if err := Unresolved("op", "loc", nil); err != nil {
		t.Fatalf("Unresolved(_, _, nil) = %v, want nil", err)
	}
	if err := Classify("op", "loc", nil); err != nil {
		t.Fatalf("Classify(_, _, nil) = %v, want nil", err)
	}
}

func TestErrorUnwrapExposesCause(t *testing.T) {
	cause := errors.New("root cause")
	wrapped := Permanent("op", "loc", cause)
	if !errors.Is(wrapped, cause) {
		t.Fatal("errors.Is should see through the annotation to the original cause")
	}
}

func TestClassifyContextDeadlineAndCancelAreTransient(t *testing.T) {
	if got := KindOf(Classify("op", "loc", context.DeadlineExceeded)); got != KindTransient {
		t.Fatalf("deadline exceeded classified as %v, want KindTransient", got)
	}
	if got := KindOf(Classify("op", "loc", context.Canceled)); got != KindTransient {
		t.Fatalf("context canceled classified as %v, want KindTransient", got)
	}
}

func TestClassifyAzureResponseErrorByStatusCode(t *testing.T) {
	tests := []struct {
		status int
		want   ErrorKind
	}{
		{429, KindTransient},
		{500, KindTransient},
		{503, KindTransient},
		{400, KindPermanent},
		{403, KindPermanent},
		{404, KindPermanent},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("status_%d", tt.status), func(t *testing.T) {
			err := &azcore.ResponseError{StatusCode: tt.status}
			if got := KindOf(Classify("upload", "https://x", err)); got != tt.want {
				t.Fatalf("status %d classified as %v, want %v", tt.status, got, tt.want)
			}
		})
	}
}

func TestClassifyBlobErrorCodes(t *testing.T) {
	tests := []struct {
		code bloberror.Code
		want ErrorKind
	}{
		{bloberror.ServerBusy, KindTransient},
		{bloberror.InternalError, KindTransient},
		{bloberror.OperationTimedOut, KindTransient},
		{bloberror.AuthenticationFailed, KindPermanent},
		{bloberror.AuthorizationFailure, KindPermanent},
		{bloberror.ContainerNotFound, KindPermanent},
	}
	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			err := &azcore.ResponseError{ErrorCode: string(tt.code)}
			if got := KindOf(Classify("upload", "https://x", err)); got != tt.want {
				t.Fatalf("code %s classified as %v, want %v", tt.code, got, tt.want)
			}
		})
	}
}

func TestErrorKindStringValues(t *testing.T) {
	tests := map[ErrorKind]string{
		KindPermanent:  "permanent",
		KindTransient:  "transient",
		KindUnresolved: "unresolved",
	}
	for kind, want := range tests {
		if got := kind.String(); got != want {
			t.Fatalf("%v.String() = %q, want %q", kind, got, want)
		}
	}
}
