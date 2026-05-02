import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'
import { JsonViewer } from '@/core/ui-extras/JsonViewer'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import type { CallDetail } from '@/lib/types'

interface Props {
  call: CallDetail
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function formatKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

export function AnalysisPanel({ call }: Props) {
  const analysis = call.analysis
  const entries = analysis ? Object.entries(analysis) : []

  if (!analysis || entries.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No analysis available"
        description="Once the platform analyzes this call, the booking decision and other annotations will appear here."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>Call analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex flex-col gap-1 rounded-md ring-1 ring-border bg-muted/20 px-3 py-2"
            >
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{formatKey(key)}</span>
              {isPrimitive(value) ? (
                <span className="text-sm text-foreground break-words">{String(value)}</span>
              ) : value === null ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                <JsonViewer data={value} label={formatKey(key)} maxHeight={200} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
