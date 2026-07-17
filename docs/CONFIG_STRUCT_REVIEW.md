# Config Struct Review — `LineConfig` & `OutputConfig`

Review of the two public configuration structs in the Go port:

- `LineConfig` — `go/line/options.go:19`
- `OutputConfig` — `go/writer/writer.go:27`

Scope: identify redundant options, dead fields, and improvements. Every claim
below was verified against the Go code and, where parity matters, against the
TypeScript original in `typescript/src`.

---

## 1. Summary

| Struct | Field | Verdict | Why |
| --- | --- | --- | --- |
| `LineConfig` | `Columns` | **Keep** | Drives parsing (`lineDataToJSON`) and output order fallback. |
| `LineConfig` | `MandatoryFields` | **Keep** | Consumed by `Validate` → `ValidateLine`. |
| `LineConfig` | `IdentifierMappings` | **Keep** | Feeds `Identifiers()` → `result.metadata`. |
| `LineConfig` | `OutputMappings` | **Keep** | Feeds `Output()` projection. |
| `LineConfig` | `Separator` | **Keep** | Input split separator; distinct from the output separator. |
| `LineConfig` | `WithHeader` | **Keep** | Drives `IsHeader()` / header-row skipping. |
| `OutputConfig` | `Type` | **Keep** (note naming) | Factory switch; json tag `fileGenerator` diverges from field name. |
| `OutputConfig` | `Path` | **Keep** | Output directory, defaulted to OS temp dir. |
| `OutputConfig` | `Filename` | **Fixed** (merged) | Now the single, always-templated field — see §3.1. |
| `OutputConfig` | `FilenameTemplate` | **Fixed** (removed) | Was a strict superset of `Filename`; struct field removed, wire key still accepted — see §3.1. |
| `OutputConfig` | `Separator` | **Fixed** (documented) | Ignored when `Template` is set; precedence is now documented — see §3.2. |
| `OutputConfig` | `Header` | **Keep** | Written once on first push; `[func ...]` templated. |
| `OutputConfig` | `Footer` | **Keep** | Written raw (documented parity quirk). |
| `OutputConfig` | `Template` | **Keep** (document) | Mutually exclusive with `Separator`-joined projection. |
| `OutputConfig` | `UniqueKey` | **Keep** | Legitimate TS parity — see §3.3. |
| `OutputConfig` | `Metadata` | **Fixed** (widened) | Accepts arbitrary JSON values and nested template paths — see §3.4. |
| `SourceLine` (related) | `Separator` | **Fixed** (`0658b82`) | Was written, never read — removed. See §2.2. |
| `SourceLine` (related) | `Columns` | **Fixed** (`0658b82`) | Duplicated `Opts.Columns` — removed. See §2.2. |

Net: no `LineConfig` option is redundant; the real redundancies are the
`Filename`/`FilenameTemplate` pair in `OutputConfig` and the (since fixed)
duplicated fields inside `SourceLine`.

---

## FIXES

Findings from this review that have been resolved. Append new rows as
further recommendations from §4 are implemented.

| Finding | Status | Commit | Notes |
| --- | --- | --- | --- |
| §2.2 — `SourceLine` duplicated `Separator`/`Columns` from `Opts` | ✅ Fixed | `0658b82` | Both fields removed from the struct; `Output()` now reads `sl.Opts.Columns`. `Opts` is the single source of truth. |
| §3.1 — `Filename`/`FilenameTemplate` redundant pair | ✅ Fixed | *(uncommitted)* | Merged into one always-templated `Filename`. `OutputConfig.UnmarshalJSON` accepts all three wire shapes (flat string, TS `{"template"}` object, legacy `filenameTemplate` key — legacy key keeps its old precedence when both are set). Covered by `go/writer/writer_test.go`. |
| §3.2 — `Template`/`Separator` silent mutual exclusion | ✅ Fixed | *(uncommitted)* | The `OutputConfig` doc comment now states that `Template` takes precedence and `Separator` is ignored when both are set. |
| §3.3 — `uniqueKey` documentation contradiction | ✅ Fixed | *(uncommitted)* | `MIGRATION_PROCESS.md` now defers only the `PushIfExist`/`FileIndexGenerator` variants and `indexFile`, while explicitly noting that the default writer supports in-memory `uniqueKey` deduplication. |
| §3.4 — metadata typing and dead CLI field | ✅ Fixed | *(uncommitted)* | `OutputConfig.Metadata` now accepts arbitrary JSON values; template paths traverse nested objects and arrays. The unused top-level CLI metadata field was removed; `output.metadata` is canonical. |

---

## 2. `LineConfig` (`go/line/options.go`)

```go
type LineConfig struct {
	Columns            []string  `json:"columns"`
	MandatoryFields    []string  `json:"mandatoryFields"`
	IdentifierMappings []Mapping `json:"identifierMappings"`
	OutputMappings     []Mapping `json:"outputMappings"`
	Separator          string    `json:"separator"`
	WithHeader         bool      `json:"withHeader"`
}
```

### 2.1 All six fields are load-bearing

Every field has exactly one consumer and no overlap:

- `Separator`, `Columns` — parsing, `line.New` (`sourceline.go:20-36`)
- `MandatoryFields` — `Validate()` (`sourceline.go:50`)
- `WithHeader` — `IsHeader()` (`sourceline.go:65`)
- `OutputMappings` — `Output()` (`sourceline.go:70`)
- `IdentifierMappings` — `Identifiers()` (`sourceline.go:89`)

Nothing to omit from the struct itself. The two `Separator` fields across
`LineConfig` and `OutputConfig` are **not** redundant with each other — one
splits input, the other joins output (and they legitimately differ in the
samples: `","` in, `";"` out).

### 2.2 The actual redundancy: `SourceLine` duplicates its own options — ✅ FIXED

> **Status: fixed in `0658b82`** ("remove Columns and Separator in Sourceline").
> The struct (`sourceline.go:6-12`) is now `Line, JSONLine, Opts,
> CurrentLineNumber, Errors`, and `Output()` (`sourceline.go:66`) reads
> `sl.Opts.Columns`. Original finding kept below for the record.

As originally reviewed, the struct stored `Separator` and `Columns` as
top-level fields *and* the whole `Opts LineConfig`:

```go
type SourceLine struct {
	Line              []string
	Separator         string     // ← duplicate of Opts.Separator, never read
	Columns           []string   // ← duplicate of Opts.Columns
	JSONLine          map[string]string
	Opts              LineConfig
	...
}
```

- **`SourceLine.Separator`** was assigned in `New` and never read anywhere in
  the package or its callers. Dead field.
- **`SourceLine.Columns`** was assigned in `New` and read only once, in
  `Output()`, always identical to `sl.Opts.Columns`.

The fix removed two of the three copies of the same data and made `Opts` the
single source of truth, matching how every other option (`MandatoryFields`,
`WithHeader`, mappings) was already accessed.

### 2.3 Improvement (optional, breaks strict parity)

When `WithHeader: true`, the header row already names the columns, yet
`columns` must still be spelled out in config (see the 16-entry list in
`samples/csv-to-csv/config.default.json`). Deriving `Columns` from line 1 when
`WithHeader` is set and `Columns` is empty would shrink configs considerably —
but it is a behavior change relative to the TS original (which also requires
explicit columns), so it is flagged here rather than recommended for the
parity-focused port.

---

## 3. `OutputConfig` (`go/writer/writer.go`)

As originally reviewed (`FilenameTemplate` has since been removed — see §3.1):

```go
type OutputConfig struct {
	Type             string            `json:"fileGenerator"`
	Path             string            `json:"path"`
	Filename         string            `json:"filename"`
	FilenameTemplate string            `json:"filenameTemplate"`
	Separator        string            `json:"separator"`
	Header           string            `json:"header"`
	Footer           string            `json:"footer"`
	Template         string            `json:"template"`
	UniqueKey        string            `json:"uniqueKey"`
	Metadata         map[string]string `json:"metadata"`
}
```

### 3.1 `Filename` vs `FilenameTemplate` — the redundant pair (main finding) — ✅ FIXED

> **Status: fixed.** `FilenameTemplate` was removed from the struct;
> `Filename` is now always rendered through both template layers, and
> `OutputConfig.UnmarshalJSON` accepts the flat string, the TS
> `{"template": "..."}` object form, and the legacy `filenameTemplate` key
> (legacy precedence preserved when both are set) — so the sample below now
> parses too. Original finding kept below for the record.

The TS original has **one** polymorphic option: `filename: string | { template: string }`.
The Go port split it into two fields, with `FilenameTemplate` taking precedence
(`default.go:125-134`).

`FilenameTemplate` is a strict superset of `Filename`:

- `template.ReplaceWithMap` only rewrites `{word}` tokens (`template/field.go:8`);
- `template.ReplaceWithFunction` only rewrites `[...]` tokens (`template/function.go:11`);
- a plain filename like `item_master.csv` contains neither, so rendering it
  through the template pipeline is a byte-for-byte no-op.

**Recommendation:** collapse to a single `Filename string` that is always
rendered through the two template layers. Existing configs with a literal
`"filename"` keep working unchanged; only configs using the Go-only
`"filenameTemplate"` key need a one-word rename. (Edge case: a literal
filename containing `{word}` or `[...]` would be rewritten — no such config
exists in this repo, and those characters are pathological in filenames
anyway.)

**Related breakage found while verifying:** the sample
`go/samples/csv-to-csv/config.with-template.json:29-31` uses the TS object
form:

```json
"filename": { "template": "stoksmart_soh_[return ...].json" }
```

This does **not** unmarshal into the current `Filename string` — the whole
config load fails with a JSON type error. Either the sample must be migrated
to the Go shape, or `OutputConfig` needs a custom `UnmarshalJSON` that accepts
the TS object form. (That sample also uses `fileGenerator: "json-generator"`,
which the factory rejects, so the file appears to be an aspirational TS
carry-over rather than a working Go sample — worth marking it as such.)

### 3.2 `Separator` vs `Template` — silent mutual exclusion — ✅ FIXED

> **Status: fixed.** The `OutputConfig` doc comment now documents the existing
> precedence rule: when `Template` is set, it selects template row-building
> mode and `Separator` is ignored.

In `buildRow` (`default.go:147-156`), when `Template` is set the row is
rendered from the template and `Separator` is **silently ignored**; the
projection + separator path only runs when `Template` is empty. Both samples
set both keys, which reads as if both apply.

Not a field to omit (each mode needs its option). The exclusivity is now
stated on the struct doc comment as well as in `usage.md` §4.3. `Factory`
continues accepting both fields for compatibility; the documented precedence
removes the ambiguity without rejecting existing configurations.

### 3.3 `UniqueKey` — keep; fix the doc contradiction — ✅ FIXED

> **Status: fixed.** `docs/MIGRATION_PROCESS.md` now distinguishes the deferred
> `PushIfExist`/`FileIndexGenerator` variants and `indexFile` support from
> in-memory `uniqueKey` deduplication, which the default writer already supports.

Verified against TS: `uniqueKey` de-duplication is part of
`typescript/src/file-generator/default-generator.ts:56-68` itself, not only of
the `PushIfExist`/`FileIndexGenerator` variants. So `UniqueKey` in the Go
`DefaultWriter` (`default.go:173-185`) is correct parity, **not** scope creep.

Before the fix, `docs/MIGRATION_PROCESS.md:97` listed “dedup variants +
`uniqueKey`” as not ported, while `docs/usage.md` §4.3 documented `uniqueKey`
as working. The migration tracker now states that the *writer variants* and
`indexFile` are not ported, while in-memory `uniqueKey` dedup in the default
writer is supported.

### 3.4 `Metadata map[string]string` — typing is narrower than TS — ✅ FIXED

> **Status: fixed.** `OutputConfig.Metadata` is now `map[string]any`, matching
> the TS writer's arbitrary JSON object. The unused top-level `metadata` field
> was removed from the CLI config struct; writer metadata belongs under
> `output.metadata`.

There are two distinct kinds of metadata in this project:

- **Writer input metadata** (`output.metadata`) is supplied by configuration
  and exposed to filename, header, and row function templates under
  `data.metadata`.
- **Result metadata** (`result.metadata`) is produced by the ETL run from the
  first valid row merged with `identifierMappings`. It is not sourced from
  `output.metadata`, and this change does not alter its type or merge rules.

Writer metadata accepts JSON strings, numbers, booleans, nulls, nested
objects, and arrays. Template arguments use dot paths through objects and
numeric path segments through arrays. For example:

```json
{
  "output": {
    "metadata": {
      "store": {"code": "DXB-01"},
      "regions": [{"name": "Middle East"}],
      "active": true
    },
    "template": "[replaceString data.metadata.store.code - _]"
  }
}
```

`data.metadata.store.code` resolves to `DXB-01`,
`data.metadata.regions.0.name` resolves to `Middle East`, and scalar numbers
and booleans are converted to their string representations before being
passed to a supported template function. Missing paths, invalid array
indexes, null values, and paths ending at an object or array remain unresolved,
so the original literal argument (for example `data.metadata.missing`) is
passed through. Containers are traversable but are not implicitly serialized
into template arguments.

The previous `cmd.configData.Metadata` field accepted a top-level `metadata`
key but `buildETLConfig` never used it. Removing that field eliminates the dead
Go surface without adding a second metadata location or silently merging it
into `output.metadata`. The broader duplicate run-config shapes described in
§3.6 remain a separate open recommendation.

### 3.5 `Type` / `fileGenerator` naming mismatch

The Go field is `Type` but the wire key is `fileGenerator`. Acceptable for
wire parity with TS configs, but the mismatch is invisible at call sites that
construct `OutputConfig` literals in Go. A doc comment on the field naming the
wire key (or renaming the field to `Generator`) would remove the surprise. No
wire change recommended.

### 3.6 Two JSON shapes for one run config

`cmd/main.go` defines its own `configData` (`line` + `output` + `metadata` at
top level), while the canonical `etl.Config` (`etl/run.go:9-16`) is
`source` + `output` + `options{line, rejectOnInvalidRow}`. The samples use the
cmd shape (and `config.with-template.json` wraps everything in yet a third
`{"config": {...}}` envelope). Since `run.go`'s stated design goal is “the
single JSON-serializable request that drives a run”, `cmd/main.go` should
unmarshal straight into `etl.Config` and the samples should converge on that
one shape.

### 3.7 Minor: unreachable header branch in the writer

`buildRow` special-cases `sl.IsHeader()` (`default.go:158-160`), but the ETL
orchestrator never pushes header rows (`etl.go:106` filters
`IsValid() && !IsHeader()`), so the branch is unreachable through the Go
pipeline. Harmless parity carry-over; worth a comment or removal if `Push` is
ever exposed as a public API for non-ETL callers.

---

## 4. Recommended changes

Ordered by value. Completed recommendations are marked below and recorded in
the FIXES table.

1. ~~**Merge `Filename`/`FilenameTemplate`** into one always-templated
   `Filename` field (§3.1); decide whether to add `UnmarshalJSON` for the TS
   object form.~~ ✅ Done (with `UnmarshalJSON` compat) — see FIXES.
2. **Fix or quarantine `config.with-template.json`** — its TS filename object
   now unmarshals, but it still names an unsupported generator (§3.1).
3. ~~**Remove `SourceLine.Separator` and `SourceLine.Columns`**, reading through
   `Opts` (§2.2).~~ ✅ Done in `0658b82` — see FIXES.
4. ~~**Remove the dead top-level CLI `metadata` field** and make
   `output.metadata` canonical (§3.4).~~ ✅ Done. The broader run-config shape
   unification remains open under §3.6.
5. ~~**Document mutual exclusivity** of `Template` vs `Separator` on the struct
   (§3.2).~~ ✅ Done — the `OutputConfig` doc comment states that `Template`
   takes precedence and `Separator` is ignored.
6. ~~**Correct `MIGRATION_PROCESS.md:97`** re: `uniqueKey` (§3.3).~~ ✅ Done —
   the deferred list now separates unsupported writer variants and `indexFile`
   from supported default-writer `uniqueKey` deduplication.
7. **Unify the run-config JSON shape**: make `cmd/main.go` unmarshal
   `etl.Config` directly and converge the samples on that shape (§3.6).
