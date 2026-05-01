"""FMCSA carrier verification client.

Two modes:
- mock: deterministic eligibility based on parity of the trailing digit. Used in LOCAL
  dev and whenever USE_FMCSA_MOCK=true or no webkey is configured.
- live: hits FMCSA's docket-number endpoint via httpx. The real API returns a deeply
  nested envelope with mixed casing and inconsistent fields, so we normalize aggressively.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from src.settings import get_settings

logger = logging.getLogger("carrier_sales.fmcsa")

_FMCSA_TIMEOUT_SECONDS = 5.0
_FMCSA_BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number"


def _strip_mc_prefix(mc_number: str) -> str:
    cleaned = mc_number.strip().upper()
    if cleaned.startswith("MC"):
        cleaned = cleaned[2:].strip()
    return cleaned.lstrip("-").strip()


def _is_mocked() -> bool:
    s = get_settings()
    return s.use_fmcsa_mock or not s.fmcsa_webkey


async def verify_mc(mc_number: str) -> dict[str, Any]:
    """Return a normalized dict the service layer can map onto VerifyCarrierResponse."""
    cleaned = _strip_mc_prefix(mc_number)
    mode = "mock" if _is_mocked() else "live"
    logger.info("verify_mc start mc=%s mode=%s", cleaned, mode)

    result = _mock_verify(cleaned) if _is_mocked() else await _live_verify(cleaned)

    logger.info(
        "verify_mc done mc=%s eligible=%s carrier=%r reason=%r",
        cleaned, result.get("eligible"), result.get("carrier_name"), result.get("reason"),
    )
    return result


def _mock_verify(mc_number: str) -> dict[str, Any]:
    if not mc_number.isdigit():
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "MC number must be numeric",
            "raw": None,
        }

    last_digit = int(mc_number[-1])
    eligible = last_digit % 2 == 0

    if eligible:
        return {
            "eligible": True,
            "mc_number": mc_number,
            "carrier_name": f"Mock Carrier {mc_number}",
            "dot_number": f"DOT{mc_number}",
            "status": "ACTIVE",
            "allowed_to_operate": True,
            "reason": None,
            "raw": {"mock": True, "mc": mc_number},
        }

    return {
        "eligible": False,
        "mc_number": mc_number,
        "carrier_name": f"Mock Carrier {mc_number}",
        "dot_number": f"DOT{mc_number}",
        "status": "INACTIVE",
        "allowed_to_operate": False,
        "reason": "Carrier authority is not active",
        "raw": {"mock": True, "mc": mc_number},
    }


async def _live_verify(mc_number: str) -> dict[str, Any]:
    settings = get_settings()
    url = f"{_FMCSA_BASE_URL}/{mc_number}"
    params = {"webKey": settings.fmcsa_webkey}

    try:
        async with httpx.AsyncClient(timeout=_FMCSA_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
    except (httpx.TimeoutException, httpx.TransportError):
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "FMCSA temporarily unavailable",
            "raw": None,
        }

    if response.status_code == 404:
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "Carrier not found in FMCSA registry",
            "raw": None,
        }

    if response.status_code >= 500:
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "FMCSA temporarily unavailable",
            "raw": None,
        }

    try:
        payload = response.json()
    except ValueError:
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "Could not parse FMCSA response",
            "raw": None,
        }

    return _normalize_fmcsa_payload(mc_number, payload)


def _normalize_fmcsa_payload(mc_number: str, payload: dict[str, Any]) -> dict[str, Any]:
    # FMCSA returns {"content": [{"carrier": {...}}]} or sometimes {"content": {"carrier": {...}}}
    content = payload.get("content")
    carrier: dict[str, Any] | None = None
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict):
            carrier = first.get("carrier") or first
    elif isinstance(content, dict):
        carrier = content.get("carrier") or content

    if not carrier:
        return {
            "eligible": False,
            "mc_number": mc_number,
            "carrier_name": None,
            "dot_number": None,
            "status": None,
            "allowed_to_operate": None,
            "reason": "Carrier not found in FMCSA registry",
            "raw": payload,
        }

    allowed_raw = carrier.get("allowedToOperate") or carrier.get("allowed_to_operate")
    allowed_to_operate = (
        True if str(allowed_raw).upper() in ("Y", "YES", "TRUE") else
        False if str(allowed_raw).upper() in ("N", "NO", "FALSE") else
        None
    )
    status = carrier.get("statusCode") or carrier.get("status")
    eligible = bool(allowed_to_operate) and (status is None or str(status).upper() in ("A", "ACTIVE"))

    return {
        "eligible": eligible,
        "mc_number": mc_number,
        "carrier_name": carrier.get("legalName") or carrier.get("dbaName"),
        "dot_number": str(carrier.get("dotNumber")) if carrier.get("dotNumber") is not None else None,
        "status": str(status) if status is not None else None,
        "allowed_to_operate": allowed_to_operate,
        "reason": None if eligible else "Carrier authority is not active",
        "raw": payload,
    }
