'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { JsonViewer } from '@/core/ui-extras/JsonViewer'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import type { ToolInvocation } from '@/lib/types'

interface Props {
  invocation: ToolInvocation
  index: number
}

function StatusBadge({ status, error }: { status?: string | null; error?: string | null }) {
  if (error) {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="size-3" />
        Error
      </Badge>
    )
  }
  const ok = !status || /ok|success|complete|done/i.test(status)
  return (
    <Badge variant={ok ? 'success' : 'muted'}>
      {ok ? <CheckCircle2 className="size-3" /> : null}
      {status ?? 'OK'}
    </Badge>
  )
}

export function ToolInvocationCard({ invocation, index }: Props) {
  const [open, setOpen] = useState(false)
  const ts = invocation.created_at ?? invocation.started_at
  const duration = invocation.duration_ms

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-border bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--status-info)]/15 text-[var(--status-info)]">
          <Wrench className="size-3.5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground">
            #{index + 1} {invocation.tool_name ?? 'tool'}
          </span>
          <span className="text-xs text-muted-foreground truncate">{formatDateTime(ts)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {typeof duration === 'number' && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {duration}ms
            </span>
          )}
          <StatusBadge status={invocation.status} error={invocation.error} />
        </div>
      </button>
      <div className={cn('grid transition-all', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-t border-border px-3 py-3 grid grid-cols-1 gap-3">
            <JsonViewer label="Arguments" data={invocation.args} defaultOpen />
            <JsonViewer label="Result" data={invocation.result} defaultOpen />
            {invocation.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <span className="font-medium">Error:</span> {invocation.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
