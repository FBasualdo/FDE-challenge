'use client'

import { Suspense } from 'react'
import { PageHeader } from '@/core/layout/PageHeader'
import { LoadsPage } from '@/modules/loads/LoadsPage'
import { Skeleton } from '@/components/ui/skeleton'

export default function LoadsRoute() {
  return (
    <>
      <PageHeader
        title="Loads"
        description="The catalog the inbound voice agent pitches against."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LoadsPage />
      </Suspense>
    </>
  )
}
