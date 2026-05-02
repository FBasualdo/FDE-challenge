'use client'

import { Suspense } from 'react'
import { PageHeader } from '@/core/layout/PageHeader'
import { TranscriptsTable } from '@/modules/transcripts/components/TranscriptsTable'
import { TranscriptsKpiRow } from '@/modules/transcripts/components/TranscriptsKpiRow'
import { Skeleton } from '@/components/ui/skeleton'

export default function TranscriptsPage() {
  return (
    <>
      <PageHeader
        title="Transcripts"
        description="All inbound carrier calls across every agent."
      />
      <div className="flex flex-col gap-6">
        <TranscriptsKpiRow />
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <TranscriptsTable />
        </Suspense>
      </div>
    </>
  )
}
