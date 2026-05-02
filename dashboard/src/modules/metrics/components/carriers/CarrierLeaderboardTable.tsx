'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Users } from 'lucide-react'
import { apiFetch, swrFetcher } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { formatNumber, formatPercent, formatRelative } from '@/lib/format'
import type { CarrierStats, CarriersResponse } from '@/lib/types'
import { CarrierFlagBadge } from './CarrierFlagBadge'
import { CarrierSentimentSpark } from './CarrierSentimentSpark'
import { useCarrierFilters, type CarrierSort } from '../../hooks/useCarrierFilters'

interface Props {
  pageSize?: number
  onRowClick: (carrier: CarrierStats) => void
}

/**
 * Carrier leaderboard. Ten columns wide; click a row to drill in. Cursor-paged
 * via SWR for the first page + manual `apiFetch` for "Load more" — same pattern
 * as the transcripts table.
 */
export function CarrierLeaderboardTable({ pageSize = 25, onRowClick }: Props) {
  const { filters } = useCarrierFilters()
  const [items, setItems] = useState<CarrierStats[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const baseQuery: Record<string, string | number | undefined> = {
    sort: filters.sort,
    min_calls: filters.min_calls ?? undefined,
    limit: pageSize,
  }

  const filterKey = JSON.stringify(baseQuery)

  const { data, error, isLoading, mutate } = useSWR<CarriersResponse>(
    ['/metrics/carriers', baseQuery],
    swrFetcher,
    { revalidateOnFocus: false, keepPreviousData: false },
  )

  useEffect(() => {
    if (data) {
      setItems(data.items ?? [])
      setCursor(data.next_cursor ?? null)
    }
  }, [filterKey, data])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const next = await apiFetch<CarriersResponse>('/metrics/carriers', {
        query: { ...baseQuery, cursor },
      })
      setItems((prev) => [...prev, ...(next.items ?? [])])
      setCursor(next.next_cursor ?? null)
    } catch {
      // keep cursor for manual retry
    } finally {
      setLoadingMore(false)
    }
  }

  if (error) {
    return <ErrorState title="Could not load carriers" error={error} onRetry={() => void mutate()} />
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carrier</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Booked</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Premium</TableHead>
            <TableHead className="text-right">Drop</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Last call</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`s-${i}`}>
                {Array.from({ length: 9 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading &&
            items.map((c) => (
              <TableRow
                key={c.mc_number}
                onClick={() => onRowClick(c)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick(c)
                  }
                }}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{c.carrier_name ?? '—'}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">MC {c.mc_number}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  <div className="flex flex-col items-end leading-tight">
                    <span>{formatNumber(c.calls)}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatNumber(c.conversational_calls)} conv
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatNumber(c.booked)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatPercent(c.booking_rate)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {c.avg_quote_premium_pct === null || c.avg_quote_premium_pct === undefined ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-col items-end leading-tight">
                      <span>{formatPercent(c.avg_quote_premium_pct, 0)}</span>
                      {c.premium_share_pct !== null && c.premium_share_pct !== undefined && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatPercent(c.premium_share_pct, 0)} of calls
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatPercent(c.drop_rate, 0)}
                </TableCell>
                <TableCell>
                  <CarrierSentimentSpark trend={c.sentiment_trend ?? []} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatRelative(c.last_called_at)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.flags ?? []).map((f) => (
                      <CarrierFlagBadge key={f} flag={f} />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="px-0 py-0">
                <EmptyState
                  icon={Users}
                  title="No carriers yet"
                  description="Once your bot logs a few calls, this leaderboard will populate."
                  className="border-0 bg-transparent"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {items.length > 0 && cursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

export const CARRIER_SORT_OPTIONS: { value: CarrierSort; label: string }[] = [
  { value: 'calls', label: 'Most calls' },
  { value: 'booking_rate', label: 'Booking rate' },
  { value: 'avg_quote_premium_pct', label: 'Premium %' },
  { value: 'drop_rate', label: 'Drop rate' },
  { value: 'last_called_at', label: 'Recently called' },
]
