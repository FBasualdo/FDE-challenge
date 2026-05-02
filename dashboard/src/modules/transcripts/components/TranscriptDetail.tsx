'use client'

import useSWR from 'swr'
import { Wrench } from 'lucide-react'
import { swrFetcher } from '@/lib/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/core/ui-extras/ErrorState'
import { EmptyState } from '@/core/ui-extras/EmptyState'
import { CarrierPanel } from './CarrierPanel'
import { LoadPanel } from './LoadPanel'
import { NegotiationPanel } from './NegotiationPanel'
import { AnalysisPanel } from './AnalysisPanel'
import { ChatLog } from './ChatLog'
import { ToolInvocationCard } from './ToolInvocationCard'
import type { CallDetail, TranscriptMessage } from '@/lib/types'

interface Props {
  callId: string
}

function parseTranscript(raw: string | null | undefined): TranscriptMessage[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TranscriptMessage[]) : []
  } catch {
    return []
  }
}

export function TranscriptDetail({ callId }: Props) {
  const { data, error, isLoading, mutate } = useSWR<CallDetail>(`/calls/${callId}`, swrFetcher)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Could not load call" error={error} onRetry={() => void mutate()} />
  }

  if (!data) return null

  const tools = data.tool_invocations ?? []

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="tools">
          Tools
          {tools.length > 0 && (
            <span className="ml-1.5 rounded-sm bg-muted px-1 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
              {tools.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="transcript">Transcript</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CarrierPanel call={data} />
          <LoadPanel call={data} />
          <NegotiationPanel call={data} />
        </div>
      </TabsContent>

      <TabsContent value="tools" className="mt-4">
        {tools.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No tool invocations"
            description="The agent didn't invoke any backend tools during this call."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {tools.map((t, i) => (
              <ToolInvocationCard key={`${t.name}-${i}`} invocation={t} index={i} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="transcript" className="mt-4">
        <ChatLog messages={parseTranscript(data.transcript)} />
      </TabsContent>

      <TabsContent value="analysis" className="mt-4">
        <AnalysisPanel call={data} />
      </TabsContent>
    </Tabs>
  )
}
