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
| `OutputConfig` | `Filename` | **Merge** | Redundant with `FilenameTemplate` — see §3.1. |
| `OutputConfig` | `FilenameTemplate` | **Merge** | Strict superset of `Filename` — see §3.1. |
| `OutputConfig` | `Separator` | **Keep** (document) | Silently ignored when `Template` is set — see §3.2. |
| `OutputConfig` | `Header` | **Keep** | Written once on first push; `[func ...]` templated. |
| `OutputConfig` | `Footer` | **Keep** | Written raw (documented parity quirk). |
| `OutputConfig` | `Template` | **Keep** (document) | Mutually exclusive with `Separator`-joined projection. |
| `OutputConfig` | `UniqueKey` | **Keep** | Legitimate TS parity — see §3.3. |
| `OutputConfig` | `Metadata` | **Keep** (note typing) | Narrower than the TS `any` metadata — see §3.4. |
| `SourceLine` (related) | `Separator` | **Remove** | Written, never read — dead field. See §2.2. |
| `SourceLine` (related) | `Columns` | **Remove** | Duplicates `Opts.Columns`. See §2.2. |

Net: no `LineConfig` option is redundant; the real redundancies are the
`Filename`/`FilenameTemplate` pair in `OutputConfig` and the duplicated
fields inside `SourceLine`.

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

### 2.2 The actual redundancy: `SourceLine` duplicates its own options

`go/line/sourceline.go:6-14`:

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

- **`SourceLine.Separator`** is assigned in `New` (`sourceline.go:31`) and never
  read anywhere in the package or its callers. Dead field — remove.
- **`SourceLine.Columns`** is assigned in `New` and read only once, in
  `Output()` (`sourceline.go:70`). It is always identical to `sl.Opts.Columns`.
  Remove and read through `sl.Opts.Columns`, matching how every other option
  (`MandatoryFields`, `WithHeader`, mappings) is already accessed.

This removes two of the three copies of the same data and makes `Opts` the
single source of truth.

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

### 3.1 `Filename` vs `FilenameTemplate` — the redundant pair (main finding)

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

### 3.2 `Separator` vs `Template` — silent mutual exclusion

In `buildRow` (`default.go:147-156`), when `Template` is set the row is
rendered from the template and `Separator` is **silently ignored**; the
projection + separator path only runs when `Template` is empty. Both samples
set both keys, which reads as if both apply.

Not a field to omit (each mode needs its option), but the exclusivity should
be stated on the struct doc comment, and `Factory` could cheaply reject or log
a config that sets `Template` together with a non-default `Separator`
expectation. `usage.md` §4.3 documents the precedence; the struct itself does
not.

### 3.3 `UniqueKey` — keep; fix the doc contradiction

Verified against TS: `uniqueKey` de-duplication is part of
`typescript/src/file-generator/default-generator.ts:56-68` itself, not only of
the `PushIfExist`/`FileIndexGenerator` variants. So `UniqueKey` in the Go
`DefaultWriter` (`default.go:173-185`) is correct parity, **not** scope creep.

However `docs/MIGRATION_PROCESS.md:97` lists “dedup variants + `uniqueKey`” as
not ported, while `docs/usage.md` §4.3 documents `uniqueKey` as working. The
MIGRATION_PROCESS line should be reworded: the *writer variants* are not
ported; in-memory `uniqueKey` dedup in the default writer is.

### 3.4 `Metadata map[string]string` — typing is narrower than TS

TS metadata is an arbitrary object; templates resolve dot-paths into it
(`[return \`${args.metadata.store}_...\`]` in the with-template sample, and
`data.metadata.<key>` per `usage.md` §4.3). The Go `map[string]string`
supports flat string values only, and `resolvePath` in
`template/function.go` can already walk `map[string]any`. If nested metadata
is ever needed, widen to `map[string]any`; until then the flat map is fine —
flagged so the limitation is a decision, not an accident.

Separately, `cmd/main.go:35-39` parses a **top-level** `"metadata"` key into
`configData.Metadata` and then drops it on the floor (`buildETLConfig` never
copies it anywhere; `RejectOnInvalidRow` carries a `// TODO: parse from
metadata`). Dead config surface — either wire it into
`OutputConfig.Metadata`/`Options` or delete the field.

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

## 4. Recommended changes (not applied — review only)

Ordered by value:

1. **Merge `Filename`/`FilenameTemplate`** into one always-templated
   `Filename` field (§3.1); decide whether to add `UnmarshalJSON` for the TS
   object form.
2. **Fix or quarantine `config.with-template.json`** — today it neither
   unmarshals nor names a supported generator (§3.1).
3. **Remove `SourceLine.Separator` and `SourceLine.Columns`**, reading through
   `Opts` (§2.2).
4. **Unify the config JSON shape**: make `cmd/main.go` unmarshal `etl.Config`
   directly; delete the dead top-level `metadata` or wire it through (§3.4, §3.6).
5. **Document mutual exclusivity** of `Template` vs `Separator` on the struct
   (§3.2).
6. **Correct `MIGRATION_PROCESS.md:97`** re: `uniqueKey` (§3.3).
