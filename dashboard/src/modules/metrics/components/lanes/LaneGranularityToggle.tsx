'use client'

import { cn } from '@/lib/utils'
import type { LaneGranularity } from '../../hooks/useLaneFilters'

interface Props {
  value: LaneGranularity
  onChange: (next: LaneGranularity) => void
}

const OPTIONS: { value: LaneGranularity; label: string; hint: string }[] = [
  { value: 'city', label: 'City', hint: 'Atlanta, GA → Miami, FL' },
  { value: 'state', label: 'State', hint: 'GA → FL' },
]

/** Segmented control — collapses lanes by city-pair vs state-pair. */
export function LaneGranularityToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Lane granularity"
      className="inline-flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5 ring-1 ring-foreground/5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
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
  )
}
