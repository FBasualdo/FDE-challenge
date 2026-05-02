'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import type { NegotiationStats } from '@/lib/types'

interface Props {
  data: NegotiationStats['gap_histogram_round1']
}

/** Round-1 opening-ask distribution — width buckets relative to loadboard. */
export function GapHistogram({ data }: Props) {
  const cleaned = (data ?? []).map((d) => ({ bucket: d.bucket, count: d.count }))
  const total = cleaned.reduce((acc, d) => acc + d.count, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Round-1 gap distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            title="No round-1 data yet"
            description="Bucket distribution shows the typical opening ask vs loadboard rate."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaned} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
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
                <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
