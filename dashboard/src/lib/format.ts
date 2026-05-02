/**
 * Money/date/duration helpers — small, dependency-light wrappers around
 * Intl + date-fns so call sites stay terse.
 */
import { format as formatDateFns, formatDistanceToNowStrict, parseISO } from 'date-fns'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const USD_PRECISE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function formatMoney(value: number | string | null | undefined, opts: { precise?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return (opts.precise ? USD_PRECISE : USD).format(n)
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  // Backend ratios (booking_rate, eligibility_rate, margin) come as 0..1
  // decimals — multiply here so callers don't have to remember.
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  try {
    const d = parseISO(value)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

export function formatDate(value: string | Date | null | undefined, pattern = 'MMM d, yyyy'): string {
  const d = toDate(value)
  if (!d) return '—'
  return formatDateFns(d, pattern)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return formatDateFns(d, 'MMM d, yyyy · HH:mm')
}

export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${formatDistanceToNowStrict(d, { addSuffix: true })}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

/** Returns YYYY-MM-DD for an ISO/Date value, suitable for <input type="date">. */
export function toDateInput(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return formatDateFns(d, 'yyyy-MM-dd')
}
