import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OutputSummary } from './OutputSummary';
import { OptionsSummary } from './OptionsSummary';
import { MappingTable } from './MappingTable';
import { ConfigJsonPanel } from './ConfigJsonPanel';
import { saveConfig, SaveConfigError } from '@/lib/config/persist';
import type { Config } from '@/lib/config/types';
import { Section } from './Section';

interface ConfigurationSummaryProps {
  config: Config;
}

type SaveStatus = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string };

export function ConfigurationSummary({ config }: ConfigurationSummaryProps) {
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' });

  async function handleSave() {
    setStatus({ state: 'saving' });
    try {
      await saveConfig(config);
      setStatus({ state: 'saved' });
    } catch (err) {
      const message = err instanceof SaveConfigError ? err.message : 'Something went wrong saving the configuration.';
      setStatus({ state: 'error', message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={status.state === 'saving'} className="flex-1">
          {status.state === 'saving' && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />}
          {status.state === 'saving' ? 'Saving…' : 'Save configuration'}
        </Button>
        {status.state === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-green-600" strokeWidth={1.5} />
            Saved.
          </span>
        )}
        {status.state === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.5} />
            {status.message}
          </span>
        )}
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
