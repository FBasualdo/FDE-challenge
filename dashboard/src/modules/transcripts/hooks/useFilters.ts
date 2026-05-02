'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export interface TranscriptFilters {
  outcome: string[]
  sentiment: string[]
  mc: string
  q: string
  from: string
  to: string
}

export const EMPTY_FILTERS: TranscriptFilters = {
  outcome: [],
  sentiment: [],
  mc: '',
  q: '',
  from: '',
  to: '',
}

const CSV_KEYS = ['outcome', 'sentiment'] as const

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * URL-synced filter state. Source of truth is the query string so the back
 * button + share-link both work.
 */
export function useFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = useMemo<TranscriptFilters>(
    () => ({
      outcome: parseCsv(params.get('outcome')),
      sentiment: parseCsv(params.get('sentiment')),
      mc: params.get('mc') ?? '',
      q: params.get('q') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
    }),
    [params],
  )

  const setFilters = useCallback(
    (next: Partial<TranscriptFilters>) => {
      const merged: TranscriptFilters = { ...filters, ...next }
      const sp = new URLSearchParams()
      for (const key of CSV_KEYS) {
        const value = merged[key]
        if (value && value.length > 0) sp.set(key, value.join(','))
      }
      if (merged.mc) sp.set('mc', merged.mc)
      if (merged.q) sp.set('q', merged.q)
      if (merged.from) sp.set('from', merged.from)
      if (merged.to) sp.set('to', merged.to)
      const search = sp.toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [filters, pathname, router],
  )

  const clear = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  const hasActiveFilters =
    filters.outcome.length > 0 ||
    filters.sentiment.length > 0 ||
    filters.mc.length > 0 ||
    filters.q.length > 0 ||
    filters.from.length > 0 ||
    filters.to.length > 0

  return { filters, setFilters, clear, hasActiveFilters }
}

/** Translate UI filter state into query params accepted by GET /calls. */
export function filtersToQuery(
  f: TranscriptFilters,
  extra: Record<string, string | undefined> = {},
): Record<string, string | string[] | undefined> {
  return {
    outcome: f.outcome.length > 0 ? f.outcome : undefined,
    sentiment: f.sentiment.length > 0 ? f.sentiment : undefined,
    mc_number: f.mc || undefined,
    q: f.q || undefined,
    date_from: f.from || undefined,
    date_to: f.to || undefined,
    ...extra,
  }
}

/**
 * Serialise the filter state to a URL search string ("a=1&b=2", no leading "?")
 * matching the backend's /calls query-param contract — used by the Excel export.
 */
export function filtersToSearchString(
  f: TranscriptFilters,
  extra: Record<string, string | undefined> = {},
): string {
  const sp = new URLSearchParams()
  for (const v of f.outcome) sp.append('outcome', v)
  for (const v of f.sentiment) sp.append('sentiment', v)
  if (f.mc) sp.set('mc_number', f.mc)
  if (f.q) sp.set('q', f.q)
  if (f.from) sp.set('date_from', f.from)
  if (f.to) sp.set('date_to', f.to)
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== '') sp.set(k, v)
  }
  return sp.toString()
}
