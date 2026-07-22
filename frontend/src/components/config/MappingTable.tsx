import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Section } from './Section'
import { classifyMapping } from '@/lib/config/types'
import type { Mapping } from '@/lib/config/types'

interface MappingTableProps {
  title: string
  mappings: Mapping[]
  columns: string[]
}

const kindVariant = {
  column: 'outline',
  literal: 'secondary',
  function: 'default',
} as const

export function MappingTable({ title, mappings, columns }: MappingTableProps) {
  return (
    <Section title={title} meta={<span className="text-xs text-muted-foreground">order is load-bearing</span>}>
      {mappings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Empty — falls back to all source columns in order.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-[10px]">#</TableHead>
              <TableHead className="text-[10px]">out</TableHead>
              <TableHead className="text-[10px]">src</TableHead>
              <TableHead className="text-[10px]">kind</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m, i) => {
              const kind = classifyMapping(m.src, columns)
              return (
                <TableRow key={`${m.out}-${i}`}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono">{m.out}</TableCell>
                  <TableCell className="font-mono">{m.src}</TableCell>
                  <TableCell>
                    <Badge variant={kindVariant[kind]}>{kind}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}
