import { Badge } from '@/components/ui/badge'
import { Section, FieldRow } from './Section'
import type { Options } from '@/lib/config/types'

interface OptionsSummaryProps {
  options: Options
}

export function OptionsSummary({ options }: OptionsSummaryProps) {
  const { line, rejectOnInvalidRow } = options
  const mandatory = new Set(line.mandatoryFields)

  return (
    <Section title="Options · line">
      <div className="divide-y divide-border">
        <FieldRow label="separator">"{line.separator}"</FieldRow>
        <FieldRow label="withHeader">
          <Badge variant={line.withHeader ? 'default' : 'secondary'}>
            {line.withHeader ? 'true' : 'false'}
          </Badge>
        </FieldRow>
        <FieldRow label="rejectOnInvalidRow">
          <Badge variant={rejectOnInvalidRow ? 'default' : 'secondary'}>
            {rejectOnInvalidRow ? 'true' : 'false'}
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
      </div>
    </Section>
  )
}
