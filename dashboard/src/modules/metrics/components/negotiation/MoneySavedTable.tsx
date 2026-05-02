'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { formatNumber } from '@/lib/format'
import type { NegotiationStats } from '@/lib/types'

interface Props {
  data: NegotiationStats['money_left_on_table']
}

/**
 * Money-saved breakout — total / avg / p50 / p90 / count of qualifying calls.
 * Only counts calls where `carrier_quoted > loadboard` (per the metric plan).
 */
export function MoneySavedTable({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Negotiated savings — breakout</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                Total saved
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell value={data.total} tone="positive" precise />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                Avg per booked call
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell value={data.avg_per_booked_call} precise />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                Median (p50)
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell value={data.p50} precise />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                P90
              </TableCell>
              <TableCell className="text-right">
                <MoneyCell value={data.p90} precise />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                Qualifying calls
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {formatNumber(data.savings_count)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
