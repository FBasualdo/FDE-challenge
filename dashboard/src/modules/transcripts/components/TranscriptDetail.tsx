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
        <TabsTrigger value="overview">
          Overview
          {tools.length > 0 && (
            <span className="ml-1.5 rounded-sm bg-muted px-1 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
              {tools.length} tool{tools.length === 1 ? '' : 's'}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="transcript">Transcript</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <div className="flex flex-col gap-6">
          {/* Top row: carrier, load, negotiation snapshots. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <CarrierPanel call={data} />
            <LoadPanel call={data} />
            <NegotiationPanel call={data} />
          </div>

          {/* Two-column block: tool invocations on the left, post-call analysis on the right. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Wrench className="size-4" aria-hidden />
                Tool invocations
                {tools.length > 0 && (
                  <span className="font-mono text-[11px] tabular-nums">({tools.length})</span>
                )}
              </h3>
              {tools.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="No tool invocations"
                  description="The agent didn't invoke any backend tools during this call."
                  className="py-6"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {tools.map((t, i) => (
                    <ToolInvocationCard key={`${t.name}-${i}`} invocation={t} index={i} />
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Post-call analysis
              </h3>
              <AnalysisPanel call={data} />
            </section>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="transcript" className="mt-4">
        <ChatLog messages={parseTranscript(data.transcript)} />
      </TabsContent>
    </Tabs>
  )
}
