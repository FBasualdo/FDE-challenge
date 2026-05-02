'use client'

import { useState } from 'react'
import { ExportButton } from '@/core/ui-extras/ExportButton'
import { LoadFilters } from './components/LoadFilters'
import { LoadsTable } from './components/LoadsTable'
import { useLoadFilters, loadFiltersToSearchString } from './hooks/useLoadFilters'

export function LoadsPage() {
  const { filters } = useLoadFilters()
  const [itemCount, setItemCount] = useState(0)
  const queryString = loadFiltersToSearchString(filters)

  return (
    <div className="flex flex-col gap-3">
      <LoadFilters
        rightSlot={
          <ExportButton
            endpoint="/loads/catalog/export.xlsx"
            query={queryString}
            disabled={itemCount === 0}
          />
        }
      />
      <LoadsTable onItemsChange={setItemCount} />
    </div>
  )
}
