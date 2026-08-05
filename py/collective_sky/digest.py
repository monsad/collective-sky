from __future__ import annotations

from collections import Counter
from typing import Any

MAX_MESSAGES = 60
MAX_MESSAGE_CHARS = 280
TOP_N = 6

def build_digest(rows: list[dict[str, Any]], window_hours: int) -> dict[str, Any]:
    messages = [r for r in rows if r["kind"] == "message"]
    proofs = [r for r in rows if r["kind"] == "proof"]

    light_years = sum(
        float(r["distance_ly"]) for r in messages if r["catalog_hit"] and r["distance_ly"]
    )

    target_counts = Counter(
        r["target_name"] for r in messages if r["catalog_hit"] and r["target_name"]
    )
    event_counts = Counter(r["event"] for r in proofs if r["event"])

    times = sorted(r["occurred_at"] for r in rows)

    return {
        "window_hours": window_hours,
        "message_count": len(messages),
        "proof_count": len(proofs),
        "light_years": round(light_years, 4),
        "unknown_targets": sum(1 for r in messages if not r["catalog_hit"]),
        "top_targets": [{"name": n, "count": c} for n, c in target_counts.most_common(TOP_N)],
        "top_events": [{"name": n, "count": c} for n, c in event_counts.most_common(TOP_N)],
        "messages": [
            str(r["message"])[:MAX_MESSAGE_CHARS]
            for r in messages[:MAX_MESSAGES]
            if r["message"]
        ],
        "first_observed": times[0].isoformat() if times else None,
        "last_observed": times[-1].isoformat() if times else None,
    }
