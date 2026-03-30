# AEOlab 도메인 모델 시스템

> 버전: 2.1 | 작성일: 2026-03-29 | 수정일: 2026-03-29
> 소상공인의 사고방식을 기준으로 설계한 4-도메인 모델 (ScanContext 분기 반영)

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
9. [점수 계산 시스템](#9-점수-계산-시스템)
10. [데이터 흐름](#10-데이터-흐름)
11. [DB 테이블 매핑](#11-db-테이블-매핑)
12. [API 엔드포인트 매핑](#12-api-엔드포인트-매핑)
13. [구현 현황](#13-구현-현황)

---

## 1. 설계 원칙

### 소상공인의 4가지 질문 → 4개 도메인

```
소상공인 질문                       도메인
────────────────────────────────────────────────────
"내 가게 지금 어때?"          →    DiagnosisReport
"근처 같은 업종 가게들은?"    →    MarketLandscape
"1위 가게랑 나랑 뭐가 달라?"  →    GapAnalysis
"뭘 어떻게 해야 해?"          →    ActionPlan
```

### 원칙

- **도메인 언어 일치**: 코드 어디서든 소상공인이 이해할 수 있는 용어 사용
- **단방향 의존**: `DiagnosisReport → MarketLandscape → GapAnalysis → ActionPlan`
- **불변 분리**: 원시 스캔 데이터(scan_results)와 도메인 모델은 분리
- **플랜별 접근**: `plan_gate.py`가 각 도메인 접근 권한 제어
- **ScanContext 분기**: 모델 구조는 단일, `context` 필드 값에 따라 필드 채움·가중치·실행 방향이 달라짐

---

## 2. ScanContext — 위치 기반 vs 위치 무관

### 개요

소상공인의 사업 형태에 따라 **AI 검색 쿼리 방식, 경쟁 범위, 핵심 채널, 점수 가중치**가 다릅니다.
모델 구조(4개 도메인)는 동일하되, `ScanContext` 값에 따라 내부 동작이 분기됩니다.

### 비교표

| 항목 | `location_based` (위치 기반) | `non_location` (위치 무관) |
|------|---------------------------|--------------------------|
| **사업 예시** | 카페, 식당, 병원, 미용실, 학원 | 변호사, 회계사, 온라인몰, 강사, 컨설턴트 |
| **AI 검색 쿼리** | `"{지역} {업종} 추천"` | `"{서비스명} 추천"`, `"{업종} 전문가"` |
| **경쟁 범위** | 같은 지역 동종업체 | 전국 단위 |
| **region 필드** | 필수 | 없음 (None) |
| **핵심 채널** | 네이버 스마트플레이스, 카카오맵 | 웹사이트, Google AI, ChatGPT |
| **naver_detail** | 항상 수집 | 수집 안 함 (None) |
| **schema_score 기준** | 스마트플레이스(60점) + 웹사이트(40점) | 웹사이트 + JSON-LD(80점) + Google Place(20점) |
| **smart_place_checklist** | 생성 | 생성 안 함 (None) |
| **MarketLandscape 비교 기준** | `category + region` 필터 | `category` 전국 필터 |

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
  ├─ AI 쿼리:    "{region} {category} 추천"
  ├─ 네이버:     스마트플레이스 + 블로그 + 카카오맵 수집
  ├─ 경쟁 비교:  같은 region + category 기준
  ├─ schema_score: is_smart_place(60) + website(40)
  └─ ActionTools: smart_place_checklist 생성

ScanContext.NON_LOCATION
  ├─ AI 쿼리:    "{keyword} 추천" 또는 "{category} 전문가"
  ├─ 네이버:     수집 생략 (naver_detail = None)
  ├─ 경쟁 비교:  전국 category 기준
  ├─ schema_score: website+JSON-LD(80) + google_place(20)
  └─ ActionTools: smart_place_checklist = None
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
  │   ├─ DimensionGap[]       6항목별 격차 + 원인              │
  │   ├─ CompetitorGap        1위와의 격차                     │
  │   └─ gap_card_url         공유 이미지 URL                  │
  │           │                                                 │
  │           └───────────────────────────────────────────────┘
  │                           ▼
  │           ActionPlan (실행 계획)
  │           ├─ ActionItem[]     우선순위별 개선 항목
  │           ├─ ActionTools      직접 활용 가능한 도구
  │           │   ├─ json_ld_schema      JSON-LD 코드
  │           │   ├─ faq_list            FAQ 질문/답변 초안
  │           │   ├─ keyword_list        리뷰 유도 키워드
  │           │   └─ blog_template       블로그 포스팅 템플릿
  │           └─ ActionProgress   체크리스트 진행률
  │
  └─ [이력 조회]
          ↓
      DiagnosisReport[] (30일 추세)
```

---

## 4. 핵심 엔티티

핵심 엔티티는 도메인이 아닌 영속 데이터입니다. 도메인 모델의 입력값이 됩니다.

### 3.1 Business (사업장)

```python
# backend/models/entities.py

class Business(BaseModel):
    id: str
    user_id: str
    name: str
    category: str           # 업종 (restaurant | cafe | hospital | academy | ...)
    business_type: str      # location_based | non_location
    region: Optional[str]   # 지역 (오프라인 사업장 필수)
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

```typescript
// frontend/types/entities.ts

export interface Business {
  id: string;
  user_id: string;
  name: string;
  category: string;
  business_type: "location_based" | "non_location";
  region?: string;
  address?: string;
  phone?: string;
  website_url?: string;
  keywords?: string[];
  naver_place_id?: string;
  google_place_id?: string;
  kakao_place_id?: string;
  review_count: number;
  avg_rating: number;
  keyword_diversity: number;
  receipt_review_count: number;
  is_active: boolean;
  created_at: string;
}
```

**DB 테이블:** `businesses`

---

### 3.2 Competitor (경쟁사)

```python
class Competitor(BaseModel):
    id: str
    business_id: str        # 내 사업장 FK
    name: str
    address: Optional[str]
    is_active: bool = True
```

```typescript
export interface Competitor {
  id: string;
  business_id: string;
  name: str;
  address?: string;
  is_active: boolean;
}
```

**DB 테이블:** `competitors`

---

### 3.3 User / Subscription

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

from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class BusinessSnapshot(BaseModel):
    """내 가게 기본 현황 — 스캔 시점의 등록 정보"""
    name: str
    category: str
    context: ScanContext            # location_based | non_location
    region: Optional[str]           # location_based 필수, non_location = None
    platform_registration: PlatformRegistration
    keyword_count: int


class PlatformRegistration(BaseModel):
    """플랫폼 등록 현황
    context별 중요도:
      location_based: naver_smart_place ★★★  kakao_maps ★★★  google_maps ★★  website ★★
      non_location:   naver_smart_place ★     kakao_maps ★     google_maps ★★★ website ★★★
    """
    naver_smart_place: bool     # 네이버 스마트플레이스
    kakao_maps: bool            # 카카오맵
    google_maps: bool           # 구글 지도
    website: bool               # 독립 웹사이트


class AIPlatformResult(BaseModel):
    """AI 플랫폼 1개의 노출 결과"""
    platform: str               # gemini | chatgpt | perplexity | grok | naver | claude | zeta | google
    mentioned: bool             # 노출 여부
    rank: Optional[int]         # 노출 순위 (1~5)
    excerpt: Optional[str]      # 인용 문구
    confidence: Optional[Dict]  # {"lower": float, "upper": float} — Gemini Wilson 신뢰구간
    in_briefing: Optional[bool] # 네이버 AI 브리핑 포함 여부
    in_ai_overview: Optional[bool]  # Google AI Overview 포함 여부
    error: Optional[str]


class AIVisibility(BaseModel):
    """8개 AI 플랫폼 노출 현황"""
    exposure_freq: float        # Gemini 100회 샘플링 기준 노출 빈도 (0~100)
    exposure_rate: float        # 노출률 % (exposure_freq / 100)
    platforms: Dict[str, AIPlatformResult]  # 플랫폼명 → 결과
    mentioned_count: int        # 노출된 플랫폼 수 (0~8)
    query_used: str             # 검색에 사용된 쿼리


class ChannelScores(BaseModel):
    """AI 채널 분리 점수"""
    naver_channel: float        # 네이버 생태계 점수 (0~100)
    global_channel: float       # 글로벌 AI 채널 점수 (0~100)
    dominant_channel: str       # "naver" | "global" | "balanced"
    channel_gap: float          # abs(naver - global) — 10 이상이면 채널 불균형


class NaverChannelDetail(BaseModel):
    """네이버 채널 세부 현황"""
    in_ai_briefing: bool        # 네이버 AI 브리핑 노출
    is_smart_place: bool        # 스마트플레이스 등록
    blog_mentions: int          # 블로그 언급 수
    is_on_kakao: bool           # 카카오맵 등록
    naver_rank: Optional[int]   # 지역 검색 순위
    top_competitor_blog_count: int  # 1위 경쟁사 블로그 언급 수


class WebsiteHealth(BaseModel):
    """웹사이트 SEO 체크리스트"""
    has_website: bool
    is_https: bool
    is_mobile_friendly: bool
    has_json_ld: bool                   # 구조화 데이터 (JSON-LD)
    has_schema_local_business: bool     # LocalBusiness 스키마
    has_open_graph: bool                # 소셜 미리보기 (OG 태그)
    has_favicon: bool
    title: Optional[str]
    error: Optional[str]                # 접근 불가 시 에러 메시지


class ScoreBreakdown(BaseModel):
    """6항목 세부 점수 (각 0~100)"""
    exposure_freq: float        # AI 검색 노출 빈도 (30%)
    review_quality: float       # 리뷰 수·평점·키워드 (20%)
    schema_score: float         # 정보 구조화 점수 (15%)
    online_mentions: float      # 온라인 언급 빈도 (15%)
    info_completeness: float    # 정보 완성도 (10%)
    content_freshness: float    # 콘텐츠 최신성 (10%)


class ScoreResult(BaseModel):
    """종합 점수 결과"""
    total_score: float          # 0~100
    grade: str                  # A | B | C | D
    breakdown: ScoreBreakdown
    channel_scores: ChannelScores
    weekly_change: Optional[float]      # 지난 스캔 대비 점수 변화
    rank_in_category: Optional[int]     # 업종 내 순위
    total_in_category: Optional[int]    # 업종 내 전체 사업장 수


class DiagnosisReport(BaseModel):
    """진단 리포트 — 스캔 1회의 전체 결과"""
    scan_id: str
    business_id: str
    scanned_at: datetime
    context: ScanContext            # 모든 하위 모델의 동작 분기 기준

    snapshot: BusinessSnapshot
    ai_visibility: AIVisibility
    # location_based 전용 — non_location이면 None
    naver_detail: Optional[NaverChannelDetail]
    # 웹사이트가 있을 때만 수집 (context 무관)
    website_health: Optional[WebsiteHealth]
    score: ScoreResult
```

### TypeScript 타입

```typescript
// frontend/types/diagnosis.ts

export interface BusinessSnapshot {
  name: string;
  category: string;
  context: ScanContext;
  region?: string;                  // location_based 필수, non_location = undefined
  platform_registration: PlatformRegistration;
  keyword_count: number;
}

export interface PlatformRegistration {
  naver_smart_place: boolean;
  kakao_maps: boolean;
  google_maps: boolean;
  website: boolean;
}

export interface AIPlatformResult {
  platform: string;
  mentioned: boolean;
  rank?: number;
  excerpt?: string;
  confidence?: { lower: number; upper: number };
  in_briefing?: boolean;
  in_ai_overview?: boolean;
  error?: string;
}

export interface AIVisibility {
  exposure_freq: number;
  exposure_rate: number;
  platforms: Record<string, AIPlatformResult>;
  mentioned_count: number;
  query_used: string;
}

export interface ChannelScores {
  naver_channel: number;
  global_channel: number;
  dominant_channel: "naver" | "global" | "balanced";
  channel_gap: number;
}

export interface NaverChannelDetail {
  in_ai_briefing: boolean;
  is_smart_place: boolean;
  blog_mentions: number;
  is_on_kakao: boolean;
  naver_rank: number | null;
  top_competitor_blog_count: number;
}

export interface WebsiteHealth {
  has_website: boolean;
  is_https: boolean;
  is_mobile_friendly: boolean;
  has_json_ld: boolean;
  has_schema_local_business: boolean;
  has_open_graph: boolean;
  has_favicon: boolean;
  title?: string;
  error?: string;
}

export interface ScoreBreakdown {
  exposure_freq: number;
  review_quality: number;
  schema_score: number;
  online_mentions: number;
  info_completeness: number;
  content_freshness: number;
}

export interface ScoreResult {
  total_score: number;
  grade: "A" | "B" | "C" | "D";
  breakdown: ScoreBreakdown;
  channel_scores: ChannelScores;
  weekly_change?: number;
  rank_in_category?: number;
  total_in_category?: number;
}

export interface DiagnosisReport {
  scan_id: string;
  business_id: string;
  scanned_at: string;
  context: ScanContext;
  snapshot: BusinessSnapshot;
  ai_visibility: AIVisibility;
  naver_detail?: NaverChannelDetail;    // location_based 전용
  website_health?: WebsiteHealth;       // 웹사이트 있을 때만
  score: ScoreResult;
}
```

**context별 필드 채움 규칙:**

| 필드 | location_based | non_location |
|------|---------------|-------------|
| `snapshot.region` | 필수 값 있음 | `undefined` |
| `naver_detail` | 항상 수집 | `undefined` |
| `website_health` | 웹사이트 있으면 수집 | 웹사이트 있으면 수집 |
| `score.channel_scores.naver_channel` | 의미 있음 | 참고용만 |

**플랜별 접근 범위:**

| 항목 | Trial | Basic | Pro | Biz |
|------|-------|-------|-----|-----|
| snapshot | O | O | O | O |
| ai_visibility (Gemini만) | O | — | — | — |
| ai_visibility (8개 전체) | — | O | O | O |
| naver_detail | O (location만) | O (location만) | O (location만) | O (location만) |
| website_health | O | O | O | O |
| score.breakdown | O | O | O | O |
| score.channel_scores | 미리보기 | O | O | O |

---

## 6. Domain 2 — MarketLandscape (시장 현황)

> "근처 같은 업종 가게들은 어떻게 잘되고 있어?"

`DiagnosisReport` + 경쟁사 스캔 데이터를 결합해 계산.

### Python 모델

```python
# backend/models/market.py

from pydantic import BaseModel
from typing import Optional, List


class MarketPosition(BaseModel):
    """시장 내 내 위치"""
    my_rank: int                    # 내 순위 (1위가 최상위)
    total_in_market: int            # 비교 가능한 전체 사업장 수
    my_score: float
    category_avg_score: float       # 업종 평균 점수
    top10_score: float              # 상위 10% 기준 점수
    percentile: float               # 내 위치 백분위 (상위 N%)
    is_above_average: bool


class CompetitorProfile(BaseModel):
    """경쟁 가게 1개의 현황"""
    competitor_id: str
    name: str
    score: float
    grade: str                      # A | B | C | D
    is_naver_smart_place: bool
    is_on_kakao: bool
    blog_mentions: int
    ai_mentioned: bool              # AI 검색 노출 여부
    ai_platform_count: int          # 몇 개 AI에 노출되는지
    strengths: List[str]            # ["AI 검색 강함", "블로그 많음", "리뷰 많음"]
    rank: int                       # 이 경쟁사의 시장 순위


class MarketDistribution(BaseModel):
    """업종 점수 분포"""
    grade_a_count: int              # 80점 이상
    grade_b_count: int              # 60~79점
    grade_c_count: int              # 40~59점
    grade_d_count: int              # 40점 미만
    distribution: List[Dict]        # [{"range": "80-100", "count": 3}, ...]


class MarketLandscape(BaseModel):
    """시장 현황 — 업종 기준 경쟁 현황
    context별 비교 범위:
      location_based: category + region 필터 (지역 동종업체)
      non_location:   category 전국 필터 (region = None)
    """
    context: ScanContext
    category: str
    region: Optional[str]           # location_based 필수, non_location = None
    position: MarketPosition
    competitors: List[CompetitorProfile]
    distribution: MarketDistribution
    data_updated_at: datetime       # 캐시 갱신 시각 (30분 TTL)
```

### TypeScript 타입

```typescript
// frontend/types/market.ts

export interface MarketPosition {
  my_rank: number;
  total_in_market: number;
  my_score: number;
  category_avg_score: number;
  top10_score: number;
  percentile: number;
  is_above_average: boolean;
}

export interface CompetitorProfile {
  competitor_id: string;
  name: string;
  score: number;
  grade: "A" | "B" | "C" | "D";
  is_naver_smart_place: boolean;
  is_on_kakao: boolean;
  blog_mentions: number;
  ai_mentioned: boolean;
  ai_platform_count: number;
  strengths: string[];
  rank: number;
}

export interface MarketDistribution {
  grade_a_count: number;
  grade_b_count: number;
  grade_c_count: number;
  grade_d_count: number;
  distribution: { range: string; count: number }[];
}

export interface MarketLandscape {
  context: ScanContext;
  category: string;
  region?: string;                  // location_based 필수, non_location = undefined
  position: MarketPosition;
  competitors: CompetitorProfile[];
  distribution: MarketDistribution;
  data_updated_at: string;
}
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

| 항목 | Trial | Basic | Pro | Biz |
|------|-------|-------|-----|-----|
| position (랭킹 수치) | 부분 | O | O | O |
| competitors (경쟁사 수) | 최대 3개 | 최대 5개 | 최대 20개 | 최대 50개 |
| distribution | — | O | O | O |
| CompetitorProfile.strengths | — | — | O | O |

---

## 7. Domain 3 — GapAnalysis (격차 분석)

> "1위 가게랑 나랑 뭐가 달라?"

현재 `gap_card.py`는 이미지만 생성. 격차 **데이터 모델**이 없는 상태 → 신규 정의.

### Python 모델

```python
# backend/models/gap.py

from pydantic import BaseModel
from typing import Optional, List


class DimensionGap(BaseModel):
    """점수 항목 1개의 격차"""
    dimension_key: str          # "exposure_freq" | "review_quality" | ...
    dimension_label: str        # "AI 검색 노출" | "리뷰 품질" | ...
    my_score: float             # 내 항목 점수
    top_score: float            # 1위 가게의 해당 항목 점수
    avg_score: float            # 업종 평균 해당 항목 점수
    gap_to_top: float           # top_score - my_score (양수 = 뒤처짐)
    gap_reason: str             # "네이버 스마트플레이스 미등록으로 구조화 점수 낮음"
    improvement_potential: str  # "high" | "medium" | "low"
    weight: float               # 이 항목의 전체 점수 가중치 (0.30 등)
    priority: int               # 1 = 개선 시 점수 향상 효과 가장 큼


class CompetitorGap(BaseModel):
    """1위 경쟁사와의 격차 요약"""
    top_competitor_name: str
    top_competitor_score: float
    my_score: float
    total_gap: float            # top - my
    strongest_gap_dimension: str    # 가장 차이가 큰 항목 label
    closeable_gap: float        # 실현 가능한 격차 좁힘 (realistic_improvement 합계)


class GapAnalysis(BaseModel):
    """격차 분석 — DiagnosisReport + MarketLandscape로부터 계산"""
    business_id: str
    scan_id: str
    analyzed_at: datetime
    context: ScanContext            # gap_reason 문구 및 dimension 가중치 분기 기준

    vs_top: CompetitorGap
    dimensions: List[DimensionGap]  # priority 오름차순 정렬 (context별 가중치 적용)
    gap_card_url: Optional[str]     # Supabase Storage URL (공유 이미지)
    estimated_score_if_fixed: float # 우선순위 상위 3개 개선 시 예상 점수
```

### TypeScript 타입

```typescript
// frontend/types/gap.ts

export interface DimensionGap {
  dimension_key: string;
  dimension_label: string;
  my_score: number;
  top_score: number;
  avg_score: number;
  gap_to_top: number;
  gap_reason: string;
  improvement_potential: "high" | "medium" | "low";
  weight: number;
  priority: number;
}

export interface CompetitorGap {
  top_competitor_name: string;
  top_competitor_score: number;
  my_score: number;
  total_gap: number;
  strongest_gap_dimension: string;
  closeable_gap: number;
}

export interface GapAnalysis {
  business_id: string;
  scan_id: string;
  analyzed_at: string;
  context: ScanContext;
  vs_top: CompetitorGap;
  dimensions: DimensionGap[];
  gap_card_url?: string;
  estimated_score_if_fixed: number;
}
```

**6개 항목 dimension_key 목록 (context별 가중치 적용):**

| dimension_key | dimension_label | weight (location) | weight (non_location) |
|---------------|----------------|:-----------------:|:---------------------:|
| `exposure_freq` | AI 검색 노출 빈도 | 30% | 35% ↑ |
| `review_quality` | 리뷰 품질 | 20% | 10% ↓ |
| `schema_score` | 정보 구조화 | 15% | 20% ↑ |
| `online_mentions` | 온라인 언급 | 15% | 20% ↑ |
| `info_completeness` | 정보 완성도 | 10% | 10% |
| `content_freshness` | 콘텐츠 최신성 | 10% | 5% ↓ |

**context별 gap_reason 예시:**

| dimension_key | location_based | non_location |
|---------------|---------------|-------------|
| `schema_score` | "네이버 스마트플레이스 미등록" | "웹사이트 JSON-LD 없음" |
| `online_mentions` | "블로그 언급 수 부족 (경쟁사 대비 -30건)" | "ChatGPT·Perplexity 미노출" |
| `info_completeness` | "카카오맵 등록 누락" | "웹사이트 Open Graph 미설정" |

**플랜별 접근 범위:**

| 항목 | Trial | Basic | Pro | Biz |
|------|-------|-------|-----|-----|
| vs_top (요약) | — | O | O | O |
| dimensions (전체) | — | O | O | O |
| gap_reason (원인 분석) | — | — | O | O |
| gap_card_url (공유 이미지) | — | O | O | O |
| estimated_score_if_fixed | — | — | O | O |

---

## 8. Domain 4 — ActionPlan (실행 계획)

> "뭘 어떻게 직접 해야 해?"

Claude Sonnet이 생성. 현재 `guide_generator.py`가 이 역할이나 `ActionTools`가 없는 상태 → 신규 추가.

### Python 모델

```python
# backend/models/action.py

from pydantic import BaseModel
from typing import Optional, List, Literal


class ActionItem(BaseModel):
    """개선 항목 1개"""
    rank: int                           # 우선순위 (1 = 가장 중요)
    dimension: str                      # 관련 점수 항목 dimension_key
    title: str                          # "네이버 스마트플레이스 등록하기"
    action: str                         # "1. 스마트플레이스 관리자(smartplace.naver.com) 접속..."
    expected_effect: str                # "AI 검색 노출 빈도 +15~25점 예상"
    difficulty: Literal["easy", "medium", "hard"]
    time_required: str                  # "10분" | "1시간" | "1주일"
    competitor_example: Optional[str]   # "인근 [가게명]이 이 방법으로 AI 노출 1위"
    is_quick_win: bool                  # 이번 주 완료 가능 여부


class FAQ(BaseModel):
    """AI 검색 최적화용 FAQ 항목"""
    question: str       # "강남 [업종] 추천해줘"
    answer: str         # "네, [사업장명]은 [강점] 전문점으로..."


class ActionTools(BaseModel):
    """직접 활용 가능한 실행 도구 — 모두 복사·붙여넣기 가능
    context별 생성 여부:
      json_ld_schema:          항상 생성
      faq_list:                항상 생성 (쿼리 형태가 context별로 다름)
      keyword_list:            항상 생성
      blog_post_template:      항상 생성 (location: 지역 키워드 중심, non_location: 전문성 중심)
      smart_place_checklist:   location_based 전용 → non_location이면 None
      seo_checklist:           non_location 전용 → location_based이면 None
    """
    json_ld_schema: str             # <script type="application/ld+json"> 코드
    faq_list: List[FAQ]             # AI 검색 최적화용 FAQ 질문/답변 (5~10개)
    keyword_list: List[str]         # 리뷰·블로그에 넣어야 할 핵심 키워드
    blog_post_template: str         # 블로그 포스팅 초안 (800~1000자)
    smart_place_checklist: Optional[List[str]]  # location_based 전용
    seo_checklist: Optional[List[str]]          # non_location 전용 (웹사이트 SEO 항목)


class ActionProgress(BaseModel):
    """체크리스트 진행률 (클라이언트 localStorage 기반)"""
    total_items: int
    completed_items: int
    completion_rate: float          # 0.0 ~ 1.0
    completed_ranks: List[int]      # 완료한 action item의 rank 목록


class ActionPlan(BaseModel):
    """실행 계획 — DiagnosisReport + GapAnalysis를 기반으로 Claude Sonnet 생성"""
    plan_id: str
    business_id: str
    scan_id: str
    generated_at: datetime
    context: ScanContext            # ActionItem.action 내용과 ActionTools 생성 분기 기준

    summary: str                    # 3줄 현황 요약
    items: List[ActionItem]         # 전체 개선 항목 (priority 순, context별 가중치 적용)
    quick_wins: List[ActionItem]    # items 중 is_quick_win=True만
    next_month_goal: str            # "다음 달까지 AI 노출 빈도 +20% 목표"
    tools: ActionTools
    progress: Optional[ActionProgress]  # 프론트에서 주입
```

### TypeScript 타입

```typescript
// frontend/types/action.ts

export interface ActionItem {
  rank: number;
  dimension: string;
  title: string;
  action: string;
  expected_effect: string;
  difficulty: "easy" | "medium" | "hard";
  time_required: string;
  competitor_example?: string;
  is_quick_win: boolean;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ActionTools {
  json_ld_schema: string;
  faq_list: FAQ[];
  keyword_list: string[];
  blog_post_template: string;
  smart_place_checklist?: string[];   // location_based 전용
  seo_checklist?: string[];           // non_location 전용
}

export interface ActionProgress {
  total_items: number;
  completed_items: number;
  completion_rate: number;
  completed_ranks: number[];
}

export interface ActionPlan {
  plan_id: string;
  business_id: string;
  scan_id: string;
  generated_at: string;
  context: ScanContext;
  summary: string;
  items: ActionItem[];
  quick_wins: ActionItem[];
  next_month_goal: string;
  tools: ActionTools;
  progress?: ActionProgress;
}
```

**플랜별 접근 범위:**

| 항목 | Trial | Basic | Pro | Biz |
|------|-------|-------|-----|-----|
| summary | — | O | O | O |
| quick_wins (상위 3개) | — | O | O | O |
| items (전체) | — | — | O | O |
| tools.json_ld_schema | 샘플 | O | O | O |
| tools.faq_list | — | — | O | O |
| tools.keyword_list | — | O | O | O |
| tools.blog_post_template | — | — | O | O |
| tools.smart_place_checklist | — | O (location만) | O (location만) | O (location만) |
| tools.seo_checklist | — | O (non_loc만) | O (non_loc만) | O (non_loc만) |

---

## 9. 점수 계산 시스템

### 9.1 종합 점수 공식

```
Total Score = Σ (dimension_score × weight[context])
```

**location_based 가중치:**

```
dimension_score × weight
─────────────────────────────────────────────────────────────────────
exposure_freq     × 0.30   AI 노출 빈도 (Gemini 100회)
review_quality    × 0.20   리뷰 수·평점·키워드 다양성 (★ 오프라인 중요)
schema_score      × 0.15   정보 구조화 (스마트플레이스 + 웹사이트)
online_mentions   × 0.15   온라인 언급 (블로그 + AI 플랫폼)
info_completeness × 0.10   정보 완성도
content_freshness × 0.10   콘텐츠 최신성
─────────────────────────────────────────────────────────────────────
Total                       0~100점
```

**non_location 가중치:**

```
dimension_score × weight
─────────────────────────────────────────────────────────────────────
exposure_freq     × 0.35   AI 노출 빈도 (★ 온라인은 AI 검색이 핵심)
review_quality    × 0.10   리뷰 품질 (온라인 전문직은 상대적으로 낮음)
schema_score      × 0.20   정보 구조화 (★ 웹사이트 JSON-LD 핵심)
online_mentions   × 0.20   온라인 언급 (★ 전국 단위 콘텐츠 언급)
info_completeness × 0.10   정보 완성도
content_freshness × 0.05   콘텐츠 최신성 (전문직은 상대적으로 낮음)
─────────────────────────────────────────────────────────────────────
Total                       0~100점
```

### 9.2 등급 기준

| 등급 | 점수 | 의미 |
|------|------|------|
| A | 80점 이상 | AI 검색 최적화 선도 수준 |
| B | 60~79점 | 평균 이상, 개선 여지 있음 |
| C | 40~59점 | 평균 미만, 집중 개선 필요 |
| D | 40점 미만 | 기초부터 시작 필요 |

### 9.3 채널 점수

**네이버 채널 점수 (0~100)**

| 항목 | 배점 |
|------|------|
| 네이버 AI 브리핑 노출 | 35점 |
| 네이버 AI 브리핑 명시 포함 | +15점 |
| 스마트플레이스 등록 | 20점 |
| 블로그 언급 수 (비례) | 최대 20점 |
| 카카오맵 등록 | 10점 |

**글로벌 AI 채널 점수 (0~100)**

| 항목 | 배점 |
|------|------|
| Gemini 노출 빈도 비례 | 최대 25점 |
| ChatGPT 노출 | 20점 |
| Google AI Overview 노출 | 20점 |
| Perplexity 노출 | 15점 |
| Grok 노출 | 10점 |
| Claude 노출 | 10점 |
| 웹사이트 존재 | 2점 |
| JSON-LD 존재 | 2점 |
| LocalBusiness 스키마 | 1점 |

### 9.4 schema_score 계산 — context별 분기

```
location_based:
  schema_score = (60 if is_smart_place else 0) + (40 if website_url else 0)
  → 스마트플레이스 등록이 기본, 웹사이트는 보조

non_location:
  schema_score = (80 if website_url + has_json_ld else 40 if website_url else 0)
               + (20 if google_place_id else 0)
  → 독립 웹사이트 + JSON-LD가 핵심, Google Place ID 보조
```

### 9.5 dominant_channel 판단 로직

```python
gap = abs(naver_channel - global_channel)
if gap < 10:
    dominant_channel = "balanced"
elif naver_channel > global_channel:
    dominant_channel = "naver"
else:
    dominant_channel = "global"
```

---

## 10. 데이터 흐름

### 10.1 Trial 스캔 흐름

```
POST /api/scan/trial
  │
  ├─ TrialScanRequest 검증
  ├─ ScanContext 결정 (business_type 필드)
  ├─ IP 기반 레이트 리밋 체크 (20회/일)
  │
  ├─ [병렬 실행 — location_based]
  │   ├─ GeminiScanner.single_check("{region} {category} 추천")
  │   ├─ get_naver_visibility()   → NaverChannelDetail
  │   └─ get_kakao_visibility()   → KakaoVisibilityData
  │
  ├─ [병렬 실행 — non_location]
  │   ├─ GeminiScanner.single_check("{keyword} 추천")
  │   └─ WebsiteChecker.check()   → WebsiteHealth (website_url 있는 경우)
  │   (naver/kakao 수집 생략)
  │
  ├─ score_engine.calculate_score(context=...)  → ScoreResult
  │
  ├─ trial_scans 테이블 저장 (IP 해시)
  │
  └─ DiagnosisReport 반환
      context=location_based: gemini + naver_detail + kakao / website_health 없음
      context=non_location:   gemini + website_health / naver_detail 없음
```

### 10.2 Full 스캔 흐름

```
POST /api/scan/full  →  SSE 토큰 발급  →  POST /api/scan/stream
  │
  ├─ JWT 인증 + 사업장 소유권 검증
  ├─ 플랜별 스캔 한도 체크 (rate_limit.py)
  │
  ├─ [병렬 실행 — API 기반]
  │   ├─ GeminiScanner.run_100_samples()   → AIPlatformResult (exposure_freq)
  │   ├─ ChatGPTScanner.check()            → AIPlatformResult
  │   ├─ PerplexityScanner.check()         → AIPlatformResult
  │   ├─ GrokScanner.check()               → AIPlatformResult
  │   └─ ClaudeScanner.check()             → AIPlatformResult
  │
  ├─ [순차 실행 — Playwright 세마포어 2개 제한]
  │   ├─ NaverScanner.parse()              → AIPlatformResult
  │   ├─ ZetaScanner.parse()              → AIPlatformResult
  │   └─ GoogleScanner.parse()            → AIPlatformResult
  │
  ├─ [병렬 보조 데이터 — location_based]
  │   ├─ get_kakao_visibility()            → KakaoVisibilityData
  │   └─ WebsiteChecker.check()           → WebsiteHealth (website_url 있는 경우)
  │
  ├─ [병렬 보조 데이터 — non_location]
  │   └─ WebsiteChecker.check()           → WebsiteHealth (website_url 있는 경우)
  │   (naver/kakao 수집 생략)
  │
  ├─ [경쟁사 스캔]
  │   └─ GeminiScanner.single_check() × N  → CompetitorProfile[]
  │
  ├─ score_engine.calculate_score()        → ScoreResult
  │
  ├─ [DB 저장]
  │   ├─ scan_results INSERT
  │   ├─ score_history UPSERT
  │   ├─ ai_citations INSERT (언급된 플랫폼)
  │   └─ businesses UPDATE (keyword_diversity)
  │
  ├─ kakao_notify (스캔 완료 알림, opt-in)
  │
  └─ DiagnosisReport 반환 (전체)
```

### 10.3 ActionPlan 생성 흐름

```
POST /api/guide/generate
  │
  ├─ DiagnosisReport 조회 (scan_id)
  ├─ MarketLandscape 조회 (location: category + region / non_location: category 전국)
  ├─ GapAnalysis 계산 (gap_analyzer.py)
  │
  ├─ Claude Sonnet 4.6 호출
  │   ├─ System Prompt: 소상공인 전문 컨설턴트 역할
  │   └─ User Input: DiagnosisReport + GapAnalysis 요약
  │
  ├─ ActionPlan 파싱 + 검증
  ├─ ActionTools 생성 (context별 분기)
  │   ├─ json_ld (schema_generator.py) — 항상
  │   ├─ faq_list (Claude 생성) — 항상 (쿼리 형태 context별)
  │   ├─ keyword_list (scan 키워드 + 경쟁사 키워드) — 항상
  │   ├─ blog_post_template (Claude 생성) — 항상 (location: 지역, non_location: 전문성)
  │   ├─ smart_place_checklist — location_based 전용
  │   └─ seo_checklist (website_health 결과) — non_location 전용
  │
  ├─ guides 테이블 저장
  └─ ActionPlan 반환
```

---

## 11. DB 테이블 매핑

| 도메인 모델 | 원천 DB 테이블 | 비고 |
|------------|--------------|------|
| `Business` | `businesses` | 영속 엔티티 |
| `Competitor` | `competitors` | 영속 엔티티 |
| `DiagnosisReport` | `scan_results` | 1행 = 1 DiagnosisReport |
| `ScoreResult` | `scan_results` + `score_history` | 추세용 이력은 score_history |
| `AIPlatformResult` | `scan_results.*_result` (JSONB) | 플랫폼별 JSONB 컬럼 |
| `NaverChannelDetail` | `scan_results.naver_result` (JSONB) | |
| `WebsiteHealth` | `scan_results.website_check_result` (JSONB) | |
| `MarketLandscape` | `score_history` + `businesses` | 집계 쿼리로 계산 |
| `CompetitorProfile` | `competitors` + `scan_results.competitor_scores` | |
| `GapAnalysis` | 계산 모델 (저장 없음) | 요청 시 실시간 계산 |
| `ActionPlan` | `guides` | items_json, priority_json JSONB |
| `ActionTools` | `guides.items_json` 내 포함 | |

### scan_results 컬럼 → 도메인 필드 대응

```
scan_results 컬럼              DiagnosisReport 필드
──────────────────────────────────────────────────────
id                          → scan_id
business_id                 → business_id
scanned_at                  → scanned_at
query_used                  → ai_visibility.query_used
gemini_result (JSONB)       → ai_visibility.platforms["gemini"]
chatgpt_result (JSONB)      → ai_visibility.platforms["chatgpt"]
perplexity_result (JSONB)   → ai_visibility.platforms["perplexity"]
grok_result (JSONB)         → ai_visibility.platforms["grok"]
naver_result (JSONB)        → ai_visibility.platforms["naver"] + naver_detail
claude_result (JSONB)       → ai_visibility.platforms["claude"]
zeta_result (JSONB)         → ai_visibility.platforms["zeta"]
google_result (JSONB)       → ai_visibility.platforms["google"]
kakao_result (JSONB)        → naver_detail.is_on_kakao 등
website_check_result (JSONB)→ website_health
exposure_freq               → ai_visibility.exposure_freq
total_score                 → score.total_score
score_breakdown (JSONB)     → score.breakdown
naver_channel_score         → score.channel_scores.naver_channel
global_channel_score        → score.channel_scores.global_channel
competitor_scores (JSONB)   → MarketLandscape.competitors (입력)
rank_in_query               → score.rank_in_category (임시)
```

---

## 12. API 엔드포인트 매핑

| 엔드포인트 | 반환 도메인 | 플랜 |
|-----------|------------|------|
| `POST /api/scan/trial` | `DiagnosisReport` (Trial 제한) | 비회원 |
| `POST /api/scan/full` | `DiagnosisReport` (전체) | Basic+ |
| `GET /api/scan/{id}` | `DiagnosisReport` | Basic+ |
| `GET /api/report/score/{biz_id}` | `ScoreResult` | Basic+ |
| `GET /api/report/history/{biz_id}` | `ScoreResult[]` (30일) | Basic+ |
| `GET /api/report/competitors/{biz_id}` | `MarketLandscape` | Basic+ |
| `GET /api/report/ranking/{cat}/{region}` | `MarketLandscape.position` | Basic+ |
| `GET /api/report/benchmark/{cat}/{region}` | `MarketLandscape.distribution` | Basic+ |
| `POST /api/guide/generate` | `ActionPlan` | Basic+ |
| `GET /api/guide/{biz_id}/latest` | `ActionPlan` | Basic+ |
| `GET /api/gap/{biz_id}` | `GapAnalysis` | Basic+ |
| `POST /api/schema/generate` | `ActionTools.json_ld_schema` (단독) | Free+ |

---

## 13. 구현 현황

### 현재 구현 상태

| 도메인 | 데이터 모델 정의 | 백엔드 로직 | 프론트 타입 | 상태 |
|--------|----------------|------------|------------|------|
| **ScanContext** | 미정의 | `business_type`만 존재 | `business_type`만 존재 | 신규 정의 필요 |
| **DiagnosisReport** | 미정의 (raw dict) | 완료 (context 미분기) | 부분 완료 | context 분기 추가 필요 |
| **MarketLandscape** | 미정의 (raw dict) | 부분 완료 (region 필수 고정) | 부분 완료 | region Optional 변경 필요 |
| **GapAnalysis** | 미정의 | 이미지만 있음 | 없음 | 신규 구현 필요 |
| **ActionPlan** | 미정의 (raw dict) | 부분 완료 | 부분 완료 | ActionTools + seo_checklist 신규 필요 |

### 구현 계획 (Phase 순서)

```
Phase A — ScanContext + 모델 파일 생성 (로직 변경 없음, 안전)
  ├─ backend/models/context.py   (신규 — ScanContext Enum)
  ├─ backend/models/diagnosis.py (context 필드 포함)
  ├─ backend/models/market.py    (context + region Optional)
  ├─ backend/models/gap.py       (context 필드 포함)
  ├─ backend/models/action.py    (context + seo_checklist 포함)
  └─ frontend/types/ 전면 재편
      ├─ context.ts  (ScanContext 타입)
      ├─ diagnosis.ts
      ├─ market.ts
      ├─ gap.ts
      └─ action.ts

Phase B — 스캔 응답 DiagnosisReport로 구조화 + context 분기
  ├─ backend/routers/scan.py
  │   ├─ business_type → ScanContext 변환
  │   ├─ location_based: naver/kakao 수집, non_location: 생략
  │   └─ DiagnosisReport 반환
  └─ backend/services/score_engine.py
      ├─ WEIGHTS[context] 분기 적용
      ├─ schema_score context별 계산
      └─ ScoreResult 타입 반환

Phase C — GapAnalysis 신규 구현
  ├─ backend/services/gap_analyzer.py  (신규)
  │   └─ context별 가중치 + gap_reason 분기
  ├─ backend/routers/report.py  →  /api/gap/{biz_id} 엔드포인트 추가
  └─ backend/services/gap_card.py  →  GapAnalysis 입력받도록 수정

Phase D — ActionPlan + ActionTools 완성
  ├─ backend/services/action_tools.py  (신규)
  │   ├─ generate_faq_list(context)         context별 쿼리 형태
  │   ├─ generate_blog_template(context)    location: 지역, non_location: 전문성
  │   ├─ extract_keyword_list()
  │   ├─ build_smart_place_checklist()      location_based 전용
  │   └─ build_seo_checklist(website_health)  non_location 전용
  └─ backend/services/guide_generator.py  →  ActionPlan 타입 반환

Phase E — 프론트엔드 연결
  ├─ frontend/lib/api.ts  →  4개 도메인 함수로 재구성
  └─ frontend/app/(dashboard)/  →  새 타입 + context 분기 렌더링 적용
```

### 변경하지 않는 것

| 파일 | 이유 |
|------|------|
| `services/ai_scanner/*.py` | 검증된 AI 스캔 핵심 로직 |
| `score_engine.py` 계산 공식 | context별 WEIGHTS 분기 추가 외에 알고리즘 불변 |
| DB 테이블 구조 | 스키마 변경 최소화 (컬럼 추가는 가능) |
| 인증·결제 로직 | 건드릴 이유 없음 |
| `middleware/plan_gate.py` | 기존 플랜 제한 유지 |

---

*최종 업데이트: 2026-03-29 | 도메인 모델 v2.1 — ScanContext (위치 기반 / 위치 무관) 분기 반영*
