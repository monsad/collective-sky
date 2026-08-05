from __future__ import annotations

import os
import time

from . import db
from .digest import build_digest
from .llm import LlmClient, LlmUnavailable
from .report import generate
from .themes import build_themes

INTERVAL_MS = int(os.environ.get("NARRATE_INTERVAL_MS", "900000"))
WINDOW_HOURS = int(os.environ.get("REPORT_WINDOW_HOURS", "24"))
MIN_MESSAGES = int(os.environ.get("MIN_MESSAGES_FOR_THEMES", "8"))

def run_once(client: LlmClient) -> None:
    rows = db.recent_assets(WINDOW_HOURS)
    digest = build_digest(rows, window_hours=WINDOW_HOURS)

    body = generate(digest, client)
    db.save_report(body, digest, client.chat_model)
    print(f"[narrator] report written ({digest['message_count']}m/{digest['proof_count']}p)")

    messages = [r for r in rows if r["kind"] == "message" and r["message"]]
    themes = build_themes(
        texts=[str(r["message"]) for r in messages],
        asset_ids=[str(r["asset_id"]) for r in messages],
        client=client,
        min_messages=MIN_MESSAGES,
    )
    if themes:
        db.replace_themes(themes)
        print(f"[narrator] {len(themes)} themes")

def main() -> None:
    client = LlmClient.from_env()
    while True:
        try:
            run_once(client)
        except LlmUnavailable as err:
            print(f"[narrator] model unavailable, keeping previous report: {err}")
        except Exception as err:
            print(f"[narrator] cycle failed: {err}")
        time.sleep(INTERVAL_MS / 1000)

if __name__ == "__main__":
    main()
