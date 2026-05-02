'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import type { NegotiationStats } from '@/lib/types'

interface Props {
  data: NegotiationStats['acceptance_by_round']
}

/**
 * Stacked bar — accepts vs counters vs rejects per round. The shape tells the
 * broker whether the bot is closing on the opening anchor or grinding into
 * round 3.
 */
export function AcceptanceByRoundChart({ data }: Props) {
  const cleaned = (data ?? []).map((d) => ({
    round: `R${d.round}`,
    Accepts: d.accepts,
    Counters: d.counters,
    Rejects: d.rejects,
  }))
  const total = cleaned.reduce((acc, d) => acc + d.Accepts + d.Counters + d.Rejects, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Round-by-round acceptance</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="No negotiation data yet"
            description="Once your bot runs through a few negotiations, the round-by-round shape will show up here."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaned} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="round" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--popover-foreground)',
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                />
                <Bar dataKey="Accepts" stackId="a" fill="var(--status-positive)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Counters" stackId="a" fill="var(--chart-5)" />
                <Bar dataKey="Rejects" stackId="a" fill="var(--status-negative)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
