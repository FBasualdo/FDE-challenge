'use client'

import useSWR from 'swr'
import { Bot } from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { PageHeader } from '@/core/layout/PageHeader'
import { AgentCard } from '@/modules/agents/components/AgentCard'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import type { AgentsResponse } from '@/lib/types'

export default function AgentsPage() {
  const { data, error, isLoading, mutate } = useSWR<AgentsResponse>('/agents', swrFetcher)

  return (
    <>
      <PageHeader
        title="Agents"
        description="Voice agents handling inbound carrier sales calls."
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <ErrorState title="Could not load agents" error={error} onRetry={() => void mutate()} />
      )}

      {!isLoading && !error && (data?.agents?.length ?? 0) === 0 && (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Once an agent is registered on the HappyRobot platform it'll appear here."
        />
      )}

      {!isLoading && !error && data?.agents && data.agents.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((agent) => (
            <AgentCard key={agent.slug} agent={agent} />
          ))}
        </div>
      )}
    </>
  )
}
