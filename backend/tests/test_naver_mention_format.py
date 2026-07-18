"""
compute_naver_mention_format() / extract_my_blog_id() 테스트 (2026-07-18)

실측 DOM 검증(Playwright로 실제 네이버 검색결과 페이지를 직접 열어 확인)에서
발견한 버그의 재발 방지: 텍스트 소스 목록(fds-aib-multi-source-scroll-area)의
<img>는 전부 블로거 프로필 아바타(16x16, 거의 모든 소스가 항상 보유)였고, 실제
콘텐츠 썸네일은 완전히 별도 DOM 영역(fds-multimedia-container)에 있었음 — 이
둘은 상호배타적이지 않아 같은 글이 텍스트+이미지 양쪽에 동시 인용 가능.

또한 최초 구현은 "업종명이 언급된 브리핑 어딘가에 이미지가 있는가"만 확인해,
내 블로그가 실제 소스가 아닌데도 다른 소스의 이미지 때문에 오판정될 수
있었음 — 반드시 내 blog_id가 source_blog_ids/source_image_map에 실제로
있을 때만 판정해야 함.
"""
from services.ai_scanner.naver_scanner import compute_naver_mention_format, extract_my_blog_id


def test_extract_my_blog_id_basic():
    assert extract_my_blog_id("https://blog.naver.com/kshongeo") == "kshongeo"
    assert extract_my_blog_id("https://blog.naver.com/kshongeo/224304725906") == "kshongeo"
    assert extract_my_blog_id("") is None
    assert extract_my_blog_id("https://tistory.com/somebody") is None


def test_text_only_when_only_in_source_list():
    kw_r = {"source_blog_ids": ["kshongeo", "other"], "source_image_map": {"other": True}}
    assert compute_naver_mention_format("kshongeo", kw_r) == "text"


def test_image_only_when_only_in_multimedia_container():
    """텍스트 소스 목록엔 없지만 이미지 캐러셀에만 있는 경우 — 두 영역이 별개라 가능"""
    kw_r = {"source_blog_ids": ["other"], "source_image_map": {"kshongeo": True}}
    assert compute_naver_mention_format("kshongeo", kw_r) == "image"


def test_text_and_image_when_in_both():
    kw_r = {"source_blog_ids": ["kshongeo"], "source_image_map": {"kshongeo": True}}
    assert compute_naver_mention_format("kshongeo", kw_r) == "text_and_image"


def test_none_when_mentioned_by_name_only_not_actual_source():
    """2026-07-18 발견한 정확한 버그 시나리오: 업종명은 브리핑에 언급됐지만(in_briefing=True는
    호출부에서 별도 처리) 내 블로그는 실제 소스 목록 어디에도 없고, 다른 소스에만 이미지가
    있는 경우 — 수정 전엔 'image'로 오판정됐을 케이스가 지금은 정확히 None이어야 함"""
    kw_r = {"source_blog_ids": ["other1", "other2"], "source_image_map": {"other1": True, "other2": False}}
    assert compute_naver_mention_format("kshongeo", kw_r) is None


def test_none_when_my_blog_id_is_none():
    kw_r = {"source_blog_ids": ["kshongeo"], "source_image_map": {"kshongeo": True}}
    assert compute_naver_mention_format(None, kw_r) is None
