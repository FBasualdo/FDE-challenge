'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/core/theme/ThemeToggle'
import { cn } from '@/lib/utils'

const NAV: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Overview' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight text-foreground"
          >
            carrier-sales
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
