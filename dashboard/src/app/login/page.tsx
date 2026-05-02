'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch, ApiError } from '@/lib/api'
import type { LoginResponse } from '@/lib/types'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/agents'

  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        json: { password },
      })
      router.replace(next.startsWith('/') ? next : '/agents')
      router.refresh()
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'Invalid passcode.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Login failed. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm" size="default">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Image
            src="/happyrobot.png"
            alt="HappyRobot"
            width={32}
            height={32}
            className="size-8 rounded-md ring-1 ring-[var(--status-positive)]/40"
            priority
          />
          <CardTitle>HappyRobot Dashboard</CardTitle>
        </div>
        <CardDescription>Enter the passcode to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Passcode</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting || !password} size="lg">
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
