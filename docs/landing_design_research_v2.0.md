# AEOlab 랜딩페이지 디자인 연구 보고서 v2.0

**작성일** 2026-05-08 | **기준 스택** Next.js · Tailwind · shadcn/ui | **현재 파일** `frontend/app/page.tsx`, `HeroSection.tsx`

---

## 0. 핵심 결론 (3줄 요약)

> **문제**: 히어로 섹션의 어두운 배경(`#080D1A → #15113A`)이 "밝은 느낌" 선호와 정면 충돌. 나머지 섹션은 구조가 좋으나 시각적 개성이 부족해 스크롤 동기가 약함.
> **방향**: 히어로를 **화이트+파랑 그라디언트 틴트** 기반으로 전환 + 섹션별 배경 변주 강화 + 타이포그래피 스케일 +20%.
> **기대 효과**: "밝고 세련된 신뢰감 있는 SaaS 서비스" 첫인상 → 무료 진단 시작률(Trial CTR) 향상.

---

## 1. 현황 분석 — 지금 무엇이 문제인가

### 1.1 히어로 섹션 배경색 충돌

| 항목 | 현재 값 | 문제 |
|------|---------|------|
| 히어로 배경 | `linear-gradient(135deg, #080D1A 0%, #0D1526 50%, #15113A 100%)` | 한밤중 느낌 → "어둡다" |
| 히어로 텍스트 | `#F8FAFC` (흰색) | 어두운 배경에서 대비는 좋지만 차갑고 무거운 인상 |
| 진단 카드 | `glass-card` (rgba 투명, 어두운 배경 상속) | 입력 UI가 어두워 "접근하기 어렵다"는 심리적 장벽 |
| 오브 글로우 | 파랑/보라 radial-gradient blur | 기술적이지만 소상공인 타깃에 이질감 |

**결론**: 히어로 배경 1가지가 전체 분위기를 어둡게 지배한다. 아래 섹션은 이미 화이트 기반으로 잘 구성되어 있음.

### 1.2 타이포그래피 스케일 부족

```css
/* 현재 */
.hero-headline { font-size: clamp(2rem, 5vw, 3rem); }  /* 32px ~ 48px */
```

- 2025년 트렌드: SaaS 랜딩 히어로 헤드라인 **48px~72px** (Vercel: ~72px, Linear: ~64px, Stripe: ~60px)
- 현재 최대값 48px는 Korean SaaS 기준으로 작아 보임
- 특히 **어두운 배경**에서 흰 텍스트는 실제 크기보다 더 작아 보이는 착시 효과 있음

### 1.3 섹션 시각 단조로움

현재 배경 순서:
```
[다크 히어로] → [흰색] → [흰색] → [#F8FAFC] → [흰색] → [흰색] →
[흰색] → [#F8FAFC] → [#F8FAFC] → [흰색] → [#EFF6FF] → [#F8FAFC] → [다크 CTA]
```

- 중간 섹션들이 흰색·옅은 회색 반복으로 **스크롤 충동이 약함**
- 비교 섹션(ChatGPT vs AEOlab, AEO vs SEO)에 시각적 강조가 부족
- "진단 후 이런 결과를 받는다"는 화면 미리보기가 없어 **실제 가치 전달 약함**

### 1.4 현재 잘 되고 있는 것 (유지 필수)

- ✅ 업종 타일 → 진단폼 → 결과패널 인터랙션 구조 (핵심 차별화)
- ✅ Before/After 카드 (광고 vs AI브리핑) — SVG 그래프 포함
- ✅ HowItWorks 3단계 카드 구조
- ✅ 가격 앵커 섹션 (네이버 광고 vs 9,900원)
- ✅ fade-up 스크롤 애니메이션
- ✅ Final CTA 다크 그라디언트 (이 곳만 어두운 것은 OK)
- ✅ `card-hover` 리프트 효과

---

## 2. 2025 글로벌 디자인 트렌드 (SaaS 랜딩 기준)

### 2.1 확인된 주요 트렌드

**① 라이트 퍼스트 복귀 (Light-First Revival)**
- 2022~2024년 다크모드 유행 이후 2025년은 밝고 깨끗한 화이트 기반 복귀
- Stripe · Vercel · Notion · Linear 모두 **밝은 히어로** 사용
- 어두운 곳은 Final CTA 1곳만 배치하는 "하이라이트로서의 다크" 패턴

**② 과감한 타이포그래피**
- 히어로 헤드라인: 52px~72px, `letter-spacing: -0.04em`, `font-weight: 900`
- 서브텍스트는 일부러 작게(14~16px)해 헤드라인과 대비 극대화
- 텍스트 자체가 비주얼 요소로 작용

**③ 벤토 그리드 (Bento Grid)**
- 비대칭 카드 배열 (2:1, 1:2 비율 혼합)
- 각 카드가 하나의 메시지만 전달 → 정보 밀도 ↑, 독해 부담 ↓
- 모바일에서 1열, 태블릿 2열, PC 비대칭 자동 조정

**④ 선택적 글래스모피즘**
- 어두운 배경 전체 글래스 → 폐기 추세
- 밝은 배경의 **일부 강조 카드**에만 글래스 사용 → 세련됨
- 실제 소재: `backdrop-blur-sm`, `border rgba 반투명`, `box-shadow 내부 하이라이트`

**⑤ Scroll-triggered Reveal**
- 이미 AEOlab에 `fade-up` 구현됨 → 충분
- 추가 개선: 카드별 `transition-delay` 0.1s 차이로 순차 등장

**⑥ 숫자 중심 신뢰 섹션**
- 단일 숫자를 화면 크기로 표시: `+27.4%`, `3,000만+`, `9,900원`
- Outfit 폰트 적용 시 더욱 강조됨 (현재 구현됨)
- 숫자 + 짧은 레이블 + 출처 3가지를 묶는 패턴

**⑦ 브랜드 컬러 강도 증가**
- 2025: 파스텔 → 진한 원색으로 회귀
- `#2563EB` 대신 `#1A56DB` 또는 `#1E40AF` 사용 → 더 강렬하고 신뢰감
- 단, 배경에서는 틴트(10~15% 농도)로 사용해 과하지 않게

---

## 3. 한국 시장 특수성

### 3.1 소상공인 타깃 UI 원칙
- **과도한 테크 느낌 = 이탈**: 화려한 glassmorphism, 복잡한 애니메이션은 오히려 신뢰 저하
- **즉각 이해**: 3초 내 "이 서비스가 내 가게에 어떤 도움이 되는지" 파악 가능해야
- **친근한 비주얼**: 카카오 노란색 계열, 네이버 초록색 익숙한 색상 단서 활용
- **큰 텍스트**: 모바일 사용 비율 높음 → 작은 텍스트 기피 (`text-xs` = 12px 최소)

### 3.2 Korean SaaS 벤치마크 (실측)
- **flex.team**: B2B SaaS, 흰 배경, 큰 헤드라인, 기능별 섹션 스크롤
  - 핵심: "사용자가 진짜 원하는 것"을 중심으로 설계 → 기능 나열 X
- **팀스파르타**: 교육 SaaS, 오렌지 포인트, 밝고 활기찬 분위기
- **스텝페이**: 결제 SaaS, 화이트 + 그린, 신뢰감 중심

---

## 4. 추천 디자인 방향: "선명한 낮의 SaaS"

### 4.1 핵심 컨셉

```
어두운 기술 서비스 → "밝고 신뢰할 수 있는 소상공인 파트너"
```

| 이전 분위기 | 새 분위기 |
|------------|----------|
| 어두운 우주/기술 느낌 | 깨끗하고 밝은 비즈니스 도구 |
| 차갑고 신비로운 파랑 | 따뜻하고 신뢰할 수 있는 파랑 |
| "나는 AI다"  | "나는 당신 가게를 돕는다" |

### 4.2 새 색상 시스템

```css
/* 히어로 새 배경 — 2가지 안 */

/* [추천] A안: 오프화이트 + 파랑 그라디언트 틴트 */
.hero-new {
  background: linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 60%);
  /* 또는 */
  background: linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 40%, #FFFFFF 100%);
}

/* B안: 순백 + 파랑 왼쪽 장식선 */
.hero-new-b {
  background: #FFFFFF;
  border-left: 4px solid #2563EB; /* 왼쪽 강조선 */
}
```

**히어로 텍스트 색상 변경:**
```css
.hero-headline-light {
  font-size: clamp(2.6rem, 5.5vw, 3.6rem);  /* 현재 2-3rem → 2.6-3.6rem */
  line-height: 1.10;
  letter-spacing: -0.04em;
  font-weight: 900;
  color: #0F172A;  /* 흰색 → 진한 슬레이트 */
}
```

### 4.3 히어로 섹션 구조 (권장안 — A안 유지 + 밝게)

```
[밝은 배경: #F0F7FF → #FFFFFF 그라디언트]
┌─────────────────────────────────────────┐
│  [Eyebrow 배지: 파랑 틴트 배경]          │
│  네이버 AI 브리핑 노출 진단 서비스        │
│                                         │
│  ████████████████████ ← 48-56px 헤드라인│
│  네이버·ChatGPT가                        │
│  먼저 추천하는 가게,                     │
│  누구일까요?                             │
│                                         │
│  [서브텍스트 — 14px 슬레이트]            │
│  3,000만 명이 보는 네이버 AI 브리핑...   │
│                                         │
│  [업종 타일 — 어두운 배경보다 더 선명]    │
│  ☕카페  🏨숙박  ✂미용  🏥병원 ...      │
│                                         │
│  ━━━━ KPI 3개 ━━━━                      │
│  +27.4% | +8% | 9,900원                │
│          │              │               │
│    [우측: 진단 폼 카드]                  │
│    ┌─────────────────┐                  │
│    │ 무료 AI 노출 진단│ ← 흰색 카드,    │
│    │ 업종 / 지역 입력 │   진한 보더,    │
│    │ [진단하기 →]    │   그림자        │
│    └─────────────────┘                  │
│    [idle/loading/result 패널]            │
└─────────────────────────────────────────┘
```

**핵심 변경사항:**
- 배경: 다크 그라디언트 → 연파랑→흰색 그라디언트
- 헤드라인: 흰색 → `#0F172A`
- 진단 카드: `glass-card`(어두운) → 순백 카드 + `border: 1.5px solid #E2E8F0` + `box-shadow`
- 업종 타일: 어두운 배경 기준 스타일 → 밝은 배경 기준 스타일
- 오브 효과: 제거 또는 훨씬 연하게 (배경 색과 동화)

### 4.4 진단 카드 (밝은 버전)

```tsx
{/* 진단 폼 카드 — 밝은 버전 */}
<div className="bg-white rounded-2xl p-5 mb-3 border"
  style={{
    borderColor: "#E2E8F0",
    boxShadow: "0 4px 6px rgba(15,23,42,0.07), 0 10px 40px rgba(37,99,235,0.08)",
  }}
>
  {/* 헤더 */}
  <div className="flex items-center justify-between mb-3">
    <p className="text-sm font-bold" style={{ color: "#0F172A" }}>무료 AI 노출 진단</p>
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: "#ECFDF5", color: "#065F46" }}>무료</span>
  </div>

  {/* 업종 표시 */}
  <div className="border rounded-lg px-3 py-2 text-sm"
    style={{
      background: selectedIndustry ? "#EFF6FF" : "#F8FAFC",
      borderColor: selectedIndustry ? "#BFDBFE" : "#E2E8F0",
      color: selectedIndustry ? "#1E40AF" : "#94A3B8",
    }}>
    {selectedIndustry ? label : "위에서 업종 선택"}
  </div>

  {/* 지역 입력 */}
  <input
    style={{
      background: "#F8FAFC",
      borderColor: regionError ? "#DC2626" : "#E2E8F0",
      color: "#0F172A",
    }}
    placeholder="예: 강남구"
  />

  {/* 버튼 */}
  <button
    style={{ background: "#2563EB" }}
    className="w-full py-3 rounded-xl text-sm font-bold text-white">
    AI 노출 현황 진단하기 →
  </button>

  <p className="text-center text-xs mt-2" style={{ color: "#64748B" }}>
    가입 없이 · 카드 없이 · 즉시 결과
  </p>
</div>
```

### 4.5 PanelResult (밝은 버전)

```tsx
{/* 결과 패널 — 밝은 배경용 */}
<div className="border rounded-2xl overflow-hidden bg-white"
  style={{ borderColor: "#E2E8F0", boxShadow: "0 4px 24px rgba(37,99,235,0.10)" }}>

  {/* 헤더 — 파랑 그라디언트 유지 (강조) */}
  <div className="px-4 py-3 flex items-center justify-between"
    style={{ background: "linear-gradient(90deg, #1E3A8A 0%, #2563EB 100%)" }}>
    ...
  </div>

  {/* Track 1 카드 — EFF6FF 배경 */}
  <div className="rounded-xl p-3"
    style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
    <p style={{ color: "#2563EB" }}>Track 1 · 네이버</p>
    <p style={{ color: "#1E40AF", fontFamily: "Outfit" }}>{t1}</p>
  </div>

  {/* Track 2 카드 — 연회색 배경 */}
  <div className="rounded-xl p-3"
    style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
    <p style={{ color: "#475569" }}>Track 2 · 글로벌 AI</p>
    <p style={{ color: "#0F172A" }}>{t2}</p>
  </div>
</div>
```

---

## 5. 섹션별 구체적 개선안

### 5.1 섹션 배경 새 순서 (리듬 개선)

```
[A] Hero        → 연파랑→흰색 그라디언트 (#F0F7FF → #FFFFFF)  ← 변경
[B] Why         → 순백 (#FFFFFF)                               ← 유지
[C] 작동 원리3  → 순백 (#FFFFFF)                               ← 유지
[D] ChatGPT 비교→ 연회색 (#F8FAFC)                            ← 유지
[E] AEO 비교    → 순백 (#FFFFFF)                               ← 유지
[F] HowItWorks  → 순백 (#FFFFFF)                               ← 유지
[G] 대시보드 미리보기 → 연파랑 (#EFF6FF)                        ← 변경 (현재 #F8FAFC)
[H] 서비스 원리 → 연회색 (#F8FAFC)                             ← 유지
[I] 신뢰 데이터 → 순백 (#FFFFFF)                               ← 유지
[J] 가격 앵커   → 연파랑 (#EFF6FF, 파랑 보더)                  ← 유지
[K] FAQ         → 연회색 (#F8FAFC)                             ← 유지
[L] Final CTA   → 다크 그라디언트 (유일한 어두운 섹션)           ← 유지
```

→ 히어로만 변경해도 전체 인상이 크게 달라짐.

### 5.2 WHY 섹션 개선 (Section 2)

**현재**: Before/After 2열 카드 — 구조 좋음, 유지
**추가 개선**: Before 카드에 실제 네이버 광고 화면과 유사한 UI 모킹 추가 (SVG)

```tsx
{/* 네이버 광고 비용 UI 모킹 */}
<div className="rounded-lg p-3 border mb-2" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
  <div className="flex justify-between text-xs mb-1">
    <span style={{ color: "#64748B" }}>이번 달 광고비</span>
    <span style={{ color: "#DC2626", fontWeight: 700 }}>-874,000원</span>
  </div>
  <div className="w-full rounded-full h-2" style={{ background: "#E2E8F0" }}>
    <div className="h-2 rounded-full" style={{ width: "87%", background: "#DC2626" }} />
  </div>
  <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>예산 소진율 87%</p>
</div>
```

### 5.3 HowItWorks 섹션 연결선 색상 강화

```tsx
{/* PC 전용 단계 연결선 — 현재 #BFDBFE, 유지 OK */}
{/* 개선: 점선 대신 실선 + 화살표 아이콘 추가 */}
<div
  className="hidden md:flex items-center absolute top-[52px]"
  style={{ left: "calc(33.33%+8px)", right: "calc(33.33%+8px)" }}
>
  <div style={{ flex: 1, height: "1px", background: "#BFDBFE" }} />
  <svg width="8" height="8" style={{ color: "#BFDBFE" }}>...</svg>
</div>
```

### 5.4 벤토 그리드 신뢰 섹션 (Section 9 강화)

현재 `+27.4%` 카드 + 3개 보조 카드 구조는 좋음.
개선: 메인 카드(`+27.4%`)를 더 임팩트 있게 — 숫자 크기 키우기

```tsx
{/* 현재 stat-number-xl = clamp(2.8rem, 6vw, 4rem) — 유지, 충분히 큼 */}
{/* 개선: 출처 링크를 더 눈에 띄게 */}
<a href="..." style={{ color: "rgba(255,255,255,0.8)", textDecoration: "underline" }}>
  네이버 공식 발표 원문 보기 →
</a>
```

### 5.5 업종 타일 — 밝은 배경용 스타일

```tsx
{/* 현재: 어두운 배경용 */}
style={{
  background: "rgba(255,255,255,0.06)",  // 거의 안 보임 → 어두운 배경에서만 OK
  color: "#CBD5E1",
  borderColor: "rgba(255,255,255,0.12)"
}}

{/* 새 밝은 배경용 */}
style={{
  background: "#FFFFFF",
  color: "#475569",
  borderColor: "#E2E8F0",
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)"
}}

{/* 선택됨 (동일하게 유지 OK) */}
style={{
  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  color: "#FFFFFF",
  borderColor: "transparent",
  boxShadow: "0 0 16px rgba(37,99,235,0.4)"
}}
```

---

## 6. 타이포그래피 개선안

### 6.1 히어로 헤드라인 크기 업

```css
/* 현재 */
.hero-headline {
  font-size: clamp(2rem, 5vw, 3rem);  /* 32~48px */
  color: #F8FAFC;
}

/* 개선 */
.hero-headline {
  font-size: clamp(2.6rem, 5.5vw, 3.6rem);  /* 42~57px */
  line-height: 1.10;
  letter-spacing: -0.04em;
  font-weight: 900;
  color: #0F172A;  /* 어두운 잉크 */
}
```

### 6.2 섹션 제목 크기 일관화

현재 `text-xl md:text-2xl` (20~24px) → **22~28px**로 상향 권장

```css
/* 섹션 h2 기준 */
.section-headline {
  font-size: clamp(1.4rem, 3vw, 1.75rem);  /* 22~28px */
  letter-spacing: -0.03em;
  font-weight: 900;
  color: #0F172A;
}
```

### 6.3 한국어 타이포그래피 최적화

```css
/* 한국어 줄바꿈 최적화 */
.break-keep { word-break: keep-all; }

/* 본문 가독성 */
.body-text {
  font-size: 0.9375rem;  /* 15px — 14px보다 가독성 ↑ */
  line-height: 1.7;
  color: #475569;
}
```

---

## 7. 인터랙션 및 마이크로 애니메이션 개선안

### 7.1 카드 순차 등장 (fade-up + delay)

```tsx
{/* HOW 섹션 3카드 순차 등장 */}
{steps.map((step, i) => (
  <div
    key={i}
    className="fade-up"
    style={{ transitionDelay: `${i * 0.12}s` }}
  >
    {/* 카드 내용 */}
  </div>
))}
```

### 7.2 업종 타일 클릭 → 진단폼 스무스 포커스

```tsx
const handleTileClick = (key: string) => {
  setSelectedIndustry(key);
  // 300ms 후 지역 입력 필드 포커스
  setTimeout(() => regionRef.current?.focus(), 300);
};
```

### 7.3 결과 카드 등장 애니메이션

```css
@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.panel-result-enter {
  animation: slide-up-fade 0.4s cubic-bezier(.22,1,.36,1) forwards;
}
```

---

## 8. 구체적 색상 및 그라디언트 레시피

### 8.1 히어로 배경 옵션 3가지

```css
/* ★ 추천: A안 — 연파랑 그라디언트 (신뢰감 + 밝음) */
background: linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 50%, #FFFFFF 100%);

/* B안 — 순백 + 파랑 노이즈 텍스처 */
background: #FFFFFF;
background-image: radial-gradient(#BFDBFE 1px, transparent 1px);
background-size: 32px 32px;
background-position: center;
/* 단, 카드 뒤에서는 배경 흰색으로 override */

/* C안 — 아주 연한 오프화이트 (가장 미니멀) */
background: #F8FAFC;
```

### 8.2 카드 그림자 레시피

```css
/* 기본 카드 (대부분의 콘텐츠 카드) */
.card-shadow-sm: 0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04);

/* 강조 카드 (진단폼, 히어로 결과) */
.card-shadow-md: 0 4px 6px rgba(15,23,42,0.07), 0 10px 40px rgba(37,99,235,0.08);

/* 파랑 글로우 카드 (KPI, 핵심 수치) */
.card-shadow-blue: 0 0 0 1px rgba(37,99,235,0.15), 0 8px 32px rgba(37,99,235,0.12);
```

### 8.3 강조 배지 레시피

```css
/* 네이버 AI 브리핑 적용 업종 */
.badge-ok: bg-[#ECFDF5] text-[#065F46] border border-[#6EE7B7]

/* 확대 중 */
.badge-soon: bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]

/* 미적용 */
.badge-no: bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]

/* 서비스 배지 (Eyebrow) */
.badge-brand: bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]
```

---

## 9. 구현 우선순위 로드맵

### Phase 1: 임팩트 최대 (4~5시간 예상)

| 순서 | 작업 | 파일 | 예상 효과 |
|------|------|------|----------|
| 1 | 히어로 배경 다크 → 밝은 그라디언트 | `HeroSection.tsx` + `globals.css` | ★★★★★ |
| 2 | 히어로 텍스트 색상 흰색 → `#0F172A` | `HeroSection.tsx` | ★★★★★ |
| 3 | 진단 카드 글래스 → 흰색+보더 | `HeroSection.tsx` | ★★★★ |
| 4 | 업종 타일 스타일 밝은 배경 기준으로 | `HeroSection.tsx` | ★★★★ |
| 5 | `hero-headline` 크기 2rem→2.6rem | `globals.css` | ★★★ |

### Phase 2: 품질 향상 (3~4시간 예상)

| 순서 | 작업 | 파일 | 효과 |
|------|------|------|------|
| 6 | PanelIdle/PanelResult 밝은 버전 | `HeroSection.tsx` | ★★★★ |
| 7 | 카드 순차 등장 `transitionDelay` | `page.tsx` 섹션들 | ★★★ |
| 8 | WHY 섹션 Before 카드에 광고비 UI 추가 | `page.tsx` | ★★★ |
| 9 | Section 7 대시보드 배경 #F8FAFC → #EFF6FF | `page.tsx` | ★★ |

### Phase 3: 모바일 최적화 (2~3시간)

| 순서 | 작업 | 파일 |
|------|------|------|
| 10 | 모바일 히어로 레이아웃 검증 | `HeroSection.tsx` |
| 11 | 업종 타일 모바일 2열 grid로 변경 고려 | `HeroSection.tsx` |
| 12 | 섹션 간격 모바일 최적화 | `page.tsx` |

---

## 10. Before / After 시각적 비교

### BEFORE (현재)
```
┌─────────────────────────────────────────┐
│ █████████████ 어두운 배경 ██████████████ │ ← 어둠
│  흰 텍스트 32~48px                       │
│  [어두운 업종 타일]                      │
│  [글래스모피즘 폼 카드]                  │
└─────────────────────────────────────────┘
```

### AFTER (추천안)
```
┌─────────────────────────────────────────┐
│  ░░░░░░░░░░ 연파랑 → 흰색 ░░░░░░░░░░  │ ← 밝음
│  짙은 텍스트 42~57px                    │
│  [흰색+보더 업종 타일]                   │
│  [흰색+그림자 폼 카드]                   │
└─────────────────────────────────────────┘
```

**변경 코드 1줄 요약:**
```
// HeroSection.tsx 58~61번 줄
// BEFORE:
background: "linear-gradient(135deg, #080D1A 0%, #0D1526 50%, #15113A 100%)"

// AFTER:
background: "linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 50%, #FFFFFF 100%)"
```

---

## 11. 주의사항 및 리스크

1. **PanelIdle/PanelResult**: 현재 다크 배경 가정으로 구현됨 → 밝은 배경으로 바꾸면 내부 텍스트/배경 색상 전체 교체 필요
2. **오브 글로우 효과**: 밝은 배경에서 어두운 파란색 blur orb는 너무 진하게 보임 → 제거하거나 훨씬 연하게 (opacity 0.05 이하)
3. **배경 페이드 전환**: 현재 히어로 하단에 `#FFFFFF`로 페이드하는 div 존재 → 밝은 히어로와 충돌 없음, 유지 가능
4. **글로벌 CSS**: `--aeo-hero-bg`, `--aeo-hero-surface` 등 다크 히어로 전용 토큰 존재 → 밝은 버전 토큰으로 교체 또는 추가 필요
5. **모바일**: 히어로 2열 그리드 → 모바일 단열 시, 밝은 배경에서 업종 타일→진단폼 흐름 UX 검증 필수

---

## 12. 참고 디자인 사례 (실측 분석)

| 서비스 | 히어로 배경 | 헤드라인 크기 | 특징 |
|--------|-----------|------------|------|
| Stripe | 흰색 + 상단 그라디언트 | ~60px | 고객사 로고 캐러셀, 넓은 여백 |
| Vercel | 흰색/다크 전환 지원 | ~72px | 제품 스크린샷 크게 |
| Linear | 흰색 | ~64px | 단순 + 강렬 타이포 |
| Notion | 흰색 + 연노랑 틴트 | ~56px | 직관적 UI 미리보기 |
| flex.team | 흰색 | ~48px | 사용자 문제 중심 카피 |
| **AEOlab (추천)** | **연파랑→흰색** | **42~57px** | **업종 인터랙션 중심** |

---

*© 2026 AEOlab 디자인 연구 문서. 내부 참조용.*
*다음 단계: 이 문서 기반으로 `frontend-dev` 에이전트로 Phase 1 (히어로 밝기 전환) 구현.*
