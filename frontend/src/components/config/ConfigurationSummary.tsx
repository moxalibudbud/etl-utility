import { OutputSummary } from './OutputSummary';
import { OptionsSummary } from './OptionsSummary';
import { MappingTable } from './MappingTable';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import type { Config } from '@/lib/config/types';

interface ConfigurationSummaryProps {
  config: Config;
}

export function ConfigurationSummary({ config }: ConfigurationSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
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
        </div>

        <div className="space-y-6">
          <OutputSummary output={config.output} />
        </div>
      </div>

      <ConfigJsonPanel data={config} />
    </div>
  );
}
