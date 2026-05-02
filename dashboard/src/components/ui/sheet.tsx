'use client'

/**
 * Sheet — a side-anchored dialog ("drawer") built on top of @radix-ui/react-dialog.
 * Used by the analytics CarrierDetailDrawer for per-MC drill-in. Anchored to the
 * right edge by default; supports left/top/bottom for future use.
 */

import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Side = 'right' | 'left' | 'top' | 'bottom'

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-background/70 backdrop-blur-sm',
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

const sideClasses: Record<Side, string> = {
  right:
    'inset-y-0 right-0 h-full w-full max-w-2xl border-l data-open:slide-in-from-right data-closed:slide-out-to-right',
  left:
    'inset-y-0 left-0 h-full w-full max-w-2xl border-r data-open:slide-in-from-left data-closed:slide-out-to-left',
  top:
    'inset-x-0 top-0 w-full border-b data-open:slide-in-from-top data-closed:slide-out-to-top',
  bottom:
    'inset-x-0 bottom-0 w-full border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom',
}

interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  side?: Side
  hideClose?: boolean
}

function SheetContent({
  className,
  children,
  side = 'right',
  hideClose,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10 outline-none',
          'transition ease-out data-open:animate-in data-open:duration-200 data-closed:animate-out data-closed:duration-150',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <XIcon className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 border-b border-border px-5 py-4 pr-12', className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('flex-1 overflow-y-auto px-5 py-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('flex items-center justify-end gap-2 border-t border-border px-5 py-3', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-base font-semibold leading-none', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
