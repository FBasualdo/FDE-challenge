'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate as globalMutate } from 'swr'
import { apiFetch, swrFetcher } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
  refresh: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ME_KEY = '/auth/me'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<User>(ME_KEY, swrFetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  })

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Best effort — even if the call fails we still want to clear state.
    }
    await globalMutate(() => true, undefined, { revalidate: false })
    router.push('/login')
  }, [router])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
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
