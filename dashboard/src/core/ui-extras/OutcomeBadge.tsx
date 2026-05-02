import { Badge } from '@/components/ui/badge'
import type { CallOutcome } from '@/lib/types'
import type { BadgeProps } from '@/components/ui/badge'

interface Props {
  outcome?: CallOutcome | null
  className?: string
}

function variantFor(outcome?: CallOutcome | null): BadgeProps['variant'] {
  const v = (outcome ?? '').toString().toLowerCase()
  if (v.includes('book')) return 'success'
  if (v.includes('declin')) return 'destructive'
  if (v.includes('voicemail') || v.includes('no agreement')) return 'warning'
  return 'muted'
}

export function OutcomeBadge({ outcome, className }: Props) {
  if (!outcome) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <Badge variant={variantFor(outcome)} className={className}>
      {outcome}
    </Badge>
  )
}
