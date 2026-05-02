'use client'

import Link from 'next/link'
import useSWR from 'swr'
import {
  Phone,
  CheckCircle2,
  DollarSign,
  Target,
  ShieldOff,
  Repeat,
} from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { PageHeader } from '@/core/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { KpiCard } from './KpiCard'
import { OutcomesBars } from './OutcomesBars'
import { SentimentBars } from './SentimentBars'
import { CallsByDayBar } from './CallsByDayBar'
import { RepeatFunnel } from './overview/RepeatFunnel'
import { TopCarriersCard } from './overview/TopCarriersCard'
import { CarrierMarginCard } from './overview/CarrierMarginCard'
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
          {/* Repeat funnel + top carriers + margin retention — relationship + profitability picture. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RepeatFunnel data={data.repeat_funnel} />
            <TopCarriersCard data={data.top_carriers} />
            <CarrierMarginCard data={data.carrier_margin} />
          </div>

          {/* 6 headline KPIs. Total/Booked combined into one card to free a slot. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              icon={Phone}
              label="Calls"
              value={formatNumber(data.totals.total_calls)}
              hint={`${formatNumber(data.totals.booked_calls)} booked`}
            />
            <KpiCard
              icon={CheckCircle2}
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
              hint="Closed without a counter-offer"
              tone="positive"
            />
            <KpiCard
              icon={ShieldOff}
              label="FMCSA killed"
              value={formatPercent(data.fmcsa_killed_rate ?? null)}
              hint={
                <Link
                  href="/metrics/carriers"
                  className="text-foreground hover:underline underline-offset-4"
                >
                  View ineligible carriers →
                </Link>
              }
              tone="negative"
            />
            <KpiCard
              icon={Repeat}
              label="Avg negotiation rounds"
              value={
                data.negotiation.avg_rounds_to_close !== null
                  ? data.negotiation.avg_rounds_to_close.toFixed(1)
                  : '—'
              }
            />
          </div>

          {/* Outcomes (sorted bars) + 7-day calls chart. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OutcomesBars
              data={Object.entries(data.outcomes_distribution).map(([name, value]) => ({ name, value }))}
            />
            <CallsByDayBar data={data.calls_by_day} />
          </div>

          {/* Sentiment as a compact bottom strip — bot-inferred, low protagonism. */}
          <SentimentBars
            data={Object.entries(data.quality.sentiment_distribution).map(([name, value]) => ({ name, value }))}
          />
        </div>
      )}
    </>
  )
}
