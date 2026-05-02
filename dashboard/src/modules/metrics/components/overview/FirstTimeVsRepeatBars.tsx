'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber, formatPercent } from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'

interface Props {
  data?: MetricsSummary['first_time_vs_repeat']
}

/**
 * Side-by-side mini-stats — first-time vs repeat booking rate. Includes a
 * proportional bar for visual scanning. Answers "are repeat carriers more
 * bookable?" (typically yes — the bot already has rapport).
 */
export function FirstTimeVsRepeatBars({ data }: Props) {
  const firstTime = data?.first_time
  const repeat = data?.repeat

  const ftRate = firstTime?.booking_rate ?? null
  const rpRate = repeat?.booking_rate ?? null
  const maxRate = Math.max(ftRate ?? 0, rpRate ?? 0, 0.0001)

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>First-time vs repeat — booking rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row
            label="First-time"
            calls={firstTime?.calls ?? 0}
            rate={ftRate}
            max={maxRate}
            tone="muted"
          />
          <Row
            label="Repeat"
            calls={repeat?.calls ?? 0}
            rate={rpRate}
            max={maxRate}
            tone="positive"
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface RowProps {
  label: string
  calls: number
  rate: number | null
  max: number
  tone: 'muted' | 'positive'
}

function Row({ label, calls, rate, max, tone }: RowProps) {
  const pct = rate !== null && max > 0 ? Math.min(100, (rate / max) * 100) : 0
  const barColor = tone === 'positive' ? 'var(--status-positive)' : 'var(--muted-foreground)'
  return (
    <div className="flex flex-col gap-2 rounded-md bg-background/40 p-3 ring-1 ring-border">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatNumber(calls)} call{calls === 1 ? '' : 's'}
        </span>
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {formatPercent(rate)}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}
