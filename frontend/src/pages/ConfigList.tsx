import { useEffect, useState } from 'react'
import { ArrowLeft, FilePlus2, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { loadSavedConfigs, type SavedConfig } from '@/lib/config/store'

type LoadState =
  | { state: 'loading' }
  | { state: 'loaded'; configs: SavedConfig[] }
  | { state: 'error'; message: string }

export default function ConfigList() {
  const [load, setLoad] = useState<LoadState>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    loadSavedConfigs()
      .then((configs) => {
        if (!cancelled) setLoad({ state: 'loaded', configs })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoad({
            state: 'error',
            message: err instanceof Error ? err.message : 'Failed to load saved configurations.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Home
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-semibold tracking-tight">Configurations</h1>
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              dev
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-lg">
            Pick an existing configuration to load it into the builder, or start a new one from scratch.
          </p>
        </header>

        <div className="space-y-3">
          <Link
            to="/config-builder"
            className="flex items-center gap-3 border border-dashed border-border p-4 hover:bg-accent transition-colors"
          >
            <FilePlus2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-sm font-medium">New configuration</span>
          </Link>

          {load.state === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              Loading configurations…
            </div>
          )}

          {load.state === 'error' && <p className="text-xs text-destructive p-4">{load.message}</p>}

          {load.state === 'loaded' &&
            load.configs.map((saved) => (
              <Link
                key={saved.id}
                to="/config-builder"
                state={{ config: saved.config, name: saved.name }}
                className="flex flex-col gap-2 border border-border bg-card p-4 hover:bg-accent transition-colors"
              >
                <span className="text-sm font-medium">{saved.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">source: {saved.config.source.type ?? 'inferred'}</Badge>
                  <Badge variant="outline">output: {saved.config.output.type ?? 'inferred'}</Badge>
                  <Badge variant="secondary">{saved.config.output.fileGenerator || 'default-generator'}</Badge>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  )
}
