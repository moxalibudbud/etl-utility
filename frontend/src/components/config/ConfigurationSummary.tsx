import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { OutputSummary } from './OutputSummary';
import { OptionsSummary } from './OptionsSummary';
import { MappingTable } from './MappingTable';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import { saveConfig } from '@/lib/config/persist';
import type { Config } from '@/lib/config/types';
import { Section } from './Section';

interface ConfigurationSummaryProps {
  config: Config;
}

export function ConfigurationSummary({ config }: ConfigurationSummaryProps) {
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleSave() {
    setSavedAt(Date.now());
    void saveConfig(config);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className="flex-1">
          Save configuration
        </Button>
        {savedAt && <span className="text-xs text-muted-foreground">Saved — check the console.</span>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Section
          title="Inbound settings"
          titleClassName="font-bold text-foreground"
          borderClassName="border-2 border-red-500"
        >
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
        </Section>

        <Section
          title="Outbound settings"
          titleClassName="font-bold text-foreground"
          borderClassName="border-2 border-green-500"
        >
          <div className="space-y-6">
            <OutputSummary output={config.output} />
          </div>
        </Section>
      </div>

      <ConfigJsonPanel data={config} />
    </div>
  );
}
