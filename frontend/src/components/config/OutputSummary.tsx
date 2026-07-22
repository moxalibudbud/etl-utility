import { Badge } from '@/components/ui/badge'
import { Section, FieldRow } from './Section'
import { resolveAuthMode } from '@/lib/config/auth'
import type { OutputConfig } from '@/lib/config/types'

interface OutputSummaryProps {
  output: OutputConfig
}

export function OutputSummary({ output }: OutputSummaryProps) {
  const auth = resolveAuthMode(output.auth)
  const isJson = output.fileGenerator === 'json-generator'
  const metadataEntries = Object.entries(output.metadata ?? {})
  const errorReport = output.options?.errorReport === true

  return (
    <Section
      title="Output"
      meta={
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{output.type ?? 'inferred'}</Badge>
          <Badge variant="secondary">{output.fileGenerator || 'default-generator'}</Badge>
        </div>
      }
    >
      <div className="divide-y divide-border">
        {output.type === 'azure-blob' ? (
          <>
            <FieldRow label="url">{output.url}</FieldRow>
            <FieldRow label="auth">
              <Badge variant={auth.mode === 'default' ? 'secondary' : 'outline'}>
                {auth.label}
              </Badge>
            </FieldRow>
          </>
        ) : (
          <FieldRow label="path">{output.path || '(OS temp dir)'}</FieldRow>
        )}

        <FieldRow label="filename">{output.filename}</FieldRow>

        {isJson ? (
          <>
            <FieldRow label="template">{output.template || '—'}</FieldRow>
            <FieldRow label="arrayField">{output.arrayField || '—'}</FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="separator">"{output.separator}"</FieldRow>
            <FieldRow label="header">{output.header || '—'}</FieldRow>
            <FieldRow label="footer">{output.footer || '—'}</FieldRow>
          </>
        )}

        {output.uniqueKey && <FieldRow label="uniqueKey">{output.uniqueKey}</FieldRow>}

        <FieldRow label="errorReport">
          <Badge variant={errorReport ? 'default' : 'secondary'}>
            {errorReport ? 'on' : 'off'}
          </Badge>
        </FieldRow>

        {metadataEntries.length > 0 && (
          <div className="py-1.5">
            <span className="text-xs text-muted-foreground">metadata</span>
            <div className="mt-1.5 space-y-1">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4 text-xs font-mono">
                  <span className="text-muted-foreground">{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
