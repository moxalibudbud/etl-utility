---
type: concept
title: "Go JSON Generator — Recommended Design"
source: /go-json-generator-design/
path: /go-json-generator-design/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T13:11:38.879Z"
---
# Go JSON Generator — Recommended Design

## 1. Goals

The Go JSON generator should preserve the useful behavior of the TypeScript
`JSONGenerator` while improving its performance, correctness, and
maintainability.

The primary goals are:

- Keep memory usage bounded by streaming rows instead of storing the complete
  output document.
- Keep JSON document construction independent from the output destination.
- Continue using the existing `writer.Writer` contract so `etl.go` does not
  need JSON-specific branches.
- Use Go's `encoding/json` package for JSON validation and encoding instead of
  manually repairing complete JSON strings.
- Preserve the canonical configuration contract and common TypeScript JSON
  templates.
- Retain lazy output creation: no valid source rows means no output file.
- Do not handle row uniqueness in the JSON writer. The JSON writer serializes
  every valid row it receives; deduplication must happen before rows reach it.

The first implementation should support local JSON output. Azure Blob JSON
output and a general destination refactor should follow after the local
implementation is stable.

---

## 2. Problems in the TypeScript implementation

The TypeScript generator should be treated as a behavior reference, not copied
directly.

### Entire document retained in memory

Every row is parsed and stored in `arrayBuckets` until processing completes.
Memory therefore grows with the complete output size.

The Go implementation should stream this structure:

```text
Push(first row):
  write {
  write root fields
  write "Lines":[
  write first row

Push(next row):
  write ,
  write next row

End():
  write ]}
  flush and close
```

This changes memory usage from `O(total output)` to approximately
`O(current row + buffers)`. The JSON writer must not add a deduplication map or
any other row-retention structure.

### Fragile sanitization

The TypeScript implementation combines value sanitization, string
substitution, whole-document sanitization, and `JSON.parse`. These operations
have different responsibilities and can corrupt valid input or fail to escape
values correctly.

Go should render a row, validate it with `encoding/json`, and only then write
the validated JSON value.

### Broken deduplication should not be ported

The TypeScript `push()` method checks `rowReferences` but does not call
`trackReference()` after accepting a row. The Go JSON implementation should not
copy or repair that behavior. Uniqueness is outside the JSON writer boundary.
If a pipeline requires unique rows, it should deduplicate upstream before
calling `Writer.Push()`.

### Confusing lifecycle

TypeScript needs a separate `pushFinalJSON()` step because it builds the
document in memory. Go already has `Writer.End()`, which is the correct place
to close the JSON array/object and finalize the destination.

### Unused path parsing

`parseRootPath()` and `parseArrayPath()` are unused. Version one should not
invent nested-path or multiple-array semantics that the running TypeScript
implementation does not provide.

---

## 3. Recommended architecture

Separate JSON formatting from destination I/O:

```text
ETL
 └─ Writer
     ├─ JSON document encoder
     │   ├─ render root/header
     │   ├─ render and validate rows
     │   ├─ manage document state and commas
     │
     └─ Destination
         ├─ local file
         └─ Azure Blob stream (later)
```

### JSON document encoder

The internal encoder should own JSON-specific state but no filesystem or cloud
logic:

```go
type JSONDocumentEncoder struct {
    opts        JSONConfig
    out         io.Writer
    filename    string
    started     bool
    finalized   bool
    rowsWritten int
}
```

Suggested responsibilities:

```go
func NewJSONDocumentEncoder(opts JSONConfig) *JSONDocumentEncoder
func (e *JSONDocumentEncoder) SetOutput(w io.Writer)
func (e *JSONDocumentEncoder) Start(sl *line.SourceLine) error
func (e *JSONDocumentEncoder) WriteRow(sl *line.SourceLine) error
func (e *JSONDocumentEncoder) Finalize() error
func (e *JSONDocumentEncoder) Filename() string
```

Its explicit lifecycle is:

```text
new → started → finalized
```

`Finalize()` should be idempotent. Writing after finalization should return an
error.

### Existing Writer contract

Do not add the TypeScript-specific `PushFinalJSON()` operation. Implement the
existing contract as follows:

- `Push()` lazily resolves the filename, creates the destination, starts the
  JSON document, and writes one row.
- `PushFooter()` is a no-op because a JSON document has structural
  finalization rather than a raw footer.
- `End()` finalizes the JSON document, flushes buffers, and closes/promotes the
  destination.
- `Delete()` closes and removes any partial or completed output.

This allows the existing ETL orchestrator to use the JSON writer without
changes.

### Destination abstraction

The repository previously had separate local and Azure writers that each
duplicated their own I/O lifecycle alongside a shared text renderer. Adding
every format as another full destination-specific writer would eventually
have created a format-by-destination matrix.

Phase 2 (see §9) introduced the internal destination contract:

```go
type Sink interface {
    Start(filename string) (io.Writer, error)
    Close() error
    Delete() error
    Location(filename string) string
}
```

`LocalSink` (`local_sink.go`) and `AzureBlobSink` (`azure_sink.go`) are the two
implementations. `LocalSink` takes a mode rather than unifying `DefaultWriter`
and `JSONWriter` onto one on-disk behavior: append-in-place for
`DefaultWriter` (no partial file, no atomic promotion — preserving its
original bytes) versus buffered `.partial` + atomic rename for `JSONWriter`
(preserving its original atomic-completion contract from §6). `DefaultWriter`,
`JSONWriter`, and `AzureBlobWriter` now each compose a format
renderer/encoder with a `Sink` and own no filesystem or network logic
directly.

---

## 4. Configuration and validation

Add the existing TypeScript wire option to `writer.OutputConfig`:

```go
ArrayField string `json:"arrayField"`
```

Use `lines` as the default:

```go
const DefaultJSONArrayField = "lines"
```

Internally normalize the generic writer options into a JSON-specific
configuration:

```go
type JSONConfig struct {
    Filename   string
    Root       string
    Row        string
    ArrayField string
    Metadata   map[string]any
}
```

For wire compatibility:

- `output.header` is the root-object template.
- `output.template` is the row template.
- `output.arrayField` identifies the root array property.
- `output.uniqueKey` is not supported by the JSON writer. If it is configured
  with `fileGenerator: "json-generator"`, return a clear configuration error:
  deduplicate before writing JSON.
- `output.footer` has no meaning for JSON and should be rejected when non-empty
  rather than silently ignored.
- `output.separator` is unused by the JSON generator.

### `output.options` — writer behavior toggles

Behavior toggles that are not part of the document format live in a separate
map so new ones can be added without another wire-shape migration:

```go
Options map[string]any `json:"options,omitempty"`
```

Read them with `OutputConfig.BoolOption(name, default)`. A missing key — or a
value of the wrong type — falls back to the default rather than failing the
run, so an unrecognized wire value cannot break an otherwise valid config.

Note this is `output.options`, distinct from the top-level `options` carrying
the line rules:

```json
{"output": {"options": {"errorReport": true}}, "options": {"line": {}}}
```

| Option | Default | Meaning |
|---|---|---|
| `errorReport` | `false` | Write the `<source>.error.txt` report file. |

`errorReport` defaults to **off**. The pipeline targets serverless workers,
where the writable filesystem is a small ephemeral scratch space reused across
warm invocations; a side file nobody collects is a leak, not a feature.

Disabling it suppresses only the *file*. Invalid rows are still counted, so
`Result.TotalErrors`, `Result.WithErrors`, and `rejectOnInvalidRow` behave
identically either way. When disabled, `Result.LocalErrorReportFile` and
`LocalErrorReportFilename` are empty rather than naming a file that was never
written.

Validate static configuration in the factory or constructor:

- `filename` must not be empty.
- `template` must not be empty.
- Empty `arrayField` is normalized to `lines`.
- `arrayField` must be a valid non-empty JSON property name after
  normalization.

Validation that depends on source data occurs on the first row:

- The rendered root must be a JSON object.
- A missing root template means an empty root object, not an error.
- A root object that already contains `arrayField` should be rejected to avoid
  silently overwriting configured data.
- Every rendered row must be one JSON object. Arrays, scalars, and `null`
  should be rejected for parity with the intended line-object model.

---

## 5. JSON rendering and encoding

### Root rendering

On the first accepted row:

1. Resolve the filename through value and function templates.
2. Render `header` using both value replacement and function replacement.
3. Treat an empty header as `{}`.
4. Decode the root into `map[string]json.RawMessage`.
5. Reject an existing `arrayField`.
6. Write root keys in sorted order for deterministic output.
7. Marshal property names with `json.Marshal`.
8. Open the configured array.

Sorting root keys makes golden tests, diffs, hashes, and troubleshooting
reproducible. JSON object property order remains semantically irrelevant.

### Row rendering

For every accepted row:

1. Render the configured row template, or build an object from the configured
   output mapping when no template is provided.
2. Validate that it is exactly one JSON object.
3. Compact it with `json.Compact`.
4. Write a comma only when at least one previous row was written.
5. Write the compact object.

Duplicate source rows are written as duplicate JSON array entries. The writer
does not inspect `uniqueKey`, track references, or skip rows.

Errors should contain the source line number, operation, underlying JSON
error, and a bounded preview of the rendered value:

```text
render JSON row at source line 42: invalid character '}' after object key;
rendered value: {"SKU":"ABC",}
```

The preview must be truncated to avoid logging very large or sensitive input.

### Field escaping

The ordinary text value renderer is insufficient for JSON templates. For
example, a source or metadata value containing a quote can break:

```json
{"SKU":"{SKU}","Store":"{metadata.store.code}"}
```

The JSON writer should use a dedicated JSON-aware field renderer:

- `{path}` placeholders inside JSON strings receive JSON-escaped string
  contents.
- Raw placeholders outside JSON strings are inserted as raw text and must
  produce valid JSON after rendering.
- The complete row is always validated by `encoding/json`.

This preserves common TypeScript templates such as:

```json
{"SKU":"{SKU}","Store":"{metadata.store.code}","Quantity":{Quantity},"Received":true}
```

A future structured template format may provide explicit string, number,
boolean, literal, and function nodes. It should be additive so existing string
templates continue to work.

### No whole-document sanitization

Do not port `sanitizeJsonValue()` or whole-document `sanitizeString()` into the
writer pipeline. JSON escaping belongs in the field renderer and structural
validation belongs to `encoding/json`.

Configured template functions such as `[sanitizeString ...]` remain available
when explicitly requested.

---

## 6. Local output and atomic completion

The local writer should create output lazily on the first valid row.

Write to a temporary sibling file:

```text
<final filename>.partial
```

On successful `End()`:

1. Finalize the JSON structure.
2. Flush the buffered writer.
3. Sync and close the file.
4. Rename the partial file to the final filename.

This prevents consumers from observing a syntactically incomplete JSON
document. The rename remains atomic when the temporary and final files are on
the same filesystem.

`Delete()` should be idempotent and remove both the partial and final path when
present. `End()` should also be safe when no row was ever pushed and must not
create an output file.

If a destination already exists, version one should preserve the repository's
current overwrite/append policy only where it produces a valid complete JSON
document. JSON must never append a second document to an existing file; the
partial file should be newly truncated and the final rename should replace the
previous result according to the platform-supported atomic replacement
behavior.

---

## 7. Streaming performance

Do not introduce row-rendering goroutines in version one. The output order is
significant and buffered sequential output already provides backpressure with
substantially less synchronization and error complexity.

Azure's background upload goroutine remains appropriate because `io.Pipe`
requires a concurrent reader and writer.

Any future deduplication feature should be designed as an upstream
transformation or validation step, not as JSON writer behavior.

---

## 8. Failure behavior

The writer must define cleanup for each failure stage:

| Failure | Required behavior |
|---|---|
| Filename rendering | Do not create a destination |
| Root rendering or validation | Close and delete partial output |
| Row rendering or validation | Abort processing and delete partial output |
| Local write or flush | Close and delete partial output |
| Finalization | Delete partial output |
| ETL invalid after processing | Close safely, then delete output |
| Azure upload | Abort the pipe and return the original upload error |

`End()` and `Delete()` should be idempotent. An error returned during rendering
or writing must retain its original cause via `%w`.

### Error taxonomy

The pipeline runs as a serverless worker invocation: the process is frozen or
destroyed shortly after `Process` returns, so the handler gets exactly one
chance to route a failure and cannot string-match an opaque error to do it.
`writer.ErrorKind` (`errors.go`) classifies failures by the action the caller
should take — the only three decisions a handler actually makes:

| Kind | Meaning | Handler action |
|---|---|---|
| `KindPermanent` | Retrying the same input fails the same way: invalid config, unrenderable template, malformed row, rejected request. | Dead-letter; do not spend retries. |
| `KindTransient` | Could plausibly succeed on retry: throttling, 5xx, reset connection, deadline. Nothing was committed, so a retry is safe. | Retry with backoff. |
| `KindUnresolved` | The run failed *and* the writer could not guarantee it left the destination clean. | Reconcile/alert — **do not retry unattended**. |

`KindUnresolved` exists because cleanup itself can fail. It is deliberately
distinct from `KindTransient`: both are "not permanent", but only one is safe
to retry. A blind retry after an unresolved failure risks a duplicate or
half-replaced document.

Read the kind back with `writer.KindOf(err)`, or `writer.IsRetryable(err)` for
the common case. `KindOf` walks joined errors and returns the worst kind
present (`Unresolved` > `Transient` > `Permanent`), so a run that both failed
and could not clean up escalates correctly regardless of why it failed. An
error carrying no explicit kind is classified from its cause; anything
unrecognized reports `KindPermanent`, because an unknown failure is not proven
safe to retry and silently retrying it is the worse mistake.

Two rules govern where each kind is applied:

- **`Start` failures classify by cause.** Nothing exists yet, so the only
  question is whether a retry could help.
- **`Close`/`Delete` failures classify by what was left behind**, not by cause.
  That is the fact a handler needs. `LocalSink`'s atomic mode reports
  `KindTransient` when the partial file was successfully removed (back to
  "nothing committed") and escalates to `KindUnresolved` when it was not.
  Append mode is always `KindUnresolved` on failure, since it writes in place
  and cannot roll back. A failed `Delete` of a confirmed-existing artifact is
  always `KindUnresolved`.

Static configuration errors (`DestinationConfig.Validate`, the `Factory`
dispatch, the JSON writer's `uniqueKey`/`footer`/`filename` rejections) are
always `KindPermanent`: they fire before any I/O, purely from the shape of the
request.

### Cleanup must not short-circuit

`etl.cleanUp` runs every step — `output.End`, `errorReport.End`,
`reader.Close`, and both deletes — even when an earlier step failed, joining
the failures with `errors.Join`. Returning early on the first failure skipped
the deletes entirely, so a failed `End()` left its artifact behind: exactly the
case cleanup exists for. On a serverless worker there is no later pass to catch
it, so anything not deleted during the invocation is leaked permanently — a
committed blob, or a file occupying the shared ephemeral scratch space.

For the same reason, a failed `output.End()` now forces `output.Delete()`
regardless of how the run was otherwise judged: output that could not be
finalized cleanly must not survive, even on a `force=false`, `valid=true` path.

`Process` joins the cleanup error with the original failure rather than
discarding it, so a cleanup that could not remove the artifact escalates the
whole result to `KindUnresolved`.

---

## 9. Implementation phases

### Phase 1 — local streaming JSON

**Status: functionally complete.** The local streaming path, its failure
handling, and its writer-level tests are done and shipping. Three test-hardening
items remain (listed below); none block Phase 2 or Phase 3.

Completed:

- [x] Add `arrayField` to `OutputConfig`, defaulting to `lines`.
- [x] Implement the destination-independent JSON document encoder.
- [x] Implement the local JSON writer with buffered `.partial` output and
  atomic promotion on `End()`.
- [x] Register `json-generator` for local destinations in `writer.Factory`.
- [x] Reject `uniqueKey` when `fileGenerator` is `json-generator`; duplicate
  valid rows are serialized unchanged.
- [x] Reject unsupported JSON footers.
- [x] Support `{path}` value templates for filenames, root objects, and rows,
  while retaining `[]` for template functions.
- [x] Add initial encoder/writer, factory, template, and ETL coverage.
- [x] Update the migration and usage documentation for local JSON generation.
- [x] Keep JSON-specific behavior out of `etl.go`.
- [x] Correct the promotion test so its post-`End()` assertion checks the
  rendered `products_DXB01.json.partial` path instead of the unrelated
  `products_1005.json.partial` path.
- [x] Complete local-writer coverage: idempotent `End()`, replacement of an
  existing output document, and cleanup for finalization/flush/rename failures
  (`TestJSONWriterEndIsIdempotent`, `TestJSONWriterReplacesExistingOutput`,
  `TestJSONWriterCleanupOnFlushFailure`, `TestJSONWriterCleanupOnRenameFailure`
  in `json_writer_test.go`).
- [x] Run `go test ./...`, `go vet ./...`, and `go build ./...`.

Still pending (deferred, not blocking Phase 2/3):

- [ ] Complete encoder lifecycle and validation coverage: finalize twice,
  write after finalization, non-object root/row values, invalid root JSON, and
  escaping of Unicode and control characters. (No dedicated
  `json_encoder_test.go` exists yet; `jsonDocumentEncoder` is exercised only
  indirectly through `JSONWriter` and ETL tests.)
- [ ] Expand ETL coverage for JSON-specific `rejectOnInvalidRow`,
  empty/all-invalid inputs, value/function templates, and result paths.
- [ ] Add shared TypeScript compatibility fixtures and compare decoded JSON
  values.

No `etl.go` changes were required.

### Phase 2 — destination refactor

**Status: complete.**

- [x] Introduce the `Sink` interface (`sink.go`): `Start(filename) (io.Writer,
  error)`, `Close() error`, `Delete() error`, `Location(filename) string`.
- [x] Extract local destination behavior from `DefaultWriter` and `JSONWriter`
  into `LocalSink` (`local_sink.go`), parameterized by a mode rather than
  unified into one behavior:
  - `NewLocalSink` (append mode) preserves `DefaultWriter`'s original
    open-and-append-in-place bytes, with no partial file and no atomic
    promotion.
  - `NewAtomicLocalSink` (atomic mode) preserves `JSONWriter`'s original
    `.partial` + `Sync` + atomic-rename contract, including cleanup on
    finalize/flush/sync/close/rename failure.
- [x] Extract Azure destination behavior from `AzureBlobWriter` into
  `AzureBlobSink` (`azure_sink.go`): the `io.Pipe` + background
  `UploadStream` goroutine, upload-abort-on-`Delete`, and the blob-client/URL
  helpers (`joinBlobURL`, `splitBlobURL`, `withSASToken`, `hasSASQuery`).
- [x] Convert `DefaultWriter`, `JSONWriter`, and `AzureBlobWriter` to compose
  a format renderer/encoder with a `Sink`; each writer now only owns
  format-specific state (renderer/encoder, `started`/`finalized`/`failed`
  flags) and delegates all I/O lifecycle to its sink.
- [x] Preserve current default-writer bytes using parity tests — the existing
  `TestBlobWriterMatchesDefaultWriterBytes` continues to pass unchanged
  against the refactored `DefaultWriter`/`AzureBlobWriter`, and all local
  JSON writer tests continue to pass unchanged against the refactored
  `JSONWriter`.
- [x] `go build ./...`, `go vet ./...`, `go test ./...`, and
  `go test ./writer/... -race` all pass.

### Phase 2.5 — serverless failure routing

**Status: complete.** Prerequisites for Phase 3, driven by the serverless
deployment target.

- [x] Add the `writer.ErrorKind` taxonomy (`errors.go`) with `KindPermanent` /
  `KindTransient` / `KindUnresolved`, `KindOf`, `IsRetryable`, and
  cause-classification for Azure `ResponseError` status codes, `bloberror`
  codes, context deadline/cancellation, and network timeouts (§8).
- [x] Fix `etl.cleanUp` to run every step and join failures instead of
  short-circuiting before the deletes; force `output.Delete()` when
  `output.End()` failed; join cleanup errors into the returned error in
  `Process` (§8).
- [x] Classify existing error sites: sink `Start`/`Close`/`Delete`, error
  report I/O, static config validation, `Factory` dispatch, and the writers'
  filename/lifecycle rejections.
- [x] Add `output.options` with `errorReport` defaulting to off (§4).
- [x] Fix `AzureBlobSink.Delete` marking the blob un-uploaded *before* the
  removal succeeded, which silently made a retried `Delete()` a no-op.

Known gap: errors from `json_encoder.go` (row/root render) and from mid-stream
writes into the sink's `io.Writer` are not explicitly annotated. They fall back
to `KindOf`'s unknown→`KindPermanent` default, which is right for the common
case (bad template or data) but not provably right for a destination write
failing mid-encode.

### Phase 3 — JSON cloud output

**Blob atomicity model: rely on block-commit (decided).** `UploadStream`
stages blocks and commits them with a single Put Block List. Staged-but-
uncommitted blocks are invisible to readers: if the upload dies partway the
blob never appears, and if it already existed it keeps its previous content
until the commit swaps it atomically.

The rejected alternative was a staging blob (`name.json.partial`) copied to the
final name on success, mirroring `LocalSink`. It buys nothing and costs more:
copy-then-delete is *itself* not atomic, so a crash between the two leaves an
orphan staging blob — a failure mode that does not otherwise exist — plus async
copy for large blobs, doubled transient storage, and extra API calls.
`LocalSink` needs the rename because `os.OpenFile` genuinely exposes bytes as
they are written; blob upload does not have that problem.

Choosing this model is mostly a documentation and test obligation — converting
an accident of the SDK into a stated contract:

- Enable JSON generation through `AzureBlobSink` (`newBlobWriter` accepting
  `json-generator`).
- Document on `AzureBlobSink` that atomicity comes from Put Block List, so a
  future change (swapping the upload call, adding an S3 sink) knows it is
  load-bearing.
- Assert nothing is readable at the destination URL until `Close()` — the blob
  analog of the existing "final file should not exist before End" assertion in
  `TestJSONWriterStreamsAndPromotesLocalFile`.
- Add upload-abort, finalization, and deletion tests.
- Add S3 composition when the S3 destination is implemented.

Remaining prerequisite — **context threading**, not yet done:

- `AzureBlobSink` still uses `context.Background()` for both upload and delete.
  Uploads need the invocation deadline, or a hung upload runs until the
  platform kills the invocation mid-flight with no error routed and no cleanup
  run.
- `Delete` must *not* inherit that context. Threading the request context
  through naively means cleanup is cancelled exactly when it is most needed.
  It needs `context.WithoutCancel(parent)` plus its own short timeout, funded
  from a reserve carved out of the invocation budget up front.

Operational note: aborted uploads leave **uncommitted staged blocks**. They are
invisible (no blob exists, so `Delete` correctly finds nothing) but are billed
and retained ~7 days. At serverless volume with a nonzero failure rate this
accrues silently. Mitigation is a container lifecycle rule to purge uncommitted
blocks — infrastructure, not code.

### Deferred features

- Structured typed JSON templates
- Nested array paths
- Multiple output arrays
- Arbitrary JSON aggregation/grouping

---

## 10. Test plan

### Encoder unit tests

Pending — no dedicated `json_encoder_test.go` exists yet;
`jsonDocumentEncoder` is currently exercised only indirectly through
`JSONWriter` and ETL tests.

- Empty root and default `lines` array
- Rendered root metadata
- Custom `arrayField`
- One and multiple rows
- Correct comma placement
- Deterministic root-key order
- Quotes, backslashes, Unicode, and control characters
- Invalid root and invalid row JSON
- Non-object root and row values
- Root/array-field collision
- Finalize twice
- Write after finalization
- Duplicate source rows are emitted
- `uniqueKey` with JSON output is rejected

### Local writer tests

Covered in `json_writer_test.go`:

- File is created only on the first accepted row
- Filename value/function rendering
- Complete valid document
- Partial file promoted only after successful finalization
- Partial file removed on failure
- `End()` and `Delete()` idempotence
- No rows produces no file
- Existing output is replaced with one complete JSON document, never appended

### Sink tests

Covered in `local_sink_test.go` and `blobwriter_test.go`:

- Atomic-mode `Close` failure is `KindTransient` when the partial file was
  successfully removed
- Atomic-mode `Close` failure escalates to `KindUnresolved` when the partial
  file could not be removed
- Append-mode `Close` failure is always `KindUnresolved` (writes in place,
  cannot roll back)
- `Delete` failure on a confirmed-existing artifact is `KindUnresolved`
- `Start` failures classify by cause; an empty filename is `KindPermanent`
- Blob upload failure is classified from Azure's response (503 transient,
  403 permanent)
- A failed blob `Delete` leaves the blob marked uploaded, so a retry retries
  rather than silently no-opping

Failure paths are simulated portably — closing the file descriptor early, or
occupying a path with a non-empty directory — rather than with permission
tricks, which behave inconsistently under a root test runner.

### Error taxonomy tests

Covered in `errors_test.go`: kind round-tripping, worst-kind escalation across
joined errors, unannotated errors defaulting to `KindPermanent`,
`IsRetryable` excluding `KindUnresolved`, `Tag` preserving self-describing
messages, nil-in/nil-out for every constructor, and cause classification for
Azure status codes, `bloberror` codes, and context deadline/cancellation.

### Error report tests

Covered in `errorreport_test.go` and `etl_test.go`: disabled reports count
invalid rows without writing a file or naming a path; enabled reports write
and are deleted when there are zero errors; a failed delete is
`KindUnresolved`; `BoolOption` falls back to the default on a missing key or
wrong-typed value.

### Cleanup tests

Covered in `etl_test.go`: every cleanup step runs despite earlier failures and
all causes are reachable from the joined error; a failed `End()` forces
`output.Delete()` even when `force=false` and the result is valid.

### ETL end-to-end tests

Covered:

- CSV to JSON
- Source header row skipped
- Invalid source row skipped while valid rows are emitted
- Duplicate valid rows are emitted

Pending:

- JSON-specific `rejectOnInvalidRow`
- Empty and all-invalid input against the JSON generator
- Root and row value/function templates end to end
- Result output paths and filenames

### TypeScript compatibility fixtures

Pending. Create shared fixtures containing an input file, configuration, and
expected semantic JSON. Compare decoded JSON values rather than raw bytes
because formatting and object-property order may differ.

---

## 11. Acceptance criteria

The local Go JSON generator is complete when:

- `fileGenerator: "json-generator"` is accepted for local output.
- Existing common TypeScript header, row-template, filename, metadata,
  and `arrayField` behavior is supported.
- `uniqueKey` is rejected for JSON output with a clear error, and duplicate
  valid rows are emitted unchanged.
- Output is streamed and the complete row collection is never retained in
  memory.
- No JSON-specific logic is added to the ETL orchestrator.
- Special characters in source values cannot create malformed JSON.
- Failed or invalid processing does not leave a final-looking partial document.
- Empty/all-invalid input produces no output file.
- `go test ./...`, `go vet ./...`, and `go build ./...` pass.

### Serverless operability

Because the target deployment is a serverless worker, a run is also only
acceptable when:

- Every failure returned from `Process` carries a `writer.ErrorKind`, so a
  handler can route it without string-matching.
- Cleanup runs to completion on every failure path — no early return skips a
  delete — and a cleanup that could not remove its artifact is reported as
  `KindUnresolved` rather than silently succeeding.
- No output file is written unless explicitly requested, so nothing
  accumulates in the shared ephemeral scratch space across warm invocations.
