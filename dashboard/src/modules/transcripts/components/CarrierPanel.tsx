import { Truck, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CallDetail } from '@/lib/types'

interface Props {
  call: CallDetail
}

function VerificationStatus({ status }: { status?: string | null }) {
  if (!status) return null
  const ok = /verified|active|pass|ok/i.test(status)
  return (
    <Badge variant={ok ? 'success' : 'warning'}>
      {ok ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
      {status}
    </Badge>
  )
}

export function CarrierPanel({ call }: Props) {
  const verification = call.verifications?.[0]
  const carrierName = (call.carrier?.carrier_name as string | undefined) ?? verification?.carrier_name ?? '—'
  const mcNumber = (call.carrier?.mc_number as string | undefined) ?? verification?.mc_number ?? '—'
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>Carrier</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 text-sm">
        <KV label="Name" value={carrierName} />
        <KV label="MC #" value={mcNumber} mono />
        <KV label="Verification" value={<VerificationStatus status={verification?.status ?? null} />} />
      </CardContent>
    </Card>
  )
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-sm text-foreground' : 'text-sm text-foreground'}>{value}</span>
    </div>
  )
}
