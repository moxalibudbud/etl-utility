# Config Builder UI — Improvement Plan

## Goal

Give people a web application that builds an ETL `Config` through a form and a
couple of file uploads, instead of hand-writing the JSON. The tool should let
someone:

1. upload a sample **source** file and have the form fill in how that file is
   read (its separator, its columns, whether it has a header row);
2. fill in the **source** and **output** destinations through form fields; and
3. optionally upload a sample **output** file so the tool can read back the
   fields it contains and pre-build the mapping for the user to complete.

The output of the tool is the same `Config` JSON the core already runs — no new
runtime behavior, just a friendlier way to produce a correct request.

```text
Sample source file ─┐
Form fields ────────┼──► Config Builder UI ──► valid Config JSON
Sample output file ─┘                              │
                                                   └─► (unchanged) etl.RunContext
```

## Why this is worth doing

The `Config` is described in the code as "the single JSON-serializable request
that drives a run" ([go/etl/run.go](../go/etl/run.go)). Everything funnels
through it — the CLI, the worker, the cloud function. That is a strength for the
engine and a burden for whoever authors the request by hand:

- The config decoder rejects unknown keys, so a single typo (`seperator`,
  `columns` vs `column`) fails the whole run rather than being ignored.
- Field mappings are **order-sensitive** — the order you list them is the order
  the output columns come out — which is easy to get wrong in raw JSON and hard
  to see once it is wrong.
- Several fields are conditional: a local source needs `path`, a cloud source
  needs `url` and `auth`, and mixing them is an error caught only when the run
  starts.
- Getting the source columns right means opening the sample file in another
  tool, counting fields, and copying names across by hand.

The business impact is simple: today only someone comfortable with the JSON
shape can set up a job, and mistakes surface as failed runs rather than as
feedback while authoring. A form that reads a sample file and validates as you
go turns config authoring from a developer task into something an analyst or
operator can do, and catches the mistakes before a job is ever submitted.

## What a Config actually contains

Grounding the UI in the real shape matters, because the form is only useful if
it maps cleanly onto these three parts. From
[go/etl/run.go](../go/etl/run.go), [go/reader/sourceconfig.go](../go/reader/sourceconfig.go),
[go/writer/writer.go](../go/writer/writer.go), and
[go/line/options.go](../go/line/options.go):

| Part | Field | What it holds | How the UI fills it |
|---|---|---|---|
| **Source** | `source` | Where to read from: `{type, path}` local, or `{type, url, auth}` Azure blob | Form fields; type toggles which fields show |
| **Output** | `output` | Where to write + how to format: destination (`type`/`path`/`url`/`auth`), `fileGenerator`, `filename`, `separator`/`template`, `header`/`footer`, `arrayField`, `metadata` | Form fields, plus sample-output inference for the format |
| **Options** | `options.line` | How to parse each source row: `columns`, `separator`, `withHeader`, `mandatoryFields`, `outputMappings`, `identifierMappings` | **Sample-source upload fills most of this** |
| **Options** | `options.rejectOnInvalidRow` | Whether one bad row fails the whole result | Single toggle |

The mapping rows (`outputMappings`, `identifierMappings`) are the heart of the
tool. Each is an ordered `{out, src}` pair where `src` is a source column name,
a literal default value, or a `[func ...]` template. This is exactly the part
that is tedious and error-prone by hand, and exactly the part a sample file can
scaffold.

## User experience, step by step

### Step 1 — Upload a sample source file

The user drops in a representative source file. The backend reads only the first
handful of lines and infers:

- **the separator** — by testing the usual candidates (`;`, `,`, tab, `|`) and
  picking the one that yields a consistent column count across the sample rows;
- **whether there is a header row** — by checking whether the first line looks
  like names rather than data;
- **the columns** — taken from the header row when present, or generated as
  positional names (`col1`, `col2`, …) for the user to rename.

The form's `options.line` section is populated from this, and the user sees a
small table preview of the parsed sample so they can confirm the guess was
right. Inference is a **starting point the user confirms**, never a silent
decision.

### Step 2 — Fill in source and output through the form

The user picks the source destination (local path, or Azure blob URL) and the
output destination and format. Conditional fields appear based on the choices —
choosing "Azure blob" reveals the URL and credential fields; choosing the JSON
generator reveals `arrayField` and hides the delimited-only fields like
`separator` and `footer`. The form enforces the same rules the engine enforces
(for example, "a local source must not carry `auth`"), so an invalid
combination cannot be submitted.

### Step 3 — (Optional) Upload a sample output file to scaffold the mapping

This is the highest-value and trickiest step, so it is worth being precise about
what it can and cannot do:

- **For delimited output**, a sample gives the tool the list of output column
  names. The UI pre-creates one mapping row per output field with the `out` key
  filled in, and the user chooses each `src` — a source column (offered as a
  dropdown of the columns found in Step 1), a literal default, or a function
  template. The tool supplies the *destination shape*; the user supplies the
  *mapping decisions*.
- **For JSON output**, a sample document reveals the row object's fields and the
  surrounding structure. The UI can scaffold the row `template` with
  `{placeholder}` slots and pre-fill `arrayField` from where the array sits in
  the sample.

The honest limit: a sample output file shows the tool **what the result looks
like**, not **how each value is derived**. Defaults, function templates, and
which source column feeds which output field are decisions only the user can
make. The tool's job is to remove the transcription work and present those
decisions as a filled-in form, not to guess business logic.

## What can be inferred, and what always needs a human

Being clear about this boundary keeps the tool honest and sets expectations:

| Inferred from a sample (a confirmable guess) | Always a human decision |
|---|---|
| Source separator | Which source column maps to which output field |
| Header row present or not | Literal default values for missing data |
| Source column names / count | `[func ...]` template logic |
| Output field names and JSON structure | Mandatory fields and reject-on-invalid policy |
| A preview of parsed rows | Credentials and destination URLs |

## Proposed architecture

Two pieces: a dedicated backend that does the file inspection and validation,
and a single-page app that hosts the form.

### Backend — a separate, small HTTP service

The config-builder gets its **own** HTTP server, kept separate from the existing
`POST /etl` runner in [go/cmd/http](../go/cmd/http). The authoring tool and the
production execution endpoint have different jobs, different security surfaces,
and different lifecycles, so they should not share a server. The new service
(for example `go/cmd/configui`) reuses the core packages — `reader`, `writer`,
`line`, `internal/configjson` — so the validation the user sees while authoring
is byte-for-byte the same validation the engine applies at run time.

It is **stateless** and holds nothing between requests. Uploaded samples are
read in memory, inspected, and discarded — never written to disk — because a
sample source file may contain real, sensitive data.

Suggested endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/infer/source` | Take an uploaded sample, return the inferred `options.line` (separator, header, columns) plus a small parsed preview. |
| `POST /api/infer/output` | Take an uploaded sample output, return the field list / JSON structure to scaffold the mapping. |
| `POST /api/validate` | Take a candidate `Config`, run it through `configjson.Decode` and the `Validate()` methods, and return structured field-level errors. |
| `POST /api/preview` | Optional: run the engine against the **uploaded sample only**, into an in-memory output, and return the first N rows of the result so the user sees what the config produces. |
| `GET /api/health` | Liveness. |

### Frontend — a plain single-page app

Stack, as specified: **Vite + React Router (SPA) + TypeScript**, with
**shadcn/ui + Tailwind**. A plain SPA is the right call and needs no
justification beyond the use case: this is an interactive internal tool with no
public content, so server-side rendering, SEO, and server data caching would add
machinery for problems this tool does not have. The SPA calls the backend's JSON
endpoints and does all its work client-side.

Suggested shape:

- a stepper/wizard mirroring the three steps above, backed by React Router
  routes so each step is linkable and the browser back button behaves;
- a single form model for the whole `Config`, validated live against the
  backend's `/api/validate`;
- a mapping editor with drag-to-reorder rows, because mapping order is
  significant;
- a "download config.json" action and, if `/api/preview` is built, a live
  output preview panel.

## Key risks and the decisions they force

A useful plan names the sharp edges up front.

**Keeping the form in sync with the Go structs.** The single biggest long-term
risk is drift: the Go `Config` changes, the TypeScript form does not, and the
tool starts producing configs the engine rejects. The decoder's strict
"unknown keys are errors" behavior makes this worse, not better. The mitigation
is to make the Go side the one source of truth — emit a JSON Schema (or generate
TypeScript types) from the Go structs, and add a contract test that fails the
build when the form's shape and the engine's shape diverge. This should be
designed in from the start, not retrofitted.

**Secrets do not belong in the built config.** Azure credentials — account keys,
connection strings, SAS tokens — are secret material. The tool must never store
them and should steer users toward a config that carries a placeholder or relies
on managed identity, with the real secret supplied at deploy or run time. This
matches the guidance already in the source and output improvement plans, which
say credentials should not normally live in the ETL JSON.

**Mapping order is load-bearing.** The mapping list order determines output
column order. The mapping editor must preserve order and let the user reorder
deliberately, and the JSON it emits must keep that order.

**A live preview must never touch production storage.** The `/api/preview`
endpoint is compelling — showing the actual output a config would produce is the
best possible validation — but it must be fenced to the uploaded sample and an
in-memory output sink. It must not connect to a real Azure destination or read a
real cloud source, so that authoring a config can never have a side effect on
live data.

**Emit the canonical wire form.** The config has legacy shapes (a source as a
bare string, a filename as an object). The tool should always produce the modern
object form so the output is unambiguous.

## Validation of the plan

The idea is sound and well-matched to the codebase. The reasons it fits:

- The `Config` is already a clean, self-contained, JSON-serializable request
  with explicit `Validate()` methods and a strict decoder. A form-builder is a
  natural front end for exactly this kind of object, and the backend can reuse
  the real validation instead of reimplementing it.
- The most valuable feature — inferring parsing rules from a sample source file
  — is deterministic, offline, and low-risk. It delivers most of the benefit on
  its own.
- The stack choice (plain SPA) is appropriate for an internal interactive tool.

The parts to treat with care are the sample-output inference (which scaffolds
shape but cannot infer mapping logic — the UI must present it that way) and
schema drift between the form and the Go structs (which needs a generated schema
and a contract test to stay honest). Neither is a reason not to build it; both
are reasons to build those specific pieces deliberately.

**Verdict: proceed.** Recommended order is to build the sample-source inference
and validation first, since they carry the most value for the least risk, and
add sample-output scaffolding and live preview once the core loop is proven.

## Current implementation status

A frontend-only prototype exists at `frontend/src/pages/ConfigBuilder.tsx`
(`/config-builder` route), alongside the pre-existing GoGlatFile Portal app. Full
detail lives in `frontend/FRONTEND-DEV-LAST-SESSION-SUMMARY.md`; the short
version:

- **Built**: Source and Output tabs that read a sample file client-side (no
  backend inference — this all runs in the browser) and fill in
  `options.line` / `output`, including a `template` editor for delimited
  output (one field per header column, inserting `{sourceColumn}`,
  `{metadata.key}`, or `[func ...]` tokens via a searchable combobox); a
  Summary tab composing the live `Config` from both tabs' state (not the
  hand-written mock this doc's earlier drafts assumed); a single save action
  that currently only logs the assembled `Config` to the console.
- **Deliberately narrower than this plan for now**: `source`/`output` only
  author `type` (`local` / `azure-blob`) — `path`, `url`, and `auth` are left
  for a runtime/deploy step to fill in, not authored in the browser. No
  `outputMappings` editor. No sample-output scaffolding for the JSON
  generator (delimited-only so far).
- **Not started**: everything in Phase 1 (no `cmd/configui`, no
  `/api/infer`, `/api/validate`, `/api/preview`, no generated schema/contract
  test). Without `/api/validate`, the frontend does not yet enforce the Go
  `Validate()` rules (e.g. rejecting `auth` on a local source). No
  persistence of any kind.

## Implementation phases

### Phase 1 — Backend inference and validation service

- Stand up the separate `cmd/configui` HTTP server reusing the core packages.
- Implement `/api/infer/source` (separator, header, column detection + preview).
- Implement `/api/validate` over `configjson.Decode` + the `Validate()` methods,
  returning field-level errors.
- Emit a JSON Schema (or generated TS types) from the Go structs, with a
  contract test guarding against drift.

### Phase 2 — SPA form for the full Config

- Vite + React Router + TypeScript + shadcn/ui + Tailwind scaffold.
- The three-step wizard, conditional fields, and the order-preserving mapping
  editor.
- Live validation against `/api/validate` and a "download config.json" action.

### Phase 3 — Sample-output scaffolding

- Implement `/api/infer/output` for delimited and JSON samples.
- Wire the mapping editor to pre-fill `out` keys and offer source columns as
  `src` options.

### Phase 4 — Live preview (optional, high value)

- Implement `/api/preview` fenced to the uploaded sample and an in-memory sink.
- Add the preview panel to the SPA.

## Testing strategy

- **Inference:** table tests over sample files with different separators,
  with/without headers, ragged rows, quoted fields, and empty input — asserting
  the detected `options.line`.
- **Validation parity:** the same invalid configs the engine rejects must be
  rejected by `/api/validate` with a clear field-level message.
- **Schema-drift contract test:** fails when the Go `Config` shape and the
  emitted schema diverge.
- **Frontend:** component tests for the mapping editor's order preservation and
  the conditional-field rules; an end-to-end test that uploads a sample, fills
  the form, and downloads a config the backend then accepts.
- **Preview safety:** a test proving `/api/preview` cannot reach a network
  destination.

## Open questions

- Should the tool also **submit** a finished config to the existing `POST /etl`
  runner, or only produce the JSON for the user to deploy themselves? (Affects
  whether the two services need to know about each other at all.)
- Should saved configs be persisted (named, versioned, reloadable), or is the
  tool strictly a stateless authoring aid that hands back a file? Persistence
  would add a store and change the backend from stateless to stateful.
- How are Azure credentials handled at authoring time — placeholder only, or a
  "test connection" affordance that would require handling a real secret in the
  browser session?
