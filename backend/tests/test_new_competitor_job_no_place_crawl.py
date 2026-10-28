"""신규 경쟁사 알림 잡은 네이버 플레이스를 점검하지 않는다 (2026-10-29).

has_faq는 Q&A 탭 폐기 후 항상 False라 경쟁사 FAQ 확인은 결과 없이 접속량만 썼다.
"""
import inspect

from scheduler import jobs


def test_detect_new_competitors_does_not_crawl_place_pages():
    src = inspect.getsource(jobs.detect_new_competitors)
    assert "check_smart_place_completeness" not in src
    assert "has_faq_count" not in src
