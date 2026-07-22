import { useMemo, useState } from 'react'
import { FileUpload } from '@/components/transform/FileUpload'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Section } from './Section'
import { TemplatedTextField } from './TemplatedTextField'
import { MetadataKeysEditor } from './MetadataKeysEditor'
import { OutputSummary } from './OutputSummary'
import { ConfigJsonPanel } from './ConfigJsonPanel'
import { saveOutputConfig } from '@/lib/config/persist'
import type { Delimiter } from '@/lib/file-reader'
import type { OutputConfig } from '@/lib/config/types'

// The only fileGenerator values the Go core actually builds a writer for
// (writer.newLocalWriter / newBlobWriter in go/writer/writer.go); any other
// value is a Permanent "not supported in the Go core yet" error, so the
// select must not offer more than this.
const SUPPORTED_GENERATORS = [
  { value: 'default-generator', label: 'Default (delimited)' },
  { value: 'json-generator', label: 'JSON' },
] as const

export function OutputConfigBuilder() {
  const [fileGenerator, setFileGenerator] = useState<string>('default-generator')
  const [filename, setFilename] = useState('')
  const [footer, setFooter] = useState('')
  // Key names only — output.metadata's values are populated at runtime by
  // the pipeline, not authored here. This just tells the templated fields
  // below which data.metadata.<key> tokens are valid to insert.
  const [metadataKeys, setMetadataKeys] = useState<string[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [separator, setSeparator] = useState<Delimiter>(';')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const isDelimited = fileGenerator !== 'json-generator'

  function handleFileSelected(_file: File, cols: string[], delimiter: Delimiter, _hasHeader: boolean) {
    setColumns(cols)
    setSeparator(delimiter)
    setSavedAt(null)
  }

  // Header is the literal header line written to delimited output — a sample
  // output file's columns, rejoined with the same separator they were split on.
  const header = useMemo(() => columns.join(separator), [columns, separator])

  const outputConfig: OutputConfig = useMemo(
    () => ({
      fileGenerator,
      filename,
      separator: isDelimited ? separator : '',
      header: isDelimited ? header : '',
      footer: isDelimited ? footer : '',
      template: '',
      arrayField: '',
      uniqueKey: '',
      metadata: {}, // populated at runtime, not authored here
    }),
    [fileGenerator, filename, isDelimited, separator, header, footer],
  )

  function handleSave() {
    setSavedAt(Date.now())
    void saveOutputConfig(outputConfig)
  }

  return (
    <div className="space-y-6">
      <Section title="File generator">
        <Select value={fileGenerator} onValueChange={(v) => setFileGenerator(v as string)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_GENERATORS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section
        title="Metadata keys"
        meta={<span className="text-xs text-muted-foreground">values are populated at runtime</span>}
      >
        <MetadataKeysEditor keys={metadataKeys} onChange={setMetadataKeys} />
      </Section>

      <Section
        title="Filename"
        meta={<span className="text-xs text-muted-foreground">free text + [func ...] tokens</span>}
      >
        <TemplatedTextField
          value={filename}
          onChange={(v) => {
            setFilename(v)
            setSavedAt(null)
          }}
          placeholder="products_[dateTime YYYY-MM-DD].csv"
          metadataKeys={metadataKeys}
        />
      </Section>

      {isDelimited ? (
        <>
          <Section
            title="Footer"
            meta={<span className="text-xs text-muted-foreground">free text + [func ...] tokens</span>}
          >
            <TemplatedTextField
              value={footer}
              onChange={(v) => {
                setFooter(v)
                setSavedAt(null)
              }}
              placeholder="END OF FILE"
              metadataKeys={metadataKeys}
            />
          </Section>

          <Section title="Sample output file">
            <FileUpload onFileSelected={handleFileSelected} />
          </Section>

          {columns.length > 0 && (
            <>
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

              <OutputSummary output={outputConfig} />
              <ConfigJsonPanel data={outputConfig} title="Raw OutputConfig JSON" />
            </>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sample-output scaffolding for the JSON generator (template + arrayField inference)
          isn't implemented yet.
        </p>
      )}
    </div>
  )
}
