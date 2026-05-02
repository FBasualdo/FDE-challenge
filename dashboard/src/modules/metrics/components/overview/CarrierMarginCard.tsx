'use client'

import Link from 'next/link'
import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { formatPercent } from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'

interface Props {
  data?: MetricsSummary['carrier_margin']
}

/**
 * Per-carrier premium paid above the listed loadboard rate. Positive %
 * = the broker paid above listed (margin loss). Zero = clean clear.
 * Negative = the carrier closed below listed (margin saved). Sorted
 * ascending — the broker's most profitable carriers float to the top.
 */
export function CarrierMarginCard({ data }: Props) {
  const rows = data ?? []

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Margin retention
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            premium vs loadboard
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="Margin retention surfaces once carriers start booking loads."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((c) => {
              const pct = c.avg_premium_pct
              // Lower premium = better for the broker. Color the % accordingly:
              // positive = negative tone (we paid above listed), zero/negative = positive tone.
              const tone = pct > 0.001 ? 'negative' : 'positive'
              const premiumColor =
                tone === 'negative'
                  ? 'text-[var(--status-negative)]'
                  : 'text-[var(--status-positive)]'
              return (
                <li
                  key={c.mc_number}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/transcripts?mc_number=${encodeURIComponent(c.mc_number)}`}
                    className="flex min-w-0 flex-col hover:underline underline-offset-4"
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {c.carrier_name ?? 'Unknown carrier'}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      MC {c.mc_number} · {c.bookings} booking{c.bookings === 1 ? '' : 's'}
                    </span>
                  </Link>
                  <div
                    className="flex shrink-0 flex-col items-end gap-0.5"
                    title={`Total paid above listed: $${c.total_premium_paid.toLocaleString()}`}
                  >
                    <span
                      className={`font-mono text-sm font-semibold tabular-nums ${premiumColor}`}
                    >
                      {pct > 0 ? '+' : ''}
                      {formatPercent(pct)}
                    </span>
                    <MoneyCell
                      value={c.total_premium_paid}
                      tone={tone === 'negative' ? 'negative' : 'muted'}
                      className="text-[11px]"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
