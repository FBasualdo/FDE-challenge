# Carrier Sales POC

Inbound carrier sales voice-agent backend + metrics dashboard.

Monorepo with two independently deployable services:

- **`backend/`** — FastAPI + uv (Python 3.12). Exposes the REST API the voice
  agent calls during a live carrier conversation (carrier verification, load
  search, negotiation, persistence).
- **`dashboard/`** — Next.js 15. Renders the operational metrics built from
  persisted call data.

---

## Local development

Requirements: Docker, `uv` (https://astral.sh/uv/), Node 20+ and a package
manager for the dashboard.

### Option A — Docker Compose (production parity)

```bash
cp .env.example .env          # fill in the values
docker compose up --build     # first run / when deps change
docker compose up             # subsequent runs
```

Backend: <http://localhost:8000>  ·  Dashboard: <http://localhost:3000>

### Option B — Native processes (hot-reload)

```bash
# Terminal 1 — backend
cd backend && uv sync && uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — dashboard
cd dashboard && npm install && npm run dev
```

---

## Environment variables

A single `.env` lives at the repo root. Both services read it.

```bash
ENV_STAGE_NAME=LOCAL          # LOCAL | DEV | STAGING | PROD
API_KEY=                      # required outside LOCAL
FMCSA_WEBKEY=                 # FMCSA QCMobile API key
USE_FMCSA_MOCK=false          # true → return canned FMCSA responses

NEXT_PUBLIC_API_URL=http://localhost:8000

CORS_ORIGINS=http://localhost:3000
```

In `LOCAL` stage with no `API_KEY` set, the backend auth dependency is
permissive so the dashboard works without secrets during dev.

---

## Repo layout

```
.
├── backend/                  FastAPI + uv
│   ├── Dockerfile
│   ├── railway.json
│   ├── pyproject.toml / uv.lock
│   ├── scripts/entrypoint.sh
│   └── src/
│       ├── main.py
│       ├── settings.py
│       └── app/
│           ├── bootstrap.py            # auto-discovers feature routers
│           ├── built_in/
│           │   ├── auth/               # X-API-Key dependency
│           │   └── health/
│           └── features/               # add new feature routers here
│
├── dashboard/                Next.js 15 + shadcn + Tailwind v4
│   ├── Dockerfile
│   ├── railway.json
│   ├── next.config.ts
│   └── src/
│       ├── app/                        # routes
│       ├── components/ui/              # shadcn primitives
│       ├── core/
│       │   ├── layout/AppShell.tsx
│       │   └── theme/
│       ├── lib/utils.ts
│       └── modules/                    # add feature modules here
│
├── docker-compose.yml
├── dev.sh                    helper that runs docker compose up
├── .env.example
└── docs/                     project documentation
```

---

## Deploy (Railway)

Each service is a separate Railway service inside the same project, both
pointing at this repo. The `railway.json` files declare the Docker build and
healthcheck for each service.

- **Backend service** → root directory `/backend`. Set `API_KEY`,
  `FMCSA_WEBKEY`, `ENV_STAGE_NAME=PROD`, `CORS_ORIGINS`.
- **Dashboard service** → root directory `/dashboard`. Set
  `NEXT_PUBLIC_API_URL` to the backend internal URL (e.g.
  `http://<backend-service-name>.railway.internal:8000`).

Railway provides HTTPS automatically for the public service domains.
