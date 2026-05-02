'use client'

import useSWR from 'swr'
import { Target, Award, DollarSign, TrendingDown } from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { PageHeader } from '@/core/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { KpiCard } from '../KpiCard'
import { formatMoney, formatPercent } from '@/lib/format'
import type { NegotiationStats } from '@/lib/types'
import { AcceptanceByRoundChart } from './AcceptanceByRoundChart'
import { GapHistogram } from './GapHistogram'
import { MoneySavedTable } from './MoneySavedTable'

export function NegotiationPage() {
  const { data, error, isLoading, mutate } = useSWR<NegotiationStats>(
    '/metrics/negotiation',
    swrFetcher,
  )

  return (
    <>
      <PageHeader
        title="Negotiation"
        description="Round-by-round closes, R1 opening asks, and the money your bot is keeping off the table."
      />

      {error && (
        <ErrorState title="Could not load negotiation stats" error={error} onRetry={() => void mutate()} />
      )}

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Target}
              label="Round-1 close rate"
              value={formatPercent(data.round_one_close_rate ?? null)}
              tone="positive"
              hint="Booked on opening offer"
            />
            <KpiCard
              icon={Award}
              label="Final-offer success"
              value={formatPercent(data.final_offer_success_rate ?? null)}
              hint="Take-it-or-leave-it accepts"
              tone="accent"
            />
            <KpiCard
              icon={DollarSign}
              label="Total saved"
              value={formatMoney(data.money_left_on_table.total)}
              tone="positive"
              hint="Where carrier opened above LB"
            />
            <KpiCard
              icon={TrendingDown}
              label="Avg savings / booked"
              value={formatMoney(data.money_left_on_table.avg_per_booked_call ?? null)}
              hint={`${data.money_left_on_table.savings_count} qualifying calls`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AcceptanceByRoundChart data={data.acceptance_by_round} />
            <GapHistogram data={data.gap_histogram_round1} />
          </div>

          <MoneySavedTable data={data.money_left_on_table} />
        </div>
      )}
    </>
  )
}
