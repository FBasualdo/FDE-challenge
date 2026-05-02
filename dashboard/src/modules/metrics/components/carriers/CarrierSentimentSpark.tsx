'use client'

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

interface Props {
  /** Oldest-first letters — "P" / "N" / "X". */
  trend: string[]
}

const VALUE: Record<string, number> = {
  P: 1,
  N: 0,
  X: -1,
}

/**
 * 24px-tall sentiment sparkline for the leaderboard. Decoration only — no
 * axes, no tooltip; the trend at-a-glance is the entire point.
 */
export function CarrierSentimentSpark({ trend }: Props) {
  const points = trend
    .map((s) => VALUE[s.toUpperCase()])
    .filter((v): v is number => Number.isFinite(v))
  if (points.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const data = points.map((v, i) => ({ i, v }))
  return (
    <div className="h-6 w-20" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={[-1.1, 1.1]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--status-positive)"
            strokeWidth={1.5}
            dot={{ r: 1.5, fill: 'var(--status-positive)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
