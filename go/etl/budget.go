package etl

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"flatfile-go/writer"
)

// Environment variables that configure the job time budget. They are read at
// the process edge (the cmd/* entrypoints) via BudgetFromEnv, never inside the
// pure core: etl.Config stays a self-contained, JSON-serializable request.
const (
	// EnvJobCeiling is the host's execution ceiling as a Go duration
	// (for example "15m", "600s", "9m30s"). Set it to your platform's real
	// limit — AWS Lambda 15m, Azure Functions Consumption 10m, GCF gen1 9m —
	// so cleanup always finishes before the platform's hard kill.
	EnvJobCeiling = "ETL_JOB_CEILING"

	// EnvJobNoLimit, when truthy, removes all deadlines. Intended for
	// long-running hosts (a VM or container) that do not kill the process.
	// It overrides EnvJobCeiling. On such a host a stalled upload or download
	// blocks until an operator intervenes — that protection is deliberately
	// given up, so do not enable this on a serverless platform.
	EnvJobNoLimit = "ETL_JOB_NO_LIMIT"
)

// Time budget constants. The ceiling is carved into three parts:
//
//	worker  = ceiling - cleanupBudget - safetyMargin   (the derived work window)
//	cleanup = cleanupBudget                            (close + delete after work stops)
//	margin  = safetyMargin                             (slack before the host's hard kill)
//
// See docs/go-json-generator-design.md §9 (Phase 3). cleanupBudget and
// safetyMargin are intentionally internal constants, not env-tunable: a caller
// knows their host's ceiling but has no reason to tune how long our cleanup
// takes, and exposing it only invites setting it to zero and breaking the
// guarantee.
const (
	DefaultCeiling = 15 * time.Minute // assumed serverless ceiling (AWS Lambda)
	cleanupBudget  = 30 * time.Second
	safetyMargin   = 30 * time.Second
	reservedTime   = cleanupBudget + safetyMargin // held back from the work window
)

// Budget is the resolved time budget for one run. It is produced at the edge
// (BudgetFromEnv) and passed into RunContext, which turns it into the work and
// cleanup contexts.
type Budget struct {
	Unlimited bool          // no deadlines at all (long-running host)
	Ceiling   time.Duration // host execution ceiling; ignored when Unlimited
}

// DefaultBudget is the budget used by the convenience Run wrapper: the assumed
// serverless ceiling with no override.
func DefaultBudget() Budget { return Budget{Ceiling: DefaultCeiling} }

// BudgetFromEnv resolves the budget from EnvJobNoLimit and EnvJobCeiling,
// falling back to DefaultBudget. Unlike the cosmetic output.options toggles
// (which fall back to their default on a bad value), a malformed or unusable
// time budget fails loud with a permanent configuration error: silently
// falling back to a different duration than the operator intended would
// recreate the exact host-kill-mid-cleanup failure this feature prevents.
func BudgetFromEnv() (Budget, error) {
	b := DefaultBudget()

	if v, ok := os.LookupEnv(EnvJobNoLimit); ok && v != "" {
		unlimited, err := strconv.ParseBool(v)
		if err != nil {
			return Budget{}, badBudget(fmt.Errorf("%s=%q is not a boolean (true/false): %w", EnvJobNoLimit, v, err))
		}
		b.Unlimited = unlimited
	}

	if v, ok := os.LookupEnv(EnvJobCeiling); ok && v != "" {
		ceiling, err := time.ParseDuration(v)
		if err != nil {
			return Budget{}, badBudget(fmt.Errorf(`%s=%q is not a duration (e.g. "15m"): %w`, EnvJobCeiling, v, err))
		}
		b.Ceiling = ceiling
	}

	if err := b.validate(); err != nil {
		return Budget{}, err
	}
	return b, nil
}

// validate rejects a ceiling that cannot fund the reserved cleanup + margin,
// which would derive a non-positive work window.
func (b Budget) validate() error {
	if b.Unlimited {
		return nil
	}
	if b.Ceiling <= reservedTime {
		return badBudget(fmt.Errorf(
			"%s (%s) must exceed the %s reserved for cleanup and safety margin",
			EnvJobCeiling, b.Ceiling, reservedTime))
	}
	return nil
}

// Deadlines derives the work and cleanup contexts from base. The work context
// bounds reading, rendering, and uploading. The cleanup context is deliberately
// NOT a child of the work context (context.WithoutCancel): when work hits its
// deadline, cleanup must still have its own reserved budget to close and delete
// the destination — cancelling cleanup at the moment work times out would fail
// exactly when cleanup is needed most. Callers must defer the returned cancel.
func (b Budget) Deadlines(base context.Context) (work, cleanup context.Context, cancel func()) {
	if b.Unlimited {
		// No deadlines. Cleanup is still detached so a cancelled base context
		// (an operator's Ctrl-C) does not abort cleanup mid-flight.
		return base, context.WithoutCancel(base), func() {}
	}

	start := time.Now()
	work, cancelWork := context.WithDeadline(base, start.Add(b.Ceiling-reservedTime))
	cleanup, cancelCleanup := context.WithDeadline(
		context.WithoutCancel(base), start.Add(b.Ceiling-safetyMargin))
	return work, cleanup, func() {
		cancelWork()
		cancelCleanup()
	}
}

func badBudget(err error) error {
	return writer.Permanent("configure job budget", "", err)
}
