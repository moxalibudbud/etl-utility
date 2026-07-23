import { EMPTY_SOURCE_CONFIG, EMPTY_LINE_CONFIG, EMPTY_OUTPUT_CONFIG } from './defaults'
import type { Config, LineConfig, OutputConfig, SourceConfig } from './types'

export interface SavedConfig {
  id: string
  name: string
  config: Config
}

// Stand-in for a future "list configs" backend endpoint — persistence is
// still an open question in docs/config-builder-ui-improvement.md. These are
// real sample configs (frontend/public/mockdata/*.json) served as static
// assets rather than bundled, so they can be edited/added without a rebuild —
// closer to what fetching a real backend's list response will look like.
const SAMPLE_FILES: { id: string; name: string; path: string }[] = [
  { id: 'object-form', name: 'Local flat file', path: '/mockdata/config.object-form.json' },
  { id: 'structured-json', name: 'Local JSON generator (structured template)', path: '/mockdata/config.structured-json.json' },
  {
    id: 'blob-connection-string',
    name: 'Azure Blob flat file (connection string)',
    path: '/mockdata/config.blob.connection-string.json',
  },
  {
    id: 'blob-structured-json',
    name: 'Azure Blob JSON generator (structured template)',
    path: '/mockdata/config.blob.structured-json.json',
  },
]

interface RawConfig {
  source?: Partial<SourceConfig>
  output?: Partial<OutputConfig>
  options?: { line?: Partial<LineConfig>; rejectOnInvalidRow?: boolean }
}

// The sample files follow the Go wire shape's `omitempty` rules, so many
// fields are legitimately absent (e.g. `type`, `arrayField`, `uniqueKey`) —
// fill in this tool's own "nothing authored yet" defaults so a loaded config
// behaves exactly like a freshly-started one that just hasn't touched those
// fields, rather than carrying `undefined` into the builders' state.
function normalizeConfig(raw: RawConfig): Config {
  return {
    source: { ...EMPTY_SOURCE_CONFIG, ...raw.source },
    output: { ...EMPTY_OUTPUT_CONFIG, ...raw.output },
    options: {
      line: { ...EMPTY_LINE_CONFIG, ...raw.options?.line },
      rejectOnInvalidRow: raw.options?.rejectOnInvalidRow ?? false,
    },
  }
}

export class LoadSavedConfigsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'LoadSavedConfigsError'
  }
}

export async function loadSavedConfigs(): Promise<SavedConfig[]> {
  return Promise.all(
    SAMPLE_FILES.map(async (file) => {
      let response: Response
      try {
        response = await fetch(file.path)
      } catch (err) {
        throw new LoadSavedConfigsError(`Could not load ${file.path}.`, { cause: err })
      }
      if (!response.ok) {
        throw new LoadSavedConfigsError(`Could not load ${file.path} (${response.status}).`)
      }
      const raw: RawConfig = await response.json()
      return { id: file.id, name: file.name, config: normalizeConfig(raw) }
    }),
  )
}
