import { redirect } from 'next/navigation'

export default function DashboardIndexPage(): never {
  // Analytics Overview is the highest-density view; landing here gives a
  // reviewer the headline KPIs immediately. Operational entry points
  // (Agents, Transcripts) are one click away in the sidebar.
  redirect('/metrics')
}
