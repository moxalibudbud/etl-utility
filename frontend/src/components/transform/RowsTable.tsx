import { Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RepoSchema } from '@/lib/schema'

interface RowsTableProps {
  schema: RepoSchema
  rows: string[][]
  onDeleteRow: (index: number) => void
}

export function RowsTable({ schema, rows, onDeleteRow }: RowsTableProps) {
  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        Rows added{' '}
        <span className="text-muted-foreground font-normal">({rows.length})</span>
      </p>
      <div className="border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {schema.fields.map((f) => (
                <TableHead key={f.name} className="font-mono text-[10px] py-2 px-2 whitespace-nowrap">
                  {f.name}
                </TableHead>
              ))}
              <TableHead className="w-8 py-2 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {row.map((cell, colIdx) => (
                  <TableCell
                    key={colIdx}
                    className="py-1.5 px-2 max-w-28 truncate text-[10px] text-muted-foreground"
                  >
                    {cell || <span className="opacity-30">—</span>}
                  </TableCell>
                ))}
                <TableCell className="py-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(rowIdx)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label={`Delete row ${rowIdx + 1}`}
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
