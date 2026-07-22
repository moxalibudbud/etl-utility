# Frontend Dev — Last Session Summary

Context for picking this work back up. Covers the Config Builder work built
this session on top of the existing Octo+ Portal boilerplate.

## Goal being worked toward

[docs/config-builder-ui-improvement.md](../docs/config-builder-ui-improvement.md)
describes a web UI that builds an ETL `Config` (the JSON request defined in
`go/etl/run.go`) through a form and sample-file uploads, instead of
hand-writing JSON. Three parts of `Config`: `source`, `output`,
`options` (`line` + `rejectOnInvalidRow`).

This repo's `frontend/` already existed before this session as a *different*
app ("Octo+ Portal") — a schema-driven CSV mapping tool for a fixed set of
customer file schemas (`frontend/src/lib/schema/`). Per `frontend/AGENTS.md`,
the Config Builder is being added **alongside** it in the same app/stack
(Vite + React 19 + TypeScript + React Router SPA + shadcn/ui + Tailwind 4),
not replacing it.

## What we've done

1. **Explored the Go core** (`go/etl/run.go`, `go/reader/sourceconfig.go`,
   `go/writer/writer.go`, `go/line/options.go`) to pin down the exact wire
   shape and validation rules `Config` requires — see "Go shape notes" below.
2. **Added a `/config-builder` route** (`frontend/src/router.tsx`) and page
   (`frontend/src/pages/ConfigBuilder.tsx`).
3. **Built TS types mirroring the Go structs** exactly, in
   `frontend/src/lib/config/types.ts` (`Config`, `SourceConfig`,
   `OutputConfig`, `LineConfig`, `Mapping`, plus `classifyMapping()` mirroring
   `line/mapping.go`'s column/literal/`[func ...]` resolution).
4. **Built read-only summary/display components** (`frontend/src/components/config/`):
   `Section`/`FieldRow` (layout), `SourceSummary`, `OutputSummary`,
   `LineConfigSummary` + `OptionsSummary`, `MappingTable` (ordered, numbered,
   kind-badged), `ConfigJsonPanel` (generic raw-JSON `<details>` viewer), and
   `ConfigurationSummary` (composes all of the above) — currently fed by a
   hand-written `mock.ts` Config, shown under the page's "Summary" tab,
   explicitly labeled as not wired to the interactive tabs.
5. **Built the interactive Source tab** (`LineConfigBuilder.tsx`): reuses the
   existing `FileUpload` component (from the Octo+ Portal's
   `components/transform/`) to get columns/separator/header from an uploaded
   sample source file, then checkbox-driven `mandatoryFields` and
   `identifierMappings` (pass-through `{out: col, src: col}` per checked
   column). `outputMappings` is intentionally hidden/hardcoded to `[]` — the
   engine's documented behavior when it's empty is to fall through to all
   source columns in order.
6. **Built the interactive Output tab** (`OutputConfigBuilder.tsx`):
   - `fileGenerator` `Select` restricted to the two values the Go core
     actually builds a writer for (`default-generator`, `json-generator`) —
     anything else is a `Permanent` error in `writer.go`.
   - `Filename` and `Footer` share a `TemplatedTextField` component: free
     text plus quick-insert buttons for `[timestamp]` / `[dateTime ...]`
     function templates and `data.metadata.<key>` tokens.
   - `MetadataKeysEditor`: **key names only**, no values — `output.metadata`
     is populated at runtime by the pipeline, not authored in this tool. The
     keys just tell `TemplatedTextField` which `data.metadata.<key>` tokens
     are valid to insert. `outputConfig.metadata` itself always stays `{}`.
   - `Unique key` `Select`, sourced from the **Source tab's columns**, not
     the output file's — confirmed in `go/writer/render.go` that
     `UniqueKey` is looked up as `sl.JSONLine[UniqueKey]`, and `JSONLine` is
     keyed by `options.line.columns`. `LineConfigBuilder` now takes an
     `onColumnsChange` callback so the page can lift `sourceColumns` state
     and hand it down to `OutputConfigBuilder`.
   - Sample **output** file upload (also via `FileUpload`) derives `header`
     as the sample's columns rejoined with the detected separator.
   - JSON-generator mode hides all delimited-only fields (`Footer`,
     `Sample output file`/`header`, `Unique key`) per the doc's rule and
     `json_writer.go`'s explicit rejection of `uniqueKey`/`footer`.
   - "Save configuration" currently just `console.log`s the assembled
     `OutputConfig` (see `saveOutputConfig` in `lib/config/persist.ts`) —
     standing in for a future backend call.
7. **Tabs layout**: `Source` / `Output` / `Summary`, via the existing `Tabs`
   primitive (`components/ui/tabs.tsx`, base-ui under the hood).
8. **Fixed a real bug**: base-ui's `Tabs.Panel` unmounts inactive panels by
   default (`keepMounted` defaults to `false`), which was silently wiping
   each builder's local state on every tab switch. Fixed by adding
   `keepMounted` to all three `TabsContent` elements in `ConfigBuilder.tsx`.
9. **Considered and declined client-side draft persistence.** Discussed
   using `localStorage` so a browser refresh wouldn't lose in-progress form
   state (`keepMounted` only survives tab switches, not reloads/navigation
   away). Wrote a plan for it (cleanup via TTL + clear-on-save + version
   tag), but the user decided **not** to build it — a refresh resetting the
   builder forms is acceptable. Reasoning: a `Config` may eventually be
   loaded from outside the browser entirely (a future `cmd/configui` Go
   backend, or a frontend fetcher), which is a cleaner source of truth than
   a local draft anyway, and avoids the "stale local draft silently
   clobbers a freshly-opened different config" hazard that localStorage
   would have introduced. **No code was written for this — it was fully
   reverted to "no persistence."**

## Go shape notes (source of truth — re-verify against the Go code if it moves)

- `etl.Config` (`go/etl/run.go`): exactly `{source, output, options}`, no
  other top-level keys (strict decode, unknown keys rejected).
- `reader.SourceConfig`: `{type?, path?, url?, auth?}`. Exactly one of
  `path`/`url`; `auth` only valid for `type: "azure-blob"`. **An entirely
  empty source is invalid** (unlike output).
- `writer.OutputConfig` embeds `DestinationConfig {type?, path?, url?,
  auth?}` plus `fileGenerator, filename, separator, header, footer,
  template, arrayField, uniqueKey, metadata, options?`. **An entirely empty
  output is valid** (defaults to local, OS temp dir). `template` beats
  `separator` when both are set. `fileGenerator` unsupported values ⇒
  `Permanent` error (only `""`/`default-generator`/`json-generator` work
  today). `json-generator` explicitly rejects `uniqueKey` and `footer`
  (`json_writer.go`).
- `line.LineConfig`: `{columns, mandatoryFields, identifierMappings,
  outputMappings, separator, withHeader}`. Mappings are **ordered arrays**
  of `{out, src}` — order is load-bearing (output column order). `src` is
  either a `[func ...]` template, a known source column name, or (if
  neither) a literal default — this only applies to `outputMappings`;
  `identifierMappings` is a plain keyed lookup with no template/default
  fallback.
- Validation is **distributed**, not centralized: `SourceConfig.Validate()`
  (called from `reader.New`), `DestinationConfig.Validate()` (called from
  `writer.Factory`), and `AzureAuth.Type()` (only when a blob client is
  actually built) — there's no single `Config.Validate()` to call.
  `configjson.Decode` only enforces strict JSON shape, and does so
  asymmetrically: strict at the top level and inside `source`, but
  **lenient inside `output`** (its custom `UnmarshalJSON` doesn't re-enable
  `DisallowUnknownFields`).
- **Nothing backend-side exists yet** for this tool: no `cmd/configui`, no
  `/api/infer`, `/api/validate`, `/api/preview` endpoints, no JSON-Schema/TS
  codegen from the Go structs. All of Phase 1 in the doc is still open.

## Known gaps / deliberately deferred

- `outputMappings` editor — not built; hardcoded to `[]` in the Source tab
  (falls back to raw source columns per the engine's documented default).
- Sample-output scaffolding for the JSON generator (template + `arrayField`
  inference from a sample JSON document) — explicitly noted as "not
  implemented yet" in the Output tab's UI.
- The "Summary" tab still renders a **hand-written mock Config**
  (`lib/config/mock.ts`), not the live state from the Source/Output tabs.
  Wiring those together (one shared `Config` object assembled from both
  tabs' state) hasn't been done.
- No `/api/validate` equivalent — the builder doesn't yet enforce the Go
  `Validate()` rules client-side (e.g. rejecting `auth` on a local source).
- No persistence of any kind (see item 9 above) — a refresh clears
  in-progress form state by design, for now.

## Where things live

- Page: `frontend/src/pages/ConfigBuilder.tsx`
- Types: `frontend/src/lib/config/types.ts`
- Mock data: `frontend/src/lib/config/mock.ts`
- Auth-mode display helper: `frontend/src/lib/config/auth.ts`
- Save stubs (console.log only): `frontend/src/lib/config/persist.ts`
- Display components: `frontend/src/components/config/*Summary.tsx`,
  `MappingTable.tsx`, `ConfigJsonPanel.tsx`, `Section.tsx`
- Interactive builders: `frontend/src/components/config/LineConfigBuilder.tsx`,
  `OutputConfigBuilder.tsx`, `TemplatedTextField.tsx`,
  `MetadataKeysEditor.tsx`

## Note on concurrent edits

Through this session, files were occasionally modified outside of this
conversation (the user's own IDE session running in parallel) — a duplicate
`OctoplusPortalHome.tsx` page appeared with an `/octoplus` route, `mock.ts`'s
sample values were tweaked a few times, and `ConfigBuilder.tsx`'s container
width changed. None of that was reverted; worth being aware the `frontend/`
tree may have moved further since this summary was written.
