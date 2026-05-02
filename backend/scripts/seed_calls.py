"""Seed 10 representative calls into /calls.

Modeled on the real call shape from the HappyRobot voice agent: each row
carries a transcript, an analysis blob (booking_decision, decline_reason,
carrier_quoted_rate, num_negotiation_rounds, loadboard_rate_offered),
plus the structured carrier/load/negotiation fields the dashboard uses.

Usage:
    cd backend
    BASE_URL=https://fde-challenge-production.up.railway.app \\
    API_KEY=... \\
    uv run python scripts/seed_calls.py

Or against local dev:
    BASE_URL=http://127.0.0.1:8000 API_KEY=$API_KEY uv run python scripts/seed_calls.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000").rstrip("/")
API_KEY = os.environ.get("API_KEY", "")

if not API_KEY:
    print("ERROR: set API_KEY in env", file=sys.stderr)
    sys.exit(2)

NOW = datetime.now(timezone.utc).replace(microsecond=0)


def at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    return (NOW - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=0)


# --- Transcripts ---------------------------------------------------------

T_BOOKED_LISTED = """\
A: Acme Logistics, how can I help?
user: Calling on Lima Delta one zero zero one.
A: L as in Lima, D as in Delta, one-zero-zero-one — got it. Can I get your MC number?
user: Fifteen twenty-one, two-four-eight.
A: Got it, MC 1521248. Let me pull that up.
A: You're calling from Best Yet Express, that right?
user: Yes.
A: Alright, this is a Dry Van load from Chicago to Dallas, 925 miles, picking up Friday at 8 AM, delivering Saturday at 6 PM. Packaged Foods, 38,000 pounds. The rate is twenty-four hundred. Two-four-zero-zero. Would you like to book it?
user: Yeah, twenty-four works for me.
A: Confirmed at twenty-four hundred. Two-four-zero-zero. Transferring you now.
"""

T_BOOKED_R1 = """\
A: Acme Logistics, how can I help?
user: Hi, I'm looking at Miami to Atlanta, the dry van pulling out tomorrow.
A: Sure, what's your MC number?
user: One five two one, two four eight.
A: 1521248 — let me check.
A: Best Yet Express, right?
user: That's me.
A: I have a Dry Van Miami to Atlanta, 660 miles, picking up Saturday morning. Sixteen-twenty. One-six-two-zero.
user: I'd need eighteen hundred to make that one work.
A: I can stretch a bit and do seventeen-ten. One-seven-one-zero. Rates this lane have softened lately.
user: Yeah, alright, seventeen-ten works.
A: Confirmed at seventeen-ten. One-seven-one-zero. Transferring you to my colleague to lock it in.
"""

T_BOOKED_R2 = """\
A: Acme Logistics, how can I help?
user: Looking at the Nashville to Charlotte reefer.
A: Got it. MC number?
user: One five two one, two four eight.
A: Best Yet Express, correct?
user: Yes.
A: Reefer, Nashville to Charlotte, 410 miles, pickup Tuesday. Thirteen-twenty. One-three-two-zero.
user: I need fifteen-fifty on that one.
A: I can come up to fourteen-three-five. One-four-three-five.
user: Meet me at fourteen-eighty.
A: I can do fourteen fifty-two. One-four-five-two. Close to our ceiling on this lane.
user: Alright, fourteen fifty-two works.
A: Confirmed at fourteen fifty-two. One-four-five-two. Transferring now.
"""

T_BOOKED_ORION = """\
A: Acme Logistics, how can I help?
user: Calling on Atlanta to Miami, reefer.
A: What's your MC number?
user: One eight zero zero, zero zero one.
A: 1800001 — Orion Moving Systems, that right?
user: Yeah.
A: I have an Atlanta to Miami reefer, pharmaceuticals, 660 miles. Eighteen-fifty. One-eight-five-zero.
user: I'd want twenty-one hundred for that.
A: I can stretch and do nineteen forty-three. One-nine-four-three. Rates this lane have softened.
user: That works.
A: Confirmed at nineteen forty-three. One-nine-four-three. Transferring you now.
"""

T_NEG_FAILED_GREGORY = """\
A: Acme Logistics, how can I help?
user: Pittsburgh to New York, dry van.
A: MC?
user: One six five zero, zero zero zero.
A: Gregory Boy Trucking, that right?
user: Yes.
A: Dry Van, Pittsburgh to New York, 380 miles. Twelve-fifty. One-two-five-zero.
user: I need sixteen hundred.
A: I can do thirteen-twenty-five. One-three-two-five.
user: Fifteen-fifty.
A: I can stretch to thirteen sixty-three. One-three-six-three. Close to ceiling.
user: Fifteen hundred is my floor.
A: Best I can do is thirteen seventy-five. One-three-seven-five. Take it or leave it.
user: I'll have to pass. Thanks.
A: Understood. If anything changes someone will reach out. Thanks for calling Acme Logistics.
"""

T_NEG_FAILED_AJB = """\
A: Acme Logistics, how can I help?
user: Minneapolis to Chicago, reefer.
A: MC number?
user: Seven seven eight, eight three two.
A: AJB Transports, right?
user: Yeah.
A: Reefer, Minneapolis to Chicago, 410 miles. Eleven-eighty. One-one-eight-zero.
user: I need fourteen-fifty.
A: I can stretch to twelve-fifteen. One-two-one-five.
user: Fourteen hundred minimum.
A: I can do twelve sixty-five. One-two-six-five. Close to ceiling.
user: I'm at fourteen hundred or nothing.
A: Best I can offer is twelve ninety-eight. One-two-nine-eight. Final.
user: I'll pass, thanks.
A: Understood. If anything changes someone will reach out.
"""

T_DECLINED_AJB = """\
A: Acme Logistics, how can I help?
user: Seattle to Portland, dry van.
A: MC number?
user: Seven seven eight, eight three two.
A: AJB Transports, right?
user: Yes.
A: Dry Van, Seattle to Portland, 175 miles, pickup Thursday morning. Six-twenty. Six-two-zero.
user: That lane is too short for me, not interested at that rate.
A: Understood. If anything changes someone will reach out. Thanks for calling Acme Logistics.
"""

T_NOT_ELIGIBLE = """\
A: Acme Logistics, how can I help?
user: Hi, looking at any flatbed runs out of Houston.
A: Sure, what's your MC number?
user: One five zero zero, zero zero zero.
A: Let me check that. One moment.
A: I'm sorry, your operating authority shows as inactive per FMCSA records. I can't book you on a load until that's resolved. Please call us back once your status is active. Thanks for calling Acme Logistics.
"""

T_NO_MATCH = """\
A: Acme Logistics, how can I help?
user: Calling on Romeo Echo Foxtrot nine nine nine nine.
A: REF-9999 — got it. MC number?
user: Seven five zero, zero zero one.
A: Lapwin Inc, right?
user: Yes.
A: Let me check that reference. One moment.
A: I'm not seeing anything matching REF-9999 on our boards right now. We have new postings coming up — visit AcmeLoads.com for the latest. Thanks for calling Acme Logistics.
"""

T_BOOKED_LAPWIN = """\
A: Acme Logistics, how can I help?
user: Looking at the Phoenix to LA backhaul.
A: Sure, can I get your MC number?
user: Seven five zero, zero zero one.
A: 750001 — Lapwin Inc, right?
user: Yes.
A: Dry Van Phoenix to Los Angeles, 372 miles, pickup Monday afternoon. Nine-fifty. Nine-five-zero.
user: Yeah, that works.
A: Confirmed at nine-fifty. Nine-five-zero. Transferring now.
"""


# --- Build payloads ------------------------------------------------------


def build(
    call_id: str,
    started: datetime,
    duration_s: int,
    *,
    carrier_mc: str,
    carrier_name: str,
    eligible: bool,
    load: dict[str, Any] | None,
    rounds: int,
    final_rate: float | None,
    outcome: str,
    sentiment: str,
    transcript: str,
    analysis_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ended = started + timedelta(seconds=duration_s)
    analysis: dict[str, Any] = {
        "outcome": outcome,
        "sentiment": sentiment,
        "num_negotiation_rounds": rounds,
        "loadboard_rate_offered": (load or {}).get("loadboard_rate"),
    }
    if outcome == "Booked":
        analysis["booking_decision"] = "yes"
    elif outcome in {"Negotiation Failed", "Carrier Declined"}:
        analysis["booking_decision"] = "no"
    if analysis_extra:
        analysis.update(analysis_extra)

    return {
        "call_id": call_id,
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "duration_seconds": duration_s,
        "carrier": {
            "mc_number": carrier_mc,
            "carrier_name": carrier_name,
            "eligible": eligible,
        },
        "load": load,
        "negotiation": {"rounds": rounds, "final_agreed_rate": final_rate},
        "outcome": outcome,
        "sentiment": sentiment,
        "analysis": analysis,
        "transcript": transcript,
    }


# All MC numbers below were verified through FMCSA via /carriers/verify;
# names match the live QCMobile records as of seeding.
UNIQUE_MCS_TO_VERIFY: list[str] = [
    "1521248",  # BEST YET EXPRESS INC          (eligible)
    "750001",  # LAPWIN INC                    (eligible)
    "778832",  # AJB TRANSPORTS CORP           (eligible)
    "1800001",  # ORION MOVING SYSTEMS INC      (eligible)
    "1650000",  # GREGORY BOY TRUCKING LLC      (eligible)
    "1500000",  # L BURK TRANSPORT LLC          (inactive — used for Not Eligible)
]


CALLS: list[dict[str, Any]] = [
    build(
        "seed-call-001",
        at(6, 9, 14),
        242,
        carrier_mc="1521248",
        carrier_name="BEST YET EXPRESS INC",
        eligible=True,
        load={"load_id": "LD-1001", "loadboard_rate": 2400.0},
        rounds=0,
        final_rate=2400.0,
        outcome="Booked",
        sentiment="Positive",
        transcript=T_BOOKED_LISTED,
        analysis_extra={"carrier_quoted_rate": 2400.0},
    ),
    build(
        "seed-call-002",
        at(4, 11, 32),
        318,
        carrier_mc="1521248",
        carrier_name="BEST YET EXPRESS INC",
        eligible=True,
        load={"load_id": "LD-1006", "loadboard_rate": 1620.0},
        rounds=1,
        final_rate=1710.0,
        outcome="Booked",
        sentiment="Positive",
        transcript=T_BOOKED_R1,
        analysis_extra={"carrier_quoted_rate": 1800.0},
    ),
    build(
        "seed-call-003",
        at(1, 14, 5),
        405,
        carrier_mc="1521248",
        carrier_name="BEST YET EXPRESS INC",
        eligible=True,
        load={"load_id": "LD-1014", "loadboard_rate": 1320.0},
        rounds=2,
        final_rate=1452.0,
        outcome="Booked",
        sentiment="Neutral",
        transcript=T_BOOKED_R2,
        analysis_extra={"carrier_quoted_rate": 1550.0},
    ),
    build(
        "seed-call-004",
        at(5, 10, 47),
        298,
        carrier_mc="1800001",
        carrier_name="ORION MOVING SYSTEMS INC",
        eligible=True,
        load={"load_id": "LD-1005", "loadboard_rate": 1850.0},
        rounds=1,
        final_rate=1943.0,
        outcome="Booked",
        sentiment="Positive",
        transcript=T_BOOKED_ORION,
        analysis_extra={"carrier_quoted_rate": 2100.0},
    ),
    build(
        "seed-call-005",
        at(3, 15, 22),
        201,
        carrier_mc="750001",
        carrier_name="LAPWIN INC",
        eligible=True,
        load={"load_id": "LD-1004", "loadboard_rate": 950.0},
        rounds=0,
        final_rate=950.0,
        outcome="Booked",
        sentiment="Positive",
        transcript=T_BOOKED_LAPWIN,
        analysis_extra={"carrier_quoted_rate": 950.0},
    ),
    build(
        "seed-call-006",
        at(4, 16, 8),
        377,
        carrier_mc="1650000",
        carrier_name="GREGORY BOY TRUCKING LLC",
        eligible=True,
        load={"load_id": "LD-1018", "loadboard_rate": 1250.0},
        rounds=3,
        final_rate=None,
        outcome="Negotiation Failed",
        sentiment="Negative",
        transcript=T_NEG_FAILED_GREGORY,
        analysis_extra={
            "carrier_quoted_rate": 1600.0,
            "decline_reason": "rate too low; carrier wanted 1500 floor",
        },
    ),
    build(
        "seed-call-007",
        at(2, 9, 51),
        342,
        carrier_mc="778832",
        carrier_name="AJB TRANSPORTS CORP",
        eligible=True,
        load={"load_id": "LD-1023", "loadboard_rate": 1180.0},
        rounds=3,
        final_rate=None,
        outcome="Negotiation Failed",
        sentiment="Neutral",
        transcript=T_NEG_FAILED_AJB,
        analysis_extra={
            "carrier_quoted_rate": 1450.0,
            "decline_reason": "rate gap too wide; carrier insisted on 1400",
        },
    ),
    build(
        "seed-call-008",
        at(2, 13, 16),
        134,
        carrier_mc="778832",
        carrier_name="AJB TRANSPORTS CORP",
        eligible=True,
        load={"load_id": "LD-1009", "loadboard_rate": 620.0},
        rounds=0,
        final_rate=None,
        outcome="Carrier Declined",
        sentiment="Neutral",
        transcript=T_DECLINED_AJB,
        analysis_extra={"decline_reason": "lane too short / rate not worth deadhead"},
    ),
    build(
        "seed-call-009",
        at(1, 11, 4),
        88,
        carrier_mc="1500000",
        carrier_name="L BURK TRANSPORT LLC",
        eligible=False,
        load=None,
        rounds=0,
        final_rate=None,
        outcome="Not Eligible",
        sentiment="Neutral",
        transcript=T_NOT_ELIGIBLE,
        analysis_extra={"decline_reason": "FMCSA: operating authority inactive"},
    ),
    build(
        "seed-call-010",
        at(0, 8, 41),
        119,
        carrier_mc="750001",
        carrier_name="LAPWIN INC",
        eligible=True,
        load=None,
        rounds=0,
        final_rate=None,
        outcome="No Match Found",
        sentiment="Neutral",
        transcript=T_NO_MATCH,
        analysis_extra={"requested_reference_number": "REF-9999"},
    ),
]


def main() -> None:
    headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
    with httpx.Client(timeout=20.0) as cli:
        # Verify each MC against FMCSA first. Each call lands a row in the
        # `verifications` table, so the Compliance tab in the dashboard
        # mirrors the carriers we're about to seed calls for.
        print("Verifying carriers via FMCSA:")
        for mc in UNIQUE_MCS_TO_VERIFY:
            r = cli.get(f"{BASE_URL}/carriers/verify", params={"mc_number": mc}, headers=headers)
            if r.status_code != 200:
                print(f"  ✗ MC {mc}: {r.status_code} {r.text[:160]}")
                continue
            b = r.json()
            print(
                f"  ✓ MC {mc}: eligible={b.get('eligible')} | "
                f"status={b.get('status') or '-'} | {b.get('carrier_name') or '-'}"
            )

        print("\nUpserting calls:")
        posted = 0
        updated = 0
        failed = 0
        for c in CALLS:
            r = cli.post(f"{BASE_URL}/calls", headers=headers, json=c)
            if r.status_code == 200:
                body = r.json()
                if body.get("created"):
                    posted += 1
                    state = "created"
                else:
                    updated += 1
                    state = "updated"
                print(f"  ✓ {c['call_id']} ({c['outcome']}) -> {state}")
            else:
                failed += 1
                print(f"  ✗ {c['call_id']} -> {r.status_code} {r.text[:200]}")
        print(f"\nDone. created={posted} updated={updated} failed={failed}")


if __name__ == "__main__":
    main()
