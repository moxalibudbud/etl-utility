import { SourceSummary } from './SourceSummary'
import { OutputSummary } from './OutputSummary'
import { OptionsSummary } from './OptionsSummary'
import { MappingTable } from './MappingTable'
import { ConfigJsonPanel } from './ConfigJsonPanel'
import type { Config } from '@/lib/config/types'

interface ConfigurationSummaryProps {
  config: Config
}

export function ConfigurationSummary({ config }: ConfigurationSummaryProps) {
  return (
    <div className="space-y-6">
      <SourceSummary source={config.source} />
      <OutputSummary output={config.output} />
      <OptionsSummary options={config.options} />
      <MappingTable
        title="Output mappings"
        mappings={config.options.line.outputMappings}
        columns={config.options.line.columns}
      />
      <MappingTable
        title="Identifier mappings"
        mappings={config.options.line.identifierMappings}
        columns={config.options.line.columns}
      />
      <ConfigJsonPanel config={config} />
    </div>
  )
}
