'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, AlertTriangle } from 'lucide-react'
import { JsonViewer } from '@/core/ui-extras/JsonViewer'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ToolInvocation } from '@/lib/types'

interface Props {
  invocation: ToolInvocation
  index: number
}

function isErrorResult(result: ToolInvocation['result']): boolean {
  if (result == null) return false
  if (typeof result === 'string') return /error/i.test(result)
  if (typeof result === 'object' && !Array.isArray(result)) {
    const r = result as Record<string, unknown>
    if (typeof r.error === 'string' && r.error.length > 0) return true
    if (typeof r.detail === 'string' && /error/i.test(r.detail)) return true
  }
  return false
}

function formatRelativeMs(ts: number | null | undefined): string | null {
  if (typeof ts !== 'number') return null
  if (ts < 1_000_000) return `${Math.round(ts)}ms`
  // Some platforms emit unix ms; shorten to clock-style
  const date = new Date(ts)
  return date.toLocaleTimeString()
}

export function ToolInvocationCard({ invocation, index }: Props) {
  const [open, setOpen] = useState(false)
  const errored = isErrorResult(invocation.result)
  const tsLabel = formatRelativeMs(invocation.ts)

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
            #{index + 1} {invocation.name}
          </span>
          {tsLabel && <span className="font-mono text-xs text-muted-foreground tabular-nums">{tsLabel}</span>}
        </div>
        {errored && (
          <Badge variant="destructive">
            <AlertTriangle className="size-3" />
            Error
          </Badge>
        )}
      </button>
      <div className={cn('grid transition-all', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-t border-border px-3 py-3 grid grid-cols-1 gap-3">
            <JsonViewer label="Arguments" data={invocation.args} defaultOpen />
            <JsonViewer label="Result" data={invocation.result} defaultOpen />
          </div>
        </div>
      </div>
    </div>
  )
}
