'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Package } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { Pagination } from '@/modules/transcripts/components/Pagination'
import { formatDateTime, formatNumber, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LoadCatalogItem, LoadsCatalogResponse } from '@/lib/types'
import { useLoadFilters, loadFiltersToQuery } from '../hooks/useLoadFilters'
import { LoadDetailDrawer } from './LoadDetailDrawer'

interface Props {
  pageSize?: number
  /** Render-prop receiving the current items count so the parent can disable Export. */
  onItemsChange?: (count: number) => void
}

export function LoadsTable({ pageSize = 25, onItemsChange }: Props) {
  const { filters } = useLoadFilters()
  const [items, setItems] = useState<LoadCatalogItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [drawerLoad, setDrawerLoad] = useState<LoadCatalogItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const baseQuery = {
    ...loadFiltersToQuery(filters),
    limit: pageSize,
  }
  const filterKey = JSON.stringify(baseQuery)

  const { data, error, isLoading, mutate } = useSWR<LoadsCatalogResponse>(
    [`/loads/catalog`, baseQuery],
    swrFetcher,
    { revalidateOnFocus: false, keepPreviousData: false },
  )

  useEffect(() => {
    if (data) {
      setItems(data.items ?? [])
      setCursor(data.next_cursor ?? null)
    }
  }, [filterKey, data])

  useEffect(() => {
    onItemsChange?.(items.length)
  }, [items.length, onItemsChange])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const next = await apiFetch<LoadsCatalogResponse>(`/loads/catalog`, {
        query: { ...baseQuery, cursor },
      })
      setItems((prev) => [...prev, ...(next.items ?? [])])
      setCursor(next.next_cursor ?? null)
    } catch {
      // Keep cursor for manual retry — same fall-through as the transcripts table.
    } finally {
      setLoadingMore(false)
    }
  }

  const openLoad = (load: LoadCatalogItem) => {
    setDrawerLoad(load)
    setDrawerOpen(true)
  }

  if (error) {
    return <ErrorState title="Could not load catalog" error={error} onRetry={() => void mutate()} />
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Load ID</TableHead>
            <TableHead>Lane</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pickup</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead className="text-right">Loadboard</TableHead>
            <TableHead className="text-right">Miles</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`s-${i}`}>
                {Array.from({ length: 10 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading &&
            items.map((load) => {
              const isBooked = load.is_booked ?? false
              const bookedAt = load.booked_at ?? null
              const bookedMc = load.booked_by_mc ?? null
              const agreedRate = load.booked_agreed_rate ?? null
              const tooltipParts = [
                bookedMc ? `MC ${bookedMc}` : null,
                bookedAt ? `on ${formatDateTime(bookedAt)}` : null,
                agreedRate !== null ? `at ${formatMoney(agreedRate)}` : null,
              ].filter(Boolean)
              const tooltipText =
                tooltipParts.length > 0 ? `Booked by ${tooltipParts.join(' ')}` : 'Booked'

              return (
              <TableRow
                key={load.load_id}
                onClick={() => openLoad(load)}
                className={cn('cursor-pointer', isBooked && 'opacity-70')}
              >
                <TableCell className="font-mono text-xs text-foreground">{load.load_id}</TableCell>
                <TableCell>
                  <LaneCell origin={load.origin} destination={load.destination} />
                </TableCell>
                <TableCell>
                  <Badge variant="muted">{load.equipment_type}</Badge>
                </TableCell>
                <TableCell>
                  {isBooked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="muted">Booked</Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap text-left">
                        {tooltipText}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge variant="success">Available</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(load.pickup_datetime)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(load.delivery_datetime)}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyCell value={load.loadboard_rate} />
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatNumber(load.miles)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatNumber(load.weight)}
                </TableCell>
                <TableCell className="max-w-[16rem]">
                  {load.notes ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate text-xs text-muted-foreground">
                          {load.notes}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-sm whitespace-pre-wrap text-left">
                        {load.notes}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
              )
            })}

          {!isLoading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="px-0 py-0">
                <EmptyState
                  icon={Package}
                  title="No loads match these filters"
                  description="Try widening the lane or clearing some filters."
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

      <LoadDetailDrawer load={drawerLoad} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}
