import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { LaneStats } from '@/lib/types'

interface Props {
  trend: LaneStats['trend']
}

const META = {
  heating: {
    label: 'Heating',
    variant: 'destructive' as const,
    icon: TrendingUp,
  },
  cooling: {
    label: 'Cooling',
    variant: 'accent' as const,
    icon: TrendingDown,
  },
  flat: {
    label: 'Flat',
    variant: 'muted' as const,
    icon: Minus,
  },
}

/**
 * Heat trend chip on the lanes table. "Heating" = more carrier interest
 * week-over-week (carriers compete → broker pays less). "Cooling" = less
 * interest (broker has to pay more).
 */
export function LaneTrendChip({ trend }: Props) {
  const meta = META[trend] ?? META.flat
  const Icon = meta.icon
  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3" aria-hidden />
      <span>{meta.label}</span>
    </Badge>
  )
}
