# Azure Blob source

One config per authentication mode recognized by `reader.AzureAuth.Type()`
([go/reader/azureauth.go](../../go/reader/azureauth.go)). Replace the
`<account>`, `<container>`, and credential placeholders before running, and
build the binary first:

```
go build -o go/bin/etl ./go/cmd
./go/bin/etl -config samples/azure-blob/config.shared-key.json
```

| File | Auth mode | Notes |
|---|---|---|
| `config.shared-key.json` | `accountName` + `accountKey` | Both fields are required together. |
| `config.connection-string.json` | `connectionString` | Takes precedence over shared key / SAS if more than one is set. |
| `config.sas-token.json` | `sasToken` | Query string only (leading `?` optional); appended to the blob URL. |
| `config.default-credential.json` | none (`auth` omitted) | Uses `azidentity.DefaultAzureCredential` — managed identity, `az login`, or environment service principal. If the `url` already carries its own `sig=` query parameter, that SAS is used directly instead. |

These are reference configs, not fixtures — there is no bundled sample blob,
so running them requires a real storage account (or an emulator such as
Azurite) reachable at the configured URL. See
[`docs/source-file-improvement.md`](../../docs/source-file-improvement.md)
for the broader source-migration design these build on.
