# AEOlab 랜딩 페이지 디자인 개편 — 작업 요약 문서

> 작성일: 2026-05-07  
> 목적: 새 대화창에서 랜딩 페이지 작업을 이어가기 위한 인계 문서  
> 담당: frontend-dev 에이전트 또는 직접 수정

---

## 1. 작업 배경과 목표

### 개편 이유
기존 `frontend/app/page.tsx` (랜딩 페이지)는 다음 문제가 있었다:
- 정보 블록 10개 — 처음 접속 시 서비스가 5초 안에 파악되지 않음
- 색상 7가지, 배경 6종, CTA 11개 — 시각 위계 없음
- 텍스트가 너무 작아 가독성 저하 (`text-xs` 남용)
- 모바일 최적화 부족

### 사용자 핵심 요구 (변하지 않는 기준)
1. **5초 룰** — 처음 접속 시 서비스가 5초 안에 파악 가능
2. **토스·카카오뱅크 스타일** — 한눈에 인식, 군더더기 없음
3. **항목·텍스트 크기 적절** — 너무 크거나 작지 않게
4. **모바일 반응형** — PC/모바일 모두 자연스럽게
5. **정보 이동 간편** — 블록 압축, CTA 집중

---

## 2. 디자인 원칙 (확정)

### 컬러 팔레트 (3색 단순화)
| 역할 | 색상 | 코드 |
|------|------|------|
| 주 색상 (CTA·강조) | 토스 블루 | `#0064FF` |
| 배경 (섹션 교차) | 오프화이트 | `#f7f7f5`, `#fafaf8` |
| 텍스트 | 다크 그레이 | `#111827` (gray-900) |

### 폰트
- **Pretendard** (한국어 가독성 최적화)
- CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`

### 헤드라인 (확정)
- **메인**: `손님이 검색했을 때, 우리 가게가 답이 되나요?`
  - 당근 수사의문문 패턴 + 캐치테이블 "우리 가게" 1인칭
- **서브**: `네이버 광고 1일치 비용으로, 한 달 동안 진단·개선합니다`
- **CTA**: `1분 무료로 우리 가게 점검받기`
- **가격 앵커**: `월 9,900원 · 첫 달 4,950원`

### 사장님 언어 변환 사전
| 기술 용어 | 사장님 언어 |
|---------|-----------|
| AI 검색 노출 | 손님이 검색했을 때 보이는지 |
| AI 가시성 점수 | 우리 가게 노출 점수 |
| 키워드 갭 | 손님이 찾는데 우리 가게에 빠진 단어 |
| 가이드 생성 | 오늘 할 일 안내 |
| 자동 재스캔 | 매주 자동 점검 |
| ChatGPT 인용 수 | ChatGPT가 우리 가게를 본 횟수 |

---

## 3. mockup 이력

| 파일 | 내용 | 상태 |
|------|------|------|
| `docs/landing_redesign_v3_mockup.html` | 1차 시도 — 간단 3블록 | 폐기 |
| `docs/mockup_landing_v2.html` | 구 버전 | 폐기 |
| `docs/landing_redesign_v5_mockup.html` | v5.3 — 현재 최신 완성 목업 | **기준 파일** |
| `docs/landing_redesign_v6_mockup.html` | v6.0 — 최신 트렌드 통합 최종 | **최신 목업** |

### v5.3 → v6.0 변경 내역 요약
- **v5.0**: 5블록 구조 + 한국 SaaS 검증 패턴 적용 (폰 mockup 4개)
- **v5.1**: 여백 과잉 수정 (CSS full-screen vh 제거 → 콘텐츠 높이만큼)
- **v5.2**: 텍스트·여백 7건 추가 축소 (PC 화면 너무 크다는 피드백)
- **v5.3**: STEP 01·02·03 폰 mockup 3개 → 카드형 전환 (Hero 직후 폰 1개 유지)
- **v6.0**: 최신 트렌드 4가지 + 구조 개선 통합 ← **현재 목표**

---

## 4. v6.0 적용된 변경 사항

### 디자인 트렌드 4가지

**① Subtle Mesh Gradient**
- Hero 배경: `radial-gradient` 3레이어 (블루 7% + 퍼플 5% + 스카이블루 4%)
- 최종 CTA 배경: 기존 단색 → Mesh Gradient 강화

```css
/* Hero */
.mesh-hero {
  background-color: #ffffff;
  background-image:
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(0, 100, 255, 0.07) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(99, 60, 255, 0.05) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 60% 10%, rgba(0, 180, 255, 0.04) 0%, transparent 50%);
}
```

**② Bento Grid — 신뢰 데이터 블록**
- 기존 `grid-cols-3` 균등 → 큰 카드(+27.4%, 2열) + 보조 카드 3개(1열 세로)
- 비대칭 배치로 시선이 메인 수치에 집중

**③ Floating Cards**
- 모든 카드에 멀티레이어 그림자: `0 20px 40px rgba(0,100,255,0.08)`
- hover: 위로 3px + 그림자 심화

**④ Scroll-triggered fade-in**
- Intersection Observer: 섹션 진입 시 `translateY(28px)→0` + `opacity 0→1` (0.55s)
- Hero 섹션은 즉시 노출

### 구조 개선

**대시보드 프리뷰 카드** (Block 1.5)
- 폰 mockup → 브라우저 윈도우 스타일 카드
- 3열 그리드: 점수 | 채널별 노출 | 빠진 단어+할 일

**ServiceMechanism 복구** (Block 2 토글)
- 게이트 3조건 (업종·가맹점·리뷰 수) → sm:grid-cols-3
- 점수 100점 4항목 카드
- 가능/불가능 2열 비교

**페이지 블록 구성 (v6.0)**
1. **Hero** — Mesh Gradient 배경 + 질문형 헤드라인 + CTA
2. **대시보드 프리뷰** — 카드형 진단 결과 예시
3. **WHY** — Before/After + 서비스 원리 토글
4. **HOW** — STEP 01·02·03 카드 (Floating)
5. **신뢰 데이터** — Bento Grid (+27.4% 메인 + 보조 3개)
6. **가격** — Floating 카드 + 약속 배지
7. **최종 CTA** — Mesh Gradient 강화
8. **FAQ** — 5개 accordion
9. **Footer**

---

## 5. 아직 하지 않은 작업 (다음 세션에서 할 것)

### 우선순위 HIGH

#### [A] v6.0 목업을 실제 코드에 적용
- **파일**: `frontend/app/page.tsx`
- **백업 존재**: `docs/landing_page_original_backup.tsx` (기존 page.tsx 전체)
- **작업 방법**: mockup HTML → Next.js TSX 변환
  - `class=` → `className=`
  - `style=""` → `style={{}}`
  - `<a>` → `<Link>` (next/link)
  - 인라인 SVG 그대로 사용 가능
  - TrackedCTA 컴포넌트 연결 (`/components/analytics/TrackedCTA.tsx`)
  - 기존 컴포넌트(`HowItWorksSection` 등)는 페이지에서 제거 후 새 블록으로 대체

#### [B] 컴포넌트 분리
현재 `page.tsx`가 264줄 — v6.0 적용 시 증가 가능. 블록별 컴포넌트 분리 권장:
- `HeroSection.tsx` (Block 1 + 1.5)
- `WhySection.tsx` (Block 2)
- `HowItWorksSection.tsx` — 기존 컴포넌트 재작성 또는 대체
- `TrustBentoSection.tsx` (Block 4 — Bento Grid)
- `PricingSection.tsx` (Block 5)

#### [C] Scroll Animation — CSS/JS 방식 결정
- 현재 목업은 vanilla JS Intersection Observer 사용
- Next.js 환경에서는 `useEffect` 훅으로 동일 구현
- 또는 `framer-motion` 라이브러리 도입 (`npm install framer-motion`)
  - 장점: 선언적 문법, 더 풍부한 애니메이션
  - 단점: 번들 크기 증가 (~30KB gzip)
  - **권장**: 번들 최적화 우선이면 vanilla Intersection Observer 유지

### 우선순위 MEDIUM

#### [D] 카운터 실측 연동
- 현재 목업: `12,847` 하드코딩
- 실제 코드: `GET /api/scan/trial-count` API 호출로 실측값 표시
- 컴포넌트: `useEffect`로 마운트 시 fetch → 상태 업데이트
- 에러 시: 숫자 숨기고 문구만 표시 (허위 수치 금지 원칙)

#### [E] 베타 후기 교체
- 현재: placeholder 텍스트 없음 (v5.3에서 Testimonials 블록 삭제됨)
- 실데이터 1명 이상 확보 후 추가 예정
- 파일 위치: `frontend/lib/testimonials.ts` (기존 파일 존재)

#### [F] MobileFloatingCTA 연동
- 기존 컴포넌트: `components/common/MobileFloatingCTA.tsx`
- 조건: scrollY > 600, /trial·/dashboard에서 숨김
- v6.0 랜딩 적용 후 자동 동작 (layout.tsx에 이미 포함 여부 확인 필요)

### 우선순위 LOW

#### [G] 실측 데이터 이후 추가 가능 블록
- 사용 후기 / 케이스 스터디 (베타 데이터 필요)
- 로고 배너 (언론 보도 있을 경우)

---

## 6. 현재 운영 중인 관련 컴포넌트

| 컴포넌트 | 경로 | v6.0에서의 처리 |
|---------|------|--------------|
| HeroIndustryTiles | `components/landing/HeroIndustryTiles.tsx` | 제거 (Hero 단순화) |
| WhyNotShownSection | `components/landing/WhyNotShownSection.tsx` | 제거 (WHY 블록으로 통합) |
| HowItWorksSection | `components/landing/HowItWorksSection.tsx` | 내용 유지, 스타일 개편 |
| ServiceMechanismSection | `components/landing/ServiceMechanismSection.tsx` | 토글로 이동 (WHY 블록 안) |
| DiagnosticToolsSection | `components/landing/DiagnosticToolsSection.tsx` | 제거 (HOW 블록 대체) |
| AEOvsTraditionalSection | `components/landing/AEOvsTraditionalSection.tsx` | 제거 (WHY Before/After 대체) |
| Testimonials | `components/landing/Testimonials.tsx` | 보류 (실데이터 없음) |
| TrackedCTA | `components/analytics/TrackedCTA.tsx` | 그대로 사용 |
| MobileFloatingCTA | `components/common/MobileFloatingCTA.tsx` | 그대로 유지 |

---

## 7. 작업 시작 명령 (새 대화창용)

### 목업 → 코드 적용 시작
```
docs/landing_redesign_v6_mockup.html 을 기준으로 
frontend/app/page.tsx 를 전면 재작성해줘.
백업: docs/landing_page_original_backup.tsx 참고.
TrackedCTA, Link(next/link), className 변환 적용.
Scroll fade-in은 useEffect + IntersectionObserver로 구현.
```

### 특정 블록만 수정 시
```
docs/landing_redesign_v6_mockup.html 의 BLOCK 4 (Bento Grid 신뢰 데이터)를
frontend/components/landing/TrustBentoSection.tsx 로 만들어줘.
```

### 배포 후 확인
```
랜딩 페이지 변경사항 서버에 배포해줘.
서버: root@115.68.231.57, /var/www/aeolab/frontend/
```

---

## 8. 참고 디자인 레퍼런스 (조사 완료)

| 사이트 | 차용 가능 패턴 | 차용 불가 |
|-------|-------------|---------|
| 토스 | 대형 숫자·질문형 헤드라인·단일 CTA | 3D 일러스트·복잡한 인터랙션 |
| 카카오뱅크 | 일상 비유 가격 설명·단순 배경 | 옐로 25% 면적·명사형 카피 정체성 |
| 캐치테이블 | "우리 가게" 1인칭·카톡 상담 노출 | 예약 플랫폼 특화 레이아웃 |
| 당근비즈니스 | 슈퍼-숫자 강조·실증 데이터 인용 | 지역 커뮤니티 톤 |
| 밀리의서재 | 일상 비유 가격 앵커링 | 콘텐츠 구독 특화 패턴 |
| 도도포인트 | 시작가 숫자 전면 노출 | POS 연동 중심 UX |

### 사장님 페르소나에 맞는 2025-2026 트렌드
| 트렌드 | 적용 여부 | 이유 |
|-------|---------|------|
| Bento Grid | ✅ 적용 | 정보 위계 명확, 사장님 직관적 |
| Mesh Gradient | ✅ 적용 (미세) | 신뢰감 + 현대감 (강하지 않게) |
| Floating Cards | ✅ 적용 | 카드 분리감으로 정보 소화 쉬움 |
| Scroll fade-in | ✅ 적용 | 스크롤 유도, 정보 순차 노출 |
| 3D 일러스트 | ❌ 제외 | 제작 비용·소상공인 신뢰 저해 |
| Brutalist | ❌ 제외 | 사장님 연령대 이질감 |
| Dark Mode | ❌ 제외 | 가독성 저하 위험 |
| Glow Effect | ❌ 제외 | 게임·스타트업 이미지 |

---

## 9. 금지 사항 (반드시 지킬 것)

1. **허위 수치 절대 금지** — 카운터(12,847)는 `/api/scan/trial-count` 연동 전까지 하드코딩 유지. API 실패 시 숫자 숨김
2. **text-xs 남용 금지** — 최소 `text-sm` (12px 이상). 카드 내부 보조 정보만 `text-xs` 허용
3. **CTA 11개 이상 금지** — 페이지당 Primary CTA 1~2개 원칙
4. **색상 7색 이상 금지** — 토스 블루·오프화이트·그레이·에메랄드(할인)·앰버(경고) 5색 이내
5. **기존 백업 파일 삭제 금지** — `docs/landing_page_original_backup.tsx` 보존

---

## 10. 파일 위치 요약

| 항목 | 경로 |
|------|------|
| 현재 운영 랜딩 | `frontend/app/page.tsx` |
| 기존 백업 | `docs/landing_page_original_backup.tsx` |
| v5.3 목업 (기준) | `docs/landing_redesign_v5_mockup.html` |
| **v6.0 목업 (최신)** | `docs/landing_redesign_v6_mockup.html` |
| 이 문서 | `docs/landing_redesign_session_summary.md` |
| 관련 컴포넌트 | `frontend/components/landing/` |
| TrackedCTA | `frontend/components/analytics/TrackedCTA.tsx` |
| 분석 유틸 | `frontend/lib/analytics.ts` |

---

*마지막 작업: 2026-05-07 — v6.0 목업 완성 (Mesh Gradient + Bento Grid + Floating Cards + Scroll animation + ServiceMechanism 복구)*
