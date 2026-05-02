'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { CarriersPage } from '@/modules/metrics/components/carriers/CarriersPage'

export default function Carriers() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CarriersPage />
    </Suspense>
  )
}
