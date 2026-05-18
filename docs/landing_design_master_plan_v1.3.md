# AEOlab 랜딩페이지 마스터 디자인 계획서 v1.4

**작성일** 2026-05-08 | **최종 수정** 2026-05-08 v1.4 | **기반** 디자인 연구 v2.0 + 스크롤 UX 분석 + 토스/카카오 벤치마크

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-08 | 최초 작성 + /autoplan 검토 결과 통합 |
| v1.1 | 2026-05-08 | 코드 점검 후 오류 6건 수정 (폰트 전제 오류, StepHighlighter RSC 충돌, 옵저버 미확장, border 충돌, 섹션 수 불일치, /autoplan false positive 정리) |
| v1.2 | 2026-05-08 | 검증 후 미수정 오류 5건 수정 (formRef→regionRef, PanelError API 전제 누락, count-reveal forwards→both, 체크리스트 비교섹션 오류, TD-1 모바일 스펙 미반영) |
| v1.3 | 2026-05-08 | 2차 검증 후 오류 4건 수정 (§4 폰트 오기 잔재, handleIndustrySelect→handleTileClick, outfit 제거 지침 누락, 배포 cd 경로 누락) + §6.3 data-step 스코프 개선 |
| v1.4 | 2026-05-08 | 3차 검증 후 오류 4건 수정 + 개선 9건 반영 (useState(0)→(1) 초기값 버그, SVG connectorRef 스코프 제한, 배포 빌드 실패 감지, 마일스톤 번호 중복 정리, TREND_POINTS Phase 1 포함, glass-card CSS 삭제 명시, body.js-anim 추가 위치, threshold 0.5→0.3, 아코디언 useState 방식 결정, prefers-reduced-motion, HeroSection 분리 전략, Phase 2 API 매핑 설계 요건, SSH 검증 절차 포함) |

---

## 0. 한 줄 목표

> 처음 접속한 소상공인이 스크롤 한 번 내릴 때마다 "아, 내 얘기네 → 이게 문제였구나 → 이렇게 해결되는구나 → 믿을 수 있겠다 → 지금 해봐야지"의 감정 흐름을 자연스럽게 느끼게 한다.

---

## 1. 현재 구조의 핵심 문제: 섹션이 쌓인 게 아니라 "슬라이드가 쌓였다"

### 1.1 현재 12섹션 흐름 문제 진단

```
현재 흐름:
[히어로] → [WHY] → [AI브리핑 3단계] → [ChatGPT비교] → [AEO비교]
→ [HOW 3단계] → [대시보드] → [서비스원리] → [신뢰데이터]
→ [가격앵커] → [FAQ] → [Final CTA]
```

| 위치 | 문제 |
|------|------|
| 섹션 3 vs 섹션 6 | 둘 다 "3단계" 카드 레이아웃, 시각적으로 똑같이 생겨서 사용자가 "이거 또야?" 느낌 |
| 섹션 4 vs 섹션 5 | 비교 표 → 비교 카드 연속 배치, "비교 피로감" 발생 |
| 섹션 7 vs 섹션 8 | 대시보드 미리보기 + 서비스 원리 섹션이 비슷한 내용 중복 |
| 섹션 9 신뢰데이터 | 신뢰 데이터가 비교 섹션 뒤에 와서 "설득 → 증거" 순서가 역전됨 |

**결론: 순서가 잘못됐고, 중복이 있다.**

---

## 2. 스크롤 스토리텔링 원칙

### 2.1 감정 흐름 설계 (5막 구조)

```
막 1 — 인식 (Recognition): "이게 나 얘기네"
막 2 — 공감 (Pain): "맞아, 이게 문제였어"
막 3 — 이해 (Clarity): "이렇게 작동하는구나"
막 4 — 신뢰 (Proof): "효과가 있는 거야?"
막 5 — 행동 (Action): "지금 해봐야지"
```

각 "막"은 최대 2개 섹션으로 구성. 한 화면에서 한 가지 메시지만 전달.

### 2.2 스크롤 행동 패턴 (소상공인 타깃)

모바일 비율이 높은 소상공인 타깃의 스크롤 패턴:
- 첫 화면에서 3초 내 이탈 여부 결정
- 텍스트보다 **시각적 비교(이미지, 차트)**에서 멈춤
- 숫자(금액, %)에서 멈춤
- 한 섹션이 화면 2개 이상이면 건너뜀

**따라서**: 각 섹션은 모바일 기준 화면 1~1.5개 이내여야 한다.

---

## 3. 새 섹션 구조 (12 → 10개, 30% 압축)

```
[기존 12] → [새 10]

기존: 히어로/WHY/AI브리핑3단계/ChatGPT비교/AEO비교/HOW3단계/대시보드/서비스원리/신뢰데이터/가격앵커/FAQ/CTA
새:   히어로/WHY/신뢰데이터/작동원리/AEOlab3단계+대시보드/ChatGPT비교/AEO비교/가격앵커/FAQ/CTA
```
> v1.1 수정: 요약 텍스트를 10개 항목 기준으로 교정 (비교 섹션 2개 분리 명시)

### 3.1 새 섹션 순서와 목적

| # | 섹션명 | 감정 막 | 핵심 메시지 한 줄 | 배경 |
|---|--------|--------|-----------------|------|
| 1 | **HERO** | 인식 | "내 가게가 AI에 어떻게 노출되는지 지금 확인하세요" | 연파랑→흰 |
| 2 | **WHY** | 공감 | "광고는 끄면 사라지지만 AI 브리핑은 남습니다" | 흰색 |
| 3 | **PROOF** (신뢰 먼저) | 공감 강화 | "+27.4% — 이건 네이버 공식 숫자입니다" | 흰색 |
| 4 | **HOW CUSTOMERS** | 이해 1단계 | "손님이 어떻게 AI로 가게를 발견하나요?" | 연회색 |
| 5 | **HOW AEOLAB** | 이해 2단계 | "AEOlab이 3단계로 도와드립니다 + 대시보드" | 흰색 |
| 6 | **WHY NOT DIY** | 신뢰 | "ChatGPT로 직접 하면 안 되나요?" | 연회색 |
| 7 | **vs OTHERS** | 신뢰 강화 | "기존 서비스와 무엇이 다른가요?" | 흰색 |
| 8 | **PRICE** | 행동 준비 | "네이버 광고비의 1/90" | 연파랑 |
| 9 | **FAQ** | 마지막 의문 | 자주 묻는 질문 4개 | 연회색 |
| 10 | **FINAL CTA** | 행동 | "지금 시작하세요" | 다크 그라디언트 |

> 제거/통합 섹션:
> - `ServiceMechanismSection` → PROOF 섹션에 핵심 수치만 흡수
> - `ChatGPTCompareSection` → WHY NOT DIY 섹션으로 재명명 (내용 유지)
> - `HowItWorksSection` → AEOLAB 3단계와 DashboardPreview 합치기

---

## 4. 섹션별 상세 설계

---

### 섹션 1. HERO — "인식"

**목적**: 3초 내 "이게 내 가게 얘기구나" 파악

**레이아웃 (PC 2열 / 모바일 단열)**:
```
왼쪽:                           오른쪽:
[배지: 네이버 AI 브리핑 (자동추천)] [진단 폼 카드 — 흰색]
[헤드라인 48~56px]               업종 선택됨 or "위에서 선택"
[KPI 3개] ← 헤드라인 직후 이동   지역 입력
[서브텍스트 15px]                [진단하기 →] 버튼
[업종 타일 7개]                  ──────────────
                                 [idle/loading/result/error 패널]
```
> KPI 위치 변경 이유: "+27.4%" 신뢰 수치가 첫 번째 메시지 직후 노출되어야 함.
> 배지에 "(자동추천)" 부연 추가 — AI 브리핑 모르는 사용자 대응.

**변경 핵심:**
- 배경: `linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)` ← 최대 변경
- 모든 텍스트: 흰색 → `#0F172A` (진한 슬레이트)
- 업종 타일: 어두운 배경용 스타일 → 밝은 배경용
- 진단 폼 카드: `glass-card` → 흰색 카드 + 보더 + 그림자
- 오브 글로우: 제거 (밝은 배경에서 어색)
- 폰트: **Outfit → Pretendard Variable** (§5.1 참조) ← v1.3 수정: v1.0~v1.2는 "Noto Sans KR → Pretendard"로 오기, 실제 교체 대상은 Outfit

**스크롤 애니메이션:**
- 왼쪽 요소: 페이지 로드 시 fade-in + slide-up (0.3s)
- 오른쪽 진단 카드: 왼쪽보다 0.15s 딜레이
- 업종 타일: 순차 등장 (각 0.05s 딜레이)

---

### 섹션 2. WHY — "공감"

**목적**: "맞아, 그동안 광고비만 썼는데 AI는 관리 안 했어" 공감

**현재 구조**: 광고(Before 빨간 카드) vs AI브리핑(After 파랑 카드) — 유지

**개선점**:
1. Before 카드에 "광고비 소진 UI" 추가로 더 생생하게
2. After 카드의 우상향 그래프선 두께/색상 강조
3. 두 카드 하단에 **한 줄 요약 배너** 추가:
   ```
   [AI 브리핑은 한 번 올라가면 광고 없이 유지됩니다]
   ```

**스크롤 애니메이션:**
- Before 카드: 왼쪽에서 slide-in (0.4s)
- After 카드: 오른쪽에서 slide-in (0.4s, 0.1s 딜레이)
- 두 카드 사이 "vs" 텍스트: fade-in 마지막

---

### 섹션 3. PROOF — "공감 강화 + 첫 번째 신뢰"

**목적**: "이게 진짜 효과 있다는 근거가 있어?"

**변경**: 현재 페이지 하단(섹션 9)에 있는 신뢰 데이터를 **앞으로 이동**

**레이아웃 (벤토 그리드 유지):**
```
[+27.4% 파랑 카드 — 2열 차지]  [3,000만+ 카드]
                                [15,000+ 카드]
                                [25종 카드]
```

**개선점**:
- 이 섹션에 **배경 전환 없이** 섹션 2(WHY)와 시각적 연속성 유지
- "+27.4%"는 숫자 자체가 Hero moment — 풀 너비로 더 크게
- 출처 링크 명확히 표시 (신뢰 필수)

**스크롤 애니메이션:**
- 큰 숫자 카드부터 fade-in (0.3s)
- 보조 카드 3개: 순차 0.1s 딜레이

---

### 섹션 4. HOW CUSTOMERS — "이해 1단계"

**목적**: "손님이 어떻게 AI를 통해 가게를 발견하나?" (손님 관점)

**현재**: `page.tsx` 섹션 3 (AI 브리핑 3단계) — 위치와 구조 유지

**핵심 개선**: 3카드의 **연결성** 강화
```
① 손님이 검색  →  ② AI 브리핑 노출  →  ③ 광고 없이 방문
     │                    │                    │
  [검색창 UI]       [AI 추천 목록 UI]      [가게 아이콘]
```

PC에서 카드 사이 **화살표 연결선** + 숫자 라벨이 더 크게

**스크롤 애니메이션:**
- 카드 3개 순차 등장: 0.1s / 0.2s / 0.3s 딜레이
- 연결 화살표: 카드 등장 후 선 그리기 animation (stroke-dashoffset)

---

### 섹션 5. HOW AEOLAB + DASHBOARD — "이해 2단계" 핵심 통합

**목적**: "AEOlab이 구체적으로 뭘 해주는지 + 실제 화면 미리보기"

**현재 문제**: HowItWorksSection(섹션 6)과 DashboardPreview(섹션 7)이 분리되어 있어서 "3단계 설명 → 그래서 대시보드가 뭐야?" 연결이 끊김

**새 구조:**
```
[섹션 헤더: "1분 진단 → 7일 변화"]

PC 레이아웃:
왼쪽 (3단계 설명)                    오른쪽 (대시보드 미리보기)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Step 1: 가게 입력 카드]              [카카오 알림 말풍선]
[Step 2: 분석 카드]         →        [Track1 점수 카드]
[Step 3: 추적 카드]                  [Track2 점수 카드]
                                     [7주 추세 그래프]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CTA: 지금 무료로 시작]
```

**스크롤 애니메이션 (이 섹션 핵심):**
- 왼쪽 Step 1 카드 등장 → 동시에 오른쪽 알림 카드 등장
- 스크롤 내리면 Step 2 → 분석 카드 highlight
- 스크롤 내리면 Step 3 → 추세 그래프 선 그리기 animation

**모바일 (TD-1 결정 반영 — 아코디언):**
> v1.2 수정: v1.1은 "Step 카드 3개 세로 배열 + 인터리브 방식"으로 기술했으나, TD-1에서 권장 A(아코디언)로 결정. §2.2 "2화면 이내" 규칙 준수 + 전체 스크롤 6카드 나열로 인한 규칙 위반 방지.
>
> **v1.4 수정: 아코디언 구현 방식 `useState` 로 결정** — `HowAeolabIntegrated`가 이미 `"use client"` Client Component이므로 추가 비용 없음. `<details>/<summary>`는 CSS-only로 구현 단순하나 열림/닫힘 애니메이션 제어가 어려워 제외.

```
모바일 아코디언 구조:
[Step 1 헤더 탭 ▼]   ← 기본 펼침
  └─ Step 1 설명 + 해당 결과 카드 (알림)
[Step 2 헤더 탭 ▶]
  └─ Step 2 설명 + 해당 결과 카드 (점수)
[Step 3 헤더 탭 ▶]
  └─ Step 3 설명 + 해당 결과 카드 (추세 그래프)
```

구현: `useState`로 열린 스텝 인덱스 관리 (Client Component 필수).  
구현 복잡도: PC 대비 +1시간.

---

### 섹션 6. WHY NOT DIY — "신뢰"

**현재**: `ChatGPTCompareSection` — 내용 유지, 타이틀만 개선

**헤드라인 개선**:
```
현재: "무료 AI로 직접 하면 되지 않나요?"
개선: "ChatGPT로 직접 해도 되지 않나요?"
      (더 구체적, 더 대화체)
```

**구조 유지**: 비교 테이블(PC) + 카드(모바일) 그대로

**추가**: 테이블 아래 한 줄 요약
```
[AEOlab은 이 과정을 자동화합니다 — 매주 알아서 측정, 카카오로 알림]
```

---

### 섹션 7. vs OTHERS — "신뢰 강화"

**현재**: `AEOCompareSection` — 3열 비교 카드

**현재 문제**: 3열 비교가 의미 있지만 "기존 SEO"와 "네이버 플레이스"에 대해 사용자가 잘 모를 수 있음

**개선**: 헤드라인을 더 직접적으로
```
현재: "기존 방법과 무엇이 다른가요?"
개선: "네이버 플레이스만 관리해도 될까요?"
```

**추가**: AEOlab 카드 하단 CTA를 더 강조
```
[무료로 시작하기 →] 버튼 → 더 크게, 배경색 더 진하게
```

---

### 섹션 8. PRICE — "행동 준비"

**현재**: `page.tsx` 가격 앵커 섹션 — 구조 유지

**개선점**:
1. 배경색 유지 (`#EFF6FF`)
2. "첫 달 4,950원" 배지 더 크게
3. 광고비 취소선 텍스트를 더 극적으로

```tsx
/* 현재 */
<p className="text-2xl md:text-3xl font-bold line-through">월 30~100만원+</p>

/* 개선 — 더 임팩트 있는 크기 */
<p className="text-3xl md:text-4xl font-black line-through">월 30~100만원+</p>
```

---

### 섹션 9. FAQ — "마지막 의문"

**현재**: `FAQSection` — 유지

**개선**: FAQ 아래 소프트 CTA 추가
```
[아직 망설이고 있다면, 1분 무료 진단은 회원가입 없이 바로 가능합니다]
```

---

### 섹션 10. FINAL CTA — "행동"

**현재**: 다크 그라디언트 — 유지 (유일한 어두운 섹션이어서 임팩트 있음)

**개선**: 서브텍스트 3개 배지를 아이콘 + 텍스트로 개선
```
현재: ✓ 가입 불필요  ✓ 카드 등록 없음  ✓ 1분 소요
개선: [자물쇠] 가입 불필요  [카드] 카드 없이  [시계] 1분 소요
```

---

## 5. 비주얼 디자인 변경 3가지 (최고 ROI)

### 5.1 폰트 교체 — Pretendard Variable (30분, 효과 ★★★★★)

> **v1.1 수정**: v1.0은 "Noto Sans KR → Pretendard"로 기술했으나 실제 프로젝트에 Noto Sans KR 없음. 실제 폰트 구성은 `Geist`(본문/UI) + `Geist_Mono`(코드) + `Outfit`(hero-headline, KPI 숫자). Pretendard는 **Outfit을 대체**하는 것이 정확한 교체 목표.

**현재 폰트 구성 (`layout.tsx` 실측)**:
```tsx
const geistSans  = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono  = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const outfit     = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" })
// globals.css:147: .hero-headline { font-family: "Outfit", sans-serif; }
// HeroSection.tsx KPI: fontFamily: "Outfit, sans-serif"
```

**교체 전략**: `Outfit` → `Pretendard Variable` (한글 헤드라인에 더 적합)  
`Geist`(대시보드 UI) + `Geist_Mono`(코드)는 **유지**.

**구현 전 필수 준비 (빌드 오류 방지):**
```bash
# 1. Pretendard Variable 폰트 다운로드 (1파일, 약 230KB gzip)
# https://github.com/orioncactus/pretendard/releases/latest
# → PretendardVariable.woff2 다운로드 → frontend/public/fonts/ 에 업로드

# 2. 파일 존재 확인 (없으면 next/font/local 빌드 시 오류)
ls frontend/public/fonts/PretendardVariable.woff2
```

```tsx
// frontend/app/layout.tsx 변경 3곳 — v1.3 수정: "추가"가 아닌 Outfit을 Pretendard로 교체

// ① L2: Outfit import 제거
// 변경 전
import { Geist, Geist_Mono, Outfit } from "next/font/google";
// 변경 후
import { Geist, Geist_Mono } from "next/font/google";
import localFont from 'next/font/local';

// ② L19-23: outfit 상수 → pretendard 상수로 교체
// 변경 전
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});
// 변경 후
const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',      // 필수: 없으면 CLS 발생
  weight: '100 900',    // Variable 폰트는 범위로 지정
});

// ③ L77: html className에서 outfit.variable → pretendard.variable 교체
// 변경 전
className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
// 변경 후
className={`${geistSans.variable} ${geistMono.variable} ${pretendard.variable} h-full antialiased`}
```
> outfit 제거 이유: Outfit을 그대로 두면 Google Fonts에서 계속 로딩됨 (불필요한 ~40KB 네트워크 요청 + TypeScript unused variable 경고)

```css
/* globals.css — Outfit 대체 */
/* 변경 전 */
.hero-headline { font-family: "Outfit", sans-serif; }
/* 변경 후 */
.hero-headline { font-family: var(--font-pretendard, "Pretendard Variable", "Pretendard", sans-serif); }
```

```tsx
// HeroSection.tsx KPI 숫자 인라인 스타일
/* 변경 전 */
fontFamily: "Outfit, sans-serif"
/* 변경 후 */
fontFamily: "var(--font-pretendard, 'Pretendard Variable', sans-serif)"
```

**폴백 체인**: `Pretendard Variable` → `Pretendard` → `sans-serif`  
(Noto Sans KR 폴백 불필요 — 프로젝트에 설치되지 않음)

**Pretendard가 Outfit보다 한국어에 유리한 이유**:
- 한글 자간이 타이트 → 헤드라인이 더 선명하게 읽힘
- 숫자 자형이 현대적 (Outfit과 유사 수준)
- Variable 폰트로 1파일에 모든 굵기 → 로딩 최적화
- 토스·카카오·무신사 등 한국 주요 IT 서비스 채택

---

### 5.2 히어로 배경 전환 (2~3시간, 효과 ★★★★★)

```tsx
// HeroSection.tsx:58~62 변경

// BEFORE:
style={{
  background: "linear-gradient(135deg, #080D1A 0%, #0D1526 50%, #15113A 100%)",
  borderColor: "rgba(255,255,255,0.06)",
}}

// AFTER:
style={{
  background: "linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 40%, #FFFFFF 100%)",
  borderColor: "#E2E8F0",
}}
```

함께 변경해야 할 항목들:

| 요소 | BEFORE | AFTER |
|------|--------|-------|
| `hero-headline` 색상 | `color: #F8FAFC` | `color: #0F172A` |
| 서브텍스트 | `color: #94A3B8` | `color: #475569` |
| 배지 배경 | `rgba(37,99,235,0.25)` | `#EFF6FF` |
| 배지 텍스트 | `#93C5FD` | `#2563EB` |
| 배지 보더 | `rgba(37,99,235,0.35)` | `#BFDBFE` |
| 업종 타일 기본 배경 | `rgba(255,255,255,0.06)` | `#FFFFFF` |
| 업종 타일 기본 보더 | `rgba(255,255,255,0.12)` | `#E2E8F0` |
| 업종 타일 텍스트 | `#CBD5E1` | `#475569` |
| KPI 구분선 | `rgba(255,255,255,0.10)` | `#E2E8F0` |
| KPI 숫자 | `highlight ? "#60A5FA" : "#F8FAFC"` | `highlight ? "#2563EB" : "#0F172A"` |
| KPI 레이블 | `#94A3B8` | `#64748B` |
| 진단 카드 클래스 | `glass-card` | `bg-white border shadow` |
| 진단 카드 배경 | `rgba(255,255,255,0.05)` | `#FFFFFF` |
| 진단 카드 보더 | `rgba(255,255,255,0.10)` | `#E2E8F0` |
| 지역 input 배경 | `rgba(255,255,255,0.06)` | `#F8FAFC` |
| 지역 input 색상 | `#F8FAFC` | `#0F172A` |
| 오브 효과 | 제거 또는 opacity 0.05로 축소 | — |
| 하단 페이드 | `#FFFFFF`로 페이드 유지 | 유지 |

> **v1.4 추가 — `glass-card` CSS 정의 삭제**: `HeroSection.tsx`에서 `glass-card` 클래스를 `bg-white border shadow`로 교체한 후, `globals.css`의 `.glass-card { }` 정의는 데드 코드가 됨. Phase 1 Step 2 완료 시 `globals.css`에서 해당 정의도 함께 삭제할 것 (grep 결과 외부 사용 0건 확인됨 — §9 Phase 1 Step 0b 참조).

---

### 5.3 PanelIdle / PanelResult / PanelError 밝은 버전 (1~2시간, 효과 ★★★★)

**패널 4가지 상태 (CLAUDE.md §7 에러 폴백 허위 수치 금지 정책 준수):**

> **v1.2 추가 — PanelError 구현 전제 조건**: 현재 `HeroSection.tsx`는 실제 API를 호출하지 않음. `INDUSTRY_DATA` 정적 Mock 데이터 + `setTimeout(3100ms)` 시뮬레이션 구조이므로 네트워크 오류가 발생할 경로가 없어 `PanelError`에 도달할 수 없음. **PanelError 상태가 실제로 트리거되려면 히어로 섹션이 `/api/scan/trial` 엔드포인트와 연결되어야 한다.** Phase 1에서 PanelError JSX만 추가하고, Phase 2에서 실제 API 호출로 전환할 때 비로소 동작 가능.

```tsx
// PanelIdle — 밝은 버전
// v1.1 수정: borderColor + border shorthand 중복 제거 (border shorthand가 borderColor를 덮어써서 borderColor 줄 무효)
// Tailwind `border` 클래스도 inline border에 패배하므로 제거
<div className="rounded-2xl overflow-hidden relative"
  style={{ 
    background: "#F8FAFC", 
    border: "1.5px dashed #BFDBFE"  // 파랑 점선 → 더 친근하게
  }}>

// PanelLoading — 유지 (스피너)

// PanelResult — 밝은 버전
// BEFORE: background: "#111827"
// AFTER:  background: "#FFFFFF"
// Track1 카드: background: "#EFF6FF", border: "1px solid #BFDBFE"
// Track2 카드: background: "#F8FAFC", border: "1px solid #E2E8F0"
// 텍스트: BEFORE #F8FAFC/#94A3B8 → AFTER #0F172A/#64748B
// 단, fallback 결과(업종 "기타") 시: "(추정)" 회색 배지 표시 필수

// PanelError — 신규 추가 (기존 없음, CLAUDE.md 정책 요구)
// Phase 1: JSX만 추가 (도달 불가, Phase 2 API 연결 후 동작)
// API 실패 / 네트워크 오류 / 결과 없음 케이스
<div className="rounded-2xl p-6 border text-center"
  style={{ background: "#FFF7F7", borderColor: "#FCA5A5" }}>
  <p className="text-sm text-red-600 font-medium">데이터를 불러오지 못했습니다</p>
  <p className="text-xs text-gray-500 mt-1">잠시 후 다시 시도해 주세요</p>
  <button className="mt-3 text-sm text-blue-600 underline">다시 시도</button>
</div>
```

**패널 상태 전환 로직:**
```
사용자 업종 선택 → PanelIdle(업종 표시)
↓ 진단하기 클릭
→ PanelLoading (스피너)
→ 성공: PanelResult (결과 + 추정 배지 조건부)
→ 실패: PanelError (재시도 버튼) ← Phase 2 API 연결 후 실제 동작
```

> **v1.4 추가 — HeroSection 컴포넌트 분리 전략 (선택)**: Phase 1 히어로 변경 범위(다크→라이트 전환 + PanelError 추가 + 스타일 전면 교체)가 크므로, `PanelIdle.tsx`, `PanelResult.tsx`, `PanelError.tsx`를 `components/landing/hero/` 하위 별도 파일로 분리하면 diff 리뷰와 Phase 2 API 연결 시 변경 범위를 좁힐 수 있음. 필수 아님(기존 단일 파일 유지도 가능). 분리 시 구현 +30분.

> **v1.4 추가 — Phase 2 API 매핑 설계 요건**: Phase 2 진입 전, `/api/scan/trial` 응답 필드(`track1_score`, `track2_score`, `keyword_gap`, `unified_score` 등)를 `PanelResult` 표시 항목에 어떻게 매핑할지 별도 설계가 필요함. Phase 2 시작 시 이 문서 §5.3에 매핑 테이블 추가 요망.

---

## 6. 스크롤 애니메이션 개선

### 6.1 현재 fade-up 개선

```css
/* globals.css 추가 */

/* 카드 순차 등장용 지연 유틸리티 — !important 제거 (tw-animate-css 충돌 방지) */
.delay-1 { animation-delay: 0.10s; }
.delay-2 { animation-delay: 0.20s; }
.delay-3 { animation-delay: 0.30s; }
.delay-4 { animation-delay: 0.40s; }

/* 좌→우 슬라이드인 (WHY 섹션 Before/After용) */
body.js-anim .slide-left {
  opacity: 0;
  transform: translateX(-24px);
  transition: opacity 0.55s cubic-bezier(.22,1,.36,1), transform 0.55s cubic-bezier(.22,1,.36,1);
}
body.js-anim .slide-right {
  opacity: 0;
  transform: translateX(24px);
  transition: opacity 0.55s cubic-bezier(.22,1,.36,1), transform 0.55s cubic-bezier(.22,1,.36,1);
}
.slide-left.visible, .slide-right.visible {
  opacity: 1 !important;
  transform: translateX(0) !important;
}

/* 숫자 카운트업 (PROOF 섹션용) */
@keyframes count-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.count-reveal {
  /* v1.2 수정: forwards → both
     이유: delay 클래스(.delay-1 등)와 함께 쓸 때 딜레이 동안 요소가
     animation 시작 전 상태(opacity:1)로 잠깐 flash됨.
     both = backwards(딜레이 중 from 상태 유지) + forwards(종료 후 to 상태 유지) */
  animation: count-up 0.6s cubic-bezier(.22,1,.36,1) both;
}

/* v1.4 추가 — 접근성: 모션 감소 설정 사용자 대응 */
@media (prefers-reduced-motion: reduce) {
  .fade-up, .slide-left, .slide-right, .count-reveal {
    transition: none !important;
    animation: none !important;
    opacity: 1;
    transform: none;
  }
  .step-connector-path {
    animation: none !important;
    stroke-dashoffset: 0;
  }
}
```

> **v1.4 추가 — `body.js-anim` 추가 위치**: `body.js-anim` 클래스는 `LandingScrollAnimation.tsx` 마운트 시점에서 `document.body.classList.add('js-anim')`으로 추가해야 함. 미추가 시 `.slide-left/.slide-right` 요소가 초기부터 visible 상태이고 옵저버 진입 후 `visible` 클래스 추가 시 순간적인 깜빡임(FOUC) 발생. `LandingScrollAnimation.tsx` 현재 코드에 해당 라인 포함 여부를 구현 전 확인하고, 없으면 `useEffect` 마운트 시 추가.

### 6.2 HOW CUSTOMERS 섹션 연결선 그리기 Animation

```css
/* 3단계 카드 사이 SVG 화살표 선 그리기 효과
   width 속성은 SVG에서 무효 — stroke-dashoffset 방식 사용 */
@keyframes draw-stroke {
  to { stroke-dashoffset: 0; }
}
.step-connector-path {
  /* JS에서 getTotalLength()로 --path-length 값 주입 필요 */
  stroke-dasharray: var(--path-length, 100);
  stroke-dashoffset: var(--path-length, 100);
  animation: draw-stroke 0.4s ease-out forwards;
  animation-delay: var(--connector-delay, 0s);
}
```

```tsx
// v1.4 수정: document 전역 querySelectorAll → connectorRef 스코프 제한 (§6.3 원칙 일관 적용)
// HOW CUSTOMERS 컴포넌트에 connectorRef 선언 후 SVG 루트에 연결

const connectorRef = useRef<SVGSVGElement>(null);

useEffect(() => {
  const svgEl = connectorRef.current;
  if (!svgEl) return;
  svgEl.querySelectorAll('.step-connector-path').forEach(el => {
    const length = (el as SVGPathElement).getTotalLength();
    (el as HTMLElement).style.setProperty('--path-length', String(length));
  });
}, []);

// SVG 마크업에 ref 연결: <svg ref={connectorRef}>
```

### 6.3 HOW AEOLAB + DASHBOARD 통합 섹션 스크롤 연동

**중요: `page.tsx`는 Server Component — `useState` 직접 추가 불가 (빌드 오류)**

> **v1.1 수정**: v1.0은 `StepHighlighter`에 render prop `children: (activeStep: number) => React.ReactNode`을 사용했으나, Next.js App Router에서 **Server Component는 Client Component에 함수를 prop으로 전달할 수 없음** (직렬화 불가 → 빌드/런타임 오류). render prop 패턴 자체가 RSC에서 불가.
>
> **올바른 구조**: 스텝 하이라이트 로직과 대시보드 JSX를 하나의 `"use client"` 컴포넌트로 통합.

```tsx
// 올바른 구현: HowAeolabIntegrated.tsx — 스텝+대시보드를 단일 Client Component에 포함
// frontend/components/landing/HowAeolabIntegrated.tsx
"use client"
import { useState, useEffect, useRef } from 'react';

export function HowAeolabIntegrated() {
  // v1.4 수정: useState(0) → useState(1)
  // 0이면 step은 1/2/3이므로 초기에 모든 카드가 opacity-60(하이라이트 없음) 버그
  const [activeStep, setActiveStep] = useState(1);
  // v1.3: containerRef로 querySelectorAll 스코프 제한
  // document 전체 쿼리 시 다른 컴포넌트가 data-step을 사용하면 오작동
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // document 전체가 아닌 컨테이너 내부만 쿼리
    const stepEls = containerRef.current?.querySelectorAll('[data-step]') ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const step = Number((entry.target as HTMLElement).dataset.step);
            setActiveStep(step);
          }
        });
      },
      // v1.4 수정: threshold 0.5 → 0.3
      // 모바일 아코디언에서 짧은 viewport + 긴 스텝 카드 조합 시 50% 진입 불가 케이스 방지
      { threshold: 0.3 }
    );
    stepEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const highlight = (step: number) =>
    activeStep === step ? 'ring-2 ring-blue-500 ring-offset-2' : 'opacity-60';

  return (
    // containerRef를 루트 div에 연결 — querySelectorAll 스코프 제한
    <div ref={containerRef} className="grid lg:grid-cols-2 gap-8">
      {/* 왼쪽: 스텝 카드 3개 */}
      <div className="space-y-4">
        {[1, 2, 3].map((step) => (
          <div key={step} data-step={step}
            className={`p-4 rounded-xl border transition-all duration-300 ${highlight(step)}`}>
            {/* 각 스텝 내용 */}
          </div>
        ))}
      </div>
      {/* 오른쪽: 대시보드 카드 — activeStep에 따라 highlight */}
      <div className="space-y-3">
        <div className={`... ${highlight(1)}`}>{/* 알림 카드 */}</div>
        <div className={`... ${highlight(2)}`}>{/* 점수 카드 */}</div>
        <div className={`... ${highlight(3)}`}>{/* 추세 그래프 */}</div>
      </div>
    </div>
  );
}

// page.tsx (Server Component)에서 사용 — 함수 prop 없이 직접 렌더링:
// <HowAeolabIntegrated />
```

**왜 render prop이 RSC에서 불가한가:**
```
Server Component → Client Component prop 전달 시
  OK: string, number, 직렬화 가능 값
  OK: React Server Component (JSX) as children
  불가: (activeStep: number) => JSX 같은 함수 → 직렬화 불가 → 런타임 오류
```

---

## 7. 색상 통일 (2색 원칙으로 랜딩 단순화)

### 7.1 랜딩페이지에서 사용할 색상 제한

```
메인: 파랑(#2563EB)
배경: 흰색(#FFFFFF), 연파랑(#EFF6FF), 연회색(#F8FAFC)
텍스트: 진한 슬레이트(#0F172A), 중간(#475569), 힌트(#64748B)
상태: 초록(#059669 — 성공만), 앰버(#D97706 — 경고만), 빨강(#DC2626 — 오류만)
```

### 7.2 랜딩에서 상태 색상 노출 최소화

- 초록/앰버/빨강은 **업종 배지, 키워드 갭 태그, Before/After 구분**에만 사용
- 나머지 모든 곳은 파랑+흰색+회색 3가지만 사용
- 특히 WHY 섹션 Before 카드의 빨간색 → OK (비교 목적이므로 의도적)

---

## 8. 모바일 스크롤 최적화

### 8.1 섹션 높이 제한

| 섹션 | 모바일 목표 높이 | 현재 문제 |
|------|---------------|----------|
| HERO | 화면 1.2개 | 타일+폼+패널이 길어짐 |
| WHY | 화면 1개 | 적당함 |
| PROOF | 화면 0.8개 | 숫자만이면 충분 |
| HOW CUSTOMERS | 화면 1.5개 | 3카드 세로 배열 |
| HOW AEOLAB | 화면 2개 이내 | TD-1 아코디언으로 해결 |
| 비교 | 화면 1개 | 모바일 카드 형식 |

### 8.2 HERO 모바일 최적화

```
모바일 Hero 순서 (CLS 방지 설계):
1. 배지 "네이버 AI 브리핑 (자동추천)"
2. 헤드라인 (42px, 2줄)
3. KPI 3개 ← 헤드라인 직후 배치 (PC와 동일)
4. 서브텍스트 (15px, 2줄)
5. 업종 타일 (2열 wrap)
6. 진단 폼 (업종 표시 + 지역 입력 + 버튼)
7. 패널 컨테이너 (min-height: 200px 예약 → CLS 방지)
   └─ idle/loading/result/error 패널 교체
```

**CLS 방지 필수:**
```tsx
// 패널 컨테이너에 min-height 고정 — 패널 전환 시 레이아웃 흔들림 방지
<div className="panel-container" style={{ minHeight: '200px' }}>
  {panelState === 'idle' && <PanelIdle />}
  {panelState === 'loading' && <PanelLoading />}
  {panelState === 'result' && <PanelResult />}
  {panelState === 'error' && <PanelError />}
</div>
```

**모바일 업종 타일 선택 → 폼 자동 스크롤:**
```tsx
// v1.3 수정: v1.2는 handleIndustrySelect(신규 함수)로 기술했으나
// 실제 코드는 handleTileClick(L33)이 이미 타일 클릭을 처리.
// handleIndustrySelect를 새로 만들면 7개 타일 onClick 바인딩을 모두 변경해야 하므로
// 기존 handleTileClick에 scrollIntoView만 추가하는 것이 올바른 수정.
// ─── 기존 handleTileClick 수정 (신규 함수 생성 아님) ───
const handleTileClick = (key: string) => {
  setSelectedIndustry(key);
  setPanelState("idle");
  setResult(null);
  // 모바일: 업종 선택 후 지역 input으로 부드럽게 스크롤
  regionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
// onClick 바인딩 변경 불필요 — 기존 타일 7개 그대로 유지
```

---

## 9. 구현 마일스톤 (시간 예산 기준)

> **v1.4 추가 — 브랜치 전략**: 10개 섹션 재구조화 + 폰트/배경 전면 교체는 규모가 큰 변경이므로 `feature/landing-redesign` 브랜치 생성 후 작업 권장. Phase 1 완료 후 서버 확인 → merge 순서.

### Phase 1 — 필수 시각 변환 (약 6~7시간)

> v1.4 수정: 순서 번호 중복 정리 (0a/0b, 5a~5d로 분리)

| 순서 | 작업 | 파일 | 소요 |
|------|------|------|------|
| 0a | **[사전]** `PretendardVariable.woff2` 다운로드 → `public/fonts/` SCP 업로드 | 서버 파일 시스템 | 10분 |
| 0b | **[사전]** `grep -r "glass-card" frontend/` → HeroSection 외 사용처 확인 | 검색 | 5분 |
| 1 | Pretendard Variable 폰트 설치 + `display:'swap'` 적용 | `layout.tsx`, `globals.css` | 20분 |
| 2 | 히어로 배경 밝게 + 텍스트 색상 전면 교체 + **`globals.css`의 `.glass-card {}` 정의 삭제** | `HeroSection.tsx`, `globals.css` | 2~3시간 |
| 3 | PanelIdle + PanelResult + **PanelError** 밝은 버전 (PanelError는 JSX만, Phase 2 API 연결 후 동작) | `HeroSection.tsx` | 1~2시간 |
| 4 | 헤드라인 크기 업 (Tailwind 클래스 우선 확인 후 `globals.css` 수정) | `globals.css` | 15분 |
| 5a | 카드 순차 등장 delay 추가 (`!important` 없이) | `page.tsx` 각 섹션 | 30분 |
| 5b | **`LandingScrollAnimation.tsx` 옵저버 확장** — `.slide-left, .slide-right` 추가 + `body.js-anim` 추가 여부 확인 및 미포함 시 추가 | `LandingScrollAnimation.tsx` | 10분 |
| 5c | **`TREND_POINTS` 더미 데이터 처리** — `DashboardPreview.tsx` 실 데이터 연결 전까지 "첫 스캔 후 표시" placeholder로 교체 (CLAUDE.md §7 위반 해소) | `DashboardPreview.tsx` | 20분 |
| 5d | **패널 컨테이너 CLS 방지** — `min-height: 200px` 추가 (§8.2 코드 블록 참조) | `HeroSection.tsx` | 10분 |

**LandingScrollAnimation.tsx 수정 (Phase 1 필수):**
```tsx
// v1.1 추가: .fade-up 만 관찰하던 L21을 3개 선택자로 확장
// 변경 전
document.querySelectorAll(".fade-up").forEach((el) => io.observe(el));
// 변경 후
document.querySelectorAll(".fade-up, .slide-left, .slide-right").forEach((el) => io.observe(el));

// v1.4 추가: body.js-anim 추가 (마운트 시 1회)
document.body.classList.add('js-anim');
```

**DashboardPreview.tsx TREND_POINTS 수정 (Phase 1 필수 — CLAUDE.md §7):**
```tsx
// 변경 전 (더미 데이터 — CLAUDE.md 정책 위반)
const TREND_POINTS = [70, 63, 68, 72, 67, 74, 78];

// 변경 후: 실 데이터 연결 전 placeholder
const TREND_POINTS = null;

// 렌더링:
{TREND_POINTS
  ? <LineChart data={TREND_POINTS} />
  : <p className="text-sm text-gray-400 text-center py-6">첫 스캔 후 추세가 표시됩니다</p>
}
```

**배포 절차 (RAM 4GB OOM 방지):**
```bash
pm2 stop aeolab-backend                          # 백엔드 중지 (RAM 확보)
cd /var/www/aeolab/frontend && npm run build     # v1.3: cd 경로 필수
BUILD_RESULT=$?
pm2 start aeolab-backend                         # 백엔드 재시작 (빌드 결과 무관)
# v1.4 수정: 빌드 실패 시 frontend restart 차단
if [ $BUILD_RESULT -eq 0 ]; then
  pm2 restart aeolab-frontend
  echo "BUILD SUCCESS — frontend restarted"
else
  echo "BUILD FAILED — aeolab-frontend NOT restarted (이전 빌드 유지)"
  exit 1
fi
```

**Phase 1 완료 후 SSH 검증 (CLAUDE.md 필수):**
```bash
# 1. 폰트 교체 확인
ssh root@115.68.231.57 "grep -n 'pretendard' /var/www/aeolab/frontend/app/layout.tsx | head -5"

# 2. 히어로 배경 전환 확인
ssh root@115.68.231.57 "grep -n 'EFF6FF' /var/www/aeolab/frontend/components/landing/HeroSection.tsx | head -3"

# 3. TREND_POINTS 처리 확인
ssh root@115.68.231.57 "grep -n 'TREND_POINTS' /var/www/aeolab/frontend/components/landing/DashboardPreview.tsx"

# 4. PM2 에러 로그 확인
ssh root@115.68.231.57 "pm2 logs aeolab-frontend --lines 30 --nostream"
```

**Phase 1 완료 후 예상 변화**: "IT 스타트업 서비스 느낌" 확실히 상승  
**Phase 1 완료 후 측정**: Lighthouse CLS < 0.1, 히어로 스크롤 이탈율 (GA4 Scroll Depth 50%+)

---

### Phase 2 — 구조 개선 (약 8~9시간)

> v1.4 수정: 순서 번호 중복 정리 (10a/10b로 분리)

| 순서 | 작업 | 파일 | 소요 |
|------|------|------|------|
| 6 | 섹션 순서 재배치 (신뢰 데이터 앞으로) | `page.tsx` | 1시간 |
| 7 | HowItWorks + DashboardPreview 통합 섹션 + 모바일 `useState` 아코디언 | `page.tsx` + 두 컴포넌트 | 4시간 |
| 8 | WHY 섹션 Before 카드 광고비 UI 추가 | `page.tsx` | 1시간 |
| 9 | HOW CUSTOMERS 연결선 animation 추가 (connectorRef 방식) | `page.tsx` | 1시간 |
| 10a | 모바일 Hero 업종 선택→폼 자동 스크롤 (regionRef 사용) | `HeroSection.tsx` | 30분 |
| 10b | **히어로 실제 API 연결** (`/api/scan/trial`) → PanelError 실제 동작 활성화 (**진입 전 §5.3 API 매핑 설계 먼저 완성**) | `HeroSection.tsx` | 1~2시간 |

---

### Phase 3 — 완성도 (약 4시간)

| 순서 | 작업 | 파일 | 소요 |
|------|------|------|------|
| 11 | slide-left/slide-right WHY 섹션 적용 | `page.tsx`, `globals.css` | 1시간 |
| 12 | PROOF 섹션 숫자 카운트업 효과 | `page.tsx` | 1시간 |
| 13 | 색상 통일 — 랜딩 내 불필요한 색상 정리 | 여러 파일 | 1시간 |
| 14 | 여백 전체 검토 (20% 증가) | `page.tsx` | 1시간 |

---

## 10. "토스/카카오처럼 세련되게" 체크리스트

최종 구현 후 이 체크리스트를 통과하면 "IT 서비스 수준" 달성:

### 첫인상 (히어로 0~3초)
- [ ] 배경이 밝고 깨끗하다 (연파랑→흰색)
- [ ] 헤드라인이 크고 선명하다 (42px+ Pretendard)
- [ ] "이게 내 가게 얘기구나" 3초 내 파악 가능
- [ ] 진단 폼이 친근하고 깔끔하다 (유리 느낌 없음)

### 스크롤 경험 (3~30초)
- [ ] 각 섹션이 화면 1개 이내 (모바일 기준)
- [ ] 다음 섹션 궁금해서 스크롤하게 됨
- [ ] 숫자(+27.4%, 3,000만)에서 자연스럽게 멈추게 됨
- [ ] 비교 섹션 2개(WHY NOT DIY + vs OTHERS)가 나란히 붙지 않고 WHY → PROOF → HOW → 비교1 → 비교2 순서로 충분한 내러티브 거리가 있다
- [ ] 3단계 설명이 직관적으로 이해됨

### 신뢰감 (전반)
- [ ] 폰트가 일관되고 선명하다
- [ ] 색상이 파랑+흰색+회색 3가지 중심이다
- [ ] "예시" 레이블이 적절히 붙어 있다 (더미 데이터 없음 확인)
- [ ] 출처 링크가 있다

### 행동 유도 (CTA)
- [ ] 스크롤마다 1개 이상의 CTA가 보인다
- [ ] Final CTA가 임팩트 있게 구분된다
- [ ] 모바일에서 CTA 버튼이 손가락으로 탭하기 좋다 (`min-h-[44px]` 이상)

### 접근성
- [ ] `prefers-reduced-motion` 환경에서 모든 애니메이션이 비활성화된다

---

*다음 단계: `feature/landing-redesign` 브랜치 생성 → Phase 1 구현 → 실제 서버에서 SSH 검증 → Phase 2 진행*  
*구현 시 `frontend-dev` 에이전트 사용, 완료 후 SSH 검증 필수 (CLAUDE.md 규정)*

---

## /autoplan 검토 결과 (2026-05-08)

<!-- /autoplan restore point: /c/Users/Kipen/.gstack/projects/Ultrakipen-aeolab/main-autoplan-restore-20260508-102529.md -->

### 수정 필수 항목 (v1.4 상태 반영)

> **v1.4 기준**: 모든 수정 상태가 최종 반영됨. `🔴 미해결` 항목은 구현 시 처리 필요.

#### Critical (빌드/런타임 파손)

1. ~~**`draw-line` SVG 애니메이션 버그** (§6.2)~~ — **v1.0 본문 §6.2에서 이미 `stroke-dashoffset`으로 올바르게 구현됨. 해결 완료.**

2. **`PanelError` 상태 누락** (§5.3) — **Phase 1에서 JSX 추가, Phase 2에서 API 연결 후 동작**
   - 현재 `HeroSection.tsx` L11: `type PanelState = "idle" | "loading" | "result"` — `"error"` 없음
   - Phase 1: `"error"` 타입 + PanelError JSX 추가 (도달 불가 상태)
   - Phase 2: `/api/scan/trial` API 연결 시 실제 트리거 가능

#### High (기능 일부 미작동 또는 잠재 빌드 실패)

3. **`slide-left/right` 클래스 옵저버 누락** — **미해결 (Phase 1 구현 필수)**
   - 현재 `LandingScrollAnimation.tsx` L21: `.fade-up`만 관찰
   - 수정 코드: Phase 1 §9 LandingScrollAnimation.tsx 코드 블록 참조

4. ~~**Pretendard woff2 파일 미업로드 = 빌드 실패**~~ — **§5.1에 파일 다운로드 절차 포함됨. 해결 완료.**

5. ~~**`useState` → Server Component 충돌**~~ — **v1.1에서 §6.3을 `HowAeolabIntegrated` 단일 Client Component 패턴으로 교체. 해결 완료.**

6. **`glass-card` 전역 부작용 감사** — **grep 확인 결과 `HeroSection.tsx`에서만 사용, `globals.css`에 "히어로 전용" 주석 있음. globals.css 삭제 안전. v1.4에서 Phase 1 Step 2에 명시적 삭제 지침 추가.**
   ```
   grep 결과: HeroSection.tsx (1건) + globals.css 정의 (1건) — 외부 사용 없음
   ```

7. **섹션 재배치 후 `fade-up` 옵저버 오작동** — **미해결 (Phase 2 구현 시 대응 필요)**
   - 수정: `LandingScrollAnimation.tsx` observer에 `{ rootMargin: '0px 0px -40px 0px', threshold: 0.08 }` 유지 (현재 설정) + `requestAnimationFrame` 래핑 (현재 코드에 이미 있음 — 실제 확인 후 추가 조치 필요)

#### Medium (품질/성능 저하)

8. ~~**`display: 'swap'` 누락**~~ — **§5.1 코드에 이미 `display: 'swap'` 포함됨. 해결 완료.**

9. ~~**`.delay-*` `!important` 제거**~~ — **§6.1에 `!important 제거 (tw-animate-css 충돌 방지)` 주석과 함께 이미 제거됨. 해결 완료.**

10. **`TREND_POINTS` 더미 데이터** (`DashboardPreview.tsx`) — **v1.4에서 Phase 1 Step 5c에 수정 코드 포함. Phase 1 구현 시 처리.**
    - 수정 코드: Phase 1 §9 DashboardPreview.tsx 코드 블록 참조

11. **모바일 idle 패널 CLS** (§8.2) — **v1.4에서 Phase 1 Step 5d에 포함. Phase 1 구현 시 처리.**
    - 수정: 패널 컨테이너에 `min-height: 200px` 예약 (§8.2 코드 블록 참조)

12. ~~**빌드 중 RAM 경합**~~ — **§9 Phase 1 배포 절차에 `pm2 stop` 포함됨. 해결 완료.**

---

### 추가 수정: KPI 위치 (Design Review 결정)

**§4 섹션 1 레이아웃 순서 변경:**
```
기존: 배지 → 헤드라인 → 서브텍스트 → 업종 타일 → KPI
수정: 배지 → 헤드라인 → KPI 3개 → 서브텍스트 → 업종 타일
```
KPI가 "3,000만명이 보는 네이버 AI 브리핑"을 헤드라인 직후 노출 → 첫인상 신뢰도 최대화.

---

### Taste Decision (결정 완료)

**TD-1: §5 HOW AEOLAB 모바일 레이아웃 — 아코디언 (v1.4 구현 방식 확정)**

- 옵션 A: 아코디언 (Step 1개씩 펼치기) — §2.2 규칙 준수 (2화면 이내), 구현 복잡도 +1시간 ← **선택**
- 옵션 B: 전체 스크롤 (현재 계획대로, 6개 카드 세로) — 구현 쉬움, §2.2 규칙 위반 가능
- **구현 방식**: `useState` (v1.4 결정) — `HowAeolabIntegrated` Client Component 내 통합

---

### 추가된 KPI 지표 (사용자 결정 반영)

구현 단계별 전환율 측정:
- **Phase 1 완료 후**: 히어로 스크롤 이탈율 (Scroll Depth 50% 이상 비율)
- **Phase 2 완료 후**: 트라이얼 완료율 (trial 진단 폼 → result 표시 비율)
- **Phase 3 완료 후**: 랜딩 → 가입 전환율 (GA4 Funnel)

---

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|---------|
| 1 | CEO | 계획 진행 + KPI 추가 | Gate | User Decision | 사용자 명시적 승인 | 중단/인터뷰 우선 |
| 2 | CEO | 섹션 통합/재배치 범위 승인 | Mechanical | P2(blast radius) | 기존 컴포넌트 내, <1일 | 축소 |
| 3 | CEO | A/B 테스트 TODOS 지연 | Mechanical | P3(pragmatic) | 베타 1명 상태에서 A/B 불필요 | 즉시 구현 |
| 4 | Design | PanelError 상태 추가 | Mechanical | P1(completeness) | 에러 경로 미지정은 CLAUDE.md 위반 | 미추가 |
| 5 | Design | KPI 위치 헤드라인 직후로 이동 | Mechanical | P5(explicit) | 가장 강력한 신뢰 수치가 먼저 보여야 함 | 타일 아래 유지 |
| 6 | Design | 모바일 CLS → min-height 수정 | Mechanical | P3(pragmatic) | 2줄 CSS 수정으로 해결 | 미수정 |
| 7 | Design | 모바일 accordion vs 전체 스크롤 | A 결정 (아코디언) | §2.2 규칙 우선 | §2.2 "2화면 이내" 자체 규칙 준수 | 전체 스크롤(규칙 위반) |
| 8 | Eng | draw-line → stroke-dashoffset | Mechanical | P5(explicit) | width는 SVG에서 무효, 정답은 1개 | width 유지 |
| 9 | Eng | StepHighlighter 분리 | Mechanical | P5(explicit over clever) | page.tsx는 RSC, useState 불가 | page.tsx 직접 추가 |
| 10 | Eng | LandingScrollAnimation 옵저버 확장 | Mechanical | P1(completeness) | slide-left/right 관찰 안 하면 기능 없음 | 미추가 |
| 11 | Eng | Pretendard Variable 1파일 | 해결 (§5.1 이미 포함) | P3(pragmatic) | 6파일 대비 번들 60% 감소 | 6파일 별도 |
| 12 | Eng | glass-card audit | 해결 (HeroSection 전용 확인) | P2(blast radius) | grep 결과 외부 사용 0건 | 무점검 수정 |
| 13 | Eng | TREND_POINTS 더미 제거 | Phase 1 Step 5c 포함 (v1.4) | P1(completeness) | CLAUDE.md §7 정책 위반 | 유지 |
| 14 | Eng | 빌드 전 pm2 stop 절차 | 해결 (§9 포함) | P3(pragmatic) | RAM 4GB OOM 방지 | 동시 실행 |
| 15 | Eng (v1.1) | 폰트 교체 전제 수정 (Outfit→Pretendard) | Mechanical | P5(explicit) | 실제 코드는 Noto Sans KR 없음, Outfit 사용 | Noto Sans KR 폴백 |
| 16 | Eng (v1.1) | StepHighlighter render prop 제거 | Mechanical | P5(explicit) | RSC→Client 함수 prop 직렬화 불가 | render prop 유지 |
| 17 | Eng (v1.1) | LandingScrollAnimation 옵저버 확장 | Mechanical | P1(completeness) | slide 클래스 관찰 안 하면 영구 invisible | 미추가 |
| 18 | Eng (v1.1) | PanelIdle border 중복 제거 | Mechanical | P3(pragmatic) | border shorthand이 borderColor 덮어씀 | 중복 유지 |
| 19 | Eng (v1.2) | formRef → regionRef 수정 | Mechanical | P5(explicit) | HeroSection 실제 변수명 regionRef, formRef는 ReferenceError | formRef 유지 |
| 20 | Eng (v1.2) | PanelError API 전제 명시 | Mechanical | P1(completeness) | 현재 static mock 구조에서 PanelError 미도달, Phase 2 API 연결 필요 | 전제 없이 구현 |
| 21 | Eng (v1.2) | count-reveal forwards → both | Mechanical | P3(pragmatic) | delay 클래스 사용 시 딜레이 중 flash 버그 방지 | forwards 유지 |
| 22 | Design (v1.2) | §10 체크리스트 비교섹션 표현 수정 | Mechanical | P5(explicit) | "한 번만" 표현이 2-섹션 구조와 모순, 의도는 "연속 배치 없음" | "한 번만" 유지 |
| 23 | Design (v1.2) | TD-1 모바일 스펙 §5 반영 | Mechanical | P5(explicit) | TD-1 결정(아코디언)이 §5 본문에 미반영이면 구현 혼선 | 인터리브 유지 |
| 24 | Eng (v1.3) | §4 폰트 오기 수정 (Noto Sans KR→Outfit) | Mechanical | P5(explicit) | v1.0~v1.2 §4에 Noto Sans KR 오기 잔재, 실측은 Outfit | 오기 유지 |
| 25 | Eng (v1.3) | handleIndustrySelect → handleTileClick 수정 | Mechanical | P5(explicit) | 신규 함수 생성 시 7개 타일 onClick 전체 변경 필요, 기존 함수 수정이 올바름 | 신규 함수 생성 |
| 26 | Eng (v1.3) | outfit import/상수/html className 3곳 제거 | Mechanical | P1(completeness) | 제거 없이 추가만 하면 ~40KB 불필요 네트워크 요청 + unused var 경고 | 추가만 수행 |
| 27 | Eng (v1.3) | 배포 절차 cd 경로 추가 | Mechanical | P3(pragmatic) | cd 누락 시 package.json 못 찾아 npm run build 실패 | 경로 미명시 |
| 28 | Eng (v1.3) | data-step 쿼리 containerRef로 스코프 제한 | Mechanical | P2(blast radius) | 전역 쿼리 시 미래 data-step 사용 컴포넌트와 충돌 위험 | document 전역 쿼리 |
| 29 | Eng (v1.4) | useState(0) → useState(1) 초기값 수정 | Mechanical | P5(explicit) | 0이면 step 1/2/3 중 일치하는 값 없어 모든 카드 opacity-60 버그 | 0 유지 |
| 30 | Eng (v1.4) | SVG connectorRef 스코프 제한 | Mechanical | P2(blast radius) | §6.3 원칙 일관 적용, 전역 querySelectorAll은 컴포넌트 충돌 위험 | document 전역 쿼리 |
| 31 | Eng (v1.4) | 배포 절차 빌드 실패 감지 추가 | Mechanical | P3(pragmatic) | BUILD_RESULT 체크 없으면 실패 시에도 pm2 restart 실행됨 | 무점검 restart |
| 32 | Eng (v1.4) | 마일스톤 번호 중복 정리 (0a/0b, 5a~5d, 10a/10b) | Mechanical | P5(explicit) | 0/0/5/5/10/10 중복은 순서 추적 불가 | 중복 유지 |
| 33 | Eng (v1.4) | TREND_POINTS Phase 1 Step 5c 포함 | Mechanical | P1(completeness) | CLAUDE.md §7 위반, 미해결 상태 해소 | Phase 2 미룸 |
| 34 | Eng (v1.4) | glass-card CSS 정의 삭제 Phase 1 Step 2 명시 | Mechanical | P1(completeness) | 교체 후 정의 잔재는 데드 코드, 명시 없으면 누락 가능 | 암묵적 삭제 |
| 35 | Eng (v1.4) | body.js-anim 추가 위치 LandingScrollAnimation.tsx 명시 | Mechanical | P5(explicit) | 미추가 시 slide 요소 FOUC 버그, 위치 불명확하면 구현자 혼선 | 미명시 |
| 36 | Eng (v1.4) | Observer threshold 0.5 → 0.3 | Mechanical | P3(pragmatic) | 모바일 아코디언 + 짧은 viewport에서 50% 진입 불가 케이스 방지 | 0.5 유지 |
| 37 | Eng (v1.4) | 아코디언 구현 방식 useState 결정 | Mechanical | P5(explicit) | HowAeolabIntegrated 이미 Client Component, details/summary는 애니메이션 제한 | details/summary |
| 38 | Eng (v1.4) | prefers-reduced-motion CSS 추가 | Mechanical | P1(completeness) | 애니메이션 전면 적용 시 접근성 미대응은 누락 | 미추가 |
| 39 | Eng (v1.4) | Phase 2 API 매핑 설계 요건 §5.3 명시 | Mechanical | P5(explicit) | 응답 필드 매핑 없이 API 연결 구현 시 PanelResult 표시 결정 불가 | 구현 중 결정 |
| 40 | Eng (v1.4) | SSH 검증 절차 Phase 1 마일스톤 포함 | Mechanical | P1(completeness) | CLAUDE.md 배포 검증 규정 누락 시 에이전트 보고만 신뢰하는 과거 사고 재발 | 미포함 |
| 41 | Eng (v1.4) | HeroSection 컴포넌트 분리 전략 추가 (선택) | Taste | P3(pragmatic) | 패널 3종 분리 시 diff 리뷰 + Phase 2 변경 범위 축소, 필수 아님 | 단일 파일 유지 |
| 42 | Eng (v1.4) | 브랜치 전략 §9 앞 추가 | Mechanical | P2(blast radius) | 큰 변경은 feature 브랜치 권장, 미언급 시 main 직접 작업 가능성 | 미언급 |
