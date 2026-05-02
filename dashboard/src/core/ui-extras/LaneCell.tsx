import { MoveRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  origin?: string | null
  destination?: string | null
  className?: string
}

export function LaneCell({ origin, destination, className }: Props) {
  if (!origin && !destination) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <span className="truncate">{origin ?? '—'}</span>
      <MoveRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{destination ?? '—'}</span>
    </span>
  )
}
