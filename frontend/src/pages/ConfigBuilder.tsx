import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ConfigurationSummary } from '@/components/config/ConfigurationSummary'
import { LineConfigBuilder } from '@/components/config/LineConfigBuilder'
import { OutputConfigBuilder } from '@/components/config/OutputConfigBuilder'
import { EMPTY_SOURCE_CONFIG, EMPTY_LINE_CONFIG, EMPTY_OUTPUT_CONFIG } from '@/lib/config/defaults'
import type { Config, LineConfig, OutputConfig, SourceConfig } from '@/lib/config/types'

// Passed via router state from ConfigList — see loadSavedConfigs in
// lib/config/store.ts. Absent when arriving via "New configuration".
interface ConfigBuilderLocationState {
  config?: Config
  name?: string
}

export default function ConfigBuilder() {
  const location = useLocation()
  const loaded = (location.state as ConfigBuilderLocationState | null)?.config
  const loadedName = (location.state as ConfigBuilderLocationState | null)?.name

  const [sourceColumns, setSourceColumns] = useState<string[]>(loaded?.options.line.columns ?? [])
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(loaded?.source ?? EMPTY_SOURCE_CONFIG)
  const [lineConfig, setLineConfig] = useState<LineConfig>(loaded?.options.line ?? EMPTY_LINE_CONFIG)
  const [outputConfig, setOutputConfig] = useState<OutputConfig>(loaded?.output ?? EMPTY_OUTPUT_CONFIG)

  // path/url/auth on source and output are populated at runtime, not
  // authored here — only `type` (which source/destination the config
  // targets) is set in the builder.
  const config: Config = useMemo(
    () => ({
      source: sourceConfig,
      output: outputConfig,
      options: { line: lineConfig, rejectOnInvalidRow: false },
    }),
    [sourceConfig, lineConfig, outputConfig],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
            Home
          </Link>
          <Link
            to="/configs"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All configurations
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-semibold tracking-tight">ETL Config Builder</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            dev
          </span>
          {loadedName && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              editing: {loadedName}
            </span>
          )}
        </div>
        <p className="text-muted-foreground leading-relaxed max-w-lg mb-10">
          A form-driven builder for the ETL utility's <code className="font-mono text-xs">Config</code> JSON.
          See <code className="font-mono text-xs">docs/config-builder-ui-improvement.md</code> for the
          full plan.
        </p>

        <Tabs defaultValue="line">
          <TabsList>
            <TabsTrigger value="line">Source</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="line" className="mt-6" keepMounted>
            <LineConfigBuilder
              onColumnsChange={setSourceColumns}
              onChange={setLineConfig}
              onSourceChange={setSourceConfig}
              initialSource={loaded?.source}
              initialLine={loaded?.options.line}
            />
          </TabsContent>

          <TabsContent value="output" className="mt-6" keepMounted>
            <OutputConfigBuilder
              sourceColumns={sourceColumns}
              onChange={setOutputConfig}
              initialOutput={loaded?.output}
            />
          </TabsContent>

          <TabsContent value="summary" className="mt-6 space-y-4" keepMounted>
            <p className="text-xs text-muted-foreground">
              Live from the Source / Output tabs — only <code className="font-mono">type</code> is
              authored for source/destination; path/url/auth are populated at runtime.
            </p>
            <ConfigurationSummary config={config} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
