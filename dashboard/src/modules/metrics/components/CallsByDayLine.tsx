'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { formatDate } from '@/lib/format'

interface Datum {
  date: string
  count: number
}

interface Props {
  data?: Datum[]
}

export function CallsByDayLine({ data }: Props) {
  // Take the last 14 entries the backend gives us.
  const cleaned = (data ?? []).slice(-14).map((d) => ({
    ...d,
    label: formatDate(d.date, 'MMM d'),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls — last 14 days</CardTitle>
      </CardHeader>
      <CardContent>
        {cleaned.length === 0 ? (
          <EmptyState title="No daily activity yet" className="border-0 bg-transparent py-6" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cleaned} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--popover-foreground)',
                  }}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--chart-1)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
