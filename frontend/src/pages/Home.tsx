import { Link } from 'react-router'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-14">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Internal · Phase 1
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">GO ETL-UTILITY</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-lg">
            Configuration builder for go etl-utility
          </p>
        </header>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              key="config-builder"
              to="/config-builder"
              className="flex flex-col gap-3 border border-border bg-card p-4 text-left hover:bg-accent transition-colors"
            >
              Config Builder
            </Link>
            <Link
              key="configs"
              to="/configs"
              className="flex flex-col gap-3 border border-border bg-card p-4 text-left hover:bg-accent transition-colors"
            >
              Saved Configurations
            </Link>
            <Link
              key="octoplus"
              to="/octoplus"
              className="flex flex-col gap-3 border border-border bg-card p-4 text-left hover:bg-accent transition-colors"
            >
              Octo+ Home
            </Link>
            
          </div>
        </section>
      </div>
    </div>
  )
}
