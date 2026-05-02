'use client'

import { useState, useEffect } from 'react'
import { Filter, X, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useFilters, type TranscriptFilters } from '@/modules/transcripts/hooks/useFilters'

const OUTCOMES = ['Booked', 'Carrier Declined', 'Shipper Declined', 'No Agreement', 'Voicemail', 'Other']
const SENTIMENTS = ['Positive', 'Neutral', 'Negative']

interface MultiSelectProps {
  label: string
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
}

function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between">
          <Filter className="size-3.5" />
          <span>{label}</span>
          {value.length > 0 && (
            <Badge variant="primary" className="ml-1">
              {value.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <ul className="flex flex-col gap-0.5">
          {options.map((opt) => {
            const checked = value.includes(opt)
            return (
              <li key={opt}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(opt)} />
                  <span className="truncate">{opt}</span>
                </label>
              </li>
            )
          })}
        </ul>
        {value.length > 0 && (
          <>
            <Separator className="my-2" />
            <Button variant="ghost" size="xs" className="w-full" onClick={() => onChange([])}>
              Clear
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function FilterBar() {
  const { filters, setFilters, clear, hasActiveFilters } = useFilters()
  // Local mirror for text inputs so we can debounce updates to the URL.
  const [mc, setMc] = useState(filters.mc)
  const [q, setQ] = useState(filters.q)

  useEffect(() => setMc(filters.mc), [filters.mc])
  useEffect(() => setQ(filters.q), [filters.q])

  // Debounce text inputs (350ms).
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

  const update = (next: Partial<TranscriptFilters>) => setFilters(next)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-col gap-1">
          <Label htmlFor="filter-q" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="filter-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="detention, layover…"
              className="pl-7"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-mc" className="text-xs text-muted-foreground">
            MC #
          </Label>
          <Input
            id="filter-mc"
            value={mc}
            onChange={(e) => setMc(e.target.value)}
            placeholder="1521248"
            className="w-32"
            inputMode="numeric"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(e) => update({ from: e.target.value })}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={filters.to}
            onChange={(e) => update({ to: e.target.value })}
            className="w-40"
          />
        </div>

        <div className="flex items-end gap-2">
          <MultiSelect
            label="Outcome"
            options={OUTCOMES}
            value={filters.outcome}
            onChange={(v) => update({ outcome: v })}
          />
          <MultiSelect
            label="Sentiment"
            options={SENTIMENTS}
            value={filters.sentiment}
            onChange={(v) => update({ sentiment: v })}
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clear} className="ml-auto text-muted-foreground hover:text-foreground">
            <X />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
