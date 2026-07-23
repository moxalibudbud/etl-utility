import { useEffect, useMemo, useState } from 'react';
import { FileUpload } from '@/components/transform/FileUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Section } from './Section';
import { LineConfigSummary } from './LineConfigSummary';
import { MappingTable } from './MappingTable';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import type { Delimiter } from '@/lib/file-reader';
import type { LineConfig, Mapping, SourceConfig, SourceType } from '@/lib/config/types';

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'local', label: 'Local' },
  { value: 'azure-blob', label: 'Azure Blob' },
];

function toggle(list: string[], col: string): string[] {
  return list.includes(col) ? list.filter((c) => c !== col) : [...list, col];
}

function ColumnCheckboxes({
  columns,
  selected,
  onToggle,
}: {
  columns: string[];
  selected: string[];
  onToggle: (col: string) => void;
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
  );
}

interface LineConfigBuilderProps {
  /** Notified whenever the source columns change, so a sibling (e.g. the
   * output uniqueKey select, which must reference a source column via
   * SourceLine.JSONLine) can offer them without re-uploading the file. */
  onColumnsChange?: (columns: string[]) => void;
  /** Notified with the assembled LineConfig on every change, so the page can
   * feed a live options.line into the Summary tab. */
  onChange?: (line: LineConfig) => void;
  /** Notified with the assembled SourceConfig on every change. Only `type` is
   * authored here — path/url/auth are populated at runtime, not in this
   * tool, so the config just needs to say which source the pipeline reads. */
  onSourceChange?: (source: SourceConfig) => void;
  /** Seeds the form from an existing Config (e.g. loaded from the config
   * list) instead of starting blank. Only read once, on mount. */
  initialSource?: SourceConfig;
  initialLine?: LineConfig;
}

export function LineConfigBuilder({
  onColumnsChange,
  onChange,
  onSourceChange,
  initialSource,
  initialLine,
}: LineConfigBuilderProps = {}) {
  const [type, setType] = useState<SourceType>(initialSource?.type ?? 'local');
  const [columns, setColumns] = useState<string[]>(initialLine?.columns ?? []);
  const [separator, setSeparator] = useState<Delimiter>(initialLine?.separator || ';');
  const [withHeader, setWithHeader] = useState(initialLine?.withHeader ?? true);
  const [mandatoryFields, setMandatoryFields] = useState<string[]>(initialLine?.mandatoryFields ?? []);
  // identifierMappings is an ordered {out, src} list, but this editor only
  // offers pass-through selection (out === src) via checkboxes — a loaded
  // mapping that isn't pass-through can't be represented and is dropped.
  const [identifierColumns, setIdentifierColumns] = useState<string[]>(
    initialLine?.identifierMappings.filter((m) => m.out === m.src).map((m) => m.src) ?? [],
  );

  function handleFileSelected(_file: File, cols: string[], delimiter: Delimiter, hasHeader: boolean) {
    setColumns(cols);
    setSeparator(delimiter);
    setWithHeader(hasHeader);
    setMandatoryFields([]);
    setIdentifierColumns([]);
  }

  useEffect(() => {
    onColumnsChange?.(columns);
  }, [columns, onColumnsChange]);

  const identifierMappings: Mapping[] = useMemo(
    () => identifierColumns.map((col) => ({ out: col, src: col })),
    [identifierColumns],
  );

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
  );

  useEffect(() => {
    onChange?.(lineConfig);
  }, [lineConfig, onChange]);

  const sourceConfig: SourceConfig = useMemo(() => ({ type }), [type]);

  useEffect(() => {
    onSourceChange?.(sourceConfig);
  }, [sourceConfig, onSourceChange]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Section title="Builder" titleClassName="font-bold text-foreground">
          <div className="space-y-6">
            <Section title="Sample source file">
              <FileUpload onFileSelected={handleFileSelected} />
            </Section>

            <Section title="Data Source">
              <Select value={type} onValueChange={(v) => setType(v as SourceType)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Section>

            {columns.length > 0 && (
              <>
                <Section
                  title="Mandatory fields"
                  meta={<span className="text-xs text-muted-foreground">from columns</span>}
                >
                  <ColumnCheckboxes
                    columns={columns}
                    selected={mandatoryFields}
                    onToggle={(col) => setMandatoryFields((prev) => toggle(prev, col))}
                  />
                </Section>

                <Section
                  title="Identifier mappings"
                  meta={<span className="text-xs text-muted-foreground">from columns</span>}
                >
                  <ColumnCheckboxes
                    columns={columns}
                    selected={identifierColumns}
                    onToggle={(col) => setIdentifierColumns((prev) => toggle(prev, col))}
                  />
                </Section>

                <p className="text-xs text-muted-foreground">
                  Output mappings are hidden for now — the config carries no{' '}
                  <code className="font-mono">outputMappings</code>, so the engine falls back to all source columns, in
                  order.
                </p>
              </>
            )}
          </div>
        </Section>

        <Section title="Preview" titleClassName="font-bold text-foreground">
          <div className="space-y-6">
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
          </div>
        </Section>
      </div>
    </div>
  );
}
