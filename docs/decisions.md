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

## SEC-002 — Dashboard auth: argon2id + JWT (cookie OR bearer)

**Context.** The dashboard needs human auth alongside the existing
`X-API-Key` voice-agent surface. Browser code shouldn't see the shared API
key, and tying every dashboard fetch to a static secret leaks it. Sessions
need to work cross-origin for the dev split (frontend on Vercel/Railway,
backend on Railway).

**Decision.** Two parallel auth paths that coexist on the same FastAPI app:
`RequireApiKey` (X-API-Key) for voice-agent endpoints stays untouched;
`RequireUser` (JWT) for dashboard endpoints. Passwords hashed with argon2id
(`argon2-cffi`, default params). JWTs are HS256, signed with `JWT_SECRET`,
60-minute lifetime, no refresh in v1. `POST /auth/login` accepts email +
password, returns the token in the body AND sets a `session` httpOnly +
Secure (outside LOCAL) + SameSite=Lax cookie. `RequireUser` reads from
either `Authorization: Bearer ...` or the cookie — whichever the caller
sends. `POST /auth/logout` clears the cookie. `GET /auth/me` echoes the
authenticated user.

Bootstrap: there is no public registration. On first boot the lifespan
hook calls `seed_admin_if_needed()` which inserts a single admin user
when the table is empty and `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`
are both set. The settings boot guard refuses to start outside `LOCAL`
without `JWT_SECRET`, mirroring the existing `API_KEY` guard.

**Consequences.** Dashboard sessions are robust to XSS (cookie is
httpOnly) while still allowing programmatic clients to use the bearer
header. Admin-only access for v1 is fine for the POC; multi-user / RBAC
slots in via a `roles` column without changing the dependency surface.
Trade-off: argon2id is slower than bcrypt (~50–200ms per verify), which
is intentional — login is rare. Choosing argon2id over bcrypt reflects
current OWASP guidance.

## API-002 — `agent_id` on calls + agents catalog

**Context.** The v2 dashboard lists calls grouped by which voice agent
produced them ("Inbound Carrier Sales" today, more later). `calls` had
no agent attribution, so legacy rows would orphan when a second agent
appears.

**Decision.** Add `calls.agent_id VARCHAR(64) NOT NULL DEFAULT
'inbound-carrier-sales'`, indexed. Add a small `agents` catalog table
(`slug` PK, name, description, is_active) and a `GET /agents` endpoint
behind `RequireUser`. The lifespan hook seeds the default
`inbound-carrier-sales` agent if missing — idempotent. Migration uses the
existing `_PENDING_MIGRATIONS` pattern: `ADD COLUMN IF NOT EXISTS` →
backfill nulls → `SET NOT NULL` → create index. No Alembic yet (R-003
still applies).

**Consequences.** Existing `POST /calls` keeps working without sending
`agent_id` — the column default fills it. New agents are a one-row insert
into `agents` plus optionally tagging future ingest payloads with the
slug. The dashboard's call list filter is a simple `WHERE agent_id = ?`.

## API-003 — Dashboard call browsing endpoints

**Context.** The dashboard needs paginated, filterable call browsing and
a detail view that exposes negotiation rounds, FMCSA verification history,
and the parsed tool-call audit trail from each call's transcript.

**Decision.** New `dashboard_calls` feature module separate from the
voice-agent ingest. `GET /calls` (RequireUser) supports cursor pagination
by `started_at desc`, repeatable `outcome` / `sentiment` filters,
`mc_number` exact match against the JSONB carrier blob, `date_from` /
`date_to` window, and `q` ILIKE search on `transcript` + `call_id`.
`GET /calls/{call_id}` returns the full call row, the load/carrier/
negotiation JSONB, the negotiation rounds, recent verifications for that
MC, and `tool_invocations` parsed on-the-fly from the stored transcript
(no separate table). The transcript parser is defensive — malformed JSON
returns `[]` rather than throwing.

**Consequences.** The list query is one SQL with predicates pushed down;
detail is two queries plus an in-process JSON walk. No new tables
required for tool auditing. ILIKE is fine at POC scale; tsvector / GIN
trigram is a v2 swap (R-008). The cursor encodes only `started_at`, so
ties at exact same timestamp could skip rows — acceptable given the
voice-agent only writes one row per call.

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

## R-003 — Alembic migrations — DONE

**Why.** `Base.metadata.create_all` + the `_PENDING_MIGRATIONS` shotgun in
`db.py` worked for v1 single replica, but: (a) broke under concurrent boot
of multiple replicas; (b) schema diffs were invisible — every refactor
mutated the table silently; (c) `_PENDING_MIGRATIONS` only ever grew, with
no rollback path and no audit trail.

**Decision.** Introduced Alembic (async template) into `backend/alembic/`.
The lifespan hook now calls `init_db()`, which inspects the connected DB
and dispatches to one of three smart-bootstrap branches:

  1. `alembic_version` table present → `alembic upgrade head` (managed DB —
     applies any new migrations on every boot).
  2. Owned tables present but no `alembic_version` → `alembic stamp head`
     (existing prod takeover; idempotent — does NOT touch the schema, just
     marks it as managed at the baseline revision).
  3. Empty database → `alembic upgrade head` (fresh local dev / new env —
     baseline migration creates everything).

Alembic is invoked through its Python API (`alembic.config.Config` +
`alembic.command.upgrade/stamp`) inside a `connection.run_sync` callback,
so the existing async lifespan stays async. `_PENDING_MIGRATIONS` is gone;
all of its DDL is baked into the baseline migration
(`c7239d1fc057_baseline_schema.py`).

**Workflow.**
- Day-to-day schema change: edit the ORM model →
  `cd backend && uv run alembic revision --autogenerate -m "describe change"`
  → review the generated revision file (autogenerate is a hint, not gospel)
  → commit → next deploy auto-applies on boot.
- Manual upgrade locally: `cd backend && uv run alembic upgrade head`.
- Rollback last revision: `cd backend && uv run alembic downgrade -1`.
- Show current revision: `cd backend && uv run alembic current`.
- Show history: `cd backend && uv run alembic history`.

**Consequences.** Schema is now self-documenting (one PR per change, with a
diff and a downgrade path). Multi-replica boot is safe because Alembic
takes an advisory lock on `alembic_version`. Existing prod DB on Railway
takes over cleanly on first deploy with zero downtime — `stamp head` is a
single-row insert. Seed-loads / seed-agent / seed-admin still run after
the migration step (they're post-schema concerns, not migrations).

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
