# Deployment Guide — ETL Utility

This guide covers the three supported ways to run the Go ETL entrypoints:

- AWS Lambda Function URL
- A normal long-running HTTP server
- A compiled command-line binary

All three surfaces accept the same canonical `etl.Config` JSON shape documented
in [usage.md](usage.md): `source`, `output`, and `options`. They all funnel into
the same `etl.Run(cfg)` core.

---

## 1. Deploy in AWS Lambda

The Lambda entrypoint lives at `go/cmd/lambda`. It is designed for Lambda
Function URLs and accepts the ETL config as the HTTP request body.

### 1.1 Build the Lambda artifact

From the repository root:

```bash
cd go
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o ./bin/etl-lambda ./cmd/lambda
zip ./bin/lambda.zip ./bin/etl-lambda
```

Use `GOARCH=amd64` instead if your Lambda function is configured for x86_64.

### 1.2 Create/configure the Lambda function

Recommended runtime settings:

| Setting | Value |
| --- | --- |
| Runtime | `provided.al2023` |
| Architecture | `arm64` or `x86_64`, matching the build command |
| Handler | `bootstrap` |
| Package type | `.zip` |

Upload `go/lambda.zip` as the function code, or wire the same artifact into
your IaC/deployment pipeline.

Create a Lambda Function URL for the function. The handler accepts:

- `POST /`
- `POST /etl`

Any other path returns `404`. Any non-`POST` method returns `405`.

### 1.3 Invoke it

```bash
curl -X POST "$FUNCTION_URL/etl" \
  -H "content-type: application/json" \
  --data-binary @job.json
```

The body must be the canonical config:

```json
{
  "source": "/tmp/input.csv",
  "output": {
    "path": "/tmp",
    "filename": "output.csv"
  },
  "options": {
    "line": {
      "columns": ["SKU", "NAME"],
      "mandatoryFields": ["SKU"],
      "separator": ",",
      "withHeader": true
    }
  }
}
```

Lambda note: local files only exist inside the invocation environment. If you
use a local `source`, the file must already be present in the Lambda filesystem,
normally under `/tmp`. For real hosted workflows, prefer Azure Blob `source`
and/or Azure Blob `output`, or upload/download files around the invocation.
Returning `localOutputFile` from Lambda only tells you where the file was written
inside that invocation; it does not make the file accessible to the caller.

---

## 2. Deploy as a normal HTTP server

The HTTP entrypoint lives at `go/cmd/http`. It runs a standard Go HTTP server
with:

- `POST /etl` — run the ETL using the JSON request body
- `GET /health` — health check

### 2.1 Build the HTTP binary

```bash
cd go
go build -o ./bin/etl-http ./cmd/http
```

### 2.2 Run it

```bash
HTTP_ADDR=:8080 ./bin/etl-http
```

If `HTTP_ADDR` is not set, it defaults to `:8080`.

### 2.3 Invoke it

```bash
curl -X POST "http://localhost:8080/etl" \
  -H "content-type: application/json" \
  --data-binary @job.json
```

Health check:

```bash
curl "http://localhost:8080/health"
```

The server enforces a 1 MiB request body limit for the config payload. The
source file itself should be referenced by path or blob URL in the config; it is
not uploaded as the request body.

For production hosting, run the binary under your normal process manager or
container platform. The application should have read access to local source
paths, write access to local output paths, and any required Azure credentials
for blob sources/destinations.

---

## 3. Compile and execute as a binary

The CLI entrypoint lives at `go/cmd`. It reads config from a JSON file or stdin
and writes the JSON `Result` to stdout.

### 3.1 Build the binary

```bash
cd go
go build -o ./bin/etl ./cmd
```

### 3.2 Run with a config file

```bash
./bin/etl -config job.json
```

### 3.3 Override the source path

```bash
./bin/etl -config job.json -source /path/to/input.csv
```

`-source` accepts a local path or Azure Blob URL. It replaces the `source` value
from the JSON config as the legacy string form. If you need typed source config
or Azure auth, put the full `source` object in `job.json` instead.

### 3.4 Read config from stdin

```bash
./bin/etl -config - < job.json
```

Or from another process:

```bash
cat job.json | ./bin/etl -config -
```

The process exits non-zero only when the run itself fails, for example an
invalid config, missing source file, unsupported writer, or I/O error. Row
validation failures are returned in the JSON `Result`.

---

## 4. Build and verification commands

Useful checks before deployment:

```bash
cd go
go test ./...
go build ./...
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o /tmp/bootstrap ./cmd/lambda
```

The Lambda build command is a packaging smoke test; use the artifact flow in
section 1 when creating the actual zip.
