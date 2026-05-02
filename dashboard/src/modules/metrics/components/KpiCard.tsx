import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'positive' | 'negative' | 'accent'
  className?: string
}

export function KpiCard({ label, value, hint, icon: Icon, tone = 'default', className }: Props) {
  return (
    <Card size="sm" className={cn('flex-1', className)}>
      <CardContent className="flex items-start gap-3">
        {Icon && (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              tone === 'positive' && 'bg-[var(--status-positive)]/15 text-[var(--status-positive)]',
              tone === 'negative' && 'bg-[var(--status-negative)]/15 text-[var(--status-negative)]',
              tone === 'accent' && 'bg-[var(--status-info)]/15 text-[var(--status-info)]',
              tone === 'default' && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
