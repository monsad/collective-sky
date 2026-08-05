import httpx
import pytest

from collective_sky.llm import LlmClient, LlmUnavailable

def client_with(handler):
    transport = httpx.MockTransport(handler)
    return LlmClient(
        chat_url="http://model-runner/engines/v1",
        chat_model="ai/qwen3",
        embed_url="http://model-runner/engines/v1",
        embed_model="ai/qwen3-embedding:0.6B-F16",
        transport=transport,
    )

def test_chat_returns_the_assistant_message():
    def handler(request):
        assert request.url.path.endswith("/chat/completions")
        return httpx.Response(200, json={"choices": [{"message": {"content": "the sky is quiet"}}]})

    assert client_with(handler).chat([{"role": "user", "content": "hi"}]) == "the sky is quiet"

def test_chat_sends_the_configured_model():
    seen = {}

    def handler(request):
        import json

        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    client_with(handler).chat([{"role": "user", "content": "hi"}])
    assert seen["model"] == "ai/qwen3"

def test_embed_returns_vectors_in_input_order():
    def handler(request):
        assert request.url.path.endswith("/embeddings")
        return httpx.Response(
            200,
            json={"data": [{"index": 1, "embedding": [0.3, 0.4]}, {"index": 0, "embedding": [0.1, 0.2]}]},
        )

    assert client_with(handler).embed(["a", "b"]) == [[0.1, 0.2], [0.3, 0.4]]

def test_embed_of_nothing_makes_no_request():
    def handler(request):
        raise AssertionError("should not be called")

    assert client_with(handler).embed([]) == []

def test_unavailable_model_raises_a_typed_error():
    def handler(request):
        return httpx.Response(503, text="model runner starting")

    with pytest.raises(LlmUnavailable):
        client_with(handler).chat([{"role": "user", "content": "hi"}])

def test_connection_failure_raises_a_typed_error():
    def handler(request):
        raise httpx.ConnectError("no route to host")

    with pytest.raises(LlmUnavailable):
        client_with(handler).chat([{"role": "user", "content": "hi"}])

def test_malformed_response_raises_a_typed_error():
    def handler(request):
        return httpx.Response(200, json={"unexpected": True})

    with pytest.raises(LlmUnavailable):
        client_with(handler).chat([{"role": "user", "content": "hi"}])
