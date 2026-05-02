import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Props {
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  totalShown: number
  total?: number | null
}

export function Pagination({ hasMore, loadingMore, onLoadMore, totalShown, total }: Props) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        Showing {totalShown}
        {typeof total === 'number' ? ` of ${total}` : ''}
      </span>
      {hasMore && (
        <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? (
            <>
              <Loader2 className="animate-spin" />
              Loading
            </>
          ) : (
            'Load more'
          )}
        </Button>
      )}
    </div>
  )
}
