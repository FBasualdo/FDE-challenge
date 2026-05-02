import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format'

interface Props {
  seconds: number | null | undefined
  className?: string
}

export function DurationCell({ seconds, className }: Props) {
  return (
    <span className={cn('font-mono tabular-nums text-sm', className)}>
      {formatDuration(seconds)}
    </span>
  )
}
