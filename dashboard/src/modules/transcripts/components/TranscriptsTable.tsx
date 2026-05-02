'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { MessageSquare } from 'lucide-react'
import { apiFetch, swrFetcher } from '@/lib/api'
import { useFilters, filtersToQuery } from '@/modules/transcripts/hooks/useFilters'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { OutcomeBadge } from '@/core/ui-extras/OutcomeBadge'
import { SentimentBadge } from '@/core/ui-extras/SentimentBadge'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { DurationCell } from '@/core/ui-extras/DurationCell'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { FilterBar } from './FilterBar'
import { Pagination } from './Pagination'
import { formatDateTime } from '@/lib/format'
import type { CallListItem, CallsResponse } from '@/lib/types'

interface Props {
  /** When set, scopes the table to a single agent (and hides the agent column). */
  agentId?: string
  showAgentColumn?: boolean
  pageSize?: number
}

export function TranscriptsTable({ agentId, showAgentColumn = true, pageSize = 25 }: Props) {
  const { filters } = useFilters()
  const [items, setItems] = useState<CallListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const baseQuery = {
    ...filtersToQuery(filters, agentId ? { agent_id: agentId } : {}),
    limit: pageSize,
  }

  // Reset list when the filters or agent change.
  const filterKey = JSON.stringify(baseQuery)

  const { data, error, isLoading, mutate } = useSWR<CallsResponse>(
    [`/calls`, baseQuery],
    swrFetcher,
    { revalidateOnFocus: false, keepPreviousData: false },
  )

  useEffect(() => {
    if (data) {
      setItems(data.items ?? [])
      setCursor(data.next_cursor ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, data])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const next = await apiFetch<CallsResponse>(`/calls`, {
        query: { ...baseQuery, cursor },
      })
      setItems((prev) => [...prev, ...(next.items ?? [])])
      setCursor(next.next_cursor ?? null)
    } catch {
      // SWR mutate retry isn't useful here — keep cursor for manual retry.
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar />

      {error && <ErrorState title="Could not load calls" error={error} onRetry={() => void mutate()} />}

      {!error && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                {showAgentColumn && <TableHead>Agent</TableHead>}
                <TableHead>Carrier</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead className="text-right">Loadboard</TableHead>
                <TableHead className="text-right">Agreed</TableHead>
                <TableHead className="text-right">Rounds</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: showAgentColumn ? 10 : 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!isLoading &&
                items.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <Link
                        href={`/transcripts/${call.id}`}
                        className="text-foreground hover:text-primary"
                      >
                        {formatDateTime(call.started_at ?? call.created_at)}
                      </Link>
                    </TableCell>
                    {showAgentColumn && (
                      <TableCell className="text-xs">
                        {call.agent_name ?? call.agent_slug ?? '—'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">{call.carrier_name ?? '—'}</span>
                        {call.mc_number && (
                          <span className="font-mono text-[11px] text-muted-foreground">MC {call.mc_number}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LaneCell origin={call.origin} destination={call.destination} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={call.loadboard_rate} tone="muted" />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyCell value={call.agreed_rate} tone={call.outcome === 'Booked' ? 'positive' : 'default'} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {call.num_negotiation_rounds ?? '—'}
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge outcome={call.outcome} />
                    </TableCell>
                    <TableCell>
                      <SentimentBadge sentiment={call.sentiment} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DurationCell seconds={call.duration_seconds} />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={showAgentColumn ? 10 : 9} className="px-0 py-0">
                    <EmptyState
                      icon={MessageSquare}
                      title="No calls match these filters"
                      description="Try widening the date range or clearing some filters."
                      className="border-0 bg-transparent"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {items.length > 0 && (
            <Pagination
              hasMore={Boolean(cursor)}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              totalShown={items.length}
              total={data?.total ?? null}
            />
          )}
        </>
      )}
    </div>
  )
}
