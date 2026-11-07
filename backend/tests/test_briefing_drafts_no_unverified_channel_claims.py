"""사장님이 복사해 게시하는 초안 템플릿이 확인되지 않은 영업 사실을 단정하지 않는다 (2026-11-07).

소식·소개글·블로그·카페·지식인 초안이 "네이버 예약으로 원하는 시간 직접 선택 가능", "전화·카카오톡 문의 환영" 같은 문장을
입력 데이터 없이 고정으로 넣고 있었다(작업 지침 7번: 가격·시설·예약 등 사실 지어내기 금지). 네이버 예약을 쓰지 않는 가게가 그대로 게시하면 허위가 된다.
예약 보유 여부를 알려 주는 입력(businesses 컬럼)이 없어서 문장 자체를 넣지 않는다.
"""
import pytest

from services import briefing_engine as be

FORBIDDEN = ("네이버 예약", "카카오톡", "전화·", "전화로", "■ 이용 안내", "이용 안내:")
CATEGORIES = ["restaurant", "cafe", "beauty", "legal", "medical", "academy", "fitness", "realestate"]


def _texts_post(cat):
    outs = [be._make_post_content([], "한결식당", cat, "경상남도 창원시 성산구")]
    outs.append(be._make_post_content(["창원 맛집", "성산구 점심"], "한결식당", cat, "경상남도 창원시 성산구"))
    return outs


def _texts_intro(cat):
    return [be._make_intro_content(["창원 맛집"], "한결식당", cat, "경상남도 창원시 성산구", ["점심 특선"]),
            be._make_intro_content([], "한결식당", cat, "경상남도 창원시 성산구", [])]


def _texts_blog(cat):
    d = be._make_list_content_draft("한결식당", "경상남도 창원시 성산구", cat, ["창원 맛집", "점심"])
    return [str(v) for v in d.values()]


def _texts_community(cat):
    d = be._make_community_drafts("한결식당", "경상남도 창원시 성산구", cat, ["창원 맛집", "점심"])
    return [str(v) for v in d.values()]


@pytest.mark.parametrize("cat", CATEGORIES)
@pytest.mark.parametrize("maker", [_texts_post, _texts_intro, _texts_blog, _texts_community])
def test_generated_drafts_do_not_assert_reservation_or_contact_channels(maker, cat):
    for text in maker(cat):
        assert text.strip(), f"{maker.__name__}/{cat}: 빈 초안"
        hit = [w for w in FORBIDDEN if w in text]
        assert not hit, f"{maker.__name__}/{cat}: 확인되지 않은 채널 단정 {hit}\n{text[:300]}"


def test_drafts_are_still_well_formed_after_removal():
    t = be._make_post_content(["창원 맛집"], "한결식당", "restaurant", "경상남도 창원시 성산구")
    assert "한결식당" in t and "#" in t                  # 본문과 해시태그는 그대로
    t0 = be._make_post_content([], "한결식당", "restaurant", "경상남도 창원시 성산구")
    assert "한결식당" in t0 and t0.rstrip().splitlines()[-1].startswith("#")   # 해시태그 줄로 끝난다
    intro = be._make_intro_content(["창원 맛집"], "한결식당", "restaurant", "경상남도 창원시 성산구", ["점심 특선"])
    assert intro.rstrip().endswith("추천드립니다.")
    jisikin = be._make_community_drafts("한결식당", "경상남도 창원시 성산구", "restaurant", ["창원 맛집", "점심"])["jiskin_text"] if "jiskin_text" in be._make_community_drafts("한결식당", "경상남도 창원시 성산구", "restaurant", ["창원 맛집", "점심"]) else ""
    if jisikin:
        assert jisikin.rstrip().endswith("접근하기 편합니다.")


POST_CATEGORIES = ["legal", "realestate", "medical", "clinic", "dental", "pharmacy", "interior", "auto", "cleaning", "education",
                   "tutoring", "academy", "accommodation", "beauty", "nail", "fitness", "yoga", "pilates", "pet", "restaurant", "cafe", "unknown_cat"]


@pytest.mark.parametrize("cat", POST_CATEGORIES)
def test_post_closing_line_does_not_assert_free_offers_or_trials(cat):
    """소식 초안 마지막 문장(_FALLBACK_CTA)이 '무료 체험 수업 신청'·'무료 견적' 같은 확인되지 않은 혜택을 단정하지 않는다 (2026-11-07)."""
    for kw in ([], ["창원 학원", "성산구 수업"]):
        t = be._make_post_content(kw, "한결상점", cat, "경상남도 창원시 성산구")
        hit = [w for w in ("무료", "체험", "체험권", "할인", "이벤트") if w in t]
        assert not hit, f"{cat}: 확인되지 않은 혜택 단정 {hit}\n{t[:300]}"
