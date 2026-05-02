import * as React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center',
        className,
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden />
      <h3 className="m-0 text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="m-0 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
