import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import type { CallDetail } from '@/lib/types'

interface Props {
  call: CallDetail
}

export function LoadPanel({ call }: Props) {
  const loadId = call.load?.load_id as string | undefined
  const origin = call.load?.origin as string | undefined
  const destination = call.load?.destination as string | undefined
  const loadboardRate =
    typeof call.load?.loadboard_rate === 'number' ? (call.load.loadboard_rate as number) : null
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>Load</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 text-sm">
        <KV label="Load ID" value={loadId ? <span className="font-mono">{loadId}</span> : '—'} />
        <KV label="Lane" value={<LaneCell origin={origin} destination={destination} />} />
        <KV label="Loadboard rate" value={<MoneyCell value={loadboardRate} tone="muted" />} />
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
