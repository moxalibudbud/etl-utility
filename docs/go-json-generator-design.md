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

### `output.options` — optional writer behavior

Some settings change *how the writer behaves* rather than *what the output file
looks like*. Those live together in one `options` object, so we can add new
switches later without asking every existing integration to change its
configuration.

```go
Options map[string]any `json:"options,omitempty"`
```

Settings are read with `OutputConfig.BoolOption(name, default)`. If a setting is
missing, or someone sends the wrong kind of value for it, the writer quietly
uses the default instead of failing. A typo in an optional setting should never
take down an otherwise valid job.

| Option | Default | What it does |
|---|---|---|
| `errorReport` | `false` | Writes a `<source>.error.txt` file listing the rows that failed validation. |

Note that `output.options` is a different thing from the top-level `options`
that holds the line-parsing rules. Both can appear in the same configuration:

```json
{"output": {"options": {"errorReport": true}}, "options": {"line": {}}}
```

#### Why the error report is off by default

This utility is built to run in short-lived cloud functions. Each run gets a
small scratch folder for temporary files, and that folder is often reused by
the next job on the same machine. Files left behind pile up until unrelated
jobs start failing for no obvious reason.

So the report is only written when someone asks for it. If a team collects and
reads the report, they turn it on. If nobody collects it, no file is created
and there is nothing to clean up.

Turning the report off only suppresses the *file*. Failed rows are still
counted, so the error count in the result and the `rejectOnInvalidRow` behavior
are exactly the same either way. When the report is off, the result reports an
empty path rather than pointing at a file that was never written — so callers
can simply check for an empty path before trying to read it.

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

### Telling the caller what to do about a failure

When a job fails, the system that started it has to make one decision: try
again, give up, or ask a human to look. Getting that decision wrong is
expensive. Retrying something that can never succeed wastes time and money on
every attempt. Giving up on a temporary network hiccup fails a job that would
have worked seconds later.

The utility runs in short-lived cloud functions, which makes this harder: the
job is shut down almost immediately after it reports back, so there is exactly
one chance to make the call, and no opportunity to investigate afterwards.

To support that, every failure is labeled with one of three kinds
(`writer.ErrorKind` in `errors.go`):

| Label | What happened | What the caller should do |
|---|---|---|
| **Permanent** | Something about the request is wrong — bad configuration, a broken template, a malformed row. Trying again changes nothing. | Stop and report it. Don't retry. |
| **Temporary** | Something temporary got in the way — the service was busy, a connection dropped, a time limit was hit. No output was produced. | Retry, after a short wait. |
| **Needs attention** | The job failed, **and** the utility could not confirm it cleaned up after itself. | Have someone check the destination before retrying. |

*(In the code these are `KindPermanent`, `KindTransient` and `KindUnresolved`.)*

That third kind is the important one, and it exists because cleanup can fail
too. It is deliberately kept separate from "temporary": both mean "not
hopeless", but only one is safe to retry automatically. If a job wrote a file
and then failed to remove it, retrying blindly can leave a second copy
alongside the first — so a person, or a reconciliation job, should look before
anything runs again.

Callers read the label with `writer.KindOf(err)`, or `writer.IsRetryable(err)`
for the common yes/no case. When several things go wrong at once, the most
serious label wins, so a job that both failed *and* could not clean up is
always reported as needing attention.

Anything the utility does not recognize is reported as permanent. That is the
deliberately cautious choice: an unfamiliar failure has not been shown to be
safe to retry, and quietly retrying it is the more damaging mistake.

Two rules decide which label a failure gets:

- **When opening the destination fails**, the label depends on the cause.
  Nothing has been written yet, so the only question is whether trying again
  could help.
- **When finishing or removing the destination fails**, the label depends on
  *what was left behind*, not on what went wrong. This is what the caller
  actually needs to know. If the half-written file was successfully removed,
  the job is back to a clean slate and can be retried. If it could not be
  removed, the job needs attention. Writers that append directly to the final
  file cannot undo their work, so a failure there always needs attention.

Configuration problems — an unsupported destination, an unusable combination of
settings, a missing filename — are always permanent. They are caught before
anything is written, purely from the shape of the request.

### Cleanup always runs to the end

When a job fails, the utility closes its files, closes the source, and removes
anything it created. Every one of those steps now runs even if an earlier one
failed, and all the problems are reported together.

This used to stop at the first problem, which meant a failure while closing the
output skipped the removal entirely — leaving the file behind in exactly the
situation cleanup exists to handle. In a cloud function there is no second
chance: the machine is shut down moments later, so whatever was not removed
during the run is left behind for good. That means a stray file in shared
temporary storage, or an unwanted document sitting in cloud storage where
another system may pick it up.

For the same reason, if closing the output fails, the output is now always
removed — even when the job otherwise looked successful. Output that could not
be finished properly should never be left where something else might treat it
as complete.

Cleanup problems are reported alongside the original failure instead of being
thrown away. So if a job fails *and* cannot tidy up after itself, the caller is
told the run needs attention rather than being handed a failure that looks
routinely retryable.

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

### Phase 2.5 — making failures actionable

**Status: complete.** Groundwork for Phase 3, prompted by the decision to run
this in short-lived cloud functions.

- [x] Label every failure as permanent, temporary, or needing attention, so the
  system that started the job knows whether to retry (§8). Includes recognising
  the common cloud-storage responses — service busy, server errors, permission
  refused, timeouts — and mapping them to the right label.
- [x] Make cleanup run every step instead of stopping at the first problem, and
  always remove output that could not be finished properly (§8).
- [x] Apply the labels across the existing code: opening, finishing and
  removing destinations, error-report writing, configuration checks, and
  filename problems.
- [x] Add `output.options`, with the error report turned off by default (§4).
- [x] Fix a bug where a failed attempt to remove an uploaded file was recorded
  as if it had succeeded, so a retry silently did nothing and the unwanted file
  stayed in cloud storage.

**Known gap.** A few failures are not labeled individually yet: problems while
building a row's JSON, and problems writing to the destination partway through.
These currently fall back to the cautious "permanent" default. For the usual
cause — a bad template or bad data — that is the right answer. For the rarer
case of the destination failing mid-write, a retry might actually have worked,
so those jobs will be reported as unretryable when they did not have to be.
Worth closing, but it errs on the safe side.

### Phase 3 — writing JSON to cloud storage

The key question for cloud output is: **can anyone see a half-written file?**
If a job uploads 40,000 rows and fails at row 30,000, a system reading that
folder must never pick up the incomplete document and treat it as real data.

**Decision: rely on how cloud uploads already work.** Azure sends the file in
chunks and only makes it visible once the last chunk arrives and the upload is
confirmed. Until that moment the file simply does not exist for anyone reading
the folder — and if a file of the same name was already there, readers keep
seeing the old one until the new version is complete. A failed upload leaves
nothing visible behind.

We considered mirroring what the local writer does: upload to a temporary name,
then rename it once finished. We rejected it. Copying and then deleting are two
separate steps, so a crash between them leaves an abandoned temporary file in
cloud storage — a new problem that does not exist today. It would also mean
storing the data twice during the run and paying for extra operations, all to
protect against something the upload already handles. The local writer needs
its temporary file because writing to disk genuinely exposes data as it goes;
uploads do not have that problem.

Since the protection already exists, the work is mostly about making it
official and proving it stays that way:

- [x] Allow JSON output to cloud destinations.
- [x] Write down that this guarantee comes from how the upload is finalized, so
  anyone changing that code later knows it is load-bearing.
- [x] Add a test proving nothing is readable at the destination until the job
  finishes — the cloud equivalent of a check the local writer already has.
- [x] Add tests for cancelled uploads, successful completion, and deletion.

S3 destination support is tracked in
[`output-file-improvement.md`](output-file-improvement.md) (Phase 3).

**Time limits — done.** Cloud functions are stopped after a fixed time. An
upload used to have no time limit of its own, so a stalled upload could run
until the platform killed the whole job — producing no error anyone could act on
and skipping cleanup entirely. Now every run carves a time budget out of the
host's execution ceiling and threads it, as a `context.Context` work deadline,
through the streaming download (`reader.AzureBlobReader`) and the upload/commit
(`writer.AzureBlobSink`). A stalled upload fails on the work deadline with a
retryable error instead of a silent host kill.

Cleanup deliberately does *not* share that deadline. If it did, the moment a job
ran out of time its cleanup would be cancelled too — failing exactly when it is
needed most. Cleanup runs on an independent context (`context.WithoutCancel`)
with its own budget, reserved up front. The split (`etl.Budget.Deadlines`):

```
worker  = ceiling − cleanupBudget − safetyMargin   (the work window)
cleanup = cleanupBudget (30s)                       (close + delete)
margin  = safetyMargin (30s)                        (slack before the host kill)
```

The ceiling is the single knob, defaulting to 15m (AWS-Lambda-class) and set per
host via `ETL_JOB_CEILING`; `ETL_JOB_NO_LIMIT=true` removes all deadlines for a
long-running VM. It is read at the process edge (the `cmd/*` entrypoints) via
`etl.BudgetFromEnv`, keeping `etl.Config` a pure request. A malformed budget
fails loud as `KindPermanent` rather than falling back to a default. On Lambda
the invocation context is the base, so the platform's own remaining-time
deadline composes with the ceiling (whichever is shorter wins). Covered by
`budget_test.go`; see usage.md §7.1 for the operator-facing reference.

- [x] Bound the streaming download and the upload/commit with the job's work
  deadline; keep cleanup on an independent reserved budget.
- [x] Read the budget from `ETL_JOB_CEILING` / `ETL_JOB_NO_LIMIT` at the
  entrypoints; validate loud; default to 15m.

**JSON output to cloud destinations — done.** `json-generator` is now registered
for `azure-blob` in the writer factory. `newJSONWriterWithSink` separates
validation from sink construction so both local and blob paths share the same
core; `JSONWriter.SetDeadlineContexts` satisfies `DeadlineAware` by forwarding
to the underlying `AzureBlobSink`. Covered by `blobwriter_test.go`:
`TestJSONBlobWriterNothingVisibleUntilEnd` (atomicity), `TestJSONBlobWriterSuccessfulCompletion`,
`TestJSONBlobWriterDeleteAbortsUnfinishedUpload`, and `TestJSONBlobWriterFactoryRegistration`.

- [x] Register `json-generator` for `azure-blob` in the writer factory.
- [x] Prove nothing is readable at the destination until the job finishes.
- [x] Tests for cancelled uploads, successful completion, and deletion.

**Still open:** S3 destination support — tracked in
[`output-file-improvement.md`](output-file-improvement.md) Phase 3.

**A cost note for whoever owns the storage account.** When an upload is
abandoned partway, the chunks already sent are not visible as a file, but Azure
keeps them for about a week and bills for them. One failed job is negligible.
Thousands of failed jobs a month is a line item nobody can see, because nothing
appears in the folder to explain the charge. This is fixed with a storage
retention rule that clears abandoned uploads automatically — a configuration
change on the storage account, not something this codebase can do.

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

### Destination tests

Covered in `local_sink_test.go` and `blobwriter_test.go`. These check that a
failure is reported with the label that matches what was actually left behind:

- A failure while finishing a file is reported as retryable when the
  half-written file was successfully removed
- The same failure is escalated to "needs attention" when that file could
  *not* be removed
- Writers that append directly to the final file always report "needs
  attention", since their work cannot be undone
- Failing to remove a file that is confirmed to exist always reports "needs
  attention"
- Failures while opening a destination are labeled by cause; a missing
  filename is permanent
- Upload failures are labeled from what cloud storage returned — service busy
  is retryable, permission refused is permanent
- A failed attempt to remove an uploaded file leaves it marked as still
  present, so a retry genuinely tries again

Failures are simulated in ways that behave the same on every machine, rather
than by manipulating file permissions, which behave differently depending on
which user runs the tests.

### Failure-labeling tests

Covered in `errors_test.go`: labels survive a round trip; when several failures
happen together the most serious label wins; unlabeled failures fall back to
permanent; the "needs attention" label is correctly excluded from automatic
retries; and the common cloud-storage and timeout responses map to the labels
described in §8.

### Error report tests

Covered in `errorreport_test.go` and `etl_test.go`: with the report turned off,
failed rows are still counted but no file is written and no path is reported;
with it on, the file is written and then removed when there were no errors; a
failed removal is reported as needing attention; and an unknown or wrongly
typed setting falls back to its default instead of failing the run.

### Cleanup tests

Covered in `etl_test.go`: every cleanup step still runs when an earlier one has
already failed, and all the problems are reported rather than just the first;
output that could not be finished properly is removed even when the run
otherwise looked successful.

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

### Running reliably in the cloud

Because this runs in short-lived cloud functions, a release is also only
acceptable when:

- Every failure tells the caller whether to retry, give up, or get someone to
  look — without anyone having to read the error text to work it out.
- Cleanup finishes on every failure path, and a cleanup that could not remove
  what it created says so instead of reporting success.
- No file is written unless someone asked for it, so nothing quietly builds up
  in temporary storage from one run to the next.
