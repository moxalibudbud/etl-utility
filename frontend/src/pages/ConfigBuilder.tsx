import { Link } from 'react-router'
import { ArrowLeft, Upload, FormInput, FileOutput } from 'lucide-react'

const steps = [
  {
    title: 'Sample source file',
    description:
      'Upload a representative source file to infer its separator, header row, and columns.',
    icon: Upload,
  },
  {
    title: 'Source & output fields',
    description:
      'Fill in the source and output destinations through form fields, with conditional rules matching the engine.',
    icon: FormInput,
  },
  {
    title: 'Sample output file',
    description:
      'Optionally upload a sample output file to scaffold the field mapping.',
    icon: FileOutput,
  },
]

export default function ConfigBuilder() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
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
          See{' '}
          <code className="font-mono text-xs">docs/config-builder-ui-improvement.md</code>{' '}
          for the full plan. This page is a placeholder — nothing below is wired up yet.
        </p>

        <div className="space-y-2">
          {steps.map(({ title, description, icon: Icon }, i) => (
            <div
              key={title}
              className="flex items-start gap-3 border border-border bg-card p-4"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-border text-xs font-medium text-muted-foreground">
                {i + 1}
              </div>
              <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" strokeWidth={1.5} />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-card-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
