import { Badge } from '@/components/ui/badge'
import { Section, FieldRow } from './Section'
import { resolveAuthMode } from '@/lib/config/auth'
import type { SourceConfig } from '@/lib/config/types'

interface SourceSummaryProps {
  source: SourceConfig
}

export function SourceSummary({ source }: SourceSummaryProps) {
  const auth = resolveAuthMode(source.auth)

  return (
    <Section
      title="Source"
      meta={<Badge variant="outline">{source.type ?? 'inferred'}</Badge>}
    >
      <div className="divide-y divide-border">
        {source.type === 'azure-blob' ? (
          <>
            <FieldRow label="url">{source.url}</FieldRow>
            <FieldRow label="auth">
              <Badge variant={auth.mode === 'default' ? 'secondary' : 'outline'}>
                {auth.label}
              </Badge>
            </FieldRow>
          </>
        ) : (
          <FieldRow label="path">{source.path}</FieldRow>
        )}
      </div>
    </Section>
  )
}
