'use client'

import { use } from 'react'
import { PageHeader } from '@/core/layout/PageHeader'
import { TranscriptDetail } from '@/modules/transcripts/components/TranscriptDetail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TranscriptDetailPage({ params }: PageProps) {
  const { id } = use(params)
  return (
    <>
      <PageHeader
        title="Call detail"
        breadcrumbs={[{ label: 'Transcripts', href: '/transcripts' }, { label: id }]}
      />
      <TranscriptDetail callId={id} />
    </>
  )
}
