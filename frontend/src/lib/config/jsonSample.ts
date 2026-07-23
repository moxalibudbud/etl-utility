import type { StructuredTemplateRow } from '@/components/config/StructuredTemplateEditor'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Infers one row's shape from a sample value — name + JSON type only, never a
// {sourceColumn}/[func ...] guess. Only `boolean` and `literal` get a
// prefilled value, because those are legitimate starting constants (a
// literal node is meant to be fixed content; a boolean node in this editor is
// constant-only already). string/number are left blank for the user to map.
function inferRow(name: string, value: unknown): StructuredTemplateRow {
  const base = { id: crypto.randomUUID(), name, value: '', boolValue: false }
  if (value === null) return { ...base, type: 'null' }
  switch (typeof value) {
    case 'string':
      return { ...base, type: 'string' }
    case 'number':
      return { ...base, type: 'number' }
    case 'boolean':
      return { ...base, type: 'boolean', boolValue: value }
    default:
      // Nested object/array — no recursive typed templating yet
      // (docs/structured-typed-json-template-refactor.md Phase 5), so this
      // becomes a literal the user can edit or replace.
      return { ...base, type: 'literal', value: JSON.stringify(value, null, 2) }
  }
}

export interface InferredJsonSample {
  /** Rows for the Root object editor — the sample's top-level fields other than the array field. */
  headerRows: StructuredTemplateRow[]
  /** The top-level key holding the row array, if one was found. */
  arrayField: string
  /** Rows for the Array object editor — inferred from the array's first element. */
  structuredRows: StructuredTemplateRow[]
}

const EMPTY_INFERENCE: InferredJsonSample = { headerRows: [], arrayField: '', structuredRows: [] }

// Reads a sample JSON *document* — root object plus the array of rows — and
// splits it into what seeds the Root object editor vs. the Array object
// editor. The first top-level array found is treated as the row array; a
// sample that's just a bare array of rows (no root wrapper) only seeds the
// Array object rows.
export function inferFromJsonSample(data: unknown): InferredJsonSample {
  if (Array.isArray(data)) {
    const first: unknown = data[0]
    return {
      ...EMPTY_INFERENCE,
      structuredRows: isPlainObject(first) ? Object.entries(first).map(([k, v]) => inferRow(k, v)) : [],
    }
  }

  if (!isPlainObject(data)) return EMPTY_INFERENCE

  let arrayField = ''
  let structuredRows: StructuredTemplateRow[] = []
  const rootEntries: Array<[string, unknown]> = []

  for (const [key, value] of Object.entries(data)) {
    if (arrayField === '' && Array.isArray(value)) {
      arrayField = key
      const first: unknown = value[0]
      structuredRows = isPlainObject(first) ? Object.entries(first).map(([k, v]) => inferRow(k, v)) : []
    } else {
      rootEntries.push([key, value])
    }
  }

  return {
    headerRows: rootEntries.map(([name, value]) => inferRow(name, value)),
    arrayField,
    structuredRows,
  }
}
