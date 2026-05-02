'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts'
import { Phone, MessageSquare, CheckCircle2, Percent, Smile, ShieldCheck } from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { OutcomeBadge } from '@/core/ui-extras/OutcomeBadge'
import { SentimentBadge } from '@/core/ui-extras/SentimentBadge'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { DurationCell } from '@/core/ui-extras/DurationCell'
import { formatDateTime, formatNumber, formatPercent, formatRelative } from '@/lib/format'
import type { CarrierDetail, CarrierFlag } from '@/lib/types'
import { KpiCard } from '../KpiCard'
import { CarrierFlagBadge } from './CarrierFlagBadge'

interface Props {
  mc: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SENTIMENT_VALUE: Record<string, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
  P: 1,
  N: 0,
  X: -1,
}

/**
 * Right-anchored Sheet showing the per-MC drill-in. Pulls /metrics/carriers/{mc}
 * lazily once it's open. Includes the recent-calls list (last 10), the
 * sentiment timeline, and the verifications history.
 */
export function CarrierDetailDrawer({ mc, open, onOpenChange }: Props) {
  const shouldFetch = open && Boolean(mc)
  const { data, error, isLoading, mutate } = useSWR<CarrierDetail>(
    shouldFetch && mc ? `/metrics/carriers/${encodeURIComponent(mc)}` : null,
    swrFetcher,
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {data?.carrier_name ?? (mc ? `Carrier MC ${mc}` : 'Carrier')}
          </SheetTitle>
          <SheetDescription>
            {mc && <span className="font-mono">MC {mc}</span>}
            {data?.flags && data.flags.length > 0 && (
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                {data.flags.map((f) => (
                  <CarrierFlagBadge key={f} flag={f as CarrierFlag} />
                ))}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {error && (
            <ErrorState
              title="Could not load carrier detail"
              error={error}
              onRetry={() => void mutate()}
            />
          )}

          {isLoading && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          )}

          {!isLoading && !error && data && (
            <div className="flex flex-col gap-6">
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard icon={Phone} label="Total calls" value={formatNumber(data.total_calls)} />
                <KpiCard
                  icon={MessageSquare}
                  label="Conversational"
                  value={formatNumber(data.conversational_calls)}
                  hint="Reached pitch"
                />
                <KpiCard
                  icon={CheckCircle2}
                  label="Booked"
                  value={formatNumber(data.booked)}
                  tone="positive"
                />
                <KpiCard
                  icon={Percent}
                  label="Booking rate"
                  value={formatPercent(data.booking_rate)}
                  tone="positive"
                />
              </div>

              {/* Sentiment timeline */}
              <SentimentTimeline timeline={data.sentiment_timeline} />

              {/* Recent calls */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Smile className="size-4 text-muted-foreground" aria-hidden />
                  <h3 className="m-0 text-sm font-semibold">Recent calls</h3>
                  <Badge variant="muted">{data.recent_calls.length}</Badge>
                </div>
                {data.recent_calls.length === 0 ? (
                  <EmptyState
                    title="No calls"
                    description="No conversational calls on record yet."
                    className="py-6"
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.recent_calls.map((call) => (
                      <li
                        key={call.call_id}
                        className="flex flex-col gap-1.5 rounded-md border border-border bg-card/40 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={`/transcripts/${call.call_id}`}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
                          >
                            {formatDateTime(call.started_at)}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <OutcomeBadge outcome={call.outcome} />
                            <SentimentBadge sentiment={call.sentiment} />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <LaneCell origin={call.origin} destination={call.destination} />
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              LB <MoneyCell value={call.loadboard_rate} tone="muted" />
                            </span>
                            <span>
                              Final{' '}
                              <MoneyCell
                                value={call.final_agreed_rate}
                                tone={call.outcome === 'Booked' ? 'positive' : 'default'}
                              />
                            </span>
                            <DurationCell seconds={call.duration_seconds} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Verifications */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                  <h3 className="m-0 text-sm font-semibold">FMCSA verifications</h3>
                  <Badge variant="muted">{data.verifications.length}</Badge>
                </div>
                {data.verifications.length === 0 ? (
                  <EmptyState
                    title="No verifications on record"
                    className="py-6"
                  />
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {data.verifications.slice(0, 5).map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={v.eligible ? 'success' : 'destructive'}>
                            {v.eligible ? 'Eligible' : 'Not eligible'}
                          </Badge>
                          {v.status && <span className="text-muted-foreground">{v.status}</span>}
                          {v.reason && (
                            <span className="text-muted-foreground italic">{v.reason}</span>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {formatRelative(v.checked_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

interface TimelineProps {
  timeline: { at: string; sentiment: string }[]
}

function SentimentTimeline({ timeline }: TimelineProps) {
  const points = timeline.map((p, i) => ({
    i,
    at: p.at,
    v: SENTIMENT_VALUE[p.sentiment] ?? SENTIMENT_VALUE[p.sentiment?.toLowerCase()] ?? 0,
  }))
  if (points.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3">
      <h3 className="m-0 text-sm font-semibold">Sentiment timeline</h3>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={[-1.1, 1.1]} />
            <ReTooltip
              cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--popover-foreground)',
              }}
              formatter={(value) => {
                const n = typeof value === 'number' ? value : Number(value)
                if (n === 1) return 'Positive'
                if (n === -1) return 'Negative'
                return 'Neutral'
              }}
              labelFormatter={(_, payload) => {
                const first = payload?.[0]?.payload as { at?: string } | undefined
                const at = first?.at
                return at ? formatDateTime(at) : ''
              }}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke="var(--status-positive)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--status-positive)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
