'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageHeader } from '@/core/layout/PageHeader'
import { DOCS_MARKDOWN } from './content'

/**
 * In-app documentation viewer. Renders a single markdown document
 * defined in `./content.ts` so the reviewer can read about the
 * solution without leaving the dashboard.
 */
export function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="System overview, architecture, deploy notes, and how to use the dashboard."
      />
      <article className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Tighten visual rhythm and use the design tokens so the doc
            // matches the rest of the app in both light and dark themes.
            h1: ({ children }) => (
              <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight text-foreground">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-3 mt-8 border-b border-border pb-2 text-xl font-semibold text-foreground">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 mt-5 text-base font-semibold text-foreground">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="my-3 text-sm leading-relaxed text-foreground">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="my-3 ml-5 list-disc space-y-1 text-sm text-foreground">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 ml-5 list-decimal space-y-1 text-sm text-foreground">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            a: ({ children, href }) => (
              <a
                href={href}
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--status-positive)]"
              >
                {children}
              </a>
            ),
            code: ({ children, className }) => {
              const isBlock = (className ?? '').includes('language-')
              if (isBlock) {
                return (
                  <code className={`${className} font-mono text-[12px] leading-relaxed`}>
                    {children}
                  </code>
                )
              }
              return (
                <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">
                  {children}
                </code>
              )
            },
            pre: ({ children }) => (
              <pre className="my-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-3 border-l-2 border-[var(--status-positive)] bg-muted/30 px-3 py-2 text-sm text-foreground">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
            tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
            th: ({ children }) => (
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 align-top text-foreground">{children}</td>
            ),
            hr: () => <hr className="my-6 border-border" />,
          }}
        >
          {DOCS_MARKDOWN}
        </ReactMarkdown>
      </article>
    </>
  )
}
