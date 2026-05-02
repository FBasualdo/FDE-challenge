'use client'

import { Suspense } from 'react'
import { PageHeader } from '@/core/layout/PageHeader'
import { TranscriptsTable } from '@/modules/transcripts/components/TranscriptsTable'
import { Skeleton } from '@/components/ui/skeleton'

export default function TranscriptsPage() {
  return (
    <>
      <PageHeader
        title="Transcripts"
        description="All inbound carrier calls across every agent."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TranscriptsTable />
      </Suspense>
    </>
  )
}
