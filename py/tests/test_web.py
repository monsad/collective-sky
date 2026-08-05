from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from collective_sky import web

UTC = timezone.utc

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(web.db, "all_assets", lambda: FAKE_ASSETS)
    monkeypatch.setattr(web.db, "latest_report", lambda: FAKE_REPORT)
    monkeypatch.setattr(web.db, "latest_themes", lambda: FAKE_THEMES)
    monkeypatch.setattr(web.db, "chain_last_ok", lambda: datetime.now(UTC))
    return TestClient(web.app)

FAKE_ASSETS = [
    {
        "asset_id": "Asset111", "kind": "message", "label": "Message to TRAPPIST-1 e",
        "target_name": "TRAPPIST-1 e", "distance_ly": 40.7, "message": "we are here",
        "event": None, "occurred_at": datetime(2026, 8, 5, 20, tzinfo=UTC), "catalog_hit": True,
    },
    {
        "asset_id": "Asset222", "kind": "proof", "label": "Proof of Sky — Jupiter",
        "target_name": None, "distance_ly": None, "message": None,
        "event": "Jupiter", "occurred_at": datetime(2026, 8, 5, 21, tzinfo=UTC), "catalog_hit": True,
    },
]
FAKE_REPORT = {"body": "The sky was busy.", "model": "ai/qwen3",
               "created_at": datetime(2026, 8, 5, 22, tzinfo=UTC)}
FAKE_THEMES = [{"label": "Reaching out", "size": 4, "sample_ids": ["Asset111"]}]

def test_index_renders(client):
    assert client.get("/").status_code == 200

def test_index_shows_the_light_year_total(client):
    assert "40.7" in client.get("/").text

def test_index_shows_the_report(client):
    assert "The sky was busy." in client.get("/").text

def test_index_credits_the_model_that_wrote_it(client):
    assert "ai/qwen3" in client.get("/").text

def test_index_shows_themes(client):
    assert "Reaching out" in client.get("/").text

def test_index_links_each_asset_to_the_devnet_explorer(client):
    body = client.get("/").text
    assert "explorer.solana.com/address/Asset111?cluster=devnet" in body

def test_index_links_back_to_stellamint(client):
    assert "stellamint.vercel.app" in client.get("/").text

def test_empty_sky_invites_the_reader_instead_of_apologising(monkeypatch):
    monkeypatch.setattr(web.db, "all_assets", lambda: [])
    monkeypatch.setattr(web.db, "latest_report", lambda: None)
    monkeypatch.setattr(web.db, "latest_themes", lambda: [])
    monkeypatch.setattr(web.db, "chain_last_ok", lambda: datetime.now(UTC))
    body = TestClient(web.app).get("/").text
    assert "No one has looked up yet" in body

def test_healthy_chain_shows_no_warning(client):
    assert "Chain unreachable" not in client.get("/").text

def test_unreadable_chain_is_announced_not_disguised_as_an_empty_sky(monkeypatch):
    monkeypatch.setattr(web.db, "all_assets", lambda: [])
    monkeypatch.setattr(web.db, "latest_report", lambda: None)
    monkeypatch.setattr(web.db, "latest_themes", lambda: [])
    monkeypatch.setattr(web.db, "chain_last_ok", lambda: None)
    assert "Chain unreachable" in TestClient(web.app).get("/").text

def test_healthz_reports_ok(client):
    assert client.get("/healthz").json() == {"ok": True}

def test_api_sky_returns_stellamint_compatible_positions(client):
    data = client.get("/api/sky").json()
    by_id = {a["id"]: a for a in data["assets"]}
    assert (by_id["Asset111"]["x"], by_id["Asset111"]["y"]) == (54.8, 80.1)
    assert (by_id["Asset222"]["x"], by_id["Asset222"]["y"]) == (6.7, 39.5)
    assert data["light_years"] == 40.7

def test_asset_label_and_message_are_escaped(monkeypatch):
    malicious = [
        {
            "asset_id": "AssetEvil", "kind": "message",
            "label": "<script>alert(1)</script>",
            "target_name": "Nowhere", "distance_ly": 1.0,
            "message": "<script>alert(1)</script>",
            "event": None, "occurred_at": datetime(2026, 8, 5, 20, tzinfo=UTC),
            "catalog_hit": True,
        },
    ]
    monkeypatch.setattr(web.db, "all_assets", lambda: malicious)
    monkeypatch.setattr(web.db, "latest_report", lambda: None)
    monkeypatch.setattr(web.db, "latest_themes", lambda: [])
    monkeypatch.setattr(web.db, "chain_last_ok", lambda: datetime.now(UTC))
    body = TestClient(web.app).get("/").text
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in body
