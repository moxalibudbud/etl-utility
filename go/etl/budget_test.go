package etl

import (
	"context"
	"testing"
	"time"

	"flatfile-go/writer"
)

func TestBudgetFromEnvDefault(t *testing.T) {
	t.Setenv(EnvJobCeiling, "")
	t.Setenv(EnvJobNoLimit, "")

	b, err := BudgetFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if b.Unlimited {
		t.Fatalf("Unlimited = true, want false")
	}
	if b.Ceiling != DefaultCeiling {
		t.Fatalf("Ceiling = %s, want %s", b.Ceiling, DefaultCeiling)
	}
}

func TestBudgetFromEnvOverrides(t *testing.T) {
	t.Setenv(EnvJobCeiling, "9m")
	t.Setenv(EnvJobNoLimit, "")

	b, err := BudgetFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if b.Ceiling != 9*time.Minute {
		t.Fatalf("Ceiling = %s, want 9m", b.Ceiling)
	}

	t.Setenv(EnvJobNoLimit, "true")
	b, err = BudgetFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	if !b.Unlimited {
		t.Fatalf("Unlimited = false, want true")
	}
}

// A malformed budget must fail loud with a permanent error, never fall back to
// a default duration: a silent fallback recreates the host-kill-mid-cleanup
// failure the budget exists to prevent.
func TestBudgetFromEnvRejectsMalformedValues(t *testing.T) {
	cases := []struct {
		name    string
		ceiling string
		noLimit string
	}{
		{"bad ceiling", "15mm", ""},
		{"bad bool", "15m", "yesplease"},
		{"ceiling below reserve", "45s", ""}, // <= cleanup+margin (1m)
		{"ceiling equals reserve", "1m", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(EnvJobCeiling, tc.ceiling)
			t.Setenv(EnvJobNoLimit, tc.noLimit)

			_, err := BudgetFromEnv()
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if got := writer.KindOf(err); got != writer.KindPermanent {
				t.Fatalf("KindOf = %v, want KindPermanent", got)
			}
		})
	}
}

// The work window is ceiling minus the reserved cleanup+margin; the cleanup
// window ends one safety margin before the ceiling, so it sits a full
// cleanupBudget after the work deadline.
func TestBudgetDeadlinesMath(t *testing.T) {
	b := Budget{Ceiling: 10 * time.Minute}
	before := time.Now()
	work, cleanup, cancel := b.Deadlines(context.Background())
	defer cancel()
	after := time.Now()

	workDL, ok := work.Deadline()
	if !ok {
		t.Fatal("work has no deadline")
	}
	cleanupDL, ok := cleanup.Deadline()
	if !ok {
		t.Fatal("cleanup has no deadline")
	}

	// work ≈ start + (ceiling - reservedTime); allow for elapsed test time.
	wantWork := before.Add(b.Ceiling - reservedTime)
	if workDL.Before(wantWork) || workDL.After(after.Add(b.Ceiling-reservedTime)) {
		t.Fatalf("work deadline = %s, want ≈ %s", workDL, wantWork)
	}

	if diff := cleanupDL.Sub(workDL); diff != cleanupBudget {
		t.Fatalf("cleanup deadline is %s after work, want %s", diff, cleanupBudget)
	}
}

// The cleanup context must NOT inherit the work/base cancellation: when the
// base (host) context is cancelled, work is done but cleanup still has its own
// reserved budget to run.
func TestBudgetCleanupSurvivesBaseCancel(t *testing.T) {
	base, cancelBase := context.WithCancel(context.Background())
	b := Budget{Ceiling: 10 * time.Minute}
	work, cleanup, cancel := b.Deadlines(base)
	defer cancel()

	cancelBase()

	if work.Err() == nil {
		t.Fatal("work should be cancelled when base is cancelled")
	}
	if cleanup.Err() != nil {
		t.Fatalf("cleanup should survive base cancel, got %v", cleanup.Err())
	}
}

func TestBudgetUnlimitedHasNoDeadlines(t *testing.T) {
	base, cancelBase := context.WithCancel(context.Background())
	b := Budget{Unlimited: true}
	work, cleanup, cancel := b.Deadlines(base)
	defer cancel()

	if _, ok := work.Deadline(); ok {
		t.Fatal("unlimited work should have no deadline")
	}
	if _, ok := cleanup.Deadline(); ok {
		t.Fatal("unlimited cleanup should have no deadline")
	}

	// Even unlimited keeps cleanup detached from base cancellation.
	cancelBase()
	if cleanup.Err() != nil {
		t.Fatalf("unlimited cleanup should survive base cancel, got %v", cleanup.Err())
	}
}
