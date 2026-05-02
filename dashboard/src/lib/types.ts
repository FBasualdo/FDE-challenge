/**
 * API response types — mirror the FastAPI backend's Pydantic schemas exactly.
 * If you add a field on the backend, add it here too.
 */

export interface AuthSession {
  authenticated: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface Agent {
  slug: string
  name: string
  description?: string | null
  is_active: boolean
}

export interface AgentsResponse {
  agents: Agent[]
}

export type CallOutcome =
  | 'Booked'
  | 'Negotiation Failed'
  | 'Not Eligible'
  | 'No Match Found'
  | 'Carrier Declined'
  | 'Call Dropped'
  | string

export type CallSentiment = 'Positive' | 'Neutral' | 'Negative' | string

// GET /calls — items in the list response.
export interface CallListItem {
  call_id: string
  agent_id: string
  agent_name?: string | null
  started_at: string
  duration_seconds: number
  outcome: CallOutcome
  sentiment: CallSentiment
  carrier_name?: string | null
  mc_number?: string | null
  load_id?: string | null
  origin?: string | null
  destination?: string | null
  loadboard_rate?: number | null
  final_agreed_rate?: number | null
  num_negotiation_rounds?: number | null
  transcript_preview?: string | null
}

export interface CallsResponse {
  items: CallListItem[]
  next_cursor?: string | null
  total: number
}

// GET /calls/{call_id} — backend `NegotiationRoundSummary`.
export interface NegotiationRound {
  round: number
  carrier_offer: number
  action: 'accept' | 'counter' | 'reject' | string
  broker_price?: number | null
  decided_at: string
}

// backend `VerificationSummary`.
export interface Verification {
  id: number
  mc_number: string
  eligible: boolean
  carrier_name?: string | null
  dot_number?: string | null
  status?: string | null
  reason?: string | null
  checked_at: string
}

// backend `ToolInvocation` (parsed from the transcript on the fly).
export interface ToolInvocation {
  name: string
  args: Record<string, unknown>
  result?: Record<string, unknown> | unknown[] | string | null
  ts?: number | null
}

// One message inside the parsed transcript JSON.
export interface TranscriptMessage {
  id?: string | null
  role: 'system' | 'user' | 'assistant' | 'tool' | string
  content?: string | null
  name?: string | null
  tool_calls?: Array<{
    id?: string
    type?: string
    function?: { name?: string; arguments?: string }
  }>
  tool_call_id?: string
  start?: number | null
  end?: number | null
}

// GET /calls/{call_id}.
export interface CallDetail {
  call_id: string
  agent_id: string
  started_at: string
  ended_at: string
  duration_seconds: number
  outcome: CallOutcome
  sentiment: CallSentiment
  carrier?: Record<string, unknown> | null
  load?: Record<string, unknown> | null
  negotiation?: Record<string, unknown> | null
  analysis?: Record<string, unknown> | null
  transcript?: string | null  // JSON-encoded string of TranscriptMessage[]
  recording_url?: string | null
  created_at: string
  updated_at: string
  negotiation_rounds: NegotiationRound[]
  verifications: Verification[]
  tool_invocations: ToolInvocation[]
}

// GET /metrics/summary — mirror of MetricsSummaryResponse.
export interface MetricsSummary {
  totals: {
    total_calls: number
    booked_calls: number
    booking_rate: number
    total_revenue_negotiated: number
  }
  negotiation: {
    avg_rounds_to_close: number | null
    avg_margin_vs_loadboard: number | null
    deals_closed_at_or_below_loadboard: number
    deals_closed_above_loadboard: number
  }
  quality: {
    sentiment_distribution: Record<string, number>
    avg_call_duration_seconds: number | null
    carrier_eligibility_rate: number | null
  }
  outcomes_distribution: Record<string, number>
  calls_by_day: Array<{ date: string; count: number; booked: number }>

  // Analytics v2 extensions — see metrics plan §"Existing /metrics/summary extensions".
  round_one_close_rate?: number | null
  fmcsa_killed_rate?: number | null
  repeat_funnel?: {
    once: number
    two_to_three: number
    four_plus: number
  }
  top_carriers?: Array<{
    mc_number: string
    carrier_name: string | null
    calls: number
    bookings: number
    booking_rate: number | null
    total_revenue: number
  }>
}

// ---------------------------------------------------------------------------
// Analytics v2 — carrier / lane / negotiation
// ---------------------------------------------------------------------------

export type CarrierFlag = 'tire_kicker' | 'hostage' | 'top_repeat' | 'repeat_ineligible'

export interface CarrierStats {
  mc_number: string
  carrier_name?: string | null
  calls: number
  conversational_calls: number
  booked: number
  booking_rate: number
  avg_sentiment_score: number
  /** Last ≤5 sentiments, oldest first. "P"=positive, "N"=neutral, "X"=negative. */
  sentiment_trend: string[]
  avg_quote_premium_pct?: number | null
  premium_share_pct?: number | null
  drop_rate: number
  last_called_at: string
  flags: CarrierFlag[]
}

export interface CarriersResponse {
  items: CarrierStats[]
  next_cursor?: string | null
  total: number
}

export interface CarrierDetail {
  mc_number: string
  carrier_name?: string | null
  total_calls: number
  conversational_calls: number
  booked: number
  booking_rate: number
  flags: CarrierFlag[]
  recent_calls: CallListItem[]
  sentiment_timeline: { at: string; sentiment: string }[]
  verifications: Verification[]
}

export interface LaneStats {
  origin: string
  destination: string
  calls: number
  booked: number
  booking_rate: number
  avg_loadboard_rate?: number | null
  avg_agreed_rate?: number | null
  avg_margin_vs_lb_pct?: number | null
  equipment_mix: Record<string, number>
  calls_prev_window: number
  trend: 'heating' | 'cooling' | 'flat'
}

export interface LanesResponse {
  items: LaneStats[]
}

export interface NegotiationStats {
  acceptance_by_round: { round: number; accepts: number; counters: number; rejects: number }[]
  round_one_close_rate?: number | null
  final_offer_success_rate?: number | null
  gap_histogram_round1: { bucket: string; count: number }[]
  money_left_on_table: {
    total: number
    avg_per_booked_call?: number | null
    p50?: number | null
    p90?: number | null
    savings_count: number
  }
}

// ---------------------------------------------------------------------------
// Loads catalog — GET /loads/catalog
// ---------------------------------------------------------------------------

export interface LoadCatalogItem {
  load_id: string
  origin: string
  destination: string
  pickup_datetime: string
  delivery_datetime: string
  equipment_type: string
  loadboard_rate: number
  notes?: string | null
  weight: number
  commodity_type?: string | null
  num_of_pieces: number
  miles: number
  dimensions?: string | null
  pitch_summary: string
  // Booking lifecycle (extended by backend; defensively optional so the UI
  // builds even before the new fields ship).
  is_booked?: boolean
  booked_at?: string | null
  booked_by_mc?: string | null
  booked_by_call_id?: string | null
  booked_agreed_rate?: number | null
}

export interface LoadsCatalogResponse {
  items: LoadCatalogItem[]
  next_cursor?: string | null
  total: number
}

// ---------------------------------------------------------------------------
// FMCSA verifications — GET /verifications
// ---------------------------------------------------------------------------

export interface VerificationDetail {
  id: number
  mc_number: string
  eligible: boolean
  carrier_name?: string | null
  dot_number?: string | null
  status?: string | null
  reason?: string | null
  raw_response?: Record<string, unknown> | null
  checked_at: string
}

export interface VerificationsResponse {
  items: VerificationDetail[]
  next_cursor?: string | null
  total: number
}
