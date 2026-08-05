from datetime import datetime, timezone

from collective_sky.digest import build_digest

UTC = timezone.utc

def msg(text, target, ly, hit=True, when=None):
    return {
        "asset_id": f"a{abs(hash(text)) % 1000}",
        "kind": "message",
        "target_name": target,
        "distance_ly": ly,
        "message": text,
        "event": None,
        "occurred_at": when or datetime(2026, 8, 5, 20, 0, tzinfo=UTC),
        "catalog_hit": hit,
    }

def proof(event, when=None):
    return {
        "asset_id": f"p{abs(hash(event)) % 1000}",
        "kind": "proof",
        "target_name": None,
        "distance_ly": None,
        "message": None,
        "event": event,
        "occurred_at": when or datetime(2026, 8, 5, 21, 0, tzinfo=UTC),
        "catalog_hit": True,
    }

def test_counts_each_kind():
    d = build_digest([msg("hi", "TRAPPIST-1 e", 40.7), proof("Jupiter")], window_hours=24)
    assert d["message_count"] == 1
    assert d["proof_count"] == 1

def test_sums_light_years():
    d = build_digest(
        [msg("a", "TRAPPIST-1 e", 40.7), msg("b", "Ross 128 b", 11.0)], window_hours=24
    )
    assert d["light_years"] == 51.7

def test_excludes_unknown_catalog_rows_from_light_years():
    d = build_digest(
        [msg("a", "TRAPPIST-1 e", 40.7), msg("b", None, None, hit=False)], window_hours=24
    )
    assert d["light_years"] == 40.7
    assert d["unknown_targets"] == 1

def test_ranks_targets_by_popularity():
    d = build_digest(
        [
            msg("a", "TRAPPIST-1 e", 40.7),
            msg("b", "TRAPPIST-1 e", 40.7),
            msg("c", "Ross 128 b", 11.0),
        ],
        window_hours=24,
    )
    assert d["top_targets"][0] == {"name": "TRAPPIST-1 e", "count": 2}

def test_ranks_events():
    d = build_digest([proof("Jupiter"), proof("Jupiter"), proof("Perseids")], window_hours=24)
    assert d["top_events"][0] == {"name": "Jupiter", "count": 2}

def test_includes_message_texts_for_the_narrator():
    d = build_digest([msg("we are here", "TRAPPIST-1 e", 40.7)], window_hours=24)
    assert "we are here" in d["messages"]

def test_truncates_overlong_messages_so_the_prompt_stays_bounded():
    d = build_digest([msg("x" * 5000, "TRAPPIST-1 e", 40.7)], window_hours=24)
    assert all(len(m) <= 280 for m in d["messages"])

def test_caps_message_count_so_the_prompt_stays_bounded():
    rows = [msg(f"m{i}", "TRAPPIST-1 e", 40.7) for i in range(500)]
    d = build_digest(rows, window_hours=24)
    assert len(d["messages"]) <= 60

def test_empty_input_produces_a_valid_empty_digest():
    d = build_digest([], window_hours=24)
    assert d == {
        "window_hours": 24,
        "message_count": 0,
        "proof_count": 0,
        "light_years": 0.0,
        "unknown_targets": 0,
        "top_targets": [],
        "top_events": [],
        "messages": [],
        "first_observed": None,
        "last_observed": None,
    }

def test_reports_the_observed_time_range():
    early = datetime(2026, 8, 5, 18, 0, tzinfo=UTC)
    late = datetime(2026, 8, 5, 23, 0, tzinfo=UTC)
    d = build_digest(
        [msg("a", "Ross 128 b", 11.0, when=late), proof("Jupiter", when=early)],
        window_hours=24,
    )
    assert d["first_observed"] == early.isoformat()
    assert d["last_observed"] == late.isoformat()

def test_digest_contains_no_uris_or_asset_internals():
    d = build_digest([msg("hi", "TRAPPIST-1 e", 40.7)], window_hours=24)
    flat = repr(d)
    assert "http" not in flat
    assert "asset_id" not in d
