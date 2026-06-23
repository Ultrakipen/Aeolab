"""
AI Visibility Score 계산 엔진 — 업종별 듀얼트랙 통합 모델 v3.0
docs/model_engine_v3.0.md 기준 구현

핵심 변화:
  - WEIGHTS 6항목 단일 점수 → 업종별 DUAL_TRACK_RATIO 기반 통합 점수
  - Track 1 (네이버 AI 검색 준비도 — AI브리핑+AI탭 통합): keyword_gap 35% 반영
  - AI 브리핑: ACTIVE 업종만 (음식점·카페·숙박 등)
  - AI탭: 모든 업종 대상 (2026-04-27 베타, 상반기 전체 확대 예정)
  - Track 2 (글로벌 AI 가시성): Gemini 100회 + ChatGPT 100회 + Google AI Overview (월요일 자동 스캔만)
  - unified_score = track1 × naver_weight + track2 × global_weight (업종별 비율)
  - growth_stage: track1_score 기준 (업종별 비율 차이 오진단 방지)
"""
import logging
import os
from services.keyword_taxonomy import normalize_category
from services.naver_visibility import blog_mention_score

_logger = logging.getLogger("aeolab")

# v3.1 점수 모델 토글 (service_unification_v1.0.md §3)
# v3_0 = 기존 5항목 (안정), v3_1 = 신규 6항목 그룹별 가중치
# Phase A-2 키워드 측정 미완성 시 v3_1 활성화 금지 (점수 급락 위험)
SCORE_MODEL_VERSION = os.getenv("SCORE_MODEL_VERSION", "v3_0")

# AI 브리핑 노출 가능성 분류
# 근거: 네이버 공식 발표(2025.08) — 음식점·카페 + 숙박 확대 확정(1.5만 업체)
# beauty(미용): "숙박·미용·명소 등으로 확대할 예정"(2025.08 원문) — 예정이지 확정 아님 → LIKELY 유지
# 주의: bakery/bar는 normalize 시 cafe/restaurant로 변환되나, 둘 다 ACTIVE이므로 결과 동일
BRIEFING_ACTIVE_CATEGORIES = ["restaurant", "cafe", "bakery", "bar", "accommodation"]
# beauty: 2026-04-27 AI탭 베타 공개 시작(네이버플러스 우선, 상반기 전체 확대 예정)
# nail·skincare·massage·pet·fitness·yoga·pharmacy: 공식 발표 없음 — 베타 확대 동향 추적 중
BRIEFING_LIKELY_CATEGORIES = ["beauty", "nail", "skincare", "massage", "spa", "pet", "fitness", "yoga",
                              "pharmacy", "dance", "ballet", "semi_permanent"]
# skincare·massage·spa: 뷰티·웰니스 로컬 서비스, dance·ballet: 피트니스 계열 스튜디오
# 2026-05-19: normalize_category alias로 변환되는 정규화 키도 함께 포함 (clinic/academy/music) — P0 alias miss 수정
BRIEFING_INACTIVE_CATEGORIES = [
    "medical", "clinic", "legal", "accounting", "education", "tutoring", "academy",
    "photo", "video", "design", "realestate", "interior",
    "auto", "cleaning", "laundry", "shopping", "fashion", "clothing",
    "flower", "kids", "study", "workshop", "music", "music_class", "music_lesson",
    "cooking", "experience", "other",
    # 신규 14개 중 semi_permanent 제외 13개 (v5.7 — 2026-05-13)
    "dental", "oriental_medicine", "optics",
    "martial_arts", "climbing",
    "art_class", "childcare",
    "car_wash", "electronics_repair",
    "footwear", "stationery",
    "norebang", "billiards",
    # 2026-05-18 추가 — taxonomy 완비 업종 whitelist 확장 (25→60)
    "golf", "swim", "jjimjil", "escape",
]


def get_briefing_eligibility(category: str, is_franchise: bool = False) -> str:
    """업종별 AI 브리핑 노출 가능성 분류 반환.

    네이버 공식(2026-04-30 확인, help.naver.com/service/30026/contents/24632):
    - 프랜차이즈 업종: "현재 제공되지 않으며 추후 확대 예정" ✅ 공식 확인
    - 리뷰 수 기준 미달: "서비스가 제공되지 않습니다" ✅ 공식 확인
    - 대상 업종: "음식점, 카페 등 일부 업종" (bakery·bar는 "등"에 포함으로 해석)

    Args:
        category: 업종 키 (restaurant, cafe 등)
        is_franchise: 프랜차이즈 가맹점 여부. True면 ACTIVE 업종도 inactive 처리

    Returns:
        "active"   — 음식점·카페 등 현재 대상 업종
        "likely"   — 미용·네일 등 확대 예상 업종 (베이커리·바는 ACTIVE 분류)
        "inactive" — 사진·법무 등 비대상 업종 (네이버 정책) 또는 프랜차이즈
    """
    from services.keyword_taxonomy import normalize_category, _CATEGORY_ALIASES
    if is_franchise:
        return "inactive"
    # normalize_category("other") → "restaurant" 이므로 normalize 전에 먼저 처리
    if (category or "").lower() in ("other", "기타"):
        return "inactive"
    # normalize_category fallback = "restaurant" (ACTIVE) — alias 미등록 업종이 ACTIVE로 오분류되는 것을 방지
    cat_lower = (category or "").lower().strip()
    if cat_lower not in _CATEGORY_ALIASES:
        return "inactive"
    key = normalize_category(category)
    if key in BRIEFING_ACTIVE_CATEGORIES:
        return "active"
    if key in BRIEFING_LIKELY_CATEGORIES:
        return "likely"
    return "inactive"



def get_ai_tab_eligibility(category: str) -> str:
    """네이버 AI탭 노출 가능성 분류.

    AI탭은 AI 브리핑과 달리 업종 제한 없음 (2026-04-27 베타 출시 기준).
    스마트플레이스 완성도·소개글·예약 연동이 노출 품질에 영향.

    현재 호출처: report.py get_ai_tab_preview (briefing_eligibility 대체 예정)
    P2 예정: naver_ai_tab_scanner.py 구현 후 Track1 naver_ai_tab_visible 항목 연결.

    환경변수 AI_TAB_STATUS(기본값 "beta")로 제어.
    6월 AI탭 전체 확대 후 운영 서버에서 AI_TAB_STATUS=available 로 변경.

    Returns:
        "beta"      — 네이버플러스 구독자 우선 베타 서비스 중 (기본값)
        "available" — 6월 전체 확대 후 (환경변수로 전환)
    """
    return os.getenv("AI_TAB_STATUS", "beta")


# ────────────────────────────────────────────────────────────────
# 업종별 듀얼트랙 비율
# 근거: 오픈서베이 2026 AI 검색 트렌드 + 연령별 사용자 분포
# ────────────────────────────────────────────────────────────────
DUAL_TRACK_RATIO: dict[str, dict[str, float]] = {
    # 위치 기반 업종 (location_based)
    "restaurant": {"naver": 0.80, "global": 0.20},  # 즉시방문형, 30-50대 고객 70%+ (ChatGPT API 소상공인 미반영 현실 반영 2026-06-23)
    "cafe":       {"naver": 0.75, "global": 0.25},  # 분위기 탐색 AI 증가, 20대 고객 多
    "beauty":     {"naver": 0.70, "global": 0.30},  # 당일예약 네이버, 전문시술 AI 리서치
    "fitness":    {"naver": 0.65, "global": 0.35},  # 10-20대 고객 → AI 네이티브 비중 높음
    "yoga":       {"naver": 0.65, "global": 0.35},  # 요가 스튜디오 = fitness 계열, LIKELY (2026-05-19 누락 수정)
    "pet":        {"naver": 0.70, "global": 0.30},  # 동물병원 AI 검색 빠르게 증가
    "medical":    {"naver": 0.55, "global": 0.45},  # 증상 검색 = ChatGPT, 지식 습득 목적 47.6% ("clinic" → "medical" 로 키 변경)
    "clinic":     {"naver": 0.55, "global": 0.45},  # normalize_category alias 후 키 (medical 동일 비율, 2026-05-19 P0)
    "academy":    {"naver": 0.40, "global": 0.60},  # 10대(AI 네이티브), 커리큘럼 비교 AI
    "music":      {"naver": 0.55, "global": 0.45},  # 음악교습소 alias 정규화 키 (2026-05-19 P0)
    # 위치 무관 업종 (non_location)
    "legal":      {"naver": 0.20, "global": 0.80},  # 전문직 = ChatGPT·Gemini 주전장
    "shopping":   {"naver": 0.10, "global": 0.90},  # 온라인 = 글로벌 AI 압도적
    # 사진·영상·디자인 (위치 기반, 지역 스튜디오·제작사)
    "photo":  {"naver": 0.70, "global": 0.30},  # 지역 기반 사진·영상 검색 ← 네이버 강세
    "video":  {"naver": 0.55, "global": 0.45},  # 포트폴리오 탐색 = AI 비중 증가
    "design": {"naver": 0.35, "global": 0.65},  # 온라인 레퍼런스 탐색 = 글로벌 AI 우세
    # 폼 25개 업종 추가 (2026-04-23) — alias 대상이 아닌 신규 dict 4종
    "pharmacy":   {"naver": 0.75, "global": 0.25},  # 약국 = 지역 기반 강함, 즉시 방문형
    "realestate": {"naver": 0.70, "global": 0.30},  # 부동산 = 지역·매물 검색 네이버 강세
    "interior":   {"naver": 0.55, "global": 0.45},  # 인테리어 = 포트폴리오 탐색 AI 비중 증가
    "auto":       {"naver": 0.70, "global": 0.30},  # 자동차 정비 = 지역 + 차종 검색 네이버 강세
    # bakery·bar·nail은 _CATEGORY_ALIASES에 의해 cafe/restaurant/beauty로 normalize되므로 별도 키 불필요
    "accommodation": {"naver": 0.70, "global": 0.30},  # 숙박 = 네이버 AI 브리핑 ACTIVE 업종, 즉시예약형
    # 신규 업종 8개 (2026-05-13)
    "massage":    {"naver": 0.70, "global": 0.30},  # 마사지·스파 = 당일예약 네이버 강세
    "skincare":   {"naver": 0.70, "global": 0.30},  # 피부관리실 = 시술 리서치 AI 증가
    "accounting": {"naver": 0.30, "global": 0.70},  # 세무·회계 = 전문직 = 글로벌 AI 주전장
    "flower":     {"naver": 0.75, "global": 0.25},  # 꽃집 = 지역 배달·즉시구매 네이버 강세
    "laundry":    {"naver": 0.75, "global": 0.25},  # 세탁소 = 지역 기반 즉시방문형
    "kids":       {"naver": 0.75, "global": 0.25},  # 키즈카페 = 지역 근거리 검색 네이버 압도
    "study":      {"naver": 0.70, "global": 0.30},  # 스터디카페 = 지역+시설 검색 네이버 우세
    "workshop":   {"naver": 0.55, "global": 0.45},  # 공방·클래스 = 포트폴리오 AI 탐색 비중 증가
    # 프론트엔드 신규 카테고리 10개 (2026-05-13)
    "dance":        {"naver": 0.70, "global": 0.30},  # 댄스 = 지역 스튜디오, LIKELY
    "ballet":       {"naver": 0.70, "global": 0.30},  # 발레 = 지역 스튜디오, LIKELY
    "golf":         {"naver": 0.70, "global": 0.30},  # 골프연습장 = 지역 기반 즉시방문형
    "swim":         {"naver": 0.70, "global": 0.30},  # 수영·아쿠아 = 지역 기반
    "jjimjil":      {"naver": 0.75, "global": 0.25},  # 찜질방·사우나 = 지역 근거리 즉시방문형
    "music_class":  {"naver": 0.60, "global": 0.40},  # 음악교실 = 지역 기반, AI 정보 탐색 일부
    "music_lesson": {"naver": 0.55, "global": 0.45},  # 악기레슨 = 개인레슨, AI 매칭 비중 증가
    "cooking":      {"naver": 0.60, "global": 0.40},  # 요리교실 = 지역+클래스 탐색
    "escape":       {"naver": 0.60, "global": 0.40},  # 방탈출 = 지역 기반, 테마·후기 AI 탐색
    "experience":   {"naver": 0.55, "global": 0.45},  # 체험공간 = 콘텐츠 탐색 AI 비중 증가
    # 쌍 분리 신규 (2026-05-13 v5.7)
    "spa":          {"naver": 0.65, "global": 0.35},  # 스파 = 고급 웰니스, 네이버 예약 강세
    "clothing":     {"naver": 0.50, "global": 0.50},  # 의류 = 온라인·오프라인 혼합
    # 신규 14개 (v5.7 — 2026-05-13)
    "dental":             {"naver": 0.60, "global": 0.40},  # 치과 = 증상검색 AI, 지역 기반 혼합
    "oriental_medicine":  {"naver": 0.70, "global": 0.30},  # 한의원 = 지역 기반, 네이버 블로그 강세
    "optics":             {"naver": 0.75, "global": 0.25},  # 안경원 = 즉시방문형
    "semi_permanent":     {"naver": 0.70, "global": 0.30},  # 반영구화장 = LIKELY 뷰티 계열
    "martial_arts":       {"naver": 0.70, "global": 0.30},  # 태권도·무술 = 지역 유소년 중심
    "climbing":           {"naver": 0.60, "global": 0.40},  # 클라이밍 = 시설 비교 AI 증가
    "art_class":          {"naver": 0.60, "global": 0.40},  # 미술학원 = 교육 계열
    "childcare":          {"naver": 0.75, "global": 0.25},  # 어린이집 = 지역 기반 즉시결정형
    "car_wash":           {"naver": 0.75, "global": 0.25},  # 세차장 = 지역 즉시방문형
    "electronics_repair": {"naver": 0.70, "global": 0.30},  # 가전수리 = 지역 기반, 후기 중요
    "footwear":           {"naver": 0.45, "global": 0.55},  # 신발 = 온라인 쇼핑 비중 높음
    "stationery":         {"naver": 0.60, "global": 0.40},  # 문구 = 지역+온라인 혼합
    "norebang":           {"naver": 0.80, "global": 0.20},  # 노래방 = 완전 지역 즉시방문형
    "billiards":          {"naver": 0.75, "global": 0.25},  # 당구장 = 지역 즉시방문형
}

# NOTE: cleaning·fashion은 BRIEFING_INACTIVE 업종으로 전략적 중요도 낮음
# → DEFAULT_DUAL_TRACK_RATIO(naver:0.60, global:0.40) 의도적 폴백 사용 (별도 키 불필요)

# 미등록 업종 중립 기본값 (오진단 방지)
DEFAULT_DUAL_TRACK_RATIO: dict[str, float] = {"naver": 0.60, "global": 0.40}


def get_dual_track_ratio(category: str) -> dict[str, float]:
    """업종 코드로 naver/global 비율 반환. 미등록 업종은 중립 기본값(0.60/0.40)."""
    key = normalize_category(category)
    return DUAL_TRACK_RATIO.get(key, DEFAULT_DUAL_TRACK_RATIO)


# ────────────────────────────────────────────────────────────────
# Track 1 — 네이버 AI 브리핑 준비도 가중치
# ────────────────────────────────────────────────────────────────
NAVER_TRACK_WEIGHTS: dict[str, float] = {
    "keyword_gap_score":        0.30,  # 업종별 키워드 커버리지 — 조건검색 직결 (0.35→0.30, ai_tab_readiness 분리)
    "review_quality":           0.25,  # 리뷰 수·평점·최신성·키워드 다양성
    "smart_place_completeness": 0.15,  # FAQ·소개글·소식·부가정보 완성도
    "naver_exposure_confirmed": 0.15,  # 네이버 AI 브리핑 실제 확인
    "kakao_completeness":       0.10,  # 카카오맵 완성도 (사용자 체크리스트 기반)
    "ai_tab_readiness":         0.05,  # AI탭 체크리스트 준비도 (사용자 확인 + 스캔 확인)
}

# ────────────────────────────────────────────────────────────────
# AI탭 준비도 텍스트 레이블 (숫자 점수 → 사용자 친화적 표현)
# ────────────────────────────────────────────────────────────────
_AI_TAB_READINESS_LABELS: list[tuple[float, str, str]] = [
    (0.0,  "시작 전",    "소개글·사진·예약 정보를 등록하면 AI탭 노출 가능성이 생깁니다"),
    (20.0, "기초 단계",  "기본 정보를 채울수록 AI탭 노출 가능성이 높아집니다"),
    (40.0, "준비 중",    "AI탭 노출 가능성이 점점 높아지고 있습니다"),
    (65.0, "거의 완료",  "AI탭에 자주 노출될 준비가 거의 됐습니다"),
    (85.0, "최적화 완료","AI탭 노출에 최적화된 상태입니다"),
]


def get_ai_tab_readiness_label(score: float) -> dict[str, str]:
    """AI탭 준비도 점수(0~100) → 텍스트 레이블 반환.

    Returns: {"short": 단어, "description": 문장}
    """
    label = _AI_TAB_READINESS_LABELS[0]
    for threshold, short, desc in _AI_TAB_READINESS_LABELS:
        if score >= threshold:
            label = (threshold, short, desc)
    return {"short": label[1], "description": label[2]}


def calc_ai_tab_readiness(
    category: str,
    checklist_overrides: dict | None,
    sp_completeness_json: dict | None,
) -> float:
    """AI탭 준비도 점수 (0~100).

    스캔 자동 확인(photo_count, has_reservation) + 사용자 수동 확인(checklist_overrides)
    두 소스를 합산. 중복 항목은 한 번만 카운트.
    """
    import re as _re
    from services.ai_tab_checklists import get_checklist as _get_checklist
    from services.ai_tab_checklists import get_checklist_score as _get_score

    items = _get_checklist(category)
    if not items:
        return 0.0

    completed_texts: set[str] = set()

    # 1) 스캔 자동 확인 — sp_completeness_json 기반
    sp = sp_completeness_json or {}
    photo_count = int(sp.get("photo_count") or 0)
    has_reservation = sp.get("has_reservation")
    has_intro = sp.get("has_intro")

    for it in items:
        txt = it["item"]
        if ("사진" in txt or "포트폴리오" in txt) and photo_count > 0:
            m = _re.search(r"(\d+)장", txt)
            threshold = int(m.group(1)) if m else 10
            if photo_count >= threshold:
                completed_texts.add(txt)
        elif "예약 연동" in txt and has_reservation is True:
            completed_texts.add(txt)
        elif "소개글" in txt and has_intro:
            completed_texts.add(txt)

    # 2) 사용자 수동 확인 — checklist_overrides 기반
    overrides = checklist_overrides or {}
    for txt, done in overrides.items():
        if done:
            completed_texts.add(txt)

    # 사진 탭 서버 IP 차단 시 사용자 직접 확인 대체
    if overrides.get("__photo_sufficient"):
        for it in items:
            if "사진" in it["item"] or "포트폴리오" in it["item"]:
                completed_texts.add(it["item"])

    # 3) 점수 계산
    return _get_score(category, list(completed_texts))


# ────────────────────────────────────────────────────────────────
# Track 2 — 글로벌 AI 가시성 가중치
# 점수 배분 근거: §1.3 글로벌 AI 플랫폼 시장 점유율 (model_engine_v3.0.md)
# ────────────────────────────────────────────────────────────────
GLOBAL_TRACK_WEIGHTS: dict[str, float] = {
    "multi_ai_exposure": 0.30,  # Gemini+ChatGPT API — 소상공인 학습데이터 미반영 현실 반영해 하향 (2026-06-23)
    "schema_seo":        0.30,  # JSON-LD + 웹사이트 SEO + Open Graph
    "online_mentions":   0.20,  # 블로그·뉴스·미디어 언급 (네이버 블로그 API)
    "google_presence":   0.20,  # Google AI Overview — Serper.dev 실시간 실측, 신뢰도 높아 상향 (2026-06-23)
}

# 성장 단계 기준 (track1_score 기준 — 업종별 unified 비율 차이 오판 방지)
_GROWTH_THRESHOLDS = [
    (30,  "survival",  "시작 단계"),
    (55,  "stability", "성장 중"),
    (75,  "growth",    "빠른 성장"),
    (101, "dominance", "지역 1등"),
]


def determine_growth_stage(track1_score: float) -> str:
    """track1_score 기준 성장 단계 코드 반환"""
    for threshold, stage, _ in _GROWTH_THRESHOLDS:
        if track1_score < threshold:
            return stage
    return "dominance"


def determine_growth_stage_label(track1_score: float) -> str:
    """track1_score 기준 성장 단계 한국어 레이블 반환"""
    for threshold, _, label in _GROWTH_THRESHOLDS:
        if track1_score < threshold:
            return label
    return "지역 1등"


# ────────────────────────────────────────────────────────────────
# Track 1 계산 함수들
# ────────────────────────────────────────────────────────────────

def _resolve_keyword_gap_score(
    keyword_coverage_rate: float | None,
    naver_data: dict,
    biz: dict,
    category: str = "",
) -> tuple[float, bool]:
    """
    keyword_gap_score 계산 (0~100).
    반환: (score, is_estimated)
      is_estimated=True  → fallback 30.0 사용, UI에서 "(추정값)" 회색 배지 표시
      is_estimated=False → 실제 리뷰 또는 블로그 텍스트 기반 계산
    """
    if keyword_coverage_rate is not None and keyword_coverage_rate >= 0.1:
        return (keyword_coverage_rate * 100, False)

    # Cold start 2단계: 등록 키워드 + 블로그 covered 키워드 + 네이버 블로그 자동 추출
    biz_kw_list = biz.get("keywords") or []
    biz_kw_text = " ".join(biz_kw_list) if isinstance(biz_kw_list, list) else ""
    biz_review_sample = biz.get("review_sample") or ""
    blog_covered_kw = biz.get("blog_covered_keywords") or ""  # scan.py에서 blog_analysis_json.keyword_coverage.present 병합

    # 사용자가 직접 입력한 키워드 데이터가 있으면 is_estimated=False
    # taxonomy 미매칭(예: "녹음 카페"→cafe 분류 없음)이어도 데이터 자체가 없는 것과 다름
    has_real_data = bool(biz_kw_list or blog_covered_kw or biz_review_sample)

    top_blogs = naver_data.get("top_blogs") or []
    auto_excerpts = [
        b.get("description") or b.get("title") or ""
        for b in top_blogs
        if isinstance(b, dict)
    ]
    auto_excerpts = [t for t in auto_excerpts if t]
    # 우선순위: 리뷰샘플 > 소개글 > 블로그 covered 키워드 > 등록 키워드 > naver top_blogs
    _naver_intro = (biz.get("naver_intro_draft") or "").strip()
    if biz_kw_text:
        auto_excerpts = [biz_kw_text] + auto_excerpts
    if blog_covered_kw:
        auto_excerpts = [blog_covered_kw] + auto_excerpts
    if _naver_intro:
        auto_excerpts = [_naver_intro] + auto_excerpts
    if biz_review_sample:
        auto_excerpts = [biz_review_sample] + auto_excerpts

    if auto_excerpts and category:
        try:
            from services.keyword_taxonomy import analyze_keyword_coverage
            result = analyze_keyword_coverage(
                category=category,
                review_excerpts=auto_excerpts,
            )
            coverage = result["coverage_rate"] * 100
            if coverage >= 1.0:
                return (coverage, False)
            # taxonomy 매칭률이 낮지만 사용자 키워드 데이터가 있으면 추정 배너 표시 안 함
            if has_real_data:
                return (max(coverage, 20.0), False)
        except Exception as e:
            _logger.warning(f"keyword_coverage calc failed: {e}")
            if has_real_data:
                return (30.0, False)

    # 데이터가 아예 없을 때만 is_estimated=True (업종 평균 추정 배너 표시)
    return (30.0, not has_real_data)


def calc_review_quality(biz: dict) -> float:
    """리뷰 품질 점수 (0~100)
    keyword_diversity는 businesses 테이블에 항상 존재하지 않아 항상 0 반환 문제가 있음.
    대신 scan 후 keyword_coverage로 업데이트하는 방식 사용 (5-B 참조).
    공식: review_count/200×50 + avg_rating/5×50 + receipt_bonus (keyword_diversity 비중 제거)
    """
    rc = biz.get("review_count", 0) or 0
    ar = biz.get("avg_rating", 0) or 0
    receipt_count = biz.get("receipt_review_count", 0) or 0
    receipt_bonus = min(10, receipt_count / 10 * 10)
    return min(100, rc / 200 * 50 + ar / 5 * 50 + receipt_bonus)


def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float:
    """
    스마트플레이스 완성도 점수 (0~100).
    is_smart_place: naver_visibility.py 자동 수집
    naver_place_rank: 지역 검색 순위 (1위=30점, 2~5위=20점, 6~20위=10점)
    has_recent_post / has_intro: 사용자 체크박스 입력
    has_faq: 2026-05-01 스마트플레이스 Q&A 탭 폐기 이후 가중치 0 — talktalk_faq_draft 호환용으로만 유지
    """
    is_smart_place  = bool(
        naver_data.get("is_smart_place")  # 네이버 검색 결과에서 자동 확인
        or biz.get("is_smart_place")       # 사용자 체크박스
        or biz.get("naver_place_id")       # place_id 입력 = 스마트플레이스 등록 간접 증명
    )
    _faq_raw = biz.get("talktalk_faq_draft")
    if isinstance(_faq_raw, dict):
        _has_faq_draft = bool(_faq_raw.get("items"))
    elif isinstance(_faq_raw, list):
        _has_faq_draft = bool(_faq_raw)
    else:
        _has_faq_draft = False
    has_faq         = bool(biz.get("has_faq")) or _has_faq_draft
    has_recent_post = bool(biz.get("has_recent_post"))
    # IP 차단 시 수동 확인 대체 (90일 만료)
    if not has_recent_post:
        _overrides = biz.get("checklist_overrides") or {}
        if _overrides.get("__recent_post_sufficient"):
            _confirmed_at = _overrides.get("__recent_post_confirmed_at")
            if _confirmed_at:
                try:
                    from datetime import date, timedelta
                    _confirmed_date = date.fromisoformat(str(_confirmed_at))
                    has_recent_post = (date.today() - _confirmed_date).days <= 90
                except (ValueError, TypeError):
                    pass
    has_intro       = bool(biz.get("has_intro")) or bool((biz.get("naver_intro_draft") or "").strip())

    # 네이버 지역 검색 순위 반영 — 검색 노출 = 소상공인에게 가장 직접적 성과
    _rank = naver_data.get("my_rank") or naver_data.get("naver_place_rank")
    if _rank is not None:
        if _rank == 1:
            rank_score = 30   # 1위: 최고 노출
        elif _rank <= 5:
            rank_score = 20   # 2~5위: 상위 노출
        elif _rank <= 10:
            rank_score = 12   # 6~10위: 중간 노출
        else:
            rank_score = 5    # 11위+: 하위 노출
    else:
        rank_score = 0        # 미노출

    # [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 대응:
    #   has_faq 가중치 0 — FAQ 25점을 소개글 20 + 소식 25로 재배분 완료.
    #   has_faq 변수는 talktalk_faq_draft 호환을 위해 계산되지만 점수 산출에서는 제외됨.
    # 합계 100점: 25(등록) + 30(순위) + 25(소식) + 20(소개글) = 100점
    return min(100, (
        (25 if is_smart_place  else 0) +   # 스마트플레이스 등록 확인
        rank_score +                        # 네이버 지역 검색 순위 (최대 30점)
        (25 if has_recent_post else 0) +   # 최신성 (FAQ 25점 흡수, 15→25 상향)
        (20 if has_intro       else 0)     # 소개글 (10→20점, AI 브리핑 인용 후보 핵심 + Q&A 섹션 포함 시 효과적)
    ))


def calc_naver_exposure(scan_result: dict) -> float:
    """네이버 AI 브리핑 실제 노출 확인 점수 (0~100).

    광고 영역(ad_only=True)만 노출된 경우 유기 노출이 아니므로 0점 처리.
    Q2 광고 출시 전에는 ad_only가 항상 False이므로 점수 변동 없음.

    P2 보너스 (NAVER_AI_TAB_ENABLED=true):
        naver_ai_tab_visible=True 실측 시 +20점 (상한 100점).
        미측정(False 또는 키 없음) 시 보너스 없음 — 허위 수치 금지.
    """
    naver_result = scan_result.get("naver") or scan_result.get("naver_result") or {}
    # 광고 영역만 노출 시 유기 노출 아님 → 점수 0
    if naver_result.get("ad_only"):
        return 0.0
    briefing_score = float(
        (60 if naver_result.get("mentioned") else 0) +
        (40 if naver_result.get("in_briefing") else 0)
    )
    # AI탭 보너스 (P2 활성화 시, 실측 데이터 있을 때만 적용)
    if os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true":
        if scan_result.get("naver_ai_tab_visible") is True:
            briefing_score = min(100.0, briefing_score + 20.0)
    return briefing_score


def calc_kakao_completeness(scan_result: dict, biz: dict) -> float:
    """
    카카오맵 완성도 점수 (0~100).
    - businesses.kakao_score: 사용자 체크리스트 저장 값 (0~100) 우선
    - scan_result.kakao_result: 스캔 시점 카카오 데이터 fallback
    - kakao_place_id 있으면 최소 25점 보장 (등록 확인)
    """
    # 1순위: businesses 테이블에 저장된 체크리스트 점수
    stored = biz.get("kakao_score")
    if stored is not None and stored > 0:
        return float(min(100, stored))

    # 2순위: scan_result의 kakao_result (스캔 시 저장된 데이터)
    # trial은 "kakao" 키로, 정식 스캔은 "kakao_result" 키로 저장 — 양쪽 모두 지원
    kakao_result = scan_result.get("kakao_result") or scan_result.get("kakao") or {}
    if kakao_result:
        score = 0.0
        if kakao_result.get("mentioned"):
            score += 25.0   # 등록 확인
        if kakao_result.get("has_hours"):
            score += 15.0
        if kakao_result.get("has_phone"):
            score += 15.0
        if kakao_result.get("has_photos"):
            score += 20.0
        return min(100.0, score)

    # 3순위: kakao_place_id 존재 여부 (등록만 확인된 경우 25점)
    if biz.get("kakao_place_id"):
        return 25.0

    return 0.0


def _briefing_explanation(eligibility: str, ai_status: str) -> str:
    """업종·토글 상태 조합별 안내 문구."""
    if eligibility == "inactive":
        return "현재 네이버 AI 브리핑 비대상 업종입니다. 검색 가시성 영역에서 가치를 드립니다."
    if ai_status == "off":
        return "AI 브리핑 노출 설정이 OFF입니다. 1분만 투자해 ON으로 변경하면 노출 가능성이 즉시 활성화됩니다."
    if ai_status == "on":
        return "AI 브리핑 노출 가능 상태입니다. 리뷰·소개글·소식 충실하게 관리하시면 됩니다."
    if ai_status == "disabled":
        return "AI 브리핑 가능 업종이지만 활성화 조건(리뷰 수·최신성)이 미달입니다."
    return "AI 정보 탭 상태를 확인해주세요. 메뉴가 안 보이면 비대상 업종일 가능성이 높습니다."


def calc_track1_score(
    scan_result: dict,
    biz: dict,
    naver_data: dict,
    keyword_coverage_rate: float | None = None,
    category: str = "",
) -> tuple[float, bool, float, dict]:
    """
    Track 1 — 네이버 AI 브리핑 준비도 점수 (0~100).
    반환: (track1_score, is_keyword_estimated, kw_gap, track1_detail)
    kw_gap을 함께 반환해 calculate_score()에서 재사용 (이중 호출 방지)

    구성 (합계 1.0):
      keyword_gap_score        30%  (← 0.35에서 축소, ai_tab_readiness 5% 분리)
      review_quality           25%
      smart_place_completeness 15%  (← 0.25에서 축소, kakao 10% 분리)
      naver_exposure_confirmed 15%
      kakao_completeness       10%  (← 카카오맵 완성도 신규)
      ai_tab_readiness          5%  (← AI탭 체크리스트 준비도)
    """
    kw_gap, is_estimated = _resolve_keyword_gap_score(
        keyword_coverage_rate, naver_data, biz, category
    )
    rv_qual   = calc_review_quality(biz)
    sp_comp   = calc_smart_place_completeness(naver_data, biz)
    nv_exp    = calc_naver_exposure(scan_result)
    kakao_com = calc_kakao_completeness(scan_result, biz)

    _eff_cat = category or biz.get("category") or ""
    ai_tab_ready = calc_ai_tab_readiness(
        _eff_cat,
        biz.get("checklist_overrides") or {},
        biz.get("sp_completeness_json") or {},
    )

    # eligibility를 score 계산 전에 먼저 확정 (INACTIVE 분기에서 사용)
    # category 파라미터가 빈 문자열이면 biz dict에서 fallback
    _eff_category = category or biz.get("category") or ""
    ai_status    = biz.get("ai_info_tab_status", "unknown")
    eligibility  = get_briefing_eligibility(_eff_category, bool(biz.get("is_franchise")))

    # INACTIVE 업종: naver_exposure_confirmed는 항상 0 (AI 브리핑 비대상)
    # → 해당 15% 가중치를 제외하고 나머지 85%로 정규화해 구조적 손실 방지
    # (출처: help.naver.com/service/30026/contents/24632 "음식점, 카페 등 일부 업종")
    # LIKELY 업종은 nv_exp가 일부 업체에서 0이 아닐 수 있으므로 이 분기에 포함하지 않음
    if eligibility == "inactive":
        _inactive_w = 1.0 - NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"]  # 0.85
        score = (
            kw_gap        * NAVER_TRACK_WEIGHTS["keyword_gap_score"] +
            rv_qual       * NAVER_TRACK_WEIGHTS["review_quality"] +
            sp_comp       * NAVER_TRACK_WEIGHTS["smart_place_completeness"] +
            kakao_com     * NAVER_TRACK_WEIGHTS["kakao_completeness"] +
            ai_tab_ready  * NAVER_TRACK_WEIGHTS["ai_tab_readiness"]
        ) / _inactive_w
    else:
        score = (
            kw_gap        * NAVER_TRACK_WEIGHTS["keyword_gap_score"] +
            rv_qual       * NAVER_TRACK_WEIGHTS["review_quality"] +
            sp_comp       * NAVER_TRACK_WEIGHTS["smart_place_completeness"] +
            nv_exp        * NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"] +
            kakao_com     * NAVER_TRACK_WEIGHTS["kakao_completeness"] +
            ai_tab_ready  * NAVER_TRACK_WEIGHTS["ai_tab_readiness"]
        )

    # 항목별 감점 근거 — TrendLine 이벤트 오버레이 및 score_breakdown JSONB 저장용
    is_sp       = bool(
        naver_data.get("is_smart_place")
        or biz.get("is_smart_place")
        or biz.get("naver_place_id")
    )
    _faq_raw2 = biz.get("talktalk_faq_draft")
    if isinstance(_faq_raw2, dict):
        _has_faq_draft2 = bool(_faq_raw2.get("items"))
    elif isinstance(_faq_raw2, list):
        _has_faq_draft2 = bool(_faq_raw2)
    else:
        _has_faq_draft2 = False
    has_faq         = bool(biz.get("has_faq")) or _has_faq_draft2
    has_recent_post = bool(biz.get("has_recent_post"))
    has_intro       = bool(biz.get("has_intro")) or bool((biz.get("naver_intro_draft") or "").strip())
    _rank           = naver_data.get("my_rank") or naver_data.get("naver_place_rank")
    rank_score = (
        30 if _rank == 1 else
        20 if (_rank and _rank <= 5) else
        12 if (_rank and _rank <= 10) else
        5  if _rank else 0
    )

    missing = []
    if not is_sp:
        missing.append({"item": "스마트플레이스 등록", "gain": 25, "desc": "스마트플레이스 신청"})
    if not has_recent_post:
        missing.append({"item": "소식", "gain": 25, "desc": "이번 주 소식 1개 게시"})
    if not has_intro:
        missing.append({
            "item": "소개글",
            "gain": 20,
            "desc": "300~500자 소개글에 Q&A 형식 5개 포함 (AI 인용 후보)",
        })

    # 사진 카테고리 부족 항목 추가 (점수 변경 없음 — 가이드용 missing 힌트)
    # 단일 진실 소스: services/photo_categories.py
    _photo_categories = naver_data.get("photo_categories") or {}
    if _photo_categories:
        from services.photo_categories import find_missing as _find_missing_photos
        _eff_cat_for_photo = category or biz.get("category", "restaurant")
        for _cat in _find_missing_photos(_photo_categories, _eff_cat_for_photo):
            missing.append({
                "item": f"사진_{_cat}_없음",
                "gain": 0,
                "desc": f"'{_cat}' 카테고리 사진을 등록하면 AI 이미지 필터 노출이 늘어납니다.",
                "type": "photo_category",
            })

    # AI 정보 탭 상태 → missing 리스트 최우선 삽입
    # active: gain 실질적. likely: 현재 미대상 → 미리 준비 안내 (gain 10, 오인 방지)
    if eligibility == "active":
        if ai_status == "off":
            missing.insert(0, {
                "item": "AI 브리핑 노출 설정",
                "gain": 50,
                "desc": "스마트플레이스 → 업체정보 → AI 정보 탭 → 'AI 브리핑 노출하기' ON",
                "priority": "critical",
            })
        elif ai_status == "disabled":
            missing.insert(0, {
                "item": "AI 브리핑 활성화 조건 미달",
                "gain": 30,
                "desc": "리뷰 30개+ 누적 시 자동 활성화. 리뷰 늘리기 우선",
                "priority": "important",
            })
    elif eligibility == "likely":
        if ai_status == "off":
            missing.insert(0, {
                "item": "AI 브리핑 노출 설정 (확대 예정 업종 — 미리 준비)",
                "gain": 10,
                "desc": "네이버 AI 브리핑 확대 예정 업종입니다. 스마트플레이스 → AI 정보 탭 → 설정 ON으로 미리 준비해두세요.",
                "priority": "optional",
            })
        elif ai_status == "unknown":
            missing.insert(0, {
                "item": "AI 정보 탭 상태 확인",
                "gain": 0,
                "desc": "스마트플레이스 → 업체정보 → AI 정보 탭 메뉴 존재 여부 확인",
                "priority": "important",
            })

    track1_detail = {
        "smart_place": {
            "score":               round(sp_comp, 1),
            "is_smart_place":      is_sp,
            "has_recent_post":     has_recent_post,
            "has_intro":           has_intro,
            "rank_score":          rank_score,
            "briefing_eligibility": eligibility,
            "ai_info_tab_status":  ai_status,
            "missing":             missing,
        },
        "keyword_gap": {
            "score":        round(kw_gap, 1),
            "is_estimated": is_estimated,
        },
        "review_quality": {
            "score":        round(rv_qual, 1),
            "review_count": biz.get("review_count", 0) or 0,
            "avg_rating":   biz.get("avg_rating", 0) or 0,
        },
        "briefing_meta": {
            "eligibility":        eligibility,
            "ai_info_tab_status": ai_status,
            "explanation":        _briefing_explanation(eligibility, ai_status),
        },
        "ai_tab_readiness": {
            "score": round(ai_tab_ready, 1),
            "label": get_ai_tab_readiness_label(ai_tab_ready),
        },
    }

    return (round(score, 1), is_estimated, kw_gap, track1_detail)


# ────────────────────────────────────────────────────────────────
# Track 2 계산 함수들
# ────────────────────────────────────────────────────────────────

def calc_multi_ai_exposure(scan_result: dict) -> float:
    """멀티 AI 노출 점수 (0~100).

    v3.0 50/50 듀얼 측정: Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분.
    하위 호환:
      - Gemini sample_size 없으면 100회 기준으로 처리 (sample_100 레거시).
      - ChatGPT sample_size 없으면(Quick/Trial) mentioned boolean 사용.
    """
    gemini = scan_result.get("gemini") or {}
    chatgpt = scan_result.get("chatgpt") or {}

    # Gemini 점수: sample_size 기준 비율 × 45점
    g_n = gemini.get("sample_size") or 100  # 기본값 100 (sample_100 하위 호환)
    g_freq = gemini.get("exposure_freq", 0)
    g_score = (g_freq / max(1, g_n)) * 45.0

    # ChatGPT 점수: sample_size 있으면 비율 계산, 없으면 boolean 폴백
    c_n = chatgpt.get("sample_size") or 0
    if c_n > 0:
        c_freq = chatgpt.get("exposure_freq", 0)
        c_score = (c_freq / c_n) * 45.0
    else:
        # 하위 호환: Quick scan·Trial 등 단일 호출 (boolean only)
        c_score = 45.0 if chatgpt.get("mentioned") else 0.0

    total_90 = g_score + c_score  # 최대 90
    # 100점으로 재배분 (A안 50/50: Gemini 45 + ChatGPT 45 = 90 → 100)
    return min(100.0, round(total_90 * 100.0 / 90.0, 2))


def calc_schema_seo(scan_result: dict, biz: dict) -> float:
    """웹사이트 SEO + JSON-LD + Google Place 구조화 점수 (0~100)"""
    website_check = (
        scan_result.get("website_check")
        or scan_result.get("website_check_result")
        or {}
    )
    score = (
        (40 if website_check.get("has_json_ld")                else 0) +
        (20 if website_check.get("has_schema_local_business")  else 0) +
        (20 if website_check.get("has_open_graph")             else 0) +
        (10 if website_check.get("is_mobile_friendly")          else 0) +
        (10 if biz.get("google_place_id")                      else 0)
    )
    return float(score)


def calc_online_mentions(naver_data: dict) -> float:
    """온라인 언급 점수 (0~100) — naver_visibility.blog_mention_score() 활용

    blog_count 값 구분:
      - None  : 측정 불가(스캔 미실행·API 오류 등) → fallback 5.0 반환
      - 0     : 실측 0건(블로그 언급 없음) → blog_mention_score(0) = 5.0 반환
                (None과 같은 점수지만 의미가 다름: 실측 결과로 처리)
      - 1 이상 : 실측 건수 → blog_mention_score()로 0~100점 매핑
    """
    blog_count = naver_data.get("blog_mentions")
    if blog_count is not None:
        # 실측값 사용 (0건 포함) — blog_mention_score(0)=5.0, 1~5건=20.0, ...
        return blog_mention_score(blog_count)
    # None = 측정 불가 fallback (스캔 미실행 또는 API 오류)
    return 5.0


def _is_google_captcha(scan_result: dict) -> bool:
    """Google 스캐너가 CAPTCHA 차단을 감지했는지 확인"""
    google = scan_result.get("google") or scan_result.get("google_result") or {}
    return bool(google.get("captcha_detected"))


def calc_google_presence(scan_result: dict) -> float:
    """Google AI Overview 노출 점수 (0~100)"""
    google = scan_result.get("google") or scan_result.get("google_result") or {}
    return 100.0 if (google.get("mentioned") or google.get("in_ai_overview")) else 0.0


def calc_track2_score(scan_result: dict, biz: dict, naver_data: dict) -> float:
    """Track 2 — 글로벌 AI 가시성 점수 (0~100)"""
    ai_exp   = calc_multi_ai_exposure(scan_result)
    schema   = calc_schema_seo(scan_result, biz)
    mentions = calc_online_mentions(naver_data)

    if _is_google_captcha(scan_result):
        # Google 측정 불가(CAPTCHA 차단) → 나머지 3개 항목 가중치 합(0.90)으로 재배분해 100점 만점 유지
        google_w = GLOBAL_TRACK_WEIGHTS["google_presence"]  # 0.20 (2026-06-23 상향)
        base_w   = 1.0 - google_w                           # 0.90
        score = (
            ai_exp   * GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] +
            schema   * GLOBAL_TRACK_WEIGHTS["schema_seo"] +
            mentions * GLOBAL_TRACK_WEIGHTS["online_mentions"]
        ) / base_w
    else:
        google = calc_google_presence(scan_result)
        score = (
            ai_exp   * GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] +
            schema   * GLOBAL_TRACK_WEIGHTS["schema_seo"] +
            mentions * GLOBAL_TRACK_WEIGHTS["online_mentions"] +
            google   * GLOBAL_TRACK_WEIGHTS["google_presence"]
        )
    return round(score, 1)


# ────────────────────────────────────────────────────────────────
# 통합 점수 계산 (하위호환 포함)
# ────────────────────────────────────────────────────────────────

def calculate_score(
    scan_result: dict,
    biz: dict = None,
    naver_data: dict = None,
    context: str = "location_based",
    keyword_coverage_rate: float | None = None,
) -> dict:
    """
    AI Visibility Score 계산 (0~100점).

    Args:
        scan_result: AI 스캐너 결과 dict
        biz: 사업장 정보 dict (has_faq, has_recent_post, has_intro 포함)
        naver_data: get_naver_visibility() 반환값
        context: "location_based" | "non_location" (하위호환용, category로 대체)
        keyword_coverage_rate: analyze_keyword_coverage() 결과 (0.0~1.0), None이면 cold start 처리

    Returns:
        {
          total_score, unified_score, track1_score, track2_score,
          naver_weight, global_weight, growth_stage, growth_stage_label,
          is_keyword_estimated, breakdown, grade,
          naver_channel_score (하위호환), global_channel_score (하위호환),
          channel_scores (하위호환)
        }
    """
    if biz is None:
        biz = {}
    if naver_data is None:
        naver_data = {}

    # category 추출 (biz dict 우선, 없으면 context 기반 추정)
    category = biz.get("category") or ""

    # 업종별 듀얼트랙 비율
    ratio = get_dual_track_ratio(category)
    naver_w  = ratio["naver"]
    global_w = ratio["global"]

    # Track 1 계산 (v3.0 / v3.1 토글)
    # 환경변수 SCORE_MODEL_VERSION=v3_1 시 그룹별 6항목 가중치 사용
    # 미설정 시 기존 v3.0 5항목 (하위 호환)
    if SCORE_MODEL_VERSION == "v3_3":
        track1, track1_detail = calc_track1_score_v3_3(
            scan_result, biz, naver_data, keyword_coverage_rate, category
        )
        _sp_item = track1_detail.get("items", {}).get("smart_place_completeness", {})
        is_estimated = bool(_sp_item.get("kw_gap_estimated", False))
        kw_gap = float(_sp_item.get("kw_gap_absorbed", 0.0))
    elif SCORE_MODEL_VERSION == "v3_2":
        track1, track1_detail = calc_track1_score_v3_2(
            scan_result, biz, naver_data, keyword_coverage_rate, category
        )
        _sp_item = track1_detail.get("items", {}).get("smart_place_completeness", {})
        is_estimated = bool(_sp_item.get("kw_gap_estimated", False))
        kw_gap = float(_sp_item.get("kw_gap_absorbed", 0.0))
    elif SCORE_MODEL_VERSION == "v3_1":
        track1, track1_detail = calc_track1_score_v3_1(
            scan_result, biz, naver_data, keyword_coverage_rate, category
        )
        # v3.1 detail에서 v3.0 호환 필드 추출 (breakdown 재사용용)
        _sp_item = track1_detail.get("items", {}).get("smart_place_completeness", {})
        is_estimated = bool(_sp_item.get("kw_gap_estimated", False))
        kw_gap = float(_sp_item.get("kw_gap_absorbed", 0.0))
    else:
        track1, is_estimated, kw_gap, track1_detail = calc_track1_score(
            scan_result, biz, naver_data, keyword_coverage_rate, category
        )

    # Track 2 계산
    track2 = calc_track2_score(scan_result, biz, naver_data)

    # Unified Score
    unified = round(track1 * naver_w + track2 * global_w, 1)

    # 성장 단계 (track1 기준)
    growth_stage       = determine_growth_stage(track1)
    growth_stage_label = determine_growth_stage_label(track1)

    # breakdown (하위호환 — track 세부 항목 포함)
    breakdown = {
        # Track 1 항목
        "keyword_gap_score":        round(kw_gap, 1),
        "review_quality":           round(calc_review_quality(biz), 1),
        "smart_place_completeness": round(calc_smart_place_completeness(naver_data, biz), 1),
        "naver_exposure_confirmed": round(calc_naver_exposure(scan_result), 1),
        "kakao_completeness":       round(calc_kakao_completeness(scan_result, biz), 1),
        # Track 2 항목
        "multi_ai_exposure":        round(calc_multi_ai_exposure(scan_result), 1),
        "schema_seo":               round(calc_schema_seo(scan_result, biz), 1),
        "online_mentions_t2":       round(calc_online_mentions(naver_data), 1),
        "google_presence":          round(calc_google_presence(scan_result), 1),
        "google_captcha_blocked":   _is_google_captcha(scan_result),
        # 항목별 감점 근거 (score_breakdown JSONB 저장, TrendLine 이벤트용)
        "track1_detail":            track1_detail,
        # 하위호환 필드
        "exposure_freq":            (scan_result.get("gemini") or {}).get("exposure_freq", 0),
        "schema_score":             round(calc_schema_seo(scan_result, biz), 1),
        "online_mentions":          round(calc_online_mentions(naver_data), 1),
        "info_completeness":        round(calc_smart_place_completeness(naver_data, biz), 1),
        "content_freshness":        round(_calc_freshness(biz, scan_result), 1),
    }

    # v3.1/v3.2 토글 시 신규 항목 평탄화 (briefing_engine·gap_analyzer·guide_generator 호환)
    if SCORE_MODEL_VERSION in ("v3_1", "v3_2") and isinstance(track1_detail, dict):
        items = track1_detail.get("items") or {}
        for key in ("keyword_search_rank", "blog_crank", "local_map_score", "ai_briefing_score", "naver_ai_tab_visible"):
            item = items.get(key)
            if isinstance(item, dict) and "score" in item:
                breakdown[key] = item["score"]
        breakdown["user_group"] = track1_detail.get("user_group")
        breakdown["model_version"] = track1_detail.get("model_version", "v3.1")

    grade = "A" if unified >= 80 else "B" if unified >= 60 else "C" if unified >= 40 else "D"

    # 하위호환 채널 점수 (기존 컴포넌트용)
    naver_ch  = track1
    global_ch = track2
    gap = abs(naver_ch - global_ch)
    dominant = "balanced" if gap < 10 else ("naver" if naver_ch > global_ch else "global")

    return {
        # v3.0 핵심 필드
        "total_score":           unified,   # unified_score alias (하위호환)
        "unified_score":         unified,
        "track1_score":          track1,
        "track2_score":          track2,
        "naver_weight":          naver_w,
        "global_weight":         global_w,
        "growth_stage":          growth_stage,
        "growth_stage_label":    growth_stage_label,
        "is_keyword_estimated":  is_estimated,
        "breakdown":             breakdown,
        "grade":                 grade,
        # 하위호환 채널 점수
        "naver_channel_score":   round(naver_ch, 1),
        "global_channel_score":  round(global_ch, 1),
        "channel_scores": {
            "naver_channel":   round(naver_ch, 1),
            "global_channel":  round(global_ch, 1),
            "dominant_channel": dominant,
            "channel_gap":     round(gap, 1),
        },
        "context": context,
        # AI 정보 탭 메타 (프론트엔드 설정 안내 배너용)
        "briefing_eligibility":  get_briefing_eligibility(category, bool(biz.get("is_franchise"))),
        "ai_info_tab_status":    biz.get("ai_info_tab_status", "unknown"),
        "is_franchise":          bool(biz.get("is_franchise")),
    }


def _calc_freshness(biz: dict, scan_result: dict = None) -> float:
    """콘텐츠 최신성 점수 계산 (0~100) — 하위호환용"""
    from datetime import datetime, timezone

    score = 50.0
    if scan_result is None:
        return biz.get("freshness_score", score)

    last_scan_at = scan_result.get("scanned_at")
    if last_scan_at:
        try:
            scanned = datetime.fromisoformat(last_scan_at.replace("Z", "+00:00"))
            days_old = (datetime.now(timezone.utc) - scanned).days
            if days_old <= 7:
                score += 20
            elif days_old <= 30:
                score += 10
            elif days_old > 90:
                score -= 20
        except Exception as e:
            _logger.warning(f"freshness datetime parse failed: {e}")

    naver_result = scan_result.get("naver_result") or {}
    recent_review_days = naver_result.get("recent_review_days")
    if recent_review_days is not None:
        if recent_review_days <= 7:
            score += 20
        elif recent_review_days <= 30:
            score += 10
        elif recent_review_days > 180:
            score -= 15

    return max(0.0, min(100.0, score))


def get_weights_for_context(context: str) -> dict:
    """
    context별 DimensionGap 가중치 반환 — gap_analyzer.py에서 사용.

    v3.0 정합성:
    - location_based → Track1 차원은 NAVER_TRACK_WEIGHTS, Track2 차원은 GLOBAL_TRACK_WEIGHTS 사용
    - non_location   → Track2 가중치를 기준으로, Track1 차원 가중치는 절반으로 축소
    - DualTrackCard 점수 비중과 DimensionGap 우선순위가 일치하도록 맞춤

    dimension_key 매핑:
      exposure_freq     ← naver_exposure_confirmed (Track1) + multi_ai_exposure (Track2) 혼합
      review_quality    ← review_quality (Track1)
      schema_score      ← schema_seo (Track2)
      online_mentions   ← online_mentions (Track2)
      info_completeness ← smart_place_completeness (Track1)
      content_freshness ← 점수 배분 없음 (최신성 보조 지표, 0.05 고정)
    """
    if context == "non_location":
        # non_location: 글로벌 AI 위주 → Track2 가중치 중심. 합계 1.00 정규화
        raw_nl = {
            "keyword_gap_score":        NAVER_TRACK_WEIGHTS["keyword_gap_score"] * 0.5,
            "review_quality":           NAVER_TRACK_WEIGHTS["review_quality"] * 0.5,
            "smart_place_completeness": NAVER_TRACK_WEIGHTS["smart_place_completeness"] * 0.5,
            "naver_exposure_confirmed": NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"] * 0.5,
            "multi_ai_exposure":        GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"],
            "schema_seo":               GLOBAL_TRACK_WEIGHTS["schema_seo"],
        }
        total_nl = sum(raw_nl.values())
        return {k: round(v / total_nl, 4) for k, v in raw_nl.items()}
    else:
        # location_based (기본): 네이버 중심 → Track1 전체 + Track2 혼합. 합계 1.00 정규화
        raw = {
            "keyword_gap_score":        NAVER_TRACK_WEIGHTS["keyword_gap_score"],          # 0.30
            "review_quality":           NAVER_TRACK_WEIGHTS["review_quality"],             # 0.25
            "smart_place_completeness": NAVER_TRACK_WEIGHTS["smart_place_completeness"],   # 0.15
            "naver_exposure_confirmed": NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"],   # 0.15
            "kakao_completeness":       NAVER_TRACK_WEIGHTS["kakao_completeness"],         # 0.10
            "ai_tab_readiness":         NAVER_TRACK_WEIGHTS["ai_tab_readiness"],           # 0.05
            "multi_ai_exposure":        GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] * 0.5,  # 0.20
            "schema_seo":               GLOBAL_TRACK_WEIGHTS["schema_seo"] * 0.5,         # 0.15
        }
        total = sum(raw.values())  # 1.35 → 정규화
        return {k: round(v / total, 4) for k, v in raw.items()}


# ════════════════════════════════════════════════════════════════
# v3.1 그룹별 가중치 점수 모델 (service_unification_v1.0.md §3.2)
# 환경변수 SCORE_MODEL_VERSION=v3_1 활성화 시 calculate_score()에서 사용
# 미설정 시 기존 v3.0 NAVER_TRACK_WEIGHTS 사용 (하위 호환)
# ════════════════════════════════════════════════════════════════

# 그룹별 6항목 가중치 (Track1 = 100% 기준, 합계 1.0 검증 필수)
NAVER_TRACK_WEIGHTS_V3_1: dict[str, dict[str, float]] = {
    "ACTIVE": {
        "keyword_search_rank":      0.25,  # Playwright 실측 키워드 순위 (Phase A-2 신규)
        "review_quality":           0.15,  # calc_review_quality 자산 보존 (감축)
        "smart_place_completeness": 0.15,  # smart_place + keyword_gap 콘텐츠 매칭 흡수
        "blog_crank":               0.10,  # 블로그 C-rank 추정 (분리)
        "local_map_score":          0.10,  # 네이버 지도 + 카카오맵 통합
        "ai_briefing_score":        0.25,  # AI 브리핑 인용 (확장)
    },
    "LIKELY": {
        "keyword_search_rank":      0.30,
        "review_quality":           0.17,
        "smart_place_completeness": 0.18,
        "blog_crank":               0.10,
        "local_map_score":          0.10,
        "ai_briefing_score":        0.15,
    },
    "INACTIVE": {
        "keyword_search_rank":      0.35,
        "review_quality":           0.20,
        "smart_place_completeness": 0.20,
        "blog_crank":               0.10,
        "local_map_score":          0.15,
        "ai_briefing_score":        0.00,
    },
}


def _validate_v3_1_weights() -> None:
    """v3.1 가중치 합 100% 자동 검증 (calc_smart_place_completeness 90점 버그 재발 방지)."""
    for group, weights in NAVER_TRACK_WEIGHTS_V3_1.items():
        total = sum(weights.values())
        if abs(total - 1.0) > 0.001:
            raise ValueError(
                f"NAVER_TRACK_WEIGHTS_V3_1[{group}] 합계 {total:.3f} != 1.0"
            )


# 모듈 import 시 자동 검증 (출시 전 가중치 누락 방지)
_validate_v3_1_weights()


# ════════════════════════════════════════════════════════════════
# v3.2 그룹별 가중치 점수 모델 (naver_ai_search_optimization_plan_v1.0.md §M3-2)
# 환경변수 SCORE_MODEL_VERSION=v3_2 활성화 시 사용
# 6월 AI탭 전체 확대 이후 활성화 권장
# naver_ai_tab_visible: in_ai_tab 실측 데이터 기반 점수 (M1-1에서 수집 시작)
# ════════════════════════════════════════════════════════════════
NAVER_TRACK_WEIGHTS_V3_2: dict[str, dict[str, float]] = {
    "ACTIVE": {
        "keyword_search_rank":      0.25,
        "review_quality":           0.15,
        "smart_place_completeness": 0.15,
        "blog_crank":               0.10,
        "local_map_score":          0.10,
        "ai_briefing_score":        0.20,  # 0.25 → 0.20 (naver_ai_tab_visible 분리)
        "naver_ai_tab_visible":     0.05,  # 신규 — AI탭 노출 실측 (A그룹)
    },
    "LIKELY": {
        "keyword_search_rank":      0.25,  # 0.30 → 0.25
        "review_quality":           0.17,
        "smart_place_completeness": 0.18,
        "blog_crank":               0.10,
        "local_map_score":          0.10,
        "ai_briefing_score":        0.10,  # 0.15 → 0.10
        "naver_ai_tab_visible":     0.10,  # 신규 — AI탭 노출 실측 (B그룹)
    },
    "INACTIVE": {
        "keyword_search_rank":      0.25,  # 0.35 → 0.25
        "review_quality":           0.20,
        "smart_place_completeness": 0.20,
        "blog_crank":               0.05,  # 0.10 → 0.05
        "local_map_score":          0.15,
        "ai_briefing_score":        0.00,
        "naver_ai_tab_visible":     0.15,  # 신규 — AI탭 노출 실측 (C·D그룹)
    },
}


def _validate_v3_2_weights() -> None:
    """v3.2 가중치 합 100% 자동 검증."""
    for group, weights in NAVER_TRACK_WEIGHTS_V3_2.items():
        total = sum(weights.values())
        if abs(total - 1.0) > 0.001:
            raise ValueError(
                f"NAVER_TRACK_WEIGHTS_V3_2[{group}] 합계 {total:.3f} != 1.0"
            )


_validate_v3_2_weights()


def get_user_group(category: str, is_franchise: bool = False) -> str:
    """
    사용자 그룹 분류 (ACTIVE / LIKELY / INACTIVE).
    프랜차이즈는 ACTIVE 업종이어도 INACTIVE 처리 (네이버 공식 2026-04-30).

    get_briefing_eligibility()와 매핑:
        active → ACTIVE / likely → LIKELY / inactive → INACTIVE

    businesses.user_group 캐시 컬럼과 동일한 분류 규칙.
    """
    return get_briefing_eligibility(category, is_franchise).upper()


def calc_blog_crank_score(naver_data: dict, biz: dict) -> float:
    """
    블로그 C-rank 추정 점수 (0~100).
    가중치: 발행 빈도 0.4 + 외부 인용 0.3 + 업체명 매칭 0.3.
    실제 C-rank는 네이버 비공개 — 사용자 화면에 "(추정)" 명시 필수.

    발행 빈도·외부 인용: blog_mentions 실측 총 건수 기반 (100건=만점, 300건=외부인용 만점).
    업체명 매칭: top_blogs 5건에서 업체명 포함 여부 확인.
    """
    top_blogs   = naver_data.get("top_blogs") or []
    blog_count  = int(naver_data.get("blog_mentions") or 0)

    if blog_count == 0 and not top_blogs:
        return 0.0  # 블로그 미발견

    # blog_count=0이지만 top_blogs가 있는 경우: publish_freq·external_cite=0 → name_match만 반영 (최대 30점)
    # naver_visibility API가 총 건수 집계에 실패해도 포스트 목록은 가져온 경우 발생 가능

    # 발행 빈도 — blog_mentions 실측 총 건수 기반 (100건 이상 = 만점)
    publish_freq = min(1.0, blog_count / 100.0)

    # 외부 인용 추정 — blog_mentions 기반 (300건 이상 = 만점)
    external_cite = min(1.0, blog_count / 300.0)

    # 업체명 매칭률 — top_blogs에서 확인
    biz_name = (biz.get("name") or "").lower()
    if biz_name and top_blogs:
        match_count = sum(
            1 for b in top_blogs
            if isinstance(b, dict)
            and biz_name in (
                str(b.get("title", "")) + str(b.get("description", ""))
            ).lower()
        )
        name_match = match_count / max(len(top_blogs), 1)
    elif biz_name and blog_count > 0:
        # top_blogs 없으면 건수로 매칭 추정 (5건 이상이면 매칭 있다고 가정)
        name_match = min(1.0, blog_count / 5.0)
    else:
        name_match = 0.0

    score = (publish_freq * 0.4 + external_cite * 0.3 + name_match * 0.3) * 100
    return min(100.0, score)


def calc_local_map_score(scan_result: dict, biz: dict, naver_data: dict) -> float:
    """
    지도/플레이스 + 카카오맵 통합 점수 (0~100).
    네이버 지도 순위 50% + 카카오맵 완성도 50%.
    """
    naver_rank = naver_data.get("my_rank") or naver_data.get("naver_place_rank")
    naver_map_score = (
        100.0 if naver_rank == 1 else
        80.0  if (naver_rank and naver_rank <= 3) else
        60.0  if (naver_rank and naver_rank <= 5) else
        40.0  if (naver_rank and naver_rank <= 10) else
        20.0  if naver_rank else 0.0
    )
    kakao_score = calc_kakao_completeness(scan_result, biz)
    return naver_map_score * 0.5 + kakao_score * 0.5


def calc_keyword_search_rank_score(scan_result: dict) -> tuple[float, bool]:
    """
    네이버 키워드 검색 노출 점수 (0~100).
    Phase A-2 naver_keyword_rank.py가 채울 scan_results.keyword_ranks 활용.

    반환: (score, is_measured)
        is_measured=False → 측정 데이터 없음 → UI "아직 측정 데이터 없음" 표시 + 가짜 수치 금지

    채점 (PC·모바일·플레이스 중 최저 순위 사용):
        1위=100 / 2~3위=80 / 4~10위=60 / 11~20위=40 / 미노출=0
    여러 키워드 평균.
    """
    keyword_ranks = scan_result.get("keyword_ranks") or {}
    if not keyword_ranks:
        return (0.0, False)

    scores = []
    for _kw, data in keyword_ranks.items():
        if not isinstance(data, dict):
            continue
        ranks = [
            data.get("pc_rank"),
            data.get("mobile_rank"),
            data.get("place_rank"),
        ]
        ranks = [r for r in ranks if isinstance(r, (int, float)) and r > 0]
        if not ranks:
            scores.append(0.0)
            continue
        best = min(ranks)
        scores.append(
            100.0 if best == 1 else
            80.0  if best <= 3 else
            60.0  if best <= 10 else
            40.0  if best <= 20 else
            0.0
        )

    if not scores:
        return (0.0, False)
    return (sum(scores) / len(scores), True)


def calc_naver_ai_tab_visible_score(scan_result: dict) -> float:
    """AI탭 노출 실측 점수 (0~100).

    M3-2: SCORE_MODEL_VERSION=v3_2 활성화 시 Track1에 추가.
    in_ai_tab=True: 100점. in_ai_tab=False 또는 미측정: 0점.
    허위 수치 금지 — 미측정 시 반드시 0 반환.
    """
    naver_result = scan_result.get("naver_result") or {}
    if isinstance(naver_result, dict):
        if naver_result.get("in_ai_tab"):
            return 100.0
        kw_results = naver_result.get("keyword_results") or []
        if any(isinstance(r, dict) and r.get("in_ai_tab") for r in kw_results):
            return 100.0
    return 0.0


def calc_track1_score_v3_1(
    scan_result: dict,
    biz: dict,
    naver_data: dict,
    keyword_coverage_rate: float | None = None,
    category: str = "",
) -> tuple[float, dict]:
    """
    v3.1 Track1 점수 — 그룹별 가중치 재분배 (service_unification_v1.0.md §3.2).

    호환성:
        - 기존 calc_track1_score()와 동일 입력 시그니처
        - 반환만 (score, detail) 2-tuple로 단순화 (기존은 4-tuple)
        - 환경변수 SCORE_MODEL_VERSION=v3_1 활성화 시 calculate_score에서 호출

    매핑 (v3.0 → v3.1):
        keyword_gap_score 35% → smart_place(콘텐츠 매칭 30%) 흡수 + keyword_search 신규 분리
        review_quality 25%    → 15~20% 감축 (calc_review_quality 함수 보존)
        smart_place 15%       → 15~20% 확장 (콘텐츠 매칭 흡수)
        naver_exposure 15%    → ai_briefing 25% 확장 (calc_naver_exposure 보존)
        kakao_completeness 10% → local_map_score에 통합
    """
    _eff_category = category or biz.get("category") or ""
    user_group = get_user_group(_eff_category, bool(biz.get("is_franchise")))
    weights = NAVER_TRACK_WEIGHTS_V3_1[user_group]

    # 6항목 점수
    kw_search, kw_measured = calc_keyword_search_rank_score(scan_result)
    rv_qual = calc_review_quality(biz)
    sp_base = calc_smart_place_completeness(naver_data, biz)
    kw_gap, kw_is_est = _resolve_keyword_gap_score(
        keyword_coverage_rate, naver_data, biz, _eff_category
    )
    sp_comp = sp_base * 0.7 + kw_gap * 0.3  # 콘텐츠 매칭 흡수
    blog_crank = calc_blog_crank_score(naver_data, biz)
    local_map = calc_local_map_score(scan_result, biz, naver_data)
    ai_brief = calc_naver_exposure(scan_result)

    score = (
        kw_search  * weights["keyword_search_rank"] +
        rv_qual    * weights["review_quality"] +
        sp_comp    * weights["smart_place_completeness"] +
        blog_crank * weights["blog_crank"] +
        local_map  * weights["local_map_score"] +
        ai_brief   * weights["ai_briefing_score"]
    )

    detail = {
        "user_group":    user_group,
        "model_version": "v3.1",
        "weights":       weights,
        "items": {
            "keyword_search_rank":      {"score": round(kw_search, 1),  "measured": kw_measured},
            "review_quality":           {"score": round(rv_qual, 1)},
            "smart_place_completeness": {"score": round(sp_comp, 1),    "kw_gap_absorbed": round(kw_gap, 1), "kw_gap_estimated": kw_is_est},
            "blog_crank":               {"score": round(blog_crank, 1), "is_estimated": True},
            "local_map_score":          {"score": round(local_map, 1)},
            "ai_briefing_score":        {"score": round(ai_brief, 1)},
        },
    }
    return (round(score, 2), detail)


# ════════════════════════════════════════════════════════════════
# Shadow 모드 — v3.0 운영 중 v3.1 점수 병렬 계산 (비교 데이터 누적)
# 환경변수 SCORE_MODEL_VERSION 무관, 항상 v3.1 로직 적용
# 호출처: daily_scan_all 잡, scan.py 사용자 트리거 스캔
# ════════════════════════════════════════════════════════════════

def calc_shadow_v3_1(
    scan_result: dict,
    biz: dict,
    naver_data: dict | None = None,
    keyword_coverage_rate: float | None = None,
) -> dict:
    """v3.0 운영 중에도 v3.1 점수를 동시 계산 (Shadow 모드).

    환경변수 SCORE_MODEL_VERSION 무관, 항상 v3.1 로직 적용.
    호출처: daily_scan_all, scan.py 에서 v3.0 점수 계산 직후 별도 호출.

    Args:
        scan_result: AI 스캐너 결과 dict (gemini/chatgpt/naver/google 키 포함)
        biz: 사업장 정보 dict (category, is_franchise, keywords 등)
        naver_data: naver_result dict. None 이면 scan_result["naver"] 에서 자동 추출
        keyword_coverage_rate: blog keyword coverage (0.0~1.0), None 이면 cold start

    Returns:
        {
            "track1_score_v31": float,
            "unified_score_v31": float,
            "user_group_v31": str,  # "ACTIVE"|"LIKELY"|"INACTIVE" (대문자)
            "track1_detail_v31": dict,  # 6항목 세부 점수
        }
    """
    if biz is None:
        biz = {}
    _naver_data = naver_data if naver_data is not None else (scan_result.get("naver") or {})
    category = biz.get("category") or ""

    # v3.1 Track1 계산 (기존 함수 사용)
    track1_v31, track1_detail_v31 = calc_track1_score_v3_1(
        scan_result=scan_result,
        biz=biz,
        naver_data=_naver_data,
        keyword_coverage_rate=keyword_coverage_rate,
        category=category,
    )

    # Track2 는 v3.0/v3.1 공통 (AI 노출 점수 — 모델 버전 무관)
    track2_score = calc_track2_score(scan_result, biz, _naver_data)

    # 업종별 듀얼트랙 비율 적용
    ratio = DUAL_TRACK_RATIO.get(normalize_category(category), DEFAULT_DUAL_TRACK_RATIO)
    unified_v31 = round(track1_v31 * ratio["naver"] + track2_score * ratio["global"], 1)

    # 사용자 그룹 분류 (프랜차이즈 → INACTIVE)
    user_group = get_user_group(category, bool(biz.get("is_franchise", False)))

    return {
        "track1_score_v31": round(track1_v31, 2),
        "unified_score_v31": unified_v31,
        "user_group_v31": user_group,
        "track1_detail_v31": track1_detail_v31,
    }


def calc_track1_score_v3_2(
    scan_result: dict,
    biz: dict,
    naver_data: dict,
    keyword_coverage_rate: float | None = None,
    category: str = "",
) -> tuple[float, dict]:
    """v3.2 Track1 점수 — v3.1에 naver_ai_tab_visible 항목 추가.

    SCORE_MODEL_VERSION=v3_2 활성화 시 calculate_score()에서 호출.
    6월 AI탭 전체 확대 이후 활성화 권장.
    """
    _eff_category = category or biz.get("category") or ""
    user_group = get_user_group(_eff_category, bool(biz.get("is_franchise")))
    weights = NAVER_TRACK_WEIGHTS_V3_2[user_group]

    kw_search, kw_measured = calc_keyword_search_rank_score(scan_result)
    rv_qual = calc_review_quality(biz)
    sp_base = calc_smart_place_completeness(naver_data, biz)
    kw_gap, kw_is_est = _resolve_keyword_gap_score(
        keyword_coverage_rate, naver_data, biz, _eff_category
    )
    sp_comp = sp_base * 0.7 + kw_gap * 0.3
    blog_crank = calc_blog_crank_score(naver_data, biz)
    local_map = calc_local_map_score(scan_result, biz, naver_data)
    ai_brief = calc_naver_exposure(scan_result)
    ai_tab_visible = calc_naver_ai_tab_visible_score(scan_result)

    score = (
        kw_search      * weights["keyword_search_rank"] +
        rv_qual        * weights["review_quality"] +
        sp_comp        * weights["smart_place_completeness"] +
        blog_crank     * weights["blog_crank"] +
        local_map      * weights["local_map_score"] +
        ai_brief       * weights["ai_briefing_score"] +
        ai_tab_visible * weights["naver_ai_tab_visible"]
    )

    detail = {
        "user_group":    user_group,
        "model_version": "v3.2",
        "weights":       weights,
        "items": {
            "keyword_search_rank":      {"score": round(kw_search, 1),  "measured": kw_measured},
            "review_quality":           {"score": round(rv_qual, 1)},
            "smart_place_completeness": {"score": round(sp_comp, 1),    "kw_gap_absorbed": round(kw_gap, 1), "kw_gap_estimated": kw_is_est},
            "blog_crank":               {"score": round(blog_crank, 1), "is_estimated": True},
            "local_map_score":          {"score": round(local_map, 1)},
            "ai_briefing_score":        {"score": round(ai_brief, 1)},
            "naver_ai_tab_visible":     {"score": round(ai_tab_visible, 1)},
        },
    }
    return (round(score, 2), detail)


def calc_naver_multich_score(scan_result: dict) -> dict:
    """P3 멀티채널(카페·지식인) 언급 점수 유틸 (선행 구현 — 2026-05-25).

    NAVER_MULTICH_ENABLED=true + 구독자 20명 이후 v3.3에서 Track1에 연결 예정.
    현재는 score에 미반영 — 진단 보조 데이터로만 사용.
    """
    naver_result = scan_result.get("naver_result") or {}
    cafe_data = naver_result.get("cafe_result") or {}
    jisik_data = naver_result.get("jisik_result") or {}

    cafe_mentioned = bool(cafe_data.get("mentioned"))
    cafe_count = int(cafe_data.get("mention_count") or 0)
    cafe_score = float(cafe_data.get("exposure_score") or 0.0)

    jisik_mentioned = bool(jisik_data.get("mentioned"))
    jisik_count = int(jisik_data.get("mention_count") or 0)
    jisik_score = float(jisik_data.get("exposure_score") or 0.0)

    # 보너스: 카페 5점 + 지식인 5점 상한 (v3.3 Track1 연결 시 가중치로 대체 예정)
    cafe_bonus = min(5.0, cafe_score * 0.05)
    jisik_bonus = min(5.0, jisik_score * 0.05)
    multich_bonus = round(cafe_bonus + jisik_bonus, 2)

    return {
        "cafe_mentioned": cafe_mentioned,
        "cafe_mention_count": cafe_count,
        "cafe_score": cafe_score,
        "jisik_mentioned": jisik_mentioned,
        "jisik_mention_count": jisik_count,
        "jisik_score": jisik_score,
        "multich_bonus": multich_bonus,
    }


def calc_track1_score_v3_3(
    scan_result: dict,
    biz: dict,
    naver_data: dict,
    keyword_coverage_rate: float | None = None,
    category: str = "",
) -> tuple[float, dict]:
    """v3.3 Track1 점수 — v3.2 기반 + 카페·지식인 멀티채널 보너스.

    활성화 조건: NAVER_MULTICH_ENABLED=true AND SCORE_MODEL_VERSION=v3_3
    구독자 20명 도달 후 calculate_score()에서 호출.
    보너스 최대 +10점 (카페 5 + 지식인 5), 상한 100점.
    """
    base_score, base_detail = calc_track1_score_v3_2(
        scan_result, biz, naver_data, keyword_coverage_rate, category
    )
    multich = calc_naver_multich_score(scan_result)
    bonus = multich["multich_bonus"]
    final_score = round(min(100.0, base_score + bonus), 2)

    detail = {
        **base_detail,
        "model_version": "v3.3",
        "multich_bonus": bonus,
        "multich_detail": {
            "cafe_mentioned": multich["cafe_mentioned"],
            "cafe_mention_count": multich["cafe_mention_count"],
            "jisik_mentioned": multich["jisik_mentioned"],
            "jisik_mention_count": multich["jisik_mention_count"],
        },
    }
    return (final_score, detail)
