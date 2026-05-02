import { TrendingUp, MoveRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { OutcomeBadge } from '@/core/ui-extras/OutcomeBadge'
import type { CallDetail } from '@/lib/types'

interface Props {
  call: CallDetail
}

export function NegotiationPanel({ call }: Props) {
  const rounds = call.negotiation_rounds ?? []
  const carrierQuoted =
    typeof call.analysis?.carrier_quoted_rate === 'number'
      ? (call.analysis.carrier_quoted_rate as number)
      : null
  const agreedRate =
    typeof call.negotiation?.final_agreed_rate === 'number'
      ? (call.negotiation.final_agreed_rate as number)
      : null
  const numRounds =
    typeof call.negotiation?.rounds === 'number'
      ? (call.negotiation.rounds as number)
      : rounds.length || null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>Negotiation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Outcome</span>
          <OutcomeBadge outcome={call.outcome} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Carrier quoted</span>
          <MoneyCell value={carrierQuoted} tone="muted" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Agreed rate</span>
          <MoneyCell value={agreedRate} tone={call.outcome === 'Booked' ? 'positive' : 'default'} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Rounds</span>
          <span className="font-mono text-sm tabular-nums text-foreground">{numRounds ?? '—'}</span>
        </div>

        {rounds.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
            {rounds.map((r, i) => (
              <div key={`${r.round}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-6">#{r.round}</span>
                <MoneyCell value={r.carrier_offer} tone="muted" precise />
                <MoveRight className="size-3 text-muted-foreground" aria-hidden />
                <MoneyCell value={r.broker_price ?? null} tone="default" precise />
                <span className="ml-auto text-[11px] text-muted-foreground">{r.action}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
