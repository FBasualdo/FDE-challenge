'use client'

import { Route } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { formatNumber, formatPercent } from '@/lib/format'
import type { LaneStats } from '@/lib/types'
import { LaneTrendChip } from './LaneTrendChip'
import { LaneEquipmentMixCell } from './LaneEquipmentMixCell'

interface Props {
  items: LaneStats[]
  isLoading: boolean
}

function delta(current: number, prev: number): { sign: '+' | '−' | ''; pct: number } {
  if (prev === 0) {
    if (current === 0) return { sign: '', pct: 0 }
    return { sign: '+', pct: Infinity }
  }
  const change = ((current - prev) / prev) * 100
  if (Math.abs(change) < 0.5) return { sign: '', pct: 0 }
  return { sign: change > 0 ? '+' : '−', pct: Math.abs(change) }
}

export function LaneTable({ items, isLoading }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lane</TableHead>
          <TableHead className="text-right">Calls</TableHead>
          <TableHead className="text-right">Booked</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Avg LB</TableHead>
          <TableHead className="text-right">Avg agreed</TableHead>
          <TableHead className="text-right">Margin</TableHead>
          <TableHead>Equipment</TableHead>
          <TableHead>Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={`s-${i}`}>
              {Array.from({ length: 9 }).map((__, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}

        {!isLoading &&
          items.map((lane) => {
            const d = delta(lane.calls, lane.calls_prev_window)
            const deltaTone =
              d.sign === '+'
                ? 'text-[var(--status-positive)]'
                : d.sign === '−'
                  ? 'text-[var(--status-negative)]'
                  : 'text-muted-foreground'
            return (
              <TableRow key={`${lane.origin}__${lane.destination}`}>
                <TableCell>
                  <LaneCell origin={lane.origin} destination={lane.destination} />
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  <div className="flex flex-col items-end leading-tight">
                    <span>{formatNumber(lane.calls)}</span>
                    {d.sign && (
                      <span className={`text-[11px] ${deltaTone}`}>
                        {d.sign}
                        {Number.isFinite(d.pct) ? `${d.pct.toFixed(0)}%` : '∞'} vs prev
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatNumber(lane.booked)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatPercent(lane.booking_rate)}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyCell value={lane.avg_loadboard_rate} tone="muted" />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyCell value={lane.avg_agreed_rate} />
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {lane.avg_margin_vs_lb_pct === null || lane.avg_margin_vs_lb_pct === undefined ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={
                        lane.avg_margin_vs_lb_pct < 0
                          ? 'text-[var(--status-negative)]'
                          : lane.avg_margin_vs_lb_pct > 0
                            ? 'text-[var(--status-positive)]'
                            : ''
                      }
                    >
                      {formatPercent(lane.avg_margin_vs_lb_pct, 1)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <LaneEquipmentMixCell mix={lane.equipment_mix ?? {}} />
                </TableCell>
                <TableCell>
                  <LaneTrendChip trend={lane.trend} />
                </TableCell>
              </TableRow>
            )
          })}

        {!isLoading && items.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="px-0 py-0">
              <EmptyState
                icon={Route}
                title="No lanes match these filters"
                description="Widen the time window or lower the minimum-calls threshold."
                className="border-0 bg-transparent"
              />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
