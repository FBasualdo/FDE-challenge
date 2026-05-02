'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { formatNumber, formatPercent } from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'

interface Props {
  data?: MetricsSummary['top_carriers']
}

/**
 * Top 5 carriers ranked by revenue per call (income / calls made). Surfaces
 * high-ROI carriers — those who book quickly at strong rates — over carriers
 * who just call a lot without closing.
 */
export function TopCarriersCard({ data }: Props) {
  const rows = data ?? []

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          Top 5 carriers
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            by revenue / call
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No carriers yet"
            description="Top callers will surface here once calls start coming in."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((c) => (
              <li key={c.mc_number} className="flex items-center justify-between gap-3 py-2">
                <Link
                  href={`/transcripts?mc_number=${encodeURIComponent(c.mc_number)}`}
                  className="flex min-w-0 flex-col hover:underline underline-offset-4"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {c.carrier_name ?? 'Unknown carrier'}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    MC {c.mc_number} · {formatNumber(c.calls)} call{c.calls === 1 ? '' : 's'} ·{' '}
                    {formatPercent(c.booking_rate)} booked
                  </span>
                </Link>
                <div
                  className="flex shrink-0 flex-col items-end gap-0.5"
                  title={`Total revenue: $${c.total_revenue.toLocaleString()}`}
                >
                  <MoneyCell
                    value={c.revenue_per_call}
                    className="text-sm font-semibold"
                  />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    per call
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
