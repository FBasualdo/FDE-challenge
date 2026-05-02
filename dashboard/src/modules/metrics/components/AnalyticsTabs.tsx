'use client'

/**
 * Analytics navigation strip — sits at the top of all /metrics routes.
 * Mirrors the sidebar sub-items but lives inline so the user can scan + jump
 * between sub-views without retreating to the sidebar.
 *
 * Implemented as plain `<Link>`s styled like a Tabs strip rather than the
 * Radix Tabs primitive (which assumes single-page state). Active-state lives
 * in the URL.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Route, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/metrics', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/metrics/carriers', label: 'Carriers', icon: Users, exact: false },
  { href: '/metrics/lanes', label: 'Lanes', icon: Route, exact: false },
  { href: '/metrics/negotiation', label: 'Negotiation', icon: Handshake, exact: false },
] as const

export function AnalyticsTabs() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Analytics sections"
      className="-mx-1 mb-4 flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 p-1 ring-1 ring-foreground/5"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-state={active ? 'active' : 'inactive'}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active
                ? 'bg-background text-foreground ring-1 ring-[var(--status-positive)]/40'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
