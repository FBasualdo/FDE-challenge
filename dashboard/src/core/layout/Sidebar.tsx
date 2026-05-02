'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, MessageSquare, BarChart3, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
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

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/transcripts', label: 'Transcripts', icon: MessageSquare },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const initial = (user?.email ?? '').trim().charAt(0).toUpperCase() || 'U'

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
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-sm font-bold">
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
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            const link = (
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-l-primary bg-primary/15 text-primary'
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
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">
                    {user?.full_name || user?.email || '—'}
                  </span>
                  {user?.full_name && (
                    <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
                  )}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-48">
            <DropdownMenuLabel className="text-foreground normal-case">
              {user?.email ?? 'Signed in'}
            </DropdownMenuLabel>
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
