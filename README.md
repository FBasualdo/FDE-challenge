# Carrier Sales POC

Inbound carrier sales voice-agent backend + operator analytics dashboard, built
for the HappyRobot FDE technical challenge.

Two independently deployable services in the same repo:

- **`backend/`** — FastAPI + uv (Python 3.12). Exposes the REST API the voice
  agent calls during a live carrier conversation (carrier verification, load
  search, server-side negotiation, persistence) plus the JSON the dashboard
  reads.
- **`dashboard/`** — Next.js 15 + Tailwind v4 + shadcn. Renders the operational
  metrics built from persisted call data. A walk-through of every screen lives
  in-app at `/docs` after login.

---

## Run locally

Requirements: Docker, [`uv`](https://astral.sh/uv/), Node 20+, npm.

```bash
cp .env.example .env       # defaults are fine for LOCAL
bash dev.sh
```

That single script:

- Boots Postgres in a Docker container (persistent volume).
- Runs the FastAPI backend on `localhost:8000` with `--reload`.
- Runs the Next.js dashboard on `localhost:3000` with Turbopack.
- Stops everything cleanly on Ctrl+C.

The dashboard prints its login passcode at startup (defaults to `dev` in LOCAL).

To seed the DB with realistic demo calls (10 conversations, real FMCSA-verified
carriers):

```bash
cd backend && uv run python scripts/seed_calls.py
```

---

## Environment variables

A single `.env` lives at the repo root. Both services read it. All values
documented in `.env.example`.

| Variable | Required | Notes |
|---|---|---|
| `ENV_STAGE_NAME` | always | `LOCAL` \| `DEV` \| `STAGING` \| `PROD` |
| `API_KEY` | non-LOCAL | Voice agent sends in `X-API-Key` header |
| `JWT_SECRET` | non-LOCAL | Signs HS256 dashboard session JWTs |
| `JWT_EXPIRES_MINUTES` | optional | Defaults to 60 |
| `DASHBOARD_PASSWORD` | non-LOCAL | Single shared login passcode (POC scope) |
| `USE_FMCSA_MOCK` | optional | `true` → canned eligible/ineligible responses |
| `FMCSA_WEBKEY` | live mode | QCMobile API key |
| `CORS_ORIGINS` | always | Comma-separated, must include the dashboard origin |
| `DATABASE_URL` | non-LOCAL | `postgresql+asyncpg://…` — Railway Postgres internal URL |
| `NEXT_PUBLIC_API_URL` | always | Base URL the dashboard calls at build time |

In `LOCAL` with `API_KEY` empty, the backend's API-key dependency is permissive
so you can curl freely during dev. Dashboard auth is always enforced.

---

## Authentication

Two parallel auth surfaces, each protecting a different audience:

- **Voice-agent endpoints** (`/loads/*`, `/calls/*`, `/carriers/verify`) →
  `X-API-Key` header. The HappyRobot workflow is the only client.
- **Dashboard endpoints** (`/auth/*`, `/metrics/*`, `/dashboard/*`) →
  HS256 JWT in an httpOnly `session` cookie set by `/auth/login`.

`SameSite=None; Secure` outside LOCAL so the dashboard host and the API host can
live on different Railway subdomains.

---

## Database migrations (Alembic)

The schema is managed by Alembic. On boot the lifespan hook detects the DB
state and either applies pending migrations, stamps an existing unmanaged
schema as the baseline, or applies the baseline on a fresh DB — whichever is
appropriate. No manual step on deploy.

To change the schema:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
# Review the generated file in alembic/versions/, edit if autogenerate missed something
uv run alembic upgrade head
# Commit the revision file. Next deploy auto-applies on boot.
```

Other useful commands: `uv run alembic current`, `uv run alembic history`,
`uv run alembic downgrade -1`.

---

## Repo layout

```
.
├── backend/                    FastAPI + uv
│   ├── Dockerfile
│   ├── railway.json
│   ├── pyproject.toml / uv.lock
│   ├── alembic.ini · alembic/
│   ├── scripts/
│   │   ├── entrypoint.sh
│   │   ├── seed_calls.py                  # seed 10 demo calls + FMCSA verifications
│   │   └── clamp_existing_premiums.py     # one-shot defensive cleanup
│   └── src/app/
│       ├── bootstrap.py                   # auto-discovers feature routers
│       ├── built_in/
│       │   ├── auth/         # API-key dependency + JWT login + cookies
│       │   └── health/
│       └── features/
│           ├── inbound_carrier_sales/     # the 4 voice-agent tools
│           ├── analytics/                 # carriers, lanes, negotiation aggregates
│           ├── dashboard_calls/           # call history feed
│           ├── dashboard_loads/           # load catalog admin
│           ├── compliance/                # FMCSA verifications log
│           ├── exports/                   # CSV/JSON dumps
│           └── agents/                    # workflow metadata
│
├── dashboard/                  Next.js 15 + Tailwind v4 + shadcn
│   ├── Dockerfile
│   ├── railway.json
│   └── src/
│       ├── app/(dashboard)/               # protected routes
│       ├── app/login/                     # passcode form
│       ├── core/auth/AuthProvider.tsx     # client-side guard
│       └── modules/
│           ├── metrics/    # Analytics Overview, Carriers, Lanes, Negotiation
│           ├── transcripts/                # Calls feed + detail
│           ├── loads/      compliance/  agents/  docs/
│
├── docker-compose.yml          # postgres for local dev (used by dev.sh)
├── dev.sh                      # full local stack with hot reload
├── .env.example
└── docs/                       project documentation
```

---

## Deploy (Railway)

Each service is a separate Railway service inside the same project, both
pointing at this repo. The `railway.json` files declare the Docker build and
healthcheck.

- **Backend** → root directory `/backend`. Set `ENV_STAGE_NAME=PROD`,
  `API_KEY`, `JWT_SECRET`, `DASHBOARD_PASSWORD`, `FMCSA_WEBKEY`,
  `DATABASE_URL`, `CORS_ORIGINS` (must include the dashboard origin).
- **Dashboard** → root directory `/dashboard`. Set `NEXT_PUBLIC_API_URL` to
  the public backend URL (e.g. `https://<backend>.up.railway.app`).
- **Postgres** → Railway add-on; copy its internal URL into `DATABASE_URL`.

Railway provides HTTPS automatically. Migrations apply on boot via the
entrypoint hook.

---

## Links

- HappyRobot workflow: <https://platform.happyrobot.ai/fdefranciscobasualdo/workflows/wy8euap45gz6/editor/b1lqyd3z9up1>
- In-app documentation: `/docs` on the deployed dashboard (login required)
- The four voice-agent endpoints (`verify_carrier`, `find_available_loads`, `evaluate_offer`, `save_call`) are documented in the in-app `/docs` page with request/response shapes.
