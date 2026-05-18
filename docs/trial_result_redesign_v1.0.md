# Trial 결과 페이지 재설계 v1.0
# 네이버 우선 + GPT/Gemini 구체적 액션 추가

> 작성일: 2026-05-11 | next-feature 에이전트 설계 산출
> 제약: 백엔드 API 추가 없이 기존 trial 응답 데이터만 사용 (프론트엔드 전용)

---

## 목적

소상공인이 결과 페이지에서 다음 3가지를 즉시 파악하게 한다:

1. 네이버 AI 브리핑 기준으로 지금 내 가게가 어떤 상태인지
2. 오늘 당장 1개 행동으로 어떤 채널 점수를 올릴 수 있는지
3. ChatGPT·Gemini 노출을 높이려면 구체적으로 무엇을 해야 하는지

현재 페이지 문제: 네이버 진단과 글로벌 AI 진단이 혼재되어 우선순위가 불명확하고, GPT/Gemini 섹션은 점수만 보여줄 뿐 수정 방안이 없어 사용자가 다음 행동을 모른다.

---

## 1. 새 섹션 순서 (Zone 구조 재편)

현재 순서와 새 순서 대조:

| Zone | 현재 | 새 순서 |
|------|------|---------|
| 0 | 체험 기준 안내 + 가게 헤더 | 유지 (변경 없음) |
| 1 | FactEvidenceSection + TrialCompetitorGapCard | 유지 (사실 증거 최상단) |
| 2 | OneLineConclusion + 점수 요약 + 업종 그룹 | 유지 (점수 해석) |
| 3 | **[네이버 트랙 카드]** NEW | 네이버 Track1 상태 요약 카드 (신규) |
| 3-A | TodayOneAction | 유지 + 재배치 (Zone 3 바로 아래) |
| 4 | TrialKeywordRecommendCard | 유지 |
| 5 | **[GPT/Gemini 트랙 카드]** NEW | Track2 상태 요약 + 구체적 액션 3가지 (신규) |
| 6 | AIProblemDiagnosis | 유지 (심층 진단, 가장 상세) |
| 7 | 공유 버튼 + SubscriptionValueCompare + ClaimGate | 유지 |
| 8 | 잠긴 경쟁사 카드 + MoreDetailsAccordion | 유지 |

변경 요약:
- Zone 3 위치에 `NaverTrackCard` 신규 삽입
- Zone 5 위치에 `GlobalAiActionCard` 신규 삽입
- TodayOneAction은 NaverTrackCard 바로 아래로 이동 (현재와 동일 위치 유지)
- 제거되는 섹션 없음 — 모두 재배치

---

## 2. 신규 컴포넌트 목록

### 2-A. NaverTrackCard.tsx

**파일 경로:** `frontend/components/trial/NaverTrackCard.tsx`

**역할:** 네이버 트랙(Track1) 상태를 한눈에 요약하는 카드. 점수 항목을 나열하는 게 아니라 "브리핑 노출 여부 + 핵심 결핍 1개"만 강조.

**Props 인터페이스:**
```typescript
interface NaverTrackCardProps {
  track1Score: number;
  inBriefing: boolean | null;       // null = 미측정
  isSmartPlace: boolean;
  blogCount: number;
  hasFaq: boolean;
  hasIntro: boolean;
  userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";
  businessName: string;
}
```

**표시 내용 (모바일 기준):**
```
┌─────────────────────────────────────────┐
│ 네이버 AI 브리핑 Track 1               │
│ 점수: [track1]점 / 100점               │
│ ─────────────────────────────────────── │
│ [브리핑 노출 상태 배지]                  │
│  ✓ 노출 중 / ✗ 미노출 / — 확인 불가   │
│                                         │
│ [핵심 결핍 1줄 메시지]                  │
│  예: "소개글 Q&A가 없어 AI 인용 후보   │
│       에서 빠져 있습니다"               │
│                                         │
│ [아래 '오늘 할 일' 섹션에서 개선하세요] │
└─────────────────────────────────────────┘
```

**상태별 핵심 메시지 분기:**

| 상태 | 메시지 |
|------|--------|
| INACTIVE/franchise | "이 업종은 네이버 AI 브리핑 대상이 아닙니다. 아래 GPT/Gemini 개선 방안을 먼저 실행하세요." |
| isSmartPlace=false | "스마트플레이스 미등록 → 네이버 AI 브리핑 노출 불가. 아래 할 일에서 등록 방법을 확인하세요." |
| inBriefing=true | "현재 네이버 AI 브리핑에 노출되고 있습니다. 소식 업데이트로 순위를 유지하세요." |
| inBriefing=false, !hasFaq | "소개글에 Q&A가 없습니다. AI 브리핑 인용 후보 경로 중 가장 먼저 채워야 할 항목입니다." |
| inBriefing=false, hasFaq, blogCount<3 | "Q&A는 있지만 블로그 언급이 부족합니다. 리뷰 요청으로 외부 신뢰 신호를 쌓으세요." |
| inBriefing=null, isSmartPlace=true | "이번 체험에서 브리핑 노출 여부를 확인하지 못했습니다. 정식 스캔에서 직접 측정합니다." |

**디자인 원칙:**
- 배경: ACTIVE 업종은 `bg-blue-50 border-blue-200`, INACTIVE/franchise는 `bg-amber-50 border-amber-200`
- Track1 점수는 숫자 강조(text-2xl font-black)
- 결핍 메시지는 빨간 배경 박스(`bg-red-50 border-red-100`)에 굵게
- 최하단에 회색 작은 글씨: "Track 1 (네이버 AI 브리핑 기준) 점수입니다. 업종별 가중치로 계산됩니다."

---

### 2-B. GlobalAiActionCard.tsx

**파일 경로:** `frontend/components/trial/GlobalAiActionCard.tsx`

**역할:** ChatGPT·Gemini·Google AI 노출(Track2)을 높이는 구체적 액션 3가지를 현재 데이터 기반으로 동적 선택하여 제시.

**Props 인터페이스:**
```typescript
interface GlobalAiActionCardProps {
  track2Score: number;
  chatgptMentioned: boolean | undefined;
  chatgptSampleSize: number;           // 5 (트라이얼)
  geminiExposureFreq: number | undefined;
  blogCount: number;
  hasWebsite: boolean | null;          // website_check_result.has_website
  missingKeywords: string[];
  businessName: string;
  category: string;
  region: string;
  userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";
}
```

**hasWebsite 추출 방법 (TrialResultStep에서 전달 시):**
```typescript
const websiteCheckResult = (result as {
  website_check_result?: { has_website?: boolean }
}).website_check_result;
const hasWebsite = websiteCheckResult?.has_website ?? null;
```

**액션 우선순위 로직 (동적 선택):**

5가지 후보 액션 중 상황에 따라 상위 3개 선택. 우선순위 점수가 높은 순으로 표시.

| 액션 | 발동 조건 | 우선순위 점수 |
|------|-----------|--------------|
| Google 비즈니스 프로필 등록 | `!hasWebsite || blogCount === 0` | 10 (기본) |
| 구조화 콘텐츠 작성 (Q&A 형식) | `missingKeywords.length > 0 && !chatgptMentioned` | 9 |
| 블로그·외부 콘텐츠 확보 | `blogCount === 0` | 8 |
| 홈페이지 메타태그 최적화 | `hasWebsite === true` | 7 |
| JSON-LD 스키마 마크업 안내 | `track2Score < 40` | 6 (구독 유도 포함) |

**선택 알고리즘 (의사코드):**
```typescript
function selectTopActions(props): Action[] {
  const actions: Array<{ action: Action; score: number }> = [];

  // 항상 포함: Google 비즈니스 프로필 (가장 범용적)
  actions.push({ action: ACTION_GOOGLE_BIZ, score: 10 });

  if (props.missingKeywords.length > 0 && !props.chatgptMentioned) {
    // 누락 키워드 기반 Q&A 콘텐츠 작성
    actions.push({ action: buildStructuredContentAction(props.missingKeywords[0]), score: 9 });
  }

  if (props.blogCount === 0) {
    actions.push({ action: ACTION_BLOG_CONTENT, score: 8 });
  } else if (props.hasWebsite) {
    actions.push({ action: ACTION_META_TAG, score: 7 });
  }

  if (props.track2Score < 40) {
    actions.push({ action: ACTION_JSON_LD, score: 6 });  // 구독 유도 포함
  }

  // 점수 내림차순 상위 3개
  return actions.sort((a, b) => b.score - a.score).slice(0, 3).map(a => a.action);
}
```

**UI 레이아웃 (모바일 기준):**
```
┌─────────────────────────────────────────┐
│ ChatGPT·Gemini·Google AI               │
│ Track 2 점수: [track2]점 / 100점        │
│ ChatGPT 5회 → [언급됨 / 미언급]         │
│ ─────────────────────────────────────── │
│ 이 점수를 높이는 방법 3가지             │
│                                         │
│ 1. Google 비즈니스 프로필 등록          │
│    소요: 10분 | 효과: 즉시~1개월        │
│    [설명 1~2줄]                         │
│    [→ business.google.com 바로가기]     │
│                                         │
│ 2. '[키워드]' 정보 구조화 작성          │
│    소요: 5분 | 효과: 1~3개월            │
│    [복사 가능한 Q&A 문구]               │
│    [✅ 복사하기 버튼]                   │
│                                         │
│ 3. [세 번째 액션]                       │
│    소요: [시간] | 효과: [기간]          │
│    [설명]                               │
│ ─────────────────────────────────────── │
│ ※ 면책 문구 (작은 회색 글씨)            │
│ ChatGPT 측정은 AI 학습 데이터 기반이며  │
│ 실시간 웹 검색 결과와 다를 수 있습니다. │
│ GPT/Gemini 노출 개선은 수주~수개월 소요. │
└─────────────────────────────────────────┘
```

**5가지 액션 상세 정의:**

**[액션 1] Google 비즈니스 프로필 등록** (항상 포함)
- 소요시간: 10분
- 예상 효과: 즉시~1개월
- 설명: "ChatGPT·Google AI는 구글 공식 데이터를 학습합니다. business.google.com 무료 등록이 글로벌 AI 노출의 첫 단계입니다."
- CTA: "→ business.google.com" (외부 링크)
- 복사 문구 없음 (외부 링크 액션)

**[액션 2] 구조화 콘텐츠 작성** (missingKeywords 기반 동적)
- 소요시간: 5분
- 예상 효과: 1~3개월
- 설명: "ChatGPT·Gemini는 '[missingKeywords[0]]'처럼 명확한 Q&A 형식 텍스트를 인용합니다. 홈페이지·소개글에 아래 문구를 추가하세요."
- 복사 문구: `Q. [missingKeywords[0]] 관련 서비스는 어디서 받을 수 있나요?\nA. [businessName]에서 [missingKeywords[0]] 전문 서비스를 제공합니다. 주소·연락처·운영시간을 확인 후 방문해 주세요.`
- 복사 버튼 있음

**[액션 3] 블로그·외부 콘텐츠 확보** (blogCount=0 조건)
- 소요시간: 2분 (리뷰 요청 문자 발송)
- 예상 효과: 2~4개월
- 설명: "ChatGPT는 외부 웹 콘텐츠(블로그 후기, 뉴스)를 학습합니다. 손님에게 네이버·구글 리뷰를 요청하면 AI가 가게를 신뢰하게 됩니다."
- 복사 문구: 리뷰 요청 문자 (업종별 템플릿 — AIProblemDiagnosis의 REVIEW_TEXT_TEMPLATES 재사용)
- 복사 버튼 있음

**[액션 4] 홈페이지 메타태그 최적화** (hasWebsite=true 조건)
- 소요시간: 30분
- 예상 효과: 1~2개월
- 설명: "홈페이지가 있다면 `<title>`, `<meta description>`에 '[businessName] [region] [category]' 키워드를 포함하면 Google AI와 ChatGPT 인용 가능성이 높아집니다."
- 복사 문구: `<title>[businessName] — [region] [category] 전문</title>\n<meta name="description" content="[region] [businessName]. [category] 전문. 영업시간·위치·예약 안내.">`
- 복사 버튼 있음

**[액션 5] JSON-LD 스키마 마크업 안내** (track2Score<40 조건, 구독 유도 포함)
- 소요시간: —
- 예상 효과: 1~2개월
- 설명: "구조화 데이터(JSON-LD)는 Google·Bing AI가 가게를 정확히 인식하는 데 필요한 코드입니다. AEOlab Pro 플랜에서 자동 생성해 드립니다."
- CTA: "→ Pro 플랜에서 자동 생성 (월 18,900원)" (구독 유도)
- 복사 문구 없음

**면책 문구 (필수, 작은 회색 텍스트):**
```
ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
GPT/Gemini 노출 개선은 수주~수개월이 소요되며, 결과는 보장되지 않습니다.
```

---

## 3. 수정 파일 목록

**신규 생성 (2개):**
```
frontend/components/trial/NaverTrackCard.tsx       — 네이버 트랙 요약 카드
frontend/components/trial/GlobalAiActionCard.tsx   — GPT/Gemini 액션 카드
```

**수정 (1개):**
```
frontend/app/(public)/trial/components/TrialResultStep.tsx
  — NaverTrackCard import 추가 (Zone 2-3 사이 삽입)
  — GlobalAiActionCard import 추가 (TrialKeywordRecommendCard 아래 삽입)
  — hasWebsite 추출 로직 추가 (result.website_check_result 파싱)
```

**변경 없음 (기존 컴포넌트 재배치 없이 순서만 조정):**
```
frontend/components/trial/TodayOneAction.tsx       — 코드 변경 없음
frontend/components/trial/AIProblemDiagnosis.tsx   — 코드 변경 없음
frontend/components/trial/FactEvidenceSection.tsx  — 코드 변경 없음
frontend/components/trial/SubscriptionValueCompare.tsx — 변경 없음
```

---

## 4. DB 변경 여부

**없음.** 이번 작업은 프론트엔드 전용이며, 기존 trial 응답 데이터(`result.track1_score`, `result.track2_score`, `result.chatgpt_result`, `result.naver`, `result.website_check_result`, `result.top_missing_keywords`)만 사용한다.

---

## 5. GPT/Gemini 액션 로직 — 상황별 분기 전체

**입력 데이터 → 출력 액션 매핑표:**

| chatgptMentioned | blogCount | hasWebsite | missingKws | track2 | 선택 액션 순서 |
|-----------------|-----------|------------|------------|--------|----------------|
| false | 0 | null | 있음 | <40 | 1(구글) → 2(Q&A) → 3(블로그) |
| false | 0 | false | 있음 | <40 | 1(구글) → 2(Q&A) → 3(블로그) |
| false | >0 | true | 있음 | <40 | 1(구글) → 2(Q&A) → 4(메타태그) |
| false | >0 | false | 있음 | <40 | 1(구글) → 2(Q&A) → 5(JSON-LD) |
| true | 0 | null | 없음 | >=40 | 1(구글) → 3(블로그) → 5(JSON-LD) |
| true | >0 | true | 없음 | >=40 | 1(구글) → 4(메타태그) → 5(JSON-LD) |
| undefined | 0 | null | 있음 | <40 | 1(구글) → 2(Q&A) → 3(블로그) |

**INACTIVE/franchise 업종 처리:**
- INACTIVE/franchise도 GlobalAiActionCard를 동일하게 표시한다 (이 업종에서 더 중요하므로).
- 다만 카드 상단에 "이 업종의 주요 노출 채널입니다" 강조 배지를 추가한다.
- 액션 순서는 동일.

**missingKeywords[0]가 없는 경우 액션 2 대체:**
- missingKeywords가 비어 있으면 액션 2 대신 selectedTags[0] 또는 업종 카테고리 레이블을 키워드로 사용.
- 그래도 없으면 액션 2를 건너뛰고 blogCount 기반 액션 3 또는 메타태그 액션 4로 대체.

---

## 6. UI 레이아웃 스케치

### 모바일 전체 레이아웃 (Zone 구조)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 0] 체험 기준 안내 배너 (파란 배경)
[Zone 0] 가게 이름 + 총 점수 헤더 카드

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 1] FactEvidenceSection (ChatGPT/네이버 실측)
[Zone 1] TrialCompetitorGapCard (검색 순위)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ─── 종합 점수 요약 구분선 ───

[Zone 2] OneLineConclusion (점수 + 성장 단계)
[Zone 2] CompetitorGapHighlightCard (업종 비교)
[Zone 2] 점수 산출 근거 (항목별 체크)
[Zone 2] 업종 그룹 배너 (ACTIVE/LIKELY/INACTIVE)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 3] NaverTrackCard ← 신규
  ┌────────────────────────────────────┐
  │ 네이버 AI 브리핑 Track 1   [점수]  │
  │ [브리핑 상태 배지]                 │
  │ [핵심 결핍 메시지 빨간 박스]        │
  └────────────────────────────────────┘

[Zone 3-A] TodayOneAction (오늘 5분 할 일)
  ┌────────────────────────────────────┐
  │ ⚡ 오늘 5분 안에 할 일 (1개만)     │
  │ [액션 타이틀 큰 글씨]              │
  │ [설명 + 복사 버튼]                 │
  └────────────────────────────────────┘

[Zone 4] TrialKeywordRecommendCard (키워드 추천)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 5] GlobalAiActionCard ← 신규
  ┌────────────────────────────────────┐
  │ ChatGPT·Gemini·Google AI Track 2  │
  │ [점수] ChatGPT: [언급/미언급]      │
  │ ──────────────────────────────── │
  │ 이 점수를 높이는 방법 3가지        │
  │                                    │
  │ 1. [액션 제목]   [소요시간 배지]   │
  │    [설명]                          │
  │    [외부링크 or 복사 버튼]         │
  │                                    │
  │ 2. [액션 제목]   [소요시간 배지]   │
  │    [복사 문구 미리보기]             │
  │    [복사 버튼]                     │
  │                                    │
  │ 3. [액션 제목]   [소요시간 배지]   │
  │    [설명]                          │
  │                                    │
  │ ※ 면책 문구 (gray-500, text-sm)    │
  └────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 6] AIProblemDiagnosis (심층 진단 전체)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 7] 공유 버튼 (카카오 + 텍스트)
[Zone 7] SubscriptionValueCompare
[Zone 7] ClaimGate (비로그인)
[Zone 7] 잠긴 경쟁사 카드

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Zone 8] MoreDetailsAccordion (상세 분석)
```

### PC 레이아웃 차이점

- Zone 3(NaverTrackCard)와 Zone 3-A(TodayOneAction)를 2열 나란히 배치 가능:
  `md:grid md:grid-cols-2 md:gap-4`
- Zone 5(GlobalAiActionCard)의 액션 3개를 PC에서 가로 3열 배치:
  `md:grid md:grid-cols-3 md:gap-4`
- 나머지는 현재 max-w-5xl mx-auto 컨테이너 유지

---

## 7. TrialResultStep.tsx 수정 위치 (정확한 삽입 지점)

### NaverTrackCard 삽입 위치

현재 Zone 2 마지막 부분 — 업종 그룹 카드(`bgMap[group]`) 렌더링 직후, TodayOneAction 바로 위:

```typescript
// 현재 코드 (Zone 3 시작):
{/* Zone 3 — 행동 (지금 당장): effectiveMissingKws 사용 */}
<TodayOneAction .../>

// 변경 후:
{/* Zone 3 — 네이버 트랙 요약 */}
<NaverTrackCard
  track1Score={track1}
  inBriefing={inBriefing}
  isSmartPlace={isSmartPlace}
  blogCount={blogCount}
  hasFaq={hasFaq}
  hasIntro={hasIntro}
  userGroup={getUserGroup(selectedCategory, isFranchise)}
  businessName={form.business_name || "내 가게"}
/>
<TodayOneAction .../>  {/* 변경 없음 */}
```

### GlobalAiActionCard 삽입 위치

TrialKeywordRecommendCard 바로 아래, AIProblemDiagnosis 바로 위:

```typescript
// 현재:
{missingKws.length > 0 && <TrialKeywordRecommendCard .../>}
{/* Zone 3.5 — 심층 진단 */}
<AIProblemDiagnosis .../>

// 변경 후:
{missingKws.length > 0 && <TrialKeywordRecommendCard .../>}

{/* Zone 5 — GPT/Gemini 트랙 + 액션 */}
<GlobalAiActionCard
  track2Score={track2}
  chatgptMentioned={chatgptMentioned}
  chatgptSampleSize={chatgptResult?.sample_size ?? 5}
  geminiExposureFreq={
    (result as { gemini_result?: { exposure_freq?: number } }).gemini_result?.exposure_freq
  }
  blogCount={blogCount}
  hasWebsite={hasWebsite}  // 새로 추출한 변수
  missingKeywords={effectiveMissingKws}
  businessName={form.business_name || "내 가게"}
  category={selectedCategory}
  region={form.region || ""}
  userGroup={getUserGroup(selectedCategory, isFranchise)}
/>
<AIProblemDiagnosis .../>  {/* 변경 없음 */}
```

### hasWebsite 추출 위치

TrialResultStep 컴포넌트 상단 변수 정의부 (chatgptResult 추출 직후):

```typescript
// 기존 chatgptResult 추출 아래에 추가:
const websiteCheckResult = (result as {
  website_check_result?: { has_website?: boolean };
}).website_check_result;
const hasWebsite: boolean | null = websiteCheckResult?.has_website ?? null;
```

---

## 8. 구현 순서

백엔드 변경 없으므로 프론트엔드 3단계만:

**Step 1. NaverTrackCard 신규 작성** (약 2시간)
- `frontend/components/trial/NaverTrackCard.tsx` 신규 생성
- Props 인터페이스 정의
- 6가지 상태 분기 메시지 구현
- 모바일 레이아웃 완성
- PC 반응형 (`md:grid-cols-2`) 추가

**Step 2. GlobalAiActionCard 신규 작성** (약 3시간)
- `frontend/components/trial/GlobalAiActionCard.tsx` 신규 생성
- 5가지 액션 정의 (상수로 분리)
- 동적 선택 알고리즘 구현 (`selectTopActions()`)
- 복사 버튼 로직 (navigator.clipboard + 폴백)
- 외부 링크 액션 처리
- 면책 문구 필수 포함
- 모바일 단열 + PC 3열 레이아웃

**Step 3. TrialResultStep.tsx 통합** (약 1시간)
- import 2개 추가
- `hasWebsite` 변수 추출 로직 추가
- `isFranchise` 변수 상단으로 끌어올리기 (현재 inline IIFE 안에 있음 → 재사용 위해)
- NaverTrackCard 삽입 (Zone 3 앞)
- GlobalAiActionCard 삽입 (TrialKeywordRecommendCard 아래)
- 타입 검증 (TypeScript 에러 없음 확인)

**Step 4. 서버 배포 및 검증** (약 30분)
- scp 업로드 또는 GitHub Actions 자동 배포
- `npm run build` 빌드 에러 확인
- `pm2 restart aeolab-frontend`
- https://aeolab.co.kr/trial 에서 결과 페이지 모바일/PC 확인
  - NaverTrackCard가 TodayOneAction 위에 렌더링되는지
  - GlobalAiActionCard의 액션이 3개 표시되는지
  - 면책 문구가 노출되는지
  - 복사 버튼 동작 확인

**총 예상 작업 시간: 6~7시간**

---

## 9. 비용 영향 분석

**AI API 추가 호출: 없음.** 신규 컴포넌트 2개는 프론트엔드 로직만으로 구현. 기존 trial 스캔 응답 데이터를 재사용하므로 AI API 비용 변동 없음.

| 항목 | 현재 비용 | 변동 |
|------|-----------|------|
| Gemini (trial 10회) | $0.001/회 미만 | 0 |
| ChatGPT (trial 5회) | $0.002/회 미만 | 0 |
| 신규 컴포넌트 | 0 | 0 |
| **합계** | 기존 그대로 | **+$0** |

---

## 10. 플랜 제한

없음. NaverTrackCard와 GlobalAiActionCard는 trial 페이지에서만 사용하며, 로그인 불필요. 단, `GlobalAiActionCard` 액션 5(JSON-LD 자동 생성)는 Pro 플랜 구독 유도 메시지로 처리.

---

## 11. 주의사항

**isFranchise 변수 중복 문제:**
현재 TrialResultStep에서 `is_franchise` 체크가 두 곳에서 inline IIFE로 처리됨 (`const isFranchise = (form as {is_franchise?: boolean}).is_franchise === true` 패턴). NaverTrackCard와 GlobalAiActionCard 모두 userGroup이 필요하므로, 컴포넌트 상단에 변수 1개로 끌어올린 후 재사용해야 한다.

**gemini_result 데이터 유무:**
trial 스캔은 ChatGPT 5회만 측정하므로 `gemini_result`가 없거나 `exposure_freq=0`일 수 있다. GlobalAiActionCard에서 `geminiExposureFreq` props가 undefined인 경우 Gemini 노출 정보를 "체험 스캔 미측정 (정식 스캔에서 측정)"으로 표시.

**website_check_result 필드 존재 여부:**
trial API 응답에 `website_check_result` 필드가 항상 포함되지 않을 수 있다. `?.` optional chaining으로 안전하게 접근하고, `null`일 때 GlobalAiActionCard는 `hasWebsite=null`로 처리 (구글 비즈니스 프로필 액션과 Q&A 콘텐츠 액션만 표시).

**text-sm 이상 가독성 원칙:**
NaverTrackCard, GlobalAiActionCard의 모든 텍스트는 `text-sm` 이상. 면책 문구는 `text-sm text-gray-500`으로 처리 (text-xs 금지).

**`isFranchise` 변수 추출 위치 정리:**
```typescript
// TrialResultStep 컴포넌트 상단 (현재 inline인 것을 끌어올림)
const isFranchise = (form as { is_franchise?: boolean }).is_franchise === true;
const userGroupValue = getUserGroup(selectedCategory, isFranchise);
```
이후 TodayOneAction의 `userGroup` prop, NaverTrackCard의 `userGroup`, GlobalAiActionCard의 `userGroup` 모두 `userGroupValue` 사용.

---

## 12. 관련 참고 문서

- `docs/model_engine_v3.0.md` — Track1/Track2 점수 구조
- `docs/naver_gpt_work_standard_v1.0.md` — ACTIVE/LIKELY/INACTIVE 업종 분류 기준
- CLAUDE.md — ChatGPT 면책 문구 원칙, text-sm 이상 가독성 원칙

---

*설계 작성: 2026-05-11 | next-feature 에이전트*
*구현 담당: frontend-dev 에이전트*
*검증: SSH 서버 직접 확인 필수 (에이전트 보고만 신뢰 금지 — CLAUDE.md 에이전트 보고 검증 의무)*
