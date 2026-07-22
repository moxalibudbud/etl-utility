import { Archive, Barcode, Building2, Folder, Package, Printer, Store, Truck } from 'lucide-react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import type { RepoSlug, RepoKind } from '@/lib/schema'

interface Repo {
  name: string
  domain: string
  kind: RepoKind
  icon: LucideIcon
  slug: RepoSlug
}

const repos: Repo[] = [
  { name: 'Category',      domain: 'Product',   kind: 'master',       icon: Folder,   slug: 'category' },
  { name: 'SKU',           domain: 'Product',   kind: 'master',       icon: Package,  slug: 'sku' },
  { name: 'Barcode',       domain: 'Product',   kind: 'master',       icon: Barcode,  slug: 'barcode' },
  { name: 'Suppliers',     domain: 'Metadata',  kind: 'master',       icon: Building2, slug: 'suppliers' },
  { name: 'Stores',        domain: 'Metadata',  kind: 'master',       icon: Store,    slug: 'stores' },
  { name: 'Stock on-hand', domain: 'Inventory', kind: 'master',       icon: Archive,  slug: 'stock' },
  { name: 'Delivery notice', domain: 'Shipping', kind: 'transactional', icon: Truck,  slug: 'delivery-notice' },
  { name: 'Bulk printing', domain: 'Printing',  kind: 'transactional', icon: Printer, slug: 'bulk-printing' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-14">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Internal · Phase 1
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Octo+ Portal</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-lg">
            Generate valid Octo+ CSV files in English and deliver them
            automatically to the right customer SFTP instance — no mapping
            sheet needed.
          </p>
        </header>

        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Repositories
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {repos.map(({ name, domain, kind, icon: Icon, slug }) => (
              <Link
                key={name}
                to={`/transform/${slug}`}
                className="flex flex-col gap-3 border border-border bg-card p-4 text-left hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-card-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{domain}</p>
                </div>
                <span
                  className={[
                    'self-start text-[10px] font-medium px-1.5 py-0.5',
                    kind === 'master'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  ].join(' ')}
                >
                  {kind}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
