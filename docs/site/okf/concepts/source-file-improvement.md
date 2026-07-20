---
type: concept
title: "Source File Improvement Plan"
source: /source-file-improvement/
path: /source-file-improvement/
updated: 2026-07-20
okf:
  generated_by: "@docmd/plugin-okf"
  generated_at: "2026-07-20T07:39:39.035Z"
---
# Source File Improvement Plan

## Goal

Extend the Go ETL input system so source files can be streamed from:

- the local filesystem;
- Amazon S3;
- Azure Blob Storage.

The ETL must process all sources line by line without downloading the complete
file into memory or requiring a temporary local copy.

This work is part of the TypeScript-to-Go migration and complements the output
generator and destination work described in
[`output-file-improvement.md`](output-file-improvement.md).

```text
Source configuration -> Source factory -> byte stream -> line scanner -> ETL
                              |
                              |- Local file
                              |- Amazon S3
                              `- Azure Blob Storage
```

## Implementation Status

An Azure Blob reader has shipped, but as a narrower, more direct change than
the design below: it extends the existing `reader.Reader` interface instead
of introducing the `Source`/`LineReader` split. See
`go/reader/blobreader.go`, `sourceconfig.go`, and `azureauth.go`, and
[usage.md](usage.md), §4.1, for the resulting configuration shape. Concretely,
this plan's proposals were **not** followed as written:

- No `Source`/`LineReader` interface separation — `AzureBlobReader`
  implements `Reader` directly, the same shape as `LocalFileReader`; `etl.New`
  keeps its existing three-argument signature.
- `SourceConfig` is flatter than the `Local`/`S3`/`AzureBlob` nested-pointer
  shape sketched in [Proposed Configuration](#proposed-configuration):
  `{Type, Path, URL, Auth}`, one local-or-blob source per config.
- Credentials are caller-supplied through an explicit `AzureAuth` struct
  (shared key, connection string, SAS token, or the zero-value default
  credential chain, disambiguated by `AzureAuth.Type()`) rather than assumed
  from the provider default chain only.
- S3, `context.Context` threading, configurable max line size, and object
  versioning remain unimplemented — the phased design below is still the
  reference for that future work.

## Current State

The Go `reader.Reader` interface already isolates the ETL orchestrator from the
local file implementation:

```go
type Reader interface {
	Open() error
	Scan() bool
	Text() string
	Err() error
	Close() error
	Filename() string
	Filepath() string
}
```

However, `reader.New` currently accepts only a string and rejects URLs. The local
reader also owns the `bufio.Scanner`, which would cause scanner configuration
and line behavior to be repeated in every cloud reader.

The migration should separate:

1. opening and closing a source byte stream;
2. scanning that stream into lines.

## Proposed Configuration

Use an explicit source object for new configurations while temporarily accepting
the existing source string for backward compatibility.

### Local file

```json
{
  "source": {
    "type": "local",
    "path": "/var/tmp/products.csv"
  }
}
```

### Amazon S3

```json
{
  "source": {
    "type": "s3",
    "bucket": "imports",
    "key": "daily/products.csv",
    "region": "me-central-1"
  }
}
```

### Azure Blob Storage

```json
{
  "source": {
    "type": "azure-blob",
    "container": "imports",
    "blob": "daily/products.csv",
    "accountURL": "https://example.blob.core.windows.net"
  }
}
```

The configuration should use bucket/container and object names rather than
requiring credentials inside the ETL request.

### Backward compatibility

Continue accepting the current local form:

```json
{
  "source": "/var/tmp/products.csv"
}
```

Because `source` currently has a string wire type, a custom JSON decoder or an
intermediate wire type can accept both forms during migration. Internally, both
forms should normalize to one `SourceConfig`.

Automatically interpreting arbitrary URLs is not recommended. An explicit
source type makes validation, authentication, and error reporting predictable.
If URI shorthand is desired later, support only documented schemes such as:

- `file:///var/tmp/products.csv`;
- `s3://imports/daily/products.csv`;
- a validated Azure Blob URL.

## Proposed Design

### Source stream

A source implementation should only locate and open an object:

```go
type Source interface {
	Open(ctx context.Context) (io.ReadCloser, error)
	Filename() string
	Location() string
}
```

Implementations:

- `LocalSource`;
- `S3Source`;
- `AzureBlobSource`.

`Location` returns a stable source location suitable for diagnostics:

- `/var/tmp/products.csv`;
- `s3://imports/daily/products.csv`;
- an Azure Blob URL or equivalent Azure location.

### Shared line reader

One line reader should wrap every source:

```go
type LineReader struct {
	source  Source
	stream  io.ReadCloser
	scanner *bufio.Scanner
}
```

Its behavior remains equivalent across all backends:

- `Open` obtains the stream and constructs the scanner;
- `Scan` advances one line;
- `Text` returns the current line;
- `Err` exposes scanner and underlying stream errors;
- `Close` closes the response body or local file;
- `Filename` and `Location` delegate to the source.

This preserves the current ETL scan loop and prevents separate local, S3, and
Azure implementations from drifting in CRLF handling or maximum line size.

### Factory

Normalize configuration first, then select the source implementation:

```go
source, err := SourceFactory(ctx, cfg.Source)
if err != nil {
	return Result{}, err
}

input := reader.New(source)
```

Suggested configuration types:

```go
type SourceConfig struct {
	Type      string                 `json:"type"`
	Local     *LocalSourceConfig     `json:"local,omitempty"`
	S3        *S3SourceConfig        `json:"s3,omitempty"`
	AzureBlob *AzureBlobSourceConfig `json:"azureBlob,omitempty"`
}
```

The final JSON shape can remain flat within `source`; the nested Go fields above
only illustrate type separation. Validation should reject ambiguous
configurations and report missing required fields before processing begins.

## Streaming Behavior

### Local files

`LocalSource.Open` returns an `*os.File`. The shared scanner consumes it
incrementally, preserving the current behavior.

### Amazon S3

The S3 source should:

1. create a client using the AWS default configuration and credential chain;
2. call `GetObject` with the function context;
3. return the response body directly as `io.ReadCloser`;
4. scan the response body incrementally;
5. close the body on success, failure, or cancellation.

The implementation must not read the complete response with `io.ReadAll`.

Optional configuration may include region, endpoint override for testing, object
version, and expected ETag. Credentials should not normally be accepted in the
ETL configuration.

### Azure Blob Storage

The Azure source should:

1. build a blob client using the Azure default credential chain;
2. start a streaming download with the function context;
3. return the response body directly as `io.ReadCloser`;
4. scan the response body incrementally;
5. close the response body on success, failure, or cancellation.

An optional connection-string mode can be supported for compatibility, but
managed identity should be the preferred serverless authentication method.

The implementation must not buffer the complete blob in memory.

## Serverless Requirements

### Context and cancellation

Thread `context.Context` through ETL construction and processing:

```go
func Run(ctx context.Context, cfg Config) (Result, error)
```

The same context should control:

- opening the cloud source;
- reading the response stream;
- output uploads;
- cleanup when the function is cancelled or reaches its deadline.

If compatibility is required, retain a wrapper that uses
`context.Background()`.

### Memory limits

Memory consumption should be bounded by:

- the scanner buffer;
- one source line;
- output upload buffers;
- ETL metadata and de-duplication state.

The current maximum line size is 10 MiB. It should become configurable with a
safe default because a single accepted line determines the scanner's potential
memory use.

### Temporary storage

Cloud sources should stream directly and should not rely on Lambda `/tmp` or the
Azure Functions temporary directory. A temporary-download mode is outside the
initial scope and should only be added for formats that require seeking.

### Authentication

Use standard provider identity chains:

- AWS Lambda execution roles and the AWS default credential chain;
- Azure managed identity and `DefaultAzureCredential`;
- developer profiles or environment credentials for local execution.

Avoid logging signed URLs, authorization headers, connection strings, or
credentials.

## Errors and Cleanup

The reader must distinguish errors occurring while opening a source from errors
that occur partway through scanning it.

Cleanup must be attempted even when processing fails:

- close the S3 response body, Azure response body, or local file;
- cancel in-flight provider operations through the context;
- abort an incomplete output upload;
- finalize or remove error-report artifacts as appropriate;
- preserve the primary read or validation error while also reporting cleanup
  failures.

Important cases include:

- local file not found or permission denied;
- S3 bucket/key not found;
- Azure container/blob not found;
- authentication or authorization failure;
- throttling and transient connection failure;
- connection loss after some lines have been processed;
- context cancellation or deadline expiry;
- scanner token exceeding the configured maximum;
- empty object;
- object deleted or replaced while being read;
- failure closing the response body.

The first implementation should not silently resume a partially processed
stream. Retrying a stream after ETL state has advanced can duplicate rows and
produce inconsistent output. Safe resumability requires explicit checkpointing
and is a separate feature.

## Consistency and Object Versioning

Where supported, allow callers to identify an immutable object version:

- S3 `versionId`;
- Azure blob version ID or snapshot.

For non-versioned objects, record useful provider metadata when opening the
source, such as ETag and content length. This helps diagnose changes to an
object during or between runs.

These values can later be included in ETL result metadata, but they should not
be required for the initial implementation.

## Compression

Transparent compression is not required for the first cloud-reader migration.
The design should allow a decompression layer between `Source.Open` and the line
scanner:

```text
cloud response body -> optional decompressor -> line scanner
```

Gzip can be added later without changing S3 or Azure source implementations.
Archive formats containing multiple files require a separate selection policy
and are outside the initial scope.

## Testing Strategy

### Unit tests

- source configuration normalization and validation;
- legacy string source compatibility;
- filename and location calculation;
- the shared scanner with local and in-memory streams;
- CRLF and final-line behavior;
- maximum-line-size errors;
- close behavior after success and failure;
- context cancellation;
- provider error translation.

Provider clients should be injected behind narrow interfaces so unit tests do
not require real cloud accounts.

### Integration tests

Optional integration suites should verify:

- S3 streaming against a test bucket or compatible local service;
- Azure Blob streaming against a test container or emulator;
- large objects are processed without memory growth proportional to file size;
- cancellation closes the stream and stops processing;
- source stream failures abort the corresponding output upload.

Integration tests should be opt-in and use isolated object names with automatic
cleanup.

### End-to-end combinations

At minimum, test these paths:

| Source | Output |
|---|---|
| Local | Local |
| S3 | Local |
| Azure Blob | Local |
| Local | S3 |
| Local | Azure Blob |
| S3 | Azure Blob |
| Azure Blob | S3 |

The cross-cloud cases confirm that source and output abstractions are genuinely
independent.

## Implementation Phases

### Phase 1: Extract the shared stream scanner

- Introduce the `Source` interface.
- Move scanner ownership out of `LocalFileReader`.
- Implement `LineReader` over any `io.ReadCloser`.
- Adapt the local source without changing ETL behavior.
- Add compatibility and golden tests.

Estimated effort: 1–2 days.

### Phase 2: Normalize source configuration

- Add typed source configuration.
- Accept the legacy local source string.
- Add validation and the source factory.
- Add destination-neutral `Location` terminology while preserving compatibility
  methods if necessary.

Estimated effort: 1 day.

### Phase 3: Add S3 streaming

- Add the AWS SDK dependency and injectable client boundary.
- Implement `GetObject` response streaming.
- Use the default credential chain.
- Add cancellation, close, error, and mock-client tests.
- Add an opt-in integration test.

Estimated effort: 1–2 days.

### Phase 4: Add Azure Blob streaming

- Add Azure SDK dependencies and an injectable client boundary.
- Implement streaming download.
- Use managed identity/default credentials.
- Add cancellation, close, error, and mock-client tests.
- Add an opt-in integration test.

Estimated effort: 1–2 days.

### Phase 5: Harden serverless execution

- Thread `context.Context` through the complete ETL lifecycle.
- Make cleanup resilient to multiple failures.
- Add configurable maximum line size.
- Add memory, cancellation, timeout, and cross-cloud tests.
- Document Lambda and Azure Functions usage.

Estimated effort: 2–3 days.

## Overall Estimate

A production-ready implementation for streaming local, S3, and Azure Blob
sources is expected to take approximately one week, including compatibility,
tests, and serverless hardening.

The critical architectural step is separating byte-stream acquisition from line
scanning. Once that boundary exists, additional sources such as HTTP, SFTP, GCS,
or caller-provided `io.Reader` implementations can be added without changing
the ETL processing loop.
