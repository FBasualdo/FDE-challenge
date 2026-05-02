/**
 * Docs content rendered at /docs. Plain string so the bundle stays in
 * the client and we don't need filesystem reads at runtime.
 */
export const DOCS_MARKDOWN = `# Carrier Sales POC — Documentation

Inbound carrier sales voice-agent backend + metrics dashboard, built for the
HappyRobot FDE technical challenge.

## Live demo

- **Dashboard** — *this site you're reading*
- **API** — \`https://fde-challenge-production.up.railway.app\`
- **Repo** — [github.com/FBasualdo/FDE-challenge](https://github.com/FBasualdo/FDE-challenge)

---

## What this does

A freight broker's sales line gets called by carriers asking for loads. The
HappyRobot voice agent picks up, runs through a structured flow:

1. Greets the caller and asks for a reference number or lane.
2. Asks for the MC number, verifies it against **FMCSA QCMobile**.
3. Searches the load catalog and pitches a match.
4. Negotiates up to **3 rounds** (counter, counter, take-it-or-leave-it).
5. Mocks a transfer to a sales rep when a deal is locked.
6. Persists the call (transcript + analysis) to Postgres.

This dashboard surfaces what happened across all those calls.

---

## Architecture

\`\`\`
       ┌─────────────────┐        ┌─────────────────┐
       │  HappyRobot     │        │  FMCSA          │
       │  voice agent    │        │  QCMobile API   │
       └────────┬────────┘        └────────▲────────┘
                │ x-api-key                │
                ▼                          │
       ┌─────────────────────────────────────────────┐
       │   FastAPI backend  (Python 3.12, asyncpg)   │
       │   - POST /carriers/verify                   │
       │   - GET  /loads/search                      │
       │   - POST /negotiations/evaluate             │
       │   - POST /calls (upserts on call_id)        │
       │   - GET  /metrics/summary  (JWT)            │
       └────────────┬─────────────────┬──────────────┘
                    │                 │
                    ▼                 ▼
            ┌──────────────┐   ┌─────────────────┐
            │  Postgres    │   │  Next.js 15     │
            │  (Railway)   │   │  dashboard      │
            └──────────────┘   │  (this site)    │
                               └─────────────────┘
\`\`\`

**Stack:**

- Backend — FastAPI, SQLAlchemy 2.0 async, Alembic, asyncpg, openpyxl for Excel exports.
- Dashboard — Next.js 15 App Router, React 19, SWR, Tailwind v4, shadcn primitives, Recharts.
- DB — Postgres on Railway.
- Voice — HappyRobot platform using web-call trigger (no PSTN).

---

## Voice agent endpoints

All gated by \`x-api-key\`.

| Method | Path | Purpose |
| --- | --- | --- |
| \`POST\` | \`/carriers/verify\` | Look up an MC against FMCSA, persist the verification, return eligibility. |
| \`GET\` | \`/carriers/verify?mc_number=…\` | Same as above for tools that only emit query strings. |
| \`GET\` | \`/loads/search\` | Filter loads by reference, lane, equipment, pickup date. Excludes already-booked loads. |
| \`POST\` | \`/negotiations/evaluate\` | Apply the v1 pricing policy: ceiling = loadboard × 1.10, max 3 rounds. |
| \`POST\` | \`/calls\` | Upsert a call (transcript + outcome + sentiment + analysis). |
| \`POST\` | \`/calls/preview\` | Validate a payload **without** persisting (debug only). |

### Negotiation policy

- Carrier offer ≤ loadboard → accept at loadboard.
- Round 1 above loadboard → counter at midpoint, capped at ceiling.
- Round 2 → counter at \`loadboard + 0.75 × (offer - loadboard)\`, capped at ceiling.
- Round 3 → accept if offer ≤ ceiling, else final offer at ceiling (take-it-or-leave-it).

---

## Dashboard sections

| Section | Answers |
| --- | --- |
| **Agents** | Who is calling, how each agent is performing this week. |
| **Transcripts** | Every call with filters (date, outcome, sentiment, agent, MC). Click "View" to see the full transcript, tools called, and post-call analysis. |
| **Loads** | Catalog with status (available / booked) and full booking metadata when a load was won. |
| **Compliance** | All FMCSA verifications run from the agent. Eligibility, status, raw payload. |
| **Analytics → Overview** | Headline KPIs, repeat funnel, top carriers by bookings, margin retention vs loadboard. |
| **Analytics → Carriers** | Per-carrier leaderboard with flags (tire-kicker, hostage negotiator, repeat ineligible). |
| **Analytics → Lanes** | Lane demand + booking rate + heat trend (city-pair / state-pair toggle). |
| **Analytics → Negotiation** | Round-by-round acceptance curve and money left on the table. |

---

## Security

- **HTTPS** — provided by Railway for every public service domain.
- **Voice agent endpoints** require \`x-api-key\`.
- **Dashboard endpoints** require a JWT issued by \`POST /auth/login\` against a single shared \`DASHBOARD_PASSWORD\`. Token is stored in an \`httpOnly; Secure; SameSite=None\` cookie so it works across the dashboard and API subdomains.
- **Boot guard** — the backend refuses to start in any non-LOCAL stage without \`API_KEY\`, \`JWT_SECRET\`, and \`DASHBOARD_PASSWORD\`.
- **CORS** — \`CORS_ORIGINS\` is env-driven and exact-match.

---

## Deploy (Railway)

Two services in a single Railway project, both pointing at the same repo.

### Backend service

- **Root directory** — \`/backend\`
- **Builder** — Dockerfile (declared in \`backend/railway.json\`)
- **Required variables**:

\`\`\`bash
ENV_STAGE_NAME=PROD
DATABASE_URL=<from Railway Postgres plugin>
API_KEY=<random 32+ char string>
JWT_SECRET=<run: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
DASHBOARD_PASSWORD=<your dashboard passcode>
FMCSA_WEBKEY=<your FMCSA QCMobile key>
USE_FMCSA_MOCK=false
CORS_ORIGINS=https://<your-dashboard-host>.up.railway.app
\`\`\`

### Dashboard service

- **Root directory** — \`/dashboard\`
- **Builder** — Dockerfile (declared in \`dashboard/railway.json\`)
- **Required variables**:

\`\`\`bash
NEXT_PUBLIC_API_URL=https://<your-backend-host>.up.railway.app
\`\`\`

> ⚠️ **Use the public URL, not Railway's internal URL.** \`NEXT_PUBLIC_API_URL\` is baked into the JS bundle at build time and the browser cannot resolve \`*.railway.internal\`. Trigger a redeploy after changing it.

### Cross-domain auth

Because the two services live on different \`*.up.railway.app\` subdomains, browsers treat them as cross-site. The backend sets the session cookie with \`SameSite=None; Secure\` whenever \`ENV_STAGE_NAME != LOCAL\`. If you forget to set \`ENV_STAGE_NAME=PROD\`, login will return 200 but the cookie won't be re-attached on subsequent fetches and the user will loop back to \`/login\`.

### Healthchecks

- Backend — \`GET /health/check\` (configured in \`backend/railway.json\`)
- Dashboard — \`GET /\` (configured in \`dashboard/railway.json\`)

---

## Local development

\`\`\`bash
cp .env.example .env          # fill values
docker compose up --build     # backend + dashboard + postgres
\`\`\`

- Backend → \`http://localhost:8000\`
- Dashboard → \`http://localhost:3000\`
- Default passcode in LOCAL is \`dev\` (settable via \`DASHBOARD_PASSWORD\`).

To seed 10 representative calls with real FMCSA carriers:

\`\`\`bash
cd backend
BASE_URL=http://localhost:8000 API_KEY=$API_KEY \\
  uv run python scripts/seed_calls.py
\`\`\`

---

## Repo conventions

- \`backend/src/app/built_in/\` — reusable infrastructure (auth, health, llm). Don't put project-specific logic here.
- \`backend/src/app/features/\` — project features. Each one is its own module with \`router.py\` (thin), \`service.py\` (logic), \`schemas.py\` (Pydantic), \`models.py\` (SQLAlchemy ORM, optional). Routers auto-discovered by \`bootstrap.py\` — no manual wiring.
- \`dashboard/src/core/\` — shared layout, auth, API client. \`dashboard/src/modules/\` — feature components grouped by section.

---

## What's next

- 30-day roadmap: outbound calling, SMS follow-up for missed offers, lane forecasting, multi-broker tenancy.
- Test coverage on the negotiation engine.
- Lane heat trend backfill for the analytics section once we have ≥4 weeks of data.
`
