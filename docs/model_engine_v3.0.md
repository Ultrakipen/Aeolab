# AEOlab 모델 엔진 v3.0 — 업종별 듀얼트랙 통합 모델

> 최초 작성: 2026-03-31 | 최종 재정비: 2026-03-31 (3차 업데이트)
> 기반 자료: 기획서 v7.2 + 개발문서 v1.3 + 시장조사 2026-03 + 코드 감사 + 구멍 검토 + 추가 웹 조사
> 이 문서는 새로운 대화창에서도 체계적 구현이 진행될 수 있도록 작성된 단일 참조 문서입니다.
>
> **이번 재정비 포인트 (3차):**
> - 한국 AI 검색 시장 심층 통계 추가 (검색 목적 변화, 연령별 격차, 플랫폼 점유율)
> - 네이버 2026 확장 로드맵 Q분기별 상세화
> - 소상공인 AI 도입 현실 격차 데이터 추가
> - Track 2 가중치 설정 근거 강화 (글로벌 플랫폼 점유율)
> - 업종별 가중치 연령 인구통계 반영

---

## 목차

1. [시장 조사 핵심 발견](#1-시장-조사-핵심-발견)
2. [기존 모델의 문제점](#2-기존-모델의-문제점)
3. [v3.0 모델 정의 및 원리](#3-v30-모델-정의-및-원리)
4. [업종별 듀얼트랙 가중치](#4-업종별-듀얼트랙-가중치)
5. [Track 1 — 네이버 브리핑 점수 설계](#5-track-1--네이버-브리핑-점수-설계)
6. [Track 2 — 글로벌 AI 점수 설계](#6-track-2--글로벌-ai-점수-설계)
7. [업종별 키워드 체계 및 액션](#7-업종별-키워드-체계-및-액션)
8. [데이터 흐름 전체 프로세스](#8-데이터-흐름-전체-프로세스)
9. [현재 코드와의 매핑](#9-현재-코드와의-매핑)
10. [구현 로드맵 — 파일별 변경 명세](#10-구현-로드맵--파일별-변경-명세)
11. [제거할 것](#11-제거할-것)
12. [체험 플로우 재설계](#12-체험-플로우-재설계)
13. [플랜별 기능 분리](#13-플랜별-기능-분리)
14. [검증 체크리스트 (Phase A~C)](#14-검증-체크리스트)
15. [미해결 과제 (Phase D+)](#15-미해결-과제-phase-d)

---

## 1. 시장 조사 핵심 발견

> 조사 시점: 2026년 3월 | 출처: 네이버 공식 발표, ZDNet Korea, 인터넷트렌드, 스탯카운터,
> 오픈서베이 AI 검색 트렌드 리포트 2026, SearchMaster, Demand Sage, 대한상공회의소

### 1.1 기획서 v7.2의 가정이 틀렸음

| 지표 | v7.2 가정 | 실제 (2026-03 기준) | 영향 |
|------|-----------|---------------------|------|
| AI 대화형 여정 비중 | 10% | **45%** (1년 전 6% → 현재 45%) | Track 2를 미래 대비로 미루면 안 됨 |
| ChatGPT 한국 MAU | 2,293만 (추정) | **2,162만** (2025년 11월 실측) | 글로벌 AI 즉시 현실, 추정치 아닌 실측 |
| 한국 ChatGPT 유료 구독 순위 | — | **세계 2위** (미국 다음) | 구독 의향 높은 시장 |
| 네이버 검색 점유율 | 82.8% | **62.86%** (인터넷트렌드) / **42.5%** (스탯카운터) ※주석1 | 네이버만으론 부족, 격차 좁아짐 |
| AI 브리핑 조건검색 확장 | 2026 하반기 | **2026년 말 2배 확대** (CEO 공식 발표) | 지금 준비 = 선점 |
| 위치 검색 비중 | (가정 없음) | **40.6%** (오픈서베이 2026, 전년比 -5.5%p) | 지식 습득(47.6%)에 역전됨 — 글로벌 AI 가속 근거 |
| 한국 AI 검색 채택률 | — | **54.5%** (2025년 12월) | 과반이 AI 검색 활용 중 |

> ※주석1: **측정 방법론 차이** — 인터넷트렌드는 국내 웹사이트 트래픽 기반(한국 편향), 스탯카운터는 글로벌 표본. 두 지표 모두 "네이버가 절대 우위는 아니며, 구글·AI와의 격차가 좁아졌다"는 점에서 일치. AEOlab이 Track 2(글로벌 AI)를 병행하는 핵심 근거.

### 1.2 네이버 AI 브리핑 공식 통계

**출시 이력**
- 2025년 3월 27일: AI 브리핑 정식 출시 (HyperCLOVA X 기반, 통합검색·플레이스·쇼핑)
- 2025년 6월: 플레이스 특화 버전 출시 (음식점·카페 중심)
- 2025년 8월: AI 브리핑 효과 통계 공식 발표

**효과 통계** (2025년 8월 네이버 공식, 음식/음료 업종 기준)

| 지표 | 변화율 |
|------|--------|
| 클릭률(CTR) | **+27.4%** |
| 체류시간 | **+10.4%** |
| '더보기' 탭 클릭 | **+137%** |
| 메뉴 더보기 | **+30%** |
| 예약·주문 건수 | **+8%** |

**2026 확장 로드맵** (네이버 CEO 공식 발표 + KoreaTimes 보도)

| 시기 | 내용 |
|------|------|
| 2026년 Q1 | AI 쇼핑 에이전트 (네이버플러스 스토어) — **완료** |
| 2026년 Q2 | 통합검색 **AI 탭** 출시 (대화형 + 예약·구매·결제 연동) |
| 2026년 H2 | 버티컬 에이전트 확장 (금융·건강·여행), **Agent N** 출시 |
| 2026년 연말 | AI 브리핑 커버리지 현재 대비 **2배** 확대 |

**현재 제한 및 확장 방향**
- 현재: 상호명 직접 검색에만 AI 브리핑 적용
- 확장: 조건 검색("주차 가능한 식당", "아기 의자 있는 카페") → 2026 연말 목표
- 업종 확대: 음식/카페 → 숙박·미용·명소 순차 적용
- **핵심 랭킹 요소** (2025년 5월~): 리뷰 수, 전화·예약·길찾기 실제 행동 데이터, 정보 완성도, 키워드 풍부도

### 1.3 한국 AI 검색 시장 심층 구조

#### 검색 목적 변화 (오픈서베이 AI 검색 트렌드 리포트 2026)

| 검색 목적 | 2025 | 2026 | 변화 |
|-----------|------|------|------|
| 지식/정보 습득 | — | **47.6%** | **1위로 역전** |
| 위치/장소 검색 | ~46% | **40.6%** | **-5.5%p 하락** |

> **AEOlab 함의**: 위치 기반 업종(restaurant, cafe)도 AI로 "정보 습득 후 방문" 패턴 증가.
> 단순 지역 노출뿐 아니라 AI 대화 문맥에서도 언급되는 것이 중요해짐.

#### 연령별 검색 패턴 (2025-2026)

| 연령대 | 네이버 주 사용 비율 | 의미 |
|--------|---------------------|------|
| 30-50대 | **70%+** | 소상공인 주 고객층 — Track 1 여전히 중요 |
| 20대 | **55.2%** | AI 검색 45% 병행 — 업종에 따라 Track 2 비중 높아야 |
| 10대 | **43.5%** | AI 네이티브 세대 — 학원·피트니스 업종 Track 2 강화 근거 |

#### 글로벌 AI 플랫폼 시장 점유율 (2026년 3월 기준)

| 플랫폼 | 글로벌 점유율 | 글로벌 MAU | Track 2 가중치 근거 |
|--------|-------------|-----------|---------------------|
| ChatGPT | **59.5%** | ~4억 | multi_ai_exposure 20점 배정 |
| Microsoft Copilot | 14.0% | — | (별도 스캐너 없음) |
| Gemini | 13.4% | ~4억 | 100회 샘플링 주력 50점 |
| Perplexity | **6.2%** | 3,300만+ | 15점 배정 |
| Claude | **3.2%** | 2,000-3,500만 | 5점 배정 |
| Grok 기타 | 3.7% | — | 10점 배정 |

> Gemini 100회 샘플링이 최대 50점을 차지하는 이유: 한국 시장에서 글로벌 점유율이 ChatGPT와 비슷하고
> 저비용으로 통계적 신뢰성 있는 노출 빈도를 측정할 수 있는 유일한 플랫폼이기 때문.

### 1.4 경쟁 서비스 공백 확인

**결론: 한국 시장에 AEOlab과 직접 경쟁하는 서비스가 없음**

| 서비스 | 오프라인 플레이스 AI | 멀티 AI 추적 |
|--------|---------------------|--------------|
| 아이템스카우트 | ❌ (스마트스토어 전용) | ❌ |
| 네이버 비즈어드바이저 | ❌ (스마트스토어 전용) | ❌ |
| 플레이스 마케팅 대행 | △ (리뷰 대행만, 월 10~30만원) | ❌ |
| 글로벌 AI SEO 툴(Pec AI 등) | ❌ (한국어 없음) | △ |
| **AEOlab** | **✅** | **✅** |

### 1.5 소상공인 AI 도입 현실 — 사업 기회

**AI 도입 의향-실제 격차** (대한상공회의소 2025-2026)

| 지표 | 수치 | 의미 |
|------|------|------|
| AI 필요성 인식 | **78.4%** | 대부분이 AI가 필요하다고 느낌 |
| 실제 AI 도입률 (SME) | **28.7%** | 인식 대비 실행 격차 50%p |
| 대기업 도입률 | 48.8% | SME 도입률의 1.7배 |
| 수도권 도입률 | 40.4% | 비수도권(17.9%)의 2.3배 |

> **AEOlab 포지셔닝**: "AI가 필요하다는 건 아는데 어떻게 해야 할지 모르는 소상공인" →
> AEOlab이 "AI 검색 노출"이라는 구체적 문제를 "5분 내 실행 가능한 단계"로 변환.
> 소상공인 월평균 온라인 광고비 29만원, 플레이스 마케팅 대행 10~30만원 대비 9,900원 = 1/30.

---

## 2. 기존 모델의 문제점

### 2.1 전략-코드 단절

```
기획서 v7.2:  Track 1(네이버 브리핑)이 핵심
코드 현실:    8개 AI 스캐너 아키텍처 (Track 2 중심)
대시보드:     "AI Visibility Score 67점" (소상공인에게 무의미)
```

### 2.2 score_engine.py 구조적 결함

```python
# 문제 1: keyword_gap (가장 가치 있는 분석)이 total_score에 반영되지 않음
keyword_taxonomy.py → gap_analyzer.py → GapAnalysis
                                              ↕ 단절
score_engine.py → total_score (keyword_gap 미사용)

# 문제 2: 채널 점수가 total_score와 분리됨
_calc_naver_channel_score()  ┐
_calc_global_channel_score() ┘ → 출력에만 포함, total_score 계산에 미사용

# 문제 3: ScanContext가 2개뿐 (location_based / non_location)
# 9개 업종의 서로 다른 채널 비중을 표현 불가
```

### 2.3 track 비중 오설정

기획서 v7.2 기준 음식점 네이버/글로벌 = 85%/15% → 연구 결과 70%/30%로 수정 필요.
AI 대화형 여정이 10%가 아니라 45%, 위치 검색 비중이 40.6%로 하락 중이므로.

---

## 3. v3.0 모델 정의 및 원리

### 3.1 모델명

**AEOlab 업종별 듀얼트랙 통합 AI 가시성 모델 v3.0**

### 3.2 핵심 공식

```
Unified Score = (Track1_Score × naver_weight) + (Track2_Score × global_weight)

단, naver_weight + global_weight = 1.0
    naver_weight / global_weight 비율은 업종(category)에 따라 다름
```

### 3.3 설계 원칙

1. **업종 중심 분기**: 모든 점수, 가중치, 가이드, 액션이 업종별로 다름
2. **행동 우선**: "점수 67점"이 아니라 "이 키워드 3개가 없어서 AI 조건 검색에 안 나옵니다"
3. **근거 기반**: 수치 예측(+N% 기대효과) 금지, 구체적 행동 + 이유만 제시
4. **양방향 커버**: Track 1(네이버)과 Track 2(글로벌 AI) 동시 관리
5. **즉시 실행 가능**: 고객 없이, 오늘 10분 안에 AI 브리핑 신호 강화 가능한 것부터
6. **데이터 합법성**: 네이버 공식 API 우선, Playwright는 자기 가게 한정(Phase 2+)

### 3.4 소상공인의 4가지 질문 → 4개 도메인 (유지)

```
"내 가게 지금 어때?"           → DiagnosisReport  (Unified Score + 채널별 분석)
"근처 경쟁 가게들은?"          → MarketLandscape  (업종별 지역 순위)
"1위 가게랑 나랑 뭐가 달라?"   → GapAnalysis      (키워드 갭 + 채널 갭)
"뭘 직접 해야 해?"             → ActionPlan       (업종별 즉시 실행 도구)
```

---

## 4. 업종별 듀얼트랙 가중치

### 4.1 비율표

```python
# backend/services/score_engine.py에 추가
# 근거: 오픈서베이 2026 AI 검색 트렌드 + 업종별 소비자 검색 패턴 + 연령별 사용자 분포
DUAL_TRACK_RATIO: dict[str, dict[str, float]] = {
    # 위치 기반 업종 (location_based)
    "restaurant": {"naver": 0.70, "global": 0.30},  # 즉시방문형 = 네이버, 30-50대 고객 70%+
    "cafe":       {"naver": 0.65, "global": 0.35},  # 분위기 탐색 AI 증가, 20대 고객 많음
    "beauty":     {"naver": 0.65, "global": 0.35},  # 당일예약 네이버, 전문시술 AI 리서치
    "fitness":    {"naver": 0.60, "global": 0.40},  # 10-20대 고객 多 → AI 네이티브 비중 높음
    "pet":        {"naver": 0.65, "global": 0.35},  # 동물병원 AI 검색 빠르게 증가
    "clinic":     {"naver": 0.55, "global": 0.45},  # 증상 검색 = ChatGPT, 지식 습득 목적 47.6%
    "academy":    {"naver": 0.40, "global": 0.60},  # 10대(43.5% 네이버) → AI 네이티브, 커리큘럼 비교 AI
    # 위치 무관 업종 (non_location)
    "legal":      {"naver": 0.20, "global": 0.80},  # 전문직 = ChatGPT·Perplexity 주전장
    "shopping":   {"naver": 0.10, "global": 0.90},  # 온라인 = 글로벌 AI 압도적
}

# ★ fallback: restaurant 아닌 중립 기본값 (오진단 방지)
DEFAULT_DUAL_TRACK_RATIO = {"naver": 0.60, "global": 0.40}

def get_dual_track_ratio(category: str) -> dict[str, float]:
    """업종 코드로 naver/global 비율 반환. 미등록 업종은 중립 기본값(0.60/0.40)."""
    from services.keyword_taxonomy import normalize_category
    key = normalize_category(category)
    return DUAL_TRACK_RATIO.get(key, DEFAULT_DUAL_TRACK_RATIO)
```

### 4.2 비율 결정 근거 (상세)

| 업종 | 네이버 비중 근거 | 글로벌 AI 비중 근거 | 연령 인구통계 |
|------|----------------|---------------------|---------------|
| 음식점 | 즉시방문형 → 네이버 플레이스 직행 | AI 대화형 45%, "강남 파스타 맛집 추천" ChatGPT | 30-50대 70%+ 네이버 |
| 카페 | 네이버 저장·리뷰 탐색 강함 | 인스타·AI로 분위기 탐색, 20대 55% 네이버 | 2030 고객 많음 |
| 피트니스 | 위치 기반이지만 | 10-20대 체형 교정·PT 비교 AI 검색 증가 | 10대 43.5%, 20대 55% 네이버 — Track 2 상향 |
| 학원 | 지역 학원 탐색 네이버 | 10대 AI 네이티브, 커리큘럼·강사 비교 AI | 10대 학생 = ChatGPT 일상화 → academy 0.40/0.60 |
| 병원 | 지역 검색 + 네이버 건강 탭 | 증상 검색 = ChatGPT, 지식 습득 1위(47.6%) 반영 | 전 연령 AI 의료 검색 증가 |
| 법률 | 광고/리뷰 비중 낮음 | ChatGPT "이혼 전문 변호사 추천" 핵심 | 전문직 = AI 대화형 압도적 |

---

## 5. Track 1 — 네이버 브리핑 점수 설계

### 5.1 구성 항목 및 가중치

```python
NAVER_TRACK_WEIGHTS = {
    "keyword_gap_score":          0.35,  # 업종별 키워드 커버리지 — 조건검색 직결
    "review_quality":             0.25,  # 리뷰 수·평점·최신성·키워드 다양성
    "smart_place_completeness":   0.25,  # FAQ 등록·소개글·소식·부가정보 완성도
    "naver_exposure_confirmed":   0.15,  # 네이버 스캐너 AI 브리핑 실제 확인
}
```

### 5.2 각 항목 계산 상세

#### keyword_gap_score (35%)

```python
# 소스: keyword_taxonomy.py의 analyze_keyword_coverage() 결과 활용
# 입력: category, review_excerpts
# 출력: coverage_rate (0.0~1.0)

# ★ Cold Start 처리 (v3.0 필수):
# review_excerpts 없을 때 0점 처리 → Track 1 총점 35% 왜곡 → 소상공인 오진단
# 우선순위 3단계:
#   1) 사용자 직접 입력 리뷰 텍스트 (가장 정확)
#   2) naver_visibility.top_blogs 텍스트 자동 활용 (네이버 블로그 API)
#   3) fallback: coverage_rate = 0.30 (업종 평균 추정, 왜곡 방지)

if review_excerpts:
    coverage_result = analyze_keyword_coverage(category, review_excerpts)
    keyword_gap_score = coverage_result["coverage_rate"] * 100
else:
    auto_excerpts = [b["description"] for b in naver_data.get("top_blogs", [])]
    if auto_excerpts:
        coverage_result = analyze_keyword_coverage(category, " ".join(auto_excerpts))
        keyword_gap_score = coverage_result["coverage_rate"] * 100
    else:
        keyword_gap_score = 30.0  # fallback: 업종 평균 추정값
```

#### review_quality (25%)

```python
# 기존 score_engine.py의 review_quality 계산 유지
# rc(리뷰수) + ar(평점) + kd(키워드 다양성) + receipt_bonus
review_quality = min(100, rc/200*40 + ar/5*40 + kd*20 + receipt_bonus)
```

#### smart_place_completeness (25%)

```python
# ★ 데이터 수집 방법 (v3.0 확정):
#
# [자동 수집 — naver_visibility.py 이미 구현됨]
# is_smart_place : get_naver_visibility() 지역 검색 API로 자동 판단 ✅
#
# [사용자 입력 — 스캔 시 체크박스 3개 (trial Step 2 / 대시보드 등록 폼)]
# has_faq         : 스마트플레이스 Q&A 탭 등록 여부
# has_recent_post : 소식 7일 내 업데이트 여부
# has_intro       : 소개글 작성 여부
#
# 미입력 기본값: False (보수적 처리 → 입력 유도 효과)
# 이유: 네이버 Open API는 FAQ/소식/소개글 유무 반환 불가 (공식 API 한계)

smart_place_completeness = (
    (40 if is_smart_place else 0) +     # 자동 수집 (naver_visibility.py)
    (30 if has_faq else 0) +            # 사용자 체크박스 — AI 브리핑 가장 직접적 경로
    (20 if has_recent_post else 0) +    # 사용자 체크박스 — 최신성 점수 유지
    (10 if has_intro else 0)            # 사용자 체크박스 — 영구 키워드 기반
)
```

#### naver_exposure_confirmed (15%)

```python
# 기존 naver_result 스캐너 결과 활용
naver_result = scan_result.get("naver") or {}
naver_exposure = (
    (60 if naver_result.get("mentioned") else 0) +
    (40 if naver_result.get("in_briefing") else 0)
)
```

### 5.3 Track 1 최종 계산

```python
def calc_track1_score(scan_result, biz, naver_data, keyword_coverage_rate: float | None) -> float:
    """
    keyword_coverage_rate: analyze_keyword_coverage() 결과값 (0.0~1.0).
    None 전달 시 cold start 처리 (블로그 자동 추출 → fallback 0.30 순서).
    """
    kw_gap  = _resolve_keyword_gap_score(keyword_coverage_rate, naver_data, biz)
    rv_qual = calc_review_quality(biz)
    sp_comp = calc_smart_place_completeness(naver_data, biz)
    nv_exp  = calc_naver_exposure(scan_result)

    return (
        kw_gap  * NAVER_TRACK_WEIGHTS["keyword_gap_score"] +
        rv_qual * NAVER_TRACK_WEIGHTS["review_quality"] +
        sp_comp * NAVER_TRACK_WEIGHTS["smart_place_completeness"] +
        nv_exp  * NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"]
    )
```

---

## 6. Track 2 — 글로벌 AI 점수 설계

### 6.1 구성 항목 및 가중치

```python
GLOBAL_TRACK_WEIGHTS = {
    "multi_ai_exposure":  0.40,  # Gemini×100 + ChatGPT + Perplexity + Grok + Claude
    "schema_seo":         0.30,  # JSON-LD + 웹사이트 SEO + Open Graph
    "online_mentions":    0.20,  # 블로그·뉴스·미디어 언급 (네이버 블로그 API)
    "google_presence":    0.10,  # Google AI Overview 노출
}
```

### 6.2 각 항목 계산 상세

#### multi_ai_exposure (40%)

```python
# 점수 배분 근거: §1.3 글로벌 AI 플랫폼 시장 점유율 기반
#
# Gemini:     50점 (100회 샘플링, 저비용 통계, 점유율 13.4% — 측정 정밀도 보정)
# ChatGPT:    20점 (점유율 59.5% 1위, 단 API 비용으로 언급 확인만)
# Perplexity: 15점 (점유율 6.2%, 출처 기반 검색 — 소상공인 언급 가치 높음)
# Grok:       10점 (점유율 ~4%, 최신 정보 검색)
# Claude:      5점 (점유율 3.2%, 보완적 확인)
# 합계 최대:  100점

gemini = scan_result.get("gemini") or {}
gemini_score     = min(50, (gemini.get("exposure_freq", 0) / 100) * 50)
chatgpt_score    = 20 if (scan_result.get("chatgpt") or {}).get("mentioned") else 0
perplexity_score = 15 if (scan_result.get("perplexity") or {}).get("mentioned") else 0
grok_score       = 10 if (scan_result.get("grok") or {}).get("mentioned") else 0
claude_score     =  5 if (scan_result.get("claude") or {}).get("mentioned") else 0

multi_ai_exposure = min(100, gemini_score + chatgpt_score + perplexity_score + grok_score + claude_score)
```

#### schema_seo (30%)

```python
# 기존 website_checker.py 결과 활용
website_check = scan_result.get("website_check_result") or {}
schema_seo = (
    (40 if website_check.get("has_json_ld") else 0) +
    (20 if website_check.get("has_schema_local_business") else 0) +
    (20 if website_check.get("has_open_graph") else 0) +
    (10 if website_check.get("has_viewport") else 0) +
    (10 if biz.get("google_place_id") else 0)
)
```

> ★ **웹사이트 없는 소상공인 처리 (한국 소상공인 약 50% 이상)**
>
> 웹사이트가 없으면 schema_seo ≈ 0 → Track 2 구조적 저점 발생.
> 단순히 낮은 점수로 표시하지 말고, ActionPlan에 **대체 경로를 필수로 포함**해야 한다.
>
> 웹사이트 없는 소상공인 Track 2 대체 액션 (우선순위 순):
> 1. **구글 비즈니스 프로필 등록** → `google_place_id` 설정으로 +10점 즉시 획득
> 2. **네이버 스마트플레이스 소개글** → `online_mentions` 블로그 노출로 간접 기여
> 3. **카카오맵 사업장 정보 완성** → kakao_place_id 등록 (businesses 테이블)
>
> `routers/scan.py`의 ActionPlan 생성 시: `website_url`이 없고 `google_place_id`도 없으면
> "구글 비즈니스 프로필을 등록하면 Track 2 점수를 즉시 높일 수 있습니다" 안내 포함.

#### online_mentions (20%)

```python
# naver_visibility.py의 blog_mention_score() 활용 (이미 구현됨 ✅)
from services.naver_visibility import blog_mention_score
blog_count = naver_data.get("blog_mentions", 0)
online_mentions = blog_mention_score(blog_count)

# blog_mention_score 스케일 (naver_visibility.py:148):
# 0건 → 5.0 / ≤5건 → 20.0 / ≤20건 → 40.0
# ≤50건 → 60.0 / ≤100건 → 80.0 / 100건+ → 100.0
```

#### google_presence (10%)

```python
google = scan_result.get("google") or {}
google_presence = 100 if (google.get("mentioned") or google.get("in_ai_overview")) else 0
```

### 6.3 Track 2 최종 계산

```python
def calc_track2_score(scan_result, biz, naver_data) -> float:
    ai_exp   = calc_multi_ai_exposure(scan_result)
    schema   = calc_schema_seo(scan_result, biz)
    mentions = calc_online_mentions(naver_data)
    google   = calc_google_presence(scan_result)

    return (
        ai_exp   * GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] +
        schema   * GLOBAL_TRACK_WEIGHTS["schema_seo"] +
        mentions * GLOBAL_TRACK_WEIGHTS["online_mentions"] +
        google   * GLOBAL_TRACK_WEIGHTS["google_presence"]
    )
```

---

## 7. 업종별 키워드 체계 및 액션

### 7.1 9개 업종 × 핵심 액션 (기존 keyword_taxonomy.py 기반)

| 업종 코드 | Track 1 최우선 액션 | Track 2 최우선 액션 | 결정적 갭 키워드 |
|-----------|---------------------|---------------------|----------------|
| `restaurant` | 주차·단체·반려견 FAQ 등록 | 구글맵 완성 + LocalBusiness JSON-LD | "주차 가능", "단체 예약" |
| `cafe` | 공간용도·분위기 FAQ 등록 | 스페셜티·비건 콘텐츠 블로그 | "노트북 가능", "반려견 동반" |
| `beauty` | 당일예약·전문시술 FAQ 등록 | 전후사진 + 웹사이트 Schema | "탈모 케어", "웨딩 전문" |
| `clinic` | 야간진료·전문의 직접진료 FAQ | ChatGPT 전문성 콘텐츠 발행 | "야간 진료", "전문의 직접" |
| `fitness` | 24시간·PT전문 FAQ 등록 | 체형교정 결과사례 콘텐츠 (10-20대 타겟) | "24시간", "체형 교정" |
| `pet` | CCTV확인·응급진료 FAQ 등록 | 수의사 전문성 콘텐츠 | "응급 진료", "CCTV 확인" |
| `academy` | 합격사례·원어민강사 FAQ | Perplexity 추천 블로그 콘텐츠 (10대 AI 검색) | "합격률", "1:1 맞춤" |
| `legal` | 전문분야·무료상담 FAQ | 블로그 칼럼 + 승소사례 발행 | "무료 상담", "전문 분야" |
| `shopping` | 상품 FAQ (배송·AS 중심) | ChatGPT 쇼핑 추천 JSON-LD | "당일 배송", "무료 반품" |

### 7.2 성장 단계별 집중 포인트

> ★ **v3.0 기준 확정**: 성장 단계는 **`track1_score`** 기준.
>
> 이유: 업종별 dual track 비율이 다르기 때문에 unified_score 기준 시 같은 30점이라도
> 음식점(naver 70%)과 쇼핑몰(global 90%)이 전혀 다른 상태. Track 1이 소상공인이
> 가장 먼저 개선해야 할 네이버 브리핑 준비도이므로 행동 방향성이 명확함.

> ★ **UI 언어 원칙**: "생존기/지배기" 같은 경영학 용어는 소상공인에게 낯설거나 부정적으로 느껴질 수 있다.
> 코드 내부 식별자는 유지하되, **소상공인에게 보여주는 레이블은 아래 후보 중 선택**한다.
> 최종 언어는 실사용자 반응 후 확정.
>
> | 코드 내부값 | UI 후보 A | UI 후보 B |
> |------------|-----------|-----------|
> | `survival` | 시작 단계 | AI 검색 미노출 상태 |
> | `stable`   | 성장 중   | AI 검색 준비 중 |
> | `growth`   | 두각 단계 | AI 검색 노출 중 |
> | `dominant` | 선도 단계 | AI 검색 상위권 |

```
생존기 (track1: 0~30점):
  집중: Track 1 기초 — 스마트플레이스 등록, FAQ 최소 3개, 소개글 작성
  하지 말 것: 비용 드는 광고, Track 2 먼저 시작

안정기 (track1: 30~55점):
  집중: Track 1 심화 + Track 2 시작 — 키워드 갭 해소, 웹사이트 JSON-LD
  하지 말 것: 리뷰 수 고집 (키워드 다양성이 더 중요)

성장기 (track1: 55~75점):
  집중: 양 트랙 균형 — 경쟁사 갭 분석, 선점 키워드 발굴
  하지 말 것: 이미 잘 되는 것만 반복

지배기 (track1: 75점+):
  집중: Track 2 강화 — ChatGPT 인용 최대화, 2026 AI 탭·조건 검색 선점
  하지 말 것: 현재 상태에 안주 (AI 브리핑 2배 확대 준비 필요)
```

### 7.3 업종 한국어 레이블 및 포함 업종 (trial UI 버튼 기준)

> trial Step 2의 업종 선택 버튼과 대시보드 업종 등록 폼에서 사용.
> 소상공인이 "내 업종이 어디 속하지?" 혼란 없이 선택할 수 있도록 포함 업종 예시를 함께 표시한다.

| 코드 | 버튼 레이블 | 포함 업종 예시 |
|------|------------|----------------|
| `restaurant` | 음식점 | 한식당, 치킨집, 분식집, 고깃집, 일식, 중식, 피자 |
| `cafe` | 카페 | 커피숍, 디저트카페, 베이커리, 브런치카페 |
| `beauty` | 뷰티 | 헤어샵, 피부관리실, 네일샵, 눈썹샵, 속눈썹 |
| `fitness` | 피트니스 | 헬스장, 필라테스, 요가, PT샵, 수영장 |
| `clinic` | 의원·병원 | 내과, 치과, 한의원, 피부과, 정형외과, 산부인과 |
| `academy` | 학원 | 영어학원, 수학학원, 미술학원, 태권도, 피아노 |
| `pet` | 반려동물 | 동물병원, 애견미용, 펫샵, 애견호텔 |
| `legal` | 전문직 | 법무사, 변호사, 세무사, 노무사, 공인중개사 |
| `shopping` | 온라인쇼핑 | 스마트스토어, 자사몰, 쇼핑몰 |

---

## 8. 데이터 흐름 전체 프로세스

### 8.1 스캔 실행 시 데이터 흐름

```
[사용자 입력]
  가게이름 + 업종 + 지역
  + 스마트플레이스 체크박스 3개 (has_faq / has_recent_post / has_intro)
  + 리뷰텍스트 선택 입력
  + website_url 선택 입력
        │
        ▼
[병렬 데이터 수집 — multi_scanner.py]
  ├─ Gemini Flash ×100회 샘플링    → gemini_result (exposure_freq, mentioned, excerpt)
  ├─ ChatGPT 인용 확인             → chatgpt_result (mentioned, excerpt)
  ├─ Perplexity 출처 검색          → perplexity_result (mentioned, sources)
  ├─ Grok 최신 검색                → grok_result (mentioned)
  ├─ Claude Haiku 노출 확인        → claude_result (mentioned)
  ├─ Google AI Overview            → google_result (mentioned, in_ai_overview)
  ├─ 네이버 AI 브리핑 (location only) → naver_result (mentioned, in_briefing)
  └─ 웹사이트 체크 (website_url 있을 때) → website_check_result
        │
        ▼
[네이버 공식 API 수집 — naver_visibility.py ✅ 구현됨]
  get_naver_visibility(business_name, keyword, region)
  ├─ 지역 검색 API → is_smart_place 자동, naver_competitors 상위 5개
  ├─ 블로그 검색 API → blog_mentions 수, top_blogs 최신 3건
  └─ 1위 경쟁사 블로그 건수 (top_competitor_blog_count)
        │
        ▼
[키워드 갭 분석 — keyword_taxonomy.py]
  review_excerpts 우선순위:
    1) 사용자 직접 입력
    2) top_blogs 텍스트 자동 활용 (naver_visibility 결과)
    3) fallback: coverage_rate = 0.30
  analyze_keyword_coverage(category, review_excerpts, competitor_excerpts)
  → coverage_rate, covered[], missing[], competitor_only[], pioneer[]
        │
        ▼
[점수 계산 — score_engine.py v3.0]
  track1 = calc_track1_score(...)
  track2 = calc_track2_score(...)
  ratio  = get_dual_track_ratio(category)
  unified_score = track1 * ratio["naver"] + track2 * ratio["global"]
  growth_stage  = determine_growth_stage(track1)  ← track1_score 기준
        │
        ▼
[도메인 모델 생성]
  DiagnosisReport → MarketLandscape → GapAnalysis(keyword_gap) → ActionPlan
        │
        ▼
[AI 브리핑 액션 생성 — briefing_engine.py ✅ 구현됨]
  build_direct_briefing_paths(missing_keywords, competitor_only_keywords)
  → 4개 경로 (FAQ / 리뷰답변 / 소식 / 소개글) 즉시 복사 문구
        │
        ▼
[DB 저장 — Supabase]
  scan_results: unified_score, track1_score, track2_score, keyword_coverage, ...
  score_history: unified_score, track1_score, track2_score (30일 추세용)
  guides: action_plan JSON
```

### 8.2 trial 스캔 (비로그인) 데이터 흐름

```
[trial 입력]
  Step 1: 가게 이름 입력 → 네이버 지역 API 자동완성
  Step 2: 업종 선택 (9개 버튼 — §7.3 한국어 레이블 참조)
          + 스마트플레이스 체크박스 3개 (선택, 점수에 즉시 반영):
            [ ] Q&A(FAQ) 탭 등록했어요       → 체크 시 네이버 브리핑 점수 +30점
            [ ] 최근 7일 내 소식 업데이트했어요 → 체크 시 +20점
            [ ] 소개글 작성했어요             → 체크 시 +10점
            ※ 점수 프리뷰를 체크박스 옆에 표시해 입력을 유도 (미입력 기본값 False)
  Step 3: 리뷰 1~3개 붙여넣기 (선택, skip 가능)
        │
        ▼
[제한된 스캔 — trial 전용]
  ├─ Gemini Flash ×10회  ← ★ 100회에서 분리, 비용 1/10
  ├─ 네이버 블로그 API (합법, naver_visibility.py)
  ├─ 웹사이트 체크 (website_url 있을 경우)
  └─ keyword_taxonomy 갭 분석 (cold start 처리 포함)
        │
        ▼
[trial 결과]
  1. 업종별 Dual Track 점수 (track1/track2 + 업종별 비율)
  2. "없는 키워드 최대 3개" — missing_keywords (핵심 충격 포인트)
  3. "선점 기회 키워드 최대 2개" — pioneer_keywords (경쟁사도 없는 키워드)
  4. 경쟁사 1개 기본 비교 (naver_visibility.top_competitor_name)
  5. FAQ 문구 1개 즉시 복사 (briefing_engine)
  6. growth_stage 표시 (track1 기준)
  7. Gemini 노출 빈도 수치는 UI에서 숨김 — "더 정확한 100회 통계는 구독 후 확인" CTA로 대체
     (10회 샘플링은 통계 노이즈가 커서 수치 노출 시 신뢰도 저하 위험)
  8. CTA: "이걸 매주 자동으로 추적하고 개선방법 알려드립니다 → 월 9,900원"

```

> **trial Gemini 10회 구현**: `routers/scan.py`의 `_run_trial_scan()`에서
> `multi_scanner.py`에 `gemini_sample_count=10` 파라미터 전달,
> 또는 `_run_trial_gemini()` 별도 함수 분리. 100회 풀스캔 코드 경로와 완전 분리.

---

## 9. 현재 코드와의 매핑

### 9.1 유지되는 파일 (변경 없음)

| 파일 | 역할 | 상태 |
|------|------|------|
| `backend/services/keyword_taxonomy.py` | 9개 업종 키워드 분류체계 | ✅ 완성 |
| `backend/services/briefing_engine.py` | AI 브리핑 4경로 엔진 | ✅ 완성 |
| `backend/services/ai_scanner/` | 8개 AI 스캐너 (zeta 제외) | ✅ 완성 |
| `backend/services/website_checker.py` | 웹사이트 SEO 체크 | ✅ 완성 |
| `backend/services/naver_visibility.py` | 네이버 공식 API + `blog_mention_score()` | ✅ 완성 (이미 구현됨) |
| `backend/models/gap.py` | GapAnalysis 모델 | ✅ 완성 |
| `backend/models/action.py` | ActionPlan 모델 | ✅ 완성 |
| `frontend/app/(dashboard)/guide/GuideClient.tsx` | 가이드 UI (v2.7) | ✅ 완성 |

### 9.2 수정이 필요한 파일

| 파일 | 변경 내용 | 우선순위 |
|------|-----------|----------|
| `backend/services/score_engine.py` | DUAL_TRACK_RATIO, keyword_gap 연결, cold start, GrowthStage track1 기준 | **1순위** |
| `backend/services/gap_analyzer.py` | keyword_coverage_rate 전달, fallback 보강 | **1순위** |
| `backend/routers/scan.py` | trial Gemini 10회 분리, 체크박스 파라미터 수신, dual track 결과 포함 | **1순위** |
| `backend/models/schemas.py` | `has_faq`, `has_recent_post`, `has_intro` + track 점수 필드 추가 | **1순위** |
| `frontend/app/(dashboard)/dashboard/page.tsx` | DualTrackCard UI 교체 | **2순위** |
| `frontend/app/(public)/trial/page.tsx` | 체크박스 3개 추가, 체험 플로우 재설계 | **2순위** |
| `frontend/types/index.ts` | track 점수 필드 타입 추가 | **2순위** |
| `scripts/supabase_schema.sql` | track 점수 컬럼 추가 | **2순위** |

### 9.3 새로 추가할 파일

| 파일 | 내용 |
|------|------|
| `frontend/components/dashboard/DualTrackCard.tsx` | 업종별 Track 1/2 분리 점수 카드 (업종별 메시지 포함) |
| `frontend/components/dashboard/UnifiedScoreHero.tsx` | 통합 점수 히어로 + 성장 단계 배지 |

### 9.4 제거할 파일 / 코드

| 대상 | 이유 |
|------|------|
| `backend/services/ai_scanner/zeta_scanner.py` | Playwright 의존, 뤼튼 UI 변경 잦음, ROI 없음 |
| `score_engine.py`의 `WEIGHTS` dict (6항목) | dual track으로 완전 교체 |
| `frontend/` 시나리오 수치 (+N% 예측값) | 근거 없는 % 예측 — v2.5 금지 원칙 위반 |
| `multi_scanner.py`의 zeta 호출 | zeta_scanner 제거에 따라 |

---

## 10. 구현 로드맵 — 파일별 변경 명세

### Phase A — 백엔드 점수 엔진 재설계 (1~2일)

#### A-1. `backend/services/score_engine.py`

```python
# 추가할 상수
DUAL_TRACK_RATIO = { ... }           # § 4.1 참조
DEFAULT_DUAL_TRACK_RATIO = {"naver": 0.60, "global": 0.40}
NAVER_TRACK_WEIGHTS = { ... }        # § 5.1 참조
GLOBAL_TRACK_WEIGHTS = { ... }       # § 6.1 참조

# 추가할 함수
def get_dual_track_ratio(category: str) -> dict[str, float]: ...
def _resolve_keyword_gap_score(coverage_rate, naver_data, biz) -> tuple[float, bool]:
    """
    반환: (keyword_gap_score, is_estimated)
    is_estimated=True : fallback 30.0 사용 → UI에서 회색/추정값 표시
    is_estimated=False: 실제 리뷰 또는 블로그 텍스트 기반 계산
    """
    ...
def calc_track1_score(scan_result, biz, naver_data, keyword_coverage_rate) -> float: ...
def calc_track2_score(scan_result, biz, naver_data) -> float: ...
def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float: ...
def determine_growth_stage(track1_score: float) -> str: ...  # track1 기준

# 수정할 함수
def calculate_score(...) -> dict:
    # keyword_coverage_rate 파라미터 추가
    # track1, track2 각각 계산 후 비율 적용
    # 반환: track1_score, track2_score, unified_score, growth_stage
    #       is_keyword_estimated (bool) — fallback 사용 여부 UI 표시용
    # 기존 total_score = unified_score alias (하위호환)
```

> ★ **is_keyword_estimated 처리 원칙**
>
> keyword_gap cold start fallback(30.0) 사용 시 소상공인이 "업종 평균이구나"로 오해해
> 긴장감이 사라지는 문제가 있다. `is_keyword_estimated=True`일 때:
> - UI: 점수 옆에 `(리뷰 데이터 없음 — 추정값)` 회색 배지 표시
> - 체크박스 아래에 "리뷰 3개를 붙여넣으면 정확한 키워드 갭을 확인할 수 있습니다" 안내
> - GrowthStage 배지도 `(추정)` 표시로 확정값과 구분

#### A-2. `backend/services/gap_analyzer.py`

```python
# analyze_gap_from_db() 수정
# 1. scan_result에서 keyword_coverage_rate 추출 → analyze_gap()에 전달
# 2. naver_data.top_blogs로 review_excerpts 자동 보충 (cold start)
# 3. keyword_gap None 반환 완전 방지 (fallback GapAnalysis)
```

#### A-3. `backend/routers/scan.py`

```python
# _run_trial_scan() 수정
# - Gemini: 100회 → 10회 분리 (_run_trial_gemini() 또는 gemini_sample_count=10)
# - naver_visibility.get_naver_visibility() 병렬 호출
# - 요청 파라미터: has_faq, has_recent_post, has_intro (체크박스 3개)

# _save_scan_results() 수정
# - track1_score, track2_score, unified_score, keyword_coverage DB 저장

# trial 응답에 추가
# track1_score, track2_score, naver_weight, global_weight
# top_missing_keywords (상위 3개)
# growth_stage (track1 기준)
```

#### A-4. `backend/models/schemas.py`

```python
# TrialScanRequest에 추가
has_faq: bool = False
has_recent_post: bool = False
has_intro: bool = False

# ScanResult 모델에 추가
track1_score: float | None = None
track2_score: float | None = None
unified_score: float | None = None
keyword_coverage_rate: float | None = None
```

### Phase B — DB 마이그레이션 (Phase A 완료 후)

```sql
-- scripts/supabase_schema.sql에 추가 (Supabase SQL Editor에서 실행)
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS track1_score      FLOAT,
  ADD COLUMN IF NOT EXISTS track2_score      FLOAT,
  ADD COLUMN IF NOT EXISTS unified_score     FLOAT,
  ADD COLUMN IF NOT EXISTS keyword_coverage  FLOAT;

ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS track1_score  FLOAT,
  ADD COLUMN IF NOT EXISTS track2_score  FLOAT,
  ADD COLUMN IF NOT EXISTS unified_score FLOAT;
```

### Phase C — 프론트엔드 UI 교체 (2~3일)

#### C-1. `DualTrackCard.tsx` 신규

```tsx
// props: track1Score, track2Score, naverWeight, globalWeight, category, growthStage
// 표시:
//   - Track 1 막대: "네이버 AI 브리핑 준비도 N점 (손님의 XX%)"
//   - Track 2 막대: "글로벌 AI 가시성 N점 (손님의 XX%)"
//   - 취약 트랙 강조 (낮은 쪽 빨간 테두리)
//   - 업종별 맞춤 메시지 (§7.1 기반)
//   - 성장 단계 배지 (track1 기준 생존기/안정기/성장기/지배기)
```

#### C-2. `dashboard/page.tsx` 수정

```tsx
// 변경 전: <ScoreCard score={totalScore} />
// 변경 후: <DualTrackCard track1Score track2Score naverWeight globalWeight category growthStage />
// 기존 GapAnalysisCard, BriefingPathsSection 유지
```

#### C-3. `trial/page.tsx` 재설계

```
Step 1: 가게 이름 → 네이버 지역 API 자동완성
Step 2: 업종 선택 (9개 버튼)
        스마트플레이스 체크박스 3개 (선택, 점수에 반영됨 표시)
Step 3: 리뷰 붙여넣기 (선택, skip 가능 — 없어도 cold start 처리)
Step 4: 결과 화면 (§ 12.2 레이아웃)
```

---

## 11. 제거할 것

| 항목 | 위치 | 이유 |
|------|------|------|
| Zeta(뤼튼) 스캐너 | `ai_scanner/zeta_scanner.py` | Playwright 의존, UI 변경 빈번, ROI 없음 |
| `WEIGHTS` 6항목 dict | `score_engine.py` | dual track으로 완전 교체 |
| 시나리오 수치 (+65% 등) | `frontend/` | 근거 없는 % 예측 — v2.5 금지 원칙 위반 |
| multi_scanner의 zeta 호출 | `multi_scanner.py` | zeta_scanner 제거에 따라 |

---

## 12. 체험 플로우 재설계

### 12.1 현재 trial vs v3.0 비교

| 항목 | 현재 | v3.0 |
|------|------|------|
| 핵심 결과물 | "AI Visibility Score 67점" | "없는 키워드 3개 + Dual Track 점수" |
| 충격 포인트 | 없음 | "경쟁사엔 '반려견 동반 가능'이 있고 내겐 없음" |
| 즉시 실행 | 없음 | FAQ 문구 복사 버튼 (5분) |
| 리뷰 없어도 동작 | — | cold start 처리로 의미 있는 결과 |
| 유료 전환 CTA | 있음 (약함) | "이걸 매주 자동으로 해드립니다" |

### 12.2 trial 결과 화면 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  [가게명] AI 브리핑 준비 현황                              │
│  업종: 음식점  |  지역: 강남구                              │
├──────────────────────────┬──────────────────────────────┤
│ 📍 네이버 AI 브리핑 (70%) │ 🌐 글로벌 AI 가시성 (30%)     │
│  ████████░░  78점          │  ████░░░░░░  42점              │
│  손님 10명 중 7명 경로     │  손님 10명 중 3명 경로         │
├──────────────────────────┴──────────────────────────────┤
│ ⚠️ 지금 당장 없는 키워드                                   │
│  ❌ "단체 예약 가능"   경쟁사 홍길동식당에는 있음           │
│  ❌ "반려견 동반 가능" 경쟁사 맛있는집에는 있음             │
│  ❌ "주차 무료"        아직 아무도 없음 (선점 기회!)        │
├─────────────────────────────────────────────────────────┤
│ 💡 지금 바로 할 수 있는 것 (5분)                           │
│  스마트플레이스 FAQ에 등록하세요:                           │
│  Q: 단체 예약 가능한가요?                                   │
│  A: 네, 단체 예약 가능합니다. [복사하기]                    │
├─────────────────────────────────────────────────────────┤
│  ✨ 이걸 매주 자동으로 추적하고 개선방법 알려드립니다        │
│        [월 9,900원으로 시작하기]                            │
└─────────────────────────────────────────────────────────┘
```

---

## 13. 플랜별 기능 분리

> v3.0 신기능이 모두 Basic에서 노출되면 Pro 업그레이드 동기가 없어진다.
> `plan_gate.py`의 `@require_plan` 데코레이터와 프론트엔드 `PlanGate` 컴포넌트에 반영 기준.

| 기능 | trial | Basic (9,900원) | Pro (29,900원) | Biz (79,900원) |
|------|-------|-----------------|----------------|----------------|
| DualTrackCard (track1/2 점수) | ✅ | ✅ | ✅ | ✅ |
| 없는 키워드 3개 (missing_keywords) | ✅ | ✅ | ✅ | ✅ |
| FAQ 복사 버튼 1개 | ✅ | ✅ | ✅ | ✅ |
| 선점 키워드 (pioneer_keywords) | ✅ 최대 1개 | ✅ | ✅ | ✅ |
| 전체 keyword_gap (보유/부족/경쟁사 전용/선점 전체) | ❌ | ❌ | ✅ | ✅ |
| 브리핑 경로 4개 전체 (briefing_engine) | ❌ 1개만 | ❌ 1개만 | ✅ | ✅ |
| 경쟁사 대비 키워드 비교 | ❌ | ✅ | ✅ | ✅ |
| 30일 추세 (track1/track2 각각) | ❌ | ✅ | ✅ | ✅ |
| Gemini 100회 정밀 스캔 | ❌ (10회) | ✅ | ✅ | ✅ |
| CSV 내보내기 | ❌ | ❌ | ✅ | ✅ |
| PDF 리포트 | ❌ | ❌ | ✅ | ✅ |
| 팀 계정 (5명) | ❌ | ❌ | ❌ | ✅ |

> **설계 의도**: trial과 Basic의 차이는 **자동 추적(주 1회) + Gemini 정밀도 + 경쟁사 비교**.
> Basic과 Pro의 차이는 **전체 keyword_gap 상세 + 브리핑 경로 전부 + 내보내기**.
> Pro 전환 CTA: "없는 키워드 이유와 경쟁사 전용 키워드 전체를 보려면 Pro로 업그레이드하세요."

---

## 15. 검증 체크리스트

### Phase A~C 완료 전 확인 사항

#### 백엔드
- [ ] `calc_track1_score()` 단위 테스트: 음식점(70/30), 법률(20/80) 업종 각 1건
- [ ] `calc_track2_score()` 단위 테스트: 글로벌 AI 미노출 vs 다수 노출 비교
- [ ] `get_dual_track_ratio("restaurant")` = `{"naver": 0.70, "global": 0.30}` 확인
- [ ] `get_dual_track_ratio("academy")` = `{"naver": 0.40, "global": 0.60}` 확인
- [ ] `get_dual_track_ratio("unknown")` = `{"naver": 0.60, "global": 0.40}` (중립 fallback)
- [ ] keyword_gap cold start: review 없음 → blog 자동 추출 → fallback 30.0 순서
- [ ] keyword_gap_score가 unified_score에 반영되는지 확인
- [ ] trial Gemini 10회 실행 확인 (100회와 분리)
- [ ] trial 응답: `track1_score`, `track2_score`, `top_missing_keywords`, `pioneer_keywords`, `growth_stage`, `is_keyword_estimated` 포함
- [ ] `determine_growth_stage()` — track1_score 기준 동작 확인
- [ ] `is_smart_place` 자동 수집 (naver_visibility.py) 정상 동작
- [ ] `_resolve_keyword_gap_score()` — fallback 사용 시 `is_keyword_estimated=True` 반환 확인
- [ ] 웹사이트 없음 + google_place_id 없음 → ActionPlan에 "구글 비즈니스 프로필" 안내 포함 확인

#### 프론트엔드
- [ ] `DualTrackCard` — 음식점(70/30) / 학원(40/60) 렌더링 차이 시각 확인
- [ ] trial Step 2 — 체크박스 3개 표시 및 API 전달 확인
- [ ] trial Step 3 — skip 시 cold start 처리 (fallback 30.0) 정상 작동
- [ ] trial 결과 — "없는 키워드 3개" + "선점 기회 키워드" + FAQ 복사 버튼 동작
- [ ] trial 결과 — Gemini 노출 빈도 수치 미표시 확인 (대신 "100회 정밀 스캔은 구독 후" CTA)
- [ ] trial 결과 — `is_keyword_estimated=True` 시 "(추정값)" 회색 배지 표시 확인
- [ ] GrowthStageCard — track1_score 기준 단계 확인, 소상공인 친화 언어 레이블 적용
- [ ] 체크박스 점수 프리뷰 — FAQ "+30점", 소식 "+20점", 소개글 "+10점" 표시 확인
- [ ] 플랜게이트 — Basic에서 전체 keyword_gap 블록 확인 (§13 플랜 분리 기준)
- [ ] 기존 `GuideClient.tsx` (브리핑 경로 4개) 유지

#### DB
- [ ] track1_score, track2_score, unified_score, keyword_coverage 컬럼 추가
- [ ] score_history 추가 컬럼 확인

#### 서버
- [ ] `pm2 restart aeolab-backend`
- [ ] `https://aeolab.co.kr/api/health` 200 확인
- [ ] trial 스캔 엔드투엔드 (`/api/scan/trial`)

---

## 17. 소상공인 관점에서 본 서비스 이해 (FAQ)

> 작성 배경: 영세 음식점 소상공인이 "이 서비스가 나에게 무엇을 해주는가?"를 물었을 때
> 기획 의도와 기술 구조를 **소상공인 언어**로 정리한 참조 문서.
> 세일즈 시연, 온보딩 문구, 랜딩 페이지 카피 작성 시 기준으로 활용.

---

### Q1. 네이버에서 내 가게가 지금 잘 노출되고 있는가?

AEOlab은 네이버에서 내 가게를 검색했을 때 **네이버 AI 브리핑** 칸에 내 가게가 어떻게 소개되는지를 분석한다.

AI 브리핑이란 네이버가 2025년부터 음식점 검색 결과 상단에 자동으로 만들어 주는 요약 박스다.
예: *"주차 가능, 단체석 있음, 웨이팅 보통, 분위기 캐주얼"* 형태.

이 브리핑이 잘 채워져 있는 가게는 네이버 공식 통계(2025.08) 기준:

| 지표 | 변화율 |
|------|--------|
| 클릭률(CTR) | +27.4% |
| 예약·주문 건수 | +8% |
| '더보기' 탭 클릭 | +137% |

**AI 브리핑이 잘 만들어지는 가게 = 손님이 더 많이 클릭하고 방문한다.**
AEOlab은 내 가게의 AI 브리핑 현재 상태, 어떤 정보가 빠져 있는지, 그 이유가 무엇인지를 진단한다.

---

### Q2. 네이버 노출을 AI가 도와주는가?

**직접 올려주는 게 아니라, 뭘 해야 올라가는지 알려준다.**

네이버 AI 브리핑은 **내 가게의 리뷰 내용**에서 자동으로 키워드를 뽑아 요약을 만든다.
리뷰에 "주차 편해요", "단체로 왔는데 자리 넉넉해요" 같은 문장이 있어야 브리핑에 주차·단체 정보가 뜬다.
리뷰에 그 내용이 없으면 → 브리핑이 비거나 엉성하게 만들어진다 → 클릭률이 떨어진다.

AEOlab이 하는 일:

1. 내 리뷰에서 지금 어떤 키워드가 있고 없는지 분석
2. 없는 키워드(예: "주차", "반려견", "혼밥 가능")가 무엇인지 목록으로 제시
3. 손님에게 그 키워드가 포함된 리뷰를 자연스럽게 유도하는 문구(QR 카드 등) 자동 생성
4. 오늘 당장 할 수 있는 것(FAQ 등록, 소개글 수정, 소식 업데이트) 단계별 안내

→ **AI가 내 가게를 더 잘 설명하게 만드는 재료를 채워주는 서비스다.**

---

### Q3. 주변 경쟁 가게는 어떻게 잘 나타나는가?

카카오맵 API + 네이버 블로그 검색 API를 활용해 내 가게 주변 같은 업종 가게들을 자동으로 찾아준다.

경쟁 가게를 등록하면:
- 경쟁사의 AI 브리핑에는 어떤 키워드가 들어가 있는지
- 경쟁사 리뷰에는 어떤 내용이 많은지
- 경쟁사가 선점하고 있는 키워드가 무엇인지

를 비교해 보여준다.

---

### Q4. 내 가게 vs 경쟁사 — 뭐가 부족한가?

서비스 내 **GapAnalysis(격차 분석)** 기능이 이것을 담당한다. 예시:

| 항목 | 내 가게 | 잘 되는 옆집 |
|------|---------|-------------|
| "주차" 키워드 리뷰 | 없음 | 18개 |
| "단체" 키워드 리뷰 | 없음 | 12개 |
| 최근 30일 리뷰 수 | 2개 | 15개 |
| FAQ 등록 여부 | 없음 | 있음 |

→ "옆집이 AI 브리핑에 주차·단체 정보가 뜨는 이유가 여기 있습니다"라고 보여준다.

---

### Q5. 뭘 하면 노출이 좋아지는가?

비용 0원, 광고 없이 할 수 있는 것부터 순서대로 안내한다:

| 오늘 할 수 있는 것 | 소요 시간 | 효과 경로 |
|--------------------|----------|----------|
| 스마트플레이스 FAQ 등록 | 5분 | AI 브리핑 가장 직접적 인용 경로 |
| 기존 리뷰에 키워드 포함 답변 달기 | 3분 | AI 브리핑 원료 보강 |
| 소개글에 핵심 키워드 추가 | 10분 | 영구 키워드 기반 구축 |
| QR 카드로 손님 리뷰 유도 | 인쇄 후 테이블 비치 | 리뷰 키워드 다양성 증가 |

**이것이 이 서비스의 핵심 가치 — 광고비 없이 AI가 내 가게를 더 잘 추천하게 만드는 것.**

---

### Q6. 이 서비스는 ChatGPT에도 노출? 네이버에도 노출? 둘 다?

**둘 다 커버한다. 단, 음식점 기준으로는 네이버가 압도적으로 중요하다.**

이 서비스는 **듀얼트랙(두 가지 트랙)** 구조로 설계되어 있다:

| 트랙 | 대상 | 음식점 비중 | 이유 |
|------|------|------------|------|
| **Track 1 (네이버)** | 네이버 AI 브리핑, 스마트플레이스 | **70%** | 손님의 82.8%가 여전히 네이버에서 맛집 검색 |
| **Track 2 (글로벌 AI)** | ChatGPT, Gemini, Perplexity | **30%** | ChatGPT 한국 MAU 2,162만, AI 대화형 검색 빠르게 증가 |

Track 2가 필요한 이유: ChatGPT로 "강남 분위기 좋은 식당 추천해줘" 하고 대화형으로 검색하는 비중이
현재 45%까지 올라왔으며 (1년 전 6%), 30-50대 고객도 AI 검색 병행이 빠르게 늘고 있다.

**중요한 구분:**

> 이 서비스는 ChatGPT나 네이버에 직접 내 가게를 등록해 주거나 광고를 집행해 주는 서비스가 아니다.
> AI가 내 가게를 언급·추천할 가능성이 높아지도록 **내 가게 데이터와 콘텐츠를 개선하는 가이드를 주는 서비스**다.

광고비를 쓰지 않고, AI가 자연스럽게 내 가게를 더 자주 언급하도록 만드는 것이 목표다.

---

### 한 줄 요약 (세일즈·온보딩 핵심 문구)

> **"네이버 AI가 내 가게를 어떻게 소개하고 있는지 진단하고,**
> **옆집보다 더 잘 소개되게 만들기 위해 오늘 당장 무엇을 해야 하는지 알려주는 서비스.**
> **ChatGPT 등 글로벌 AI 노출도 함께 관리하지만, 음식점 기준으로는 네이버가 핵심이다."**

---

## 16. 미해결 과제 (Phase D+ — 구독자 확보 후)

이하 항목들은 Phase A~C 완료 후 구독자 수 기준으로 진행.

### D-1. 네이버 DataLab API 연동

- **목적**: 키워드 트렌드 실시간 반영 → `keyword_gap_score` 우선순위 동적 조정
- **API**: `https://openapi.naver.com/v1/datalab/search` (네이버 개발자 센터 신청)
- **활용**: `keyword_taxonomy.py`의 정적 키워드 + DataLab 트렌드 점수 결합
- **신규 파일**: `backend/services/naver_datalab.py`
- **상태**: 구독자 100명 이후 권장

### D-2. 2026 AI 탭 대응 (Q2 출시 예정)

- **현황**: 네이버 AI 탭은 2026년 Q2 출시 예정 (대화형 + 예약·결제 연동)
- **AEOlab 대응**: AI 탭 노출 스캐너 추가 (naver_scanner.py 확장 또는 별도 파일)
- **우선 준비**: FAQ 등록·소개글 품질이 AI 탭에서도 동일하게 랭킹 요소가 될 것으로 예상
- **상태**: 2026 Q2 이후 실제 노출 구조 확인 후 대응

### D-3. smart_place_completeness 완전 자동화

- **현재**: `is_smart_place` 자동 / `has_faq·has_recent_post·has_intro` 사용자 체크박스
- **목표**: Playwright로 FAQ·소식·소개글 유무 자동 감지
- **제약**: Playwright 메모리 300~500MB, iwinv 4GB RAM → 큐 방식 순차 처리 필수
- **상태**: 구독자 50명 이후 권장

### D-4. 경쟁사 keyword_gap 실시간 자동화

- **현재**: `scheduler/jobs.py`의 `_enrich_competitor_excerpts` 잡 이미 구현됨 (새벽 4시)
- **개선**: 경쟁사 신규 등록 시 즉시 분석 (현재 스케줄러 의존)
- **상태**: 기존 잡 안정화 후 트리거 방식으로 개선

---

## 부록: 서버 배포 방법

```bash
# 백엔드 변경 파일 업로드
scp -i ~/.ssh/id_ed25519 backend/services/score_engine.py root@115.68.231.57:/var/www/aeolab/backend/services/
scp -i ~/.ssh/id_ed25519 backend/services/gap_analyzer.py  root@115.68.231.57:/var/www/aeolab/backend/services/
scp -i ~/.ssh/id_ed25519 backend/routers/scan.py            root@115.68.231.57:/var/www/aeolab/backend/routers/
scp -i ~/.ssh/id_ed25519 backend/models/schemas.py          root@115.68.231.57:/var/www/aeolab/backend/models/
# 서버에서:
pm2 restart aeolab-backend

# 프론트엔드 변경 파일 업로드
scp -i ~/.ssh/id_ed25519 -r frontend/components/dashboard/ root@115.68.231.57:/var/www/aeolab/frontend/components/
scp -i ~/.ssh/id_ed25519 "frontend/app/(dashboard)/dashboard/page.tsx" \
    root@115.68.231.57:"/var/www/aeolab/frontend/app/(dashboard)/dashboard/"
scp -i ~/.ssh/id_ed25519 "frontend/app/(public)/trial/page.tsx" \
    root@115.68.231.57:"/var/www/aeolab/frontend/app/(public)/trial/"
# 서버에서:
cd /var/www/aeolab/frontend && npm run build && pm2 restart aeolab-frontend

# 서버 → 로컬 동기화
scp -i ~/.ssh/id_ed25519 root@115.68.231.57:/var/www/aeolab/backend/services/score_engine.py backend/services/
scp -i ~/.ssh/id_ed25519 root@115.68.231.57:/var/www/aeolab/backend/services/gap_analyzer.py  backend/services/
scp -i ~/.ssh/id_ed25519 root@115.68.231.57:/var/www/aeolab/backend/routers/scan.py            backend/routers/
scp -i ~/.ssh/id_ed25519 root@115.68.231.57:/var/www/aeolab/backend/models/schemas.py          backend/models/
```

---

*AEOlab 모델 엔진 v3.0 | 최초 2026-03-31 | 3차 재정비 2026-03-31*
*다음 버전 기준: Phase A~C 구현 완료 후 소상공인 30명 인터뷰 결과 반영*
*참조: docs/model_system.md (4-도메인 모델) | CLAUDE.md v3.0 설계 섹션*
