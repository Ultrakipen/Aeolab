# INACTIVE 업종 가치 제안 및 수익 모델 전략 v1.0

> 작성일: 2026-05-03
> 작성자: next-feature 에이전트
> 참조: score_engine.py, briefing_engine.py, service_unification_v1.0.md, dashboard/page.tsx
> 상태: 기획 초안 — 구현 착수 전 사용자 확인 필요

---

## 핵심 인사이트 (1페이지 요약)

**현재 문제:** AEOlab의 홍보 메시지가 "네이버 AI 브리핑"에 집중되어 있어 INACTIVE 업종(의료, 법무, 교육, 부동산, 인테리어 등 14개 업종)이 가입 후 "우리 업종은 해당 없다"며 이탈.

**핵심 발견:**
- INACTIVE 업종의 DUAL_TRACK_RATIO는 이미 `global 40~80%`로 설정되어 있음. Track2 점수가 사실상 이들의 주 성과 지표임에도 UI는 여전히 Track1(네이버) 위주로 배치됨
- 현재 `IneligibleBusinessNotice`는 "비대상입니다"로 시작하는 방어적 메시지. 가치를 먼저 보여주지 않음
- `GlobalAIBanner`는 "점수 30 미만일 때만" 표시되는 경고성 배너. INACTIVE 업종의 주 채널을 지속적으로 추적하는 허브가 없음
- Track2 스코어(Gemini 100회 + ChatGPT + Google AI Overview)는 이미 4개 AI 채널을 동시 측정하고 있음. 이 데이터를 INACTIVE 업종 전용 대시보드로 재조직하면 추가 비용 없이 새 가치 제안 가능

**핵심 방향:**
> "네이버를 넘어서는 업종의 전문가 신뢰도를 ChatGPT·Gemini·Google AI에서 먼저 보이게"

---

## 1. INACTIVE 업종별 Pain Point 분석

### 1.1 업종 분류 (14개 INACTIVE)

| 업종 | 카테고리 키 | DUAL_TRACK global 비율 | 주요 AI 플랫폼 | 핵심 고민 |
|------|------------|----------------------|--------------|---------|
| 의료 | medical | 45% | ChatGPT(증상 검색), Gemini | "우리 병원 이름이 ChatGPT에서 언급되는가?" |
| 법무 | legal | 80% | ChatGPT, Perplexity | "법률 질문 시 우리 사무소를 추천하는가?" |
| 학원 | education | 45% | Gemini(커리큘럼 검색) | "우리 학원 프로그램이 AI에서 소개되는가?" |
| 과외/튜터링 | tutoring | 45% | Gemini, ChatGPT | "내 전문 분야 검색 시 노출되는가?" |
| 부동산 | realestate | 35% | ChatGPT(매물 정보) | "지역 매물 검색 시 우리 사무소가 나오는가?" |
| 인테리어 | interior | 45% | Gemini(포트폴리오 탐색) | "인테리어 스타일 검색 시 내 작업이 보이는가?" |
| 자동차 정비 | auto | 35% | ChatGPT(차종별 수리) | "차종별 수리 비용 검색 시 노출되는가?" |
| 청소 | cleaning | 45% | ChatGPT | "전문 청소 서비스 검색 시 나오는가?" |
| 쇼핑 | shopping | 90% | 글로벌 AI 압도적 | "상품명 검색 시 우리 가게가 나오는가?" |
| 패션 | fashion | 45% | Gemini(스타일 추천) | "스타일 추천 검색 시 우리 브랜드가 나오는가?" |
| 사진 | photo | 35% | Gemini, ChatGPT | "지역 사진관 검색 시 노출되는가?" |
| 영상 | video | 45% | ChatGPT(제작사 추천) | "영상 제작사 추천 시 나오는가?" |
| 디자인 | design | 65% | Gemini(레퍼런스 탐색) | "디자인 스타일 검색 시 내 포트폴리오가 보이는가?" |
| 기타 | other | 40% | 업종별 상이 | 가변적 |

### 1.2 공통 Pain Point

1. **전문성 증명의 어려움**: 소상공인 법무사무소·의원·학원은 "왜 당신인가"를 AI 채널에서 보여줄 방법을 모름
2. **긴 검토 주기**: ACTIVE 업종(음식점)과 달리 법무·의료·교육은 고객이 AI로 사전 조사 후 연락. AI 미노출 = 존재 자체가 비교 대상 외
3. **콘텐츠 자산 미활용**: 이미 네이버 블로그·사무소 홈페이지에 전문성 콘텐츠가 있지만 AI가 인식하는 형식(JSON-LD, 구조화)으로 되어 있지 않음
4. **비교 기준 부재**: "내가 ChatGPT에서 잘 보이는지"를 확인할 방법 자체가 없음 → AEOlab의 Track2 측정이 희소 가치

---

## 2. 가치 제안 메시지

### 2.1 핵심 리포지셔닝

**기존 (ACTIVE 중심):**
> "네이버 AI 브리핑에 우리 가게가 나오나요?"

**INACTIVE 업종 전용:**
> "ChatGPT가 법률 질문을 받을 때, 당신의 사무소를 추천하나요?"
> "Gemini가 학원을 추천할 때, 우리 학원이 그 목록에 있나요?"

### 2.2 랜딩 페이지 헤드라인 후보 (INACTIVE 업종 방문자 감지 시 분기 표시)

**A안 — 전문직 중심:**
> "AI에게 전문가를 추천받는 시대, 당신의 사무소는 목록에 있나요?"

**B안 — 보편적:**
> "ChatGPT·Gemini·Google AI, 내 사업장이 검색될 때 나오는지 지금 확인하세요"

**C안 — 구체적 수치 강조:**
> "전국 소상공인 중 ChatGPT에서 검색되는 곳은 몇 %일까요? (측정 시작 전에는 0%입니다)"

**권장:** B안. A안은 전문직 한정 소구, C안은 데이터 확보 전 사용 불가.

### 2.3 대시보드 INACTIVE 안내 메시지 교체 방향

**현재 `IneligibleBusinessNotice`의 첫 문장:**
> "XXX 업종은 현재 네이버 AI 브리핑 비대상입니다"

**개선 방향 (부정 → 긍정 전환):**
> "XXX 업종의 고객은 네이버보다 ChatGPT·Gemini에서 더 많이 검색합니다. AEOlab은 글로벌 AI 노출을 전담 측정합니다."

이 변경은 `IneligibleBusinessNotice.tsx` 한 파일 수정만으로 가능. DB·백엔드 변경 없음.

---

## 3. 신규 기능 제안 (5개)

### 기능 1. INACTIVE 전용 "글로벌 AI 허브" 대시보드 재배치
**구현 난이도: 쉬움 | 비용 추가: 0원 | 예상 전환율 기여: 높음**

**현재 문제:**
- INACTIVE 사용자가 대시보드를 열면 `IneligibleBusinessNotice`(경고)가 먼저 보이고, Track2 데이터(이미 측정된 핵심 가치)는 페이지 하단에 묻혀 있음
- `GlobalAIBanner`는 globalScore < 30일 때만 노출. 정작 "지금은 0점이니 이렇게 개선하세요"라는 핵심 행동 지시가 없음

**변경 내용:**
- `eligibility === "inactive"` 조건 시 대시보드 섹션 순서 변경
  - 현재: Track1 섹션 → Track2 섹션
  - 변경: Track2 섹션 최상단 배치 → Track1(네이버 기초) 하단
- `IneligibleBusinessNotice` 메시지 교체 (위 §2.3 방향)
- `GlobalAIBanner`를 INACTIVE 업종에서는 globalScore 무관 상시 표시로 변경. "지금은 X점, 개선하면 Y점 목표" 형식 추가

**변경 파일:**
- `frontend/app/(dashboard)/dashboard/page.tsx` — 섹션 조건부 순서 변경
- `frontend/components/dashboard/IneligibleBusinessNotice.tsx` — 메시지 교체
- `frontend/components/dashboard/GlobalAIBanner.tsx` — 조건 완화 + 목표 점수 추가

**구현 시간 예상: 2~3시간**

---

### 기능 2. AI 채널별 업종 맞춤 개선 가이드
**구현 난이도: 보통 | 비용 추가: 0원 (기존 gap_analyzer 재활용) | 예상 전환율 기여: 높음**

**현재 문제:**
- `gap_analyzer.py`의 `_GAP_REASONS`는 `LOCATION_BASED` 컨텍스트 메시지만 있음
- INACTIVE 업종(법무, 의료, 교육)에 "소개글 Q&A를 추가하세요" 같은 ACTIVE 업종용 가이드가 그대로 노출됨

**변경 내용:**
- `gap_analyzer.py`에 `NON_LOCATION` ScanContext별 gap_reason 메시지 추가
  - legal: "법률 상담 질문 패턴에 맞는 FAQ를 홈페이지에 추가하면 ChatGPT 인용 가능성이 높아집니다"
  - medical: "증상별 Q&A를 홈페이지 구조화 데이터(FAQ 스키마)로 표시하면 Google AI Overview에 인용됩니다"
  - education: "커리큘럼·수강 후기를 JSON-LD로 마크업하면 Gemini 검색에서 인용 후보가 됩니다"
- `guide_generator.py`에 INACTIVE 업종별 가이드 프롬프트 분기 추가 (Claude Sonnet 호출 횟수 변화 없음 — 기존 가이드 생성 시 프롬프트 보강)

**변경 파일:**
- `backend/services/gap_analyzer.py` — INACTIVE ScanContext gap_reason 메시지 추가
- `backend/services/guide_generator.py` — 업종 그룹별 가이드 프롬프트 분기

**구현 시간 예상: 4~6시간**

---

### 기능 3. "AI 검색 지식그래프" 점검 체크리스트
**구현 난이도: 보통 | 비용 추가: 0원 | 예상 전환율 기여: 중간**

**배경:**
- INACTIVE 업종(법무·의료·교육·디자인)의 Track2 개선 핵심은 **구조화 데이터(JSON-LD)**와 **Google 비즈니스 프로필** 완성도
- 현재 `/schema` 페이지에 JSON-LD 생성 기능은 있지만, 사용자가 "내가 지금 뭘 해야 하는지"를 모름

**변경 내용:**
- 신규 컴포넌트 `GlobalAIChecklist.tsx` — 5개 항목 체크리스트
  1. Google 비즈니스 프로필 등록 여부 (google_place_id 존재 확인)
  2. 웹사이트 JSON-LD 스키마 설치 여부 (schema_seo 점수 기반)
  3. 웹사이트 Open Graph 태그 (schema_seo 세부 항목)
  4. ChatGPT 실제 노출 확인 (latest_scan.chatgpt_result.mentioned)
  5. Gemini 실제 노출 확인 (latest_scan.gemini_result.mentioned 추정)
- INACTIVE 업종 대시보드에 `GlobalAIChecklist` 삽입 (Track2 섹션 바로 아래)
- 체크 완료 항목은 초록, 미완료는 빨간 상태 표시 + 각 항목에 "지금 하기" 링크

**활용 기존 데이터:** 별도 API 호출 없음. 이미 `latestScan`, `business` 객체에서 추출 가능.

**변경 파일:**
- `frontend/components/dashboard/GlobalAIChecklist.tsx` — 신규 (약 100줄)
- `frontend/app/(dashboard)/dashboard/page.tsx` — INACTIVE 조건부 삽입

**구현 시간 예상: 3~4시간**

---

### 기능 4. INACTIVE 업종별 "경쟁사 AI 노출 비교"
**구현 난이도: 보통 | 비용 추가: ~$0.5/월 (Gemini 추가 쿼리 20명 기준) | 예상 전환율 기여: 높음**

**배경:**
- ACTIVE 업종은 경쟁사 비교(`CompetitorKeywordCompare`)가 네이버 플레이스 기반
- INACTIVE 업종은 "경쟁 법무사무소가 ChatGPT에서 얼마나 노출되는지"를 비교할 수단이 없음

**변경 내용:**
- 기존 `GET /api/report/competitors/{biz_id}` 응답에 `track2_score`가 이미 포함됨 (scan_results의 competitor_scores 기반)
- 신규 컴포넌트 `GlobalAICompetitorCard.tsx` — INACTIVE 전용 경쟁사 Track2 비교
  - "내 ChatGPT 노출: X회 / 경쟁사 평균: Y회" 비교 바차트
  - "경쟁사 중 AI 노출 1위: [사업장명] (Z점)" 표시
- INACTIVE 대시보드의 경쟁사 섹션에 삽입 (기존 `CompetitorKeywordCompare` 대신 또는 추가로)
- 경쟁사 데이터가 없는 경우 "경쟁사를 등록하면 비교가 가능합니다" 안내 + 등록 CTA

**비용 분석:**
- 경쟁사 스캔 시 이미 Gemini/ChatGPT를 사용 중 — 추가 비용 없음
- 단, 경쟁사 3개 추가 등록 시 스캔 횟수 증가 → Basic 기준 Gemini ~$0.03/스캔 × 3개 × 4회/월 = ~$0.36/월/사용자. 20명 기준 ~$7.2/월 추가 (허용 범위)

**변경 파일:**
- `frontend/components/dashboard/GlobalAICompetitorCard.tsx` — 신규 (약 80줄)
- `frontend/app/(dashboard)/dashboard/page.tsx` — INACTIVE 조건부 삽입

**구현 시간 예상: 4~5시간**

---

### 기능 5. Trial 결과 INACTIVE 전용 "전문성 AI 진단" 결과 페이지
**구현 난이도: 보통 | 비용 추가: 0원 | 예상 전환율 기여: 매우 높음 (Trial → 유료 직결)**

**배경:**
- 현재 Trial 결과(`TrialResultStep`)는 ACTIVE/INACTIVE 구분 없이 동일한 UI
- INACTIVE 업종이 Trial을 해도 "AI 브리핑 노출 0건"만 보이고 "ChatGPT에서 나왔는지"는 잘 보이지 않음
- INACTIVE 사용자의 Trial → 유료 전환 핵심 훅은 "ChatGPT가 경쟁사를 언급하는 실제 텍스트"를 보여주는 것

**변경 내용:**
- `TrialResultStep.tsx`에 `eligibility === "inactive"` 분기 추가
  - INACTIVE 결과 화면 상단: "ChatGPT가 이 지역 유사 업종을 어떻게 소개하는지 확인했습니다"
  - 핵심 수치 재배치: Track2(글로벌 AI) 점수를 최상단 히어로 수치로 배치
  - "경쟁사는 AI에서 X회 언급됨 / 내 사업장은 Y회" 비교 (trial 스캔 시 1개 경쟁사 자동 스캔 추가 — Gemini 10회 내에서 처리)
  - CTA: "유료 전환 시 ChatGPT·Gemini 전체 노출 상세 분석 + 개선 가이드"

**주의 사항:**
- Trial은 Gemini 10회 한도. 경쟁사 1개 추가 스캔은 10회 내에서 분배 (현재 10회 전부 본인 사업장에 사용 중이라면 5+5 분리 필요 — `trial_scan.py` 확인 후 결정)
- 서버 RAM 제약: Trial 동시 처리 중 경쟁사 스캔 추가는 Semaphore 큐 대기 필요

**변경 파일:**
- `frontend/app/(public)/trial/components/TrialResultStep.tsx` — INACTIVE 분기 추가
- `backend/routers/scan.py` — `POST /api/scan/trial` 에 INACTIVE 업종 시 경쟁사 1개 자동 찾기 로직 (optional, 구현 복잡도 높으면 생략 가능)

**구현 시간 예상: 5~7시간 (경쟁사 자동 스캔 포함 시 +3시간)**

---

## 4. 요금제 분기 전략

### 4.1 별도 플랜 설계 필요성 검토

**결론: 별도 "글로벌 AI 특화 플랜" 불필요. 기존 플랜 + 메시지 분기로 충분.**

**근거:**
1. Track2 측정(Gemini 100회 + ChatGPT + Google AI Overview)은 이미 전 플랜에 포함됨
2. INACTIVE 업종 사용자가 필요한 추가 기능(JSON-LD, 웹사이트 점검, Google 비즈니스)은 이미 Basic+에 있음
3. 새 플랜 도입 시 구독 관리 복잡도 증가. 현재 BEP 20명 달성 전 플랜 분기는 역효과

**대신 필요한 것:** 가입 흐름에서 INACTIVE 업종 선택 시 "이 플랜이 당신에게 어떤 가치를 드리는가"를 다른 언어로 설명.

### 4.2 INACTIVE 업종 플랜별 메시지 분기 (현재 Pricing 페이지 개선)

| 플랜 | ACTIVE 메시지 | INACTIVE 업종 메시지 (변경) |
|------|-------------|--------------------------|
| Basic | "네이버 AI 브리핑 준비도 진단 + 주 1회 자동 스캔" | "ChatGPT·Gemini 노출 주 1회 자동 측정 + 경쟁사 3개 비교" |
| Pro | "AI 브리핑 매일 자동 스캔 + 상세 가이드 월 8회" | "글로벌 AI 채널 매일 자동 측정 + 전문성 강화 가이드 월 8회" |
| Biz | "팀 5명 + 멀티 사업장" | "팀 5명 + 멀티 사업장 AI 노출 통합 관리" |

이 변경은 `frontend/app/(public)/pricing/page.tsx`와 `PlanRecommender.tsx`의 텍스트 분기만으로 구현 가능.

### 4.3 Trial → 유료 퍼널 차이 (INACTIVE 최적화)

**ACTIVE 퍼널:**
Trial 결과 → "AI 브리핑에 아직 안 나옴" → "Basic으로 매주 모니터링" CTA

**INACTIVE 최적 퍼널 (변경):**
Trial 결과 → "ChatGPT에서 경쟁사는 X회, 내 사업장은 Y회" → "Basic으로 격차 좁히기 시작" CTA

**핵심 차이:** INACTIVE는 "아직 안 됨"이 아니라 "경쟁사와의 격차"가 동기부여 포인트. 비교 데이터가 없으면 전환 동기가 약함 → 기능 5(Trial 경쟁사 스캔)의 ROI가 높은 이유.

### 4.4 가격 전략 변경 없음

현재 Basic 9,900원 / Pro 18,900원은 INACTIVE 업종에도 적합. INACTIVE 업종은 오히려 법무·의료·교육처럼 객단가가 높아 구독료 부담이 상대적으로 낮음.

**단, 아래 조건 충족 시 "프리미엄 진단 리포트" 단건 상품 추가 검토 가능:**
- 법무·의료·교육 타겟으로 "AI 전문성 진단 1회 30,000원 / 월 구독 대체"
- 현재 창업패키지(12,900원)와 유사한 포지션. 구독 거부감이 강한 전문직 대상
- BEP 이후 별도 기획 — 지금은 미착수 권장

---

## 5. 구현 우선순위 로드맵

### Phase 1 — "지금 당장" (총 5~7시간, 비용 0원, DB 변경 없음)

| 순위 | 기능 | 파일 | 시간 |
|------|------|------|------|
| 1 | 기능 1: INACTIVE 대시보드 재배치 + 메시지 교체 | `page.tsx`, `IneligibleBusinessNotice.tsx`, `GlobalAIBanner.tsx` | 2~3h |
| 2 | 기능 3: GlobalAI 체크리스트 컴포넌트 | `GlobalAIChecklist.tsx` | 3~4h |
| 3 | Pricing 페이지 INACTIVE 메시지 분기 | `pricing/page.tsx`, `PlanRecommender.tsx` | 1h |

**예상 효과:** INACTIVE 업종 사용자가 대시보드에서 즉시 "내 채널의 AI 노출 현황"을 확인 가능. 이탈률 감소 기대.

### Phase 2 — "BEP 달성 후" (총 10~13시간, 비용 소폭 추가)

| 순위 | 기능 | 파일 | 시간 |
|------|------|------|------|
| 4 | 기능 2: gap_analyzer INACTIVE 메시지 + guide_generator 프롬프트 분기 | `gap_analyzer.py`, `guide_generator.py` | 4~6h |
| 5 | 기능 4: GlobalAI 경쟁사 비교 카드 | `GlobalAICompetitorCard.tsx` | 4~5h |
| 6 | 기능 5: Trial INACTIVE 전용 결과 화면 | `TrialResultStep.tsx` | 3~4h |

### Phase 3 — "구독자 50명 이후" (미착수)

- 업종별 AI 노출 벤치마크 리포트 (법무 10개 사무소 평균 Track2 점수 공개)
- 전문직 단건 진단 상품 (30,000원/회)
- INACTIVE 업종 전용 랜딩 페이지 `/for-professional`, `/for-education`

---

## 6. 비용 영향 분석

**구현 후 월 비용 추가 (구독자 20명, INACTIVE 비율 50% 가정 = 10명 기준):**

| 항목 | 증가량 | 월 비용 |
|------|--------|--------|
| Gemini 추가 쿼리 (경쟁사 3개 스캔 포함) | 기존 대비 +20% | +$0.40 |
| Claude Sonnet 가이드 (INACTIVE 업종 프롬프트 길어짐 +200토큰) | 무시 가능 | +$0.01 |
| Playwright RAM (추가 페이지 없음) | 변화 없음 | $0 |
| **합계** | | **+$0.41/월** |

**결론:** 추가 비용 거의 없음. Phase 1은 비용 0원.

---

## 7. 주의사항 및 리스크

1. **Trial 경쟁사 자동 스캔(기능 5 선택 항목):** Gemini 10회를 본인 5회 + 경쟁사 5회로 분리하면 본인 정확도 하락 가능. 경쟁사 스캔은 별도 1회 추가로 처리하거나 Phase 2로 이연 권장.

2. **GlobalAIBanner INACTIVE 상시 표시:** globalScore >= 30인 INACTIVE 사용자에게도 배너를 보여주면 "우리는 이미 잘 나오는데"라는 역효과 가능. 조건을 `globalScore < 50`으로 완화 (30→50)하는 안 검토.

3. **법무·의료 업종 특화 가이드:** Claude Sonnet이 생성하는 가이드에 "법률 조언", "의료 진단" 내용이 포함될 경우 면책 문구 필수. `guide_generator.py`의 INACTIVE 업종 프롬프트에 명시적 제외 지시 추가 필요.

4. **INACTIVE는 다양한 업종의 묶음:** 법무(global 80%)와 부동산(global 35%)은 AI 노출 전략이 완전히 다름. "INACTIVE = 글로벌 AI 전담"이라는 단순화에 주의. 업종별 `DUAL_TRACK_RATIO`에 맞는 맞춤 메시지가 이상적. Phase 1에서는 공통 메시지, Phase 2에서 업종별 분기.

5. **데이터 없음 상태 처리:** INACTIVE 사용자가 처음 가입 후 스캔 전에는 Track2 점수가 없음. "아직 스캔 전 — 첫 스캔 후 AI 노출 현황을 확인하세요" 빈 상태 UI 필수.

---

## 8. 구현 시작 전 확인 사항

Phase 1 착수 전 아래 파일을 직접 확인하여 현재 상태 파악 필요:

1. `frontend/app/(dashboard)/dashboard/page.tsx` — `eligibility !== "inactive"` 조건으로 숨겨진 컴포넌트 목록 확인 (Line 728 부근)
2. `frontend/components/dashboard/GlobalAIBanner.tsx` — 현재 표시 조건 (`globalScore < 30`) 확인 완료
3. `backend/services/gap_analyzer.py` — `ScanContext.NON_LOCATION` 분기 존재 여부 확인 (현재는 `LOCATION_BASED`만 확인됨)
4. `frontend/app/(public)/trial/components/TrialResultStep.tsx` — eligibility 분기 존재 여부 확인

---

*v1.0 — 2026-05-03 | next-feature 에이전트 작성*
*구현 착수 시 backend-dev + frontend-dev 에이전트 병렬 실행 권장*
