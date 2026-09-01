"""
창업 패키지 리포트 서비스
업종·지역 경쟁 강도 분석 + 진입 전략 가이드 (Claude Sonnet)
"""
import logging
import os
import anthropic
from db.supabase_client import get_client, execute
from utils.region_match import region_matches
from services.ai_usage_logger import log_ai_usage

logger = logging.getLogger(__name__)

# AsyncAnthropic 클라이언트 재사용 — StartupReportService가 요청마다 새로
# 인스턴스화되면서(startup.py:59) 매번 클라이언트도 새로 만들어 커넥션 재사용을
# 못했음. 모듈 레벨 싱글턴으로 전환(2026-07-15).
_ai_client: anthropic.AsyncAnthropic | None = None


def _get_ai_client() -> anthropic.AsyncAnthropic:
    global _ai_client
    if _ai_client is None:
        _ai_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _ai_client


class StartupReportService:
    def __init__(self):
        self.client = _get_ai_client()

    async def generate(self, category: str, region: str, business_name: str = "", compare_region: str = "") -> dict:
        """창업 패키지 리포트 생성"""
        supabase = get_client()

        # 해당 업종 기존 사업장 조회 — region은 자유 입력이라 category만 DB에서 필터하고
        # region_matches()로 표기 차이(서울 강남/강남구 등)를 흡수 (get_market_overview/
        # get_timing_index와 동일 기준 공유, startup.py 참조)
        biz_res = await execute(
            supabase.table("businesses")
            .select("id, name, region")
            .eq("category", category)
            .eq("is_active", True)
        )
        businesses = [
            b for b in (biz_res.data or [])
            if region_matches(b.get("region") or "", region)
        ]
        competitor_count = len(businesses)

        avg_score = 0.0
        top_competitors = []
        scores: list[float] = []

        if businesses:
            # competitor_count가 전체 모집단을 기준으로 표시되므로 평균도 동일 모집단으로
            # 계산해야 함 — 앞 N개만 샘플링하면 "N개 중 평균"인데 "전체 평균"인 것처럼 보임
            biz_ids = [b["id"] for b in businesses]
            biz_name_map = {b["id"]: b["name"] for b in businesses}

            # N+1 제거 — 단일 IN 쿼리로 최신 스캔 일괄 조회
            scans_res = await execute(
                supabase.table("scan_results")
                .select("business_id, total_score, exposure_freq, scanned_at")
                .in_("business_id", biz_ids)
                .order("scanned_at", desc=True)
            )
            seen: dict = {}
            for s in (scans_res.data or []):
                bid = s.get("business_id")
                if bid not in seen and s.get("total_score") is not None:
                    seen[bid] = s

            for bid, s in seen.items():
                scores.append(s["total_score"])
                top_competitors.append({
                    "name": biz_name_map.get(bid, ""),
                    "score": s["total_score"],
                    "exposure_freq": s.get("exposure_freq") or 0,
                })

            if scores:
                avg_score = round(sum(scores) / len(scores), 1)
            top_competitors.sort(key=lambda x: x["score"], reverse=True)

        # 경쟁 강도 등급 (낮을수록 진입 유리)
        # 등록 사업장이 0건 = "데이터 없음"이지 "기회 있음"이 아님 — /market, /timing과 동일
        # 기준 적용(2026-07-15 발견: 이 분기가 없어 count=0일 때 else로 떨어져 "기회 있음"
        # 녹색 라벨이 표시되고, 같은 리포트의 timing 섹션은 "데이터 수집 중"이라 자기모순 발생)
        no_business_data = not businesses
        # 등록 사업장은 있으나 전부 미스캔(scores 비어있음) = "데이터 없음"이지 "기회 있음"이 아님 — 혼동 금지
        no_scan_data = bool(businesses) and not scores
        if no_business_data:
            competition_level = "데이터 수집 중"
            level_color = "gray"
            level_score = 0
        elif no_scan_data:
            competition_level = "측정 데이터 부족"
            level_color = "gray"
            level_score = 0
        elif avg_score >= 70:
            competition_level = "매우 치열"
            level_color = "red"
            level_score = 1
        elif avg_score >= 55:
            competition_level = "치열"
            level_color = "orange"
            level_score = 2
        elif avg_score >= 40:
            competition_level = "보통"
            level_color = "yellow"
            level_score = 3
        else:
            competition_level = "기회 있음"
            level_color = "green"
            level_score = 4

        # 네이버 DataLab 실측 검색 트렌드 조회 (graceful — 실패해도 리포트 전체 중단 안 함)
        search_trend: dict = {}
        try:
            from services.naver_datalab import get_datalab_client
            dl_client = get_datalab_client()
            search_trend = await dl_client.get_trend_with_cache(category, region, supabase)
            if search_trend.get("error"):
                logger.warning(f"startup DataLab 트렌드 오류 응답: {search_trend.get('error')}")
                search_trend = {}
        except Exception as _e:
            logger.warning(f"startup DataLab 조회 실패 (graceful): {_e}")

        # 실제 시장 밀도(카카오 total_count 기준) — AEOlab 가입 사업장 수(competitor_count)와
        # 무관하게 항상 실측값을 반환. 등록 사업장이 0건이라도 "데이터 없음"으로 끝내지 않고
        # 실제 시장 규모를 보여주기 위함(2026-08-30). graceful — 실패해도 리포트 중단 안 함.
        real_market: dict = {"available": False, "total_count": 0, "samples": []}
        try:
            from services.local_search import get_market_density
            real_market = await get_market_density(category, region)
        except Exception as _e:
            logger.warning(f"startup 실제 시장 밀도 조회 실패 (graceful): {_e}")

        # 밀도 비교 — 전국평균 대신 사용자가 지정한 지역과 직접 비교(2026-09-01).
        # 전국평균은 국토 대부분을 차지하는 농어촌 지역에 의해 어떤 도심 상권이든 거의
        # 항상 "높음"으로 나오는 통계적 왜곡이 있어 배제(bar national_avg 제거와 동일 판단).
        # 두 지역 모두 같은 API로 실측하는 방식이라 허위/오도 위험 없음.
        market_comparison: dict = {"available": False}
        compare_region_clean = (compare_region or "").strip()
        if (
            compare_region_clean
            and real_market.get("available")
            and real_market.get("density_per_km2") is not None
        ):
            try:
                compare_market = await get_market_density(category, compare_region_clean)
                cmp_density = compare_market.get("density_per_km2")
                if compare_market.get("available") and cmp_density:
                    base_density = real_market["density_per_km2"]
                    diff_pct = (base_density - cmp_density) / cmp_density * 100
                    if diff_pct > 15:
                        comparison_label = "higher"
                    elif diff_pct < -15:
                        comparison_label = "lower"
                    else:
                        comparison_label = "similar"
                    market_comparison = {
                        "available": True,
                        "compare_region": compare_region_clean,
                        "compare_density_per_km2": cmp_density,
                        "compare_total_count": compare_market.get("total_count"),
                        "diff_pct": round(diff_pct, 1),
                        "comparison": comparison_label,
                    }
            except Exception as _e:
                logger.warning(f"startup 비교지역 밀도 조회 실패 (graceful): {_e}")

        # 실제 경쟁사(위 real_market.samples) 스마트플레이스 공개 완성도 체크(2026-08-31,
        # 사용자 승인) — 로그인 우회·AI 브리핑 확인 없이 공개 페이지만 조회(범위 제한 근거는
        # startup_competitor_readiness.py 모듈 docstring 참조). graceful — 실패해도 중단 안 함.
        competitor_readiness: dict = {"available": False, "checked": 0, "items": []}
        if real_market.get("source") == "sbiz" and real_market.get("samples"):
            try:
                from services.startup_competitor_readiness import check_competitors_readiness
                competitor_readiness = await check_competitors_readiness(real_market["samples"], region)
            except Exception as _e:
                logger.warning(f"startup 경쟁사 준비도 체크 실패 (graceful): {_e}")

        # 지역·업종 폐업율(역대 누적) — 행정안전부 지방행정 인허가 통합 API
        # real_market/competitor_readiness와 동일한 graceful 패턴:
        # 실패해도 리포트 생성 전체를 중단하지 않고 available:False로 조용히 생략
        closure_rate: dict = {"available": False, "reason": None}
        try:
            from services.localdata_api import get_closure_rate
            closure_rate = await get_closure_rate(category, region)
        except Exception as _e:
            logger.warning(f"startup closure_rate 조회 실패 (graceful): {_e}")

        # Claude로 진입 전략 생성 — 점수 숫자 미포함(strategy 텍스트에 노출 방지)
        from services.score_engine import get_briefing_eligibility
        eligibility = get_briefing_eligibility(category, False)
        briefing_note = {
            "active": "이 업종은 네이버 AI 브리핑(플레이스형) 대상입니다.",
            "likely": "이 업종은 네이버 AI 브리핑(플레이스형) 확대 예정 업종으로, 아직 전면 대상은 아닙니다.",
            "inactive": "이 업종은 네이버 AI 브리핑(플레이스형) 비대상입니다 — 'AI 브리핑 노출'을 핵심 전략으로 제안하지 말 것. 정보형(블로그·콘텐츠)·ChatGPT·Gemini·Google 노출 전략 위주로 제안할 것. 프랜차이즈로 창업하는 경우도 동일하게 비대상.",
        }.get(eligibility, "")
        # AI 검색 노출 예상 기간은 Claude에게 자유 생성시키지 않고 CLAUDE.md에 정리된
        # 실측/공식 근거 기준(네이버 AI브리핑·AI탭 2~4주 추정, ChatGPT·Gemini 수개월~1년 등)으로
        # 백엔드에서 결정론적으로 산정 — 2026-08-31 실측: 근거 없이 자유 생성시켰더니 Claude가
        # "3~5개월"처럼 앱 자체 기준(2~4주)과 4~10배 차이나는 수치를 지어낸 것을 발견해 수정
        # (AI 생성 콘텐츠 사실 지어내기 금지 원칙, git fd946a9~501b37e와 동일 패턴의 재발).
        exposure_timeline = {
            "active": "네이버 AI 브리핑(플레이스형)은 스마트플레이스 등록 후 약 2~4주 내 노출 시작(추정, 네이버 미공개) — 안정적으로 자주 인용되려면 리뷰·콘텐츠가 쌓이는 수개월이 더 걸릴 수 있습니다. ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
            "likely": "이 업종은 네이버 AI 브리핑(플레이스형) 확대 예정 업종이라 정확한 노출 시점은 미정입니다. 정보형(블로그·콘텐츠)과 Google AI Overview는 콘텐츠 등록 후 약 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
            "inactive": "이 업종은 네이버 AI 브리핑(플레이스형) 비대상입니다. 정보형(블로그·콘텐츠)과 Google AI Overview는 콘텐츠 등록 후 약 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.",
        }.get(eligibility, "채널별로 노출까지 걸리는 기간이 다릅니다 — 네이버는 콘텐츠 등록 후 2~4주 내 반영 시작, ChatGPT·Gemini는 학습 데이터 기반이라 수개월~1년 소요됩니다.")
        # 트렌드 데이터가 있을 때만 프롬프트에 삽입 (빈 경우 "안정 +0.0%" 같은 무의미 문구 방지)
        trend_line = ""
        if search_trend.get("trend_data"):
            direction_label = {"rising": "상승세", "falling": "하락세", "stable": "안정"}.get(
                search_trend.get("trend_direction", "stable"), "안정"
            )
            delta = search_trend.get("trend_delta", 0.0)
            kws = ", ".join(search_trend.get("keywords_used", [])[:3])
            trend_line = (
                f"\n- 네이버 검색 수요(최근 3개월): {direction_label}"
                f" ({delta:+.1f}% 변화) [측정 키워드: {kws}]"
            )

        # AEOlab 가입 사업장(competitor_count)이 적거나 0이어도, 실측 기준 실제 시장
        # 규모를 Claude에게 알려줘 "경쟁이 없다"는 성급한 결론을 방지
        real_market_line = ""
        if real_market.get("available"):
            real_names = ", ".join(s["name"] for s in real_market.get("samples", [])[:3])
            source_label = "국세청 사업자등록 기반 실측" if real_market.get("source") == "sbiz" else "카카오맵 실측"
            radius_km = real_market.get("radius_m", 0) / 1000
            density = real_market.get("density_per_km2")
            is_low_confidence = real_market.get("source") == "sbiz" and real_market.get("confidence") == "low"
            radius_note = (
                (
                    f"(입력 지역 중심 반경 {radius_km:g}km 기준 — 행정구역 전체 수치가 아니므로 절대 규모로 단정하지 말 것"
                    + (f", 밀도 1㎢당 {density}개" if density is not None else "")
                    + (". ⚠ 이 지역은 면적이 넓어(군·특별자치시 등) 반경이 전체를 못 덮음 — 실제로는 이보다 훨씬 많을 수 있다는 점을 전략에 반드시 반영할 것" if is_low_confidence else "")
                    + ")"
                )
                if real_market.get("source") == "sbiz" else ""
            )
            real_market_line = (
                f"\n- 실제 시장 규모({source_label}, AEOlab 가입 여부와 무관): 약 {real_market['total_count']}개{radius_note}"
                + (f" [예시: {real_names}]" if real_names else "")
            )

        # 사용자 지정 비교지역 밀도 프롬프트 라인
        market_comparison_line = ""
        if market_comparison.get("available"):
            cmp_label = {"higher": "더 밀집", "similar": "비슷한 밀집도", "lower": "덜 밀집"}.get(
                market_comparison.get("comparison") or "", ""
            )
            diff = market_comparison.get("diff_pct")
            market_comparison_line = (
                f"\n- 사용자가 비교 지정한 지역 '{market_comparison['compare_region']}' 대비 밀도: {cmp_label}"
                + (f" ({diff:+.0f}%)" if diff is not None else "")
            )

        # 실제 경쟁사 스마트플레이스 공개 완성도 — Claude에게 구체적 차별화 포인트를
        # 제시할 근거로 제공(2026-08-31 신설). 이 정보가 없으면 Claude가 "차별화하세요"
        # 같은 추상적 조언에 그치므로, 실측 기반 구체적 조언으로 바꾸기 위함.
        readiness_line = ""
        if competitor_readiness.get("available"):
            n = competitor_readiness["checked"]
            no_intro = competitor_readiness["no_intro_count"]
            no_post = competitor_readiness["no_recent_post_count"]
            readiness_line = (
                f"\n- 실제 경쟁사 스마트플레이스 공개 조사({n}곳, 위 예시 업체 대상): "
                f"소개글 없음 {no_intro}곳, 최근 소식 없음 {no_post}곳 "
                "(이 항목들이 미비한 경쟁사가 많으면 '내가 이것부터 채우면 차별화된다'는 구체적 전략으로 반영할 것)"
            )

        # 폐업율 프롬프트 라인 — available일 때만 삽입, 비교 레이블 한글화
        closure_rate_line = ""
        if closure_rate.get("available"):
            comp_label = {"lower": "낮음", "similar": "비슷함", "higher": "높음"}.get(
                closure_rate.get("comparison") or "", ""
            )
            avg_note = f", 전국 평균 대비 {comp_label}" if comp_label else ""
            closure_rate_line = (
                f"\n- 이 업종·지역의 역대 누적 폐업율: {closure_rate['closure_rate']:.1f}%{avg_note}"
                " (※ 연간 폐업율이 아닌 누적 통계 — 과도하게 해석하지 말 것,"
                " risk_factors에서 이 캐비엇도 함께 전달할 것)"
            )

        from services.schema_generator import CATEGORY_KO
        category_ko = CATEGORY_KO.get(category, category)
        prompt = f"""한국 {region} {category_ko} 업종 창업 분석:

- {briefing_note}{trend_line}{real_market_line}{market_comparison_line}{readiness_line}{closure_rate_line}
{"- 창업 예정 사업장명: " + business_name if business_name else ""}
- 중요: 임대료·평당 시세·인건비·손익분기점 개월 수 등 위에 제공되지 않은 구체적 비용·재무 수치는
  절대 지어내지 말 것. 비용 관련 조언이 필요하면 "목표 상권 인근 부동산·상권분석 서비스에 직접
  확인하세요" 같은 일반 안내로 대체할 것 (AEOlab은 실측 비용 데이터를 보유하지 않음).
- 제약(가장 중요): entry_strategy·key_actions·ai_optimization_tips·risk_factors의 각 문장은
  위에 제시된 구체적 수치·사실(시장 규모, 밀도, 검색 트렌드, 경쟁사 준비도 등) 중 최소 하나를
  반드시 인용하며 작성할 것. "차별화하세요", "현장을 직접 답사하세요", "콘셉트를 하나로
  좁히세요"처럼 이 데이터가 하나도 없어도 어떤 업종·지역에나 그대로 쓸 수 있는 일반적인
  창업 조언은 절대 포함하지 말 것 — 그런 조언이 꼭 필요하면 왜 그것이 "이 업종·이 지역"의
  위 수치와 구체적으로 연결되는지 반드시 명시할 것. 일반론만 담긴 문장이 하나라도 있으면
  안 됨.
- 근거 다양화: 같은 숫자 하나(예: 시장 규모)만 네 항목 전체에서 반복 인용하지 말 것 — 항목별로
  주로 참조할 근거를 다르게 배정할 것. entry_strategy는 시장 규모·밀도를 중심 축으로,
  key_actions는 위에 예시로 제시된 실제 경쟁사명을 중심으로(있는 경우), ai_optimization_tips는
  AI 브리핑 적합성·노출 채널 특성을 중심으로, risk_factors는 폐업율(available 시 우선)과 검색 트렌드 방향을 중심으로 삼을 것.
  같은 항목 안에서도 문장마다 되도록 다른 근거를 쓸 것.
- 통찰의 깊이: 단순히 숫자 하나를 언급하고 그 뒤에 상식적인 결론(예: "경쟁사가 많으니
  차별화가 필요합니다")을 붙이는 얕은 문장은 지양할 것. 대신 서로 다른 두 정보를 결합해
  이 업종·지역 조합에서만 성립하는 함의를 도출할 것 — 예를 들어 "밀도는 높은데 검색
  트렌드는 하락 중"이라는 조합에서는 "기존 매장들이 온라인보다 오프라인 재방문에 의존해온
  시장일 수 있으니, 신규 진입자는 이 지역에서 아직 드문 온라인 예약·리뷰 전략을 선점하면
  유리하다"처럼, 데이터 조합 자체에서 나온 추론을 쓸 것(위는 형식 예시이며 실제 값이 아님).
- 문장 길이 제약(모바일 가독성): 위 통찰은 그대로 유지하되, 그 추론을 쉼표로 여러 절을
  길게 이어붙인 문장 하나에 욱여넣지 말 것. 문장 하나당 명확한 주장 하나만 담고 마침표로
  자주 끊어 쓸 것 — 예를 들어 "관찰한 사실은 이렇다"를 담은 문장과 "그래서 이런 함의가
  나온다"를 담은 문장을 따로 나눌 것. 개별 문장은 한국어 기준 약 50자를 넘기지 말 것
  (항목당 문장 수가 늘어나는 것은 괜찮음 — 문장 자체를 짧게 유지하는 것이 핵심).

위 데이터를 바탕으로 아래 형식으로 창업 전략을 JSON으로 제공해줘:
{{
  "entry_strategy": "3~4문장 진입 전략 요약",
  "key_actions": ["핵심 액션 1", "핵심 액션 2", "핵심 액션 3"],
  "ai_optimization_tips": ["AI 노출 최적화 팁 1", "팁 2", "팁 3"],
  "risk_factors": ["주의사항 1", "주의사항 2"]
}}"""

        from services.anthropic_retry import create_message_with_retry
        try:
            msg = await create_message_with_retry(
                self.client,
                model="claude-sonnet-4-6",
                max_tokens=3200,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-sonnet-4-6", f"startup_report:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-sonnet-4-6", "startup_report", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            logger.debug("startup_report usage 로깅 실패(무시): %s", _le)
        raw = msg.content[0].text.strip()

        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            try:
                strategy = json.loads(json_match.group())
            except json.JSONDecodeError:
                strategy = None
        else:
            strategy = None
        if strategy is None:
            # 파싱 실패(응답 길이 초과로 JSON이 잘린 경우 등) — 코드펜스만 제거해 원문이라도 읽히게
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw).strip()
            strategy = {"entry_strategy": cleaned}
        # Claude가 프롬프트에서 빠진 필드를 임의로 채워 넣을 가능성까지 차단 — 항상 결정론적 값으로 덮어씀
        strategy["estimated_time_to_visibility"] = exposure_timeline

        return {
            "category": category,
            "region": region,
            "business_name": business_name,
            "competitor_count": competitor_count,
            "avg_competitor_score": avg_score,
            "competition_level": competition_level,
            "competition_level_color": level_color,
            "competition_level_score": level_score,  # 1=치열, 4=기회
            "top_competitors": top_competitors[:5],
            "strategy": strategy,
            # 표본 3개 미만이거나 등록 사업장은 있으나 전부 미스캔이면 "평균"의 대표성이 낮음
            "is_estimated": competitor_count < 3 or no_scan_data,
            "no_scan_data": no_scan_data,
            "real_market": real_market,
            "market_comparison": market_comparison,
            "competitor_readiness": competitor_readiness,
            "closure_rate": closure_rate,
            "search_trend": {
                "trend_direction": search_trend.get("trend_direction", "stable"),
                "trend_delta": search_trend.get("trend_delta", 0.0),
                "trend_data": search_trend.get("trend_data", []),
                "keywords_used": search_trend.get("keywords_used", []),
                "available": bool(search_trend.get("trend_data")),
            } if search_trend else {"available": False},
        }
