"""FMCSA compliance audit log for the dashboard.

Endpoints (all gated by `RequireUser`):
  - GET /verifications              list with filters + cursor pagination
  - GET /verifications/export.xlsx  Excel export of the same filtered set

Source of truth is the `verifications` table — one row per voice-agent
call to `POST /carriers/verify`. The dashboard exposes this so a human
can audit who got rejected (and why) without reading raw call payloads.
"""
