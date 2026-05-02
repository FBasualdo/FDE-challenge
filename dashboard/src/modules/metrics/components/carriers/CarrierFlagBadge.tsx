import { Shield, AlertTriangle, Flame, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CarrierFlag } from '@/lib/types'

interface Props {
  flag: CarrierFlag
}

const META: Record<
  CarrierFlag,
  {
    label: string
    variant: 'destructive' | 'warning' | 'success' | 'muted'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  tire_kicker: { label: 'Tire-kicker', variant: 'destructive', icon: AlertTriangle },
  hostage: { label: 'Hostage', variant: 'warning', icon: Flame },
  top_repeat: { label: 'Top repeat', variant: 'success', icon: Trophy },
  repeat_ineligible: { label: 'Ineligible', variant: 'muted', icon: Shield },
}

/**
 * Semantic carrier flag pill — used in the leaderboard and the drawer header.
 * Color carries the meaning; the icon reinforces it for users not relying on
 * color alone.
 */
export function CarrierFlagBadge({ flag }: Props) {
  const meta = META[flag]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <Badge variant={meta.variant}>
      <Icon className="size-3" aria-hidden />
      <span>{meta.label}</span>
    </Badge>
  )
}
