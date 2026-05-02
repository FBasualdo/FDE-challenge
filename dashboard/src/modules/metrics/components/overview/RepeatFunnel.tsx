'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'

interface Props {
  data?: MetricsSummary['repeat_funnel']
}

interface Bucket {
  label: string
  description: string
  value: number
  tone: 'muted' | 'info' | 'positive'
}

/**
 * Three-card row: how many MCs have called once, 2-3 times, 4+ times.
 * Exposes the retention shape of the carrier base at a glance — a flat
 * "all once" funnel is a red flag, a fat 4+ bucket is gold.
 */
export function RepeatFunnel({ data }: Props) {
  const once = data?.once ?? 0
  const twoToThree = data?.two_to_three ?? 0
  const fourPlus = data?.four_plus ?? 0
  const total = once + twoToThree + fourPlus

  const buckets: Bucket[] = [
    { label: '1 call', description: 'First-time callers', value: once, tone: 'muted' },
    { label: '2-3 calls', description: 'Returning carriers', value: twoToThree, tone: 'info' },
    { label: '4+ calls', description: 'Loyal repeats', value: fourPlus, tone: 'positive' },
  ]

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Carrier repeat funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {buckets.map((b) => {
            const share = total > 0 ? (b.value / total) * 100 : 0
            const ringClass =
              b.tone === 'positive'
                ? 'ring-[var(--status-positive)]/30'
                : b.tone === 'info'
                  ? 'ring-[var(--status-info)]/30'
                  : 'ring-border'
            const accentClass =
              b.tone === 'positive'
                ? 'text-[var(--status-positive)]'
                : b.tone === 'info'
                  ? 'text-[var(--status-info)]'
                  : 'text-muted-foreground'
            return (
              <div
                key={b.label}
                className={`flex flex-col gap-1 rounded-md bg-background/40 p-3 ring-1 ${ringClass}`}
              >
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</span>
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {formatNumber(b.value)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {b.description} · <span className={accentClass}>{share.toFixed(0)}%</span>
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
