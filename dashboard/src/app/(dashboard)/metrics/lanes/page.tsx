'use client'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { LanesPage } from '@/modules/metrics/components/lanes/LanesPage'

export default function Lanes() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LanesPage />
    </Suspense>
  )
}
