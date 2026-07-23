import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

interface JsonSampleUploadProps {
  onSample: (data: unknown) => void
}

// Reads a dropped/selected file as JSON, entirely client-side, and hands the
// parsed value up for inference (see lib/config/jsonSample.ts). Unlike
// FileUpload (CSV/TSV), there's no separator/header detection here — a JSON
// document either parses or it doesn't.
export function JsonSampleUpload({ onSample }: JsonSampleUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleFile(file: File) {
    setStatus('reading')
    setErrorMsg(null)
    try {
      const text = await file.text()
      const data: unknown = JSON.parse(text)
      setFileName(file.name)
      setStatus('done')
      onSample(data)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse JSON.')
      setStatus('error')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 border border-dashed border-border p-6 text-center cursor-pointer hover:bg-accent transition-colors"
      >
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">
          Drop a sample JSON document here, or <span className="underline">browse</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Infers root fields, the array field, and row fields as a starting point — confirm and complete the mapping
          below.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {status === 'reading' && <p className="text-xs text-muted-foreground">Reading…</p>}
      {status === 'done' && <p className="text-xs text-muted-foreground">{fileName} parsed.</p>}
      {status === 'error' && <p className="text-xs text-destructive">{errorMsg}</p>}
    </div>
  )
}
