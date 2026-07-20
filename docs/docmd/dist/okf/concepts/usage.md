---
type: concept
title: "Usage Guide — Integrating the ETL Utility (Go)"
source: /usage/
path: /usage/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T13:18:22.932Z"
---
# Usage Guide — Integrating the ETL Utility (Go)

How to use the flat-file ETL core from an **external application** — for example, a
web application that accepts a source file upload and needs it validated and
transformed into a delimited output file.

For the internal design and TS→Go migration rationale, see
[etl-code-review-and-go-design.md](etl-code-review-and-go-design.md).

For build and hosting instructions, see
[deployment-guide.md](deployment-guide.md).

---

## 1. What it does

You give the pipeline three things:

1. **A source file** — a local path or an Azure blob URL to a delimited text
   file (CSV, `;`-separated, etc.).
2. **Line rules** — column names, which fields are mandatory, the separator, whether
   line 1 is a header.
3. **An output definition** — where to write, the filename, and how each row is
   projected (ordered mappings or a template string).

It streams the source line by line and produces:

- An **output file** containing every valid, non-header row (created lazily — an
  empty or all-invalid source produces **no** output file).
- Optionally, an **error report** (`<source-filename>.error.txt`) listing invalid
  rows — opt-in via `output.options.errorReport` (§4.3.1), and even then only
  kept when at least one row failed validation. Invalid rows are always counted
  in the result whether or not the file is written.
- A JSON **result** summarizing validity, error counts, file locations, and
  metadata sampled from the first valid row.

All integration surfaces funnel through one function, `etl.Run(Config)`, so the
behavior is identical whether you call it in-process or spawn the binary.

---

## 2. Integration surfaces

| Surface | How you pass parameters | Status |
| --- | --- | --- |
| **In-process (Go)** | Import `flatfile-go/etl`, build an `etl.Config` struct, call `etl.Run(cfg)` | ✅ Available |
| **Spawned binary (any language)** | `etl -config <config.json>`; read the JSON result from stdout. `-source <path-or-url>` may override `source` from the config. | ✅ Available |
| **JSON config via stdin** (`-config -`) | Pipe the same canonical config JSON to the process | ✅ Available |
| **HTTP server** | Run `cmd/http`; `POST /etl` with canonical config JSON in the request body | ✅ Available |
| **AWS Lambda Function URL** | Deploy `cmd/lambda`; `POST /` or `POST /etl` with canonical config JSON in the request body | ✅ Available |
| **Flags-only terminal run** (`-columns`, `-mandatory`, …) | Individual CLI flags | 🔜 Planned |

> **Note for binary integrators:** the CLI reads the same `etl.Config` JSON shape
> used in-process: `source`, `output`, and `options`. The optional `-source`
> flag overrides `source` from the JSON for callers that keep the file path
> outside the config payload. The flag accepts either a local path or an
> Azure blob URL — whichever it is set to always replaces `source` **as the
> legacy string form** (see §4.1); to override with the typed object form
> (e.g. to pass Azure auth), set `source` in the config JSON instead.

---

## 3. Quick start

### 3.1 In-process from a Go web application

A handler that accepts an uploaded file, saves it to a temp path, and runs the
pipeline:

```go
package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"flatfile-go/etl"
	"flatfile-go/line"
	"flatfile-go/writer"
)

func handleUpload(w http.ResponseWriter, r *http.Request) {
	// 1. Persist the uploaded file locally — the reader needs a local path.
	src, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer src.Close()

	tmpPath := filepath.Join(os.TempDir(), header.Filename)
	dst, err := os.Create(tmpPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	dst.Close()

	// 2. Build the Config — this is where all required params are passed.
	cfg := etl.Config{
		Source: tmpPath,
		Output: writer.OutputConfig{
			FileGenerator: "default-generator",
			Path:          "/var/data/out",
			Filename:      "products.txt",
			Separator:     ";",
			Header:        "sku;name",
			Footer:        "EOF",
		},
		Options: etl.Options{
			Line: line.LineConfig{
				Columns:         []string{"BARCODE", "SKU", "NAME"},
				MandatoryFields: []string{"BARCODE", "SKU"},
				Separator:       ",",
				WithHeader:      true,
				OutputMappings: []line.Mapping{
					{Out: "sku", Src: "SKU"},
					{Out: "name", Src: "NAME"},
				},
				IdentifierMappings: []line.Mapping{
					{Out: "barcode", Src: "BARCODE"},
				},
			},
			RejectOnInvalidRow: false,
		},
	}

	// 3. Run and return the result.
	result, err := etl.Run(cfg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(result)
}
```

### 3.2 Spawning the binary (Node.js example)

For non-Go applications (an Express/Nest web app, a BullMQ worker), write the
config to a JSON file and spawn the binary:

```js
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function runEtl(sourcePath) {
  const config = {
    source: sourcePath,
    output: {
      fileGenerator: "default-generator",
      path: "/var/data/out",
      filename: "products.txt",
      separator: ";",
      header: "sku;name",
      footer: "EOF",
    },
    options: {
      line: {
        columns: ["BARCODE", "SKU", "NAME"],
        mandatoryFields: ["BARCODE", "SKU"],
        separator: ",",
        withHeader: true,
        outputMappings: [
          { out: "sku", src: "SKU" },
          { out: "name", src: "NAME" },
        ],
        identifierMappings: [{ out: "barcode", src: "BARCODE" }],
      },
      rejectOnInvalidRow: false,
    },
  };

  const configPath = path.join(os.tmpdir(), `etl-job-${Date.now()}.json`);
  await writeFile(configPath, JSON.stringify(config));

  return new Promise((resolve, reject) => {
    execFile("etl", ["-config", configPath],
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(JSON.parse(stdout)); // the Result object, see §6
      });
  });
}
```

Build the binary once with `cd go && go build -o ./bin/etl ./cmd`.

### 3.3 CLI config file shape

The JSON file passed to `-config` is the canonical `etl.Config` shape:

```json
{
  "source": "/var/data/in/products.csv",
  "output": {
    "fileGenerator": "default-generator",
    "path": "/var/data/out",
    "filename": "products.txt",
    "separator": ";",
    "header": "sku;name",
    "footer": "EOF"
  },
  "options": {
    "line": {
      "columns": ["BARCODE", "SKU", "NAME"],
      "mandatoryFields": ["BARCODE", "SKU"],
      "separator": ",",
      "withHeader": true,
      "outputMappings": [
        { "out": "sku", "src": "SKU" },
        { "out": "name", "src": "NAME" }
      ],
      "identifierMappings": [{ "out": "barcode", "src": "BARCODE" }]
    },
    "rejectOnInvalidRow": false
  }
}
```

`etl -source /override.csv -config job.json` is also allowed; the flag replaces
the JSON `source` value after the file is parsed. `-source` also accepts an
Azure blob URL (e.g. `-source https://acct.blob.core.windows.net/c/p.csv`); for
authenticated blobs, put `source` in the config JSON instead so you can attach
`auth` (see §4.1).

---

## 4. Parameter reference

### 4.1 Source

`Config.Source` (`reader.SourceConfig`) accepts two JSON forms. The legacy
plain string still works and is inferred as local-vs-Azure by shape:

```json
"source": "/var/data/in/products.csv"
"source": "https://acct.blob.core.windows.net/container/products.csv"
```

The typed object form is required when a cloud source needs credentials:

```json
"source": {
  "type": "local",
  "path": "/var/data/in/products.csv"
}
```

```json
"source": {
  "type": "azure-blob",
  "url": "https://acct.blob.core.windows.net/container/daily/products.csv",
  "auth": { "accountName": "acct", "accountKey": "<key>" }
}
```

| Param | CLI | In-process | Notes |
| --- | --- | --- | --- |
| Source | `-source <path-or-url>` flag | `Config.Source` | Local file path or Azure blob URL. The flag always sets the legacy string form — use the JSON `source` object for Azure auth. **S3 is not yet supported** and is rejected with an explicit error. |

`auth` is optional and has four mutually exclusive shapes (checked in this
precedence order — see `reader.AzureAuth.Type()`):

| `auth` shape | Mode |
| --- | --- |
| _omitted_ | `DefaultAzureCredential` chain (managed identity, `az login`, environment service principal). If `url` already has a `sig=` query parameter, that embedded SAS is used instead of requesting a token. |
| `{"connectionString": "..."}` | Storage account connection string. Takes precedence over shared key / SAS if more than one is set. |
| `{"accountName": "...", "accountKey": "..."}` | Shared key. Both fields are required together — one without the other is a validation error. |
| `{"sasToken": "..."}` | SAS query string (leading `?` optional), appended to `url`. |

Runnable examples for every mode are under
[`samples/azure-blob`](../samples/azure-blob) and
[`samples/local`](../samples/local).

For a local source, your application is responsible for getting the file onto
local disk first (e.g. saving an HTTP upload). For an Azure blob source, the
pipeline streams the blob directly — no local download step or `/tmp` usage.

### 4.2 Line rules — `line` / `line.LineConfig`

Controls how each source line is parsed and validated.

| JSON key | Type | Required | Description |
| --- | --- | --- | --- |
| `columns` | `string[]` | ✅ | Ordered names for the source columns. Each line is split on `separator` and zipped with these names. Missing trailing columns become `""`. |
| `mandatoryFields` | `string[]` | ✅ (for validation) | Column names that must be non-empty. An empty mandatory field makes the row invalid: `ERROR AT LINE <n>: Invalid <field> value of "<value>"`. |
| `separator` | `string` | ⬜ | Source field separator. Default: `";"`. |
| `withHeader` | `bool` | ⬜ | When `true`, line 1 is treated as a header: it is never written to the output. A header-only file counts as **empty** (invalid result). |
| `outputMappings` | `[{out, src}]` | ⬜ | **Ordered** projection of the output row (see §4.4). Order defines the column order in the output file. |
| `identifierMappings` | `[{out, src}]` | ⬜ | Keyed lookups captured from the **first valid row** and returned in `result.metadata` (identifiers win on key collision). Use this to surface e.g. a batch id or barcode back to your application. |

Field parsing matches the TypeScript original: values are split on the
separator and **one** leading plus **one** trailing double quote is stripped
(`"ABC"` → `ABC`). Lines with CRLF endings are handled (`\r` is dropped).

### 4.3 Output definition — `output` / `writer.OutputConfig`

The output destination mirrors the source (§4.1): local disk by default, or
Azure Blob Storage when `type`/`url` are set. The destination fields sit flat
inside `output`, so existing local-only configs are unchanged:

```json
"output": {
  "filename": "products_{LOC}.csv",
  "path": "/var/data/out"
}
```

```json
"output": {
  "type": "azure-blob",
  "url": "https://acct.blob.core.windows.net/exports/daily",
  "auth": { "accountName": "acct", "accountKey": "<key>" },
  "filename": "products_{LOC}.csv"
}
```

Unlike the source `url` (which names the exact blob to read), the output `url`
is a **container/prefix**: the rendered `filename` is appended to it, the same
way `path` + `filename` are joined for local output. The rendered output is
streamed to a block blob as rows are pushed (an `io.Pipe` feeds the SDK's
`UploadStream`, so memory use isn't proportional to output size); nothing is
uploaded when no valid row was produced, and the blob is only committed —
visible to readers — once the run ends without error. Error reports always
stay on local disk (under `path`'s default, the OS temp dir). Source and
output each carry their own `auth`, so a run can read from one storage
account and write to another.

| JSON key | Type | Required | Description |
| --- | --- | --- | --- |
| `fileGenerator` | `string` | ⬜ | Writer kind. `"default-generator"` (or empty) is the delimited/templated text writer. `"json-generator"` is supported for local output only. Other kinds (Excel/dedup variants, and JSON to cloud destinations) return an explicit "not supported yet" error. |
| `type` | `string` | ⬜ | Destination kind: `"local"` (default) or `"azure-blob"`. Empty is inferred: `url` set → `azure-blob`, otherwise `local`. **S3 is not yet supported** and is rejected with an explicit error. |
| `path` | `string` | ⬜ | Output directory for a local destination. Default: the OS temp dir. Must not be combined with `url`. |
| `url` | `string` | ⬜ | Azure container/prefix URL for an `azure-blob` destination (required for that type). The rendered `filename` is appended to it. |
| `auth` | `object` | ⬜ | Azure credentials for an `azure-blob` destination; same four shapes and precedence as the source `auth` (see the table in §4.1). |
| `filename` | `string` | ✅ | Output filename, always rendered through the template layers from the **first pushed row** (supports `{path}` value tokens and `[func ...]`, see §5). A plain name contains no tokens and is used as-is. Also accepted for compatibility: the object form `{"template": "..."}` and the legacy `filenameTemplate` key (which keeps its old precedence if both are set). |
| `separator` | `string` | ⬜ | Output column separator when using the default writer's `outputMappings` projection. Default: `"\|"`. Unused by JSON output. |
| `template` | `string` | ⬜ | Full row template (see §5). For the default writer, it takes precedence over the `outputMappings` projection. For JSON output, it must render one JSON object per row; when omitted, JSON rows are built from `outputMappings`. |
| `header` | `string` | ⬜ | For the default writer, the first line of the output file, written once when the first row arrives. For JSON output, the root-object template; empty means `{}`. |
| `footer` | `string` | ⬜ | Default writer only. Written raw at the end — **no leading newline**, so it concatenates onto the last row (`...WidgetEOF`). JSON output rejects `footer`. |
| `arrayField` | `string` | ⬜ | JSON output only. Root array property name. Default: `"lines"`. |
| `uniqueKey` | `string` | ⬜ | Default writer only. Source column name used to de-duplicate rows in-memory: rows whose value for this column was already written are skipped. JSON output rejects `uniqueKey`; deduplicate before writing JSON. |
| `metadata` | `object` | ⬜ | Arbitrary JSON object exposed to filename, header, and row templates under `metadata` / `data.metadata` (for example `{metadata.store.code}` or `[replaceString data.metadata.store.code - _]`). |
| `options` | `object` | ⬜ | Writer behavior toggles that are not part of the output format. See §4.3.1. |

#### 4.3.1 Writer toggles — `output.options`

Behavior toggles live in their own map so new ones can be added without a wire
change. A missing key — or a value of the wrong type — falls back to the
default rather than failing the run.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `errorReport` | `bool` | `false` | Write the `<source>.error.txt` report file next to `path`. |

```json
"output": {
  "filename": "products.json",
  "options": { "errorReport": true }
}
```

> Note this is `output.options`, which is **not** the same as the top-level
> `options` carrying the line rules and `rejectOnInvalidRow` (§4.5). Both can
> appear in the same config.

`errorReport` defaults to **off** because the utility is built to run in
serverless workers, where the writable filesystem is a small ephemeral scratch
space reused across warm invocations — a report file nobody collects
accumulates until unrelated runs start failing.

Turning it off suppresses only the *file*. Invalid rows are still counted, so
`totalErrors`, `withErrors`, and `rejectOnInvalidRow` behave identically either
way. When it is off, `localErrorReportFile` and `localErrorReportFilename` in
the result are empty strings rather than naming a file that was never written —
so check for a non-empty path before trying to read the report.

### 4.4 Ordered mappings — why arrays, not objects

`outputMappings` and `identifierMappings` are **arrays** of `{out, src}` pairs
instead of plain objects: Go maps and JSON objects have no guaranteed key
order, and the output column order must be deterministic. Keep them as arrays
in your integration.

For `outputMappings`, each `src` is resolved as:

1. A **source column name** → the row's value for that column.
2. A **`[func ...]` template** → evaluated (see §5).
3. Anything else → used as a **literal default** value.

For `identifierMappings`, `src` is a column lookup only.

### 4.5 Run behavior — `options` / `etl.Options`

| JSON key | Type | Default | Description |
| --- | --- | --- | --- |
| `rejectOnInvalidRow` | `bool` | `false` | `false`: invalid rows are skipped (logged to the error report) and the run stays `valid`. `true`: any invalid row marks the **whole result** invalid, and the output file is deleted. Settable in-process and through CLI JSON under `options.rejectOnInvalidRow`. |

---

## 5. Templating reference

Two token kinds are available in `filename`, `header`, and `template`:

### `{path}` — value substitution

Replaced with a scalar value from row data, output-mapped data, or
`output.metadata`.

`"{SKU};{NAME}"` → `"A1;Widget"`.
`"{metadata.store.code}"` → `"DXB01"`.
`"{data.metadata.stores.0.code}"` → `"DXB01"`.

The `data.` prefix is optional for value tokens. Numeric path segments index
arrays. Missing paths, invalid indexes, nulls, and object/array leaves resolve
to an empty string.

### `[func arg ...]` — computed tokens

| Token | Result |
| --- | --- |
| `[timestamp]` | Milliseconds since epoch. |
| `[dateTime <format> <tz>]` | Current time, moment-style tokens (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`, `A`, `Z`, …). Defaults: `YYYY-MM-DDTHH:mm:ssZ`, `UTC`. Format args cannot contain spaces (same limitation as the TS original). |
| `[sanitizeString <s>]` | Sanitized string. |
| `[removeWhiteSpaces <s>]` | Whitespace removed. |
| `[replaceString <s> <a> <b>]` | `<s>` with `<a>` replaced by `<b>`. |

Function arguments starting with `data.` are resolved as dot-paths against the
row data merged with the writer's `metadata` option — e.g.
`[sanitizeString data.NAME]` or `[replaceString data.metadata.region - _]`.
Nested metadata objects and arrays are supported; numeric path segments index
arrays (for example `data.metadata.stores.0.code`). String, number, and boolean
leaves are passed to template functions as strings. Missing paths, invalid
indexes, nulls, and object/array leaves retain the literal `data...` argument
rather than being serialized.
Unknown function names are left in place untouched (the TS JS-eval
`customFunction` fallback is intentionally not ported).

---

## 6. The result

`etl.Run` returns (and the CLI prints to stdout) a JSON `Result`:

```json
{
  "valid": true,
  "withErrors": true,
  "totalErrors": 1,
  "localOutputFile": "/var/data/out/products.txt",
  "localOutputFilename": "products.txt",
  "localErrorReportFile": "/tmp/in.csv.error.txt",
  "localErrorReportFilename": "in.csv.error.txt",
  "metadata": { "BARCODE": "123", "SKU": "A1", "NAME": "Widget", "barcode": "123" }
}
```

| Field | Meaning |
| --- | --- |
| `valid` | The run produced a usable output. `false` when the file was empty (or header-only), or when `rejectOnInvalidRow` is set and any row failed. When `false`, the output file has been **deleted** — don't try to read it. |
| `withErrors` | At least one row failed validation. ⚠️ Independent of `valid`: a run can be `valid: true, withErrors: true` (bad rows were skipped, good rows were written). |
| `totalErrors` | Count of invalid rows. |
| `localOutputFile` / `localOutputFilename` | Absolute path / bare name of the output file. Empty if no row was ever written (lazy writer). |
| `localErrorReportFile` / `localErrorReportFilename` | Path / name of the error report. **Empty strings unless `output.options.errorReport` is enabled** (§4.3.1) — the report is opt-in. When enabled, the file only **exists on disk** when `totalErrors > 0` (it is deleted when there were zero errors). |
| `metadata` | The first valid row's parsed record merged with the `identifierMappings` projection (identifiers win on key collisions). Use it to correlate the file with entities in your application. |

**Errors vs. invalid results:** validation failures do **not** return a Go
error / non-zero exit — they are reported through `Result`. A Go error (or a
non-zero exit with a message on stderr) means the run itself failed: local
file or blob not found, invalid/incomplete Azure auth, an S3 source (not yet
supported), unsupported writer kind, I/O failure. On that path both the
output and error-report files are force-deleted.

### 6.1 Routing failures — `writer.ErrorKind`

Errors returned from `etl.Run` are classified so a worker can decide what to do
without parsing error text. In-process, read it with `writer.KindOf(err)`:

| Kind | Meaning | What to do |
| --- | --- | --- |
| `KindPermanent` | Retrying the same input fails identically: bad config, unrenderable template, malformed row, rejected request. | Dead-letter. Don't spend retries. |
| `KindTransient` | Could succeed on retry: throttling, 5xx, dropped connection, deadline. Nothing was committed. | Retry with backoff. |
| `KindUnresolved` | The run failed **and** cleanup could not guarantee the destination was left clean. | Reconcile / alert. **Do not retry unattended.** |

```go
res, err := etl.Run(cfg)
if err != nil {
    switch writer.KindOf(err) {
    case writer.KindTransient:  // requeue with backoff
    case writer.KindUnresolved: // inspect the destination before retrying
    default:                    // dead-letter
    }
}
```

`writer.IsRetryable(err)` is shorthand for the `KindTransient` case. Note it
returns `false` for `KindUnresolved`: that failure is *not* permanent, but
retrying it blind risks a duplicate or half-replaced document, so it needs a
human or a reconciliation pass.

An error carrying no explicit kind is classified from its cause, and anything
unrecognized reports `KindPermanent` — an unknown failure isn't proven safe to
retry.

Your application is responsible for consuming and then removing the produced
files (uploading them, moving them, etc.) — the pipeline only deletes files on
the invalid/error paths.

---

## 7. Operational notes for integrators

- **Concurrency**: each run writes `filename` into `path` (plus
  `<source-filename>.error.txt` next to it when `errorReport` is enabled). If
  your web app processes uploads concurrently, give each job a unique output
  `path` (or a `filename` with `[timestamp]`) and unique source filenames to
  avoid collisions.
- **Large files**: the pipeline streams line by line with buffered writes, so
  memory stays flat regardless of file size. Default-writer `uniqueKey`
  de-duplication is the exception — it keeps one map entry per distinct key
  value. JSON output does not de-duplicate rows.
- **Output row endings**: rows are newline-*prefixed* (the header is not), and
  the footer is appended raw. The output has no trailing newline.
- **Azure Blob output**: rows stream to the destination as they're pushed
  (via `io.Pipe` into the SDK's block-blob `UploadStream`), symmetric with
  the streaming blob *source* — output size isn't bounded by memory. The blob
  is only committed (visible to readers) when the run ends; a run that fails
  before then leaves nothing visible at the destination.
- **Cleanup failures are surfaced, not swallowed**: when a run fails
  mid-stream (e.g. the source connection drops), the orchestrator's forced
  cleanup calls the writer's `End()` *before* `Delete()` — so the partial
  output is first committed, then deleted, rather than aborted in-flight. Every
  cleanup step runs even if an earlier one failed, and all failures are joined
  into the returned error. In the case where the commit succeeds and the
  follow-up delete then fails, a stray blob remains at the destination **and**
  the run reports `KindUnresolved` (§6.1) — so route that kind to
  reconciliation rather than a blind retry, which would write a second document
  alongside the one that could not be removed. The blob URL is deterministic:
  `url` + rendered `filename`.
- **Serverless deployments**: the process is typically frozen or destroyed
  right after a run returns, so there is no later pass to tidy up. Two
  consequences: leave `output.options.errorReport` off (the default) unless you
  actually collect the file, since warm containers share a small capped `/tmp`
  across invocations; and treat `KindUnresolved` as an alert rather than a
  retry, because nothing else will clean up after it.
- **Not yet supported** (explicit errors, planned per the design doc): S3
  sources and destinations, JSON output to cloud destinations, Excel writers,
  `PushIfExist`/file-index dedup variants, custom JS template functions, and
  flags-only CLI mode.

---

## 8. Testing your integration

```bash
cd go
go build ./...   # build everything
go test ./...    # unit + e2e pipeline tests

# Smoke-test the binary with your own config:
go build -o ./bin/etl ./cmd
printf 'BARCODE,SKU,NAME\n123,A1,Widget\n' > /tmp/in.csv
./etl -source /tmp/in.csv -config your-config.json
```

Runnable reference configs (local object form and every Azure Blob auth mode)
are under [`samples/`](../samples) at the repo root — see
[`samples/README.md`](../samples/README.md).

For deployment-specific commands, including Lambda zip packaging, running the
HTTP server, and compiling the CLI binary, see
[deployment-guide.md](deployment-guide.md).
