'use client'

import { useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { PageHeader } from '@/core/layout/PageHeader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CarrierLeaderboardTable,
  CARRIER_SORT_OPTIONS,
} from './CarrierLeaderboardTable'
import { CarrierDetailDrawer } from './CarrierDetailDrawer'
import { useCarrierFilters } from '../../hooks/useCarrierFilters'
import type { CarrierStats } from '@/lib/types'

export function CarriersPage() {
  const { filters, setFilters } = useCarrierFilters()
  const [selectedMc, setSelectedMc] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sortLabel = CARRIER_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Sort'

  const handleRowClick = (c: CarrierStats) => {
    setSelectedMc(c.mc_number)
    setDrawerOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Carriers"
        description="Top callers ranked by activity, booking rate, premium ask, and more. Click a row for the per-MC drill-in."
      />

      {/* Filters row */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Sort by</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="justify-between gap-2">
                <ArrowDownUp className="size-3.5" />
                <span>{sortLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {CARRIER_SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => setFilters({ sort: opt.value })}
                  className="flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  {filters.sort === opt.value && (
                    <Badge variant="success" className="ml-2">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-min-calls" className="text-xs text-muted-foreground">
            Min calls
          </Label>
          <Input
            id="filter-min-calls"
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.min_calls ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              const n = raw ? Number(raw) : NaN
              setFilters({ min_calls: Number.isFinite(n) && n > 0 ? n : null })
            }}
            placeholder="e.g. 3"
            className="w-28"
          />
        </div>

        {(filters.sort !== 'calls' || filters.min_calls !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ sort: 'calls', min_calls: null })}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      <CarrierLeaderboardTable onRowClick={handleRowClick} />

      <CarrierDetailDrawer mc={selectedMc} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}
