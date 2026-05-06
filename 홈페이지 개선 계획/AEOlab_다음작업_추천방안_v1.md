# AEOlab 다음 작업 — 추천 방안 v1.0
**작성일:** 2026-04-24
**대상 시점:** 홈 개선 v1.0 + Trial Conversion Funnel + 7일 액션 카드 완료 직후
**목표:** BEP 20명 달성을 위한 **모바일 전환·바이럴 깔때기 마감**

---

## 🎯 단일 추천: "모바일 전환 깔때기 마감" 묶음 (총 6~8h)

> **모바일 floating CTA(2~3h)** + **결과 페이지 카카오톡 공유(4~5h)** 를 한 번에 진행

### 왜 이 묶음인가
1. **모바일 70%+ 트래픽** — 카카오 공유로 들어오는 소상공인 사장님이 절대 다수
2. **둘 다 GA4로 즉시 측정 가능** — `mobile_cta_click`, `kakao_share_click`, `kakao_share_referral` 이벤트
3. **외부 API 비용 0원** — 카카오 공유 SDK는 무료, floating CTA는 순수 CSS
4. **1인 운영 부담 0** — 신규 컴포넌트 2~3개, 신규 백엔드 0건
5. **BEP 골든 패스 완성** — 진단 → 공유 → 친구 진단 → 가입 → 결제 바이럴 루프 마감

### 왜 지금인가
- 홈 개선 v1.0 + Conversion Funnel 인프라가 이미 깔려 있음
- 이 두 개가 빠지면 **모바일 사장님이 결과 보고 끝나는 사일로 구조** — 친구에게 공유할 동기·경로가 없음
- GA4 데이터 누적 전이라도, 이 두 개는 5개 점검 문서 모두가 권장한 항목이라 데이터 없이 진행 안전

---

## 📐 1단계 — 모바일 Floating CTA (2~3시간)

### 사용자 시나리오
사장님이 모바일로 홈/`/demo`/`/pricing` 페이지를 스크롤하다가 화면 어디에 있어도 **항상 화면 하단에 "무료 진단 시작" 버튼**이 보이도록.

### 노출 규칙
| 페이지 | 노출 | 라벨 |
|---|---|---|
| `/` (홈) | 히어로 스크롤아웃 후 등장 | "무료 진단 시작 →" |
| `/demo` | 진입 즉시 등장 | "내 가게 무료 진단 →" |
| `/pricing` | 진입 즉시 등장 | "무료 진단 시작 →" (pricing 진입자도 진단 먼저) |
| `/trial` | 노출 안 함 | (이미 진단 중) |
| `/dashboard` | 노출 안 함 | (이미 회원) |

### 디자인 명세
```
하단 고정 (mobile only, max-width: 768px)
배경: 백색 + shadow-lg + border-t border-gray-100
높이: 64px
버튼:
  - 풀 너비 (좌우 16px 패딩)
  - bg-blue-600 text-white text-base font-bold
  - py-3 rounded-xl
  - "무료 진단 시작 →"
스크롤 임계값:
  - 홈: window.scrollY > 600 (히어로 지난 후)
  - demo/pricing: 항상 표시
모바일만: hidden md:hidden 또는 자체 viewport check
```

### 구현 파일
- 신규: `frontend/components/common/MobileFloatingCTA.tsx` (1개 컴포넌트)
- 수정: `frontend/app/layout.tsx` 또는 각 page에 삽입
- GA4: `trackEvent('mobile_floating_cta_shown')` (1회/세션), `trackEvent('mobile_floating_cta_click', {page})`

### 검증 기준
- [ ] iPhone 13 Pro(390×844) 세로 화면 하단 고정 정상
- [ ] 데스크톱(`md:` 이상)에서 안 보임
- [ ] 키보드 올라올 때 안 가려짐 (`env(safe-area-inset-bottom)` 적용)
- [ ] 스크롤 시 깜빡임 없음

---

## 📤 2단계 — 결과 페이지 카카오톡 공유 (4~5시간)

### 사용자 시나리오
1. 사장님이 무료 진단 받음 → 점수 확인
2. **"카톡으로 친구에게 공유 →"** 버튼 탭
3. 카카오톡 친구 선택 → 메시지 발송 (이미지 카드 + 링크)
4. 친구가 받은 카드 탭 → `https://aeolab.co.kr/?ref=kakao_share` 진입
5. 같은 업종이면 → "당신도 무료 진단 받아보세요" 자연 유입

### 공유 메시지 디자인 (Feed Template)
```
[이미지 카드 — 600×400]
  내 가게 AI 노출 진단 결과
  
  점수 67점 / 100점
  "강남 카페" 업종 평균 51점
  
  - 네이버 AI 브리핑 노출률 22%
  - ChatGPT 인용 횟수 6/100회
  
  ※ 무료 진단 — 회원가입 불필요

본문 텍스트:
  "사장님도 30초면 확인됩니다 ↓"

버튼 1: "내 가게도 무료 진단" → https://aeolab.co.kr/trial?ref=kakao_share
버튼 2: "AEOlab 자세히 보기" → https://aeolab.co.kr/?ref=kakao_share
```

### 구현 명세

#### 2-1. Kakao SDK 추가
- `frontend/app/layout.tsx` 또는 별도 컴포넌트에 Kakao SDK 스크립트 로드
- `next/script` `strategy="afterInteractive"`
- `Kakao.init(NEXT_PUBLIC_KAKAO_APP_KEY)` (환경변수 이미 존재)

#### 2-2. 공유 버튼 컴포넌트
- 신규: `frontend/components/common/KakaoShareButton.tsx`
- props: `{score, businessName, category, region, trialId?}`
- 클릭 → `Kakao.Share.sendDefault({ objectType: 'feed', content: {...}, buttons: [...] })`
- GA4: `trackEvent('kakao_share_click', {trial_id, score})`
- Kakao SDK 미로드 시 fallback: `navigator.share` 또는 URL 복사

#### 2-3. 공유 카드 이미지 동적 생성
- 신규 백엔드 엔드포인트: `GET /api/share/image/{trial_id}` 또는 `?score=X&name=Y`
- 또는 기존 `report/growth-card` 패턴 재활용
- Pillow로 600×400 PNG 생성 (서버 폰트 NotoSansCJK 재활용)
- 캐싱: trial_id 기반 24h Redis/메모리 캐시

#### 2-4. 결과 페이지에 통합
- `frontend/app/(public)/trial/components/TrialResultStep.tsx`
- 점수 카드 우측 또는 ClaimGate 위에 KakaoShareButton 배치
- 라벨: "📤 카톡으로 공유"

#### 2-5. 유입 추적
- 랜딩 진입 시 `?ref=kakao_share` 쿼리 → GA4 `referral_source: kakao_share` 자동 표시
- `lib/analytics.ts`에 `trackReferral(source)` 헬퍼

### 검증 기준
- [ ] iPhone Safari·Android Chrome에서 카카오톡 앱 정상 호출
- [ ] 공유 카드 이미지 4G 환경에서 3초 내 생성·전송
- [ ] 받은 사람이 카드 탭 시 `aeolab.co.kr/?ref=kakao_share` 정상 진입
- [ ] GA4에 `kakao_share_click` 이벤트 발화 확인

---

## 🛠 통합 구현 순서 (총 6~8h)

| 순 | 작업 | 시간 | 비고 |
|---|---|---|---|
| 1 | `MobileFloatingCTA.tsx` 컴포넌트 + layout/page 삽입 | 1.5h | 가장 단순, 먼저 |
| 2 | GA4 이벤트 트래킹 추가 (`mobile_cta_*`) | 0.5h | |
| 3 | Kakao SDK 로드 컴포넌트 + 환경변수 점검 | 0.5h | |
| 4 | `KakaoShareButton.tsx` 신규 + Feed 템플릿 작성 | 1.5h | |
| 5 | 백엔드 `GET /api/share/image/{trial_id}` (Pillow PNG) | 1.5h | growth_card.py 패턴 재활용 |
| 6 | `TrialResultStep.tsx`에 공유 버튼 통합 | 0.5h | |
| 7 | `?ref=kakao_share` 유입 GA4 추적 | 0.5h | |
| 8 | 모바일 실기기 검증 (iPhone·Android) | 1h | |
| 9 | 서버 배포 + GA4 이벤트 발화 확인 | 0.5h | |

---

## 📊 측정 지표 (배포 1주 후)

| 지표 | 측정 위치 | 목표 |
|---|---|---|
| 모바일 floating CTA 클릭률 | GA4 `mobile_floating_cta_click / shown` | 8%+ |
| 카톡 공유 버튼 클릭률 | GA4 `kakao_share_click / page_view (/trial result)` | 5%+ |
| 카톡 공유 → 신규 유입 | GA4 `referral_source: kakao_share` 신규 사용자 | 누적 측정 |
| 카톡 유입 → 무료 진단 전환 | `?ref=kakao_share` → `trial_start` | 25%+ |
| 모바일 무료 진단 완료율 | `trial_complete / trial_start` (모바일 세그먼트) | 50%+ |

### 2주 후 의사결정 기준
- 카톡 공유 클릭률 **5% 미만** → 버튼 위치·문구 개선
- 공유 → 진단 전환 **25% 미만** → 받는 카드 디자인 개선 (점수 강조 약함)
- 모바일 floating CTA 클릭률 **3% 미만** → 노출 임계값 재조정 또는 라벨 변경

---

## 💰 비용·리스크

| 항목 | 비용 | 리스크 |
|---|---|---|
| Kakao SDK | 무료 | 카카오 정책 변경 시 SDK 업데이트 필요 |
| Pillow PNG 생성 | 0원 (서버 CPU) | 동시 생성 100건+ 시 RAM 부담 → 캐시 필수 |
| GA4 이벤트 추가 | 0원 | 무료 한도 내 |
| 모바일 floating CTA | 0원 | UX 거부감 (너무 큼/방해) → 사용자 피드백 모니터링 |
| 신규 컴포넌트 3개 | 1인 운영 부담 미세 | 향후 Kakao SDK 업그레이드만 챙기면 됨 |

---

## ⚠️ 의존성·전제

- **카카오 환경변수 점검**: `NEXT_PUBLIC_KAKAO_APP_KEY` (이미 존재) — 카카오 디벨로퍼 콘솔에서 도메인 `aeolab.co.kr` 등록되어 있어야 함
- **모바일 실기기 테스트 필수**: 시뮬레이터로는 카카오 앱 호출 검증 불가
- **GA4 데이터 누적 24~48h 후 1차 이벤트 발화 확인** 권장

---

## 🔄 대안 시나리오

### A) 추천안 그대로 (1+2번, 6~8h)
이 문서대로 진행. 가장 효과 큰 묶음.

### B) 1번만 먼저 (2~3h)
모바일 floating CTA만 빠르게. 카카오 공유는 후순위.
- 장점: 즉시 배포, 즉시 측정
- 단점: 바이럴 채널 미완성

### C) GA4 데이터 누적 대기 (48h 후 결정)
이번 주는 코드 변경 없이 측정만. 48h 후 가장 약한 지점 보고 결정.
- 장점: 데이터 기반 결정
- 단점: BEP 달성 일정 지연

### D) 3번 먼저 (PlanRecommender → 직접 결제, 3~4h)
회원가입 후 결제 깔때기 강화. 깔때기 마지막 단계.
- 단점: 진단·체험 단계가 약하면 결제까지 도달자가 적음 → 효과 제한적

**추천:** A (1+2번 묶음).

---

## 📁 신규/수정 파일 예상

### 프론트엔드 (신규 3 + 수정 4)
- 신규: `components/common/MobileFloatingCTA.tsx`
- 신규: `components/common/KakaoShareButton.tsx`
- 신규: `components/common/KakaoSDKLoader.tsx`
- 수정: `app/layout.tsx` (Kakao SDK 로드, MobileFloatingCTA 조건부 렌더)
- 수정: `app/(public)/trial/components/TrialResultStep.tsx` (공유 버튼)
- 수정: `lib/analytics.ts` (`trackMobileCTA`, `trackKakaoShare`, `trackReferral`)
- 수정: `app/page.tsx`, `app/(public)/{demo,pricing}/page.tsx` (floating CTA 노출 규칙)

### 백엔드 (신규 1 + 수정 1)
- 신규: `routers/share.py` 또는 `routers/scan.py`에 `GET /api/share/image/{trial_id}`
- 수정: `services/growth_card.py` 패턴 재활용해서 600×400 공유용 PNG 생성 함수 추가

### DB
- 변경 없음 (trial_scans에 이미 데이터 다 있음)

---

## 결정 필요

진행 결정해주시면:
1. **A 추천안 그대로** → frontend-dev + backend-dev 병렬 호출 → 즉시 구현 시작
2. **B (1번만)** → frontend-dev 단일 호출, 카카오는 보류
3. **C (대기)** → 48h 후 GA4 데이터 보고 재결정
4. **D 또는 다른 방향** → 말씀해주시면 그 방향 분석

*5문서 검토 + 1인 운영 현실 + GA4 측정 인프라 활용 종합 결론.*
