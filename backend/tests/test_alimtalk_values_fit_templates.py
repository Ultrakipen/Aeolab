"""알림톡 변수 값이 승인 본문에 자연스럽게, 14자 안에서 들어가는지 (2026-11-01 콘솔 본문 대조).

이전에는 `_grade_change`가 "↑ 보통 → 양호 한 단계 성장!"(18자)을 만들어 안전망이 "…"로 잘랐고(SCORE_01 변화·SCAN_01 추세·DELIVERY_04 등급변화),
같은 등급 안에서 조금 내려가도 "등급 하락"이라 알렸으며, 점수 알림 값에 "· 업종 N위"가 들어가 지역 순위 줄과 중복됐다.
"""
import asyncio

import services.kakao_notify as kn
from services.kakao_notify import _grade, _grade_change, _grade_transition, _template_params

LIMIT = 14


def _capture(monkeypatch):
    got = []

    async def fake_send(self, phone, ttype, params, user_id=None):
        got.append((ttype, params))

    async def fake_delivery(self, phone, template_code, params, log_tag=""):
        got.append((template_code, params))
        return True

    monkeypatch.setattr(kn.KakaoNotifier, "_send", fake_send)
    monkeypatch.setattr(kn.KakaoNotifier, "_send_delivery_template", fake_delivery)
    monkeypatch.setenv("KAKAO_APP_KEY", "dummy")
    monkeypatch.setenv("KAKAO_TEMPLATE_DELIVERY_04", "AEOLAB_DELIVERY_04")
    return got


def test_grade_change_text_always_fits_and_never_claims_grade_change_that_did_not_happen():
    scores = [0, 10, 29.9, 30, 39.9, 40, 55, 59.9, 60, 61, 79.9, 80, 95, 100]
    for a in scores:
        for b in scores:
            t = _grade_change(a, b)
            assert 0 < len(t) <= LIMIT, (a, b, t)
            assert "…" not in t
            if _grade(a) == _grade(b):
                assert "등급 상승" != t and "등급 하락" != t, "등급이 같은데 등급 변화로 말하면 안 된다"
            elif b > a:
                assert t == "등급 상승"
            else:
                assert t == "등급 하락"
    assert _grade_change(65, 62) == "등급 내 하락"      # 둘 다 양호(60 이상)
    assert _grade_change(62, 58) == "등급 하락"          # 양호 → 보통
    assert _grade_change(61, 59) == "등급 하락"      # 양호(60) → 보통
    assert _grade_change(50, 50) == "변동 없음"


def test_grade_transition_shows_both_grades_and_fits():
    for a in (10, 45, 65, 90):
        for b in (10, 45, 65, 90):
            t = _grade_transition(a, b)
            assert 0 < len(t) <= LIMIT, (a, b, t)
    assert _grade_transition(45, 65) == "보통 → 양호"
    assert _grade_transition(10, 90) == "개선 필요 → 우수"
    assert _grade_transition(65, 62) == "등급 내 하락"
    assert _grade_transition(62, 58) == "양호 → 보통"


def test_score_alert_values_have_no_duplicated_rank_and_no_truncation(monkeypatch):
    got = _capture(monkeypatch)
    asyncio.run(kn.KakaoNotifier().send_score_change("01012345678", "홍뮤직스튜디오", 48, 62, 5, 3))
    ttype, params = got[0]
    assert ttype == "score_change"
    for key in ("#{이전점수}", "#{현재점수}", "#{변화}"):
        assert "업종" not in params[key] and "위" not in params[key], f"{key}에 순위가 들어가면 본문의 지역 순위 줄과 중복된다"
    assert params["#{이전점수}"] == "보통" and params["#{현재점수}"] == "양호"
    final = _template_params(params)
    for k, v in params.items():
        assert final[k[2:-1]] == v, f"{k}가 14자 안전망에 잘렸다"
    # 점수 숫자는 어떤 값에도 없어야 한다(점수 표시 원칙)
    assert not any(ch.isdigit() for k in ("#{이전점수}", "#{현재점수}", "#{변화}") for ch in params[k])


def test_scan_complete_trend_and_delivery_rescan_are_not_truncated(monkeypatch):
    got = _capture(monkeypatch)
    n = kn.KakaoNotifier()
    asyncio.run(n.send_scan_complete("01012345678", "가게", 62, "보통", 5.0, "ChatGPT", "스마트플레이스 소개글을 300자 이상으로 보강"))
    asyncio.run(n.send_delivery_rescan("12345678-aaaa", "01012345678", "가게", 48, 62))
    scan = next(p for t, p in got if t == "scan_complete")
    assert scan["#{추세}"] == "등급 상승" and len(scan["#{추세}"]) <= LIMIT
    resc = next(p for t, p in got if t == "AEOLAB_DELIVERY_04")
    assert resc["#{등급변화}"] == "보통 → 양호"
    for p in (scan, resc):
        final = _template_params(p)
        for k, v in p.items():
            assert final[k[2:-1]] == v or len(v) > LIMIT, k   # 이 두 값은 절단되면 안 된다
    assert _template_params({"#{추세}": scan["#{추세}"]})["추세"] == "등급 상승"


def test_scan_complete_is_not_sent_when_no_platform_mention_is_known(monkeypatch):
    """본문의 '#{최다플랫폼}에서 가장 많이 언급됨'은 언급이 없으면 거짓 문장이 된다 — 근거가 없으면 보내지 않는다."""
    got = _capture(monkeypatch)
    n = kn.KakaoNotifier()
    for plat in ("", "없음", "AI 검색", None):
        asyncio.run(n.send_scan_complete("01012345678", "가게", 30, "", 0.0, plat, "x"))
    assert got == [], "언급 플랫폼이 없는데 '가장 많이 언급됨' 알림이 나갔다"
    for plat in ("ChatGPT", "Gemini", "네이버 AI 브리핑"):
        asyncio.run(n.send_scan_complete("01012345678", "가게", 62, "보통", 5.0, plat, "x"))
    sent = [p["#{최다플랫폼}"] for t, p in got if t == "scan_complete"]
    assert sent == ["ChatGPT", "Gemini", "네이버 AI 브리핑"]
