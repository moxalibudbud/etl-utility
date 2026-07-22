import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readHeader } from '@/lib/file-reader'
import type { Delimiter } from '@/lib/file-reader'

interface FileUploadProps {
  onFileSelected: (file: File, columns: string[], delimiter: Delimiter, hasHeader: boolean) => void
}

function delimiterLabel(delimiter: Delimiter): string {
  if (delimiter === ';') return 'semicolon (;)'
  if (delimiter === ',') return 'comma (,)'
  if (delimiter === '\t') return 'tab'
  return `"${delimiter}"`
}

export function FileUpload({ onFileSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle')
  const [info, setInfo] = useState<{ name: string; columns: number; delimiter: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [separator, setSeparator] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  async function handleFile(file: File, separatorOverride = separator, hasHeaderOverride = hasHeader) {
    setSelectedFile(file)
    setStatus('reading')
    setErrorMsg(null)
    try {
      const { columns, delimiter } = await readHeader(file, separatorOverride || undefined, hasHeaderOverride)
      setInfo({ name: file.name, columns: columns.length, delimiter })
      setStatus('done')
      onFileSelected(file, columns, delimiter, hasHeaderOverride)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to read file.')
      setStatus('error')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleSeparatorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSeparator(value)
    if (selectedFile) handleFile(selectedFile, value)
  }

  function handleHasHeaderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.checked
    setHasHeader(value)
    if (selectedFile) handleFile(selectedFile, separator, value)
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 border border-dashed border-border p-8 text-center cursor-pointer hover:bg-accent transition-colors"
      >
        <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">
          Drop a CSV / TSV file here, or <span className="underline">browse</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Only the header row is read — large files are safe to upload.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="separator" className="text-muted-foreground">
            Separator
          </Label>
          <Input
            id="separator"
            value={separator}
            onChange={handleSeparatorChange}
            maxLength={1}
            placeholder="auto"
            className="w-16 font-mono text-center"
          />
        </div>

        <label htmlFor="has-header" className="flex items-center gap-2 cursor-pointer select-none">
          <input
            id="has-header"
            type="checkbox"
            checked={hasHeader}
            onChange={handleHasHeaderChange}
            className="h-3.5 w-3.5 accent-foreground"
          />
          <span className="text-xs text-muted-foreground">File has header row</span>
        </label>
      </div>

      {status === 'reading' && (
        <p className="text-xs text-muted-foreground">Reading header…</p>
      )}

      {status === 'done' && info && (
        <div className="border border-border p-3 space-y-1">
          <p className="text-xs font-medium">{info.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {info.columns} columns detected · delimiter:{' '}
            <span className="font-mono">{delimiterLabel(info.delimiter)}</span>
          </p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  )
}
