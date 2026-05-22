# 점수 체계 개선 보고서 v1.0

> 작성일: 2026-05-22 | 작업 브랜치: main | 배포: aeolab.co.kr

---

## 배경 및 목적

AEOlab의 점수 체계(AI Visibility Score)가 처음 사용하는 소상공인에게 공감을 얻는지 사용자 관점에서 재검토했다.  
초기 분석 → 재점검(오판·누락 교정) → 순차 구현의 3단계를 거쳤으며, 이 문서는 최종 확정된 문제와 수정 내용을 기록한다.

---

## 1. 문제 분류 (재점검 확정본)

초기 분석에서 일부 오판이 있었다. 재점검 후 확정된 문제 목록이다.

### 1-1. 오판으로 판명된 항목 (수정 불필요)

| 초기 지적 | 재점검 결과 |
|---------|-----------|
| "업종 평균이 첫 화면에 안 보인다" | Trial 상단 배너(`ScoreSummaryCard`)에 이미 구현됨 |
| "Trial 블러로 이유를 숨긴다" | `FindingsCard`, `TodayOneAction`, `ScanEvidenceCard`로 이유 충분히 공개됨. 블러는 항목별 수치 하나뿐 |
| "항목명이 기술 용어" | Trial 화면은 이미 소상공인 언어로 번역됨 (keyword_gap_score → "AI 질문에 내 가게가 나오는 핵심 키워드 보유") |
| "두 등급 체계(GrowthStage+Grade) 공존" | `ScoreCard`(A/B/C/D/F)는 어디에도 import 안 됨. 현재 사용자에게 노출되는 체계는 GrowthStage 하나뿐 |

### 1-2. 확정된 실제 문제 (7건)

| # | 심각도 | 문제 |
|---|--------|------|
| 1 | **P1 버그** | GrowthStage 기준 backend/frontend 불일치 |
| 2 | 매우 높음 | 업종 평균이 하드코딩 추정값인데 단정 표현 사용 |
| 3 | 중간 | AI 샘플링 분산이 ±5점으로 과소 표현됨 |
| 4 | 중간 | "심층 진단·점수 근거" 아코디언이 기본 닫힘 — 접근성 낮음 |
| 5 | 중간 | 점수→매출 인과관계 미명시 → 장기 신뢰도 위험 |
| 6 | 중간 | "점수 근거 보기" 진입점 없음 |
| 7 | 낮음 | `/score-guide` 등급 백분위가 추정값임을 명시 안 함 |

---

## 2. 개선 사항 상세

### 2-1. P1 버그 — GrowthStage 기준 불일치 수정

**파일:** `frontend/components/dashboard/DualTrackCard.tsx:320-323`

**문제:** 백엔드 `score_engine.py`의 `_GROWTH_THRESHOLDS`와 프론트엔드 `STAGE_RANGES`의 경계값이 달랐다.  
백엔드가 Track1 75점에서 "지역 1등"을 부여해도 프론트엔드는 86점부터 지역 1등 구간으로 계산해  
"다음 단계까지 +11점"이라는 잘못된 정보를 표시했다.

```
[수정 전]
survival:  { min: 0,  max: 30,  next: "성장 중" }     ← 백엔드 기준(< 30)과 1 차이
stability: { min: 31, max: 60,  next: "빠른 성장" }   ← 백엔드 기준(30~54)과 범위 다름
growth:    { min: 61, max: 85,  next: "지역 1등" }    ← 백엔드 기준(55~74)과 범위 다름
dominance: { min: 86, max: 100, next: "" }            ← 백엔드 기준(≥75)과 11점 차이

[수정 후]
survival:  { min: 0,  max: 29,  next: "성장 중" }
stability: { min: 30, max: 54,  next: "빠른 성장" }
growth:    { min: 55, max: 74,  next: "지역 1등" }
dominance: { min: 75, max: 100, next: "" }
```

**백엔드 단일 소스** (`score_engine.py:211-216`):
```python
_GROWTH_THRESHOLDS = [
    (30,  "survival",  "시작 단계"),
    (55,  "stability", "성장 중"),
    (75,  "growth",    "빠른 성장"),
    (101, "dominance", "지역 1등"),
]
```

---

### 2-2. 업종 평균 비교 — 신뢰할 수 없는 비교는 숨김 (A안)

**파일:** `frontend/app/(public)/trial/components/TrialResultStep.tsx:453-456`, `749-771`  
**관련 파일:** `TrialSharedTypes.ts`, `trial/page.tsx`

**문제:** Trial 최상단 배너가 API 실측 평균이 없을 때 `CATEGORY_BENCHMARKS`(하드코딩 추정값)를 사용하거나,  
백엔드 3단계 폴백(`fallback: "region"/"global"`) 응답을 실측처럼 표시했다.

**1차 수정 (시도 후 철회):** `isEstimatedBenchmark` 조건으로 "(·추정)" 라벨 부착 →  
"업종 평균(21점·추정)보다 낮습니다"처럼 표시. 그러나 "(·추정)" 표현 자체가 점수 전체의 신뢰도 저하로 이어진다는 판단으로 철회.

**최종 결정 — A안: 신뢰할 수 없는 비교는 숨기고, 행동 유도로 대체**

```
비교 표시 조건: apiBenchmark.avg_score 있음 AND apiBenchmark.fallback 없음
  → 실측 업종 평균 존재 (Level 1: 해당 업종+지역 ≥5건)
  → "업종 평균(X점) 이상/이하입니다" 표시

그 외 (폴백 응답 / API 없음 / 하드코딩 추정값):
  → 비교 표현 없이 "개선 포인트 N개 발견됨" 또는 행동 유도 메시지로 대체
```

```tsx
// 핵심 변수
const hasReliableBenchmark = !!(apiBenchmark?.avg_score && !apiBenchmark?.fallback);

// 배너 헤드라인
{hasReliableBenchmark
  ? score >= benchmarkAvg
    ? `업종 평균(${Math.round(benchmarkAvg)}점) 이상입니다`
    : `업종 평균(${Math.round(benchmarkAvg)}점)보다 낮습니다 — 개선 여지 있음`
  : missingKws.length > 0
    ? `개선 포인트 ${missingKws.length}개 발견됨`
    : "점수 개선 여지 확인됨"}
```

**백엔드 3단계 폴백 구조 (참조):**
| 레벨 | 조건 | `fallback` 필드 | 처리 |
|-----|------|----------------|------|
| 1 | 업종+지역 ≥5건 | 없음 | 실측 표시 |
| 2 | 업종+전국 ≥3건 | `"region"` | 숨김 |
| 3 | 전체 평균 | `"global"` | 숨김 |

**원칙:** "비교할 기준이 없으면 비교를 보여주지 않는다." 없는 정보를 만들어 보여주는 것보다 행동 유도가 더 신뢰를 쌓는다.

---

### 2-3. AI 샘플링 분산 면책 문구 현실화

**파일:** `TrialResultStep.tsx`, `DualTrackCard.tsx` (4곳)

**문제:** 기존 면책 문구 "±5점 변동 가능"은 AI 샘플링 특성을 과소 표현했다.  
Gemini/ChatGPT 각 50회 샘플 기준으로 노출율 p=50%일 때 95% CI는 약 ±14%이며,  
이것이 점수로 환산되면 채널당 최대 ±6점, 두 채널 합산 시 ±10~15점 수준이다.

```
[수정 전] 측정 시점·기기·로그인 상태에 따라 ±5점 변동 가능
[수정 후] AI 샘플링 특성상 측정 시점·질의 구성에 따라 ±10~15점 변동 가능
```

**참고:** 대시보드의 `DashboardDetailZone.tsx:307`은 `calcScoreVariation()`으로 실측 score_history 기반 변동폭을 계산해 표시한다. 7일 이상 데이터 없으면 수치 표시 없이 안내 문구만 노출한다 (이 동작은 변경 없음).

---

### 2-4. "심층 진단·점수 근거" 아코디언 기본 열림 전환

**파일:** `frontend/components/trial/TrialDetailAccordion.tsx:183`

**문제:** Trial 결과의 "심층 진단 · 점수 근거" 섹션이 기본 닫힘(`useState(false)`)이었다.  
점수 근거(`ScoreBreakdownBox`)를 포함한 가장 설득력 있는 정보가 클릭 없이는 보이지 않았다.

```tsx
// 수정 전
const [showDiagnosis, setShowDiagnosis] = useState(false);

// 수정 후
const [showDiagnosis, setShowDiagnosis] = useState(true);
```

---

### 2-5. "점수 근거 보기" 링크 추가

**파일:** `frontend/app/(public)/trial/components/TrialResultStep.tsx:328-333`

**문제:** `ScoreSummaryCard`(점수 요약 카드)에서 상세 근거로 이어지는 진입점이 없었다.

수정 내용: ScoreSummaryCard 하단에 `#score-breakdown` 앵커 링크 추가.

```tsx
<a
  href="#score-breakdown"
  className="text-sm text-blue-500 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap shrink-0"
>
  점수 근거 보기 ↓
</a>
```

---

### 2-6. 점수→매출 인과관계 명시 (장기 기대치 설정)

**파일 1:** `frontend/app/(public)/trial/components/TrialResultStep.tsx:268-276` (ScoreSummaryCard 내부)

**파일 2:** `frontend/app/(public)/score-guide/page.tsx` (신규 섹션 "점수가 높으면 손님이 더 오나요?")

**문제:** 기존 UI는 점수 향상과 매출 증가를 암묵적으로 동일시했다.  
사용자가 점수를 올렸는데 손님이 늘지 않으면 서비스 전체 신뢰가 무너질 수 있다.  
인과 경로를 명시해 현실적 기대를 설정하는 것이 장기 구독 유지에 유리하다.

**Trial ScoreSummaryCard에 추가된 인과관계 안내:**
```
점수가 오를수록 AI가 내 가게를 더 자주 추천 → 새 손님이 가게를 발견할 가능성이 높아집니다.
(점수 개선이 매출을 보장하지는 않으며, AI 노출 접점을 늘리는 지표입니다)
```

**score-guide에 추가된 인과 경로 시각화:**
```
점수 개선 → AI 검색 노출 증가 → 잠재 고객 발견 → 방문·구매 가능성↑
```
(단, 실제 방문은 가격·서비스·위치 등 다른 요인에도 영향받음을 명시)

---

### 2-7. 등급 백분위 추정 안내

**파일:** `frontend/app/(public)/score-guide/page.tsx` (§7 등급 기준 섹션)

`A등급 = 상위 20%` 등의 백분위 수치가 실측 데이터 없이 설정된 추정값임을 명시했다.

```
상위/하위 백분위는 초기 서비스 추정값입니다.
사용자 데이터가 쌓이면 실측 기반으로 자동 갱신됩니다.
```

---

## 3. 변경 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `frontend/components/dashboard/DualTrackCard.tsx` | STAGE_RANGES 경계값 수정 + AI 면책 문구 현실화 |
| `frontend/app/(public)/trial/components/TrialResultStep.tsx` | 벤치마크 A안(신뢰 없는 비교 숨김) + ±10~15점 + 인과관계 안내 + "점수 근거 보기" 링크 |
| `frontend/app/(public)/trial/components/TrialSharedTypes.ts` | apiBenchmark 타입에 `fallback?: string` 추가 |
| `frontend/app/(public)/trial/page.tsx` | apiBenchmark 상태 타입에 `fallback?: string` 추가 |
| `frontend/components/trial/TrialDetailAccordion.tsx` | showDiagnosis 기본값 true로 전환 |
| `frontend/app/(public)/score-guide/page.tsx` | 인과관계 섹션 신규 + 등급 백분위 추정 안내 |

---

## 4. 변경하지 않은 것 (의도적 결정)

| 항목 | 유지 이유 |
|------|---------|
| `ScoreCard` 컴포넌트 (A/B/C/D/F) | 현재 어디에도 사용되지 않음. 향후 활용 가능성 존재 |
| "지역 1등" 레이블 | 마케팅 언어로 75점 이상 달성 가능한 목표를 나타냄. 단, score-guide에 "지역 내 AI 검색 상위권" 해설 병기로 보완 |
| `CATEGORY_BENCHMARKS` 수치 | 실측 API Level 1이 없으면 비교 배너 자체를 숨김. 하드코딩값은 점수 바 마커 등 내부 계산에만 사용 |
| 업종별 Track1/Track2 가중치 비율 | 한국 검색 시장 특성 기반 합리적 설계. 사용자 확보 후 데이터로 검증 |

---

## 5. 장기 개선 로드맵

현재 수정으로 즉시 적용 가능한 것은 모두 완료됐다. 다음 항목은 사용자·데이터 확보 후 단계적 진행이 필요하다.

### Phase 2 — 데이터 기반 벤치마크 (구독자 50명 이상)
- `CATEGORY_BENCHMARKS` 하드코딩값을 `/api/report/benchmark` 실측 API로 교체
- 25개 업종 × 지역별 실측 평균 + 표준편차 산출
- `isEstimatedBenchmark` 플래그가 자동으로 `false`로 전환되어 "(·추정)" 표시 사라짐

### Phase 2 — 등급 백분위 실측화 (구독자 100명 이상)
- A/B/C/D/F 등급의 "상위 20%/40%" 수치를 실제 사용자 분포로 교체
- 업종별 percentile 계산 로직 백엔드 추가

### Phase 3 — 점수-매출 상관관계 측정
- 행동-결과 타임라인(`business_action_log`)에 "방문자 증가" 사용자 직접 기록 추가
- 점수 향상 후 방문자 변화 추적 → "점수 +10점 후 평균 방문 +X%" 실측 데이터 확보
- 충분한 데이터 확보 시 score-guide 인과 경로에 실측 수치 반영

### Phase 3 — INACTIVE 업종 Track2 가중치 재검토
- 변호사·의사 등 Track2(글로벌 AI) 80%+ 업종은 2026년 현재 실제 고객 유입 채널과 차이 있을 수 있음
- 구독자 중 INACTIVE 업종 비율·리텐션 데이터 모니터링 후 가중치 조정 검토
- 환경변수 `SCORE_MODEL_VERSION=v3_2` 전환으로 가중치 변경 가능

### 상시 유지 — 분산 측정 현실화
- `calcScoreVariation()`이 이미 score_history 기반 실측 변동폭을 계산하고 있음
- 사용자별로 7일 이상 데이터 축적 후 대시보드에 "이 가게 실측 변동폭 ±X점" 자동 표시됨
- 면책 문구 "±10~15점"은 데이터 축적 전 일반 추정값으로 유지

---

## 6. 점수 체계 아키텍처 요약 (현행 기준)

```
[통합 점수] = Track1 × naver_weight + Track2 × global_weight
                  ↑업종별 40~70%          ↑업종별 30~60%

[Track1 — 네이버 AI 채널]          [Track2 — 글로벌 AI 채널]
keyword_gap_score    35%            multi_ai_exposure  40%
review_quality       25%            schema_seo         30%
smart_place          15%            online_mentions    20%
naver_exposure       15%            google_presence    10%
kakao_completeness   10%

[GrowthStage] — Track1 기준 (업종 가중치 차이 오판 방지)
시작 단계:  Track1  0 ~ 29점
성장 중:    Track1 30 ~ 54점
빠른 성장:  Track1 55 ~ 74점
지역 1등:   Track1 75점 이상

[업종 그룹]
ACTIVE   → 음식점·카페·베이커리·바·숙박 (네이버 AI 브리핑 현재 대상)
LIKELY   → 뷰티·네일·피트니스·요가·반려동물·약국 (브리핑 확대 예정)
INACTIVE → 그 외 (글로벌 AI 중심)
```

---

*최종 업데이트: 2026-05-22 v1.1 — 벤치마크 A안(신뢰 없는 비교 숨김) 반영 | 관련 커밋: main branch 최신 | 참조: `docs/model_engine_v3.0.md`*
