import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { CallSentiment } from '@/lib/types'

interface Props {
  sentiment?: CallSentiment | null
  className?: string
}

function variantFor(sentiment?: CallSentiment | null): BadgeProps['variant'] {
  const v = (sentiment ?? '').toString().toLowerCase()
  if (v === 'positive') return 'success'
  if (v === 'negative') return 'destructive'
  if (v === 'neutral') return 'muted'
  return 'muted'
}

export function SentimentBadge({ sentiment, className }: Props) {
  if (!sentiment) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <Badge variant={variantFor(sentiment)} className={className}>
      {sentiment}
    </Badge>
  )
}
