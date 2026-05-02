'use client'

import { Fragment, useEffect, useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react'
import { apiFetch, swrFetcher } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { JsonViewer } from '@/core/ui-extras/JsonViewer'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { Pagination } from '@/modules/transcripts/components/Pagination'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VerificationDetail, VerificationsResponse } from '@/lib/types'
import {
  useVerificationFilters,
  verificationFiltersToQuery,
} from '../hooks/useVerificationFilters'

interface Props {
  pageSize?: number
  onItemsChange?: (count: number) => void
}

export function VerificationsTable({ pageSize = 25, onItemsChange }: Props) {
  const { filters } = useVerificationFilters()
  const [items, setItems] = useState<VerificationDetail[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const baseQuery = {
    ...verificationFiltersToQuery(filters),
    limit: pageSize,
  }
  const filterKey = JSON.stringify(baseQuery)

  const { data, error, isLoading, mutate } = useSWR<VerificationsResponse>(
    [`/verifications`, baseQuery],
    swrFetcher,
    { revalidateOnFocus: false, keepPreviousData: false },
  )

  useEffect(() => {
    if (data) {
      setItems(data.items ?? [])
      setCursor(data.next_cursor ?? null)
      setExpanded(null)
    }
  }, [filterKey, data])

  useEffect(() => {
    onItemsChange?.(items.length)
  }, [items.length, onItemsChange])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const next = await apiFetch<VerificationsResponse>(`/verifications`, {
        query: { ...baseQuery, cursor },
      })
      setItems((prev) => [...prev, ...(next.items ?? [])])
      setCursor(next.next_cursor ?? null)
    } catch {
      // Keep cursor for manual retry.
    } finally {
      setLoadingMore(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load verifications"
        error={error}
        onRetry={() => void mutate()}
      />
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Checked at</TableHead>
            <TableHead>MC</TableHead>
            <TableHead>Carrier</TableHead>
            <TableHead>Eligible</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`s-${i}`}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading &&
            items.map((v) => {
              const isOpen = expanded === v.id
              const toggle = () => setExpanded(isOpen ? null : v.id)
              return (
                <Fragment key={v.id}>
                  <TableRow
                    onClick={toggle}
                    className="cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <TableCell className="px-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle()
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(v.checked_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">{v.mc_number}</TableCell>
                    <TableCell className="text-sm">
                      {v.carrier_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.eligible ? 'success' : 'destructive'}>
                        {v.eligible ? 'Eligible' : 'Not eligible'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.status ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="block max-w-[24rem] truncate" title={v.reason ?? undefined}>
                        {v.reason ?? '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className={cn('bg-muted/20 hover:bg-muted/20')}>
                      <TableCell colSpan={7} className="px-3 py-3">
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                MC #
                              </div>
                              <div className="font-mono text-foreground">{v.mc_number}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                DOT #
                              </div>
                              <div className="font-mono text-foreground">{v.dot_number ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Carrier
                              </div>
                              <div className="text-foreground">{v.carrier_name ?? '—'}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Status
                              </div>
                              <div className="font-mono text-foreground">{v.status ?? '—'}</div>
                            </div>
                          </div>
                          <JsonViewer
                            data={v.raw_response ?? null}
                            label="FMCSA raw response"
                            defaultOpen
                            maxHeight={360}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}

          {!isLoading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="px-0 py-0">
                <EmptyState
                  icon={ShieldCheck}
                  title="No verifications match these filters"
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
  )
}
