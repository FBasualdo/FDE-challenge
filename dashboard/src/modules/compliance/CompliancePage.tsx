'use client'

import { useState } from 'react'
import { ExportButton } from '@/core/ui-extras/ExportButton'
import { VerificationFilters } from './components/VerificationFilters'
import { VerificationsTable } from './components/VerificationsTable'
import {
  useVerificationFilters,
  verificationFiltersToSearchString,
} from './hooks/useVerificationFilters'

export function CompliancePage() {
  const { filters } = useVerificationFilters()
  const [itemCount, setItemCount] = useState(0)
  const queryString = verificationFiltersToSearchString(filters)

  return (
    <div className="flex flex-col gap-3">
      <VerificationFilters
        rightSlot={
          <ExportButton
            endpoint="/verifications/export.xlsx"
            query={queryString}
            disabled={itemCount === 0}
          />
        }
      />
      <VerificationsTable onItemsChange={setItemCount} />
    </div>
  )
}
