import { Button } from '@/components/ui/button'
import { FieldInput } from './FieldInput'
import type { RepoSchema } from '@/lib/schema'

interface ManualFormProps {
  schema: RepoSchema
  currentRow: Record<string, string>
  onFieldChange: (name: string, value: string) => void
  onAddRow: () => void
}

export function ManualForm({ schema, currentRow, onFieldChange, onAddRow }: ManualFormProps) {
  const requiredUnfilled = schema.fields.filter(
    (f) => f.required && f.locked === undefined && !currentRow[f.name]?.trim(),
  )
  const canAdd = requiredUnfilled.length === 0

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {schema.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={currentRow[field.name] ?? field.defaultValue ?? ''}
            onChange={(val) => onFieldChange(field.name, val)}
          />
        ))}
      </div>

      {requiredUnfilled.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Fill required fields to enable Add:{' '}
          {requiredUnfilled.map((f) => f.label).join(', ')}
        </p>
      )}

      <Button onClick={onAddRow} disabled={!canAdd} className="w-full">
        Add row
      </Button>
    </div>
  )
}
