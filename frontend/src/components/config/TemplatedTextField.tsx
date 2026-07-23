import { Input } from '@/components/ui/input'

// Function templates the Go core resolves at render time
// (go/template/function.go). Buttons insert these verbatim; the user can
// still edit the format/timezone by hand since the field is free text.
const FUNCTION_TOKENS = [
  { token: '[timestamp]', label: 'timestamp' },
  { token: '[dateTime YYYYMMDDHHmmss]', label: 'dateTime' },
] as const

interface TemplatedTextFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Known output.metadata key names, offered as data.metadata.<key> tokens. */
  metadataKeys?: string[]
  /** Source line columns (options.line.columns), offered as bare {column}
   * tokens — resolved by the writer straight off the current row's data
   * (go/template/field.go's ReplaceWithData), so no wrapper function is needed. */
  sourceColumns?: string[]
}

// A free-text field that also accepts [func ...] templates — used for
// output.filename, output.footer, output.template, and anything else the
// writer renders through the same templating layer.
export function TemplatedTextField({
  value,
  onChange,
  placeholder,
  metadataKeys = [],
  sourceColumns = [],
}: TemplatedTextFieldProps) {
  function insertToken(token: string) {
    onChange(`${value}${token}`)
  }

  return (
    <div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-xs w-full"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">insert:</span>
        {sourceColumns.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => insertToken(`{${col}}`)}
            className="text-[10px] font-mono border border-border px-1.5 py-0.5 hover:bg-accent transition-colors"
          >
            {col}
          </button>
        ))}
        {FUNCTION_TOKENS.map((t) => (
          <button
            key={t.token}
            type="button"
            onClick={() => insertToken(t.token)}
            className="text-[10px] font-mono border border-border px-1.5 py-0.5 hover:bg-accent transition-colors"
          >
            {t.label}
          </button>
        ))}
        {metadataKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => insertToken(`[sanitizeString data.metadata.${key}]`)}
            className="text-[10px] font-mono border border-border px-1.5 py-0.5 hover:bg-accent transition-colors"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
