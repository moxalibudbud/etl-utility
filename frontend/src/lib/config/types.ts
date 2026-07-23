// Mirrors the wire shape of etl.Config (go/etl/run.go), reader.SourceConfig
// (go/reader/sourceconfig.go), writer.OutputConfig (go/writer/writer.go), and
// line.LineConfig (go/line/options.go). Field presence follows the Go json
// tags: fields with `omitempty` are optional here, fields without it are
// always serialized (and so required, even when empty).

export type SourceType = 'local' | 'azure-blob'
export type DestinationType = 'local' | 'azure-blob'

export interface AzureAuth {
  accountName?: string
  accountKey?: string
  connectionString?: string
  sasToken?: string
}

export interface SourceConfig {
  type?: SourceType
  path?: string
  url?: string
  auth?: AzureAuth
}

export interface DestinationConfig {
  type?: DestinationType
  path?: string
  url?: string
  auth?: AzureAuth
}

export interface OutputConfig extends DestinationConfig {
  fileGenerator: string
  filename: string
  separator: string
  header: string
  footer: string
  template: string
  arrayField: string
  uniqueKey: string
  metadata: Record<string, unknown>
  options?: { errorReport?: boolean; [key: string]: unknown }
  structuredTemplate?: StructuredTemplate
}

// Mirrors go/writer/json_template.go's StructuredNode/StructuredTemplate: a
// typed alternative to the string `template`, additive and mutually
// exclusive with it (enforced by the writer, not by decode). `value` is a
// template expression string for string/number/boolean, always absent for
// null, and arbitrary JSON for literal.
export type StructuredNodeType = 'string' | 'number' | 'boolean' | 'null' | 'literal'

export interface StructuredNode {
  type: StructuredNodeType
  value?: unknown
}

export type StructuredTemplate = Record<string, StructuredNode>

export interface Mapping {
  out: string
  src: string
}

export interface LineConfig {
  columns: string[]
  mandatoryFields: string[]
  identifierMappings: Mapping[]
  outputMappings: Mapping[]
  separator: string
  withHeader: boolean
}

export interface Options {
  line: LineConfig
  rejectOnInvalidRow: boolean
}

export interface Config {
  source: SourceConfig
  output: OutputConfig
  options: Options
}

export type MappingKind = 'column' | 'literal' | 'function'

/** Mirrors line/mapping.go's mapWithDefault: a src wrapped in [...] is a
 * function template, a src matching a known column is a column reference,
 * anything else is a literal default value. */
export function classifyMapping(src: string, columns: string[]): MappingKind {
  if (src.startsWith('[') && src.endsWith(']')) return 'function'
  if (columns.includes(src)) return 'column'
  return 'literal'
}
