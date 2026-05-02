'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useVerificationFilters,
  type EligibleFilter,
  type VerificationFilters as Filters,
} from '@/modules/compliance/hooks/useVerificationFilters'

interface Props {
  rightSlot?: React.ReactNode
}

export function VerificationFilters({ rightSlot }: Props) {
  const { filters, setFilters, clear, hasActiveFilters } = useVerificationFilters()
  const [mc, setMc] = useState(filters.mc)
  const [q, setQ] = useState(filters.q)

  useEffect(() => setMc(filters.mc), [filters.mc])
  useEffect(() => setQ(filters.q), [filters.q])

  useEffect(() => {
    const id = setTimeout(() => {
      if (mc !== filters.mc) setFilters({ mc })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mc])

  useEffect(() => {
    const id = setTimeout(() => {
      if (q !== filters.q) setFilters({ q })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const update = (next: Partial<Filters>) => setFilters(next)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-col gap-1">
          <Label htmlFor="vf-q" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="vf-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="carrier name, reason…"
              className="pl-7"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="vf-mc" className="text-xs text-muted-foreground">
            MC #
          </Label>
          <Input
            id="vf-mc"
            value={mc}
            onChange={(e) => setMc(e.target.value)}
            placeholder="1521248"
            className="w-32"
            inputMode="numeric"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="vf-eligible" className="text-xs text-muted-foreground">
            Eligibility
          </Label>
          <select
            id="vf-eligible"
            value={filters.eligible}
            onChange={(e) => update({ eligible: e.target.value as EligibleFilter })}
            className={cn(
              'h-9 w-44 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring',
            )}
          >
            <option value="all">All</option>
            <option value="eligible">Eligible only</option>
            <option value="ineligible">Not eligible only</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="vf-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="vf-from"
            type="date"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="vf-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="vf-to"
            type="date"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
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
