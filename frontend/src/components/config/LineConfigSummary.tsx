import { Badge } from '@/components/ui/badge'
import { FieldRow } from './Section'
import { delimiterLabel } from '@/lib/file-reader'
import type { LineConfig } from '@/lib/config/types'

interface LineConfigSummaryProps {
  line: LineConfig
}

// Renders as a fragment (no divide-y wrapper of its own) so callers can
// compose it alongside sibling FieldRows inside a single divided list.
export function LineConfigSummary({ line }: LineConfigSummaryProps) {
  const mandatory = new Set(line.mandatoryFields)

  return (
    <>
      <FieldRow label="separator">{delimiterLabel(line.separator)}</FieldRow>
      <FieldRow label="withHeader">
        <Badge variant={line.withHeader ? 'default' : 'secondary'}>
          {line.withHeader ? 'true' : 'false'}
        </Badge>
      </FieldRow>

      <div className="py-1.5">
        <span className="text-xs text-muted-foreground">columns</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {line.columns.map((col) => (
            <Badge key={col} variant={mandatory.has(col) ? 'default' : 'outline'} className="font-mono">
              {col}
              {mandatory.has(col) && <span className="ml-0.5">*</span>}
            </Badge>
          ))}
        </div>
        {mandatory.size > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            * mandatory — an empty value fails the row
          </p>
        )}
      </div>
    </>
  )
}
