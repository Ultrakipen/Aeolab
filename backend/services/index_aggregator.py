"""
index_aggregator.py — 공개 인덱스 리포트용 분기 집계 서비스

index_snapshots 테이블에 익명화된 통계를 UPSERT한다.
개인 식별 정보(business_id, user_id, name)는 일절 포함하지 않는다.
"""

import logging
import asyncio
from collections import Counter
from statistics import quantiles, mean

_logger = logging.getLogger(__name__)

# 최소 sample 임계값 — 미달 시 공개하지 않음
MIN_SAMPLE_COUNT = 5

# 분기 → 월 범위 매핑
_QUARTER_MONTHS = {
    "Q1": (1, 3),
    "Q2": (4, 6),
    "Q3": (7, 9),
    "Q4": (10, 12),
}

# 집계 대상 플랫폼 result 컬럼명
_PLATFORM_COLUMNS = [
    "gemini_result",
    "naver_result",
    "chatgpt_result",
    "perplexity_result",
    "grok_result",
    "claude_result",
    "google_result",
]


def get_quarter_date_range(quarter: str) -> tuple[str, str]:
    """
    '2026-Q2' → ('2026-04-01', '2026-06-30')

    Args:
        quarter: 'YYYY-QN' 형식 (예: '2026-Q1')
    Returns:
        (start_date, end_date) ISO 날짜 문자열 튜플
    Raises:
        ValueError: 형식이 잘못된 경우
    """
    try:
        year_str, q_str = quarter.split("-")
        year = int(year_str)
        q_str = q_str.upper()
    except (ValueError, AttributeError):
        raise ValueError(f"quarter 형식 오류: '{quarter}'. 예시: '2026-Q2'")

    if q_str not in _QUARTER_MONTHS:
        raise ValueError(f"분기 코드 오류: '{q_str}'. Q1~Q4 중 하나여야 합니다.")

    start_month, end_month = _QUARTER_MONTHS[q_str]

    # 분기 마지막 달의 마지막 날 계산
    import calendar
    last_day = calendar.monthrange(year, end_month)[1]

    start_date = f"{year:04d}-{start_month:02d}-01"
    end_date   = f"{year:04d}-{end_month:02d}-{last_day:02d}"
    return start_date, end_date


def _extract_platform_stats(scan_rows: list[dict]) -> dict:
    """
    scan_results 행 목록에서 플랫폼별 mentioned=True 비율 계산.
    각 result JSONB에 'mentioned' 키가 있다고 가정한다.
    """
    stats: dict[str, dict] = {}
    for col in _PLATFORM_COLUMNS:
        platform = col.replace("_result", "")
        total = 0
        mentioned = 0
        for row in scan_rows:
            result = row.get(col)
            if not isinstance(result, dict):
                continue
            total += 1
            if result.get("mentioned") is True:
                mentioned += 1
        if total > 0:
            stats[platform] = {
                "total": total,
                "mentioned": mentioned,
                "rate": round(mentioned / total, 4),
            }
    return stats


def _extract_top_keywords(citation_rows: list[dict], top_n: int = 10) -> list[str]:
    """
    ai_citations 행의 excerpt 텍스트에서 단어 빈도 상위 N개 추출.
    2글자 이상 단어만 집계 (조사·접속사 필터 효과).
    """
    counter: Counter = Counter()
    for row in citation_rows:
        excerpt = row.get("excerpt") or ""
        if not isinstance(excerpt, str):
            continue
        for word in excerpt.split():
            word = word.strip(".,!?;:\"'()")
            if len(word) >= 2:
                counter[word] += 1
    return [word for word, _ in counter.most_common(top_n)]


def _compute_growth_dist(rows: list[dict], col: str = "growth_stage") -> dict:
    """
    rows 내 growth_stage 컬럼 분포 계산.
    반환 예: {"survival": 0.40, "stable": 0.35, "growth": 0.20, "dominant": 0.05}
    """
    stages = ["survival", "stable", "growth", "dominant"]
    counter: Counter = Counter()
    for row in rows:
        stage = row.get(col)
        if stage in stages:
            counter[stage] += 1
    total = sum(counter.values())
    if total == 0:
        return {s: 0.0 for s in stages}
    return {s: round(counter[s] / total, 4) for s in stages}


def _safe_percentiles(values: list[float], percents: list[int]) -> dict[str, float]:
    """
    statistics.quantiles 래퍼. 데이터 부족 시 안전하게 처리.
    percents: [25, 50, 75, 90]
    """
    result: dict[str, float] = {}
    n = len(values)
    if n < 4:
        # 데이터가 너무 적으면 단순 min/max/mean 처리
        for p in percents:
            result[f"p{p}"] = round(mean(values) if values else 0.0, 2)
        return result

    sorted_vals = sorted(values)

    for p in percents:
        # 직접 백분위 계산 (0~100 스케일)
        idx_f = (p / 100) * (n - 1)
        idx_lo = int(idx_f)
        idx_hi = min(idx_lo + 1, n - 1)
        frac = idx_f - idx_lo
        val = sorted_vals[idx_lo] * (1 - frac) + sorted_vals[idx_hi] * frac
        result[f"p{p}"] = round(val, 2)

    return result


async def compute_quarter_snapshot(
    supabase,
    quarter: str,
    category: str,
    region: str | None,
) -> dict | None:
    """
    scan_results + score_history에서 해당 분기 데이터를 집계.

    익명화: business_id/user_id/name 미포함, 통계 수치만 반환.
    sample_count < MIN_SAMPLE_COUNT 시 None 반환 (미공개 처리).

    Args:
        supabase: Supabase 클라이언트
        quarter:  '2026-Q2' 형식
        category: 업종 (예: 'restaurant')
        region:   지역 (None이면 전국 집계)
    Returns:
        집계 dict 또는 None (샘플 부족 시)
    """
    try:
        start_date, end_date = get_quarter_date_range(quarter)
    except ValueError as e:
        _logger.warning(f"[index_aggregator] 잘못된 quarter 형식: {e}")
        return None

    try:
        # 1. 해당 업종·지역의 활성 사업장 ID 목록 수집
        biz_query = (
            supabase.table("businesses")
            .select("id")
            .eq("category", category)
            .eq("is_active", True)
        )
        if region:
            biz_query = biz_query.ilike("region", f"{region}%")

        biz_rows = await asyncio.to_thread(lambda: biz_query.execute().data)
        if not biz_rows:
            return None

        biz_ids = [r["id"] for r in biz_rows]

        # sample_count 사전 체크 (DB 조회 전 guard)
        if len(biz_ids) < MIN_SAMPLE_COUNT:
            _logger.debug(
                f"[index_aggregator] 샘플 부족 skip: {category}/{region} "
                f"biz_count={len(biz_ids)}"
            )
            return None

        # 2. score_history 분기 범위 조회 (점수·growth_stage)
        history_rows = await asyncio.to_thread(
            lambda: (
                supabase.table("score_history")
                .select("business_id, unified_score, track1_score, track2_score, growth_stage")
                .in_("business_id", biz_ids)
                .gte("score_date", start_date)
                .lte("score_date", end_date)
                .execute()
                .data
            )
        )

        # 고유 business_id 기준 sample_count 산정
        sampled_biz_ids = {r["business_id"] for r in history_rows if r.get("business_id")}
        sample_count = len(sampled_biz_ids)

        if sample_count < MIN_SAMPLE_COUNT:
            _logger.debug(
                f"[index_aggregator] 점수 샘플 부족 skip: {category}/{region} "
                f"sample_count={sample_count}"
            )
            return None

        # 3. 점수 통계 계산
        unified_vals = [
            float(r["unified_score"])
            for r in history_rows
            if r.get("unified_score") is not None
        ]
        track1_vals = [
            float(r["track1_score"])
            for r in history_rows
            if r.get("track1_score") is not None
        ]
        track2_vals = [
            float(r["track2_score"])
            for r in history_rows
            if r.get("track2_score") is not None
        ]

        avg_unified = round(mean(unified_vals), 2) if unified_vals else 0.0
        avg_track1  = round(mean(track1_vals), 2)  if track1_vals  else 0.0
        avg_track2  = round(mean(track2_vals), 2)  if track2_vals  else 0.0

        pctiles = _safe_percentiles(unified_vals, [25, 50, 75, 90])

        # 4. growth_stage 분포
        growth_dist = _compute_growth_dist(history_rows)

        # 5. scan_results 조회 (플랫폼 통계용)
        scan_rows = await asyncio.to_thread(
            lambda: (
                supabase.table("scan_results")
                .select(
                    "business_id, "
                    + ", ".join(_PLATFORM_COLUMNS)
                )
                .in_("business_id", biz_ids)
                .gte("scanned_at", start_date)
                .lte("scanned_at", end_date)
                .execute()
                .data
            )
        )

        platform_stats = _extract_platform_stats(scan_rows)

        # 6. ai_citations에서 키워드 추출
        citation_rows = await asyncio.to_thread(
            lambda: (
                supabase.table("ai_citations")
                .select("excerpt")
                .in_("business_id", biz_ids)
                .eq("mentioned", True)
                .gte("created_at", start_date)
                .lte("created_at", end_date)
                .limit(2000)  # 메모리 안전 상한
                .execute()
                .data
            )
        )

        top_keywords = _extract_top_keywords(citation_rows, top_n=10)

        snapshot = {
            "quarter":       quarter,
            "category":      category,
            "region":        region or "all",
            "sample_count":  sample_count,
            "avg_unified":   avg_unified,
            "avg_track1":    avg_track1,
            "avg_track2":    avg_track2,
            "p25_unified":   pctiles.get("p25", 0.0),
            "p50_unified":   pctiles.get("p50", 0.0),
            "p75_unified":   pctiles.get("p75", 0.0),
            "p90_unified":   pctiles.get("p90", 0.0),
            "top_keywords":  top_keywords,
            "platform_stats": platform_stats,
            "growth_dist":   growth_dist,
        }

        _logger.info(
            f"[index_aggregator] 집계 완료: {category}/{region or 'all'} "
            f"quarter={quarter} sample={sample_count}"
        )
        return snapshot

    except Exception as e:
        _logger.warning(
            f"[index_aggregator] compute_quarter_snapshot 오류 "
            f"({category}/{region}, {quarter}): {e}"
        )
        return None


async def run_full_index_aggregation(supabase, quarter: str) -> dict:
    """
    모든 category × region 조합에 대해 compute_quarter_snapshot 실행.
    결과를 index_snapshots 테이블에 UPSERT.

    Args:
        supabase: Supabase 클라이언트
        quarter:  '2026-Q1' 형식
    Returns:
        {'computed': N, 'skipped_low_sample': M}
    """
    computed = 0
    skipped  = 0

    try:
        # 집계 대상 category × region 조합 수집
        biz_rows = await asyncio.to_thread(
            lambda: (
                supabase.table("businesses")
                .select("category, region")
                .eq("is_active", True)
                .execute()
                .data
            )
        )

        # 중복 제거: (category, region) 쌍 집합
        combos: set[tuple[str, str | None]] = set()
        categories: set[str] = set()
        for row in biz_rows:
            cat = row.get("category")
            reg = row.get("region")
            if cat:
                combos.add((cat, reg))
                categories.add(cat)

        # 전국 집계 조합 추가 (region=None)
        for cat in categories:
            combos.add((cat, None))

        _logger.info(
            f"[index_aggregator] 집계 시작: quarter={quarter}, "
            f"조합 수={len(combos)}"
        )

        for category, region in combos:
            snapshot = await compute_quarter_snapshot(
                supabase, quarter, category, region
            )
            if snapshot is None:
                skipped += 1
                continue

            # index_snapshots 테이블에 UPSERT
            try:
                await asyncio.to_thread(
                    lambda s=snapshot: (
                        supabase.table("index_snapshots")
                        .upsert(
                            s,
                            on_conflict="quarter,category,region",
                        )
                        .execute()
                    )
                )
                computed += 1
            except Exception as upsert_err:
                _logger.warning(
                    f"[index_aggregator] UPSERT 실패 "
                    f"({category}/{region}, {quarter}): {upsert_err}"
                )
                skipped += 1

        _logger.info(
            f"[index_aggregator] 집계 완료: quarter={quarter} "
            f"computed={computed}, skipped={skipped}"
        )

    except Exception as e:
        _logger.error(f"[index_aggregator] run_full_index_aggregation 실패: {e}")

    return {"computed": computed, "skipped_low_sample": skipped}
