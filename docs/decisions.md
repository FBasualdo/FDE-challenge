# Engineering Decisions

A running log of non-obvious decisions made while building this POC. The aim
is to document the *why* so a future contributor (or future self) doesn't
have to reverse-engineer intent from git history.

## DB-001 — Postgres + SQLAlchemy 2.0 (async) + Pydantic, separated layers

**Context.** First scaffold used SQLite + SQLModel (which fuses ORM and API
schema into a single class). It worked but coupled DB schema to API surface,
made future schema migrations harder, and didn't read as production-grade for
the freight broker we're pitching.

**Decision.** Migrated to Postgres on Railway with SQLAlchemy 2.0 async +
asyncpg, and Pydantic v2 schemas as a separate layer for API I/O. ORM models
live in `models.py`, API schemas in `schemas.py`, glue in `service.py`.
Sessions are dependency-injected per-request via `Depends(get_session)`.

**Consequences.** One extra file in the feature module, but each layer can
evolve independently. JSONB columns let us denormalize the carrier/load/
negotiation snapshots without giving up queryability.

## API-001 — Nested objects in `POST /calls` accept extras

**Context.** HappyRobot tools return rich JSON (the full load row, the full
FMCSA verification response, the full evaluate_offer response). Mapping each
field one-by-one into flow variables and then re-mapping them back into the
`save_call` body is fragile and high-effort for the user.

**Decision.** The nested `carrier`, `load` and `negotiation` Pydantic models
accept arbitrary extra fields (`extra="allow"`). The columns are JSONB, so
extras are persisted verbatim with no schema change. Only the typed fields
(loadboard_rate, eligible, rounds, final_agreed_rate) are read by the
metrics aggregator.

**Consequences.** Caller-friendly: HappyRobot can pass `loads[0]` and the
`verify_carrier` response straight through. Backend keeps richer context for
future dashboard views without having to add migrations.

## NEG-001 — Server-side negotiation policy (v1)

**Context.** Choice between letting the LLM negotiate via prompt rules vs
delegating to a backend endpoint. Prompt-based has zero added latency but
non-deterministic pricing and no audit trail. Backend-based adds one HTTP
hop per round (~150–300ms) but yields auditable, configurable, deterministic
pricing decisions.

**Decision.** Server-side via `POST /negotiations/evaluate`. Each round is
persisted in `negotiation_rounds` with offer, action, and broker price.
Policy v1: accept at or below loadboard, midpoint counter capped at 110% in
round 1, 75% of the way to the offer in round 2 (still capped), final
take-it-or-leave-it at 110% in round 3.

**Consequences.** The latency is masked by the voice agent's natural turn
buffering. The audit trail feeds the dashboard ("avg margin vs loadboard",
"rounds to close", "rejection rate by round"). Future evolution: per-load
pricing bands instead of a global percentage (see roadmap).

## FMCSA-001 — Backend proxy with mock fallback

**Context.** FMCSA QCMobile API requires a WebKey, has historic uptime
issues, and rate-limits aggressive callers. Calling it directly from the
voice agent leaves no audit trail and creates a hard dependency on a
third-party.

**Decision.** Backend wraps FMCSA in `fmcsa_client.verify_mc()` with a
mock-mode switch (`USE_FMCSA_MOCK`). The mock returns deterministic
eligibility based on parity of the trailing MC digit; the live path hits
QCMobile and normalizes the (deeply nested, mixed-casing) envelope. Each
verification is logged in `verifications`.

**Consequences.** Demos are not at the mercy of FMCSA uptime. New environments
(local dev, CI) work without a WebKey. Real calls in production yield real
data; mock is used only when configured.

## SEC-001 — `X-API-Key` header + LOCAL bypass

**Context.** The challenge requires API key auth on every endpoint. JWT /
OAuth would be overkill for a POC where the only callers are HappyRobot
tools and the dashboard.

**Decision.** Single shared API key validated against the `X-API-Key`
header. In `LOCAL` stage with `API_KEY` empty, the dependency bypasses auth
so the dashboard works without secrets in dev. All other stages enforce.
Settings has a `model_validator` that refuses to boot when
`ENV_STAGE_NAME != LOCAL` and `API_KEY` is empty — this prevents a
silent wide-open deployment from a missed env var.

**Consequences.** Trivial integration with HappyRobot (pin the key in each
tool's headers). For multi-tenant production, swap to per-tenant keys or
JWTs without changing endpoint signatures — just change the dependency body.

---

# Roadmap (deferred from the audit pass)

These items came out of a multi-agent audit (Code Reviewer, Security
Engineer, Database Optimizer, Backend Architect, Reality Checker) and were
intentionally deferred — they don't block the POC demo but are worth
addressing if this graduates to production.

## R-001 — Rate limiting

**Why.** Without per-IP / per-key throttles, an authenticated client can
burn the FMCSA WebKey quota, fill the `verifications` and
`negotiation_rounds` tables, and DoS the DB.

**Plan.** `slowapi` middleware. Strict limit on `/carriers/verify` (10 rpm
per key, since each call hits FMCSA), looser limit on the rest (60 rpm).
Defer storage backend to in-process for v1; Redis if multi-replica.

## R-002 — `metrics_summary` SQL aggregation + cache

**Why.** Today `metrics_summary` loads every `calls` row into Python and
aggregates in-loop. At 10k rows it's ~500ms; SWR polling at 30s makes it a
DB hot path.

**Plan.** Replace with a single SQL query using `COUNT(*) FILTER (WHERE …)`,
JSONB extraction (`load->>'loadboard_rate'::numeric`), and
`date_trunc('day', started_at) GROUP BY 1`. Add a 15s in-process TTL cache.
Also add an `ix_calls_started_at_outcome` composite index (the current
`created_at` index is unused).

## R-003 — Alembic migrations

**Why.** `Base.metadata.create_all` in the lifespan works for v1 single
replica, but: (a) breaks under concurrent boot of multiple replicas;
(b) schema diffs are invisible — every refactor mutates the table silently;
(c) seed-if-empty self-heals nothing if a partial seed gets stuck.

**Plan.** Alembic with auto-generate, run in a one-shot Railway pre-deploy
job. Replace the seed step with `INSERT ... ON CONFLICT (load_id) DO
NOTHING` so it's idempotent and self-healing.

## R-004 — Service module split

**Why.** `service.py` mixes verify orchestration, search filtering,
negotiation engine, calls upsert, and metrics aggregation. ~400 LOC.
Testable as a unit but slow to navigate and unit-test.

**Plan.** Split into `verify_service.py`, `search_service.py`,
`negotiate_service.py`, `calls_service.py`, `metrics_service.py` inside a
`services/` package. Router imports stay one-line. Zero behavior change.

## R-005 — Structured logging + request IDs

**Why.** Today logs are positional-format strings. For a voice-agent backend
where every operation is correlated by `call_id`, JSON logs with
`extra={"call_id": ..., "request_id": ...}` would make debugging in
Railway / any log aggregator dramatically faster.

**Plan.** `python-json-logger` formatter, request-id middleware that
generates a UUID per request and attaches it to a contextvar that loggers
read.

## R-006 — Per-load pricing bands (better than global ceiling)

**Why.** The negotiation policy uses a global 110% ceiling. Predictable
across loads = gameable across calls. A real broker has per-load margin
targets driven by lane spot rates, urgency, and shipper margin.

**Plan.** Add `target_rate` and `max_rate` to each load row; default to
`loadboard_rate` and `loadboard_rate * 1.10`. The policy reads these
instead of hardcoded percentages. No global number for carriers to learn.
Optional v3: randomization within a band, time-decay margin per round,
per-carrier history-driven adjustments.

## R-007 — Domain exceptions instead of HTTPException in services

**Why.** Service layer raises `HTTPException` directly — couples business
logic to FastAPI. Doesn't matter for the POC; would matter the day this
gets reused from a CLI / batch job.

**Plan.** Define `LoadNotFound`, `InvalidNegotiationRound`, etc. in
`exceptions.py`. Single global `@app.exception_handler` maps them to status
codes. Services stay HTTP-agnostic.

## R-008 — Drop unused indexes / add missing ones

**Why.** Code Reviewer + DB Optimizer flagged: `loads.origin/destination/
equipment_type` indexes are unused (the queries use `ILIKE`/`LOWER` which
defeat btree); `calls.created_at` indexed but `calls_by_day` filters on
`started_at`.

**Plan.** Drop the dead indexes, add `ix_calls_started_at` and a composite
`(started_at, outcome)`. Optionally `pg_trgm` GIN on `lower(origin)` for
real fuzzy search. Bundle with R-003.
