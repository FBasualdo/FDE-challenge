'use client'

import useSWR from 'swr'
import { swrFetcher } from '@/lib/api'
import { KpiCard } from '@/modules/metrics/components/KpiCard'
import { formatNumber, formatPercent, formatMoney } from '@/lib/format'
import type { CallsResponse, MetricsSummary } from '@/lib/types'
import { Phone, CheckCircle2, DollarSign } from 'lucide-react'

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

  // Booking rate this week (use /metrics/summary if available, fall back to /calls counts)
  const { data: summary } = useSWR<MetricsSummary>(
    [`/metrics/summary`, { agent_id: agentSlug, date_from: startOfWeekIso() }],
    swrFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const callsToday = today?.total ?? today?.items?.length ?? null
  const bookingRate = summary?.booking_rate ?? null
  const revenue = summary?.total_revenue_negotiated ?? null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        icon={Phone}
        label="Calls today"
        value={callsToday === null ? '—' : formatNumber(callsToday)}
      />
      <KpiCard
        icon={CheckCircle2}
        label="Booking rate (this week)"
        value={bookingRate === null ? '—' : formatPercent(bookingRate)}
        tone="positive"
      />
      <KpiCard
        icon={DollarSign}
        label="Revenue negotiated (this week)"
        value={revenue === null ? '—' : formatMoney(revenue)}
      />
    </div>
  )
}
