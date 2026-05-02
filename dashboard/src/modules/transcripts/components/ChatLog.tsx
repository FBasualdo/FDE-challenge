import { MessageSquare } from 'lucide-react'
import { TranscriptMessage } from './TranscriptMessage'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import type { TranscriptMessage as Msg } from '@/lib/types'

interface Props {
  messages?: Msg[] | null
}

export function ChatLog({ messages }: Props) {
  // Skip role: tool messages — those live in the Tools tab.
  const visible = (messages ?? []).filter((m) => m.role !== 'tool')

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No transcript available"
        description="The transcript for this call has not been parsed yet."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((m, i) => (
        <TranscriptMessage key={i} message={m} />
      ))}
    </div>
  )
}
