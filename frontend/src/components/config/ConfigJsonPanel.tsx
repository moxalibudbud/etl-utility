interface ConfigJsonPanelProps {
  data: unknown
  title?: string
}

export function ConfigJsonPanel({ data, title = 'Raw config.json' }: ConfigJsonPanelProps) {
  return (
    <details className="border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground select-none">
        {title}
      </summary>
      <pre className="overflow-x-auto border-t border-border p-4 text-[11px] leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}
