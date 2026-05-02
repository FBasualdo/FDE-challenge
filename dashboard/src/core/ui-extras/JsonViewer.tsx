'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  data: unknown
  /** Start expanded? */
  defaultOpen?: boolean
  /** Optional label rendered above the JSON. */
  label?: string
  className?: string
  /** Max height before scrolling. */
  maxHeight?: number | string
}

function safeStringify(data: unknown): string {
  try {
    if (typeof data === 'string') {
      // Try to pretty-print a JSON string; if it fails just return as-is.
      try {
        return JSON.stringify(JSON.parse(data), null, 2)
      } catch {
        return data
      }
    }
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

export function JsonViewer({ data, defaultOpen = false, label, className, maxHeight = 320 }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  const text = safeStringify(data)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  if (data === null || data === undefined || (typeof data === 'string' && data.length === 0)) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className={cn('rounded-md ring-1 ring-border bg-muted/30', className)}>
      <div className="flex items-center justify-between px-2 py-1 text-xs">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <span className="font-medium">{label ?? 'JSON'}</span>
        </button>
        {open && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            aria-label="Copy JSON"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>
      {open && (
        <pre
          className="m-0 overflow-auto whitespace-pre rounded-b-md border-t border-border bg-background/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
          style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
        >
          {text}
        </pre>
      )}
    </div>
  )
}
