import { AppShell } from '@/core/layout/AppShell'
import { AuthProvider } from '@/core/auth/AuthProvider'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
