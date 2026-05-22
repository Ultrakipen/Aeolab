# 네이버 AI 브리핑·AI탭·ChatGPT 차별화 — 상업 서비스 전 점검 요청 v1.0

> 작성일: 2026-05-19
> 용도: 새 대화창에서 이 문서 하나로 네이버 AI 브리핑·AI탭·ChatGPT 관련 기능 전체를 점검
> 작성 경위: 재검토로 오판 3건·누락 3건·보완 1건 반영 후 확정 (14개 체크포인트)

---

## 0. 1줄 시작 방법

```
docs/naver_ai_prelaunch_inspection_v1.0.md 읽고 §3 순서대로 모든 점검 진행해줘. 토큰 절약하면서 발견 문제는 P0~P2 분류 후 수정·배포까지 자동 진행할것.
```

또는 특정 섹션만:
```
docs/naver_ai_prelaunch_inspection_v1.0.md §3-A (AI 브리핑 단일 소스)만 점검해줘.
```

---

## 1. 사전 컨텍스트 (먼저 읽을 문서)

| 우선 | 문서 | 역할 |
|------|------|------|
| 1 | `CLAUDE.md` | 전체 시스템 컨텍스트, 에이전트 자동 라우팅, 필수 코드 패턴 |
| 2 | `docs/naver_gpt_work_standard_v1.0.md` | 업종 분류·스캐너 4종·쿼리·점수 가중치·콘텐츠 구조·UI 분기·면책 문구 전 영역 |
| 3 | `docs/ai_briefing_redesign_v2.0.md` | AI 브리핑 노출 기준 v2.0 최신 설계 |
| 4 | `docs/naver_ai_tab_대응_개발계획_v1.0.md` | AI탭 분리 대응 개발 계획 |
post_briefing_ad_strategy_v1.0.md

> 충돌 시 우선순위: 본 문서 < CLAUDE.md < 위 참고 문서(항상 최신 실측 반영)

---

## 2. 현재 시스템 상태 스냅샷 (2026-05-19)

### 2.1 핵심 단일 소스 위치

| 구분 | 파일 | 상수/함수 |
|------|------|----------|
| 백엔드 ACTIVE/LIKELY | `backend/services/score_engine.py:30` | `BRIEFING_ACTIVE_CATEGORIES`, `BRIEFING_LIKELY_CATEGORIES` |
| 프론트 단일 소스 | `frontend/lib/userGroup.ts` | `ACTIVE_CATEGORIES` Set, `LIKELY_CATEGORIES` Set, `getBriefingEligibility()` |
| 공개 API | `backend/routers/public_briefing.py` | `GET /api/public/briefing-categories` |
| AI탭 eligibility | `backend/services/score_engine.py` | `get_ai_tab_eligibility()` → 항상 `"beta"` |
| 대행 서비스 가격 | `backend/config/prices.py` | `DELIVERY_PRICES` |

### 2.2 카테고리 분류 (2026-05-19 기준)

- **ACTIVE**: restaurant, cafe, bakery, bar, accommodation (5개)
- **LIKELY**: beauty, nail, skincare, massage, spa, pet, fitness, yoga, pharmacy, dance, ballet, semi_permanent (12개)
- **INACTIVE**: 그 외 + 프랜차이즈 (전 업종 게이팅)
- **AI탭**: 모든 업종 베타 대상 (2026-04-27 네이버플러스 우선 공개)

### 2.3 이미 확인된 완료 항목

- ✅ `/qna` 실제 URL 참조 0건 (deeplink → `/profile` 교체 완료)
- ✅ ChatGPT 면책 문구 43개 파일 적용 완료
- ✅ `simulate_ai_tab_answer()` measured/estimated 배지 분기 구현 (`briefing_engine.py:1483`)
- ✅ has_faq 0점 처리 + 소식 25점·소개글 20점 재배분 완료
- ✅ 프론트 하드코딩 BRIEFING_ACTIVE 제거 — `getBriefingEligibility()` 통일 완료

---

## 3. 점검 체크포인트 (14개)

### §3-A 네이버 AI 브리핑 (ACTIVE/LIKELY/INACTIVE 분기)

**A-1. ACTIVE 목록 백엔드·프론트 동기화**
- `backend/services/score_engine.py` `BRIEFING_ACTIVE_CATEGORIES` 5개
- `frontend/lib/userGroup.ts` `ACTIVE_CATEGORIES` Set 5개
- 완전 일치하는가? (불일치 → P0 버그)

**A-2. LIKELY 목록 백엔드·프론트 동기화**
- `backend/services/score_engine.py` `BRIEFING_LIKELY_CATEGORIES` 12개
- `frontend/lib/userGroup.ts` `LIKELY_CATEGORIES` Set 12개
- 완전 일치하는가? (불일치 → P0 버그)

**A-3. 프랜차이즈 제외 게이팅**
- 백엔드 `get_briefing_eligibility(category, is_franchise=True)` → `"inactive"` 반환하는가?
- 프론트 `getBriefingEligibility(category, isFranchise=true)` → `"inactive"` 반환하는가?

**A-4. INACTIVE 업종 UX**
- INACTIVE 업종 대시보드: "AI 브리핑 비대상 → AI탭 가이드로 이동" 안내 존재하는가?
- `has_faq` 점수가 score_engine.py에서 INACTIVE 업종도 포함 0점 처리 확인
  (합계: 25등록+30순위+25소식+20소개글=100점)

**A-5. `/qna` 실제 URL 참조 0건 재확인**
- grep 대상: `goto(.*qna`, `href.*qna`, `deeplink.*qna` (주석 제외, 실제 네트워크 호출 경로만)
- 0건이어야 정상

---

### §3-B 네이버 AI탭 (모든 업종 베타)

**B-6. AI 브리핑 ≠ AI탭 분리**
- `get_ai_tab_eligibility()` 업종 무관 `"beta"` 반환하는가?
- 대시보드 `NaverAiPathwayCard` 컴포넌트: INACTIVE 업종에도 AI탭 경로 안내 존재하는가?
- `/guide/ai-tab` 페이지: "모든 업종 대상" 명시되어 있는가?

**B-7. AI탭 시뮬레이션 배지 — 프론트 처리**
- `briefing_engine.simulate_ai_tab_answer()` 반환 `data_source: "measured" | "estimated"`
- `AiTabPreviewCard.tsx`에서 이 값을 받아 배지로 실제 렌더링하는가?
- `estimated` 시 면책 문구 자동 표시되는가?

**B-8. 용어 통일 스캔**
- "AI 정보 탭"(스마트플레이스 내부 토글 메뉴) vs "AI탭"(네이버 검색결과 화면) 혼용 없는가?
- 사용자 노출 화면에 "직접 인용" 표현 없는가?

---

### §3-C ChatGPT 노출 측정 (Track2)

**C-9. ChatGPT 면책 문구 전수 확인**
- ChatGPT 측정 결과 노출 화면 전체에 아래 문구 존재하는가?
  > "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- grep으로 전체 파일 확인 후 누락 화면 목록 보고

**C-10. Basic 자동 스캔 50/50 분할**
- `chatgpt_scanner.py` `sample_n(n=50)` 구현 존재하는가?
- `calc_multi_ai_exposure`: Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분 로직 정확한가?

**C-11. 에러 폴백 허위 수치 금지**
- ChatGPT/Gemini API 실패 시 0 또는 N/A 표시 처리 존재하는가?
- 프론트 전체에 `Math.random()` 또는 더미 수치 노출 코드 없는가?

---

### §3-D 공통 — 상업 서비스 전 최종 점검

**D-12. 실측 데이터 원칙**
- 사용자 노출 화면에 더미/임의 추정 수치 없는가?
- 빈 상태: "아직 데이터 없음 — 첫 스캔 후 표시" 안내 존재하는가?

**D-13. 점수 모델 버전 활성화 상태**
- 서버 `.env`에 `SCORE_MODEL_VERSION` 설정 여부 확인
  - 미설정 → v3.0 기본값 (ACTIVE/LIKELY/INACTIVE 그룹별 가중치 차별화 미적용)
  - `v3_1` 설정 여부는 베타 구독자 5명 확보 후 결정

**D-14. `/api/public/briefing-categories` API 활용 여부 (보완)**
- `public_briefing.py` `GET /api/public/briefing-categories` 엔드포인트 존재하는가?
- 프론트가 이 API를 호출하는가, 아니면 `userGroup.ts` 하드코딩만 사용하는가?
- 하드코딩 사용 중이면: 백엔드 목록 변경 시 프론트 자동 반영 안 됨 → 동기화 누락 위험
- 개선 여부 판단 후 권고

---

## 4. 점검 방법

```
각 항목:
1. grep/Read로 실제 구현 직접 확인 (추정·AI 일반 지식 금지)
2. 서버 SSH 검증: ssh root@115.68.231.57 "grep -n <패턴> /var/www/aeolab/<경로>"
3. 결과 분류: ✅ 정상 / ❌ 이상 / ⚠️ 부분 미흡
4. ❌/⚠️ 즉시 수정 후 배포 (수정 후 서버 grep 재확인 필수)
```

**우선순위 처리 순서**:
- P0 (서비스 차단·보안·데이터 오염) → 즉시 수정
- P1 (UX 오해·사용자 이탈 원인) → 당일 수정
- P2 (데이터 정확성·가이드 미흡) → 다음 세션

---

## 5. 점검 결과 기록란 (점검 후 채워넣기)

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| A-1 | ACTIVE 목록 동기화 | ✅ | 5개 완전 일치 (score_engine.py:30 ↔ userGroup.ts:20) |
| A-2 | LIKELY 목록 동기화 | ✅ | 12개 완전 일치 (score_engine.py:33 ↔ userGroup.ts:28) |
| A-3 | 프랜차이즈 게이팅 | ✅ | is_franchise=True → "inactive" 반환 (score_engine.py:71) |
| A-4 | INACTIVE UX | ✅ | AI탭 안내 배너·AiTabPreviewCard 비대상 안내 존재 |
| A-5 | /qna 실제 참조 0건 | ✅ | grep 실 코드 참조 0건 확인 |
| B-6 | AI탭 분리 | ✅ | get_ai_tab_eligibility() → os.getenv("AI_TAB_STATUS","beta") |
| B-7 | AI탭 시뮬레이션 배지 | ✅ | AiTabPreviewCard.tsx:245 measured/estimated 분기·면책 문구 |
| B-8 | 용어 통일 | ✅ | "AI 정보 탭"(스마트플레이스 내부)·"AI탭"(검색화면) 혼용 없음 |
| C-9 | ChatGPT 면책 문구 | ✅ | 19개 주요 화면 확인 (Trial·대시보드·가이드·데모·프라이싱) |
| C-10 | 50/50 분할 | ✅ | sample_n(n=50) + 45+45=90→100 재배분 확인 |
| C-11 | 에러 폴백 | ✅ | Math.random() 0건, chatgptResult ?? null 처리 |
| D-12 | 실측 원칙 | ✅ | 더미 수치 0건, LockedScoreCard barW=50 균일 (P0-2 수정됨) |
| D-13 | 점수 모델 버전 | ⚠️ | default v3_0 정상. v3_1 베타 5명+ 후 활성화 (환경변수 SCORE_MODEL_VERSION) |
| D-14 | briefing-categories API | ✅ | briefingCategoriesServer.ts → /api/public/briefing-categories 호출 |

> 점검일: 2026-05-22 | 14개 전항목 점검 완료. 이상 0건 (D-13은 의도적 보류).

---

*작성 2026-05-19 | 재검토 반영: 오판 3건(파일 경로·단일소스 파일·/qna 기준) + 누락 3건(LIKELY 동기화·AiTabPreviewCard 배지·점수 모델 버전) + 보완 1건(API 활용 여부) 수정 완료*
