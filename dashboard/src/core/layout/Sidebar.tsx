'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  MessageSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Users,
  Route,
  Handshake,
} from 'lucide-react'
import { ThemeToggle } from '@/core/theme/ThemeToggle'
import { useAuth } from '@/core/auth/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'sidebar_collapsed'
const ANALYTICS_OPEN_KEY = 'sidebar_analytics_open'

interface NavLeaf {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  /** Path prefix used to highlight the parent + decide active state. */
  basePath: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: NavLeaf[]
}

type NavItem = NavLeaf | NavGroup

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item
}

const NAV: NavItem[] = [
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/transcripts', label: 'Transcripts', icon: MessageSquare },
  {
    basePath: '/metrics',
    label: 'Analytics',
    icon: BarChart3,
    children: [
      { href: '/metrics', label: 'Overview', icon: LayoutDashboard },
      { href: '/metrics/carriers', label: 'Carriers', icon: Users },
      { href: '/metrics/lanes', label: 'Lanes', icon: Route },
      { href: '/metrics/negotiation', label: 'Negotiation', icon: Handshake },
    ],
  },
]

function isActiveLeaf(pathname: string | null, leaf: NavLeaf): boolean {
  if (!pathname) return false
  // Exact match for the Overview entry so /metrics/carriers doesn't also light up Overview.
  if (leaf.href === '/metrics') return pathname === '/metrics'
  return pathname === leaf.href || pathname.startsWith(`${leaf.href}/`)
}

function isActiveGroup(pathname: string | null, group: NavGroup): boolean {
  if (!pathname) return false
  return pathname === group.basePath || pathname.startsWith(`${group.basePath}/`)
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()

  // Analytics group expand/collapse with localStorage persistence. Auto-opens
  // when navigating into any analytics sub-route so the user never has to
  // re-expand on a refresh.
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsHydrated, setAnalyticsHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(ANALYTICS_OPEN_KEY)
    setAnalyticsOpen(stored === null ? true : stored === '1')
    setAnalyticsHydrated(true)
  }, [])

  useEffect(() => {
    if (pathname?.startsWith('/metrics')) setAnalyticsOpen(true)
  }, [pathname])

  useEffect(() => {
    if (!analyticsHydrated) return
    localStorage.setItem(ANALYTICS_OPEN_KEY, analyticsOpen ? '1' : '0')
  }, [analyticsOpen, analyticsHydrated])

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-card/30 transition-[width] duration-150',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div className={cn('flex h-14 items-center border-b border-border px-3', collapsed && 'justify-center px-0')}>
        <Link href="/agents" className="flex items-center gap-2 overflow-hidden">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-bold ring-1 ring-[var(--status-positive)]/40">
            HR
          </span>
          {!collapsed && (
            <span className="truncate font-mono text-sm font-semibold tracking-tight text-foreground">
              HappyRobot
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            if (!isGroup(item)) {
              const active = isActiveLeaf(pathname, item)
              const link = (
                <Link
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'border-l-[var(--status-positive)] bg-[var(--status-positive)]/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            }

            // Group rendering — Analytics.
            const groupActive = isActiveGroup(pathname, item)
            const Icon = item.icon

            // When collapsed, render the group icon as a link to its overview
            // route and surface the label via tooltip — keeps the bar compact.
            if (collapsed) {
              const overview = item.children[0] ?? { href: item.basePath, label: item.label }
              const link = (
                <Link
                  href={overview.href}
                  className={cn(
                    'group flex items-center justify-center gap-2.5 rounded-md border-l-2 border-transparent px-0 py-1.5 text-sm font-medium transition-colors',
                    groupActive
                      ? 'border-l-[var(--status-positive)] bg-[var(--status-positive)]/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                </Link>
              )
              return (
                <li key={item.basePath}>
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                </li>
              )
            }

            return (
              <li key={item.basePath}>
                <button
                  type="button"
                  onClick={() => setAnalyticsOpen((v) => !v)}
                  aria-expanded={analyticsOpen}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-1.5 text-sm font-medium transition-colors',
                    groupActive
                      ? 'border-l-[var(--status-positive)] bg-[var(--status-positive)]/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform',
                      analyticsOpen ? 'rotate-0' : '-rotate-90',
                    )}
                    aria-hidden
                  />
                </button>
                {analyticsOpen && (
                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
                    {item.children.map((child) => {
                      const childActive = isActiveLeaf(pathname, child)
                      const ChildIcon = child.icon
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors',
                              childActive
                                ? 'bg-[var(--status-positive)]/10 text-foreground'
                                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                            )}
                          >
                            <ChildIcon className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer: collapse + theme + user */}
      <div className={cn('border-t border-border p-2 flex flex-col gap-1', collapsed && 'items-center')}>
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'justify-between gap-1')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                {collapsed ? <ChevronRight /> : <ChevronLeft />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand' : 'Collapse'}</TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors',
                collapsed ? 'w-auto justify-center' : 'w-full',
              )}
              aria-label="User menu"
            >
              <Avatar className="size-7">
                <AvatarFallback>HR</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="truncate text-xs font-medium text-foreground">Signed in</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-48">
            <DropdownMenuLabel className="text-foreground normal-case">Signed in</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} variant="destructive">
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '1') setCollapsed(true)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed, hydrated])

  return { collapsed, toggle: () => setCollapsed((v) => !v) }
}
