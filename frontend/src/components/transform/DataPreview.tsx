import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RepoSchema } from '@/lib/schema'

interface DataPreviewProps {
  schema: RepoSchema
  rows: string[][]
  isStreaming: boolean
}

export function DataPreview({ schema, rows, isStreaming }: DataPreviewProps) {
  const visibleFields = schema.fields.filter((f) => f.locked === undefined)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          Preview{' '}
          <span className="text-muted-foreground font-normal">
            (first {rows.length} row{rows.length !== 1 ? 's' : ''})
          </span>
        </p>
        {isStreaming && (
          <p className="text-[10px] text-muted-foreground animate-pulse">Reading…</p>
        )}
      </div>

      <div className="border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleFields.map((f) => (
                <TableHead key={f.name} className="font-mono text-[10px] py-2 px-2 whitespace-nowrap">
                  {f.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {visibleFields.map((f, colIdx) => {
                  const fieldIndex = schema.fields.indexOf(f)
                  return (
                    <TableCell key={colIdx} className="py-1.5 px-2 max-w-32 truncate text-[10px]">
                      {row[fieldIndex] ?? ''}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
            {rows.length === 0 && !isStreaming && (
              <TableRow>
                <TableCell
                  colSpan={visibleFields.length}
                  className="text-center text-[10px] text-muted-foreground py-4"
                >
                  No rows
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
