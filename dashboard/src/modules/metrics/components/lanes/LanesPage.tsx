'use client'

import useSWR from 'swr'
import { PageHeader } from '@/core/layout/PageHeader'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { swrFetcher } from '@/lib/api'
import type { LanesResponse } from '@/lib/types'
import { LaneTable } from './LaneTable'
import { LaneGranularityToggle } from './LaneGranularityToggle'
import { useLaneFilters, type LaneWindow } from '../../hooks/useLaneFilters'
import { cn } from '@/lib/utils'

const WINDOW_OPTIONS: { value: LaneWindow; label: string }[] = [
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
]

export function LanesPage() {
  const { filters, setFilters } = useLaneFilters()

  const baseQuery: Record<string, string | number | undefined> = {
    granularity: filters.granularity,
    window: filters.window,
    min_calls: filters.min_calls ?? undefined,
    limit: 100,
  }

  const { data, error, isLoading, mutate } = useSWR<LanesResponse>(
    ['/metrics/lanes', baseQuery],
    swrFetcher,
    { revalidateOnFocus: false },
  )

  return (
    <>
      <PageHeader
        title="Lanes"
        description="Where carriers want to run, where you're paying up, where you're paying less. Heat trend is week-over-week call volume."
      />

      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Granularity</Label>
          <LaneGranularityToggle
            value={filters.granularity}
            onChange={(g) => setFilters({ granularity: g })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Window</Label>
          <div
            role="radiogroup"
            aria-label="Time window"
            className="inline-flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5 ring-1 ring-foreground/5"
          >
            {WINDOW_OPTIONS.map((opt) => {
              const active = filters.window === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFilters({ window: opt.value })}
                  className={cn(
                    'inline-flex h-7 items-center justify-center rounded-sm px-3 text-xs font-medium transition-colors',
                    active
                      ? 'bg-background text-foreground ring-1 ring-[var(--status-positive)]/40'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lane-min-calls" className="text-xs text-muted-foreground">
            Min calls
          </Label>
          <Input
            id="lane-min-calls"
            type="number"
            min={0}
            inputMode="numeric"
            value={filters.min_calls ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              const n = raw ? Number(raw) : NaN
              setFilters({ min_calls: Number.isFinite(n) && n > 0 ? n : null })
            }}
            placeholder="e.g. 5"
            className="w-28"
          />
        </div>

        {(filters.granularity !== 'city' || filters.window !== '14d' || filters.min_calls !== null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({ granularity: 'city', window: '14d', min_calls: null })
            }
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState title="Could not load lanes" error={error} onRetry={() => void mutate()} />
      ) : (
        <LaneTable items={data?.items ?? []} isLoading={isLoading} />
      )}
    </>
  )
}
