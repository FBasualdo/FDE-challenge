'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  mix: Record<string, number>
}

const COLORS: readonly string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-5)',
]
const FALLBACK_COLOR = 'var(--chart-4)'

/**
 * Inline horizontal stacked bar (60px × 8px) with up to 4 segments. Sorted
 * largest first; long tail collapsed into "other" so the bar stays readable.
 */
export function LaneEquipmentMixCell({ mix }: Props) {
  const entries = Object.entries(mix ?? {}).filter(([, v]) => v > 0)
  if (entries.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const total = entries.reduce((acc, [, v]) => acc + v, 0)
  const sorted = entries.sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const restSum = rest.reduce((acc, [, v]) => acc + v, 0)
  const segments: { label: string; value: number; color: string }[] = top.map(([label, value], i) => ({
    label,
    value,
    color: COLORS[i] ?? FALLBACK_COLOR,
  }))
  if (restSum > 0) {
    segments.push({ label: 'Other', value: restSum, color: COLORS[3] ?? FALLBACK_COLOR })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 w-16 overflow-hidden rounded-sm ring-1 ring-foreground/10">
          {segments.map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              aria-label={`${s.label}: ${s.value}`}
            />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-1">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              <span className="capitalize">{s.label}</span>
              <span className="ml-auto font-mono tabular-nums">
                {s.value} ({((s.value / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
