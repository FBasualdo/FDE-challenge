import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground ring-border',
        outline: 'bg-transparent text-foreground ring-border',
        primary: 'bg-foreground/10 text-foreground ring-foreground/20',
        success:
          'bg-[var(--status-positive)]/15 text-[var(--status-positive)] ring-[var(--status-positive)]/30',
        warning:
          'bg-[var(--chart-5)]/15 text-[var(--chart-5)] ring-[var(--chart-5)]/30',
        destructive:
          'bg-[var(--status-negative)]/15 text-[var(--status-negative)] ring-[var(--status-negative)]/30',
        muted:
          'bg-[var(--status-neutral)]/15 text-[var(--status-neutral)] ring-[var(--status-neutral)]/30',
        accent:
          'bg-[var(--status-info)]/15 text-[var(--status-info)] ring-[var(--status-info)]/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
