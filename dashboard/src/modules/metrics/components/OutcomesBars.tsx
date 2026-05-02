'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts'
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
  if (v === 'booked') return 'var(--status-positive)'
  if (v === 'not eligible' || v === 'call dropped') return 'var(--status-negative)'
  if (v === 'carrier declined' || v === 'negotiation failed') return 'var(--chart-4)'
  return 'var(--muted-foreground)'
}

/**
 * Horizontal bars sorted desc — replaces the unreadable pie. Six outcome
 * categories on a pie become unreadable slices; a sorted bar list scans
 * left-to-right in the same order people compare numbers.
 */
export function OutcomesBars({ data }: Props) {
  const cleaned = useMemo(
    () =>
      (data ?? [])
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [data],
  )

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
              <BarChart
                data={cleaned}
                layout="vertical"
                margin={{ top: 4, right: 32, bottom: 4, left: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={120}
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
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {cleaned.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.name)} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="var(--muted-foreground)"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
