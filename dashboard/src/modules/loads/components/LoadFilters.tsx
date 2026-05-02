'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  EQUIPMENT_OPTIONS,
  useLoadFilters,
  type EquipmentFilter,
  type LoadFilters as Filters,
  type StatusFilter,
} from '@/modules/loads/hooks/useLoadFilters'

interface Props {
  /** Optional slot rendered on the right edge of the filter row (e.g. Export button). */
  rightSlot?: React.ReactNode
}

export function LoadFilters({ rightSlot }: Props) {
  const { filters, setFilters, clear, hasActiveFilters } = useLoadFilters()
  const [origin, setOrigin] = useState(filters.origin)
  const [destination, setDestination] = useState(filters.destination)

  useEffect(() => setOrigin(filters.origin), [filters.origin])
  useEffect(() => setDestination(filters.destination), [filters.destination])

  // Debounce text inputs (350ms) — same pattern as the transcripts FilterBar.
  useEffect(() => {
    const id = setTimeout(() => {
      if (origin !== filters.origin) setFilters({ origin })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin])

  useEffect(() => {
    const id = setTimeout(() => {
      if (destination !== filters.destination) setFilters({ destination })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination])

  const update = (next: Partial<Filters>) => setFilters(next)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-origin" className="text-xs text-muted-foreground">
            Origin
          </Label>
          <Input
            id="lf-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Chicago, IL"
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-destination" className="text-xs text-muted-foreground">
            Destination
          </Label>
          <Input
            id="lf-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Dallas, TX"
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-equipment" className="text-xs text-muted-foreground">
            Equipment
          </Label>
          <select
            id="lf-equipment"
            value={filters.equipment}
            onChange={(e) => update({ equipment: e.target.value as EquipmentFilter })}
            className={cn(
              'h-9 w-40 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring',
            )}
          >
            <option value="">All equipment</option>
            {EQUIPMENT_OPTIONS.filter(Boolean).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <select
            id="lf-status"
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as StatusFilter })}
            className={cn(
              'h-9 w-36 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring',
            )}
          >
            <option value="all">All statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-pickup-from" className="text-xs text-muted-foreground">
            Pickup from
          </Label>
          <Input
            id="lf-pickup-from"
            type="date"
            value={filters.pickup_from}
            onChange={(e) => update({ pickup_from: e.target.value })}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lf-pickup-to" className="text-xs text-muted-foreground">
            Pickup to
          </Label>
          <Input
            id="lf-pickup-to"
            type="date"
            value={filters.pickup_to}
            onChange={(e) => update({ pickup_to: e.target.value })}
            className="w-40"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X />
            Clear filters
          </Button>
        )}

        {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
      </div>
    </div>
  )
}
