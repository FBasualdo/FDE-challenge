'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'

interface Datum {
  name: string
  value: number
}

interface Props {
  data?: Datum[]
}

function colorFor(name: string): string {
  const v = name.toLowerCase()
  if (v.includes('positive')) return 'var(--chart-1)'
  if (v.includes('negative')) return 'var(--chart-5)'
  return 'var(--chart-4)'
}

export function SentimentBars({ data }: Props) {
  const cleaned = (data ?? []).filter((d) => d.value > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        {cleaned.length === 0 ? (
          <EmptyState title="No sentiment data" className="border-0 bg-transparent py-6" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cleaned} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {cleaned.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
