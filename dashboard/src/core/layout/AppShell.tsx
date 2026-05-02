'use client'

import { Sidebar, useSidebarCollapsed } from './Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="flex-1 min-w-0 px-6 py-6">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </div>
  )
}
