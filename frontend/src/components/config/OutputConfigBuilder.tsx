import { useEffect, useMemo, useState } from 'react';
import { FileUpload } from '@/components/transform/FileUpload';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Section } from './Section';
import { TemplatedTextField } from './TemplatedTextField';
import { MetadataKeysEditor } from './MetadataKeysEditor';
import { OutputSummary } from './OutputSummary';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import { saveOutputConfig } from '@/lib/config/persist';
import type { Delimiter } from '@/lib/file-reader';
import type { DestinationType, OutputConfig } from '@/lib/config/types';

// The only fileGenerator values the Go core actually builds a writer for
// (writer.newLocalWriter / newBlobWriter in go/writer/writer.go); any other
// value is a Permanent "not supported in the Go core yet" error, so the
// select must not offer more than this.
const SUPPORTED_GENERATORS = [
  { value: 'default-generator', label: 'Default (delimited)' },
  { value: 'json-generator', label: 'JSON' },
] as const;

const DESTINATION_TYPES: { value: DestinationType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'azure-blob', label: 'Azure Blob' },
];

const NO_UNIQUE_KEY = '__none__';

interface OutputConfigBuilderProps {
  /** Source columns from the Source tab — uniqueKey must name one of these,
   * since the writer looks it up as sl.JSONLine[UniqueKey]
   * (go/writer/render.go), and JSONLine is keyed by options.line.columns. */
  sourceColumns?: string[];
  /** Notified with the assembled OutputConfig on every change, so the page
   * can feed a live output into the Summary tab. */
  onChange?: (output: OutputConfig) => void;
}

export function OutputConfigBuilder({ sourceColumns = [], onChange }: OutputConfigBuilderProps) {
  const [type, setType] = useState<DestinationType>('local');
  const [fileGenerator, setFileGenerator] = useState<string>('default-generator');
  const [filename, setFilename] = useState('');
  const [footer, setFooter] = useState('');
  const [uniqueKey, setUniqueKey] = useState('');
  // Key names only — output.metadata's values are populated at runtime by
  // the pipeline, not authored here. This just tells the templated fields
  // below which data.metadata.<key> tokens are valid to insert.
  const [metadataKeys, setMetadataKeys] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [separator, setSeparator] = useState<Delimiter>(';');
  // One template segment per header column, in order — joined by `separator`
  // to build output.template. Each segment is a {sourceColumn}/{metadata.key}
  // reference, a [func ...] token, or literal text (go/writer/render.go
  // renders the whole row through the same template layer as filename/header).
  const [templateValues, setTemplateValues] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isDelimited = fileGenerator !== 'json-generator';

  function handleFileSelected(file: File, cols: string[], delimiter: Delimiter, _hasHeader: boolean) {
    setColumns(cols);
    setSeparator(delimiter);
    setSavedAt(null);
    // Prefill from the sample's own name — but don't clobber a filename the
    // user already typed/edited by re-uploading a new sample.
    setFilename((prev) => (prev === '' ? file.name : prev));
    // Column positions may no longer line up with a previous sample's shape.
    setTemplateValues(new Array(cols.length).fill(''));
  }

  function setTemplateValueAt(index: number, value: string) {
    setTemplateValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setSavedAt(null);
  }

  // Header is the literal header line written to delimited output — a sample
  // output file's columns, rejoined with the same separator they were split on.
  const header = useMemo(() => columns.join(separator), [columns, separator]);

  // Empty when every segment is blank, so the writer falls back to its
  // default row-building behavior instead of rendering an all-empty row.
  const template = useMemo(
    () => (templateValues.some((v) => v !== '') ? templateValues.join(separator) : ''),
    [templateValues, separator],
  );

  const outputConfig: OutputConfig = useMemo(
    () => ({
      type,
      fileGenerator,
      filename,
      separator: isDelimited ? separator : '',
      header: isDelimited ? header : '',
      footer: isDelimited ? footer : '',
      template: isDelimited ? template : '',
      arrayField: '',
      uniqueKey: isDelimited ? uniqueKey : '',
      metadata: {}, // populated at runtime, not authored here
    }),
    [type, fileGenerator, filename, isDelimited, separator, header, footer, template, uniqueKey],
  );

  useEffect(() => {
    onChange?.(outputConfig);
  }, [outputConfig, onChange]);

  function handleSave() {
    setSavedAt(Date.now());
    void saveOutputConfig(outputConfig);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Section title="Builder">
          <div className="space-y-6">
            <Section title="Sample output file">
              <FileUpload onFileSelected={handleFileSelected} />
            </Section>

            <Section title="Output Destination">
              <Select value={type} onValueChange={(v) => setType(v as DestinationType)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

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
                  setFilename(v);
                  setSavedAt(null);
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
                      setFooter(v);
                      setSavedAt(null);
                    }}
                    placeholder="END OF FILE"
                    metadataKeys={metadataKeys}
                  />
                </Section>

                <Section
                  title="Unique key"
                  meta={<span className="text-xs text-muted-foreground">de-duplicates rows by this source column</span>}
                >
                  <Select
                    value={uniqueKey === '' ? NO_UNIQUE_KEY : uniqueKey}
                    onValueChange={(v) => {
                      setUniqueKey(v === NO_UNIQUE_KEY ? '' : (v as string));
                      setSavedAt(null);
                    }}
                    disabled={sourceColumns.length === 0}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="no source columns yet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_UNIQUE_KEY}>— none —</SelectItem>
                      {sourceColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sourceColumns.length === 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Build the Source tab first to populate columns.
                    </p>
                  )}
                </Section>

                {columns.length > 0 && (
                  <Section
                    title="Template"
                    meta={
                      <span className="text-xs text-muted-foreground">
                        one value per header column, in order
                      </span>
                    }
                  >
                    <div className="space-y-4">
                      {columns.map((col, i) => (
                        <div key={`${col}-${i}`}>
                          <p className="mb-1 text-[10px] font-mono text-muted-foreground">{col}</p>
                          <TemplatedTextField
                            value={templateValues[i] ?? ''}
                            onChange={(v) => setTemplateValueAt(i, v)}
                            placeholder="{sourceColumn} or literal text"
                            metadataKeys={metadataKeys}
                            sourceColumns={sourceColumns}
                          />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {columns.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSave} className="flex-1">
                      Save configuration
                    </Button>
                    {savedAt && <span className="text-xs text-muted-foreground">Saved — check the console.</span>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sample-output scaffolding for the JSON generator (template + arrayField inference) isn't implemented
                yet.
              </p>
            )}
          </div>
        </Section>

        <Section title="Preview">
          <div className="space-y-6">
            <OutputSummary output={outputConfig} />
            <ConfigJsonPanel data={outputConfig} title="Raw OutputConfig JSON" />
          </div>
        </Section>
      </div>
    </div>
  );
}
