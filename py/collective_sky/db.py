from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from psycopg import connect
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgres://sky:sky@postgres:5432/collective_sky"
)

def query(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description is None:
                return []
            return list(cur.fetchall())

def execute(sql: str, params: tuple[Any, ...] = ()) -> None:
    with connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()

def recent_assets(window_hours: int) -> list[dict[str, Any]]:
    return query(
        """
        SELECT asset_id, kind, target_name, distance_ly, message, event,
               lat, lon, occurred_at, catalog_hit
        FROM sky_assets
        WHERE occurred_at > now() - make_interval(hours => %s)
        ORDER BY occurred_at DESC
        """,
        (window_hours,),
    )

def all_assets() -> list[dict[str, Any]]:
    return query(
        """
        SELECT asset_id, kind, label, target_name, distance_ly, message, event,
               occurred_at, catalog_hit
        FROM sky_assets
        ORDER BY occurred_at DESC
        """
    )

def chain_last_ok() -> datetime | None:
    rows = query("SELECT v FROM cursor WHERE k = 'last_chain_ok'")
    if not rows:
        return None
    try:
        return datetime.fromisoformat(str(rows[0]["v"]))
    except ValueError:
        return None

def latest_report() -> dict[str, Any] | None:
    rows = query("SELECT body, model, created_at FROM reports ORDER BY id DESC LIMIT 1")
    return rows[0] if rows else None

def save_report(body: str, fact_digest: dict[str, Any], model: str) -> None:
    import json

    execute(
        "INSERT INTO reports (body, fact_digest, model) VALUES (%s, %s, %s)",
        (body, json.dumps(fact_digest, default=str), model),
    )

def latest_themes() -> list[dict[str, Any]]:
    return query(
        """
        SELECT label, size, sample_ids FROM themes
        WHERE computed_at = (SELECT max(computed_at) FROM themes)
        ORDER BY size DESC
        """
    )

def replace_themes(themes: list[dict[str, Any]]) -> None:
    with connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM themes")
            for t in themes:
                cur.execute(
                    "INSERT INTO themes (label, size, sample_ids) VALUES (%s, %s, %s)",
                    (t["label"], t["size"], t["sample_ids"]),
                )
        conn.commit()
