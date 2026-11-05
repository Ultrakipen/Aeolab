"""업종별 정보 제공 점검(2026-11-06) — 의료·법률 광고 규제 가드, 업종 묶음, 업종 규칙 조회.

실행으로 확인된 결함(수정 전 동작을 빼면 이 테스트가 실패한다):
- 세무·회계·부동산이 변호사 체크리스트("승소 결과 게시")를, 피부관리실·안경원이 의원 체크리스트("건강보험·비급여")를,
  네일·마사지·스파가 미용실 팁("염색·펌·두피")을 받았다 / 어린이집·스터디카페가 학원 "합격·성과 사례" 팁을 받았다.
- 기타·미등록 업종이 음식점 규칙을 받았고, education·tutoring·music_studio·bar의 전용 규칙은 도달 불가였다.
- "승소율 높음"이 사용자가 고르는 추천 키워드·키워드 사전에 있었다(승소율 표시는 변호사 광고 규정상 금지 유형).
- 의료·법률 생성 프롬프트에 광고 규정 지침이 없었고 결과에서 금지 표현을 거르지 않았다.
"""
import asyncio
import json
import pathlib
import re
from types import SimpleNamespace

import pytest

import services.guide_generator as gg
from services import regulated_industry as ri
from services.category_tips_data import CATEGORY_TIPS, CHECKLIST_BY_CATEGORY, SMARTPLACE_CHECKLIST
from services.industry_prompt_rules import _RULES, build_industry_system_prompt, get_industry_rules
from services.keyword_taxonomy import KEYWORD_TAXONOMY
from routers.schema_gen import TIPS_ALIAS

ROOT = pathlib.Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend"


# ── 1. 업종 판정 ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("cat", ["medical", "clinic", "dental", "oriental_medicine", "hospital", "eye", "checkup",
                                 "치과", "한의원", "병원·의원", "병원"])
def test_medical_group(cat):
    assert ri.regulated_group(cat) == "medical"


@pytest.mark.parametrize("cat", ["legal", "law", "lawyer", "법률사무소", "변호사", "법률"])
def test_legal_group(cat):
    assert ri.regulated_group(cat) == "legal"


@pytest.mark.parametrize("cat", ["pharmacy", "약국", "optics", "skincare", "beauty", "restaurant", "other", "기타",
                                 "accounting", "realestate", "tax", "academy", "", None, 3, "zzz_unknown"])
def test_not_regulated(cat):
    # 약국·안경원·피부관리실·세무·부동산은 이 모듈의 대상이 아니다(근거를 확인하지 못함) — 아무것도 바꾸지 않는다
    assert ri.regulated_group(cat) is None
    assert ri.prompt_note(cat) == ""


# ── 2. 프롬프트 지침 ────────────────────────────────────────────────────────────
def test_prompt_note_contents():
    med = ri.prompt_note("dental")
    assert "의료법 제56조" in med and "치료경험담" in med and "완치" in med
    leg = ri.prompt_note("legal")
    assert "승소율" in leg and "성공사례" in leg


def test_industry_system_prompt_gets_note_only_for_regulated():
    assert "승소율" in build_industry_system_prompt("legal")
    assert "의료법 제56조" in build_industry_system_prompt("medical")
    assert "의료법 제56조" in build_industry_system_prompt("dental")
    for c in ("restaurant", "beauty", "academy", "pharmacy", "accounting", "other"):
        p = build_industry_system_prompt(c)
        assert "의료법 제56조" not in p and "변호사 광고" not in p, c


# ── 3. 결과 정리(scrub) ─────────────────────────────────────────────────────────
def test_scrub_removes_only_prohibited_sentences_medical():
    text = "창원 치과입니다. 임플란트 완치를 약속합니다. 진료시간은 평일 9시부터입니다."
    out, notes = ri.scrub_generated("dental", text)
    assert "완치" not in out and "진료시간은 평일 9시부터입니다." in out and "창원 치과입니다." in out
    assert notes and "1개" in notes[0]


def test_scrub_removes_only_prohibited_sentences_legal():
    text = "이혼 전문 사무소입니다. 승소율 95%를 자랑합니다. 상담은 전화로 예약하세요."
    out, _ = ri.scrub_generated("legal", text)
    assert "승소율" not in out and "상담은 전화로 예약하세요." in out


@pytest.mark.parametrize("ok_text", [
    "야간진료 100% 예약제로 운영합니다.",           # '100%'가 효과 단어와 붙지 않으면 사실 안내
    "최초 방문 시 상담을 진행합니다.",              # '최초'만으로는 최상급이 아니다
    "초기 무료 상담이 가능합니다.",
    "임플란트·교정 진료를 합니다.",
])
def test_scrub_keeps_ordinary_sentences_medical(ok_text):
    out, notes = ri.scrub_generated("dental", ok_text)
    assert out == ok_text and notes == []


@pytest.mark.parametrize("ok_text", [
    "이혼·상속 사건을 다룹니다.",
    "성공보수제로 상담합니다.",                     # 보수 방식 안내는 승소율·성공률 표시가 아니다
    "첫 상담은 무료입니다.",
])
def test_scrub_keeps_ordinary_sentences_legal(ok_text):
    out, notes = ri.scrub_generated("legal", ok_text)
    assert out == ok_text and notes == []


def test_scrub_is_noop_for_other_categories_and_returns_same_object():
    obj = {"smartplace_intro": "완치 100% 승소율 최고의 서비스입니다.", "n": [1, 2]}
    for c in ("restaurant", "beauty", "accounting", "pharmacy", "other", None):
        out, notes = ri.scrub_generated(c, obj)
        assert out is obj and notes == []


def test_scrub_qa_lines_are_dropped_in_pairs():
    text = "소개입니다.\n\nQ. 부작용이 있나요?\nA. 부작용이 전혀 없습니다. 편하게 오세요.\n\nQ. 주차가 되나요?\nA. [건물 주차장]을 이용하세요."
    out, _ = ri.scrub_generated("dental", text)
    assert "부작용" not in out and "편하게 오세요" not in out
    assert "Q. 주차가 되나요?" in out and "A. [건물 주차장]을 이용하세요." in out
    # 답변만 걸려도 질문이 남지 않는다
    t2 = "Q. 효과가 있나요?\nA. 100% 완치됩니다. 상담해 보세요."
    out2, _ = ri.scrub_generated("dental", t2)
    assert "Q. 효과가 있나요?" not in out2 and "상담해 보세요" not in out2


def test_scrub_question_hit_drops_the_clean_answer_too():
    # 질문만 걸리고 답변은 깨끗한 경우 — 짝 잃은 답변("A. 네이버 리뷰를 확인해 주세요.")이 남으면 안 된다
    text = "Q. 치료 후기를 볼 수 있나요?\nA. 네이버 리뷰를 확인해 주세요.\n\nQ. 주차가 되나요?\nA. [주차 정보를 입력하세요]"
    out, _ = ri.scrub_generated("dental", text)
    assert "치료 후기" not in out and "네이버 리뷰를 확인해 주세요" not in out
    assert "Q. 주차가 되나요?" in out and "A. [주차 정보를 입력하세요]" in out


def test_scrub_qa_items_in_json_are_dropped_as_pairs_and_others_kept():
    data = [{"question": "치료 후기를 보여주세요", "answer": "저희가 안내해 드립니다."},
            {"question": "주차가 되나요?", "answer": "[주차 정보를 입력하세요]"}]
    out, notes = ri.scrub_generated("medical", data)
    assert len(out) == 1 and out[0]["question"] == "주차가 되나요?"
    assert notes and "1쌍" in notes[0]
    assert data[0]["question"] == "치료 후기를 보여주세요"          # 원본은 바꾸지 않는다


def test_scrub_blank_field_is_marked_not_silently_emptied():
    out, _ = ri.scrub_generated("legal", {"title": "승소율 1위 로펌"})
    assert out["title"] == ri.BLANK_MARK


# ── 4. 실제 생성 함수: 프롬프트·결과 ────────────────────────────────────────────
def _patch(monkeypatch, reply):
    seen = {}

    async def fake_create(**k):
        seen["prompt"] = k["messages"][0]["content"]
        return SimpleNamespace(content=[SimpleNamespace(text=reply)],
                               usage=SimpleNamespace(input_tokens=1, output_tokens=1))

    monkeypatch.setattr(gg, "_create_message_with_retry", fake_create)
    monkeypatch.setattr(gg, "log_ai_usage", lambda *a, **k: None)
    return seen


DIRTY_INTRO = "창원 치과입니다. 완치를 약속합니다. 평일 9시에 진료합니다. [2026년 11월 기준]"


def test_naver_intro_regulated_gets_note_and_scrub(monkeypatch):
    seen = _patch(monkeypatch, DIRTY_INTRO)
    out = asyncio.run(gg.generate_naver_intro("가나치과", "치과", "창원", ["임플란트"], category="dental"))
    assert "의료법 제56조" in seen["prompt"]
    assert "완치" not in out and "평일 9시에 진료합니다." in out


def test_naver_intro_other_category_is_untouched(monkeypatch):
    seen = _patch(monkeypatch, DIRTY_INTRO)
    out = asyncio.run(gg.generate_naver_intro("가나식당", "음식점", "창원", ["삼겹살"], category="restaurant"))
    assert "의료법 제56조" not in seen["prompt"] and "변호사 광고" not in seen["prompt"]
    assert out == DIRTY_INTRO       # 다른 업종은 결과가 한 글자도 바뀌지 않는다


def test_naver_intro_label_only_is_detected(monkeypatch):
    seen = _patch(monkeypatch, DIRTY_INTRO)
    asyncio.run(gg.generate_naver_intro("가나치과", "치과", "창원", ["임플란트"]))      # category 코드 없이 라벨만
    assert "의료법 제56조" in seen["prompt"]


def test_global_intro_regulated(monkeypatch):
    seen = _patch(monkeypatch, "홍길동 법률사무소입니다. 승소율이 높습니다. 상담은 전화로 합니다. [2026년 11월 기준]")
    out = asyncio.run(gg.generate_global_ai_intro("홍길동", "법률사무소", "창원", ["이혼"], category="legal"))
    assert "승소율" in seen["prompt"]            # 지침에 '쓰지 말 것'으로 들어간다
    assert "승소율이 높습니다" not in out and "상담은 전화로 합니다." in out


def test_smartplace_intro_regulated_scrubs_all_fields(monkeypatch):
    reply = json.dumps({
        "smartplace_intro": "한의원입니다. 만성질환 완치를 보장합니다. 진료시간은 평일입니다.",
        "blog_drafts": [{"template_type": "신규_오픈", "title": "치료 후기 공개", "content": "안내입니다.\n\n환자 치료 후기를 소개합니다.\n\n찾아오시는 길입니다.", "target_keyword": "창원 한의원"}],
    }, ensure_ascii=False)
    seen = _patch(monkeypatch, reply)
    out = asyncio.run(gg.generate_smartplace_intro(
        business_name="가나한의원", category_ko="한의원", region="창원", address=None, phone=None,
        opening_hours=None, menu_items=None, specialty=None, description=None, category="oriental_medicine"))
    assert "의료법 제56조" in seen["prompt"]
    assert "완치" not in out["smartplace_intro"] and "진료시간은 평일입니다." in out["smartplace_intro"]
    assert out["blog_drafts"][0]["title"] == ri.BLANK_MARK
    assert "후기" not in out["blog_drafts"][0]["content"] and "찾아오시는 길입니다." in out["blog_drafts"][0]["content"]


def test_smartplace_intro_non_regulated_is_untouched(monkeypatch):
    payload = {"smartplace_intro": "완치 100% 최고의 서비스입니다.", "blog_drafts": [{"title": "t", "content": "c"}]}
    seen = _patch(monkeypatch, json.dumps(payload, ensure_ascii=False))
    out = asyncio.run(gg.generate_smartplace_intro(
        business_name="가나카페", category_ko="카페", region="창원", address=None, phone=None,
        opening_hours=None, menu_items=None, specialty=None, description=None, category="cafe"))
    assert "의료법 제56조" not in seen["prompt"]
    assert out["smartplace_intro"] == payload["smartplace_intro"]


def test_faq_drafts_regulated(monkeypatch):
    reply = json.dumps([{"question": "치료 효과가 있나요?", "answer": "100% 완치됩니다."},
                        {"question": "예약이 필요한가요?", "answer": "[예약 방법을 입력하세요]"}], ensure_ascii=False)
    seen = _patch(monkeypatch, reply)
    out = asyncio.run(gg.generate_faq_drafts("가나치과", "dental", ["임플란트"], count=2))
    assert "의료법 제56조" in seen["prompt"]
    assert [x["question"] for x in out] == ["예약이 필요한가요?"]


def test_talktalk_faq_regulated(monkeypatch):
    reply = json.dumps({"items": [{"question": "승소율이 어떻게 되나요?", "answer": "높습니다.", "category": "서비스"},
                                  {"question": "상담료가 있나요?", "answer": "[상담료를 입력하세요]", "category": "가격"}],
                        "chat_menus": ["상담 예약"]}, ensure_ascii=False)
    seen = _patch(monkeypatch, reply)
    out = asyncio.run(gg.generate_talktalk_faq("홍길동", "법률사무소", "창원", "이혼", count=2, category="legal"))
    assert "승소율" in seen["prompt"]
    assert [x["question"] for x in out["items"]] == ["상담료가 있나요?"]
    assert out["chat_menus"] == ["상담 예약"]


# ── 5. 업종 규칙 조회 ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("cat", ["other", "기타", "", "zzz_unknown", None])
def test_other_and_unknown_do_not_get_restaurant_rules(cat):
    assert get_industry_rules(cat) is _RULES["other"]


def test_dead_rule_keys_are_reachable_now():
    assert get_industry_rules("education") is _RULES["education"]
    assert get_industry_rules("tutoring") is _RULES["tutoring"]
    assert get_industry_rules("music_studio") is _RULES["music_studio"]
    assert get_industry_rules("bar") is _RULES["bar"]


def test_existing_rule_resolution_is_unchanged():
    assert get_industry_rules("restaurant") is _RULES["restaurant"]
    assert get_industry_rules("한식") is _RULES["restaurant"]
    assert get_industry_rules("medical") is _RULES["clinic"]       # 기존 우선순위(정규화 키) 유지
    assert get_industry_rules("dental") is _RULES["dental"]
    assert get_industry_rules("legal") is _RULES["legal"]
    assert get_industry_rules("accounting") is _RULES["accounting"]
    assert get_industry_rules("cafe") is _RULES["cafe"]


# ── 6. 업종 팁·체크리스트 묶음 ───────────────────────────────────────────────────
def _leaf_categories():
    src = (FRONT / "lib" / "categories.ts").read_text(encoding="utf-8")
    body = src[src.index("export const FLAT_CATEGORY_GROUPS"):src.index("export const FLAT_CATEGORIES")]
    return list(dict.fromkeys(re.findall(r'value:\s*"([a-z_]+)"', body)))


# 팁이 없는 것이 맞는 업종: "기타"는 어떤 업종인지 모르므로 업종 팁을 만들지 않는다(표준 체크리스트만)
_NO_TIPS_OK = {"other"}


def test_every_selectable_category_resolves_to_tips_and_checklist():
    leaves = _leaf_categories()
    assert len(leaves) >= 55          # 파싱이 깨지면 검증이 비어 버린다
    missing = [c for c in leaves if c not in _NO_TIPS_OK
               and (TIPS_ALIAS.get(c, c) not in CATEGORY_TIPS or TIPS_ALIAS.get(c, c) not in CHECKLIST_BY_CATEGORY)]
    assert missing == []


def test_tips_and_checklist_keys_match():
    assert set(CATEGORY_TIPS) == set(CHECKLIST_BY_CATEGORY)


@pytest.mark.parametrize("cat,not_group", [
    ("accounting", "legal"), ("tax", "legal"), ("realestate", "legal"), ("architecture", "legal"),   # 변호사 체크리스트 금지
    ("skincare", "clinic"), ("optics", "clinic"),                                                     # 의원 체크리스트 금지
    ("nail", "beauty"), ("skincare", "beauty"), ("massage", "beauty"), ("spa", "beauty"), ("jjimjil", "beauty"),   # 미용실 팁 금지
    ("childcare", "academy"), ("daycare", "academy"), ("study", "academy"),
])
def test_misgrouped_categories_stay_separated(cat, not_group):
    assert TIPS_ALIAS.get(cat, cat) != not_group


def test_legal_group_is_lawyers_only_and_medical_group_is_medical_only():
    legal_members = {c for c in TIPS_ALIAS if TIPS_ALIAS[c] == "legal"} | {"legal"}
    assert legal_members <= {"legal", "law", "lawyer"}
    clinic_members = {c for c in TIPS_ALIAS if TIPS_ALIAS[c] == "clinic"} | {"clinic"}
    assert clinic_members <= {"clinic", "hospital", "dental", "oriental", "rehab", "checkup", "mental", "eye",
                              "oriental_medicine", "medical"}


def _all_tip_texts():
    for items in CHECKLIST_BY_CATEGORY.values():
        for it in items:
            yield it["item"], it["tip"]
    for tips in CATEGORY_TIPS.values():
        for k, v in tips.items():
            yield k, v
    for it in SMARTPLACE_CHECKLIST:
        yield it["item"], it["tip"]


# 플랫폼이 공개하지 않은 노출 기준·효과를 사실처럼 쓰던 문구(수정 전 25건) — 다시 들어오면 실패
_CAUSAL = re.compile(r"노출 조건|우선 노출|노출됩니다|노출 가능성이? (?:높|매우)|높아집니다|올라갑니다|올립니다|"
                     r"학습합니다|인식합니다|추천하지 않습니다|언급 가능성|신뢰도를 높|신뢰도와 .*높")


def test_tips_do_not_state_unverified_platform_effects():
    bad = [(a, b) for a, b in _all_tip_texts() if _CAUSAL.search(a) or _CAUSAL.search(b)]
    assert bad == []


def test_win_result_wording_only_as_prohibition_and_only_in_legal():
    for group, items in CHECKLIST_BY_CATEGORY.items():
        for it in items:
            for text in (it["item"], it["tip"]):
                if "승소" in text or "성공 사례" in text or "성공사례" in text:
                    assert group == "legal", (group, text)
                    assert re.search(r"쓰지|제외|문제될", text), text
    for group, tips in CATEGORY_TIPS.items():
        for text in tips.values():
            if "승소" in text:
                assert group == "legal" and re.search(r"쓰지|제외|문제될", text), (group, text)


def test_medical_tips_carry_the_regulation_notice():
    assert "의료법 제56조" in CATEGORY_TIPS["clinic"]["blog_tip"]
    assert "변호사 광고 규정" in CATEGORY_TIPS["legal"]["blog_tip"]


# ── 7. 키워드 풀·프론트 문구에 금지 유형이 없다 ───────────────────────────────────
def _strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _strings(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _strings(v)


@pytest.mark.parametrize("key,group", [("legal", "legal"), ("clinic", "medical"), ("dental", "medical"),
                                       ("oriental_medicine", "medical")])
def test_keyword_pools_have_no_prohibited_expression(key, group):
    pool = KEYWORD_TAXONOMY[key]
    bad = [s for s in _strings(pool) if ri.has_regulated_expression(group, s)]
    assert bad == []


def test_legal_pool_no_longer_recommends_win_rate():
    legal = KEYWORD_TAXONOMY["legal"]
    assert not any("승소율" in s for s in _strings(legal))


@pytest.mark.parametrize("rel,forbidden", [
    ("lib/categories.ts", ["승소율 높음"]),
    ("lib/channelGuideData.ts", ["승소 사례 포함", "치료 사례·시설 사진", "성공 사례(익명 처리) 3건"]),
    ("components/dashboard/DualTrackCard.tsx", ["승소 사례 발행", "전문의 직접 진료 Q&A", "합격 사례·원어민", "전문의·진료 과목 소개"]),
    ("components/trial/AIProblemDiagnosis.tsx", ["대부분의 진료에 건강보험이 적용됩니다", "치료 효과 등 편하신"]),
])
def test_frontend_source_has_no_prohibited_phrases(rel, forbidden):
    text = (FRONT / rel).read_text(encoding="utf-8")
    for f in forbidden:
        assert f not in text, f"{rel}: {f}"
