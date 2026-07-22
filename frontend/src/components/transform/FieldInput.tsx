import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FieldDef } from '@/lib/schema'

interface FieldInputProps {
  field: FieldDef
  value: string
  onChange: (value: string) => void
}

export function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `field-${field.name}`
  const isLocked = field.locked !== undefined

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1">
        {field.label}
        {field.required && !isLocked && (
          <span className="text-destructive text-[10px]">*</span>
        )}
        {isLocked && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">(fixed)</span>
        )}
      </Label>

      {isLocked ? (
        <Input
          id={id}
          value={field.locked === '' ? '' : (field.locked ?? '')}
          disabled
          placeholder={field.locked === '' ? '(empty)' : undefined}
          className="font-mono text-[11px]"
          onChange={() => {}}
        />
      ) : field.enumOptions ? (
        <Select
          value={value || undefined}
          onValueChange={(val) => onChange(val as string)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.enumOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || '__empty__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === 'integer' || field.type === 'decimal' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.notes ?? field.label}
          maxLength={field.maxLength}
        />
      )}

      {field.notes && !isLocked && (
        <p className="text-[10px] text-muted-foreground">{field.notes}</p>
      )}
    </div>
  )
}
