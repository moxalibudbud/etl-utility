import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ConfigurationSummary } from '@/components/config/ConfigurationSummary'
import { LineConfigBuilder } from '@/components/config/LineConfigBuilder'
import { OutputConfigBuilder } from '@/components/config/OutputConfigBuilder'
import { mockConfig } from '@/lib/config/mock'

export default function ConfigBuilder() {
  const [sourceColumns, setSourceColumns] = useState<string[]>([])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
          Home
        </Link>

        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-semibold tracking-tight">ETL Config Builder</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            dev
          </span>
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
            <LineConfigBuilder onColumnsChange={setSourceColumns} />
          </TabsContent>

          <TabsContent value="output" className="mt-6" keepMounted>
            <OutputConfigBuilder sourceColumns={sourceColumns} />
          </TabsContent>

          <TabsContent value="summary" className="mt-6 space-y-4" keepMounted>
            <p className="text-xs text-muted-foreground">
              Mock data — not wired up to the Source / Output tabs yet.
            </p>
            <ConfigurationSummary config={mockConfig} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
