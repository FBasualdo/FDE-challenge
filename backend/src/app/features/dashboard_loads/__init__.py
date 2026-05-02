"""Dashboard load catalog browser.

Endpoints (all gated by `RequireUser`):
  - GET /loads/catalog            list with filters + cursor pagination
  - GET /loads/catalog/export.xlsx Excel export of the same filtered set

The voice-agent endpoint `GET /loads/search` (in `inbound_carrier_sales`)
stays untouched and stays under `RequireApiKey`. Different consumer,
different auth, different shape — keeping the two routes separate lets
each evolve without breaking the other.
"""
