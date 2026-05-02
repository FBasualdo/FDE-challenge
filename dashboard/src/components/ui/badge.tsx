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
        primary: 'bg-primary/15 text-primary ring-primary/30',
        success: 'bg-primary/15 text-primary ring-primary/30',
        warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
        destructive: 'bg-destructive/15 text-destructive ring-destructive/30',
        muted: 'bg-muted text-muted-foreground ring-border',
        accent: 'bg-accent/15 text-accent ring-accent/30',
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
