'use client'

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR, { mutate as globalMutate } from 'swr'
import { ApiError, apiFetch, swrFetcher } from '@/lib/api'
import { clearToken } from '@/core/auth/tokenStore'
import type { AuthSession } from '@/lib/types'

interface AuthContextValue {
  authenticated: boolean
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
  refresh: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ME_KEY = '/auth/me'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data, error, isLoading, mutate } = useSWR<AuthSession>(ME_KEY, swrFetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })

  // Client-side guard. We can't enforce auth in middleware because the
  // session cookie lives on the API origin (e.g. api.example.com), not on
  // the dashboard origin (dashboard.example.com), so middleware running on
  // the dashboard host can never read it. Instead we ping /auth/me on
  // mount: a 401 (or a confirmed `authenticated: false`) bounces to
  // /login, preserving the intended destination via ?next=.
  useEffect(() => {
    if (isLoading) return
    const unauthenticated =
      (error instanceof ApiError && error.status === 401) ||
      (data && !data.authenticated)
    if (unauthenticated) {
      // Drop any stale token so the next /auth/me retry isn't poisoned.
      clearToken()
      const next = pathname && pathname !== '/login' ? pathname : '/metrics'
      router.replace(`/login?next=${encodeURIComponent(next)}`)
    }
  }, [data, error, isLoading, pathname, router])

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Best effort — even if the call fails we still want to clear state.
    }
    clearToken()
    await globalMutate(() => true, undefined, { revalidate: false })
    router.push('/login')
  }, [router])

  const value = useMemo<AuthContextValue>(
    () => ({
      authenticated: Boolean(data?.authenticated),
      isLoading,
      error: (error as Error) ?? null,
      signOut,
      refresh: mutate,
    }),
    [data, isLoading, error, signOut, mutate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
