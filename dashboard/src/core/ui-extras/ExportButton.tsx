'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { downloadBlob } from '@/lib/download'

interface Props {
  /** Path on the API, e.g. "/calls/export.xlsx". */
  endpoint: string
  /** Active query string (with or without leading "?"), e.g. "outcome=Booked". */
  query?: string
  /** Suggested filename — overrides Content-Disposition if provided. */
  filename?: string
  /** When true, button is disabled and shows the "no data" tooltip. */
  disabled?: boolean
  /** Visible label — defaults to "Export Excel". */
  label?: string
}

/**
 * Right-aligned outline button that downloads an .xlsx from a backend endpoint.
 * Shows a spinner while the request is in flight; surfaces errors via a tiny
 * inline status (we deliberately don't throw a toast here — the dashboard has
 * no toast system yet and a console.error is enough for the FDE demo).
 */
export function ExportButton({ endpoint, query, filename, disabled, label = 'Export Excel' }: Props) {
  const [loading, setLoading] = useState(false)

  const onClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    try {
      const qs = query ? (query.startsWith('?') ? query : `?${query}`) : ''
      await downloadBlob(`${endpoint}${qs}`, filename)
    } catch (err) {
      console.error('[ExportButton] download failed', err)
    } finally {
      setLoading(false)
    }
  }

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
    >
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  )

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper so the Tooltip still triggers when the button is disabled */}
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">No data to export</TooltipContent>
      </Tooltip>
    )
  }

  return button
}
