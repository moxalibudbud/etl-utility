# Local source, object form

`config.object-form.json` is identical to
[`go/samples/csv-to-csv/config.default.json`](../../go/samples/csv-to-csv/config.default.json)
except its `source` uses the typed object form added alongside the Azure Blob
reader:

```json
"source": {
  "type": "local",
  "path": "go/samples/csv-to-csv/ItemMast_260618_001_1005.csv"
}
```

Run from the repository root:

```
go build -o go/bin/etl ./go/cmd
./go/bin/etl -config samples/local/config.object-form.json
```

The plain-string form (`"source": "path/to/file.csv"`) is still accepted for
backward compatibility; see `go/samples/csv-to-csv` for that variant.
