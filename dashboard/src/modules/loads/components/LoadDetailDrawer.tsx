'use client'

import Link from 'next/link'
import {
  Truck,
  Package,
  Ruler,
  Calendar,
  MapPin,
  FileText,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { LaneCell } from '@/core/ui-extras/LaneCell'
import { MoneyCell } from '@/core/ui-extras/MoneyCell'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { LoadCatalogItem } from '@/lib/types'

interface Props {
  load: LoadCatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FieldProps {
  label: string
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

function Field({ label, children, icon: Icon }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3" aria-hidden />}
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

/**
 * Right-anchored drawer that surfaces every field of a load catalog item —
 * including the pitch_summary (rendered as a quote-block) and the broker notes.
 */
export function LoadDetailDrawer({ load, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {load ? (
              <span className="font-mono">{load.load_id}</span>
            ) : (
              'Load detail'
            )}
          </SheetTitle>
          {load && (
            <SheetDescription>
              <LaneCell origin={load.origin} destination={load.destination} />
            </SheetDescription>
          )}
        </SheetHeader>
        <SheetBody>
          {load && (
            <div className="flex flex-col gap-6">
              {/* Booking panel — surfaced first when this load is already taken. */}
              {(load.is_booked ?? false) && (
                <div className="flex flex-col gap-3 rounded-md border border-[var(--status-positive)]/30 bg-[var(--status-positive)]/10 p-3">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--status-positive)]">
                    <CheckCircle2 className="size-3" aria-hidden /> Booking
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Booked at" icon={Calendar}>
                      <span className="font-mono tabular-nums">
                        {formatDateTime(load.booked_at ?? null)}
                      </span>
                    </Field>
                    <Field label="Booked by" icon={Truck}>
                      {load.booked_by_mc ? (
                        <span className="font-mono">MC {load.booked_by_mc}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Field>
                    <Field label="Agreed rate" icon={Package}>
                      <MoneyCell value={load.booked_agreed_rate ?? null} />
                    </Field>
                  </div>
                  {load.booked_by_call_id && (
                    <Link
                      href={`/transcripts/${load.booked_by_call_id}`}
                      className="inline-flex items-center gap-1 self-start text-xs font-medium text-[var(--status-info)] underline-offset-2 hover:underline"
                    >
                      View call transcript
                      <ExternalLink className="size-3" aria-hidden />
                    </Link>
                  )}
                </div>
              )}

              {/* Headline KPI strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-border bg-card/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Loadboard
                  </div>
                  <div className="mt-1">
                    <MoneyCell value={load.loadboard_rate} className="text-base" />
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Miles
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-base text-foreground">
                    {formatNumber(load.miles)}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Weight
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-base text-foreground">
                    {formatNumber(load.weight)} lbs
                  </div>
                </div>
                <div className="rounded-md border border-border bg-card/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Equipment
                  </div>
                  <div className="mt-1 text-base text-foreground">
                    <Badge variant="muted">{load.equipment_type}</Badge>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Pickup" icon={Calendar}>
                  <span className="font-mono tabular-nums">{formatDateTime(load.pickup_datetime)}</span>
                </Field>
                <Field label="Delivery" icon={Calendar}>
                  <span className="font-mono tabular-nums">{formatDateTime(load.delivery_datetime)}</span>
                </Field>
              </div>

              {/* Stops */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Origin" icon={MapPin}>
                  {load.origin}
                </Field>
                <Field label="Destination" icon={MapPin}>
                  {load.destination}
                </Field>
              </div>

              {/* Cargo specifics */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Commodity" icon={Package}>
                  {load.commodity_type ?? <span className="text-muted-foreground">—</span>}
                </Field>
                <Field label="Pieces" icon={Package}>
                  <span className="font-mono tabular-nums">{formatNumber(load.num_of_pieces)}</span>
                </Field>
                <Field label="Dimensions" icon={Ruler}>
                  {load.dimensions ?? <span className="text-muted-foreground">—</span>}
                </Field>
              </div>

              {/* Pitch summary */}
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Truck className="size-3" aria-hidden /> Pitch summary
                </div>
                <blockquote className="m-0 rounded-md border-l-2 border-[var(--status-positive)] bg-card/40 px-3 py-2 text-sm italic text-foreground">
                  {load.pitch_summary}
                </blockquote>
              </div>

              {/* Notes */}
              {load.notes && (
                <div className="flex flex-col gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <FileText className="size-3" aria-hidden /> Notes
                  </div>
                  <p className="m-0 rounded-md border border-border bg-card/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                    {load.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
