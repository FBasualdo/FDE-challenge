'use client'

import useSWR from 'swr'
import {
  Phone,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  ListChecks,
  Percent,
  Target,
  ShieldOff,
} from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { PageHeader } from '@/core/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { KpiCard } from './KpiCard'
import { OutcomesPie } from './OutcomesPie'
import { SentimentBars } from './SentimentBars'
import { CallsByDayLine } from './CallsByDayLine'
import { RepeatFunnel } from './overview/RepeatFunnel'
import { FirstTimeVsRepeatBars } from './overview/FirstTimeVsRepeatBars'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import type { MetricsSummary } from '@/lib/types'

export function MetricsPage() {
  const { data, error, isLoading, mutate } = useSWR<MetricsSummary>('/metrics/summary', swrFetcher)

  return (
    <>
      <PageHeader
        title="Analytics — overview"
        description="Aggregate KPIs across all agents and inbound calls. Drill into Carriers, Lanes, or Negotiation for the actionable cuts."
      />

      {error && <ErrorState title="Could not load metrics" error={error} onRetry={() => void mutate()} />}

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* Repeat funnel + first-time vs repeat — top-of-page retention picture. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RepeatFunnel data={data.repeat_funnel} />
            <FirstTimeVsRepeatBars data={data.first_time_vs_repeat} />
          </div>

          {/* Top-line KPIs — 6 cards: total / booked / booking rate / revenue / R1 close / FMCSA killed. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              icon={Phone}
              label="Total calls"
              value={formatNumber(data.totals.total_calls)}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Booked"
              value={formatNumber(data.totals.booked_calls)}
              tone="positive"
            />
            <KpiCard
              icon={Percent}
              label="Booking rate"
              value={formatPercent(data.totals.booking_rate)}
              tone="positive"
            />
            <KpiCard
              icon={DollarSign}
              label="Revenue negotiated"
              value={formatMoney(data.totals.total_revenue_negotiated)}
              tone="accent"
            />
            <KpiCard
              icon={Target}
              label="Round-1 close rate"
              value={formatPercent(data.round_one_close_rate ?? null)}
              hint="Booked in opening offer"
              tone="positive"
            />
            <KpiCard
              icon={ShieldOff}
              label="FMCSA killed"
              value={formatPercent(data.fmcsa_killed_rate ?? null)}
              hint="Killed at verification"
              tone="negative"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OutcomesPie
              data={Object.entries(data.outcomes_distribution).map(([name, value]) => ({ name, value }))}
            />
            <SentimentBars
              data={Object.entries(data.quality.sentiment_distribution).map(([name, value]) => ({ name, value }))}
            />
          </div>

          <CallsByDayLine data={data.calls_by_day} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiCard
              icon={ListChecks}
              label="Avg negotiation rounds"
              value={
                data.negotiation.avg_rounds_to_close !== null
                  ? data.negotiation.avg_rounds_to_close.toFixed(1)
                  : '—'
              }
            />
            <KpiCard
              icon={TrendingUp}
              label="Avg margin vs loadboard"
              value={formatPercent(data.negotiation.avg_margin_vs_loadboard)}
            />
          </div>
        </div>
      )}
    </>
  )
}
