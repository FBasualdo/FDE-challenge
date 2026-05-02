"""Tiny in-process TTL cache for analytics responses.

Why in-process and not Redis?
  - The dashboard is the only consumer; one Railway dyno serves it.
  - 15s TTL means at most 4 rebuilds per minute per endpoint regardless
    of dashboard refresh rate.
  - Adding a Redis dependency for this would be over-engineering at the
    POC stage and introduces another deploy-time failure mode.

Thread-safety: FastAPI runs request handlers on the event loop, so calls
to `get`/`set` are not concurrent in the racy sense. We still serialize
mutations behind a lock so background tasks (if added later) don't corrupt
the dict mid-iteration.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

DEFAULT_TTL_SECONDS = 15.0


@dataclass
class _Entry:
    expires_at: float
    value: Any


class TTLCache:
    """Single-process dict-backed TTL cache.

    Keyed by `(endpoint_name, params_hash)`. Values are whatever the
    caller stores (we recommend pre-serialized Pydantic dumps so the
    cached object is independent of the live SQLAlchemy session).
    """

    def __init__(self, ttl_seconds: float = DEFAULT_TTL_SECONDS) -> None:
        self._ttl = ttl_seconds
        self._store: dict[str, _Entry] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def make_key(namespace: str, params: dict[str, Any]) -> str:
        # sort_keys + default=str so datetime/Decimal don't break the hash
        # and so "?a=1&b=2" hashes identically regardless of dict order.
        payload = json.dumps(params, sort_keys=True, default=str)
        digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()  # noqa: S324
        return f"{namespace}:{digest}"

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if entry.expires_at < time.monotonic():
                # Lazy eviction. Cheaper than a background sweeper for our scale.
                self._store.pop(key, None)
                return None
            return entry.value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            self._store[key] = _Entry(
                expires_at=time.monotonic() + self._ttl,
                value=value,
            )

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


# Module-level singleton — one cache shared across all analytics endpoints.
analytics_cache = TTLCache(ttl_seconds=DEFAULT_TTL_SECONDS)
