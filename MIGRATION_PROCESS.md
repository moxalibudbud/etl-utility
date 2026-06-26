# Migration Process — TypeScript ETL → Go

Tracking log for porting the streaming flat-file ETL pipeline from
[`typescript/`](typescript/) to [`go/`](go/) (module `flatfile-go`, Go 1.26).

**Status:** Core pipeline complete and verified. Cloud/Excel/JSON/dedup writers deferred.

For the architectural rationale, code-review details, and TS→Go type mapping, see
[ETL_CODE_REVIEW_AND_GO_DESIGN.md](ETL_CODE_REVIEW_AND_GO_DESIGN.md).

---

## 1. Code review of `etl.ts` (inputs to the migration)

Findings that shaped the Go design. Several are fixed **by construction** in the port.

| # | Finding | Location | Status in Go |
|---|---|---|---|
| 1 | Footer race — `resolve()` runs before `pushFooter()` | `etl.ts:64-67` | Fixed (footer before "done") |
| 2 | `forceCleanUp()` not awaited in error path | `etl.ts:169` | Fixed (synchronous cleanup) |
| 3 | Lost parse errors re-emitted onto a dead interface | `etl.ts:59-61` | N/A (sequential; errors returned) |
| 5 | `processLines()` reimplements `readlinePromise()` | `etl.ts:97-107` | Fixed (single scan loop) |
| 6 | `cleanUp`/`forceCleanUp` near-duplicates | `etl.ts:109-137` | Fixed (`cleanUp(force)`) |
| 7 | `populate()` double-checks `isValid && !isHeader` | `etl.ts:78-86` | Fixed (one branch) |
| 9 | `lineIndex` is really a 1-based line number | `etl.ts:24,50` | Renamed `lineNo` |
| 10 | No write backpressure | `etl.ts:79` | Free via `bufio.Writer` |

---

## 2. What was migrated

Core pipeline: local file read → line parse/validate → default delimited/template
writer + error report. Module-by-module:

| TS module | Go package | Files |
|---|---|---|
| `src/utils` templating/mapping | `template/` | `field.go`, `function.go`, `sanitize.go` |
| `src/line-data` + line utils | `line/` | `options.go`, `sourceline.go`, `validator.go`, `mapping.go` |
| `src/file-reader` | `reader/` | `reader.go` (interface + factory), `filereader.go` (local) |
| `src/file-generator` | `writer/` | `writer.go` (interface + factory), `default.go`, `errorreport.go` |
| `src/etl/etl.ts` | `etl/` | `etl.go` (orchestrator), `run.go` (Config + Run) |
| — (new) entrypoint | `cmd/etl/` | `main.go` |

### Multi-surface entrypoints (roadmap)

All four consumption modes funnel through one `etl.Run(Config)`; the JSON `Config`
is the shared contract.

| Surface | How |
|---|---|
| Terminal (args) | `cmd/etl` flags (`-source`, `-columns`, `-mandatory`, `-out-*`, `-template`, …) |
| BullMQ worker | spawn binary, JSON `Config` on stdin (`-config -`) → JSON `Result` on stdout |
| Lambda / cloud function | import `flatfile-go/etl` (Go runtime) or shell out with JSON |
| Helper / API | import `etl`, call `Run(cfg)` or `New(source, opts, writer).Process()` |

---

## 3. Key design decisions

- **Ordered mappings.** `outputMappings`/`identifierMappings` are `[]line.Mapping{Out,Src}`,
  not maps — Go maps are unordered and JS object key order isn't guaranteed across a
  JSON boundary. Arrays keep delimited output deterministic and survive round-trips.
- **Lazy writers.** Output file + header are created on the first `Push`, so an empty
  or all-invalid input produces no output file.
- **Faithful parity quirk.** The footer is written raw (no leading newline), so it
  concatenates onto the last row (`…Widget CEOF`) — matches `DefaultGenerator`.
- **CRLF tolerance.** `bufio.Scanner`/`ScanLines` drops a trailing `\r`, replacing
  the Node `crlfDelay: Infinity` behavior.
- **Output dir.** Configurable `Path`, default `os.TempDir()` (TS hard-codes `/var/tmp`).

---

## 4. Verification

```bash
cd go
go build ./...   # OK
go vet ./...     # OK
go test ./...    # ok: template, line, etl
```

- Ran the binary in **flags mode** and **JSON-stdin mode** — both produced the
  correct output file, `<source>.error.txt`, and JSON `Result` with sample metadata.
- Test coverage: `template` (substitution, `[timestamp]`/`[dateTime]`, data-path,
  sanitize); `line` (quote stripping, missing columns, mandatory validation, header
  detection, ordered output + defaults, identifiers); `etl` end-to-end (happy path
  with a skipped invalid row, empty file → invalid + no output, `rejectOnInvalidRow`,
  zero-error report deletion).

---

## 5. Deferred (not yet migrated)

- Azure Blob + S3 readers/writers
- Excel writer (`ExcelJS`)
- `JSONGenerator` (nested JSON output)
- `PushIfExist` / `FileIndexGenerator` dedup variants + `uniqueKey`/`indexFile`
- JS-eval `customFunction` template fallback

The `Reader`/`Writer` interfaces + factories are shaped so these slot in **without
touching `etl.go`**.

---

## 6. Notes / follow-ups

- In flags mode **without** `outputMappings`, output uses all `columns` in order, so
  a literal `-header 'sku;name'` (2 cols) won't line up with 3-column rows. That's
  config responsibility; the template path (`{SKU};{NAME}`) is the cleaner way to
  shape rows.
- Mandatory-field error text prints the empty value as `""` (TS prints `"undefined"`
  for a missing key) — cosmetic difference in the error report only.
