"""gpt-4.1-mini → gpt-6-luna 교체 회귀 테스트 (2026-11-01).

근거: docs/openai_model_migration_eval_2026_11_01.md.
핵심 위험 3가지를 막는다 — ①추론을 끄지 않아 출력 토큰·비용이 5배가 되는 것, ②새 계열이 거부하는 옛 파라미터(max_tokens/temperature),
③가게명 자리에 설명 문장이 들어오는 것, ④모델이 바뀐 측정끼리 경쟁사 변화로 비교되는 것.
"""
import asyncio
import os
import pathlib
import re

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services import competitor_ai_exposure as cae  # noqa: E402
from services.ai_scanner import chatgpt_scanner as cs  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def test_default_model_is_luna_with_reasoning_off():
    assert cs.CHATGPT_MODEL == "gpt-6-luna"
    kw = cs.completion_kwargs(160)
    assert kw["model"] == "gpt-6-luna"
    assert kw["extra_body"] == {"reasoning_effort": "none"}   # 이게 빠지면 출력 토큰이 5~6배
    assert "max_tokens" not in kw and "temperature" not in kw   # 새 계열이 거부하는 옛 파라미터
    assert kw["max_completion_tokens"] >= 160


@pytest.mark.parametrize("model", ["gpt-6-luna", "gpt-5.6-luna", "gpt-5.4-mini"])
def test_every_new_family_model_gets_reasoning_off(model):
    kw = cs.completion_kwargs(200, model=model)
    assert kw["extra_body"]["reasoning_effort"] == "none" and "max_tokens" not in kw


def test_legacy_model_keeps_old_parameters_for_rollback():
    kw = cs.completion_kwargs(160, model="gpt-4.1-mini")
    assert kw == {"model": "gpt-4.1-mini", "temperature": 1.0, "max_tokens": 160}


class _FakeCompletions:
    def __init__(self, text):
        self.calls = []
        self._text = text

    async def create(self, **kw):
        self.calls.append(kw)
        msg = type("M", (), {"content": self._text})()
        usage = type("U", (), {"prompt_tokens": 88, "completion_tokens": 45, "completion_tokens_details": None})()
        return type("R", (), {"choices": [type("C", (), {"message": msg})()], "usage": usage})()


def _scanner_with(text, monkeypatch):
    sc = cs.ChatGPTScanner()
    fake = _FakeCompletions(text)
    sc.client = type("Cl", (), {"chat": type("Ch", (), {"completions": fake})()})()
    monkeypatch.setattr(sc, "_log_usage", lambda *a, **k: None)
    monkeypatch.setattr(sc, "_log_failure", lambda *a, **k: None)
    return sc, fake


@pytest.mark.parametrize("method,args", [("_recommend_once", ("q",)), ("_check", ("q", "t")), ("check_citation", ("q", "t"))])
def test_all_call_sites_send_the_migration_parameters(monkeypatch, method, args):
    sc, fake = _scanner_with('{"places": ["A"], "mentioned": false}', monkeypatch)
    _run(getattr(sc, method)(*args))
    assert fake.calls, method
    kw = fake.calls[0]
    assert kw["model"] == cs.CHATGPT_MODEL
    assert kw["extra_body"] == {"reasoning_effort": "none"}
    assert "max_tokens" not in kw and "temperature" not in kw


def test_sentence_shaped_names_are_dropped(monkeypatch):
    text = '{"places": ["창원 편곡 관련 실제 가게를 확인할 수 없어 빈 배열로 답합니다.", "명동교자", "진옥화할매원조닭한마리"]}'
    sc, _ = _scanner_with(text, monkeypatch)
    r = _run(sc._recommend_once("q"))
    assert r["places"] == ["명동교자", "진옥화할매원조닭한마리"] and r["_measured"] is True


@pytest.mark.parametrize("bad", ["", "   ", "x" * 41, "가 나 다 라 마 바 사", "모르겠습니다.", "추천드릴 수 있는 가게를 알 수 없습니다"])
def test_implausible_names_rejected(bad):
    assert cs.is_plausible_place_name(bad) is False


@pytest.mark.parametrize("good", ["명동교자", "스타벅스 강남역점", "카페 온화", "A&B 베이커리", "만석닭강정 본점"])
def test_normal_names_accepted(good):
    assert cs.is_plausible_place_name(good) is True


def test_empty_list_is_a_measured_answer_not_a_failure(monkeypatch):
    sc, _ = _scanner_with('{"places": []}', monkeypatch)
    r = _run(sc._recommend_once("q"))
    assert r == {"places": [], "_measured": True}   # '모르면 빈 배열'은 정상 응답 — 실패(분모 제외)로 세지 않는다


def test_result_records_the_model(monkeypatch):
    sc = cs.ChatGPTScanner()

    async def fake_once(q):
        return {"places": ["내가게"], "_measured": True}

    async def no_sleep(_):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = _run(sc.sample_recommend("q", "내가게", n=3))
    assert r["model"] == cs.CHATGPT_MODEL


def test_competitor_basis_changes_when_chatgpt_model_changes():
    old = {"ai_basis": "recommend_v1", "ai_source": "chatgpt"}                      # 모델 기록 전 = gpt-4.1-mini
    new = {"ai_basis": "recommend_v1", "ai_source": "chatgpt", "ai_model": "gpt-6-luna"}
    assert cae.basis_changed(new, old) is True
    assert cae.basis_changed(new, dict(new)) is False
    assert cae.basis_changed({"ai_basis": "recommend_v1", "ai_source": "gemini"}, {"ai_basis": "recommend_v1", "ai_source": "gemini"}) is False
    assert cae.basis_changed(old, {"ai_basis": "recommend_v1", "ai_source": "chatgpt", "ai_model": "gpt-4.1-mini"}) is False


def test_competitor_exposure_passes_the_model_through():
    res = {"probe": "recommend_v1", "sample_size": 10, "model": "gpt-6-luna",
           "place_counts": [{"name": "경쟁사A", "count": 4}]}
    exp = cae.competitor_exposure("경쟁사A", None, res)
    assert exp["_measured"] is True and exp["model"] == "gpt-6-luna"
    assert cae.score_fields(exp)["ai_model"] == "gpt-6-luna"


def test_rest_payload_matches_sdk_settings():
    from services.ai_search_screenshot import _chat_payload
    body = _chat_payload("질문")
    assert body["model"] == cs.CHATGPT_MODEL and body["reasoning_effort"] == "none"
    assert "max_tokens" not in body and "temperature" not in body and body["max_completion_tokens"] >= 200


def test_no_hardcoded_legacy_model_in_call_sites():
    """호출부에 모델명을 직접 쓰면 이번 같은 교체가 또 일부만 적용된다 — 모델명은 CHATGPT_MODEL 한 곳에서만."""
    root = pathlib.Path(__file__).resolve().parents[1]
    pat = re.compile(r"""model["']?\s*[=:]\s*["']gpt-4\.1-mini["']""")
    offenders = []
    for sub in ("services", "routers", "scheduler"):
        for f in (root / sub).rglob("*.py"):
            for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if pat.search(line) and not line.lstrip().startswith("#"):
                    offenders.append(f"{f.relative_to(root)}:{i}")
    assert not offenders, offenders


def test_usage_price_table_knows_the_new_model():
    from services.ai_usage_logger import _estimate_cost_krw
    assert _estimate_cost_krw("chatgpt", "gpt-6-luna", 1_000_000, 1_000_000) == round((0.10 + 0.50) * 1400, 4)
