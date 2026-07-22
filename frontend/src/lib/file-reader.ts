import type { FieldDef } from './schema/types'

export type Delimiter = string

export type ColumnMapping = Record<string, string | null>

export function detectDelimiter(sample: string): Delimiter {
  const firstLine = sample.split(/\r?\n/)[0] ?? ''
  return firstLine.includes(';') ? ';' : ','
}

export function parseCSVLine(line: string, delimiter: Delimiter): string[] {
  return line.split(delimiter)
}

export async function readHeader(
  file: File,
  delimiterOverride?: Delimiter,
  hasHeader = true,
): Promise<{ columns: string[]; delimiter: Delimiter }> {
  const slice = file.slice(0, 2048)
  const text = await slice.text()
  const firstLine = text.split(/\r?\n/)[0]
  if (firstLine === undefined || firstLine.trim() === '') {
    throw new Error('Could not read header row — file appears to be empty.')
  }
  const delimiter = delimiterOverride || detectDelimiter(text)
  const firstRowCells = parseCSVLine(firstLine, delimiter)
  const columns = hasHeader
    ? firstRowCells.map((c) => c.trim())
    : firstRowCells.map((_, i) => `Column ${i + 1}`)
  return { columns, delimiter }
}

export async function* streamRows(
  file: File,
  sourceColumns: string[],
  targetFields: FieldDef[],
  mapping: ColumnMapping,
  options?: { maxRows?: number; delimiter?: Delimiter; hasHeader?: boolean },
): AsyncGenerator<string[]> {
  const { maxRows, delimiter, hasHeader = true } = options ?? {}

  // Build index: for each target field, the source column index (or -1 = skip)
  const sourceIndexes: number[] = targetFields.map((field) => {
    const sourceCol = mapping[field.name]
    if (!sourceCol) return -1
    return sourceColumns.indexOf(sourceCol)
  })

  const stream = file.stream().pipeThrough(new TextDecoderStream('utf-8'))
  const reader = stream.getReader()

  let buffer = ''
  let lineIndex = 0
  let rowCount = 0
  let done = false

  while (!done) {
    if (maxRows !== undefined && rowCount >= maxRows) break

    const result = await reader.read()
    done = result.done
    if (result.value) buffer += result.value

    const lines = buffer.split(/\r?\n/)
    // Keep the last (possibly incomplete) chunk in the buffer
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (lineIndex === 0 && hasHeader) {
        lineIndex++
        continue
      }
      if (line.trim() === '') {
        lineIndex++
        continue
      }
      if (maxRows !== undefined && rowCount >= maxRows) break

      const sourceCells = line.split(
        delimiter ?? (line.includes(';') ? ';' : ','),
      )

      const mappedRow: string[] = sourceIndexes.map((idx, _i) => {
        if (idx === -1) {
          // Use locked or default value if available
          const field = targetFields[_i]
          return field?.locked ?? field?.defaultValue ?? ''
        }
        return sourceCells[idx]?.trim() ?? ''
      })

      yield mappedRow
      rowCount++
      lineIndex++
    }
  }

  // Process any remaining buffer content after stream ends
  if (buffer.trim() !== '') {
    if (lineIndex > 0 && (maxRows === undefined || rowCount < maxRows)) {
      const sourceCells = buffer.split(delimiter ?? (buffer.includes(';') ? ';' : ','))
      const mappedRow: string[] = sourceIndexes.map((idx, _i) => {
        if (idx === -1) {
          const field = targetFields[_i]
          return field?.locked ?? field?.defaultValue ?? ''
        }
        return sourceCells[idx]?.trim() ?? ''
      })
      yield mappedRow
    }
  }

  reader.releaseLock()
}

export function serializeCSV(fields: FieldDef[], rows: string[][]): string {
  const header = fields.map((f) => f.name).join(';')
  const dataRows = rows.map((row) => row.join(';'))
  return [header, ...dataRows].join('\n')
}
