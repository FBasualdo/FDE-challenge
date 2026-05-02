'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type EligibleFilter = 'all' | 'eligible' | 'ineligible'

export interface VerificationFilters {
  mc: string
  eligible: EligibleFilter
  q: string
  from: string
  to: string
}

export const EMPTY_VERIFICATION_FILTERS: VerificationFilters = {
  mc: '',
  eligible: 'all',
  q: '',
  from: '',
  to: '',
}

const ELIGIBLE_VALUES: EligibleFilter[] = ['all', 'eligible', 'ineligible']

/**
 * URL-synced filters for the FMCSA verifications log. Same shape pattern as
 * the transcripts useFilters hook so the back button + share-link both work.
 */
export function useVerificationFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = useMemo<VerificationFilters>(() => {
    const eligibleRaw = (params.get('eligible') ?? 'all') as EligibleFilter
    const eligible: EligibleFilter = ELIGIBLE_VALUES.includes(eligibleRaw)
      ? eligibleRaw
      : 'all'
    return {
      mc: params.get('mc') ?? '',
      eligible,
      q: params.get('q') ?? '',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
    }
  }, [params])

  const setFilters = useCallback(
    (next: Partial<VerificationFilters>) => {
      const merged: VerificationFilters = { ...filters, ...next }
      const sp = new URLSearchParams()
      if (merged.mc) sp.set('mc', merged.mc)
      if (merged.eligible !== 'all') sp.set('eligible', merged.eligible)
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
    filters.mc.length > 0 ||
    filters.eligible !== 'all' ||
    filters.q.length > 0 ||
    filters.from.length > 0 ||
    filters.to.length > 0

  return { filters, setFilters, clear, hasActiveFilters }
}

/** Translate UI filter state into query params for GET /verifications. */
export function verificationFiltersToQuery(
  f: VerificationFilters,
  extra: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    mc_number: f.mc || undefined,
    eligible:
      f.eligible === 'eligible'
        ? 'true'
        : f.eligible === 'ineligible'
          ? 'false'
          : undefined,
    q: f.q || undefined,
    date_from: f.from || undefined,
    date_to: f.to || undefined,
    ...extra,
  }
}

/** Build the matching ?-prefixed query string for export endpoints. */
export function verificationFiltersToSearchString(f: VerificationFilters): string {
  const sp = new URLSearchParams()
  if (f.mc) sp.set('mc_number', f.mc)
  if (f.eligible === 'eligible') sp.set('eligible', 'true')
  if (f.eligible === 'ineligible') sp.set('eligible', 'false')
  if (f.q) sp.set('q', f.q)
  if (f.from) sp.set('date_from', f.from)
  if (f.to) sp.set('date_to', f.to)
  return sp.toString()
}
