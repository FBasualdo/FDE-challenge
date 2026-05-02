'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type CarrierSort =
  | 'calls'
  | 'booking_rate'
  | 'avg_quote_premium_pct'
  | 'drop_rate'
  | 'last_called_at'

export interface CarrierFilters {
  sort: CarrierSort
  min_calls: number | null
}

export const DEFAULT_CARRIER_FILTERS: CarrierFilters = {
  sort: 'calls',
  min_calls: null,
}

/**
 * URL-synced filters for the Carriers leaderboard. Same shape pattern as the
 * transcripts useFilters hook — query-string is the source of truth so the
 * back button + share-link both work.
 */
export function useCarrierFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = useMemo<CarrierFilters>(() => {
    const sortRaw = (params.get('sort') ?? '') as CarrierSort
    const valid: CarrierSort[] = [
      'calls',
      'booking_rate',
      'avg_quote_premium_pct',
      'drop_rate',
      'last_called_at',
    ]
    const sort: CarrierSort = valid.includes(sortRaw) ? sortRaw : 'calls'
    const minRaw = params.get('min_calls')
    const minNum = minRaw ? Number(minRaw) : NaN
    const min_calls = Number.isFinite(minNum) && minNum > 0 ? minNum : null
    return { sort, min_calls }
  }, [params])

  const setFilters = useCallback(
    (next: Partial<CarrierFilters>) => {
      const merged: CarrierFilters = { ...filters, ...next }
      const sp = new URLSearchParams()
      if (merged.sort && merged.sort !== 'calls') sp.set('sort', merged.sort)
      if (merged.min_calls !== null) sp.set('min_calls', String(merged.min_calls))
      const search = sp.toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [filters, pathname, router],
  )

  return { filters, setFilters }
}
