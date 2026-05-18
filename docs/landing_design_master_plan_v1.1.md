# AEOlab 랜딩페이지 마스터 디자인 계획서 v1.1

**작성일** 2026-05-08 | **최종 수정** 2026-05-08 v1.1 | **기반** 디자인 연구 v2.0 + 스크롤 UX 분석 + 토스/카카오 벤치마크

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-08 | 최초 작성 + /autoplan 검토 결과 통합 |
| v1.1 | 2026-05-08 | 코드 점검 후 오류 6건 수정 (폰트 전제 오류, StepHighlighter RSC 충돌, 옵저버 미확장, border 충돌, 섹션 수 불일치, /autoplan false positive 정리) |

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

> ⛔ **제거/통합 섹션**:
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
[KPI 3개] ← ⭐ 헤드라인 직후 이동  지역 입력
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
- 폰트: Noto Sans KR → **Pretendard** (별도 설명)

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
   [💡 AI 브리핑은 한 번 올라가면 광고 없이 유지됩니다]
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

### 섹션 5. HOW AEOLAB + DASHBOARD — "이해 2단계" ⭐ 핵심 통합

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

**모바일:**
- Step 카드 3개 세로 배열
- 각 Step 카드 아래에 해당 결과 카드 배치 (인터리브 방식)

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
개선: 🔒 가입 불필요  💳 카드 없이  ⏱ 1분 소요
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
// frontend/app/layout.tsx — 추가 (기존 Geist·Outfit 아래에)
import localFont from 'next/font/local'

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',      // ← 필수: 없으면 CLS 발생
  weight: '100 900',    // Variable 폰트는 범위로 지정
})

// <body> className에 pretendard.variable 추가
// className={`... ${pretendard.variable}`}
```

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

---

### 5.3 PanelIdle / PanelResult / PanelError 밝은 버전 (1~2시간, 효과 ★★★★)

**패널 4가지 상태 (CLAUDE.md §7 에러 폴백 허위 수치 금지 정책 준수):**

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

// ⭐ PanelError — 신규 추가 (기존 없음, CLAUDE.md 정책 요구)
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
→ 실패: PanelError (재시도 버튼)
```

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
  animation: count-up 0.6s cubic-bezier(.22,1,.36,1) forwards;
}
```

### 6.2 HOW CUSTOMERS 섹션 연결선 그리기 Animation

```css
/* 3단계 카드 사이 SVG 화살표 선 그리기 효과
   ⚠️ width 속성은 SVG에서 무효 — stroke-dashoffset 방식 사용 */
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
// JS 초기화 코드
useEffect(() => {
  document.querySelectorAll('.step-connector-path').forEach(el => {
    const length = (el as SVGPathElement).getTotalLength();
    (el as HTMLElement).style.setProperty('--path-length', String(length));
  });
}, []);
```

### 6.3 HOW AEOLAB + DASHBOARD 통합 섹션 스크롤 연동

**⚠️ 중요: `page.tsx`는 Server Component — `useState` 직접 추가 불가 (빌드 오류)**

> **v1.1 수정**: v1.0은 `StepHighlighter`에 render prop `children: (activeStep: number) => React.ReactNode`을 사용했으나, Next.js App Router에서 **Server Component는 Client Component에 함수를 prop으로 전달할 수 없음** (직렬화 불가 → 빌드/런타임 오류). render prop 패턴 자체가 RSC에서 불가.
>
> **올바른 구조**: 스텝 하이라이트 로직과 대시보드 JSX를 하나의 `"use client"` 컴포넌트로 통합.

```tsx
// ✅ 올바른 구현: HowAeolabIntegrated.tsx — 스텝+대시보드를 단일 Client Component에 포함
// frontend/components/landing/HowAeolabIntegrated.tsx
"use client"
import { useState, useEffect } from 'react';

export function HowAeolabIntegrated() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const stepEls = document.querySelectorAll('[data-step]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const step = Number((entry.target as HTMLElement).dataset.step);
            setActiveStep(step);
          }
        });
      },
      { threshold: 0.5 }
    );
    stepEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const highlight = (step: number) =>
    activeStep === step ? 'ring-2 ring-blue-500 ring-offset-2' : 'opacity-60';

  return (
    <div className="grid lg:grid-cols-2 gap-8">
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
  ✅ string, number, 직렬화 가능 값 → OK
  ✅ React Server Component (JSX) as children → OK  
  ❌ (activeStep: number) => JSX 같은 함수 → 직렬화 불가 → 런타임 오류
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
| HOW AEOLAB | 화면 2개 | 스텝3개+대시보드 분리 배치 |
| 비교 | 화면 1개 | 모바일 카드 형식 |

### 8.2 HERO 모바일 최적화

```
모바일 Hero 순서 (CLS 방지 설계):
1. 배지 "네이버 AI 브리핑 (자동추천)"
2. 헤드라인 (42px, 2줄)
3. KPI 3개 ← ⭐ 헤드라인 직후 배치 (PC와 동일)
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
// 업종 타일 클릭 시 폼 input으로 부드럽게 스크롤
const handleIndustrySelect = (industry: string) => {
  setSelectedIndustry(industry);
  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
```

---

## 9. 구현 마일스톤 (시간 예산 기준)

### Phase 1 — 필수 시각 변환 (약 6시간)

| 순서 | 작업 | 파일 | 소요 |
|------|------|------|------|
| 0 | **[사전]** `PretendardVariable.woff2` 다운로드 → `public/fonts/` SCP 업로드 | 서버 파일 시스템 | 10분 |
| 0 | **[사전]** `grep -r "glass-card" frontend/` → HeroSection 외 사용처 확인 | 검색 | 5분 |
| 1 | Pretendard Variable 폰트 설치 + `display:'swap'` 적용 | `layout.tsx`, `globals.css` | 20분 |
| 2 | 히어로 배경 밝게 + 텍스트 색상 전면 교체 | `HeroSection.tsx`, `globals.css` | 2~3시간 |
| 3 | PanelIdle + PanelResult + **PanelError** 밝은 버전 | `HeroSection.tsx` | 1~2시간 |
| 4 | 헤드라인 크기 업 (Tailwind 클래스 우선 확인 후 `globals.css` 수정) | `globals.css` | 15분 |
| 5 | 카드 순차 등장 delay 추가 (`!important` 없이) | `page.tsx` 각 섹션 | 30분 |
| 5 | **`LandingScrollAnimation.tsx` 옵저버 확장** — 현재 `.fade-up`만 관찰 중. `.slide-left, .slide-right` 추가 필수 (미추가 시 WHY 섹션 카드 영구 `opacity:0`) | `LandingScrollAnimation.tsx` L21 | 10분 |

**LandingScrollAnimation.tsx 수정 (Phase 1 필수):**
```tsx
// v1.1 추가: .fade-up 만 관찰하던 L21을 3개 선택자로 확장
// 변경 전
document.querySelectorAll(".fade-up").forEach((el) => io.observe(el));
// 변경 후
document.querySelectorAll(".fade-up, .slide-left, .slide-right").forEach((el) => io.observe(el));
```

**배포 절차 (RAM 4GB OOM 방지):**
```bash
pm2 stop aeolab-backend   # 백엔드 중지 (RAM 확보)
npm run build             # Next.js 빌드 (야간 권장)
pm2 start aeolab-backend  # 백엔드 재시작
pm2 restart aeolab-frontend
```

**Phase 1 완료 후 예상 변화**: "IT 스타트업 서비스 느낌" 확실히 상승
**Phase 1 완료 후 측정**: Lighthouse CLS < 0.1, 히어로 스크롤 이탈율 (GA4 Scroll Depth 50%+)

---

### Phase 2 — 구조 개선 (약 8시간)

| 순서 | 작업 | 파일 | 소요 |
|------|------|------|------|
| 6 | 섹션 순서 재배치 (신뢰 데이터 앞으로) | `page.tsx` | 1시간 |
| 7 | HowItWorks + DashboardPreview 통합 섹션 | `page.tsx` + 두 컴포넌트 | 3시간 |
| 8 | WHY 섹션 Before 카드 광고비 UI 추가 | `page.tsx` | 1시간 |
| 9 | HOW CUSTOMERS 연결선 animation 추가 | `page.tsx` | 1시간 |
| 10 | 모바일 Hero 업종 선택→폼 자동 스크롤 | `HeroSection.tsx` | 1시간 |

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
- [ ] 비교 섹션이 과하지 않게 한 번만 나옴
- [ ] 3단계 설명이 직관적으로 이해됨

### 신뢰감 (전반)
- [ ] 폰트가 일관되고 선명하다
- [ ] 색상이 파랑+흰색+회색 3가지 중심이다
- [ ] "예시" 레이블이 적절히 붙어 있다
- [ ] 출처 링크가 있다

### 행동 유도 (CTA)
- [ ] 스크롤마다 1개 이상의 CTA가 보인다
- [ ] Final CTA가 임팩트 있게 구분된다
- [ ] 모바일에서 CTA 버튼이 손가락으로 탭하기 좋다 (44px+ 높이)

---

*다음 단계: Phase 1 구현 → 실제 서버에서 확인 → Phase 2 진행*
*구현 시 `frontend-dev` 에이전트 사용, 완료 후 SSH 검증 필수 (CLAUDE.md 규정)*

---

## /autoplan 검토 결과 (2026-05-08)

<!-- /autoplan restore point: /c/Users/Kipen/.gstack/projects/Ultrakipen-aeolab/main-autoplan-restore-20260508-102529.md -->

### 수정 필수 항목 (v1.1 상태 반영)

> **v1.1 주의**: 아래 항목은 /autoplan이 문서 초안을 검토한 결과이며, 이후 본문 갱신으로 일부가 이미 해결됨.  
> 각 항목에 `✅ 해결됨` / `🔴 미해결` 상태를 표시. **`🔴 미해결` 항목만 구현 시 반영 필요.**

#### 🔴 Critical (빌드/런타임 파손)

1. ~~**`draw-line` SVG 애니메이션 버그** (§6.2)~~ — ✅ **v1.0 본문 §6.2에서 이미 `stroke-dashoffset`으로 올바르게 구현됨. 해결 완료.**

2. **`PanelError` 상태 누락** (§5.3) — 🔴 **미해결 (현재 코드에 없음, 구현 필수)**
   - 현재 `HeroSection.tsx` L11: `type PanelState = "idle" | "loading" | "result"` — `"error"` 없음
   - CLAUDE.md §7 위반: API 실패 시 오류 상태 없으면 무음 폴백 → 허위 수치 노출 위험
   - 수정: §5.3의 `PanelError` 구현 그대로 적용

#### 🟠 High (기능 일부 미작동 또는 잠재 빌드 실패)

3. **`slide-left/right` 클래스 옵저버 누락** — 🔴 **미해결 (구현 필수)**
   - 현재 `LandingScrollAnimation.tsx` L21: `.fade-up`만 관찰
   - 수정 코드: Phase 1 §9 배포 절차 위 코드 블록 참조

4. ~~**Pretendard woff2 파일 미업로드 = 빌드 실패**~~ — ✅ **§5.1에 파일 다운로드 절차 포함됨. 해결 완료.**

5. ~~**`useState` → Server Component 충돌**~~ — ✅ **v1.1에서 §6.3을 `HowAeolabIntegrated` 단일 Client Component 패턴으로 교체. 해결 완료.**
   - (v1.0의 `StepHighlighter` render prop 패턴도 RSC에서 불가능했음 — v1.1에서 함께 수정)

6. **`glass-card` 전역 부작용 감사** — ✅ **grep 확인 결과 `HeroSection.tsx`에서만 사용, `globals.css`에 "히어로 전용" 주석 있음. globals.css 수정 안전.**
   ```
   grep 결과: HeroSection.tsx (1건) + globals.css 정의 (1건) — 외부 사용 없음
   ```

7. **섹션 재배치 후 `fade-up` 옵저버 오작동** — 🔴 **미해결 (Phase 2 구현 시 대응 필요)**
   - 수정: `LandingScrollAnimation.tsx` observer에 `{ rootMargin: '0px 0px -40px 0px', threshold: 0.08 }` 유지 (현재 설정) + `requestAnimationFrame` 래핑 (현재 코드에 이미 있음 — 실제 확인 후 추가 조치 필요)

#### 🟡 Medium (품질/성능 저하)

8. ~~**`display: 'swap'` 누락**~~ — ✅ **§5.1 코드에 이미 `display: 'swap'` 포함됨. 해결 완료.**

9. ~~**`.delay-*` `!important` 제거**~~ — ✅ **§6.1에 `!important 제거 (tw-animate-css 충돌 방지)` 주석과 함께 이미 제거됨. 해결 완료.**

10. **`TREND_POINTS` 더미 데이터** (`DashboardPreview.tsx`) — 🔴 **미해결**
    - HOW+Dashboard 통합 후 `const TREND_POINTS = [70, 63, 68, 72, 67, 74, 78]`이 더 눈에 띄는 위치에 노출
    - 수정: `(예시)` 배지 추가 또는 실 데이터 연결 전까지 "첫 스캔 후 표시" placeholder 교체

11. **모바일 idle 패널 CLS** (§8.2) — 🔴 **미해결 (Phase 1 포함)**
    - 수정: 패널 컨테이너에 `min-height: 200px` 예약 (§8.2 코드 블록 참조)

12. ~~**빌드 중 RAM 경합**~~ — ✅ **§9 Phase 1 배포 절차에 `pm2 stop` 포함됨. 해결 완료.**

---

### 추가 수정: KPI 위치 (Design Review 결정)

**§4 섹션 1 레이아웃 순서 변경:**
```
기존: 배지 → 헤드라인 → 서브텍스트 → 업종 타일 → KPI
수정: 배지 → 헤드라인 → KPI 3개 → 서브텍스트 → 업종 타일
```
KPI가 "3,000만명이 보는 네이버 AI 브리핑"을 헤드라인 직후 노출 → 첫인상 신뢰도 최대화.

---

### Taste Decision (최종 승인 게이트에서 결정)

**TD-1: §5 HOW AEOLAB 모바일 레이아웃 — 아코디언 vs 전체 스크롤**

- 옵션 A: 아코디언 (Step 1개씩 펼치기) — §2.2 규칙 준수 (2화면 이내), 구현 복잡도 +1시간
- 옵션 B: 전체 스크롤 (현재 계획대로, 6개 카드 세로) — 구현 쉬움, §2.2 규칙 위반 가능
- 권장: A (아코디언) — §2.2 자체 규칙과 일치

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
| 7 | Design | 모바일 accordion vs 전체 스크롤 | Taste | — | 두 방식 모두 유효 | — |
| 8 | Eng | draw-line → stroke-dashoffset | Mechanical | P5(explicit) | width는 SVG에서 무효, 정답은 1개 | width 유지 |
| 9 | Eng | StepHighlighter 분리 | Mechanical | P5(explicit over clever) | page.tsx는 RSC, useState 불가 | page.tsx 직접 추가 |
| 10 | Eng | LandingScrollAnimation 옵저버 확장 | Mechanical | P1(completeness) | slide-left/right 관찰 안 하면 기능 없음 | 미추가 |
| 11 | Eng | Pretendard Variable 1파일 | ✅ 해결 (§5.1 이미 포함) | P3(pragmatic) | 6파일 대비 번들 60% 감소 | 6파일 별도 |
| 12 | Eng | glass-card audit | ✅ 해결 (HeroSection 전용 확인) | P2(blast radius) | grep 결과 외부 사용 0건 | 무점검 수정 |
| 13 | Eng | TREND_POINTS 더미 제거 | 🔴 미해결 | P1(completeness) | CLAUDE.md §7 정책 위반 | 유지 |
| 14 | Eng | 빌드 전 pm2 stop 절차 | ✅ 해결 (§9 포함) | P3(pragmatic) | RAM 4GB OOM 방지 | 동시 실행 |
| 15 | Eng (v1.1) | 폰트 교체 전제 수정 (Outfit→Pretendard) | Mechanical | P5(explicit) | 실제 코드는 Noto Sans KR 없음, Outfit 사용 | Noto Sans KR 폴백 |
| 16 | Eng (v1.1) | StepHighlighter render prop 제거 | Mechanical | P5(explicit) | RSC→Client 함수 prop 직렬화 불가 | render prop 유지 |
| 17 | Eng (v1.1) | LandingScrollAnimation 옵저버 확장 | Mechanical | P1(completeness) | slide 클래스 관찰 안 하면 영구 invisible | 미추가 |
| 18 | Eng (v1.1) | PanelIdle border 중복 제거 | Mechanical | P3(pragmatic) | border shorthand이 borderColor 덮어씀 | 중복 유지 |
