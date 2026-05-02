'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type LaneGranularity = 'city' | 'state'
export type LaneWindow = '14d' | '30d' | 'all'

export interface LaneFilters {
  granularity: LaneGranularity
  window: LaneWindow
  min_calls: number | null
}

export const DEFAULT_LANE_FILTERS: LaneFilters = {
  granularity: 'city',
  window: '14d',
  min_calls: null,
}

/** URL-synced filters for the Lanes page. */
export function useLaneFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = useMemo<LaneFilters>(() => {
    const g = (params.get('granularity') ?? '') as LaneGranularity
    const granularity: LaneGranularity = g === 'state' ? 'state' : 'city'
    const w = (params.get('window') ?? '') as LaneWindow
    const window: LaneWindow = w === '30d' || w === 'all' ? w : '14d'
    const minRaw = params.get('min_calls')
    const minNum = minRaw ? Number(minRaw) : NaN
    const min_calls = Number.isFinite(minNum) && minNum > 0 ? minNum : null
    return { granularity, window, min_calls }
  }, [params])

  const setFilters = useCallback(
    (next: Partial<LaneFilters>) => {
      const merged: LaneFilters = { ...filters, ...next }
      const sp = new URLSearchParams()
      if (merged.granularity !== 'city') sp.set('granularity', merged.granularity)
      if (merged.window !== '14d') sp.set('window', merged.window)
      if (merged.min_calls !== null) sp.set('min_calls', String(merged.min_calls))
      const search = sp.toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [filters, pathname, router],
  )

  return { filters, setFilters }
}
