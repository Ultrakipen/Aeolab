# AEOlab 랜딩 페이지 개선 계획

> 작성일: 2026-04-24 | 담당: frontend-dev 에이전트  
> 참고: 직접 코드 분석 + ChatGPT 점검 결과(`0424_gpt점검.txt`)  
> 새 대화창에서 이 파일을 읽고 바로 작업 시작 가능

---

## 배경 및 진단 요약

### ChatGPT 점검 결과 (원문 요약)
- **마케팅 설득력: 중상** — 메시지 명확, 문제→해결 구조 있음
- **SEO 구조: 하** — 정보성 페이지 전무, 광고 구조만 존재
- **AEO 구조: 매우 낮음** — AI가 참고할 콘텐츠 없음 (FAQ·원리 설명·사례 분석 부재)

### 코드 직접 분석 추가 발견
- 모바일에서 업종 타일 7개(3행)로 인해 **CTA가 폴드 아래로 밀림**
- 모바일 Hero 샘플 카드가 CTA 아래에 배치되어 Hero 섹션이 과도하게 길어짐
- Alert 배지 텍스트 모바일 2줄 줄바꿈 가능성
- 공개 FAQ 독립 페이지 없음 (`/pricing#faq` 앵커만 존재)
- 교육성 공개 페이지 전무 (블로그, AI 원리, 사례 분석)
- 푸터 내부 링크 부족 (5개뿐 — FAQ·블로그·AI원리 없음)
- `sitemap.xml` 및 구조화 데이터(JSON-LD FAQ Schema) 미확인

---

## 현재 공개 페이지 목록

| 경로 | 현황 |
|------|------|
| `/` | 랜딩 (5블록 구조, v5.0 완료) |
| `/trial` | 무료 체험 (3-step 분해 완료) |
| `/demo` | 목업 데모 (업종/지역 선택 → 고정 데이터) |
| `/pricing` | 요금제 + FAQ 인라인 |
| `/terms`, `/privacy` | 법적 문서 |
| `/share/[bizId]` | 공유 페이지 |

**없는 것**: `/faq`, `/how-ai-works`, `/blog` (공개), `/cases`

---

## 개선 계획 (우선순위 순)

---

### Phase A — 즉시 수정 (반나절, UX 전환율)

#### A1. 모바일 업종 타일 3행 → 2행으로 축소 [가장 중요]

**파일**: `frontend/components/landing/HeroIndustryTiles.tsx`

```tsx
// 현재 — 3열 = 7개 타일이 3행 차지
<div className="grid grid-cols-3 md:grid-cols-4 gap-2">

// 수정 — 4열 = 7개 타일이 2행 차지 (4+3)
<div className="grid grid-cols-4 gap-2">
```

**효과**: 모바일에서 CTA 버튼이 폴드 안으로 들어옴 (가장 임팩트 큰 변경)

#### A2. Alert 배지 텍스트 단축

**파일**: `frontend/app/page.tsx` (line 63)

```tsx
// 현재 (모바일 2줄 줄바꿈 위험)
"네이버 검색의 40%가 AI 브리핑으로 바뀝니다 — 2026년 안에"

// 수정 (1줄 유지)
"네이버 검색 40%가 AI 브리핑으로 전환 중"
```

#### A3. 모바일 샘플 카드 위치 이동

**파일**: `frontend/app/page.tsx`

모바일 전용 `<HeroSampleCard variant="mobile" />`을 Hero 섹션 왼쪽 컬럼에서 제거하고,
가격 앵커 섹션(블록 2) 아래 독립 섹션으로 이동.

```tsx
// 현재 위치: Hero 왼쪽 컬럼 맨 아래 (line ~106)
<HeroSampleCard variant="mobile" />

// 이동 위치: 가격 앵커 섹션(블록 2) 바로 다음에 독립 섹션으로
<section className="lg:hidden bg-gray-50 px-4 py-6">
  <HeroSampleCard variant="mobile" />
</section>
```

---

### Phase B — 공개 FAQ 페이지 신설 (3~4시간)

**가장 높은 SEO·AEO 임팩트. ChatGPT가 최우선으로 지목한 항목.**

#### B1. 독립 FAQ 페이지 생성

**신규 파일**: `frontend/app/(public)/faq/page.tsx`

Q&A를 두 섹션으로 구성:
1. **AI 검색 원리 Q&A** (교육성 — AI 인용 목적)
2. **AEOlab 서비스 Q&A** (전환 목적)

```
AI 검색 원리:
Q. ChatGPT는 어떤 기준으로 가게를 추천하나요?
Q. 네이버 AI 브리핑에 내 가게가 나오려면 무엇이 필요한가요?
Q. 리뷰가 100개인데 AI에 노출이 안 되는 이유는?
Q. FAQ 등록이 AI 추천에 어떤 영향을 주나요?
Q. AI 노출과 네이버 광고는 다른가요?

AEOlab 서비스:
Q. AEOlab 점수는 어떻게 계산되나요?
Q. 무료 체험과 유료 구독의 차이는?
Q. 결과가 나오기까지 얼마나 걸리나요?
Q. 언제든지 해지할 수 있나요?
```

**FAQ JSON-LD 스키마** 추가 (SEO + AI 인용):
```tsx
<script type="application/ld+json">{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [...questions]
})}</script>
```

#### B2. 헤더 내비게이션 FAQ 링크 업데이트

**파일**: `frontend/app/page.tsx` (line 27)

```tsx
// 현재
<Link href="/pricing#faq">FAQ</Link>

// 수정
<Link href="/faq">FAQ</Link>
```

#### B3. 푸터 링크 보강

**파일**: `frontend/app/page.tsx` (footer 섹션)

```tsx
// 현재 5개
/pricing, /demo, /trial, /terms, /privacy

// 추가
<Link href="/faq">FAQ</Link>
<Link href="/how-ai-works">AI 원리</Link>  {/* Phase C 이후 */}
```

---

### Phase C — AI 원리 설명 페이지 (4~6시간)

**신규 파일**: `frontend/app/(public)/how-ai-works/page.tsx`

ChatGPT·네이버 AI가 업체를 추천하는 기준을 설명하는 교육성 페이지.
AEOlab이 AEO 서비스라면 이 페이지 자체가 신뢰의 근거.

**페이지 구조**:
```
h1: "ChatGPT·네이버 AI가 가게를 추천하는 4가지 기준"

섹션 1: AI 브리핑이란? (정의)
섹션 2: 추천 기준 4가지
  1. 키워드 정합성 (스마트플레이스 소개글)
  2. FAQ 등록 수 (Q&A 응답 학습)
  3. 리뷰 응답률 (최신성·활동성 신호)
  4. 사진·영업 정보 완성도
섹션 3: AEOlab이 측정하는 방법 → /trial CTA
```

**SEO 목적 메타태그**:
```tsx
title: "ChatGPT·네이버 AI가 가게를 추천하는 기준 | AEOlab"
description: "ChatGPT와 네이버 AI 브리핑이 업체를 선택하는 알고리즘을 분석합니다. FAQ 등록, 리뷰 응답, 키워드 최적화가 핵심입니다."
```

---

### Phase D — /demo 페이지 교육 콘텐츠 보강 (2~3시간)

**파일**: `frontend/app/(public)/demo/page.tsx`

현재 데모 페이지는 목업 점수 카드만 보여줌. 아래 섹션 추가:

```
추가할 섹션:
1. "이 점수가 의미하는 것" — 점수 항목별 설명 패널
2. "상위 1위 가게와의 차이" — 구체적 Gap 설명 (텍스트)
3. "오늘 당장 할 수 있는 것" — 이미 있는 TodayOneActionBox 강화
4. "실제 분석받기" → /trial CTA
```

---

### Phase E — 사례 분석 콘텐츠화 (장기, 1~2주)

ChatGPT 지적: "이미지가 아닌 텍스트 분석" 필요

**방향**: 현재 `HeroSampleCard`의 샘플 데이터를 텍스트 중심 사례 페이지로 확장

**신규 경로**: `/cases/cafe-gangnam`, `/cases/restaurant-mapo` 등

각 사례 페이지 구조:
```
제목: "강남구 카페 AI 노출 1위 분석 — FAQ 23건의 비밀"
내용:
  - 업종/지역 개요
  - 1위 가게의 구체적 특징 (FAQ 수, 리뷰 응답률, 사진 수)
  - 하위 가게와의 차이 수치
  - AEOlab 점수 구성 설명
  - 내 가게라면? → /trial CTA
```

> 참고: HeroSampleCard의 SAMPLES 배열(6개 사례)을 초기 콘텐츠로 재활용 가능

---

### Phase F — 기술적 보완 (병행)

#### F1. sitemap.xml 확인 및 추가

Next.js App Router 방식으로 `app/sitemap.ts` 생성:
```ts
// frontend/app/sitemap.ts
export default function sitemap() {
  return [
    { url: 'https://aeolab.co.kr', lastModified: new Date() },
    { url: 'https://aeolab.co.kr/trial', lastModified: new Date() },
    { url: 'https://aeolab.co.kr/pricing', lastModified: new Date() },
    { url: 'https://aeolab.co.kr/demo', lastModified: new Date() },
    { url: 'https://aeolab.co.kr/faq', lastModified: new Date() },
    { url: 'https://aeolab.co.kr/how-ai-works', lastModified: new Date() },
  ]
}
```

#### F2. robots.txt 확인

`frontend/public/robots.txt` 존재 여부 확인. 없으면 생성:
```
User-agent: *
Allow: /
Sitemap: https://aeolab.co.kr/sitemap.xml
```

#### F3. 각 공개 페이지 메타태그 점검

현재 `/demo`, `/pricing`, `/trial` 페이지의 `<head>` 메타태그 검토 필요.
각 페이지에 고유한 `title`, `description`, OG 태그가 없으면 추가.

---

## 구현 순서 및 예상 시간

| 순서 | 작업 | 시간 | 임팩트 |
|------|------|------|--------|
| **A1** | 업종 타일 grid-cols-4 변경 | 5분 | ★★★★★ (모바일 CTA 폴드 내 진입) |
| **A2** | Alert 배지 텍스트 단축 | 5분 | ★★ |
| **A3** | 모바일 샘플 카드 위치 이동 | 30분 | ★★★ |
| **B1** | `/faq` 독립 페이지 신설 | 3~4h | ★★★★ (SEO+AEO) |
| **B2** | 헤더 FAQ 링크 업데이트 | 5분 | ★★ |
| **B3** | 푸터 링크 보강 | 15분 | ★★ |
| **F1** | sitemap.xml 생성 | 30분 | ★★★ (크롤링) |
| **F2** | robots.txt 확인/생성 | 10분 | ★★ |
| **C** | `/how-ai-works` 페이지 | 4~6h | ★★★★ |
| **D** | `/demo` 교육 콘텐츠 보강 | 2~3h | ★★★ |
| **E** | 사례 분석 페이지 (선택) | 8~12h | ★★★ |

---

## 작업 전제 조건 (새 대화창 확인 필수)

- **서버**: `root@115.68.231.57`, SSH 키 `~/.ssh/id_ed25519`
- **서버 경로**: `/var/www/aeolab/`
- **로컬 경로**: `C:/app_build/aeolab/`
- **작업 순서**: 서버에서 직접 수정 → `npm run build` → `pm2 restart aeolab-frontend` → 로컬 scp 동기화
- **테스트 URL**: https://aeolab.co.kr

---

## 새 대화창 시작 프롬프트 (복사해서 사용)

```
docs/landing_improvement_plan_0424.md 파일을 읽고
Phase A 작업부터 순서대로 진행해줘.
A1 → A2 → A3 → B1 순으로.
서버 우선 원칙 적용 (SSH → 빌드 → 재시작 → 로컬 동기화).
```

---

*작성: 2026-04-24 | 코드 분석 + ChatGPT 점검 결과 통합*  
*참조: CLAUDE.md, docs/next_features_v1.0.md, 0424_gpt점검.txt*
