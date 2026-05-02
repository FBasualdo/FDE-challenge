import Link from 'next/link'
import { ArrowRight, Bot } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Agent } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  agent: Agent
}

export function AgentCard({ agent }: Props) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group block focus-visible:outline-none"
      aria-label={`View calls for ${agent.name}`}
    >
      <Card className="transition-colors group-hover:ring-foreground/20 group-focus-visible:ring-2 group-focus-visible:ring-ring/60 h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CardTitle className="truncate">{agent.name}</CardTitle>
              <Badge variant={agent.is_active ? 'success' : 'muted'} className="ml-auto">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    agent.is_active ? 'bg-primary' : 'bg-muted-foreground',
                  )}
                  aria-hidden
                />
                {agent.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          {agent.description && (
            <CardDescription className="mt-1 line-clamp-2">{agent.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
            View calls
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
