'use client'

import { Suspense } from 'react'
import { PageHeader } from '@/core/layout/PageHeader'
import { CompliancePage } from '@/modules/compliance/CompliancePage'
import { Skeleton } from '@/components/ui/skeleton'

export default function ComplianceRoute() {
  return (
    <>
      <PageHeader
        title="Compliance"
        description="FMCSA verifications audit log — every MC the agent has checked."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CompliancePage />
      </Suspense>
    </>
  )
}
