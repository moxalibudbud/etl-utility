import type { LineConfig, OutputConfig, SourceConfig } from './types'

// Shared "nothing authored yet" defaults — used both for a brand-new
// ConfigBuilder and to fill in fields a loaded sample config's wire JSON
// legitimately omits (the Go side's `omitempty` tags mean an absent field
// isn't an error, just "not set").
export const EMPTY_SOURCE_CONFIG: SourceConfig = {
  type: 'local',
}

export const EMPTY_LINE_CONFIG: LineConfig = {
  columns: [],
  mandatoryFields: [],
  identifierMappings: [],
  outputMappings: [],
  separator: '',
  withHeader: true,
}

export const EMPTY_OUTPUT_CONFIG: OutputConfig = {
  fileGenerator: 'default-generator',
  filename: '',
  separator: '',
  header: '',
  footer: '',
  template: '',
  arrayField: '',
  uniqueKey: '',
  metadata: {},
}
