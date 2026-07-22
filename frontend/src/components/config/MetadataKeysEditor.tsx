import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface MetadataKeysEditorProps {
  keys: string[]
  onChange: (keys: string[]) => void
}

// Only key names are collected here, never values — output.metadata is
// populated at runtime by the pipeline, so there's no value to author. This
// just tells the templated fields below which data.metadata.<key> tokens are
// valid to insert. Once configs can be fetched from wherever they're
// persisted, the keys already used in an existing config should pre-populate
// this list instead of requiring the user to retype them.
export function MetadataKeysEditor({ keys, onChange }: MetadataKeysEditorProps) {
  const [draft, setDraft] = useState('')

  function addKey() {
    const key = draft.trim()
    if (key !== '' && !keys.includes(key)) {
      onChange([...keys, key])
    }
    setDraft('')
  }

  function removeKey(key: string) {
    onChange(keys.filter((k) => k !== key))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addKey()
            }
          }}
          placeholder="store_id"
          className="font-mono text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={addKey}>
          Add
        </Button>
      </div>
      {keys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keys.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] font-mono"
            >
              {key}
              <button
                type="button"
                onClick={() => removeKey(key)}
                aria-label={`Remove ${key}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" strokeWidth={1.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
