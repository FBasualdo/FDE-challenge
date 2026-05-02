'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { formatDate } from '@/lib/format'

interface Datum {
  date: string
  count: number
  booked: number
}

interface Props {
  data?: Datum[]
}

/**
 * Last 7 days, two grouped bars per day: total calls + booked. Replaces
 * the 14-day line chart, which went flat at POC volume and conflated the
 * total-vs-booked relationship in two overlapping lines.
 */
export function CallsByDayBar({ data }: Props) {
  const cleaned = (data ?? []).slice(-7).map((d) => ({
    ...d,
    label: formatDate(d.date, 'EEE d'),
    others: Math.max(0, d.count - d.booked),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls — last 7 days</CardTitle>
      </CardHeader>
      <CardContent>
        {cleaned.length === 0 ? (
          <EmptyState title="No daily activity yet" className="border-0 bg-transparent py-6" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaned} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
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
                  formatter={(value, name) => {
                    if (name === 'others') return [value, 'Other outcomes']
                    if (name === 'booked') return [value, 'Booked']
                    return [value, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                  formatter={(v) => (v === 'others' ? 'Other outcomes' : 'Booked')}
                />
                <Bar
                  dataKey="booked"
                  stackId="a"
                  fill="var(--status-positive)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="others"
                  stackId="a"
                  fill="var(--muted)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
