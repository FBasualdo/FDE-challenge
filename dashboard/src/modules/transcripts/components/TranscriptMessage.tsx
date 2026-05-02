import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import type { TranscriptMessage as Msg } from '@/lib/types'

interface Props {
  message: Msg
}

export function TranscriptMessage({ message }: Props) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const ts = message.timestamp ?? message.created_at
  const Icon = isUser ? User : Bot
  const speaker = isUser ? 'Carrier' : isAssistant ? 'Agent' : message.role

  return (
    <div className={cn('flex gap-3 group', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-foreground/10',
          isUser
            ? 'bg-[var(--status-info)]/15 text-[var(--status-info)]'
            : 'bg-muted text-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className={cn('flex max-w-[80%] flex-col gap-1', isUser && 'items-end')}>
        <div className={cn('flex items-center gap-2 text-[11px] text-muted-foreground', isUser && 'flex-row-reverse')}>
          <span className="font-medium uppercase tracking-wide">{speaker}</span>
          {ts && <span>{formatDateTime(ts)}</span>}
        </div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-[var(--status-info)]/10 text-foreground ring-1 ring-[var(--status-info)]/20'
              : 'bg-muted/40 text-foreground ring-1 ring-foreground/5',
          )}
        >
          {message.content?.trim() || <span className="text-xs text-muted-foreground">(no content)</span>}
        </div>
      </div>
    </div>
  )
}
