import { useEffect, useMemo, useState } from 'react';
import { FileUpload } from '@/components/transform/FileUpload';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Section } from './Section';
import { TemplatedTextField } from './TemplatedTextField';
import { MetadataKeysEditor } from './MetadataKeysEditor';
import {
  StructuredTemplateEditor,
  toStructuredTemplate,
  toHeaderTemplateString,
  rowsFromStructuredTemplate,
  type StructuredTemplateRow,
} from './StructuredTemplateEditor';
import { JsonSampleUpload } from './JsonSampleUpload';
import { OutputSummary } from './OutputSummary';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import { inferFromJsonSample } from '@/lib/config/jsonSample';
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
  /** Seeds the form from an existing OutputConfig (e.g. loaded from the
   * config list) instead of starting blank. Only read once, on mount. */
  initialOutput?: OutputConfig;
}

export function OutputConfigBuilder({ sourceColumns = [], onChange, initialOutput }: OutputConfigBuilderProps) {
  const [type, setType] = useState<DestinationType>(initialOutput?.type ?? 'local');
  const [fileGenerator, setFileGenerator] = useState<string>(initialOutput?.fileGenerator || 'default-generator');
  const [filename, setFilename] = useState(initialOutput?.filename ?? '');
  const [footer, setFooter] = useState(initialOutput?.footer ?? '');
  const [uniqueKey, setUniqueKey] = useState(initialOutput?.uniqueKey ?? '');
  // Key names only — output.metadata's values are populated at runtime by
  // the pipeline, not authored here. This just tells the templated fields
  // below which data.metadata.<key> tokens are valid to insert. Seeded from
  // an existing config's metadata *keys* only, never its (runtime-populated) values.
  const [metadataKeys, setMetadataKeys] = useState<string[]>(Object.keys(initialOutput?.metadata ?? {}));
  // header is a joined string on the wire, not an array — split it back into
  // columns using the config's own separator so re-loading looks the same
  // as having just re-uploaded the original sample.
  const initialSeparator = initialOutput?.separator || ';';
  const initialColumns =
    initialOutput?.header && initialOutput.separator ? initialOutput.header.split(initialOutput.separator) : [];
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [separator, setSeparator] = useState<Delimiter>(initialSeparator);
  // One template segment per header column, in order — joined by `separator`
  // to build output.template. Each segment is a {sourceColumn}/{metadata.key}
  // reference, a [func ...] token, or literal text (go/writer/render.go
  // renders the whole row through the same template layer as filename/header).
  const [templateValues, setTemplateValues] = useState<string[]>(
    initialOutput?.template && initialOutput.separator
      ? initialOutput.template.split(initialOutput.separator)
      : new Array(initialColumns.length).fill(''),
  );
  // JSON generator only: output.arrayField and the typed structuredTemplate
  // alternative to the string template (go/writer/json_template.go).
  const [arrayField, setArrayField] = useState(initialOutput?.arrayField ?? '');
  const [structuredRows, setStructuredRows] = useState<StructuredTemplateRow[]>(
    initialOutput?.structuredTemplate ? rowsFromStructuredTemplate(initialOutput.structuredTemplate) : [],
  );
  // Root/header object — reuses the same row editor as the structured
  // template, but renders to a templated JSON *string* (output.header only
  // supports the untyped string-templating layer, not a structured contract).
  // Not reconstructed from an existing config's raw `header` string — that
  // would mean parsing arbitrary hand-written JSON-with-tokens text back
  // into rows, which this tool doesn't attempt; the raw value is still
  // visible in the Summary/JSON panels either way.
  const [headerRows, setHeaderRows] = useState<StructuredTemplateRow[]>([]);

  const isDelimited = fileGenerator !== 'json-generator';

  function handleFileSelected(file: File, cols: string[], delimiter: Delimiter, _hasHeader: boolean) {
    setColumns(cols);
    setSeparator(delimiter);
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
  }

  // Seeds the Root/Array object editors and arrayField from an uploaded
  // sample JSON document — field names and JSON types only, never a
  // {sourceColumn} guess. Replaces whatever was there before, same as
  // re-uploading a sample source/output file resets its dependent state.
  function handleJsonSample(data: unknown) {
    const inferred = inferFromJsonSample(data);
    setHeaderRows(inferred.headerRows);
    setStructuredRows(inferred.structuredRows);
    if (inferred.arrayField !== '') setArrayField(inferred.arrayField);
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

  // Mutually exclusive with `template` on the writer side — only populated
  // in JSON mode, where `template` above is always forced to ''.
  const structuredTemplate = useMemo(() => toStructuredTemplate(structuredRows), [structuredRows]);

  // '' when empty, matching header()'s "" == "no header" check.
  const jsonHeader = useMemo(() => toHeaderTemplateString(headerRows), [headerRows]);

  const outputConfig: OutputConfig = useMemo(
    () => ({
      type,
      fileGenerator,
      filename,
      separator: isDelimited ? separator : '',
      header: isDelimited ? header : jsonHeader,
      footer: isDelimited ? footer : '',
      template: isDelimited ? template : '',
      arrayField: isDelimited ? '' : arrayField,
      uniqueKey: isDelimited ? uniqueKey : '',
      metadata: {}, // populated at runtime, not authored here
      structuredTemplate: isDelimited ? {} : structuredTemplate,
    }),
    [
      type,
      fileGenerator,
      filename,
      isDelimited,
      separator,
      header,
      jsonHeader,
      footer,
      template,
      arrayField,
      uniqueKey,
      structuredTemplate,
    ],
  );

  useEffect(() => {
    onChange?.(outputConfig);
  }, [outputConfig, onChange]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Section title="Builder" titleClassName="font-bold text-foreground">
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

            {isDelimited ? (
              <Section title="Sample output file">
                <FileUpload onFileSelected={handleFileSelected} />
              </Section>
            ) : (
              <Section
                title="Sample output JSON"
                meta={
                  <span className="text-xs text-muted-foreground">
                    optional — infers the fields below, never their source mapping
                  </span>
                }
              >
                <JsonSampleUpload onSample={handleJsonSample} />
              </Section>
            )}

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
                onChange={setFilename}
                placeholder="products_[dateTime YYYY-MM-DD].csv"
                metadataKeys={metadataKeys}
                twoColumn={false}
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
                    onChange={setFooter}
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
                    onValueChange={(v) => setUniqueKey(v === NO_UNIQUE_KEY ? '' : (v as string))}
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
                    meta={<span className="text-xs text-muted-foreground">one value per header column, in order</span>}
                  >
                    <div className="space-y-4">
                      {columns.map((col, i) => (
                        <div key={`${col}-${i}`}>
                          <p className="mb-1 text-[10px] font-mono text-muted-foreground">{col}</p>
                          <TemplatedTextField
                            value={templateValues[i] ?? ''}
                            onChange={(v) => setTemplateValueAt(i, v)}
                            placeholder="{sourceColumn} or fixed text"
                            metadataKeys={metadataKeys}
                            sourceColumns={sourceColumns}
                          />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : (
              <>
                <Section
                  title="Root object"
                  meta={
                    <span className="text-xs text-muted-foreground">
                      wraps the array field — rendered as a templated JSON string, not a structured contract
                    </span>
                  }
                >
                  <StructuredTemplateEditor
                    rows={headerRows}
                    onChange={setHeaderRows}
                    metadataKeys={metadataKeys}
                    sourceColumns={sourceColumns}
                  />
                </Section>

                <Section
                  title="JSON array field"
                  meta={<span className="text-xs text-muted-foreground">key rows nest under, e.g. "lines"</span>}
                >
                  <Input value={arrayField} onChange={(e) => setArrayField(e.target.value)} placeholder="lines" />
                </Section>

                <Section
                  title="Array object"
                  meta={
                    <span className="text-xs text-muted-foreground">
                      typed alternative to a string template — mutually exclusive with it
                    </span>
                  }
                >
                  <StructuredTemplateEditor
                    rows={structuredRows}
                    onChange={setStructuredRows}
                    metadataKeys={metadataKeys}
                    sourceColumns={sourceColumns}
                  />
                </Section>
              </>
            )}
          </div>
        </Section>

        <Section title="Preview" titleClassName="font-bold text-foreground" className="sticky top-6 self-start">
          <div className="space-y-6">
            <OutputSummary output={outputConfig} />
            <ConfigJsonPanel data={outputConfig} title="Raw OutputConfig JSON" />
          </div>
        </Section>
      </div>
    </div>
  );
}
