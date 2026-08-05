from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from . import db
from .skymap import sky_position

STELLAMINT_URL = "https://stellamint.vercel.app"
ARTICLE_URL = (
    "https://dev.to/msadlok/stellamint-a-message-to-the-stars-and-proof-of-the-"
    "night-you-looked-up-109p"
)

app = FastAPI(title="Collective Sky")
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent / "templates"))

STALE_AFTER_S = int(os.environ.get("SWEEP_INTERVAL_MS", "300000")) / 1000 * 3

def _chain_stale() -> bool:
    last_ok = db.chain_last_ok()
    if last_ok is None:
        return True
    age = (datetime.now(timezone.utc) - last_ok).total_seconds()
    return age > STALE_AFTER_S

def _view_model() -> dict[str, Any]:
    assets = db.all_assets()
    stars = [
        {
            "id": a["asset_id"],
            "label": a["label"],
            "kind": a["kind"],
            "x": sky_position(str(a["asset_id"]))[0],
            "y": sky_position(str(a["asset_id"]))[1],
            "detail": a["message"] or a["event"] or "",
            "occurred_at": a["occurred_at"],
            "catalog_hit": a["catalog_hit"],
        }
        for a in assets
    ]
    light_years = round(
        sum(float(a["distance_ly"]) for a in assets if a["catalog_hit"] and a["distance_ly"]), 4
    )
    return {
        "assets": stars,
        "light_years": light_years,
        "message_count": sum(1 for a in assets if a["kind"] == "message"),
        "proof_count": sum(1 for a in assets if a["kind"] == "proof"),
        "unknown_targets": sum(1 for a in assets if not a["catalog_hit"]),
        "report": db.latest_report(),
        "themes": db.latest_themes(),
        "chain_stale": _chain_stale(),
        "stellamint_url": STELLAMINT_URL,
        "article_url": ARTICLE_URL,
    }

@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request, "index.html", _view_model())

@app.get("/api/sky")
def api_sky() -> dict[str, Any]:
    vm = _view_model()
    return {
        "assets": vm["assets"],
        "light_years": vm["light_years"],
        "message_count": vm["message_count"],
        "proof_count": vm["proof_count"],
    }

@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}
