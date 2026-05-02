import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  description?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  className,
}: Props) {
  const detail =
    description ??
    (error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Please try again in a moment.')
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <h3 className="m-0 text-sm font-medium text-foreground">{title}</h3>
      <p className="m-0 max-w-md text-xs text-muted-foreground">{detail}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  )
}
