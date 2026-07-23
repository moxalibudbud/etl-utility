# Frontend Dev — Last Session Summary

Context for picking this work back up. Covers the Config Builder work built
across sessions on top of the existing GoGlatFile Portal boilerplate. This
supersedes the previous version of this file — the Summary tab is now wired
to live state, the Source/Output tabs both author a `type`, and a
`output.template` editor exists.

## Goal being worked toward

[docs/config-builder-ui-improvement.md](../docs/config-builder-ui-improvement.md)
describes a web UI that builds an ETL `Config` (the JSON request defined in
`go/etl/run.go`) through a form and sample-file uploads, instead of
hand-writing JSON. Three parts of `Config`: `source`, `output`,
`options` (`line` + `rejectOnInvalidRow`).

This repo's `frontend/` already existed before this work as a *different*
app ("GoGlatFile Portal") — a schema-driven CSV mapping tool for a fixed set of
customer file schemas (`frontend/src/lib/schema/`). Per `frontend/AGENTS.md`,
the Config Builder is being added **alongside** it in the same app/stack
(Vite + React 19 + TypeScript + React Router SPA + shadcn/ui + Tailwind 4),
not replacing it.

**Everything below is a frontend-only prototype.** No backend for this tool
exists yet — see "Go shape notes" for what's still open on that side.

## What we've done

### Types and Go alignment

- **Explored the Go core** (`go/etl/run.go`, `go/reader/sourceconfig.go`,
  `go/writer/writer.go`, `go/line/options.go`, `go/writer/render.go`,
  `go/template/field.go`, `go/template/function.go`) to pin down the exact
  wire shape, validation rules, and templating semantics `Config` requires —
  see "Go shape notes" below.
- **TS types mirroring the Go structs** exactly, in
  `frontend/src/lib/config/types.ts` (`Config`, `SourceConfig`,
  `OutputConfig`, `LineConfig`, `Mapping`, plus `classifyMapping()` mirroring
  `line/mapping.go`'s column/literal/`[func ...]` resolution).

### Page and tabs

- **`/config-builder` route** (`frontend/src/router.tsx`) and page
  (`frontend/src/pages/ConfigBuilder.tsx`), with `Source` / `Output` /
  `Summary` tabs (existing `Tabs` primitive, base-ui under the hood).
- **Fixed a real bug**: base-ui's `Tabs.Panel` unmounts inactive panels by
  default (`keepMounted` defaults to `false`), which was silently wiping each
  builder's local state on every tab switch. Fixed by adding `keepMounted` to
  all three `TabsContent` elements.
- **The Summary tab is now live**, not mock data. `ConfigBuilder.tsx` holds
  `sourceConfig` / `lineConfig` / `outputConfig` state, lifted from the two
  builders via `onSourceChange` / `onChange` callbacks, and composes them
  into one `Config` (`source` + `output` + `options.line` +
  `rejectOnInvalidRow: false`) fed to `ConfigurationSummary`.
- **Considered and declined client-side draft persistence** (localStorage).
  A refresh resetting the builder forms is acceptable — a `Config` may
  eventually be loaded from outside the browser entirely, which is a cleaner
  source of truth than a local draft. No code exists for this.

### Source tab (`LineConfigBuilder.tsx`)

- Reuses the existing `FileUpload` component (from the GoGlatFile Portal's
  `components/transform/`) to get columns/separator/header from an uploaded
  sample source file, then checkbox-driven `mandatoryFields` and
  `identifierMappings` (pass-through `{out: col, src: col}` per checked
  column). `outputMappings` is intentionally hidden/hardcoded to `[]` — the
  engine's documented behavior when it's empty is to fall through to all
  source columns in order.
- **`Data Source` type select** (`SourceType`: `local` / `azure-blob`) —
  only `type` is authored here; `path`/`url`/`auth` are populated at
  runtime, not in this tool. Exposed via a new `onSourceChange` callback so
  the page can compose `Config.source`.
- **Builder/Preview 2-column layout**: left column is the upload + type +
  checkboxes + Save-adjacent controls; right column is `options.line preview`
  (`LineConfigSummary`), the identifier `MappingTable`, and the raw JSON
  panel — mirrors the Output tab's layout (see below).

### Output tab (`OutputConfigBuilder.tsx`)

- `fileGenerator` `Select` restricted to the two values the Go core actually
  builds a writer for (`default-generator`, `json-generator`) — anything
  else is a `Permanent` error in `writer.go`.
- **`Output Destination` type select** (`DestinationType`), same treatment
  as the Source tab's — only `type` is authored, `path`/`url`/`auth` stay
  runtime-populated.
- `Filename` and `Footer` share a `TemplatedTextField` component: free text
  plus a searchable insert combobox (see "Combobox" below).
- **`output.template` is now a built editor**, not just a hidden `''`. One
  `TemplatedTextField` renders per header column (from the sample output
  file's columns, in order); each segment can reference a source column
  (`{ITEM}`), a metadata key, a `[func ...]` token, or literal text. The
  segments join with `separator` into `output.template`. If every segment is
  left blank, `template` stays `''` so the writer falls back to its default
  row-building behavior instead of emitting an all-empty row. Gated behind
  `columns.length > 0` (needs a sample output file first).
- `MetadataKeysEditor`: **key names only**, no values — `output.metadata` is
  populated at runtime by the pipeline, not authored in this tool. The keys
  just tell `TemplatedTextField` which metadata tokens are valid to insert.
  `outputConfig.metadata` itself always stays `{}`.
- `Unique key` `Select`, sourced from the **Source tab's columns**, not the
  output file's — confirmed in `go/writer/render.go` that `UniqueKey` is
  looked up as `sl.JSONLine[UniqueKey]`, and `JSONLine` is keyed by
  `options.line.columns`.
- Sample **output** file upload (also via `FileUpload`) derives `header` as
  the sample's columns rejoined with the detected separator, and prefills
  `filename` from the uploaded file's own name (only if `filename` is still
  blank, so a later manual edit is never clobbered by re-uploading).
- JSON-generator mode hides all delimited-only fields (`Footer`, `Template`,
  `Sample output file`/`header`, `Unique key`) per the doc's rule and
  `json_writer.go`'s explicit rejection of `uniqueKey`/`footer`. Sample-output
  scaffolding for the JSON generator itself (template + `arrayField`
  inference from a sample JSON document) is still not implemented.
- **Builder/Preview 2-column layout**, with the Preview column `sticky top-6
  self-start` so it stays in view while filling in the (potentially long)
  per-column Template section on the left.

### Save/persist — consolidated to the Summary tab

- `LineConfigBuilder` and `OutputConfigBuilder` **no longer have their own
  Save buttons or `savedAt` state** — they were removed along with
  `saveLineConfig`/`saveOutputConfig`.
- `frontend/src/lib/config/persist.ts` now exports a single
  `saveConfig(config: Config)`, which just `console.log`s the assembled
  `Config` — standing in for a future backend call.
- `ConfigurationSummary.tsx` is now **the only place** with a Save button /
  `savedAt` state, at the top of the tab, calling `saveConfig(config)` against
  the fully composed `Config`.

### Summary tab layout (`ConfigurationSummary.tsx`)

- **2 columns**: left is "Inbound settings" (`OptionsSummary` + both
  `MappingTable`s — everything driven by the Source tab / `options.line`),
  right is "Outbound settings" (`OutputSummary`). The full raw-JSON panel
  spans below both.
- Both columns are visually highlighted via `Section`'s new
  `borderClassName` prop: **Inbound = 2px red border, Outbound = 2px green
  border** (`border-2 border-red-500` / `border-2 border-green-500`).

### Shared building blocks

- **`Section.tsx`** (`frontend/src/components/config/Section.tsx`) grew
  three optional props beyond `title`/`meta`/`children`:
  `titleClassName` (used for bold "Builder"/"Preview"/section headers),
  `borderClassName` (overrides the content box's border — default
  `border-border`), and `className` (extra classes on the outer `<section>`,
  used for `sticky top-6 self-start` on the Output tab's Preview column).
- **Read-only summary/display components**
  (`frontend/src/components/config/`): `Section`/`FieldRow` (layout),
  `OutputSummary`, `LineConfigSummary` + `OptionsSummary`, `MappingTable`
  (ordered, numbered, kind-badged), `ConfigJsonPanel` (generic raw-JSON
  `<details>` viewer), and `ConfigurationSummary` (composes all of the
  above). **`SourceSummary.tsx` was deleted** — `config.source` isn't shown
  in the Summary tab's display components (only in the raw JSON panel);
  `resolveAuthMode`/`SourceConfig`/`AzureAuth` types were kept since
  `OutputConfig` (via `DestinationConfig`) still needs them.
- **`destinationTypeLabel()` was added to `types.ts` and then reverted** at
  the user's request — `OutputSummary` shows the raw `output.type` value
  (`"local"` / `"azure-blob"` / `"inferred"`), not a humanized label. Worth
  remembering if a similar "friendly label" request comes up again — the
  user wants raw enum values in this summary, not translated strings.

### Combobox (new): searchable insert instead of a button cloud

`TemplatedTextField.tsx` originally rendered every insertable token
(function templates, metadata keys, source columns) as a wrapping row of
small buttons — this got unwieldy once source-column and per-template-row
tokens were added. It's now a searchable, grouped combobox:

- **`frontend/src/components/ui/combobox.tsx`**, **`input-group.tsx`**, and
  **`textarea.tsx`** were added via the shadcn CLI (`Combobox`,
  `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`,
  `ComboboxGroup`, `ComboboxLabel`, `ComboboxCollection`, `ComboboxEmpty`,
  plus chips/clear/separator variants not currently used), wrapping
  `@base-ui/react/combobox`.
  - **Gotcha hit this session**: the shadcn CLI's `components.json` alias
    resolution created a literal `frontend/@/components/ui/` directory
    instead of resolving to `frontend/src/components/ui/` (the actual `@/*`
    tsconfig path alias target). The generated files were moved into
    `src/components/ui/` and the stray `@/` directory removed.
    `button.tsx`/`input.tsx` duplicates were byte-identical and discarded.
    **If installing more shadcn components, check for this same misplacement
    before assuming the CLI wrote to the right place.**
- `TemplatedTextField` now groups insertable items into **"Source columns"**,
  **"Metadata"**, and **"Functions"** (`ComboboxGroup`/`ComboboxLabel`), with
  a text-search input filtering across all three. Empty groups are filtered
  out. Selecting an item inserts its token (`{col}`,
  `[sanitizeString data.metadata.<key>]`, `[timestamp]`/`[dateTime ...]`) and
  the combobox's `value` stays pinned to `null` — this is a repeatable
  insert action, not a persistent selection.
- The field's main `Input` and the insert-`Combobox` sit side by side
  (`grid grid-cols-2 gap-2`) by default. A new `twoColumn?: boolean` prop
  (default `true`) can turn that off for single free-text fields — used for
  `Filename` (`twoColumn={false}`), which doesn't need the row treatment.

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
- **Templating layer** (`go/template/field.go`, `go/template/function.go`),
  used identically for `output.filename`, `output.header`, and
  `output.template` (`go/writer/render.go`'s `renderValueTemplate`):
  - `{path}` tokens resolve against the current row's data plus
    `{metadata: opts.Metadata}` via `ReplaceWithData` — a bare `{ITEM}`
    resolves straight off the source row, `{metadata.key}` (or
    `{data.metadata.key}`) resolves a metadata value. No wrapper function
    needed for either.
  - `[func arg ...]` tokens resolve via `ReplaceWithFunction` —
    `timestamp`, `dateTime [format] [tz]`, `sanitizeString <s>`,
    `removeWhiteSpaces <s>`, `replaceString <s> a b`. Args prefixed `data.`
    are resolved against the same data map first.
  - `output.template`, when non-empty, replaces the writer's default
    row-building (`buildLineFromOutput`, which just joins `sl.Output()` by
    `separator`) entirely — it renders the **whole row** as one templated
    string, not per-column.
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
- Sample-output scaffolding for the **JSON generator** (template +
  `arrayField` inference from a sample JSON document) — explicitly noted as
  "not implemented yet" in the Output tab's UI. The delimited generator's
  `template` editor (per-header-column) is done; JSON's is not.
- `source.path` / `source.url` / `source.auth` and `output.path` /
  `output.url` / `output.auth` are **not authored anywhere** — only `type`
  is. These stay runtime-populated by design (per explicit user direction),
  not a gap to close later.
- No `/api/validate` equivalent — the builder doesn't yet enforce the Go
  `Validate()` rules client-side (e.g. rejecting `auth` on a local source).
- No persistence of any kind — a refresh clears in-progress form state by
  design, for now. `saveConfig()` only logs to the console.
- `frontend/src/lib/config/mock.ts` still exists but is now fully unused
  (nothing imports `mockConfig` anymore) — a candidate for deletion next
  time this area is touched, just hasn't been asked for yet.

## Where things live

- Page: `frontend/src/pages/ConfigBuilder.tsx`
- Types: `frontend/src/lib/config/types.ts`
- Unused mock data (see gaps above): `frontend/src/lib/config/mock.ts`
- Auth-mode display helper: `frontend/src/lib/config/auth.ts`
- Save stub (console.log only): `frontend/src/lib/config/persist.ts`
  (`saveConfig`)
- Display components: `frontend/src/components/config/OutputSummary.tsx`,
  `LineConfigSummary.tsx`, `OptionsSummary.tsx`, `MappingTable.tsx`,
  `ConfigJsonPanel.tsx`, `Section.tsx`, `ConfigurationSummary.tsx`
- Interactive builders: `frontend/src/components/config/LineConfigBuilder.tsx`,
  `OutputConfigBuilder.tsx`, `TemplatedTextField.tsx`,
  `MetadataKeysEditor.tsx`
- Combobox UI primitives (shadcn-generated, wraps `@base-ui/react/combobox`):
  `frontend/src/components/ui/combobox.tsx`, `input-group.tsx`, `textarea.tsx`

## Note on concurrent edits

Across sessions, files were occasionally modified outside of the assistant's
own edits (the user's own IDE session running in parallel, and periodic
commits on branch `go`) — layout tweaks (2-column Builder/Preview splits,
`titleClassName`/section renames like "Data Source"/"Output Destination"),
formatting (semicolons added throughout, likely a formatter/linter pass),
and the shadcn combobox install landing in a stray `@/` directory that had to
be relocated. None of substance was reverted; the `frontend/` tree may have
moved further since this summary was written — re-check current file
contents before assuming this summary is exhaustive.
