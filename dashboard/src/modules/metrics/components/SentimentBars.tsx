'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { formatNumber } from '@/lib/format'

interface Datum {
  name: string
  value: number
}

interface Props {
  data?: Datum[]
}

function colorFor(name: string): string {
  const v = name.toLowerCase()
  if (v.includes('positive')) return 'var(--status-positive)'
  if (v.includes('negative')) return 'var(--status-negative)'
  return 'var(--muted-foreground)'
}

/**
 * Compact stacked-bar row for sentiment distribution. Sentiment is bot-
 * inferred (self-reported by the Extract node), so we treat it as a soft
 * signal — a small horizontal slice rather than a full chart card.
 */
export function SentimentBars({ data }: Props) {
  const cleaned = (data ?? []).filter((d) => d.value > 0)
  const total = cleaned.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Sentiment <span className="ml-1 text-[11px] font-normal">· bot-inferred</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cleaned.length === 0 ? (
          <EmptyState title="No sentiment data" className="border-0 bg-transparent py-3" />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/40">
              {cleaned.map((d) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0
                return (
                  <div
                    key={d.name}
                    style={{ width: `${pct}%`, background: colorFor(d.name) }}
                    title={`${d.name}: ${formatNumber(d.value)}`}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {cleaned.map((d) => (
                <span key={d.name} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: colorFor(d.name) }}
                  />
                  <span>
                    {d.name}{' '}
                    <span className="font-mono tabular-nums text-foreground">
                      {formatNumber(d.value)}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
