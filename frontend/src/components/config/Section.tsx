import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  titleClassName?: string;
  /** Overrides the content box's border classes (default: "border-border"). */
  borderClassName?: string;
  /** Extra classes on the outer <section> — e.g. "sticky top-6 self-start"
   * to pin a Section in place within a grid column. */
  className?: string;
}

export function Section({ title, meta, children, titleClassName, borderClassName, className }: SectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <p className={cn('text-xs font-medium uppercase tracking-widest text-muted-foreground', titleClassName)}>
          {title}
        </p>
        {meta}
      </div>
      <div className={cn('border bg-card p-4', borderClassName ?? 'border-border')}>{children}</div>
    </section>
  );
}

interface FieldRowProps {
  label: string;
  children: ReactNode;
}

export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all">{children}</span>
    </div>
  );
}
