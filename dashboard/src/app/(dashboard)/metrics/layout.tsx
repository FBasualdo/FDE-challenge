import { AnalyticsTabs } from '@/modules/metrics/components/AnalyticsTabs'

/**
 * Wraps every /metrics route (Overview, Carriers, Lanes, Negotiation) with
 * the inline tab strip so users can scan all four sub-views without retreating
 * to the sidebar.
 */
export default function MetricsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsTabs />
      {children}
    </>
  )
}
