# AEOlab 도메인 모델 시스템

> 버전: 2.7 | 작성일: 2026-03-29 | 최종 수정일: 2026-03-30
> 소상공인의 사고방식을 기준으로 설계한 4-도메인 모델 (ScanContext 분기 반영)

---

## 버전 변경 이력

| 버전 | 날짜 | 핵심 변경 |
|------|------|-----------|
| 2.4 | 2026-03-29 | 소상공인 관점 피드백 전면 반영 — 리뷰 도구 강화, 채널 분리 점수, 글로벌 AI 차단 리스크 |
| **2.5** | 2026-03-30 | **업종별 키워드 분류 체계 도입 — "추상 점수"에서 "구체 키워드 행동"으로 전환** |
| **2.6** | 2026-03-30 | **AI 브리핑 직접 관리 4-경로 엔진 — 고객 리뷰 없이도 오늘 당장 AI 신호 강화** |
| **2.7** | 2026-03-30 | **가이드 페이지 전면 개편 — v2.5·v2.6 백엔드 데이터 프론트엔드 노출 완료** |

---

## 목차

1. [설계 원칙](#1-설계-원칙)
2. [ScanContext — 위치 기반 vs 위치 무관](#2-scancontext--위치-기반-vs-위치-무관)
3. [전체 구조](#3-전체-구조)
4. [핵심 엔티티](#4-핵심-엔티티)
5. [Domain 1 — DiagnosisReport (진단 리포트)](#5-domain-1--diagnosisreport-진단-리포트)
6. [Domain 2 — MarketLandscape (시장 현황)](#6-domain-2--marketlandscape-시장-현황)
7. [Domain 3 — GapAnalysis (격차 분석)](#7-domain-3--gapanalysis-격차-분석)
8. [Domain 4 — ActionPlan (실행 계획)](#8-domain-4--actionplan-실행-계획)
9. [업종별 키워드 분류 체계 (v2.5 신규)](#9-업종별-키워드-분류-체계-v25-신규)
10. [AI 브리핑 직접 관리 경로 엔진 (v2.6 신규)](#10-ai-브리핑-직접-관리-경로-엔진-v26-신규)
11. [성장 단계 모델 (v2.5 신규)](#11-성장-단계-모델-v25-신규)
12. [점수 계산 시스템](#12-점수-계산-시스템)
13. [데이터 흐름](#13-데이터-흐름)
14. [DB 테이블 매핑](#14-db-테이블-매핑)
15. [API 엔드포인트 매핑](#15-api-엔드포인트-매핑)
16. [구현 현황](#16-구현-현황)

---

## 1. 설계 원칙

### 소상공인의 4가지 질문 → 4개 도메인

```
소상공인 질문                         도메인
──────────────────────────────────────────────────────
"내 가게 지금 어때?"            →    DiagnosisReport
"근처 같은 업종 가게들은?"      →    MarketLandscape
"1위 가게랑 나랑 뭐가 달라?"    →    GapAnalysis
"뭘 어떻게 직접 해야 해?"       →    ActionPlan
```

### v2.5 설계 철학 전환 — "점수"에서 "행동"으로

v2.4까지의 문제: "리뷰 품질 점수가 낮습니다"라는 말은 소상공인에게 **무의미**했다.
v2.5 이후의 기준:

```
기존 (v2.4)                           개선 (v2.5+)
────────────────────────────────────────────────────────────────
"리뷰 품질 -15점"               →    "이 키워드 3개가 리뷰에 없어서
                                       AI 조건 검색에 안 나옵니다"

"기대 효과 +15~25%"             →    금지. 근거 없는 수치 예측 제거.
(AI가 지어낸 수치)                    구체적 행동 + 그 이유로만 설명

"AI 브리핑 노출 개선 방법"       →    "오늘 스마트플레이스에 FAQ 5개를
(막연한 방향)                          올리면 됩니다. 문구는 이것입니다:"
```

### 원칙

- **도메인 언어 일치**: 코드 어디서든 소상공인이 이해할 수 있는 용어 사용
- **단방향 의존**: `DiagnosisReport → MarketLandscape → GapAnalysis → ActionPlan`
- **불변 분리**: 원시 스캔 데이터(`scan_results`)와 도메인 모델은 분리
- **플랜별 접근**: `plan_gate.py`가 각 도메인 접근 권한 제어
- **ScanContext 분기**: 모델 구조는 단일, `context` 필드에 따라 필드·가중치·실행 방향 분기
- **근거 기반 가이드**: 수치 예측(`+N%`) 금지 — Claude 프롬프트 레벨에서 강제

---

## 2. ScanContext — 위치 기반 vs 위치 무관

### 개요

사업 형태에 따라 **AI 검색 쿼리 방식, 경쟁 범위, 핵심 채널, 점수 가중치**가 달라집니다.
모델 구조(4개 도메인)는 동일하되, `ScanContext` 값에 따라 내부 동작이 분기됩니다.

### 비교표

| 항목 | `location_based` (위치 기반) | `non_location` (위치 무관) |
|------|---------------------------|--------------------------|
| **사업 예시** | 카페, 식당, 병원, 미용실, 학원 | 변호사, 회계사, 온라인몰, 강사 |
| **AI 검색 쿼리** | `"{지역} {업종} 추천"` | `"{서비스명} 추천"`, `"{업종} 전문가"` |
| **경쟁 범위** | 같은 지역 동종업체 | 전국 단위 |
| **region 필드** | 필수 | 없음 (`None`) |
| **핵심 채널** | 네이버 스마트플레이스, 카카오맵 | 웹사이트, Google AI, ChatGPT |
| **naver_detail** | 항상 수집 | `None` |
| **schema_score 기준** | 스마트플레이스(60점) + 웹사이트(40점) | 웹사이트+JSON-LD(80점) + Google Place(20점) |
| **smart_place_checklist** | 생성 | `None` |
| **naver_post_template** | 생성 | `None` |
| **keyword_gap** (v2.5) | 계산 (네이버 AI 브리핑이 핵심) | `None` |
| **MarketLandscape 기준** | `category + region` 필터 | `category` 전국 필터 |

### Python Enum

```python
# backend/models/context.py

from enum import Enum

class ScanContext(str, Enum):
    LOCATION_BASED = "location_based"   # 오프라인 매장 — 지역 기반 경쟁
    NON_LOCATION   = "non_location"     # 온라인/전문직 — 위치 무관 전국 경쟁
```

### TypeScript

```typescript
// frontend/types/context.ts
export type ScanContext = "location_based" | "non_location";
```

### context별 동작 분기 요약

```
ScanContext.LOCATION_BASED
  ├─ AI 쿼리:       "{region} {category} 추천"
  ├─ 네이버:        스마트플레이스 + 블로그 + 카카오맵 수집
  ├─ 경쟁 비교:     같은 region + category 기준
  ├─ schema_score:  is_smart_place(60) + website(40)
  ├─ keyword_gap:   업종별 키워드 분류 체계로 리뷰 키워드 격차 분석 (v2.5)
  └─ ActionTools:   smart_place_checklist, naver_post_template,
                    smart_place_faq_answers, direct_briefing_paths 생성 (v2.6)

ScanContext.NON_LOCATION
  ├─ AI 쿼리:       "{keyword} 추천" 또는 "{category} 전문가"
  ├─ 네이버:        수집 생략 (naver_detail = None)
  ├─ 경쟁 비교:     전국 category 기준
  ├─ schema_score:  website+JSON-LD(80) + google_place(20)
  ├─ keyword_gap:   None (네이버 AI 브리핑 비해당)
  └─ ActionTools:   seo_checklist 생성, smart_place_checklist = None
```

---

## 3. 전체 구조

```
Business (사업장 — 핵심 엔티티)
  │
  ├─ [스캔 실행] ──────────────────────────────────────────────┐
  │                                                             │
  │   DiagnosisReport (진단 리포트)                            │
  │   ├─ BusinessSnapshot     내 가게 기본 현황                 │ 입력
  │   ├─ AIVisibility         8개 AI 플랫폼 노출 현황          │
  │   ├─ ChannelScores        네이버 채널 vs 글로벌 AI 채널    │
  │   ├─ WebsiteHealth        웹사이트 SEO 체크리스트          │
  │   └─ ScoreResult          종합 점수 + 6항목 세부 점수      │
  │           │                                                 │
  │           ▼                                                 │
  │   MarketLandscape (시장 현황)                               │
  │   ├─ MarketPosition       내 순위 / 업종 평균 / 상위 10%   │
  │   ├─ CompetitorProfile[]  경쟁 가게별 현황                 │
  │   └─ MarketDistribution   업종 점수 분포                   │
  │           │                                                 │
  │           ▼                                                 │
  │   GapAnalysis (격차 분석)                                   │
  │   ├─ DimensionGap[]       6항목별 격차 + 원인 + 우선순위   │
  │   ├─ CompetitorGap        1위와의 격차 요약                 │
  │   ├─ ReviewKeywordGap     리뷰 키워드 격차 (v2.5 신규)     │ ← 네이버 AI 브리핑 직결
  │   ├─ GrowthStage          성장 단계 + 이번 주 할 일 (v2.5) │
  │   └─ gap_card_url         공유 이미지 URL                  │
  │           │                                                 │
  │           └───────────────────────────────────────────────┘
  │                           ▼
  │           ActionPlan (실행 계획)
  │           ├─ ActionItem[]      우선순위별 개선 항목
  │           └─ ActionTools       직접 활용 가능한 도구
  │               ├─ json_ld_schema             JSON-LD 코드
  │               ├─ faq_list                   AI 검색 최적화 FAQ
  │               ├─ keyword_list               핵심 키워드 목록
  │               ├─ blog_post_template         블로그 포스팅 초안
  │               ├─ review_response_drafts     리뷰 답변 초안 3종 (v2.4)
  │               ├─ review_request_message     QR 리뷰 유도 문구
  │               ├─ smart_place_faq_answers    스마트플레이스 Q&A 초안
  │               ├─ naver_post_template        스마트플레이스 '소식' 초안
  │               ├─ direct_briefing_paths[]    AI 브리핑 직접 관리 4경로 (v2.6)
  │               └─ briefing_summary           브리핑 현황 배너 문구 (v2.6)
  │
  └─ [이력 조회]
          ↓
      DiagnosisReport[] (30일 추세)
```

---

## 4. 핵심 엔티티

핵심 엔티티는 도메인이 아닌 영속 데이터입니다. 도메인 모델의 입력값이 됩니다.

### 4.1 Business (사업장)

```python
# backend/models/entities.py

class Business(BaseModel):
    id: str
    user_id: str
    name: str
    category: str           # restaurant | cafe | clinic | academy | beauty | legal | shopping | ...
    business_type: str      # location_based | non_location
    region: Optional[str]   # 오프라인 사업장 필수

    address: Optional[str]
    phone: Optional[str]
    website_url: Optional[str]
    keywords: Optional[List[str]]

    # 플랫폼 등록 현황
    naver_place_id: Optional[str]
    google_place_id: Optional[str]
    kakao_place_id: Optional[str]

    # 리뷰 메타 (스캔 시 수집)
    review_count: int = 0
    avg_rating: float = 0.0
    keyword_diversity: float = 0.0
    receipt_review_count: int = 0

    is_active: bool = True
    created_at: datetime
```

**DB 테이블:** `businesses`

### 4.2 Competitor (경쟁사)

```python
class Competitor(BaseModel):
    id: str
    business_id: str        # 내 사업장 FK
    name: str
    address: Optional[str]
    is_active: bool = True
```

**DB 테이블:** `competitors`

### 4.3 Subscription (구독)

```python
class Subscription(BaseModel):
    id: str
    user_id: str
    plan: Literal["free", "basic", "pro", "biz", "startup", "enterprise"]
    status: Literal["active", "grace_period", "suspended", "cancelled", "expired"]
    start_at: datetime
    end_at: datetime
    billing_key: Optional[str]      # 토스 자동결제용
    customer_key: Optional[str]
    grace_until: Optional[date]     # 유예 기간 종료일
```

**DB 테이블:** `subscriptions`, `profiles`

---

## 5. Domain 1 — DiagnosisReport (진단 리포트)

> "내 가게 지금 어때?"

스캔 1회 실행의 결과물. `scan_results` 테이블 1행에 대응.

### Python 모델

```python
# backend/models/diagnosis.py

class BusinessSnapshot(BaseModel):
    """내 가게 기본 현황 — 스캔 시점의 등록 정보"""
    name: str
    category: str
    context: ScanContext
    region: Optional[str]       # location_based 필수, non_location = None
    platform_registration: PlatformRegistration
    keyword_count: int


class PlatformRegistration(BaseModel):
    """플랫폼 등록 현황
    context별 중요도:
      location_based: naver_smart_place ★★★  kakao_maps ★★★  google_maps ★★  website ★★
      non_location:   naver_smart_place ★     kakao_maps ★     google_maps ★★★ website ★★★
    """
    naver_smart_place: bool
    kakao_maps: bool
    google_maps: bool
    website: bool


class AIPlatformResult(BaseModel):
    """AI 플랫폼 1개의 노출 결과"""
    platform: str               # gemini | chatgpt | perplexity | grok | naver | claude | zeta | google
    mentioned: bool
    rank: Optional[int]
    excerpt: Optional[str]
    confidence: Optional[Dict]  # {"lower": float, "upper": float} — Gemini Wilson 신뢰구간
    in_briefing: Optional[bool]     # 네이버 AI 브리핑 포함 여부
    in_ai_overview: Optional[bool]  # Google AI Overview 포함 여부
    error: Optional[str]


class AIVisibility(BaseModel):
    """8개 AI 플랫폼 노출 현황"""
    exposure_freq: float        # Gemini 100회 샘플링 기준 노출 빈도 (0~100)
    exposure_rate: float        # 노출률 % (exposure_freq / 100)
    platforms: Dict[str, AIPlatformResult]
    mentioned_count: int        # 노출된 플랫폼 수 (0~8)
    query_used: str


class ChannelScores(BaseModel):
    """AI 채널 분리 점수"""
    naver_channel: float        # 네이버 생태계 점수 (0~100)
    global_channel: float       # 글로벌 AI 채널 점수 (0~100)
    dominant_channel: str       # "naver" | "global" | "balanced"
    channel_gap: float          # abs(naver - global) — 10 이상이면 채널 불균형


class NaverChannelDetail(BaseModel):
    """네이버 채널 세부 현황 — location_based 전용"""
    in_ai_briefing: bool
    is_smart_place: bool
    blog_mentions: int
    is_on_kakao: bool
    naver_rank: Optional[int]
    top_competitor_blog_count: int


class WebsiteHealth(BaseModel):
    """웹사이트 SEO 체크리스트"""
    has_website: bool
    is_https: bool
    is_mobile_friendly: bool
    has_json_ld: bool
    has_schema_local_business: bool
    has_open_graph: bool
    has_favicon: bool
    title: Optional[str]
    error: Optional[str]


class ScoreBreakdown(BaseModel):
    """6항목 세부 점수 (각 0~100)"""
    exposure_freq: float        # AI 검색 노출 빈도
    review_quality: float       # 리뷰 수·평점·키워드
    schema_score: float         # 정보 구조화 점수
    online_mentions: float      # 온라인 언급 빈도
    info_completeness: float    # 정보 완성도
    content_freshness: float    # 콘텐츠 최신성


class ScoreResult(BaseModel):
    """종합 점수 결과"""
    total_score: float
    grade: str                  # A | B | C | D
    breakdown: ScoreBreakdown
    channel_scores: ChannelScores
    weekly_change: Optional[float]
    rank_in_category: Optional[int]
    total_in_category: Optional[int]


class DiagnosisReport(BaseModel):
    """진단 리포트 — 스캔 1회의 전체 결과"""
    scan_id: str
    business_id: str
    scanned_at: datetime
    context: ScanContext

    snapshot: BusinessSnapshot
    ai_visibility: AIVisibility
    naver_detail: Optional[NaverChannelDetail]   # location_based 전용
    website_health: Optional[WebsiteHealth]       # 웹사이트 있을 때만
    score: ScoreResult
```

**context별 필드 채움 규칙:**

| 필드 | location_based | non_location |
|------|:---:|:---:|
| `snapshot.region` | 값 있음 | `None` |
| `naver_detail` | 항상 수집 | `None` |
| `website_health` | 웹사이트 있으면 | 웹사이트 있으면 |
| `score.channel_scores.naver_channel` | 의미 있음 | 참고용 |

**플랜별 접근 범위:**

| 항목 | Trial | Basic | Pro | Startup | Biz |
|------|:---:|:---:|:---:|:---:|:---:|
| snapshot | O | O | O | O | O |
| ai_visibility (Gemini만) | O | — | — | — | — |
| ai_visibility (8개 전체) | — | O | O | O | O |
| naver_detail | O | O | O | O | O |
| website_health | O | O | O | O | O |
| score.breakdown | O | O | O | O | O |
| score.channel_scores | O | O | O | O | O |

---

## 6. Domain 2 — MarketLandscape (시장 현황)

> "근처 같은 업종 가게들은 어떻게 잘되고 있어?"

`DiagnosisReport` + 경쟁사 스캔 데이터를 결합해 계산.

### Python 모델

```python
# backend/models/market.py

class MarketPosition(BaseModel):
    """시장 내 내 위치"""
    my_rank: int
    total_in_market: int
    my_score: float
    category_avg_score: float
    top10_score: float
    percentile: float           # 상위 N%
    is_above_average: bool


class CompetitorProfile(BaseModel):
    """경쟁 가게 1개의 현황"""
    competitor_id: str
    name: str
    score: float
    grade: str
    is_naver_smart_place: bool
    is_on_kakao: bool
    blog_mentions: int
    ai_mentioned: bool
    ai_platform_count: int
    strengths: List[str]        # ["AI 검색 강함", "블로그 많음", ...]
    rank: int


class MarketDistribution(BaseModel):
    """업종 점수 분포"""
    grade_a_count: int          # 80점 이상
    grade_b_count: int          # 60~79점
    grade_c_count: int          # 40~59점
    grade_d_count: int          # 40점 미만
    distribution: List[Dict]


class MarketLandscape(BaseModel):
    """시장 현황
    context별 비교 범위:
      location_based: category + region 필터
      non_location:   category 전국 필터
    """
    context: ScanContext
    category: str
    region: Optional[str]
    position: MarketPosition
    competitors: List[CompetitorProfile]
    distribution: MarketDistribution
    data_updated_at: datetime   # 30분 TTL 캐시
```

**context별 경쟁사 강점 레이블:**

| 강점 레이블 | location_based | non_location |
|------------|:---:|:---:|
| "AI 검색 강함" | O | O |
| "블로그 많음" | O | — |
| "스마트플레이스 최적화" | O | — |
| "리뷰 많음" | O | — |
| "웹사이트 SEO 강함" | — | O |
| "ChatGPT 인용 多" | — | O |
| "전문 콘텐츠 풍부" | — | O |

**플랜별 접근 범위:**

| 항목 | Trial | Basic | Pro | Startup | Biz |
|------|:---:|:---:|:---:|:---:|:---:|
| position (랭킹) | 부분 | O | O | O | O |
| competitors 수 | 3개 | 3개 | 10개 | 10개 | 무제한 |
| distribution | — | O | O | O | O |
| CompetitorProfile.strengths | — | — | O | O | O |

---

## 7. Domain 3 — GapAnalysis (격차 분석)

> "1위 가게랑 나랑 뭐가 달라?"

### Python 모델 (v2.5 업데이트)

```python
# backend/models/gap.py

class DimensionGap(BaseModel):
    """점수 항목 1개의 격차"""
    dimension_key: str          # "exposure_freq" | "review_quality" | ...
    dimension_label: str        # "AI 검색 노출" | "리뷰 품질" | ...
    my_score: float
    top_score: float            # 1위 경쟁사의 해당 항목 점수
    avg_score: float            # 업종 평균
    gap_to_top: float           # top_score - my_score (양수 = 뒤처짐)
    gap_reason: str             # context별 구체적 원인 문구
    improvement_potential: str  # "high" | "medium" | "low"
    weight: float               # 전체 점수 가중치
    priority: int               # 1 = 개선 시 점수 효과 가장 큼


class CompetitorGap(BaseModel):
    """1위 경쟁사와의 격차 요약"""
    top_competitor_name: str
    top_competitor_score: float
    my_score: float
    total_gap: float
    strongest_gap_dimension: str
    closeable_gap: float        # 상위 3개 격차를 70% 달성 시 좁힐 수 있는 격차


# ── v2.5 신규 ──────────────────────────────────────────────────────

class ReviewKeywordGap(BaseModel):
    """리뷰 키워드 격차 — location_based 전용

    "리뷰 품질 점수가 낮습니다"가 아니라
    "이 키워드가 리뷰에 없어서 AI 브리핑 조건 검색에 안 나옵니다"를 알려줌.
    """
    covered_keywords: List[str]         # 현재 리뷰에 있는 키워드
    missing_keywords: List[str]         # 지금 부족한 키워드 (우선 확보 대상)
    competitor_only_keywords: List[str] # 경쟁사만 보유 (빠르게 따라잡아야 할 것)
    pioneer_keywords: List[str]         # 아무도 없음 (선점 가능)
    coverage_rate: float                # 0.0 ~ 1.0
    top_priority_keyword: Optional[str] # 지금 가장 필요한 키워드 1개
    qr_card_message: str                # QR카드·영수증용 리뷰 유도 문구 (네이버 정책 준수)
    category_scores: Dict[str, float]   # 카테고리별 커버리지 점수


class GrowthStage(BaseModel):
    """성장 단계 — 종합 점수 기반 4단계 판정"""
    stage: str                  # "survival" | "stability" | "growth" | "dominance"
    stage_label: str            # "생존기" | "안정기" | "성장기" | "지배기"
    score_range: str            # "0~30점" | "30~55점" | "55~75점" | "75~100점"
    focus_message: str          # 이 단계에서 집중해야 할 것
    this_week_action: str       # 이번 주 구체적으로 할 일 1가지
    do_not_do: str              # 이 단계에서 하면 안 되는 것 (시간 낭비 방지)
    estimated_weeks_to_next: Optional[int]  # 다음 단계까지 예상 기간


class GapAnalysis(BaseModel):
    """격차 분석 — DiagnosisReport + MarketLandscape로부터 계산"""
    business_id: str
    scan_id: str
    analyzed_at: datetime
    context: ScanContext

    vs_top: CompetitorGap
    dimensions: List[DimensionGap]     # gap_to_top × weight 내림차순 정렬

    gap_card_url: Optional[str]         # 공유 이미지 URL

    estimated_score_if_fixed: float     # 상위 3개 격차 70% 달성 시 예상 종합 점수
    naver_only_risk: bool               # 네이버만 관리하고 글로벌 AI 완전 비노출 리스크
    naver_only_risk_score_impact: float # 웹사이트+JSON-LD 등록 시 예상 점수 상승폭

    # v2.5 신규
    keyword_gap: Optional[ReviewKeywordGap]   # location_based 전용
    growth_stage: GrowthStage                 # 모든 context 공통
```

### context별 gap_reason 문구 분기

```python
# backend/services/gap_analyzer.py

_GAP_REASONS = {
    ScanContext.LOCATION_BASED: {
        "exposure_freq": "네이버 AI 브리핑 미노출로 Gemini·ChatGPT 노출 빈도 낮음",
        "review_quality": "리뷰 수·평점이 경쟁사 대비 부족. 키워드 다양성 개선 필요",
        "schema_score":   "네이버 스마트플레이스 미등록 또는 웹사이트 없음으로 구조화 점수 낮음",
        ...
    },
    ScanContext.NON_LOCATION: {
        "exposure_freq": "ChatGPT·Perplexity 미노출로 AI 검색 빈도 낮음",
        "schema_score":  "웹사이트 JSON-LD 없음 — AI가 사업장 정보를 구조적으로 파악 불가",
        ...
    },
}
```

### GapAnalysis API

```
GET /api/report/gap/{biz_id}
  → GapAnalysis.model_dump(mode="json")
  → growth_stage, keyword_gap 포함
```

`analyze_gap_from_db()` 내부 흐름:
1. `businesses` 테이블에서 `name`, `category`, `business_type` 조회
2. 최신 `scan_results` 에서 `naver_result`, `gemini_result` 로드
3. `ai_citations` 테이블에서 리뷰 발췌문 최대 20개 수집
4. `analyze_keyword_coverage()` 호출 → `ReviewKeywordGap` 계산
5. 종합 점수 기반 `GrowthStage` 판정

---

## 8. Domain 4 — ActionPlan (실행 계획)

> "뭘 어떻게 직접 해야 해?"

### Python 모델 (v2.6 업데이트)

```python
# backend/models/action.py

class ActionItem(BaseModel):
    """개선 항목 1개"""
    rank: int                           # 우선순위 (1 = 가장 중요)
    dimension: str                      # 관련 점수 항목
    title: str
    action: str                         # 단계별 실행 방법 (구체적 URL·메뉴 경로 포함)
    expected_effect: str                # 수치 예측 금지 — "AI 조건 검색 노출 확대" 형태로만
    difficulty: Literal["easy", "medium", "hard"]
    time_required: str                  # "5분" | "30분" | "1주일"
    competitor_example: Optional[str]
    is_quick_win: bool                  # 이번 주 완료 가능 여부


class FAQ(BaseModel):
    question: str   # "강남 {업종} 추천해줘"
    answer: str     # "네, {사업장명}은 {강점} 전문점으로..."


class ReviewResponseDraft(BaseModel):
    """리뷰 답변 초안 — 바로 복사해서 스마트플레이스에 붙여넣기"""
    review_snippet: str
    rating: Optional[int]           # 1~5
    draft_response: str
    tone: Literal["grateful", "apologetic", "neutral"]
    # grateful  = 긍정 리뷰 감사
    # apologetic = 부정 리뷰 사과+해결
    # neutral   = 일반


class ActionTools(BaseModel):
    """직접 활용 가능한 실행 도구 — 모두 복사·붙여넣기 가능

    context별 생성 여부:
      json_ld_schema:              항상 생성
      faq_list:                    항상 생성
      keyword_list:                항상 생성
      blog_post_template:          항상 생성
      smart_place_checklist:       location_based 전용
      seo_checklist:               non_location 전용
      review_response_drafts:      항상 생성 (v2.4)
      smart_place_faq_answers:     location_based 전용 (v2.4)
      review_request_message:      항상 생성 (v2.4)
      naver_post_template:         location_based 전용 (v2.4)
      direct_briefing_paths:       항상 생성 (v2.6)
      briefing_summary:            항상 생성 (v2.6)
    """
    json_ld_schema: str
    faq_list: List[FAQ]
    keyword_list: List[str]
    blog_post_template: str
    smart_place_checklist: Optional[List[str]] = None
    seo_checklist: Optional[List[str]] = None

    # v2.4
    review_response_drafts: List[ReviewResponseDraft] = []
    smart_place_faq_answers: Optional[List[FAQ]] = None
    review_request_message: str = ""
    naver_post_template: Optional[str] = None

    # v2.6 신규 — AI 브리핑 직접 관리 경로
    direct_briefing_paths: List[dict] = []
    briefing_summary: str = ""


class ActionPlan(BaseModel):
    """실행 계획 — DiagnosisReport + GapAnalysis를 기반으로 Claude Sonnet 생성"""
    plan_id: str
    business_id: str
    scan_id: str
    generated_at: datetime
    context: ScanContext

    summary: str                    # 3줄 현황 요약
    items: List[ActionItem]         # 전체 개선 항목 (priority 순)
    quick_wins: List[ActionItem]    # is_quick_win=True인 항목만
    next_month_goal: str
    tools: ActionTools
    progress: Optional[ActionProgress] = None  # 프론트에서 주입
```

### ActionTools 생성 흐름

```
build_action_tools(biz, score_data, keyword_gap, context)
  │
  ├─ json_ld_schema         ← schema_generator.py
  ├─ faq_list               ← Claude Sonnet 생성 (쿼리 형태 context별 분기)
  ├─ keyword_list           ← keyword_gap.missing_keywords + covered_keywords
  ├─ blog_post_template     ← context별 템플릿 (location: 지역 키워드 / non: 전문성)
  ├─ review_request_message ← build_qr_message(top_priority_keyword) — 네이버 정책 준수
  ├─ review_response_drafts ← 긍정·부정·일반 3종 자동 생성
  ├─ naver_post_template    ← location_based만 (스마트플레이스 '소식' 탭용)
  └─ direct_briefing_paths  ← briefing_engine.build_direct_briefing_paths() (v2.6)
```

### DB 저장 (guides 테이블)

```
guides 테이블
  ├─ items_json     ← [ActionItem.model_dump()]
  ├─ priority_json  ← [item.title for item in quick_wins]
  ├─ summary
  ├─ scan_id
  ├─ context
  ├─ next_month_goal
  └─ tools_json     ← ActionTools.model_dump()
                       (direct_briefing_paths, briefing_summary 포함)
```

---

## 9. 업종별 키워드 분류 체계 (v2.5 신규)

> 파일: `backend/services/keyword_taxonomy.py`

### 핵심 인사이트

네이버 AI 브리핑은 키워드 기반 조건 검색으로 동작합니다.
- "강남 파스타 맛집" → 파스타 키워드가 리뷰에 있는 가게만 노출
- "예약 없이 가는 미용실" → 예약 관련 키워드 필요
- "야외 테라스 카페" → 테라스 키워드가 있어야 AI 브리핑에 노출

**소상공인이 해야 할 일**: 자신의 업종에서 손님이 많이 검색하는 키워드를 리뷰에 확보하는 것.

### 지원 업종

| 업종 코드 | 한국어 | 카테고리 수 |
|----------|--------|------------|
| `restaurant` | 음식점 | 6개 (음식 종류, 분위기, 서비스, 가격, 특수 요구, 부가시설) |
| `beauty` | 미용실·뷰티 | 5개 (시술 종류, 기술·품질, 시설, 가격, 예약·접근성) |
| `clinic` | 병원·한의원 | 5개 (진료 분야, 치료 방법, 의료진, 시설, 접근성) |
| `academy` | 학원·교육 | 5개 (과목·분야, 교육 방식, 성과·결과, 시설·환경, 스케줄) |
| `legal` | 법률·세무 | 5개 (업무 분야, 전문성, 비용, 접근성, 고객 응대) |
| `shopping` | 쇼핑몰·매장 | 5개 (상품 종류, 품질, 가격, 배송·교환, 고객 서비스) |

### 주요 함수

```python
# backend/services/keyword_taxonomy.py

def get_industry_keywords(category: str) -> dict:
    """업종별 키워드 분류 체계 반환"""

def analyze_keyword_coverage(
    category: str,
    review_excerpts: list[str],
    competitor_review_excerpts: list[str] | None = None,
) -> dict:
    """
    리뷰 텍스트에서 업종 키워드 커버리지 분석.

    반환:
      covered: 현재 보유 키워드
      missing: 부족한 키워드
      competitor_only: 경쟁사만 보유
      pioneer: 아무도 없음 (선점 기회)
      coverage_rate: 0.0 ~ 1.0
      top_priority_keyword: 지금 가장 필요한 1개
      category_scores: 카테고리별 커버리지 점수
    """

def build_qr_message(
    top_priority_keyword: str | None,
    missing_keywords: list[str],
    business_name: str,
) -> str:
    """
    QR카드·영수증·테이블 카드용 리뷰 유도 문구 생성.
    - 네이버 정책 위반 문구 금지: "리뷰 작성 시 혜택 제공" 형태 제거
    - 자연스러운 부탁 방식만 사용
    """
```

### 키워드 우선순위 판정 로직

```
1. competitor_only_keywords 중 가중치 높은 것 → "경쟁사만 보유"는 즉시 따라잡아야
2. missing_keywords 중 가중치 높은 것 → 아직 없는 핵심 키워드
3. pioneer_keywords → 아무도 없는 키워드 (선점 기회지만 수요 불확실)
```

---

## 10. AI 브리핑 직접 관리 경로 엔진 (v2.6 신규)

> 파일: `backend/services/briefing_engine.py`

### 핵심 인사이트

소상공인이 가장 자주 묻는 질문: **"리뷰가 없으면 어떻게 해요?"**

고객 리뷰를 기다리지 않고 **사장님이 직접** 오늘 당장 AI 브리핑 신호를 강화할 수 있는 4가지 경로.

### 4개 직접 관리 경로

| 경로 | 입력 위치 | 소요 시간 | 효과 | 실행 빈도 |
|------|-----------|-----------|------|-----------|
| **경로 B — FAQ 등록** | 스마트플레이스 '사장님 Q&A' | 5분 | AI 브리핑 가장 직접 인용 경로 | 최초 1회 |
| **경로 A — 리뷰 답변** | 기존 리뷰에 키워드 포함 답변 | 3분/건 | 리뷰 답변율 = AI 추천 #1 신호 | 즉시 가능 |
| **경로 C — 소식 업데이트** | 스마트플레이스 '소식' 탭 | 5분 | 콘텐츠 최신성 유지 + 키워드 확장 | 주 1회 |
| **경로 D — 소개글 수정** | 스마트플레이스 '기본 정보' | 10분 | 영구 키워드 기반 (한 번만) | 최초 1회 |

### BriefingPath 구조

```python
# ActionTools.direct_briefing_paths 각 원소

{
    "path_id":     "B",                # 경로 식별자
    "label":       "스마트플레이스 FAQ 등록",
    "urgency":     "high",             # "high" | "medium" | "low"
    "urgency_label": "오늘 바로",
    "time_required": "5분",
    "what_to_do":  "스마트플레이스 관리자 → '사장님 Q&A' 탭 → 질문 추가",
    "ready_text":  "Q: 주차 가능한가요?\nA: 네, ...",  # 바로 붙여넣기 가능
    "effect":      "FAQ 답변이 네이버 AI 브리핑에 직접 인용됩니다",
    "platform_url": "https://smartplace.naver.com",
}
```

### briefing_summary

대시보드 상단 amber 배너에 표시되는 현황 요약 문구.

```python
# 예시 출력
briefing_summary = (
    "현재 AI 브리핑 직접 입력 경로 4개 중 2개가 비어 있습니다. "
    "스마트플레이스 FAQ를 등록하면 오늘 AI 브리핑 노출을 강화할 수 있습니다."
)
```

---

## 11. 성장 단계 모델 (v2.5 신규)

> `backend/services/gap_analyzer.py` — `_build_growth_stage(total_score)`

### 4단계 정의

| 단계 | 코드 | 점수 범위 | 핵심 집중 | 하지 말아야 할 것 |
|------|------|-----------|-----------|------------------|
| **생존기** | `survival` | 0~30점 | 스마트플레이스 기본 완성 (사진·영업시간·주소) | SNS 광고, 블로그, ChatGPT 최적화 — 기본이 먼저 |
| **안정기** | `stability` | 30~55점 | 리뷰 키워드 다양성 확보 | 리뷰 이벤트(네이버 정책 위반) |
| **성장기** | `growth` | 55~75점 | 경쟁사 없는 키워드 선점 | 모든 키워드 동시 추구 |
| **지배기** | `dominance` | 75~100점 | 글로벌 AI 확장 (JSON-LD, 구글 비즈니스 프로필) | 현재 강점 방치 |

### 설계 원칙

- 단계는 **종합 점수**로만 결정 (context 무관, 모든 사업장 공통)
- **"하지 말아야 할 것"** 명시 — 잘못된 방향에 시간·돈 낭비 방지
- `estimated_weeks_to_next`: 예상 기간이지만 **수치 예측 금지 원칙**에 따라 주(week) 단위만 표시 (%) 없음

---

## 12. 점수 계산 시스템

> `backend/services/score_engine.py`

### context별 가중치

| 항목 | `location_based` | `non_location` |
|------|:---:|:---:|
| AI 검색 노출 빈도 | 30% | 35% |
| 리뷰 수·평점·키워드 다양성 | 20% | 10% |
| 정보 구조화 (Schema JSON-LD) | 15% | 20% |
| 온라인 언급 빈도 | 15% | 20% |
| 정보 완성도 | 10% | 10% |
| 콘텐츠 최신성 | 10% | 5% |

**location_based 가중치 설계 이유:**
- 네이버 AI 브리핑은 리뷰 키워드 기반 조건 검색이 핵심 → 리뷰 품질(20%) 유지
- 카카오맵·스마트플레이스 등록이 글로벌 AI 차단을 보완 → 정보 구조화(15%)

**non_location 가중치 설계 이유:**
- ChatGPT·Perplexity가 웹 콘텐츠를 직접 크롤링 → 구조화(20%)·언급(20%) 강조
- 리뷰 역할 감소 → 10%

### 채널 분리 점수 계산

```python
def _calc_naver_channel_score(breakdown, scan_result) -> float:
    """네이버 생태계 점수 (0~100)
    = naver AI 브리핑 포함 여부 × 40
    + 스마트플레이스 등록 × 30
    + 카카오맵 등록 × 20
    + 리뷰 품질 기여분 × 10
    """

def _calc_global_channel_score(breakdown, scan_result) -> float:
    """글로벌 AI 채널 점수 (0~100)
    = Gemini 노출 빈도 × 0.4
    + ChatGPT 언급 × 30
    + Google AI Overview × 15
    + schema_score × 0.15
    """
```

### 점수 등급

| 등급 | 점수 범위 | 의미 |
|------|-----------|------|
| A | 80~100 | AI 브리핑 상위 — 경쟁 우위 |
| B | 60~79 | 평균 이상 — 성장 중 |
| C | 40~59 | 개선 필요 |
| D | 0~39 | 즉시 조치 필요 |

---

## 13. 데이터 흐름

### 스캔 실행 → 도메인 모델 생성 흐름

```
POST /api/scan/full
  │
  ├─ multi_scanner.py — 8개 AI 병렬 스캔 (SSE 진행률)
  │   ├─ gemini_scanner.py     (100회 샘플링 → exposure_freq)
  │   ├─ chatgpt_scanner.py
  │   ├─ naver_scanner.py      (location_based만)
  │   ├─ kakao_scanner.py      (location_based만)
  │   ├─ perplexity_scanner.py
  │   ├─ grok_scanner.py
  │   ├─ claude_scanner.py
  │   ├─ zeta_scanner.py       (wrtn.ai)
  │   ├─ google_scanner.py
  │   └─ website_checker.py    (non_location 또는 website_url 있을 때)
  │
  ├─ score_engine.py — AI Visibility Score 계산
  │   ├─ context별 가중치 적용
  │   ├─ naver_channel_score / global_channel_score 계산
  │   └─ scan_results 테이블에 저장
  │
  └─ (비동기) guide_generator.py
      ├─ gap_analyzer.analyze_gap() 호출
      │   ├─ keyword_taxonomy.analyze_keyword_coverage() → ReviewKeywordGap
      │   └─ _build_growth_stage(total_score) → GrowthStage
      ├─ action_tools.build_action_tools() 호출
      │   ├─ briefing_engine.build_direct_briefing_paths() → direct_briefing_paths
      │   └─ build_briefing_summary() → briefing_summary
      ├─ Claude Sonnet API 호출 (keyword_gap + growth_stage context 포함)
      └─ guides 테이블에 tools_json 저장
```

### 프론트엔드 데이터 조회 흐름

```
가이드 페이지 (/guide)
  │
  ├─ Supabase 직접 조회
  │   └─ guides.* (tools_json 포함)
  │       └─ tools_json.direct_briefing_paths → BriefingPathsSection 렌더링
  │       └─ tools_json.briefing_summary     → amber 배너 렌더링
  │       └─ tools_json.review_response_drafts → ReviewDraftsSection
  │       └─ tools_json.review_request_message → QuickToolsSection
  │       └─ tools_json.keyword_list          → QuickToolsSection
  │       └─ tools_json.faq_list              → FAQSection
  │
  └─ 클라이언트 사이드 fetch
      GET /api/report/gap/{biz_id}
        └─ growth_stage  → GrowthStageCard 렌더링
        └─ keyword_gap   → KeywordGapCard 렌더링
```

---

## 14. DB 테이블 매핑

| 도메인 | 테이블 | 핵심 컬럼 |
|--------|--------|-----------|
| DiagnosisReport | `scan_results` | `total_score`, `score_breakdown` JSONB, `naver_channel_score`, `global_channel_score`, `kakao_result`, `website_check_result`, `competitor_scores` JSONB |
| MarketLandscape | `scan_results`, `businesses` | `competitor_scores` JSONB (경쟁사 점수), `score_history` |
| GapAnalysis | `scan_results`, `businesses`, `ai_citations` | 계산 전용 — `gap_cards` 테이블에 이미지 URL 저장 |
| ActionPlan | `guides` | `items_json`, `priority_json`, `summary`, `scan_id`, `context`, `next_month_goal`, `tools_json` (v2.6: `direct_briefing_paths`, `briefing_summary` 포함) |

### guides 테이블 tools_json 구조

```json
{
  "json_ld_schema": "<script type='application/ld+json'>...</script>",
  "faq_list": [{ "question": "...", "answer": "..." }],
  "keyword_list": ["파스타", "야외 테라스", "예약 가능"],
  "blog_post_template": "...",
  "smart_place_checklist": ["대표 사진 10장 이상", "..."],
  "review_response_drafts": [
    { "review_snippet": "...", "rating": 5, "draft_response": "...", "tone": "grateful" }
  ],
  "review_request_message": "맛있게 드셨나요? ...",
  "naver_post_template": "이번 주 메뉴 소식 ...",
  "direct_briefing_paths": [
    { "path_id": "B", "label": "FAQ 등록", "urgency": "high", "ready_text": "..." },
    { "path_id": "A", "label": "리뷰 답변", "urgency": "high", "ready_text": "..." },
    { "path_id": "C", "label": "소식 업데이트", "urgency": "medium", "ready_text": "..." },
    { "path_id": "D", "label": "소개글 수정", "urgency": "medium", "ready_text": "..." }
  ],
  "briefing_summary": "현재 AI 브리핑 직접 입력 경로 중 FAQ가 비어 있습니다. ..."
}
```

---

## 15. API 엔드포인트 매핑

| Endpoint | 반환 도메인 | 설명 |
|----------|------------|------|
| `POST /api/scan/trial` | DiagnosisReport (부분) | 비로그인 무료 체험 (Gemini만) |
| `POST /api/scan/full` | — | 8개 AI 병렬 스캔 (백그라운드) |
| `GET /api/report/score/{biz_id}` | DiagnosisReport | 최신 진단 리포트 전체 |
| `GET /api/report/history/{biz_id}` | DiagnosisReport[] | 30일 점수 추세 |
| `GET /api/report/market/{biz_id}` | MarketLandscape | 시장 현황 통합 (30분 캐시) |
| `GET /api/report/gap/{biz_id}` | GapAnalysis | 격차 분석 (v2.5: keyword_gap, growth_stage 포함) |
| `GET /api/report/gap-card/{biz_id}` | PNG | 갭 카드 이미지 |
| `GET /api/report/competitors/{biz_id}` | CompetitorProfile[] | 경쟁사 비교 |
| `GET /api/report/ranking/{category}/{region}` | MarketPosition | 업종·지역 랭킹 TOP10 (30분 캐시) |
| `GET /api/report/benchmark/{category}/{region}` | MarketDistribution | 업종 벤치마크 (1시간 캐시) |
| `POST /api/guide/generate` | — | 개선 가이드 생성 (백그라운드) |
| `GET /api/guide/{biz_id}/latest` | ActionPlan | 최신 가이드 (tools_json 포함) |
| `PATCH /api/guide/{guide_id}/checklist` | — | 체크리스트 완료 저장 |
| `POST /api/schema/generate` | ActionTools.json_ld_schema | JSON-LD 생성 |

---

## 16. 구현 현황

### 백엔드

| 파일 | 상태 | 버전 | 비고 |
|------|:---:|------|------|
| `models/context.py` | ✅ | v2.1 | ScanContext Enum |
| `models/diagnosis.py` | ✅ | v2.1 | DiagnosisReport 전체 |
| `models/market.py` | ✅ | v2.1 | MarketLandscape |
| `models/gap.py` | ✅ | **v2.5** | ReviewKeywordGap, GrowthStage 추가 |
| `models/action.py` | ✅ | **v2.6** | ActionTools에 direct_briefing_paths, briefing_summary 추가 |
| `models/entities.py` | ✅ | v2.3 | Business, Competitor, Subscription |
| `services/score_engine.py` | ✅ | v1.7 | context별 가중치 분기, 채널 분리 점수 |
| `services/keyword_taxonomy.py` | ✅ | **v2.5** | 업종별 키워드 분류 체계, QR 문구 생성 |
| `services/gap_analyzer.py` | ✅ | **v2.7** | analyze_gap_from_db() 리뷰 발췌문 수집 추가 |
| `services/briefing_engine.py` | ✅ | **v2.6** | AI 브리핑 직접 관리 4-경로 엔진 |
| `services/action_tools.py` | ✅ | **v2.6** | briefing_engine 통합, 키워드 타겟 QR |
| `services/guide_generator.py` | ✅ | **v2.5** | keyword_gap·growth_stage 프롬프트 삽입, 수치 예측 금지 |
| `services/schema_generator.py` | ✅ | v2.1 | FAQ Schema 포함 JSON-LD |
| `routers/report.py` | ✅ | v2.3 | GET /gap/{biz_id} 포함 |
| `routers/guide.py` | ✅ | v2.1 | tools_json 저장, 폴백 처리 |
| `routers/scan.py` | ✅ | v2.2 | context 분기, stream_token 인증 |
| `middleware/plan_gate.py` | ✅ | v1.6 | PLAN_LIMITS 기준 엔드포인트 제한 |

### 프론트엔드

| 파일 | 상태 | 버전 | 비고 |
|------|:---:|------|------|
| `types/context.ts` | ✅ | v2.1 | |
| `types/diagnosis.ts` | ✅ | v2.1 | |
| `types/market.ts` | ✅ | v2.3 | API 응답 구조 동기화 |
| `types/gap.ts` | ✅ | v2.1 | |
| `types/action.ts` | ✅ | v2.1 | |
| `types/entities.ts` | ✅ | v2.3 | Business, Competitor, Subscription |
| `app/(dashboard)/guide/GuideClient.tsx` | ✅ | **v2.7** | 전면 재작성 — v2.5·v2.6 데이터 완전 표시 |
| `app/(dashboard)/guide/page.tsx` | ✅ | v2.1 | |
| `app/(dashboard)/dashboard/page.tsx` | ✅ | v2.2 | ChannelScoreCards, WebsiteCheckCard 통합 |
| `app/(dashboard)/competitors/page.tsx` | ✅ | v2.1 | GapAnalysis 섹션 포함 |
| `components/dashboard/ChannelScoreCards.tsx` | ✅ | v1.7 | 네이버/글로벌 채널 분리 표시 |
| `components/dashboard/GapAnalysisCard.tsx` | ✅ | v2.1 | 경쟁사 격차 시각화 |

### 가이드 페이지 표시 섹션 (v2.7 이후 완성)

| UI 섹션 | 데이터 소스 | 상태 |
|---------|------------|:---:|
| AI 브리핑 현황 배너 | `tools_json.briefing_summary` | ✅ |
| 성장 단계 카드 | `GET /api/report/gap` → `growth_stage` | ✅ |
| AI 브리핑 직접 관리 4경로 | `tools_json.direct_briefing_paths` | ✅ |
| 완료 체크리스트 + 진행률 | `tools_json.items_json` | ✅ |
| 현황 요약 + 다음달 목표 | `tools_json.summary`, `next_month_goal` | ✅ |
| 즉시 할 수 있는 것 | `tools_json.priority_json` | ✅ |
| 개선 항목 카드 | `tools_json.items_json` | ✅ |
| 리뷰 키워드 현황 | `GET /api/report/gap` → `keyword_gap` | ✅ |
| 리뷰 답변 초안 3종 | `tools_json.review_response_drafts` | ✅ |
| QR 리뷰 유도 문구 | `tools_json.review_request_message` | ✅ |
| 스마트플레이스 소식 초안 | `tools_json.naver_post_template` | ✅ |
| 핵심 키워드 목록 | `tools_json.keyword_list` | ✅ |
| 스마트플레이스 Q&A FAQ | `tools_json.smart_place_faq_answers` | ✅ |
| AI 검색 최적화 FAQ | `tools_json.faq_list` | ✅ |

### 구현 완료 (v2.8 — 2026-03-30)

| 항목 | 파일 | 내용 |
|------|------|------|
| `keyword_gap` 경쟁사 리뷰 수집 | `routers/scan.py`, `gap_analyzer.py` | competitor_scores JSONB에 `excerpt` 저장 → `competitor_only_keywords` 정확도 개선 |
| `competitor_only_keywords` 정확 계산 | `gap_analyzer.py` | `analyze_gap_from_db()`에서 경쟁사 excerpt 추출 후 `analyze_keyword_coverage()` 전달 |
| 경쟁사 미등록 Fallback GapAnalysis | `gap_analyzer.py` | 경쟁사 없을 때 업종 평균(55점) 기준 최소 분석 + `growth_stage` 반환 (null 아님) |
| GrowthStage 변화 감지 (스케줄러) | `scheduler/jobs.py` | `daily_scan_all` 후 단계 변화 로그 + 카카오 알림 코드 준비 (승인 후 주석 해제) |
| `_enrich_competitor_excerpts` 잡 | `scheduler/jobs.py` | 새벽 4시 — 경쟁사 excerpt 없는 스캔 30개 Gemini 재스캔으로 보강 |
| Trial 스캔 GrowthStage 포함 | `routers/scan.py` | trial 결과에 `growth_stage` 필드 추가 → 회원가입 전환 유도 |
| 업종 확장 (`cafe`, `fitness`, `pet`) | `keyword_taxonomy.py` | 3개 업종 추가, alias 분리 (`"cafe"` → 새 카테고리, `"restaurant"`과 구분) |
| Non-location keyword_gap | `keyword_taxonomy.py`, `gap_analyzer.py` | `analyze_nonlocation_keywords()` — ChatGPT·Perplexity 추천 키워드 분석 |
| DimensionGap.priority 버그 수정 | `gap_analyzer.py` | `object.__setattr__` 혼용 코드 제거 |
| 네이버 AI 브리핑 확인 버튼 | `GuideClient.tsx` | BriefingPathsSection 헤더에 "네이버 AI 브리핑 확인 →" 링크 |
| `pioneer_keywords` 선점 기회 강조 | `GuideClient.tsx` | KeywordGapCard에 emerald 배지 + 복사 버튼 |
| Demo 성장 단계 미리보기 | `demo/page.tsx` | 데모 결과에 GrowthStage 카드 추가 (안정기 mock) |

### 미구현 / 향후 계획

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| 카카오 알림톡 | 템플릿 심사 승인 후 활성화 | 보류 (심사 중) |
| 성장 단계 변화 카카오 알림 | `jobs.py` 주석 코드 해제만 하면 됨 — 승인 대기 | 보류 (알림 심사 후) |
| `gap_card_url` 이미지 생성 | GapAnalysis 공유 이미지 URL 채우기 | 낮음 |

---

*문서 버전: 2.8 | 최종 업데이트: 2026-03-30*
*관련 구현 버전: backend v2.8 · frontend v2.8*
