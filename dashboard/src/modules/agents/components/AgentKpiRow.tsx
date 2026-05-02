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
import type { CallsResponse, MetricsSummary } from '@/lib/types'
import {
  Phone,
  CheckCircle2,
  DollarSign,
  Target,
  Repeat,
  Clock,
} from 'lucide-react'

interface Props {
  agentSlug: string
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfWeekIso(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = (day + 6) % 7 // distance from Monday
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function AgentKpiRow({ agentSlug }: Props) {
  // Calls today (count via /calls)
  const { data: today } = useSWR<CallsResponse>(
    [`/calls`, { agent_id: agentSlug, date_from: startOfTodayIso(), limit: 1 }],
    swrFetcher,
    { revalidateOnFocus: false },
  )

  // Last 7d window — feeds the booking rate, revenue, R1 close rate,
  // avg negotiation rounds and avg call duration KPIs.
  const { data: summary } = useSWR<MetricsSummary>(
    [`/metrics/summary`, { agent_id: agentSlug, date_from: startOfWeekIso() }],
    swrFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const callsToday = today?.total ?? today?.items?.length ?? null
  const bookingRate = summary?.totals.booking_rate ?? null
  const revenue = summary?.totals.total_revenue_negotiated ?? null
  const roundOneCloseRate = summary?.round_one_close_rate ?? null
  const avgRounds = summary?.negotiation.avg_rounds_to_close ?? null
  const avgDuration = summary?.quality.avg_call_duration_seconds ?? null

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        icon={Phone}
        label="Calls today"
        value={callsToday === null ? '—' : formatNumber(callsToday)}
      />
      <KpiCard
        icon={CheckCircle2}
        label="Booking rate (last 7d)"
        value={bookingRate === null ? '—' : formatPercent(bookingRate)}
        tone="positive"
      />
      <KpiCard
        icon={DollarSign}
        label="Revenue negotiated (last 7d)"
        value={revenue === null ? '—' : formatMoney(revenue)}
        tone="accent"
      />
      <KpiCard
        icon={Target}
        label="Round-1 close rate (last 7d)"
        value={roundOneCloseRate === null ? '—' : formatPercent(roundOneCloseRate)}
        tone="positive"
      />
      <KpiCard
        icon={Repeat}
        label="Avg negotiation rounds (last 7d)"
        value={
          avgRounds === null || !Number.isFinite(avgRounds)
            ? '—'
            : avgRounds.toFixed(1)
        }
      />
      <KpiCard
        icon={Clock}
        label="Avg call duration (last 7d)"
        value={formatDuration(avgDuration)}
      />
    </div>
  )
}
