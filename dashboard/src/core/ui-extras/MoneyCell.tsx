import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'

interface Props {
  value: number | string | null | undefined
  precise?: boolean
  className?: string
  /** Tone for emphasis (e.g. positive/negative deltas). */
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}

export function MoneyCell({ value, precise, className, tone = 'default' }: Props) {
  const formatted = formatMoney(value, { precise })
  return (
    <span
      className={cn(
        'font-mono tabular-nums whitespace-nowrap',
        tone === 'positive' && 'text-primary',
        tone === 'negative' && 'text-destructive',
        tone === 'muted' && 'text-muted-foreground',
        className,
      )}
    >
      {formatted}
    </span>
  )
}
