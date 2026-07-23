import { Badge } from '@/components/ui/badge';
import { Section, FieldRow } from './Section';
import { LineConfigSummary } from './LineConfigSummary';
import type { Options } from '@/lib/config/types';

interface OptionsSummaryProps {
  options: Options;
}

export function OptionsSummary({ options }: OptionsSummaryProps) {
  return (
    <Section title="Options · line">
      <div className="divide-y divide-border">
        <LineConfigSummary line={options.line} />
        <FieldRow label="rejectOnInvalidRow">
          <Badge variant={options.rejectOnInvalidRow ? 'default' : 'secondary'}>
            {options.rejectOnInvalidRow ? 'true' : 'false'}
          </Badge>
        </FieldRow>
      </div>
    </Section>
  );
}
