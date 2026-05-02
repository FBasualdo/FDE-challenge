'use client'

import { use } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/api'
import { PageHeader } from '@/core/layout/PageHeader'
import { AgentKpiRow } from '@/modules/agents/components/AgentKpiRow'
import { TranscriptsTable } from '@/modules/transcripts/components/TranscriptsTable'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import type { AgentsResponse } from '@/lib/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function AgentDetailPage({ params }: PageProps) {
  const { slug } = use(params)
  const { data, error } = useSWR<AgentsResponse>('/agents', swrFetcher)
  const agent = data?.agents?.find((a) => a.slug === slug)

  return (
    <>
      <PageHeader
        title={agent?.name ?? slug}
        description={agent?.description ?? undefined}
        breadcrumbs={[{ label: 'Agents', href: '/agents' }, { label: agent?.name ?? slug }]}
        actions={
          agent ? (
            <Badge variant={agent.is_active ? 'success' : 'muted'}>
              <span
                className={`size-1.5 rounded-full ${agent.is_active ? 'bg-[var(--status-positive)]' : 'bg-muted-foreground'}`}
                aria-hidden
              />
              {agent.is_active ? 'Active' : 'Inactive'}
            </Badge>
          ) : null
        }
      />

      {error && <ErrorState title="Could not load agent" error={error} />}

      {!data && !error && <Skeleton className="h-24 w-full" />}

      {data && (
        <div className="flex flex-col gap-6">
          <AgentKpiRow agentSlug={slug} />
          <TranscriptsTable agentId={slug} showAgentColumn={false} />
        </div>
      )}
    </>
  )
}
