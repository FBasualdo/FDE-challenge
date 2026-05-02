"""Analytics feature: per-carrier, per-lane, and negotiation metrics.

Endpoints (all gated by `RequireUser` — dashboard JWT only):
  - GET /metrics/carriers
  - GET /metrics/carriers/{mc_number}
  - GET /metrics/lanes
  - GET /metrics/negotiation

The four standalone endpoints live here. Extensions to the existing
/metrics/summary endpoint stay in `inbound_carrier_sales/service.py`
because the summary aggregator is one SQL pass and small additions
fit naturally next to the existing code.
"""
