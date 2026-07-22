import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  meta?: ReactNode
  children: ReactNode
}

export function Section({ title, meta, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {meta}
      </div>
      <div className="border border-border bg-card p-4">{children}</div>
    </section>
  )
}

interface FieldRowProps {
  label: string
  children: ReactNode
}

export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all">{children}</span>
    </div>
  )
}
