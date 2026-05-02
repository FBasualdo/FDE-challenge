'use client'

import useSWR from 'swr'
import { swrFetcher } from '@/lib/api'
import { KpiCard } from '@/modules/metrics/components/KpiCard'
import {
  formatNumber,
  formatPercent,
  formatMoney,
  formatDuration,
} from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'
import {
  Phone,
  CheckCircle2,
  DollarSign,
  Repeat,
  Clock,
} from 'lucide-react'

/**
 * Cross-agent headline KPIs above the transcripts table. Mirrors the
 * AgentKpiRow shape so /agents/[slug] and /transcripts feel symmetric.
 * Numbers come from /metrics/summary (no agent filter).
 */
export function TranscriptsKpiRow() {
  const { data } = useSWR<MetricsSummary>('/metrics/summary', swrFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const totalCalls = data?.totals.total_calls ?? null
  const bookedCalls = data?.totals.booked_calls ?? null
  const bookingRate = data?.totals.booking_rate ?? null
  const revenue = data?.totals.total_revenue_negotiated ?? null
  const avgRounds = data?.negotiation.avg_rounds_to_close ?? null
  const avgDuration = data?.quality.avg_call_duration_seconds ?? null

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        icon={Phone}
        label="Calls"
        value={totalCalls === null ? '—' : formatNumber(totalCalls)}
        hint={bookedCalls === null ? undefined : `${formatNumber(bookedCalls)} booked`}
      />
      <KpiCard
        icon={CheckCircle2}
        label="Booking rate"
        value={bookingRate === null ? '—' : formatPercent(bookingRate)}
        tone="positive"
      />
      <KpiCard
        icon={DollarSign}
        label="Revenue negotiated"
        value={revenue === null ? '—' : formatMoney(revenue)}
        tone="accent"
      />
      <KpiCard
        icon={Repeat}
        label="Avg negotiation rounds"
        value={
          avgRounds === null || !Number.isFinite(avgRounds) ? '—' : avgRounds.toFixed(1)
        }
      />
      <KpiCard
        icon={Clock}
        label="Avg call duration"
        value={formatDuration(avgDuration)}
      />
    </div>
  )
}
