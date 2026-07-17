# Azure Blob output

One config per authentication mode recognized by `azureauth.AzureAuth.Type()`
([go/azureauth/azureauth.go](../../go/azureauth/azureauth.go)). Each config
reads a local file and uploads the rendered output as a single block blob:
the `url` is a container/prefix, and the rendered `filename` is appended to
it. Replace the `<account>`, `<container>`, and credential placeholders and
the local source path before running, and build the binary first:

```
go build -o go/bin/etl ./go/cmd
./go/bin/etl -config samples/azure-blob-output/config.shared-key.json
```

| File | Auth mode | Notes |
|---|---|---|
| `config.shared-key.json` | `accountName` + `accountKey` | Both fields are required together. |
| `config.connection-string.json` | `connectionString` | Takes precedence over shared key / SAS if more than one is set. |
| `config.sas-token.json` | `sasToken` | Query string only (leading `?` optional); appended to the destination blob URL. |
| `config.default-credential.json` | none (`auth` omitted) | Uses `azidentity.DefaultAzureCredential` — managed identity, `az login`, or environment service principal. If the `url` already carries its own `sig=` query parameter, that SAS is used directly instead. |

Source and output each carry their own `auth`, so a run can also read from one
storage account and write to another — combine a `source` from
[`samples/azure-blob`](../azure-blob) with an `output` from here.

These are reference configs, not fixtures — running them requires a real
storage account (or an emulator such as Azurite) reachable at the configured
URL. Error reports always stay on local disk. See
[`docs/output-file-improvement.md`](../../docs/output-file-improvement.md)
for the broader output-migration design these build on.
