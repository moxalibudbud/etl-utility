import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft, Download } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getRepoSchema } from '@/lib/schema'
import { streamRows, serializeCSV } from '@/lib/file-reader'
import type { ColumnMapping, Delimiter } from '@/lib/file-reader'
import { SchemaViewer } from '@/components/transform/SchemaViewer'
import { ManualForm } from '@/components/transform/ManualForm'
import { RowsTable } from '@/components/transform/RowsTable'
import { FileUpload } from '@/components/transform/FileUpload'
import { ColumnMapper } from '@/components/transform/ColumnMapper'
import { DataPreview } from '@/components/transform/DataPreview'

type Mode = 'manual' | 'upload'

export default function TransformFile() {
  const { repo } = useParams<{ repo: string }>()
  const navigate = useNavigate()
  const schema = repo ? getRepoSchema(repo) : undefined

  // Manual form state
  const [currentRow, setCurrentRow] = useState<Record<string, string>>({})
  const [manualRows, setManualRows] = useState<string[][]>([])

  // Upload / mapping state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [sourceColumns, setSourceColumns] = useState<string[]>([])
  const [sourceDelimiter, setSourceDelimiter] = useState<Delimiter>(';')
  const [sourceHasHeader, setSourceHasHeader] = useState(true)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappingConfirmed, setMappingConfirmed] = useState(false)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Download state
  const [isDownloading, setIsDownloading] = useState(false)

  if (!schema) {
    navigate('/', { replace: true })
    return null
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleFieldChange = useCallback((name: string, value: string) => {
    setCurrentRow((prev) => ({ ...prev, [name]: value }))
  }, [])

  function buildRowFromForm(): string[] {
    return schema.fields.map((field) => {
      if (field.locked !== undefined) return field.locked
      return currentRow[field.name] ?? field.defaultValue ?? ''
    })
  }

  function handleAddRow() {
    setManualRows((prev) => [...prev, buildRowFromForm()])
    setCurrentRow({})
  }

  function handleDeleteRow(index: number) {
    setManualRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleFileSelected(file: File, columns: string[], delimiter: Delimiter, hasHeader: boolean) {
    setUploadedFile(file)
    setSourceColumns(columns)
    setSourceDelimiter(delimiter)
    setSourceHasHeader(hasHeader)
    setMapping({})
    setMappingConfirmed(false)
    setPreviewRows([])
  }

  function handleMappingChange(fieldName: string, sourceColumn: string | null) {
    setMapping((prev) => ({ ...prev, [fieldName]: sourceColumn }))
  }

  async function handleMappingConfirm() {
    if (!uploadedFile) return
    setMappingConfirmed(true)
    setIsStreaming(true)
    setPreviewRows([])

    const rows: string[][] = []
    for await (const row of streamRows(uploadedFile, sourceColumns, schema.fields, mapping, { maxRows: 5, delimiter: sourceDelimiter, hasHeader: sourceHasHeader })) {
      rows.push(row)
    }
    setPreviewRows(rows)
    setIsStreaming(false)
  }

  async function handleDownloadManual() {
    if (manualRows.length === 0) return
    const csv = serializeCSV(schema.fields, manualRows)
    triggerDownload(csv)
  }

  async function handleDownloadUpload() {
    if (!uploadedFile) return
    setIsDownloading(true)
    const allRows: string[][] = []
    for await (const row of streamRows(uploadedFile, sourceColumns, schema.fields, mapping, { delimiter: sourceDelimiter, hasHeader: sourceHasHeader })) {
      allRows.push(row)
    }
    const csv = serializeCSV(schema.fields, allRows)
    triggerDownload(csv)
    setIsDownloading(false)
  }

  function triggerDownload(csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${schema.filePrefix}_export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const kindLabel = schema.kind === 'master' ? 'master' : 'transactional'
  const kindClass =
    schema.kind === 'master'
      ? 'bg-muted text-muted-foreground'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Octo+ Portal
        </Link>

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{schema.name}</h1>
          <span className="font-mono text-xs border border-border px-1.5 py-0.5 text-muted-foreground">
            {schema.filePrefix}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 ${kindClass}`}>
            {kindLabel}
          </span>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left — data entry */}
          <div className="space-y-6">
            <Tabs defaultValue="manual">
              <TabsList>
                <TabsTrigger value="manual">Manual entry</TabsTrigger>
                <TabsTrigger value="upload">File upload</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="mt-4">
                <ManualForm
                  schema={schema}
                  currentRow={currentRow}
                  onFieldChange={handleFieldChange}
                  onAddRow={handleAddRow}
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-4 space-y-6">
                <FileUpload onFileSelected={handleFileSelected} />

                {sourceColumns.length > 0 && !mappingConfirmed && (
                  <ColumnMapper
                    schema={schema}
                    sourceColumns={sourceColumns}
                    mapping={mapping}
                    onMappingChange={handleMappingChange}
                    onConfirm={handleMappingConfirm}
                  />
                )}

                {mappingConfirmed && (
                  <DataPreview
                    schema={schema}
                    rows={previewRows}
                    isStreaming={isStreaming}
                  />
                )}

                {mappingConfirmed && !isStreaming && (
                  <Button
                    onClick={handleDownloadUpload}
                    disabled={isDownloading}
                    className="w-full flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {isDownloading ? 'Generating…' : 'Download CSV'}
                  </Button>
                )}
              </TabsContent>
            </Tabs>

            {/* Manual rows table + download — outside tabs so always visible after adding rows */}
            {manualRows.length > 0 && (
              <div className="space-y-4">
                <RowsTable
                  schema={schema}
                  rows={manualRows}
                  onDeleteRow={handleDeleteRow}
                />
                <Button
                  onClick={handleDownloadManual}
                  className="w-full flex items-center gap-2"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Download CSV ({manualRows.length} row{manualRows.length !== 1 ? 's' : ''})
                </Button>
              </div>
            )}
          </div>

          {/* Right — schema viewer */}
          <SchemaViewer schema={schema} />
        </div>
      </div>
    </div>
  )
}
