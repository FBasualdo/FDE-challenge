"""Parse tool invocations out of a stored transcript.

The voice agent serializes its message history as a JSON-encoded list of
message dicts. Assistant messages may include `tool_calls` (OpenAI-shaped):
each tool call has an `id`, a `function.name`, and a `function.arguments`
string. The next message with `role: "tool"` and matching `tool_call_id`
holds the tool's result (typically a JSON-encoded string in `content`).

We walk the transcript once and return the ordered pairings. Defensive on
malformed input — anything we can't parse becomes an empty list, never an
exception, so call detail rendering is robust to garbage transcripts.
"""

from __future__ import annotations

import json
from typing import Any


def _coerce_json(raw: Any) -> Any:
    if not isinstance(raw, str):
        return raw
    raw = raw.strip()
    if not raw:
        return raw
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return raw


def _extract_messages(transcript: str | None) -> list[dict[str, Any]]:
    if not transcript:
        return []
    try:
        parsed = json.loads(transcript)
    except (ValueError, TypeError):
        return []
    if isinstance(parsed, dict):
        for key in ("messages", "transcript", "history"):
            value = parsed.get(key)
            if isinstance(value, list):
                parsed = value
                break
        else:
            return []
    if not isinstance(parsed, list):
        return []
    return [m for m in parsed if isinstance(m, dict)]


def parse_tool_invocations(transcript: str | None) -> list[dict[str, Any]]:
    messages = _extract_messages(transcript)
    if not messages:
        return []

    # Index tool replies by their tool_call_id for O(1) lookup.
    tool_results: dict[str, dict[str, Any]] = {}
    for msg in messages:
        if msg.get("role") == "tool":
            tcid = msg.get("tool_call_id") or msg.get("id")
            if isinstance(tcid, str):
                tool_results[tcid] = msg

    invocations: list[dict[str, Any]] = []
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        tool_calls = msg.get("tool_calls")
        if not isinstance(tool_calls, list):
            continue
        for tc in tool_calls:
            if not isinstance(tc, dict):
                continue
            tc_id = tc.get("id")
            fn = tc.get("function") if isinstance(tc.get("function"), dict) else {}
            name = fn.get("name") or tc.get("name") or "unknown"
            args_raw = fn.get("arguments") if "arguments" in fn else tc.get("arguments")
            args = _coerce_json(args_raw)

            result_msg = tool_results.get(tc_id) if isinstance(tc_id, str) else None
            result = _coerce_json(result_msg.get("content")) if result_msg else None
            ts = (
                msg.get("ts")
                or msg.get("timestamp")
                or (result_msg.get("ts") if result_msg else None)
                or (result_msg.get("timestamp") if result_msg else None)
            )

            invocations.append(
                {
                    "name": str(name),
                    "args": args if isinstance(args, dict) else {"_raw": args},
                    "result": result,
                    "ts": ts if isinstance(ts, (int, float)) else None,
                }
            )

    return invocations
