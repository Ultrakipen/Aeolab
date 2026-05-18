# AEOlab 랜딩페이지 디자인 시스템 & 컴포넌트 문서

**버전** v1.0 | **작성일** 2026-05-07 | **스택** Next.js 14 App Router · Tailwind CSS · Lucide React

> 본 문서는 기밀입니다. 내부 개발 참조용으로만 사용하십시오.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [디자인 시스템](#2-디자인-시스템)
3. [컴포넌트 명세](#3-컴포넌트-명세)
4. [업종별 데이터 명세](#4-업종별-데이터-명세)
5. [파일 구조 및 구현 가이드](#5-파일-구조-및-구현-가이드)
6. [잔여 개선 과제](#6-잔여-개선-과제)
7. [변경 이력](#7-변경-이력)

---

## 1. 프로젝트 개요

AEOlab 랜딩페이지는 한국 소상공인을 대상으로 AI 검색 최적화 서비스의 가치를 전달하고, 무료 진단 체험을 통해 유료 구독으로 전환시키는 것을 목표로 합니다.

### 1.1 설계 철학

| # | 원칙 | 설명 |
|---|------|------|
| 1 | **설명이 아닌 체험** | 히어로 영역에서 업종·지역 입력 즉시 AI 노출 진단 결과 표시 |
| 2 | **업종별 즉시 분기** | 네이버 AI 브리핑 적용 여부를 탭 선택만으로 즉시 확인 |
| 3 | **화이트 기반 미니멀** | `#F7F7F5` 오프화이트 배경, 카드는 순백, 섹션 구분은 여백·보더만 사용 |

### 1.2 섹션 구조 및 전환 목적

| 순서 | 섹션명 | 컴포넌트 | 전환 목적 |
|------|--------|----------|-----------|
| 1 | NAV | `NavBar` | 신뢰 + 빠른 CTA 접근 |
| 2 | HERO | `HeroSection` | 3초 내 서비스 파악 + 진단 시작 |
| 3 | 업종 배너 | `IndustryBanner` | 네이버 AI 브리핑 적용 여부 즉시 확인 |
| 4 | 문제 + 변화 | `ProblemSection` / `SearchChangeSection` | 공감 → 긴박감 형성 |
| 5 | ChatGPT 비교 | `ChatGPTCompareSection` | "직접 하면 되지 않나?" 해소 |
| 6 | AEO 비교 | `AEOCompareSection` | 기존 도구와의 차별화 |
| 7 | 3단계 + 대시보드 | `HowItWorksSection` / `DashboardPreview` | 작동 원리 + 카카오 알림 증거 |
| 8 | 가격 앵커 | `PriceAnchorSection` | 광고비 대비 가격 체감 |
| 9 | 요금제 | `PricingSection` | 구매 결정 |
| 10 | FAQ + CTA | `FAQSection` / `FinalCTA` | 마지막 의문 해소 + 행동 유도 |

---

## 2. 디자인 시스템

### 2.1 색상 팔레트

```css
/* frontend/app/globals.css */
:root {
  /* 배경 */
  --bg:           #F7F7F5;  /* 페이지 배경 (오프화이트) */
  --white:        #FFFFFF;  /* 카드·컴포넌트 배경 */

  /* 텍스트 */
  --ink:          #0A0A0A;  /* 주요 텍스트·버튼 배경 */
  --ink2:         #2A2A2A;  /* 서브 제목 */
  --ink3:         #6B6B6B;  /* 본문 텍스트 */
  --ink4:         #ABABAB;  /* 힌트·레이블 */

  /* 보더 */
  --border:       #E8E8E4;  /* 기본 보더 */
  --border2:      #D0D0CA;  /* 강조 보더 */

  /* 액션 */
  --blue:         #1A6BFF;  /* 주요 액션·링크 */
  --blue-d:       #0D4FD1;  /* 블루 hover */
  --blue-pale:    #EEF4FF;  /* 블루 배경 틴트 */
  --blue-mid:     #C5D8FF;  /* 블루 중간 */

  /* 상태 */
  --green:        #00B96B;  /* 성공·적용 완료 */
  --green-pale:   #E4F9EF;  /* 녹색 배경 틴트 */
  --amber:        #F59E0B;  /* 경고·누락 키워드 */
  --amber-pale:   #FEF3C7;  /* 황색 배경 틴트 */
  --red:          #F43F5E;  /* 오류·미적용 */
  --red-pale:     #FFF0F3;  /* 적색 배경 틴트 */

  /* 간격·반경 */
  --r:            10px;
  --r-lg:         14px;
  --r-xl:         20px;

  /* 그림자 */
  --shadow:       0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
  --shadow-lg:    0 4px 24px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04);
}
```

### 2.2 타이포그래피

| 구분 | 폰트 | 크기 | 굵기 | 사용처 |
|------|------|------|------|--------|
| Display | Noto Sans KR | 34px | 700 | 히어로 타이틀 |
| Heading 1 | Noto Sans KR | 21px | 700 | 섹션 제목 |
| Heading 2 | Noto Sans KR | 19px | 700 | 카드 제목 |
| Heading 3 | Noto Sans KR | 14px | 700 | 항목 소제목 |
| Body | Noto Sans KR | 14px | 400 | 본문 |
| Caption | Noto Sans KR | 12px | 400 | 힌트·설명 |
| Label | Noto Sans KR | 10px | 700 | 배지·태그 (uppercase) |
| Number | Outfit | 22px | 700 | KPI·점수 숫자 |
| Code | Courier New / mono | 13px | 400 | 코드 블록 |

**폰트 로드 (`frontend/app/layout.tsx`)**

```tsx
import { Noto_Sans_KR, Outfit } from 'next/font/google';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-ko',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-en',
});
```

### 2.3 간격 및 반경

| 토큰 | 값 | 사용처 |
|------|----|--------|
| `--r` | `10px` | 기본 카드 border-radius |
| `--r-lg` | `14px` | 대형 카드 border-radius |
| `--r-xl` | `20px` | 히어로 영역 |
| 섹션 패딩 | `48~72px 28px` | 각 section 요소 |
| 카드 패딩 | `22~28px` | .card 내부 |
| 컴포넌트 gap | `13~16px` | grid gap |
| 최대 너비 | `1020px` | 본문 max-width |

---

## 3. 컴포넌트 명세

---

### 3.1 NavBar

**파일** `frontend/components/layout/NavBar.tsx`

페이지 최상단 고정 네비게이션 바.

```tsx
<nav className="
  sticky top-0 z-50
  flex items-center justify-between
  h-14 px-7
  bg-[rgba(247,247,245,0.94)] backdrop-blur-md
  border-b border-[#E8E8E4]
">
  <Logo />        {/* AEOlab — "lab" 부분 --blue 처리 */}
  <NavLinks />    {/* 서비스 / 요금제 / FAQ */}
  <NavCTA />      {/* "무료 진단 시작" */}
</nav>
```

| 요소 | 스펙 |
|------|------|
| 높이 | `56px` |
| 배경 | `rgba(247,247,245, 0.94)` + `backdrop-filter: blur(16px)` |
| 보더 | `border-bottom: 1px solid var(--border)` |
| 로고 | Outfit 17px Bold — `AEO` ink + `lab` blue |
| 링크 | 13px / `--ink3` / hover → `--ink` |
| CTA 버튼 | `--ink` 배경 / `--white` 텍스트 / `border-radius: 8px` / `padding: 8px 16px` |

---

### 3.2 HeroSection

**파일** `frontend/components/landing/HeroSection.tsx`

랜딩페이지의 핵심 영역. 좌측 헤드라인+업종타일, 우측 진단폼+결과 패널.

```tsx
<section className="bg-white border-b border-[#E8E8E4] py-[60px] px-7">
  <div className="max-w-[1020px] mx-auto grid grid-cols-[1fr_380px] gap-[56px] items-center">
    <HeroLeft />   {/* Eyebrow + 타이틀 + 업종타일 + KPI */}
    <HeroRight />  {/* DiagnosisForm + 결과 패널 */}
  </div>
</section>
```

**왼쪽 영역 구성**

| 요소 | 스펙 |
|------|------|
| Eyebrow 배지 | `--blue-pale` 배경 / `--blue` 텍스트 / `border-radius: 20px` / 애니메이션 dot |
| Hero 타이틀 | `34px` / `700` / `letter-spacing: -1.2px` / `line-height: 1.25` |
| 타이틀 강조 | `"먼저 추천하는 가게"` → `color: --blue` |
| 서브텍스트 | `14px` / `--ink3` / `line-height: 1.75` / `max-width: 440px` |
| 업종 타일 | `flex wrap` / `gap: 7px` (아래 §3.3 참조) |
| KPI 지표 | Outfit `20px` Bold / `--ink` / 디바이더로 3개 분리 |

**KPI 데이터**

| 수치 | 레이블 |
|------|--------|
| `+27.4%` | AI브리핑 후 클릭률 |
| `2,293만` | ChatGPT 한국 MAU |
| `9,900원` | 월 최저 요금 |

---

### 3.3 HeroIndustryTiles

**파일** `frontend/components/landing/HeroIndustryTiles.tsx`

> 현재 랜딩의 핵심 강점 — 그대로 유지

업종 타일 클릭 시 ① 타일 active 스타일 ② 진단폼 select 자동 연동 ③ 결과 카드 데이터 업데이트를 동시 처리합니다.

```tsx
const TILES = [
  { key: 'cafe',   label: '☕ 카페·음식점', status: 'ok'   },
  { key: 'stay',   label: '🏨 숙박업소',    status: 'ok'   },
  { key: 'beauty', label: '✂ 미용·뷰티',   status: 'soon' },
  { key: 'clinic', label: '🏥 병원·한의원', status: 'no'   },
  { key: 'edu',    label: '📚 학원·교육',   status: 'no'   },
  { key: 'legal',  label: '⚖ 법률·세무',   status: 'no'   },
];
```

| status | Dot 색상 | 네이버 AI 브리핑 | 배너 타입 |
|--------|----------|------------------|-----------|
| `ok` | `#00B96B` (green) | 정식 적용 | green |
| `soon` | `#F59E0B` (amber) | 확대 중 | amber |
| `no` | `#F43F5E` (red) | 미적용 | red |

**타일 스타일**

```css
/* 기본 */
.tile {
  padding: 6px 13px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--white);
  color: var(--ink3);
  cursor: pointer;
}

/* active (선택됨) */
.tile.sel {
  background: var(--ink);
  color: var(--white);
  border-color: var(--ink);
}
```

---

### 3.4 DiagnosisForm

**파일** `frontend/components/landing/DiagnosisForm.tsx`

히어로 우측 상단에 위치하는 무료 진단 입력 카드.

```tsx
<div className="bg-[#F7F7F5] border border-[#E8E8E4] rounded-[14px] p-[18px]">
  <FormHeader />    {/* "무료 AI 노출 진단" 레이블 + "무료" 배지 */}
  <FormFields />    {/* 업종 select + 지역 input — 2컬럼 grid */}
  <RunButton />     {/* "AI 노출 현황 진단하기 →" */}
  <FormHint />      {/* "🔒 가입 없이 · 카드 없이 · 즉시 결과" */}
</div>
```

**입력 유효성 검사**

```tsx
// 지역 미입력 시
if (!region.trim()) {
  setRegionError(true);           // border-color: var(--red)
  regionInputRef.current?.focus();
  setTimeout(() => setRegionError(false), 1200);
  return;
}
```

**버튼 hover 처리**

```css
.diag-run:hover { background: var(--blue); }
/* 기본: var(--ink) → hover: var(--blue) */
```

---

### 3.5 PanelLoading

**파일** `frontend/components/landing/PanelLoading.tsx`

진단 버튼 클릭 후 표시되는 4단계 로딩 패널.

```
상태 전이:
idle (점선 박스) → loading (스텝 애니메이션) → result (결과 카드)
                                                  ↑ 350ms 딜레이
```

**4단계 스텝 및 타이밍**

| 단계 | 메시지 | 시작 | 종료 |
|------|--------|------|------|
| 1 | 네이버 AI 브리핑 스캔 | 0ms | 680ms |
| 2 | ChatGPT 노출 확인 | 680ms | 1,360ms |
| 3 | 경쟁 가게 비교 분석 | 1,360ms | 2,040ms |
| 4 | 키워드 갭 도출 | 2,040ms | 2,720ms |
| — | 결과 카드 표시 | 2,720ms + 350ms | — |

**스텝 색상 상태**

```css
.ss          { color: var(--ink4); }  /* 대기 */
.ss.active   { color: var(--blue); } /* 진행 중 — dot animation: pulse */
.ss.done     { color: var(--green);} /* 완료 */
```

---

### 3.6 PanelResult (DualTrackCard)

**파일** `frontend/components/landing/PanelResult.tsx`

> 현재 랜딩의 DualTrackCard 구조를 히어로 결과 패널에 통합

진단 완료 후 표시되는 결과 카드. 상단→하단 순서로 구성됩니다.

```
헤더 (--ink 배경)
├── 사업장 정보 + 네이버 배지
├── DualTrack 점수 카드 (Track1 | Track2)
├── 경쟁사 가로 바 차트
├── 성장단계 배지
├── 키워드 갭 태그
└── CTA 버튼
```

**네이버 배지 분기**

```tsx
const NAVER_BADGE = {
  ok:   { label: 'AI브리핑 ✓',  bg: '--green-pale', text: '#065F46' },
  soon: { label: '확대 중 △',   bg: '--amber-pale', text: '#92400E' },
  no:   { label: '네이버 미적용', bg: '--red-pale',   text: '#9F1239' },
};
```

**DualTrack 점수 카드**

```tsx
/* Track 1 — 네이버 */
<div className="bg-[#EEF4FF] border border-[#C5D8FF] rounded-[10px] p-[10px_12px]">
  <span className="text-[9px] font-bold text-[--blue] uppercase tracking-[.5px]">
    Track 1 · 네이버
  </span>
  <div className="font-[Outfit] text-[22px] font-bold text-[--blue]">{t1}</div>
  <div className="text-[10px] text-[--ink4]">AI 브리핑 노출도</div>
  <span className="text-[10px] font-semibold bg-[--blue-mid] text-[--blue-d] px-2 py-[2px] rounded-full">
    {rank1}
  </span>
</div>

/* Track 2 — 글로벌 AI */
<div className="bg-[--bg] border border-[--border] rounded-[10px] p-[10px_12px]">
  <span className="text-[9px] font-bold text-[--ink3] uppercase">Track 2 · 글로벌 AI</span>
  <div className="font-[Outfit] text-[22px] font-bold text-[--ink2]">{t2}</div>
  <div className="text-[10px] text-[--ink4]">ChatGPT/Gemini</div>
  <span className="text-[10px] font-semibold bg-[--border] text-[--ink3] px-2 py-[2px] rounded-full">
    {rank2}
  </span>
</div>
```

**성장단계 배지 분기**

| 아이콘 | 단계명 | 조건 (Track1 기준) |
|--------|--------|-------------------|
| 🌱 | 생존 단계 | Track1 < 40 또는 미적용 업종 |
| ⚔ | 경쟁 우위 단계 | 40 ≤ Track1 < 65 |
| 🗺 | 개선 로드맵 단계 | 65 ≤ Track1 < 80 |
| 🔮 | 선도 단계 | Track1 ≥ 80 |

**키워드 태그 색상**

```tsx
/* 누락 키워드 — amber 박스 (현재 랜딩 핵심 강점 유지) */
<span className="bg-[--amber-pale] text-[#92400E] text-[10px] font-semibold px-[10px] py-[3px] rounded-full">
  ✗ 주차 가능
</span>

/* 보유 키워드 */
<span className="bg-[--green-pale] text-[#065F46] text-[10px] font-semibold px-[10px] py-[3px] rounded-full">
  ✓ 아메리카노
</span>
```

---

### 3.7 IndustryBanner

**파일** `frontend/components/landing/IndustryBanner.tsx`

진단 완료 후 히어로 섹션 바로 아래 표시. 초기에는 `display: none`.

```tsx
// 진단 완료 시 노출
useEffect(() => {
  if (diagResult) setShowBanner(true);
}, [diagResult]);
```

**배너 색상 분기**

| type | background | border | text | 아이콘 |
|------|-----------|--------|------|--------|
| `ok` | `#E4F9EF` | `#A7F3D0` | `#065F46` | ✅ |
| `soon` | `#FEF3C7` | `#FDE68A` | `#92400E` | ⚠️ |
| `no` | `#FFF0F3` | `#FECACA` | `#9F1239` | ❌ |

**칩 스타일 (active 상태)**

```css
.ic       { border: 1px solid var(--border); color: var(--ink3); }
.ic:hover { border-color: var(--ink2); color: var(--ink); }
.ic.act   { background: var(--ink); color: var(--white); border-color: var(--ink); }
```

---

### 3.8 ProblemSection + SearchChangeSection

**파일** `frontend/components/landing/ProblemSection.tsx`

2컬럼 그리드로 나란히 배치. 좌측 문제 인식, 우측 검색 변화 비교.

```tsx
<div className="grid grid-cols-2 gap-4 mb-4">
  <ProblemSection />
  <SearchChangeSection />
</div>
```

**ProblemSection 아이콘**

| 문제 | 아이콘 | 배경 |
|------|--------|------|
| AI 미노출 | 🔍 | `--red-pale` |
| 광고비 무효 | 💸 | `--amber-pale` |
| 원인 불명 | 📊 | `--blue-pale` |

**SearchChangeSection 구조**

```
[기존 방식 박스] → [→ 화살표] → [AI 방식 박스]
  --bg 배경 회색            --ink 배경 다크
```

하단 `insight box`: `--blue-pale` 배경 / `#1A3A8F` 텍스트로 핵심 메시지 강조.

---

### 3.9 ChatGPTCompareSection

**파일** `frontend/components/landing/ChatGPTCompareSection.tsx`

> 현재 랜딩의 핵심 차별화 콘텐츠 — 그대로 유지

"무료 AI로 직접 하면 되지 않나요?" 섹션. 전체 폭 카드.

| 항목 | 무료 AI 직접 사용 | AEOlab 자동 분석 |
|------|-----------------|----------------|
| 추적 방식 | 매주 25번+ 수동 질문·기록 ✗ | 자동 수집 + 카카오톡 알림 ✓ |
| 신뢰도 | 같은 질문에 매번 다른 답 ✗ | 100회 샘플링 → 빈도 통계 ✓ |
| 객관성 | 개인화 결과 ≠ 실제 결과 ✗ | 객관적 노출 빈도 파악 ✓ |
| 원인 분석 | AI는 이유를 설명하지 않음 ✗ | 경쟁사 대비 격차 + 가이드 ✓ |

**컬럼 헤더 스타일**

```css
.cc-col h4        { border-bottom: 2px solid var(--border); color: var(--ink3); }
.cc-col.ours h4   { border-bottom: 2px solid var(--blue);   color: var(--blue); }
```

---

### 3.10 AEOCompareSection

**파일** `frontend/components/landing/AEOCompareSection.tsx`

3컬럼 비교 카드. AEOlab 카드만 `--ink` 보더 + 그림자 강조.

```tsx
<div className="grid grid-cols-3 gap-[13px]">
  <CompareCard type="seo"    />  {/* 기존 SEO */}
  <CompareCard type="naver"  />  {/* 네이버 플레이스 */}
  <CompareCard type="aeo" featured />  {/* AEOlab ★ */}
</div>
```

**featured 카드 스타일**

```css
.aeo-card.featured {
  border: 1.5px solid var(--ink);
  box-shadow: 0 0 0 3px rgba(26, 107, 255, 0.07), var(--shadow);
}
```

**비교 데이터**

| 기능 | 기존 SEO | 네이버 플레이스 | AEOlab |
|------|---------|--------------|--------|
| AI 추천 최적화 | ✗ | ✗ | ✓ |
| AI 브리핑 키워드 갭 | ✗ | ✗ | ✓ |
| 경쟁사 AI 비교 | ✗ | ✗ | ✓ |
| 주간 자동 추적 | ✗ | ✗ | ✓ |
| 키워드 순위 추적 | ✓ | ✗ | ✓ |
| 리뷰·별점 관리 | ✗ | ✓ | ✓ |
| 효과 체감 | 수개월 | 수주 | **수일~2주** |

---

### 3.11 HowItWorksSection + DashboardPreview

**파일** `frontend/components/landing/HowItWorksSection.tsx`

2컬럼 그리드. 좌측 3단계, 우측 미니 대시보드.

```tsx
<div className="grid grid-cols-[1fr_1.15fr] gap-4 mb-4">
  <HowItWorksSection />
  <DashboardPreview />
</div>
```

**3단계 내용**

| # | 제목 | 설명 | 태그 |
|---|------|------|------|
| 1 | 가게 현황 진단 | 6개 AI에서 내 가게 노출 자동 스캔 | `100회 샘플링` `6개 AI 동시` |
| 2 | 경쟁사 갭 분석 | 누락 키워드·부족 정보 자동 발굴 | `키워드 갭` `경쟁사 비교` |
| 3 | 맞춤 개선 가이드 | Claude AI 작성 → 스마트플레이스 즉시 적용 | `자동 생성` `즉시 적용` |

**DashboardPreview 구성**

```
카카오 알림 미리보기 (--amber #FAE100 배경 말풍선)
  └── 현재 랜딩 핵심 강점 — 유지
점수 3개: 네이버 AI (파랑) / ChatGPT (보라) / 업종 내 순위 (앰버)
경쟁사 가로 바 차트
키워드 갭 태그 (amber: 누락, green: 보유)
```

**카카오 알림 5가지 유형 (주간 rotation)**

| 유형 | 예시 | 이탈 방어 효과 |
|------|------|--------------|
| 점수 변화 | 이번 주 AI 노출: 23% → 31% (↑8%p) | 성장 확인으로 유지 동기 |
| AI 인용 실증 | ChatGPT가 내 가게를 3번 언급 | 직접 체감 강화 |
| 경쟁사 변화 | 경쟁 가게 ○○이 AI 순위 2계단 상승 | 경쟁 심리 재접속 유도 |
| 시장 뉴스 | 네이버 AI탭 상반기 전체 확대 예정 | 서비스 관련성 유지 |
| 할 일 목록 | 이번 달: 메뉴 설명에 주차 가능 추가 | 점수 미변화 시 이탈 방어 |

---

### 3.12 PriceAnchorSection

**파일** `frontend/components/landing/PriceAnchorSection.tsx`

> 현재 랜딩의 핵심 가격 앵커 — 독립 컴포넌트로 분리

```tsx
<div className="grid grid-cols-3 items-center gap-4 bg-white border rounded-[14px] p-[18px_22px]">
  <PriceItem
    label="네이버 키워드 광고"
    value="월 90만원+"
    sub="광고 끄면 즉시 사라짐"
  />
  <span className="text-[18px] font-bold text-[#D0D0CA] text-center">vs</span>
  <PriceItem
    label="AEOlab Basic"
    value="월 9,900원"
    sub="AI 최적화는 계속 남음"
    highlight  /* color: var(--green) */
  />
</div>
```

---

### 3.13 PricingSection

**파일** `frontend/components/landing/PricingSection.tsx`

3컬럼 요금제 카드.

| 플랜 | 가격 | 대상 | 강조 처리 |
|------|------|------|-----------|
| FREE | 0원 | 신규 유입·체험 | 없음 |
| **BASIC** | 9,900원/월 | 소상공인 | `--ink` 보더 + "가장 많이 선택" 배지 |
| PRO | 22,900원/월 | 마케터·컨설턴트 | 없음 |

```css
/* BASIC 강조 */
.pc.pop {
  border: 1.5px solid var(--ink);
  box-shadow: 0 0 0 3px rgba(26,107,255,.06), var(--shadow);
}
```

**버튼 스타일**

```css
.pb.ol { /* 일반 플랜 */
  background: var(--white);
  color: var(--ink);
  border: 1.5px solid var(--border2);
}
.pb.ol:hover { border-color: var(--ink); }

.pb.fl { /* BASIC 강조 */
  background: var(--ink);
  color: var(--white);
}
.pb.fl:hover { background: #222; }
```

---

### 3.14 FAQSection

**파일** `frontend/components/landing/FAQSection.tsx`

아코디언 FAQ. 배경 `--bg`로 섹션 구분.

**FAQ 항목 (우선순위 순)**

| # | 질문 | 목적 |
|---|------|------|
| 1 | 스마트플레이스 관리랑 다른 서비스인가요? | 서비스 포지셔닝 |
| 2 | 병원·학원·법률은 네이버 AI 브리핑 대상이 아닌가요? | 미적용 업종 해소 |
| 3 | IT를 잘 모르는 사장님도 쓸 수 있나요? | 진입 장벽 제거 |
| 4 | 효과는 얼마나 걸리나요? | 기대치 설정 |

```tsx
const [openIndex, setOpenIndex] = useState<number | null>(null);

const toggle = (i: number) =>
  setOpenIndex(prev => (prev === i ? null : i));
```

---

### 3.15 FinalCTA

**파일** `frontend/components/landing/FinalCTA.tsx`

```
배경: var(--ink) (풀 다크)
패딩: 64px 28px
텍스트 정렬: center
```

| 요소 | 스펙 |
|------|------|
| 제목 | 24px Bold White / `letter-spacing: -.6px` |
| 서브 | 13px / `rgba(255,255,255,.45)` |
| 주요 버튼 | `--white` 배경 / `--ink` 텍스트 |
| 보조 버튼 | `transparent` / `rgba(255,255,255,.2)` 보더 |
| 하단 주석 | 10px / `rgba(255,255,255,.22)` |

---

## 4. 업종별 데이터 명세

### 4.1 IndustryData TypeScript 타입

```typescript
// frontend/lib/industryData.ts

interface IndustryData {
  btype:   'ok' | 'soon' | 'no';  // 네이버 AI 브리핑 적용 여부
  badge:   string;                  // 배지 레이블
  t1:      number;                  // Track1 (네이버) 점수 0~100, 미적용 시 0
  t2:      number;                  // Track2 (글로벌 AI) 점수 0~100
  r1:      string;                  // Track1 업종 내 순위 ("업종 4위")
  r2:      string;                  // Track2 업종 내 순위
  growth:  string;                  // 성장단계 이모지
  gtxt:    string;                  // 성장단계 제목
  gsub:    string;                  // 성장단계 설명
  c1:      string;                  // 경쟁사 1위 이름
  c2:      string;                  // 경쟁사 2위 이름
  kwl:     string;                  // 키워드 갭 레이블
  kws:     React.ReactNode;         // 키워드 태그 렌더링
  dc1:     string;                  // 대시보드용 경쟁사 1위
  dc2:     string;                  // 대시보드용 경쟁사 2위
  dc3:     string;                  // 대시보드용 경쟁사 3위
  dkws:    React.ReactNode;         // 대시보드용 키워드 태그
  ib_type: 'ok' | 'soon' | 'no';  // 배너 타입
  ib:      React.ReactNode;         // 배너 내용
  kkmsg:   string;                  // 카카오 알림 메시지
}

export const INDUSTRY_DATA: Record<string, IndustryData> = { ... };
```

### 4.2 업종별 핵심 데이터

| key | btype | Track1 | Track2 | 성장단계 | 경쟁사 1위 | 카카오 알림 키워드 |
|-----|-------|--------|--------|---------|----------|----------------|
| `cafe` | ok | 38 | 22 | 🌱 생존 | 스타벅스 강남 | 주차 가능·단체석·반려동물 |
| `stay` | ok | 52 | 19 | ⚔ 경쟁우위 | 파라다이스호텔 | 조식 포함·키즈풀 |
| `beauty` | soon | 0 | 31 | 🌱 생존 | 준오헤어 | 헤어 컬러·펌 전문 |
| `clinic` | no | 0 | 44 | ⚔ 경쟁우위 | 강남세브란스 | 비수술 치료·도수치료 |
| `edu` | no | 0 | 38 | 🌱 생존 | 청담어학원 | 원어민 강사·토플 대비 |
| `legal` | no | 0 | 55 | 🗺 개선로드맵 | 삼일회계법인 | 개인사업자·절세 전략 |

> **주의** Track1 미적용 업종(`beauty`, `clinic`, `edu`, `legal`)은 점수 `0`으로 저장하고 UI에서 `"미적용"` 레이블 표시. 실제 서비스에서는 API 응답값으로 대체.

---

## 5. 파일 구조 및 구현 가이드

### 5.1 디렉토리 구조

```
frontend/
├── app/
│   ├── globals.css                   # CSS 변수 토큰 선언
│   ├── layout.tsx                    # 폰트 로드 (Noto Sans KR + Outfit)
│   ├── page.tsx                      # 랜딩페이지 루트
│   └── (public)/
│       └── faq/
│           └── page.tsx              # /faq 독립 페이지 + JSON-LD (미구현)
├── components/
│   ├── layout/
│   │   ├── NavBar.tsx
│   │   └── Footer.tsx
│   └── landing/
│       ├── HeroSection.tsx           # 히어로 전체 통합
│       ├── HeroIndustryTiles.tsx     # 업종 타일 (현재 랜딩 유지)
│       ├── DiagnosisForm.tsx         # 진단 입력 카드
│       ├── PanelIdle.tsx             # 대기 패널
│       ├── PanelLoading.tsx          # 로딩 4단계
│       ├── PanelResult.tsx           # 결과 카드 (DualTrackCard)
│       ├── IndustryBanner.tsx        # 업종별 네이버 배너
│       ├── ProblemSection.tsx
│       ├── SearchChangeSection.tsx
│       ├── ChatGPTCompareSection.tsx
│       ├── AEOCompareSection.tsx
│       ├── HowItWorksSection.tsx     # 3단계 설명
│       ├── DashboardPreview.tsx      # 미니 대시보드 + 카카오 알림
│       ├── PriceAnchorSection.tsx    # 광고비 vs AEOlab 비교
│       ├── PricingSection.tsx
│       ├── FAQSection.tsx
│       └── FinalCTA.tsx
├── lib/
│   ├── industryData.ts               # IndustryData 객체 (업종별)
│   └── analytics.ts                  # GA4 이벤트 헬퍼
└── styles/
    └── tokens.css                    # 디자인 토큰 (선택)
```

### 5.2 page.tsx 섹션 조합 순서

```tsx
// frontend/app/page.tsx
export default function LandingPage() {
  return (
    <>
      <NavBar />

      {/* ① 히어로: 타이틀 + 업종타일 + 진단폼 */}
      <HeroSection />

      {/* ② 진단 완료 후 노출 — 초기 hidden */}
      <IndustryBanner />

      <main className="bg-[#F7F7F5] px-7">
        <div className="max-w-[1020px] mx-auto py-12">

          {/* ③ 문제 인식 + 검색 변화 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <ProblemSection />
            <SearchChangeSection />
          </div>

          {/* ④ ChatGPT 직접 비교 — 전체 폭 */}
          <ChatGPTCompareSection />

          {/* ⑤ AEO vs SEO vs 플레이스 — 3컬럼 */}
          <AEOCompareSection />

          {/* ⑥ 3단계 + 대시보드 */}
          <div className="grid grid-cols-[1fr_1.15fr] gap-4 mb-4">
            <HowItWorksSection />
            <DashboardPreview />
          </div>

          {/* ⑦ 가격 앵커 */}
          <PriceAnchorSection />

        </div>
      </main>

      {/* ⑧ 요금제 */}
      <PricingSection />

      {/* ⑨ FAQ */}
      <FAQSection />

      {/* ⑩ 최종 CTA */}
      <FinalCTA />

      <Footer />
    </>
  );
}
```

### 5.3 GA4 이벤트 명세

```typescript
// frontend/lib/analytics.ts
// 측정 ID: G-KCZTWYK7QV

export const trackEvents = {
  trialStart:          (industry: string, region: string) => void,
  trialResultShown:    (industry: string, t1: number, t2: number) => void,
  ctaClick:            (location: string, buttonText: string) => void,
  industryTileClick:   (industry: string) => void,
  pricingClick:        (plan: string, price: number) => void,
  faqOpen:             (questionIndex: number) => void,
  kakaoShareClick:     () => void,
};
```

| 이벤트명 | 트리거 | 파라미터 |
|---------|--------|---------|
| `trial_start` | 진단 버튼 클릭 | `industry`, `region` |
| `trial_result_shown` | 결과 카드 표시 | `industry`, `t1_score`, `t2_score` |
| `cta_click` | CTA 버튼 클릭 | `location`, `button_text` |
| `industry_tile_click` | 업종 타일 클릭 | `industry` |
| `pricing_click` | 요금제 버튼 클릭 | `plan`, `price` |
| `faq_open` | FAQ 항목 열기 | `question_index` |
| `kakao_share_click` | 카카오 공유 클릭 | — |

### 5.4 Tailwind 커스텀 색상 (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#F7F7F5',
        ink:     '#0A0A0A',
        ink2:    '#2A2A2A',
        ink3:    '#6B6B6B',
        ink4:    '#ABABAB',
        border:  '#E8E8E4',
        border2: '#D0D0CA',
        blue:    { DEFAULT: '#1A6BFF', dark: '#0D4FD1', pale: '#EEF4FF', mid: '#C5D8FF' },
        green:   { DEFAULT: '#00B96B', pale: '#E4F9EF' },
        amber:   { DEFAULT: '#F59E0B', pale: '#FEF3C7' },
        red:     { DEFAULT: '#F43F5E', pale: '#FFF0F3' },
      },
      borderRadius: {
        r:    '10px',
        'r-lg': '14px',
        'r-xl': '20px',
      },
      fontFamily: {
        ko: ['Noto Sans KR', 'sans-serif'],
        en: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        sm:  '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)',
        md:  '0 4px 24px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 6. 잔여 개선 과제

> 출처: `docs/landing_improvement_plan_0425.md`

### P1 — 전환율 직접 영향 (즉시)

| 항목 | 파일 | 내용 | 예상 소요 |
|------|------|------|-----------|
| SearchChangeSection → 진단폼 앵커 | `SearchChangeSection.tsx` | 섹션 하단 `<a href="#diagnosis">` 스크롤 버튼 + `DiagnosisForm`에 `id="diagnosis"` 부여 | 30분 |

### P2 — SEO / 검색 노출 (단기)

| 항목 | 파일 | 내용 | 예상 소요 |
|------|------|------|-----------|
| `sitemap.ts` 생성 | `app/sitemap.ts` | `/`, `/pricing`, `/faq`, `/demo`, `/trial` 포함 | 30분 |
| `/faq` 독립 페이지 | `app/(public)/faq/page.tsx` | JSON-LD FAQPage 스키마 → 구글 리치 스니펫 노출 | 2~3시간 |

```typescript
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://aeolab.co.kr',         changeFrequency: 'weekly',  priority: 1   },
    { url: 'https://aeolab.co.kr/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://aeolab.co.kr/faq',     changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://aeolab.co.kr/demo',    changeFrequency: 'weekly',  priority: 0.8 },
    { url: 'https://aeolab.co.kr/trial',   changeFrequency: 'weekly',  priority: 0.9 },
  ];
}
```

### P3 — UX 개선 (단기)

| 항목 | 파일 | 변경 내용 | 소요 |
|------|------|----------|------|
| 샘플 카드 순환 속도 | `HeroSampleCard.tsx:183` | `3500` → `5000`ms | 5분 |
| 점수 바 평균선 레이블 | `PanelResult.tsx` | 수직선 위 `"평균"` 텍스트 `text-[10px] text-[--ink4]` | 20분 |
| Trial 10회 vs 100회 안내 | `trial/page.tsx` | 결과 상단 배너 `"이 결과는 빠른 테스트(10회) 기준입니다"` | 30분 |
| 가이드 생성 skeleton | `GuideClient.tsx` | 30초 로딩 중 skeleton 애니메이션 + 안내 문구 | 1시간 |
| 없는 키워드 → 가이드 파라미터 연결 | `PanelResult.tsx` | `/guide?keyword=xxx` 이동으로 변경 | 30분 |

### P4 — 사용자 직접 작업

| 항목 | 파일 | 방법 |
|------|------|------|
| 베타 후기 실제 데이터 교체 | `lib/testimonials.ts` | `isPlaceholder: true` → `false` + 실데이터 입력 후 Testimonials 섹션 자동 노출 |

---

## 7. 변경 이력

| 버전 | 날짜 | 주요 변경 내용 |
|------|------|--------------|
| **v1.0** | 2026-05-07 | 통합 디자인 문서 초판 — 화이트 기반 + 진단폼 히어로 통합 + 업종 분기 배너 + DualTrackCard |
| v2.1 | 2026-04-25 | 섹션 순서 재배치 / 히어로 폰트 확대 / FAQ 8개 확장 / 가격 앵커 단위 추가 |
| v2.0 | 2026-04-25 | HeroSampleCard 압축 / Lucide 아이콘 시스템 통일 / 업종 타일 클릭 인터랙션 |
| v1.1 | 2026-04-24 | "30초" 문구 전면 제거(11개) / MobileFloatingCTA / KakaoShareButton / GA4 이벤트 4종 |
| v1.0 | 2026-04-23 | 홈페이지 전면 개편 — page.tsx 1,021줄 → 264줄 / GA4 연동 시작 |

---

*© 2026 AEOlab. AI Engine Optimization Lab.*
*본 문서는 기밀입니다. 내부 개발 참조용으로만 사용하십시오.*
