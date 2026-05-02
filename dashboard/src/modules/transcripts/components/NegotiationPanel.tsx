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
          <MoneyCell value={call.carrier_quoted_rate} tone="muted" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Agreed rate</span>
          <MoneyCell value={call.agreed_rate} tone={call.outcome === 'Booked' ? 'positive' : 'default'} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Rounds</span>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {call.num_negotiation_rounds ?? rounds.length ?? '—'}
          </span>
        </div>

        {rounds.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
            {rounds.map((r, i) => (
              <div key={r.id ?? i} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground w-6">#{r.round_number ?? i + 1}</span>
                <MoneyCell value={r.carrier_offer} tone="muted" precise />
                <MoveRight className="size-3 text-muted-foreground" aria-hidden />
                <MoneyCell value={r.agent_counter} tone="default" precise />
                {r.decision && (
                  <span className="ml-auto text-[11px] text-muted-foreground">{r.decision}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
