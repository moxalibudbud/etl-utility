import { useMemo, useState } from 'react'
import { FileUpload } from '@/components/transform/FileUpload'
import { Button } from '@/components/ui/button'
import { Section } from './Section'
import { LineConfigSummary } from './LineConfigSummary'
import { MappingTable } from './MappingTable'
import { ConfigJsonPanel } from './ConfigJsonPanel'
import { saveLineConfig } from '@/lib/config/persist'
import type { Delimiter } from '@/lib/file-reader'
import type { LineConfig, Mapping } from '@/lib/config/types'

function toggle(list: string[], col: string): string[] {
  return list.includes(col) ? list.filter((c) => c !== col) : [...list, col]
}

function ColumnCheckboxes({
  columns,
  selected,
  onToggle,
}: {
  columns: string[]
  selected: string[]
  onToggle: (col: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {columns.map((col) => (
        <label key={col} className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selected.includes(col)}
            onChange={() => onToggle(col)}
            className="h-3.5 w-3.5 accent-foreground"
          />
          <span className="text-xs font-mono">{col}</span>
        </label>
      ))}
    </div>
  )
}

export function LineConfigBuilder() {
  const [columns, setColumns] = useState<string[]>([])
  const [separator, setSeparator] = useState<Delimiter>(';')
  const [withHeader, setWithHeader] = useState(true)
  const [mandatoryFields, setMandatoryFields] = useState<string[]>([])
  const [identifierColumns, setIdentifierColumns] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function handleFileSelected(_file: File, cols: string[], delimiter: Delimiter, hasHeader: boolean) {
    setColumns(cols)
    setSeparator(delimiter)
    setWithHeader(hasHeader)
    setMandatoryFields([])
    setIdentifierColumns([])
    setSavedAt(null)
  }

  const identifierMappings: Mapping[] = useMemo(
    () => identifierColumns.map((col) => ({ out: col, src: col })),
    [identifierColumns],
  )

  const lineConfig: LineConfig = useMemo(
    () => ({
      columns,
      mandatoryFields,
      identifierMappings,
      outputMappings: [], // hidden for now — falls back to source column defaults
      separator,
      withHeader,
    }),
    [columns, mandatoryFields, identifierMappings, separator, withHeader],
  )

  function handleSave() {
    setSavedAt(Date.now())
    void saveLineConfig(lineConfig)
  }

  return (
    <div className="space-y-6">
      <Section title="Sample source file">
        <FileUpload onFileSelected={handleFileSelected} />
      </Section>

      {columns.length > 0 && (
        <>
          <Section title="Mandatory fields" meta={<span className="text-xs text-muted-foreground">from columns</span>}>
            <ColumnCheckboxes
              columns={columns}
              selected={mandatoryFields}
              onToggle={(col) => {
                setMandatoryFields((prev) => toggle(prev, col))
                setSavedAt(null)
              }}
            />
          </Section>

          <Section title="Identifier mappings" meta={<span className="text-xs text-muted-foreground">from columns</span>}>
            <ColumnCheckboxes
              columns={columns}
              selected={identifierColumns}
              onToggle={(col) => {
                setIdentifierColumns((prev) => toggle(prev, col))
                setSavedAt(null)
              }}
            />
          </Section>

          <p className="text-xs text-muted-foreground">
            Output mappings are hidden for now — the config carries no{' '}
            <code className="font-mono">outputMappings</code>, so the engine falls back to
            all source columns, in order.
          </p>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} className="flex-1">
              Save configuration
            </Button>
            {savedAt && (
              <span className="text-xs text-muted-foreground">
                Saved — check the console.
              </span>
            )}
          </div>

          <Section title="options.line preview">
            <div className="divide-y divide-border">
              <LineConfigSummary line={lineConfig} />
            </div>
          </Section>

          <MappingTable
            title="Identifier mappings"
            mappings={lineConfig.identifierMappings}
            columns={lineConfig.columns}
          />

          <ConfigJsonPanel data={lineConfig} title="Raw LineConfig JSON" />
        </>
      )}
    </div>
  )
}
