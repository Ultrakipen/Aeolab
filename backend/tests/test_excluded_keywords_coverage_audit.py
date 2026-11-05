"""업종 키워드 풀(KEYWORD_TAXONOMY)을 쓰는 모듈은 사장님이 '제외'한 키워드를 반영하거나, 사유와 함께 허용 목록에 있어야 한다.

설정 화면의 약속("제외한 키워드는 모든 분석에서 빠집니다")이 한 경로씩 빠지는 일이 반복됐다
(게이지·소개글 연관 키워드, 2026-11-05). 새 모듈이 풀을 쓰면서 제외를 무시하면 이 테스트가 막는다.
허용 목록의 사유는 '왜 제외를 적용하지 않는 것이 맞는지/아직 확인하지 못했는지'를 적는다 — 사유 없이 추가 금지.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
POOL_USE = re.compile(r"KEYWORD_TAXONOMY|get_industry_keywords|get_all_keywords_flat|analyze_keyword_coverage")
HONORS = re.compile(r"excluded|drop_excluded|resolve_effective_keywords|get_user_keyword_prefs")

# 제외를 읽지 않아도 되는(또는 아직 판단 보류한) 모듈 — 경로: 사유
ALLOWED_WITHOUT_EXCLUSION = {
    "services/keyword_taxonomy.py": "풀 정의 자체(제외는 analyze_keyword_coverage 인자로 받는다)",
    "services/competitor_place_crawler.py": "경쟁사가 가진 키워드(사실 정보). 사업장 간 공유 크롤 저장이라 저장 시점에 거르면 다른 사업장 데이터가 훼손된다. 내 부족 키워드는 gap_analyzer가 제외 반영",
    "services/naver_datalab.py": "업종 시장 검색 추세(시장 정보) — 내 추천이 아니다",
    "services/schema_generator.py": "사업장 문맥(business_id) 없이 입력 카테고리만 받는 소개글 점수 도구 — 제외 설정을 알 수 없다",
    "services/briefing_engine.py": "AI탭 미리보기 — 화면 노출 여부 미확인(2026-11-05). 확인 후 판단",
    "services/score_engine.py": "점수 폴백 경로 — 점수 기준을 바꾸면 과거 점수와의 비교가 흔들린다. 메인 경로(scan.py)가 제외를 반영하는지는 별도 확인 필요(미확인)",
}


def _rel(p: pathlib.Path) -> str:
    return p.relative_to(ROOT).as_posix()


def _sources():
    for sub in ("services", "routers"):
        for p in sorted((ROOT / sub).rglob("*.py")):
            if "ai_scanner_deploy_tmp" in p.parts:
                continue
            yield p


def test_every_pool_user_honors_exclusions_or_is_allowlisted_with_reason():
    offenders = []
    for p in _sources():
        text = p.read_text(encoding="utf-8")
        if POOL_USE.search(text) and not HONORS.search(text) and _rel(p) not in ALLOWED_WITHOUT_EXCLUSION:
            offenders.append(_rel(p))
    assert not offenders, f"업종 키워드 풀을 쓰면서 제외 키워드를 반영하지 않는 모듈(반영하거나 사유와 함께 허용 목록에 추가): {offenders}"


def test_allowlist_has_reasons_and_no_stale_entries():
    for path, reason in ALLOWED_WITHOUT_EXCLUSION.items():
        assert reason.strip(), f"{path}: 사유가 비어 있다"
        f = ROOT / path
        assert f.exists(), f"{path}: 존재하지 않는 허용 항목(정리 필요)"
        assert POOL_USE.search(f.read_text(encoding="utf-8")), f"{path}: 더 이상 키워드 풀을 쓰지 않는다(허용 항목 제거)"
