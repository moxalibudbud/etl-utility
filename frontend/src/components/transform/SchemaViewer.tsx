import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { RepoSchema } from '@/lib/schema'

interface SchemaViewerProps {
  schema: RepoSchema
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  return (
    <aside className="sticky top-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
        Expected columns
      </p>
      <div className="border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] py-2 px-2">Field</TableHead>
              <TableHead className="text-[10px] py-2 px-2">Type</TableHead>
              <TableHead className="text-[10px] py-2 px-2">Req</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schema.fields.map((field) => (
              <TableRow key={field.name}>
                <TableCell className="py-1.5 px-2 align-top">
                  <p className="font-mono text-[10px] font-medium text-foreground leading-tight">
                    {field.name}
                  </p>
                  {field.locked !== undefined && (
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
                      locked: {field.locked || '""'}
                    </p>
                  )}
                  {field.notes && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">
                      {field.notes}
                    </p>
                  )}
                  {field.enumOptions && field.locked === undefined && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">
                      {field.enumOptions.map((o) => o.value).join(' · ')}
                    </p>
                  )}
                </TableCell>
                <TableCell className="py-1.5 px-2 align-top">
                  <span className="text-[10px] text-muted-foreground">{field.type}</span>
                </TableCell>
                <TableCell className="py-1.5 px-2 align-top">
                  {field.required ? (
                    <span className="text-[10px] font-medium text-foreground">✓</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        File prefix: <span className="font-mono">{schema.filePrefix}_</span>
      </p>
    </aside>
  )
}
