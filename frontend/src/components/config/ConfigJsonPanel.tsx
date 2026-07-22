import type { Config } from '@/lib/config/types'

interface ConfigJsonPanelProps {
  config: Config
}

export function ConfigJsonPanel({ config }: ConfigJsonPanelProps) {
  return (
    <details className="border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-widest text-muted-foreground select-none">
        Raw config.json
      </summary>
      <pre className="overflow-x-auto border-t border-border p-4 text-[11px] leading-relaxed">
        {JSON.stringify(config, null, 2)}
      </pre>
    </details>
  )
}
