---
type: concept
title: "Migration Process — TypeScript ETL → Go"
source: /MIGRATION_PROCESS/
path: /MIGRATION_PROCESS/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T07:11:07.549Z"
---
# Migration Process — TypeScript ETL → Go

Tracking log for porting the streaming flat-file ETL pipeline from
[`typescript/`](typescript/) to [`go/`](go/) (module `flatfile-go`, Go 1.26).

**Status:** Core pipeline complete and verified. Azure Blob source reader
implemented. S3 reader, cloud (Azure/S3) output destinations, and
Excel/JSON/dedup writers deferred.

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
| `src/file-reader` | `reader/` | `reader.go` (interface + factory), `filereader.go` (local), `blobreader.go` (Azure Blob, from `blob-reader.ts`), `sourceconfig.go`, `azureauth.go` |
| `src/file-generator` | `writer/` | `writer.go` (interface + factory), `default.go`, `errorreport.go` |
| `src/etl/etl.ts` | `etl/` | `etl.go` (orchestrator), `run.go` (Config + Run) |
| — (new) entrypoint | `cmd/etl/` | `main.go` |

`reader/` also now covers the Azure Blob source beyond the original TS
1:1 scope: `SourceConfig` accepts the legacy string `source` (local path or
blob URL, inferred by shape) or a typed object (`type`, `path`/`url`, `auth`),
and `reader.New` dispatches to `LocalFileReader` or `AzureBlobReader`
accordingly. See [usage.md](usage.md), §4.1, for the wire format and
[`samples/azure-blob`](../samples/azure-blob) / [`samples/local`](../samples/local)
for runnable configs.

### Multi-surface entrypoints (roadmap)

All four consumption modes funnel through one `etl.Run(Config)`; the JSON `Config`
is the shared contract.

| Surface | How |
|---|---|
| Terminal / worker | `cmd/etl -config <path-or->`; optional `-source` (local path or Azure blob URL) overrides the source in canonical config JSON |
| BullMQ worker | spawn binary, JSON `Config` on stdin (`-config -`) → JSON `Result` on stdout |
| Lambda / cloud function | import `flatfile-go/etl` (Go runtime) or shell out with JSON |
| Helper / API | import `etl`, call `Run(cfg)` or `New(source, opts, writer).Process()` |

---

## 3. Key design decisions

- **Ordered mappings.** `outputMappings`/`identifierMappings` are `[]line.Mapping{Out,Src}`,
  not maps — Go maps are unordered and JS object key order isn't guaranteed across a
  JSON boundary. Arrays keep delimited output deterministic and survive round-trips.
- **One configuration shape.** The library and CLI use canonical `etl.Config`
  JSON (`source`, `output`, `options`). The CLI reads it from a file or stdin,
  rejects retired wrapper/envelope shapes, and optionally overrides `source`.
- **Writer configuration alignment.** `FileGenerator` matches the
  `fileGenerator` wire key; `filename` is a flat, always-templated string;
  `output.metadata` accepts arbitrary nested JSON for template lookups. Legacy
  filename wire forms remain temporary read-time compatibility inputs.
- **Row-mode precedence.** A configured row `template` takes precedence over
  separator-joined output mappings.
- **Lazy writers.** Output file + header are created on the first `Push`, so an empty
  or all-invalid input produces no output file.
- **Faithful parity quirk.** The footer is written raw (no leading newline), so it
  concatenates onto the last row (`…Widget CEOF`) — matches `DefaultGenerator`.
- **CRLF tolerance.** `bufio.Scanner`/`ScanLines` drops a trailing `\r`, replacing
  the Node `crlfDelay: Infinity` behavior.
- **Output dir.** Configurable `Path`, default `os.TempDir()` (TS hard-codes `/var/tmp`).
- **Caller-supplied cloud auth.** `SourceConfig`/`AzureAuth` accept credentials
  from the caller (shared key, connection string, SAS token, or the zero-value
  default Azure credential chain) rather than reading them from process
  environment variables, unlike the TS `BlobReader`. `AzureAuth.Type()`
  identifies which mode a populated struct represents.

---

## 4. Verification

```bash
cd go
go build ./...   # OK
go vet ./...     # OK
go test ./...    # ok: template, line, reader, etl
```

- Verified the binary with canonical JSON from a **config file** and **stdin**,
  including the optional source override and strict rejection of retired JSON
  wrapper/envelope shapes.
- Verified the local-source object form and all four Azure Blob auth modes
  parse and dispatch correctly using the placeholder configs under
  [`samples/`](../samples) (each fails only at the expected network/decode
  step with placeholder credentials — confirming config plumbing without
  needing a real storage account).
- Test coverage: `template` (substitution, `[timestamp]`/`[dateTime]`, data-path,
  sanitize); `line` (quote stripping, missing columns, mandatory validation, header
  detection, ordered output + defaults, identifiers); `reader` (Azure auth-mode
  identification and precedence, source config legacy-string/object decoding
  and validation, blob reader line scanning over an injected fake stream
  including CRLF and >64 KiB lines, close idempotence, not-found translation);
  `etl` end-to-end (happy path with a skipped invalid row, empty file →
  invalid + no output, `rejectOnInvalidRow`, zero-error report deletion).

---

## 5. Deferred (not yet migrated)

- S3 reader
- Azure Blob + S3 writers (output destinations)
- Excel writer (`ExcelJS`)
- `JSONGenerator` (nested JSON output)
- `PushIfExist` / `FileIndexGenerator` dedup variants and `indexFile`
  (`uniqueKey` in-memory deduplication is supported by the default writer)
- JS-eval `customFunction` template fallback

The `Reader`/`Writer` interfaces + factories are shaped so these slot in **without
touching `etl.go`**.

---

## 6. Notes / follow-ups

- Without `outputMappings`, output uses all configured `columns` in order. A
  two-column output header therefore will not line up with a three-column row
  unless mappings or a row template such as `{SKU};{NAME}` shape the output.
- Mandatory-field error text prints the empty value as `""` (TS prints `"undefined"`
  for a missing key) — cosmetic difference in the error report only.
