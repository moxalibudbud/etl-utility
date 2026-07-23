# Sample configurations

Runnable and reference `etl.Config` JSON files, grouped by source type. These
complement the Go-specific fixtures under
[`go/samples`](../go/samples), which predate the `SourceConfig` object form
described in [`docs/source-file-improvement.md`](../docs/source-file-improvement.md).

- [`local/`](local) — the local-file source, using the new object form
  (`{"type": "local", "path": "..."}`). The legacy plain-string form
  (`"source": "in.csv"`) still works and is shown in
  [`go/samples/csv-to-csv`](../go/samples/csv-to-csv).
- [`azure-blob/`](azure-blob) — the Azure Blob source, one file per
  authentication mode.
- `config.structured-json.json` (in both `local/` and `azure-blob/`) —
  `json-generator` output using the typed `output.structuredTemplate` field
  instead of the string `template`; see
  [`docs/usage.md`](../docs/usage.md) §4.3.2.

All paths inside these configs are relative to the repository root; build and
run the binary from there:

```
go build -o go/bin/etl ./go/cmd
./go/bin/etl -config samples/local/config.object-form.json
```

Or run directly with go run:

```
go run ./cmd -config /Users/dev/dev/etl-utility/sample-config/local/config.object-form.json
```