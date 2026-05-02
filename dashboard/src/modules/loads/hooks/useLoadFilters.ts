'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type EquipmentFilter = '' | 'Dry Van' | 'Reefer' | 'Flatbed' | 'Step Deck'

export const EQUIPMENT_OPTIONS: EquipmentFilter[] = [
  '',
  'Dry Van',
  'Reefer',
  'Flatbed',
  'Step Deck',
]

export type StatusFilter = 'all' | 'available' | 'booked'

export const STATUS_OPTIONS: StatusFilter[] = ['all', 'available', 'booked']

export interface LoadFilters {
  origin: string
  destination: string
  equipment: EquipmentFilter
  pickup_from: string
  pickup_to: string
  status: StatusFilter
}

export const EMPTY_LOAD_FILTERS: LoadFilters = {
  origin: '',
  destination: '',
  equipment: '',
  pickup_from: '',
  pickup_to: '',
  status: 'all',
}

/**
 * URL-synced load catalog filters. Mirrors the transcripts useFilters pattern
 * so the back button + share-link both keep the user's selections.
 */
export function useLoadFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = useMemo<LoadFilters>(() => {
    const equipmentRaw = params.get('equipment') ?? ''
    const equipment: EquipmentFilter = (
      EQUIPMENT_OPTIONS.includes(equipmentRaw as EquipmentFilter)
        ? equipmentRaw
        : ''
    ) as EquipmentFilter
    const statusRaw = params.get('status') ?? 'all'
    const status: StatusFilter = (
      STATUS_OPTIONS.includes(statusRaw as StatusFilter) ? statusRaw : 'all'
    ) as StatusFilter
    return {
      origin: params.get('origin') ?? '',
      destination: params.get('destination') ?? '',
      equipment,
      pickup_from: params.get('pickup_from') ?? '',
      pickup_to: params.get('pickup_to') ?? '',
      status,
    }
  }, [params])

  const setFilters = useCallback(
    (next: Partial<LoadFilters>) => {
      const merged: LoadFilters = { ...filters, ...next }
      const sp = new URLSearchParams()
      if (merged.origin) sp.set('origin', merged.origin)
      if (merged.destination) sp.set('destination', merged.destination)
      if (merged.equipment) sp.set('equipment', merged.equipment)
      if (merged.pickup_from) sp.set('pickup_from', merged.pickup_from)
      if (merged.pickup_to) sp.set('pickup_to', merged.pickup_to)
      if (merged.status && merged.status !== 'all') sp.set('status', merged.status)
      const search = sp.toString()
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    },
    [filters, pathname, router],
  )

  const clear = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  const hasActiveFilters =
    filters.origin.length > 0 ||
    filters.destination.length > 0 ||
    filters.equipment.length > 0 ||
    filters.pickup_from.length > 0 ||
    filters.pickup_to.length > 0 ||
    filters.status !== 'all'

  return { filters, setFilters, clear, hasActiveFilters }
}

/** Translate UI filter state into query params for GET /loads/catalog. */
export function loadFiltersToQuery(
  f: LoadFilters,
  extra: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    origin: f.origin || undefined,
    destination: f.destination || undefined,
    equipment_type: f.equipment || undefined,
    pickup_from: f.pickup_from || undefined,
    pickup_to: f.pickup_to || undefined,
    status: f.status && f.status !== 'all' ? f.status : undefined,
    ...extra,
  }
}

/** Build the matching ?-prefixed query string for export endpoints. */
export function loadFiltersToSearchString(f: LoadFilters): string {
  const sp = new URLSearchParams()
  if (f.origin) sp.set('origin', f.origin)
  if (f.destination) sp.set('destination', f.destination)
  if (f.equipment) sp.set('equipment_type', f.equipment)
  if (f.pickup_from) sp.set('pickup_from', f.pickup_from)
  if (f.pickup_to) sp.set('pickup_to', f.pickup_to)
  if (f.status && f.status !== 'all') sp.set('status', f.status)
  return sp.toString()
}
