import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import type { CallDetail } from '@/lib/types'

interface Props {
  call: CallDetail
}

export function LoadPanel({ call }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>Load</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 text-sm">
        <KV label="Load ID" value={call.load_id ? <span className="font-mono">{call.load_id}</span> : '—'} />
        <KV label="Lane" value={<LaneCell origin={call.origin} destination={call.destination} />} />
        <KV label="Loadboard rate" value={<MoneyCell value={call.loadboard_rate} tone="muted" />} />
      </CardContent>
    </Card>
  )
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}
