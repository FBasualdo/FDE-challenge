'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/core/ui-extras/EmptyState'

interface Datum {
  name: string
  value: number
}

interface Props {
  data?: Datum[]
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function OutcomesPie({ data }: Props) {
  const cleaned = useMemo(() => (data ?? []).filter((d) => d.value > 0), [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outcomes</CardTitle>
      </CardHeader>
      <CardContent>
        {cleaned.length === 0 ? (
          <EmptyState title="No outcome data" className="border-0 bg-transparent py-6" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cleaned} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {cleaned.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--background)" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--popover-foreground)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
