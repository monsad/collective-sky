import pytest

from collective_sky.llm import LlmUnavailable
from collective_sky.report import build_messages, generate

DIGEST = {
    "window_hours": 24,
    "message_count": 3,
    "proof_count": 2,
    "light_years": 92.4,
    "unknown_targets": 1,
    "top_targets": [{"name": "TRAPPIST-1 e", "count": 2}],
    "top_events": [{"name": "Jupiter", "count": 2}],
    "messages": ["we are here", "hello from Warsaw"],
    "first_observed": "2026-08-05T18:00:00+00:00",
    "last_observed": "2026-08-05T23:00:00+00:00",
}

EMPTY = {
    "window_hours": 24, "message_count": 0, "proof_count": 0, "light_years": 0.0,
    "unknown_targets": 0, "top_targets": [], "top_events": [], "messages": [],
    "first_observed": None, "last_observed": None,
}

class StubClient:
    def __init__(self, reply="A quiet night.", fail=False):
        self.reply, self.fail, self.seen = reply, fail, None

    def chat(self, messages, temperature=0.7):
        if self.fail:
            raise LlmUnavailable("down")
        self.seen = messages
        return self.reply

def test_prompt_carries_every_headline_number():
    text = "\n".join(m["content"] for m in build_messages(DIGEST))
    assert "92.4" in text
    assert "TRAPPIST-1 e" in text
    assert "Jupiter" in text

def test_prompt_includes_the_actual_messages():
    text = "\n".join(m["content"] for m in build_messages(DIGEST))
    assert "we are here" in text

def test_prompt_forbids_inventing_numbers():
    system = build_messages(DIGEST)[0]["content"]
    assert "invent" in system.lower() or "only the facts" in system.lower()

def test_prompt_contains_no_uris():
    text = "\n".join(m["content"] for m in build_messages(DIGEST))
    assert "http" not in text

def test_prompt_marks_user_text_as_untrusted_data():
    text = "\n".join(m["content"] for m in build_messages(DIGEST))
    assert "<message>" in text

def test_generate_returns_the_model_prose():
    assert generate(DIGEST, StubClient("The sky was busy.")) == "The sky was busy."

def test_generate_skips_the_model_entirely_for_an_empty_sky():
    stub = StubClient()
    body = generate(EMPTY, stub)
    assert stub.seen is None
    assert "nothing" in body.lower() or "empty" in body.lower()

def test_generate_propagates_model_unavailability():
    with pytest.raises(LlmUnavailable):
        generate(DIGEST, StubClient(fail=True))

def test_generate_rejects_an_empty_model_reply():
    with pytest.raises(LlmUnavailable):
        generate(DIGEST, StubClient(reply="   "))
