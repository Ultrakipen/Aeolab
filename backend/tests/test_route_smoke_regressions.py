"""서버에서 GET 라우트를 전수 호출(읽기 전용 smoke, 2026-11-01)해 찾은 결함의 재발 방지.

1) GET /api/competitors/{biz_id}: competitors 테이블에 없는 kakao_place_id 컬럼을 select해 항상 DB 오류(42703) → 500
   (스키마 SQL은 이 컬럼을 businesses에만 추가했다. 경쟁사의 카카오 ID를 쓰는 코드는 없다.)
2) GET /api/report/score-explanation/{biz_id}: breakdown의 숫자가 아닌 값('user_group': 'INACTIVE' 등)에 float()를 적용해 모든 스캔에서 500
3) 정기 스캔 후 스캔 완료 알림·갭 카드: breakdown을 그대로 min()해 TypeError — 같은 결함이 세 곳에서 따로 나와 공통 헬퍼로 모음
"""
import pathlib
import re

from services.breakdown_utils import numeric_breakdown_items

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 최근 스캔의 실제 score_breakdown 모양(2026-09-28 홍뮤직스튜디오 행, 값은 일부 축약)
REAL_SHAPE = {
    "missing": ["a", "b"], "blog_crank": 0.0, "schema_seo": 0.0, "user_group": "INACTIVE", "schema_score": 0.0,
    "exposure_freq": 1, "model_version": "v3.1", "track1_detail": {"x": 1}, "review_quality": 11.2,
    "google_presence": 0.0, "local_map_score": 0.0, "online_mentions": 5.0, "ai_briefing_score": 100.0,
    "content_freshness": 50.0, "info_completeness": 65, "keyword_gap_score": 48.3, "multi_ai_exposure": 50.0,
    "kakao_completeness": 0.0, "keyword_search_rank": 0.0, "google_captcha_blocked": False,
    "naver_exposure_confirmed": 100.0, "smart_place_completeness": 60.0,
}


def test_numeric_breakdown_items_keeps_only_scores():
    items = dict(numeric_breakdown_items(REAL_SHAPE))
    for bad in ("missing", "user_group", "model_version", "track1_detail", "google_captcha_blocked"):
        assert bad not in items
    assert items["review_quality"] == 11.2 and items["exposure_freq"] == 1.0 and items["info_completeness"] == 65.0
    assert all(isinstance(v, float) for v in items.values())
    assert numeric_breakdown_items(None) == [] and numeric_breakdown_items({}) == []


def test_allowed_keys_restrict_the_candidates():
    items = numeric_breakdown_items(REAL_SHAPE, allowed={"review_quality", "schema_seo", "user_group", "nope"})
    assert dict(items) == {"review_quality": 11.2, "schema_seo": 0.0}        # 문자열 키는 allowed에 있어도 제외


def test_min_over_real_shape_no_longer_raises():
    lowest = min(numeric_breakdown_items(REAL_SHAPE), key=lambda x: x[1])
    assert lowest[1] == 0.0
    # 옛 코드: 숫자가 아닌 값을 그대로 비교하면 실제로 실패한다
    for broken in (lambda: min(REAL_SHAPE.items(), key=lambda x: x[1]), lambda: sorted(REAL_SHAPE.items(), key=lambda x: float(x[1] or 0))):
        try:
            broken()
        except (TypeError, ValueError):
            continue
        raise AssertionError("옛 방식이 실패하지 않으면 이 테스트의 전제(실제 breakdown 모양)가 틀린 것")


def test_no_raw_numeric_ops_over_breakdown_items():
    """breakdown.items()를 숫자로 가정해 min/sorted/float에 바로 넣는 코드가 없어야 한다(헬퍼를 거쳐야 한다)."""
    pat = re.compile(r"(min|max|sorted)\(\s*_?(bd|breakdown|_bd|top_breakdown)\.items\(\)")
    bad = []
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("tests/", "venv/")) or "_deploy_tmp" in rel or "/venv/" in rel:
            continue
        for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if pat.search(line):
                bad.append(f"{rel}:{i}: {line.strip()[:110]}")
    assert not bad, "점수가 아닌 값이 섞인 breakdown을 숫자로 가정한 코드:\n" + "\n".join(bad)


def test_competitor_queries_do_not_use_the_missing_kakao_place_id_column():
    src = (ROOT / "routers" / "competitor.py").read_text(encoding="utf-8")
    bad = []
    for m in re.finditer(r'table\("competitors"\)', src):
        seg = src[m.start():m.start() + 700].split("await execute(")[0].split("\n\n")[0]
        # select 문자열·update·insert 대상 필드를 담은 구간에서 kakao_place_id가 나오면 안 된다
        window = src[m.start():m.start() + 700]
        sel = re.search(r"\.select\((.*?)\)\s*\n\s*\.", window, re.S)
        if sel and "kakao_place_id" in sel.group(1):
            bad.append(src[:m.start()].count("\n") + 1)
    assert not bad, f"competitors 조회가 없는 컬럼 kakao_place_id를 select한다: 줄 {bad}"
    # update 허용 필드와 insert_data에도 없어야 한다
    assert re.search(r'allowed_fields\s*=\s*\{[^}]*kakao_place_id', src) is None
    assert 'insert_data["kakao_place_id"]' not in src
    assert '_comp_base_fields = (\n        "id, name, address, is_active, created_at, "\n        "naver_place_id, "' in src
