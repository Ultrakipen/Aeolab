# 네이버 / 글로벌 AI 2그룹 UI 재편 v1.0

> 작성일: 2026-06-10 | 목적: 대시보드 스캔 결과 페이지 네이버·글로벌 정보 통합

---

## 배경

스캔 결과 페이지에 네이버 관련 정보가 4곳에 분산되어 있어 사용자가 "내 가게가 네이버에 어떻게 노출되는지"를 한 번에 파악하기 어려웠음.
- HeroCard (track1 점수, 브리핑 뱃지)
- ScanResultNavBar (독립 위치)
- "네이버 현황" CollapseSectionWrapper
- "소개글·톡톡 초안 생성" CollapseSectionWrapper (별도 섹션)

---

## 목표 구조

```
① HeroCard (통합 점수만)

② 🟢 네이버 현황 (기본 펼침)
   ├── ScanResultNavBar (4타일: 일반검색·AI탭·AI브리핑·경쟁현황)  ← 이동
   ├── IneligibleBusinessNotice (비해당 업종 안내, 조건부)         ← 이동
   ├── A. 🔍 일반검색 노출 (NaverSeoBaseCard + KeywordRankCard)    (기존)
   ├── B. 🤖 AI탭 노출 (상태 + AiTabPreviewCard)                  (기존)
   ├── C. ✨ AI브리핑 (AiInfoTabStatusCard)                        (기존)
   ├── D. 📝 네이버 소개글 생성기 (IntroGeneratorCard onlyType=naver) ← 신규
   └── E. 💬 톡톡 채팅방 메뉴 초안 (TalktalkFAQGeneratorCard)     ← 이동

③ 오늘 할 일 (기존)

④ 🌐 글로벌 AI 현황 (기존 섹션 확장)
   ├── GlobalAiFocusCard (기존)
   ├── SchemaCheckCard (기존)
   └── F. 📝 ChatGPT·Gemini 소개글 생성기 (IntroGeneratorCard onlyType=global) ← 신규

⑤ 상세 분석 데이터 (기존)
⑥ AI 채널 안내 (기존)

[삭제] "소개글·톡톡 초안 생성" 섹션 → D·E·F로 흡수
```

---

## 오판 점검 결과 (2026-06-10)

### 확인된 오판 1건 — IntroGeneratorCard 초기 state 분기 필요
- **문제**: `generated` state 초기값이 `useState<string>(currentIntro ?? "")` 로 하드코딩 → `onlyType="global"` 시 네이버 데이터로 초기화됨
- **수정**: `onlyType` 기반 초기값 분기 (`onlyType === "global"` 이면 `globalCurrentIntro`, `localGeneratedAt` 도 동일 분기)
- **반증**: `onlyType` prop이 없으면 기존 동작 완전 보존 (기본값 `undefined`)

### 오판 없음 확인 항목
| 항목 | 근거 |
|------|------|
| `section-generator` 외부 참조 없음 | grep 결과: page.tsx + GeneratorZone.tsx 2곳만 |
| TalktalkFAQGeneratorCard props | page.tsx에 `planLabel`, `planFaqLimit`, `talktalk_faq_draft`, `talktalk_faq_generated_at` 모두 존재 |
| DashboardGlobalAiZone 서버→클라이언트 import | Next.js 허용, props만 추가 |
| ScanResultNavBar scrollTarget | section-detail은 섹션 외부라 스크롤 정상 동작 |
| naver-seo-anchor 등 앵커 | InsightZone 내부에 존재, 섹션 펼침 상태에서 내부 스크롤 유효 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `components/dashboard/IntroGeneratorCard.tsx` | `onlyType?: "naver" \| "global"` prop 추가, 초기 state 분기 |
| `app/(dashboard)/dashboard/sections/DashboardInsightZone.tsx` | D·E 항목 추가, props 5개 추가 |
| `app/(dashboard)/dashboard/sections/DashboardGlobalAiZone.tsx` | F 항목 추가, props 4개 추가 |
| `app/(dashboard)/dashboard/page.tsx` | NavBar·Notice 위치 이동, props 전달, GeneratorZone 섹션 제거 |

### 삭제 (import 제거)
- `DashboardGeneratorZone` — 내용이 D·E·F로 분산 흡수됨 (파일은 보존, import만 제거)

---

## 신규 props 전달 경로

### DashboardInsightZone 추가 props
```
page.tsx → DashboardInsightZone
- planLabel: string           (page.tsx:82)
- planFaqLimit: number        (page.tsx:83)
- naverIntroDraft             (business?.naver_intro_draft)
- naverIntroGeneratedAt       (business?.naver_intro_generated_at)
- talktalkFaqDraft            (business?.talktalk_faq_draft)
- talktalkFaqGeneratedAt      (business?.talktalk_faq_generated_at)
```

### DashboardGlobalAiZone 추가 props
```
page.tsx → DashboardGlobalAiZone
- bizId: string               (bizBase.id)
- planLabel: string           (page.tsx:82)
- planFaqLimit: number        (page.tsx:83)
- globalIntroDraft            (business?.global_intro_draft)
- globalIntroGeneratedAt      (business?.global_intro_generated_at)
```
