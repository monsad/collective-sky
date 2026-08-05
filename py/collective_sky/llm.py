from __future__ import annotations

import os
from typing import Any

import httpx

class LlmUnavailable(RuntimeError):
    """The model could not be reached or answered unusably."""

class LlmClient:
    def __init__(
        self,
        chat_url: str,
        chat_model: str,
        embed_url: str,
        embed_model: str,
        timeout: float = 120.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.chat_url = chat_url.rstrip("/")
        self.chat_model = chat_model
        self.embed_url = embed_url.rstrip("/")
        self.embed_model = embed_model
        self._client = httpx.Client(timeout=timeout, transport=transport)

    @classmethod
    def from_env(cls) -> "LlmClient":
        base = "http://model-runner.docker.internal/engines/v1"
        return cls(
            chat_url=os.environ.get("CHAT_URL", base),
            chat_model=os.environ.get("CHAT_MODEL", "ai/qwen3"),
            embed_url=os.environ.get("EMBED_URL", base),
            embed_model=os.environ.get("EMBED_MODEL", "ai/qwen3-embedding:0.6B-F16"),
        )

    def chat(self, messages: list[dict[str, str]], temperature: float = 0.7) -> str:
        body = {"model": self.chat_model, "messages": messages, "temperature": temperature}
        data = self._post(f"{self.chat_url}/chat/completions", body)
        try:
            return str(data["choices"][0]["message"]["content"]).strip()
        except (KeyError, IndexError, TypeError) as err:
            raise LlmUnavailable(f"unexpected chat response: {data!r}") from err

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        data = self._post(f"{self.embed_url}/embeddings", {"model": self.embed_model, "input": texts})
        try:
            items = sorted(data["data"], key=lambda d: int(d["index"]))
            return [[float(x) for x in item["embedding"]] for item in items]
        except (KeyError, TypeError, ValueError) as err:
            raise LlmUnavailable(f"unexpected embeddings response: {data!r}") from err

    def _post(self, url: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            response = self._client.post(url, json=body)
        except httpx.HTTPError as err:
            raise LlmUnavailable(f"cannot reach {url}: {err}") from err
        if response.status_code >= 400:
            raise LlmUnavailable(f"{url} returned {response.status_code}: {response.text[:200]}")
        try:
            return response.json()
        except ValueError as err:
            raise LlmUnavailable(f"{url} returned non-JSON") from err
