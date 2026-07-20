---
type: concept
title: "ETL Utility — Code Review & Go Implementation Design"
source: /etl-code-review-and-go-des/
path: /etl-code-review-and-go-des/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T13:11:38.878Z"
---
# ETL Utility — Code Review & Go Implementation Design

> Reference notes for the streaming flat-file ETL pipeline.
> Covers (1) a review of the TypeScript `ETL` class and (2) the design of the Go
> port that now lives under [`go/`](go/).

---

## 1. What the pipeline does

[`typescript/src/etl/etl.ts`](typescript/src/etl/etl.ts) is a thin **orchestrator**.
Given a **file source** (local path or Azure blob URL), a set of **line rules**,
and an **output writer**, it:

1. Streams the source **line by line** (Node `readline` over a read stream).
2. Parses each raw line into a keyed record and **validates** it (`SourceLine`).
3. Writes **valid, non-header** rows to the output writer.
4. Writes **invalid** rows to a separate `<source>.error.txt` report.
5. Captures the **first valid row** as a metadata sample + identifiers.
6. Finalizes (footer), **cleans up** streams, and **deletes** empty/invalid files.
7. Returns an `ETLResult` summary.

### Module map (TypeScript)

| Concern              | File                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchestrator         | `src/etl/etl.ts`                                                                                                                                              |
| Source streaming     | `src/file-reader/` (`readline-interface-factory.ts`, `file-reader.ts`, `blob-reader.ts`, `read-line-base.ts`)                                                 |
| Line parse/validate  | `src/line-data/` (`source-line.ts`, `line-source-base.ts`) + `src/utils/line-validator.ts`, `line-data-to-json.ts`                                            |
| Output writers       | `src/file-generator/` (`flat-file-base-lazy.ts`, `default-generator.ts`, `json-generator.ts`, `error-report.ts`, cloud writers) + `file-generator-factory.ts` |
| Templating / mapping | `src/utils/` (`replace-with-map.ts`, `replace-with-function.ts`, `map.ts`, `filename.ts`)                                                                     |
| Types                | `src/types/index.ts`                                                                                                                                          |

### Templating model (preserved in the port)

- **`{path}`** → value substitution from row/output/metadata data.
- **`[func arg ...]`** → `replaceWithFunction`: computed tokens —
  `[timestamp]`, `[dateTime YYYY-MM-DD]`, `[sanitizeString]`, `[removeWhiteSpaces]`,
  `[replaceString a b]`. `data.x.y` args resolve against a metadata object.
- **`mapWithDefault`** (output projection): a config value that is a column name is
  looked up; a `[...]` value is evaluated; otherwise the value is a literal default.
- **`mapFields`** (identifier projection): keyed lookups only.

---

## 2. Code review of `etl.ts`

### Correctness / bugs

| #   | Issue                                                                                                                                               | Location       | Fix                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------- |
| 1   | **Footer race** — `onCloseHandler` calls `resolve({})` _before_ `pushFooter()`, so `cleanUp()`/`end()` can run before the footer write lands.       | `etl.ts:64-67` | Write footer, _then_ resolve.                            |
| 2   | **`forceCleanUp()` not awaited** in the `catch` — streams may not close / files not delete before the error propagates.                             | `etl.ts:169`   | `await this.forceCleanUp()`.                             |
| 3   | **Lost parse errors** — `onLineHandler` re-emits errors onto the same readline interface; if listeners are already cleaned up the error is dropped. | `etl.ts:59-61` | Reject the processing promise via a stored `reject` ref. |
| 4   | **`fileSource` via truthiness + `as string` cast** hides the "neither provided" case.                                                               | `etl.ts:31`    | Guard and throw a clear error.                           |

### Design / maintainability

| #   | Issue                                                                                                                               | Location         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 5   | `processLines()` **reimplements** the existing `ReadLineBase.readlinePromise()` helper. Reuse it.                                   | `etl.ts:97-107`  |
| 6   | `cleanUp()` and `forceCleanUp()` are **near-duplicates** — only the conditional deletes differ. Collapse into `cleanUp(force)`.     | `etl.ts:109-137` |
| 7   | `populate()` re-evaluates `isValid && !isHeader` **twice**; fold into one branch.                                                   | `etl.ts:78-86`   |
| 8   | `onCloseHandler(resolve: Function)` uses the loose `Function` type.                                                                 | `etl.ts:64`      |
| 9   | `lineIndex` is really a **1-based line number** — rename to match `SourceLine.currentLineNumber`.                                   | `etl.ts:24,50`   |
| 10  | **No write backpressure** — `outputFileWriter.push()` ignores `write()`'s return / `drain`; can balloon memory on very large files. | `etl.ts:79`      |

### Minor / subtle

- `valid` and `withErrors` are **independent**: a file can be `valid: true, withErrors: true`. Worth a comment.
- `getResult().metadata` merges `sampleLineData` + `identifiers`; **key collisions favor identifiers** silently.
- The column-count check in `line-validator.ts` is **commented out** (TODO). Decide whether to enforce (made configurable-friendly in Go).

> The Go port fixes #1, #2, #5, #6, #7, #9 **by construction** (sequential flow,
> footer-before-done, unified `cleanUp(force)`), and gets backpressure (#10) for
> free via `bufio.Writer` + explicit flush.

---

## 3. Go implementation design

Module `flatfile-go` (Go 1.26). **Library-first**: the core is plain packages with
no I/O assumptions beyond the local filesystem; entrypoints are thin shells over a
single `etl.Run(Config)`.

### Roadmap alignment (multi-surface)

The binary/core is consumable four ways, all funneling through `etl.Run`:

| Surface                     | How                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Terminal / worker**       | `cmd/etl -config <path-or->`; `-` reads canonical JSON from stdin and optional `-source` overrides its source.      |
| **BullMQ worker (Node)**    | Worker spawns the binary, pipes a JSON `Config` to `-config -` (stdin), reads the JSON `Result` from stdout.       |
| **Lambda / Cloud Function** | Go runtime imports `flatfile-go/etl` and calls `etl.Run(cfg)`; or the function shells out to the binary with JSON. |
| **In-process helper (API)** | Import `etl`, build a `Config` (or call `etl.New(source, opts, writer)` directly) and `Process()`.                 |

The JSON `Config` is the stable contract shared by every surface, so they all
exercise identical core logic.

### Package layout ([`go/`](go/))

```
go/
  template/   {path} + [func] templating, sanitize helpers    (field.go, function.go, sanitize.go)
  line/       SourceLine: parse, validate, map projections    (options.go, sourceline.go, validator.go, mapping.go)
  reader/     Reader interface + local/Azure Blob streamers    (reader.go, filereader.go, blobreader.go, sourceconfig.go, azureauth.go)
  writer/     Writer interface + DefaultWriter + ErrorReport + Factory  (writer.go, default.go, errorreport.go)
  etl/        Orchestrator + Config/Run boundary              (etl.go, run.go)
  cmd/etl/    CLI / worker / function entrypoint              (main.go)
  utils/      existing helpers (IsValidURL, parsing)
  skuserial/  existing codec (unchanged)
```

### Data flow

```
etl.Run(Config)
  └─ writer.Factory(kind, opts) ─────────────► Writer
  └─ etl.New(source, opts, writer)
        └─ reader.New(source) ───────────────► Reader  (local file or Azure Blob by SourceConfig.Type; S3 => explicit "not supported" error)
        └─ writer.NewErrorReport(reader.Filename(), writer.Path())
  └─ ETL.Process()
        reader.Open()
        for reader.Scan():
            sl := line.New(text, opts.Line, lineNo)
            sl.Validate()
            invalid?            → errorReport.Push(sl.Error())
            valid & !header?    → output.Push(sl); capture sample+identifiers once
        reader.Err()?           → cleanUp(force=true); return err
        output.PushFooter()                    ← footer BEFORE "done" (fixes review #1)
        validateFinalResult()   (empty file / rejectOnInvalidRow)
        cleanUp(force=false)    (flush+close; delete empty/invalid)  ← unified (fixes #6)
        return Result
```

### TS → Go type mapping

| TypeScript                                               | Go                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ReadLineInterface` union + `readLineInterface()`        | `reader.Reader` interface + `reader.New()` factory                                       |
| `BlobReader` (env-var shared-key auth only)               | `reader.AzureBlobReader` — caller-supplied `AzureAuth` (shared key, connection string, SAS, or the default credential chain) |
| Node `readline` (event-based)                            | `bufio.Scanner` (`ScanLines` drops trailing `\r` → CRLF tolerant)                        |
| `LineSourceBaseOptions`                                  | `line.LineConfig` (JSON-tagged)                                                          |
| `SourceLine` class + getters                             | `line.SourceLine` + methods `Validate/IsValid/Error/IsHeader/Output/AllData/Identifiers` |
| `jsonLine: JSONObject`                                   | `map[string]string`                                                                      |
| `outputMappings` / `identifierMappings` (objects)        | `[]line.Mapping{Out,Src}` — **ordered** so delimited output is deterministic             |
| `FlatFileBaseLazy & FlatFileBaseLazyMethods`             | `writer.Writer` interface                                                                |
| `DefaultGenerator`                                       | `writer.DefaultWriter` (lazy create, uniqueKey dedup)                                    |
| `ErrorReport`                                            | `writer.ErrorReport` (lazy; `InvalidRows` counter)                                       |
| `FileGeneratorFactory`                                   | `writer.Factory(OutputConfig)`                                                           |
| `replaceWithMap/Function`, `mapFields`, `mapWithDefault` | `template.*` + `line.mapWithDefault/mapFields`                                           |
| `ETLResult`                                              | `etl.Result` (JSON-tagged)                                                               |

> **Why ordered `[]Mapping` instead of a map?** Go maps have no stable order and
> JS object key order is not guaranteed across a JSON boundary. Arrays of
> `{out, src}` keep the delimited writer's column order deterministic and survive
> JSON round-trips from a worker/function.

### Configuration contract

- Every entrypoint uses the canonical `etl.Config` JSON shape: `source`,
  `output`, and `options`. The CLI decodes that shape strictly from a file or
  stdin and rejects retired wrapper/envelope shapes.
- `OutputConfig.FileGenerator` matches the `fileGenerator` JSON key.
- `filename` is canonically a flat string and is always passed through field
  and function templating. The TypeScript object form and legacy
  `filenameTemplate` key remain temporary read-time compatibility inputs.
- `output.metadata` is the sole writer-metadata location. It accepts arbitrary
  JSON values; template paths can traverse nested objects and arrays and use
  string, numeric, and boolean leaves.
- A row `template` takes precedence over output `separator` projection when
  both are configured.

### Behavior-parity notes (faithful to TS)

- **Field parse**: split on separator, strip **one** leading and **one** trailing `"`.
- **Missing trailing columns** → `""` (TS `undefined`; both fail the mandatory check).
- **Header**: `withHeader && lineNo == 1`; never written to output, but its presence
  on line 1 is why a header-only file is treated as "empty".
- **Lazy writer**: file + header created on first `Push` → empty/all-invalid input
  produces no output file.
- **Row newlines**: data rows are newline-**prefixed**; the header is not; the
  **footer is written raw** (no leading newline) — so it concatenates onto the last
  row (`...Widget CEOF`). This is intentional parity with `DefaultGenerator`.
- **Error format**: `ERROR AT LINE <n>: Invalid <field> value of "<value>"`.
- **dateTime**: moment-style tokens mapped onto Go's reference-time layout, so
  config strings (`YYYY-MM-DD`, `HHmmss`, …) are unchanged. (Format args can't
  contain spaces — same limitation as TS.)
- **Output dir**: configurable `Path`, default `os.TempDir()` (TS hard-codes `/var/tmp`).

### Implemented since core migration: Azure Blob reader

`reader.AzureBlobReader` (ported from `blob-reader.ts`) streams
`DownloadStream`'s response body through the same `bufio.Scanner` setup as
`LocalFileReader` — 64 KiB initial buffer, the package's 10 MiB line cap —
so line/CRLF behavior is identical across both sources. It implements
`Reader` directly; no separate `Source`/`LineReader` split was introduced.

Unlike the TS `BlobReader`, credentials are never read from the environment.
The caller supplies an `AzureAuth` struct (shared key, connection string, SAS
token, or the zero-value default credential chain), and `AzureAuth.Type()`
identifies which mode applies. `Config.Source` (`reader.SourceConfig`)
accepts both the legacy string form (local path or blob URL, inferred by
shape) and a typed object form (`{"type", "path"/"url", "auth"}`) for callers
that need to attach credentials. See [usage.md](usage.md), §4.1, and the
runnable configs under [`samples/`](../samples).

### Deferred (out of current core scope)

S3 reader; S3 output; JSON output to cloud destinations; Excel (`ExcelJS`);
the `PushIfExist` / `FileIndexGenerator` dedup variants; the JS-eval
`customFunction` template fallback; `indexFile` external dedup; and
`context.Context` threading through the reader (Azure calls currently use
`context.Background()`). Local streaming `JSONGenerator` output is implemented.
In-memory `uniqueKey` deduplication is supported by the default writer only; the
JSON writer rejects `uniqueKey` and serializes every valid row it receives. The
`Reader` / `Writer` interfaces + factory are shaped so these slot in **without
touching `etl.go`**.

---

## 4. Running & testing

```bash
cd go

# Build everything
go build ./...

# Unit + e2e tests (template, line, etl pipeline)
go test ./...

# Terminal run (canonical JSON config file)
go run ./cmd/etl -config ./samples/csv-to-csv/config.default.json

# Worker / function run (the same canonical JSON via stdin → JSON result on stdout)
echo '{ "source":"in.csv",
        "output":{"fileGenerator":"default-generator","path":"/tmp","filename":"out.csv",
          "separator":";","template":"{SKU};{NAME}","header":"sku;name","footer":"EOF"},
        "options":{"line":{"columns":["BARCODE","SKU","NAME"],"mandatoryFields":["BARCODE","SKU"],
          "separator":",","withHeader":true,
          "identifierMappings":[{"out":"barcode","src":"BARCODE"}]}} }' \
  | go run ./cmd/etl -config -
```

**Test coverage**: `template` (substitution, `[timestamp]`/`[dateTime]`, data-path,
sanitize); `line` (quote stripping, missing columns, mandatory validation, header
detection, ordered output + defaults, identifiers); `reader` (Azure auth-mode
identification and precedence, source config legacy-string/object decoding and
validation, blob reader line scanning over an injected fake stream — CRLF,
>64 KiB lines, close idempotence, not-found translation); `etl` end-to-end
(happy path with a skipped invalid row, empty file → invalid + no output,
`rejectOnInvalidRow`, zero-error report deletion).
