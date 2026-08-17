# Deployment Guide — ETL Utility

This guide covers the three supported ways to run the Go ETL entrypoints:

- AWS Lambda Function URL
- A normal long-running HTTP server
- A compiled command-line binary

All three surfaces accept the same canonical `etl.Config` JSON shape documented
in [usage.md](usage.md): `source`, `output`, and `options`. They all funnel into
the same `etl.Run(cfg)` core.

Section 5 covers deploying the config builder — the browser app that helps
people produce that config JSON in the first place.

---

## 1. Deploy in AWS Lambda

The Lambda entrypoint lives at `go/cmd/lambda`. It is designed for Lambda
Function URLs and accepts the ETL config as the HTTP request body.

### 1.1 Build the Lambda artifact

From the repository root:

```bash
./lambda/build.sh
```

This compiles the Lambda entrypoint from `go/cmd/lambda` and writes the runtime
artifact into the `lambda` folder:

```text
lambda/bootstrap
lambda/bootstrap.zip
```

The zip contains a root-level `bootstrap` executable, which is required for the
`provided.al2023` custom runtime.

The current script builds for `arm64`. Use `GOARCH=amd64` in
`lambda/build.sh` instead if your Lambda function is configured for x86_64.

### 1.2 Create/configure the Lambda function

Recommended runtime settings:

| Setting | Value |
| --- | --- |
| Runtime | `provided.al2023` |
| Architecture | `arm64` or `x86_64`, matching the build command |
| Handler | `bootstrap` |
| Package type | `.zip` |
| Timeout | `900` seconds |
| Region | `ap-south-1` |

Upload `lambda/bootstrap.zip` as the function code, or deploy it with:

```bash
./lambda/deploy.sh
```

`lambda/deploy.sh` currently updates the existing Lambda function named
`go-etl`:

```bash
aws lambda update-function-code \
  --function-name go-etl \
  --zip-file fileb://lambda/bootstrap.zip \
  --region ap-south-1
```

The script resolves the zip path from its own location, so it can be run from
the repository root or from inside the `lambda` folder.

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
cd ..
./lambda/build.sh
unzip -l lambda/bootstrap.zip
```

The zip listing should show a root-level `bootstrap` file.

---

## 5. Deploy the config builder as a static site

The config builder is the browser app in `frontend`. It gives people a guided
form for building an ETL config instead of hand-writing JSON.

### 5.1 What this deployment covers today

The config builder currently works end to end **without any backend of its
own**. You fill in the form, click **Copy configuration**, and the finished
config JSON lands on your clipboard. From there you paste it into a `job.json`
and run it through any of the three entrypoints above.

The app also has a **Save configuration** button, which posts the config to a
config service. That service has not been built yet. Until it exists, the Save
button will report that it could not reach the service — this is expected, and
it does not affect the copy workflow. Server-side saving is planned separately;
see the open questions in
[config-builder-ui-improvement.md](config-builder-ui-improvement.md).

So this section deploys the app as a **static site**: a set of plain HTML, CSS,
and JavaScript files served straight from storage. There is no server process
to run, patch, or pay for while it sits idle.

### 5.2 Current host: Vercel

The config builder is deployed on Vercel. It was chosen to get the tool in front
of people quickly: you connect the repository once, and from then on every push
publishes a new version with no build or upload steps to run by hand.

Two things worth knowing up front.

**HTTPS comes as standard, and the tool depends on it.** This matters more than
it sounds. Browsers only allow a page to write to the clipboard over a secure
connection, so on a plain `http://` address the **Copy configuration** button
would fail every time — which is the entire workflow described above. Vercel
serves every deployment over HTTPS, so this is handled.

**The free plan does not cover business use.** Vercel's Hobby plan is licensed
for personal, non-commercial projects only. Because this is an internal company
tool, it belongs on a paid Pro seat. Budget for that rather than being surprised
by it later. Section 5.7 covers the cheaper long-term option.

### 5.3 Before your first deploy

**Decide the config service address now, not later.** The app reads
`VITE_CONFIG_API_URL` when it is *built*, and the value gets baked into the
published files. You cannot change it afterwards by adjusting a setting on the
running site — changing it means building and publishing again. The default in
`frontend/vars.env` is `http://localhost:3000`, which is a developer machine
address and will not work for anyone else.

While the copy-only workflow is what you need, this value does not matter in
practice, because nothing calls that service yet.

### 5.4 Project settings

Create the Vercel project from this repository once, with these settings:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `pnpm build` (the default for this project) |
| Output directory | `dist` |
| Environment variable | `VITE_CONFIG_API_URL` — leave unset for now |

The root directory setting is the important one. This repository holds the Go
utility and the browser app side by side, so Vercel needs to be told to build
only the `frontend` folder and ignore everything else.

### 5.5 Page addresses on refresh

The repository includes `frontend/vercel.json`, which redirects every incoming
address to the app itself:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This file is required, not optional polish. The app handles its own page
navigation inside the browser, so addresses like `/config-builder` and
`/configs` are real pages to a visitor but are not files that exist on the
server. Without this rule, anyone who refreshes the page or opens a shared link
gets a "page not found" error instead of the app. Genuine files such as
stylesheets and images are still served normally — the rule only applies to
addresses that do not match a real file.

### 5.6 Publishing an update

Pushing to the repository's main branch publishes to the live site. Pushing any
other branch, or opening a pull request, gets its own temporary preview address
you can share for review without touching the live one.

To publish from your own machine instead, run `vercel --prod` from the
`frontend` folder.

Before pushing, it is worth running the build locally to catch problems early:

```bash
cd frontend
pnpm install
pnpm build
```

The production build runs a TypeScript check, and any type error stops it — the
same check Vercel runs, so a failure here is a failed deployment there.

### 5.7 Moving off Vercel later

Nothing about the app is tied to Vercel. The build produces plain HTML, CSS, and
JavaScript files that any static host can serve.

The natural destination later is an S3 bucket behind a CloudFront distribution,
in the same AWS account as the Lambda function from section 1. That removes the
per-seat cost, keeps everything on one bill and one set of credentials, and at
realistic traffic for an internal tool costs close to nothing. It takes longer to
set up, which is why it is not the starting point. Two settings carry over as
direct equivalents: `index.html` as the default root object, and `403` and `404`
responses rewritten to `/index.html` to replace the rewrite rule in 5.5.

### 5.8 When the config service is ready

No decision here needs to be made now, and nothing above needs to be undone.

When the service exists, add a rule that routes a path such as `/config` to it,
alongside the existing rule that serves the app. The app and the service then
share one address, which avoids a class of cross-origin browser errors entirely.
At that point you set `VITE_CONFIG_API_URL` to that shared path and publish
again. The **Save configuration** button starts working, and the application
code itself does not change.
