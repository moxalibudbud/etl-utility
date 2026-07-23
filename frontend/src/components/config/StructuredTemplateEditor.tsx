import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TemplatedTextField } from './TemplatedTextField'
import type { StructuredNodeType, StructuredTemplate } from '@/lib/config/types'

const NODE_TYPES: { value: StructuredNodeType; label: string }[] = [
  { value: 'string', label: 'string' },
  { value: 'number', label: 'number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'null', label: 'null' },
  { value: 'literal', label: 'literal (raw JSON)' },
]

// One editable row — kept separate from StructuredTemplate itself so a field
// can be renamed, retyped, or left with invalid literal JSON mid-edit without
// the map collapsing entries on a name collision. `id` is UI-only, never
// serialized.
export interface StructuredTemplateRow {
  id: string
  name: string
  type: StructuredNodeType
  /** Template expression for string/number; raw JSON text for literal; unused for boolean/null. */
  value: string
  /** Constant value for a boolean node — booleans are constant-only in this editor. */
  boolValue: boolean
}

export function newStructuredTemplateRow(): StructuredTemplateRow {
  return { id: crypto.randomUUID(), name: '', type: 'string', value: '', boolValue: false }
}

// Converts the editable row list into the wire StructuredTemplate map.
// Blank names are dropped; a literal row with unparsable JSON is dropped too
// (surfaced instead as an inline error in the editor) rather than sending a
// value the writer would reject at construction time anyway.
export function toStructuredTemplate(rows: StructuredTemplateRow[]): StructuredTemplate {
  const result: StructuredTemplate = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (name === '') continue

    switch (row.type) {
      case 'string':
      case 'number':
        result[name] = { type: row.type, value: row.value }
        break
      case 'boolean':
        result[name] = { type: 'boolean', value: row.boolValue }
        break
      case 'null':
        result[name] = { type: 'null' }
        break
      case 'literal':
        try {
          result[name] = { type: 'literal', value: JSON.parse(row.value === '' ? 'null' : row.value) }
        } catch {
          // invalid JSON mid-edit — omit until it parses
        }
        break
    }
  }
  return result
}

function literalParseError(value: string): string | null {
  if (value.trim() === '') return null
  try {
    JSON.parse(value)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON'
  }
}

interface StructuredTemplateEditorProps {
  rows: StructuredTemplateRow[]
  onChange: (rows: StructuredTemplateRow[]) => void
  metadataKeys?: string[]
  sourceColumns?: string[]
}

// Editor for output.structuredTemplate — a typed alternative to the string
// `template` for the JSON generator (go/writer/json_template.go). Field order
// doesn't matter on the wire (the writer sorts keys itself), so there's no
// reordering here, just add/remove.
export function StructuredTemplateEditor({
  rows,
  onChange,
  metadataKeys = [],
  sourceColumns = [],
}: StructuredTemplateEditorProps) {
  function addRow() {
    onChange([...rows, newStructuredTemplateRow()])
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id))
  }

  function updateRow(id: string, patch: Partial<StructuredTemplateRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const parseError = row.type === 'literal' ? literalParseError(row.value) : null
        return (
          <div key={row.id} className="space-y-2 border border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                placeholder="fieldName"
                className="font-mono text-xs"
              />
              <Select value={row.type} onValueChange={(v) => updateRow(row.id, { type: v as StructuredNodeType })}>
                <SelectTrigger className="w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() => removeRow(row.id)}
                aria-label={`Remove ${row.name || 'field'}`}
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </Button>
            </div>

            {(row.type === 'string' || row.type === 'number') && (
              <TemplatedTextField
                value={row.value}
                onChange={(v) => updateRow(row.id, { value: v })}
                placeholder={row.type === 'number' ? '{Quantity}' : '{SKU}'}
                metadataKeys={metadataKeys}
                sourceColumns={sourceColumns}
              />
            )}

            {row.type === 'boolean' && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={row.boolValue}
                  onChange={(e) => updateRow(row.id, { boolValue: e.target.checked })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                constant value: {row.boolValue ? 'true' : 'false'}
              </label>
            )}

            {row.type === 'literal' && (
              <div>
                <Textarea
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  placeholder='{"source": "etl", "tags": ["imported"]}'
                  className="font-mono text-xs"
                />
                {parseError && <p className="mt-1 text-[10px] text-destructive">{parseError}</p>}
              </div>
            )}

            {row.type === 'null' && (
              <p className="text-[10px] text-muted-foreground">Always writes JSON null — no value to configure.</p>
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add field
      </Button>
    </div>
  )
}
