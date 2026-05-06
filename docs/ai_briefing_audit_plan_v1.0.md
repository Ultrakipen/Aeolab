# 네이버 AI 브리핑 노출 조건 적용 점검 계획서 v1.0

> 작성일: 2026-04-30
> 목적: 단계 0~3(브리핑 재설계 v2.0) 배포 후 노출 기준 정확성 / 구현 일관성 / 회귀를 점검하고, 새 대화창에서도 끊김 없이 이어갈 수 있도록 컨텍스트를 응축
> 선행 문서: `docs/ai_briefing_redesign_v2.0.md`, `docs/ai_briefing_redesign_v1.0.md`

---

## 0. 핵심 컨텍스트 (새 대화창 진입 시 1분 내 파악)

### 0.1 우리가 이전 세션에서 확정한 사실
- **네이버 AI 브리핑은 모든 업종에 노출되지 않는다.** 음식점·카페·숙박 중심으로 시작, 일부 업종으로 점진 확대 중. 사용자의 본업(홍뮤직스튜디오, 음악 스튜디오)은 **현재 노출 대상 아님**.
- **"FAQ" 라는 별도 메뉴는 SmartPlace에 존재하지 않는다.** 2024-02-15 이후 톡톡 파트너 센터 → 채팅방 메뉴관리 → 톡톡 메뉴 관리(=AI FAQ 챗봇)로 통합되었으며, 이는 AI 브리핑과 별개의 챗봇 기능이다. AI 브리핑이 노출 시 참조하는 콘텐츠는 **소개글 / 소식 / 블로그 / 리뷰**이다.
- **AI 정보 탭 토글**: 사장님이 직접 ON/OFF 가능한 별도 노출 동의 스위치(업종에 따라 비활성/미노출). 토글 OFF면 콘텐츠가 아무리 좋아도 노출되지 않는다.
- **`intro_text` 컬럼은 DB에 존재하지 않는다.** 프론트엔드 SELECT에서 이를 참조하면 전체 쿼리가 실패해 사업장 목록이 비고, 등록 CTA가 잘못 표시된다(2026-04-30 회귀). 현재 제거 완료.

### 0.2 3개 출처 종합 — AI 브리핑 노출 조건 (정확도 우선)

| 조건 | 우선순위 | 비중 | 근거 |
|------|---------|------|------|
| **노출 가능 업종**(restaurant, cafe, bakery, bar, accommodation) | ★★★ 필수 | gate | 네이버 공식 / Gemini 답변 |
| **AI 정보 탭 토글 ON** | ★★★ 필수 | gate | ChatGPT 답변 / 사장님 SmartPlace 화면 확인 |
| **소개글 충실도**(150~500자, 키워드·서비스·USP 포함) | ★★ 핵심 | 25% | 네이버 공식 / 자체 검증 |
| **소식 최신성**(30일 내 게시 1회 이상) | ★★ 핵심 | 25% | 네이버 공식 |
| **리뷰 풍부도**(영수증 리뷰 ≥ 10건 권장) | ★★ 핵심 | 20% | Gemini / 네이버 공식 |
| **연계 블로그 운영**(키워드 매칭, 30일 내 발행) | ★ 권장 | 15% | 네이버 공식 |
| **메뉴/가격/사진 정보 완성도** | ★ 권장 | 15% | ChatGPT |

> Likely 업종(beauty, nail, pet, fitness, yoga, pharmacy)은 베타 확대 단계로 알려져 있어 "준비 가이드"는 동일하게 제공하되, 노출 보장 문구는 사용 금지(허위 광고 위험).

### 0.3 단계 0~3 배포 완료 항목 (2026-04-30)

- **백엔드**
  - `score_engine.py`: `BRIEFING_ACTIVE/LIKELY/INACTIVE_CATEGORIES` 상수, `get_briefing_eligibility()`, `_briefing_explanation()`, `track1_detail.briefing_meta` 추가. FAQ 25점 → 소개글 10점 + 소식 25점으로 재배분.
  - `smart_place_auto_check.py`, `naver_place_stats.py`: `m.place.naver.com/restaurant/{id}` → `/place/{id}` 경로 마이그레이션.
  - `guide_generator.py`: `generate_naver_intro()`, `generate_talktalk_faq()` 추가 (Claude Sonnet 호출은 이 파일 내에서만 허용).
  - `routers/business.py`: PATCH 허용 필드에 `ai_info_tab_status` 추가, `POST /api/businesses/intro-generate`, `POST /api/businesses/talktalk-faq-generate` 추가. SELECT 컬럼에 fallback 안전망 추가(2026-04-30 회귀 픽스).
- **프론트엔드**
  - `IneligibleBusinessNotice.tsx`, `AiInfoTabStatusCard.tsx`, `IntroGeneratorCard.tsx`, `TalktalkFAQGeneratorCard.tsx`
  - `/guide/ai-info-tab/page.tsx` (5단계 가이드)
  - `RegisterBusinessForm.tsx` 인라인 `getBriefingEligibility()` + 안내 문구
  - `ScoreEvidenceCard.tsx` FAQ 행 제거, missingItems critical 강조
  - `dashboard/page.tsx` 4종 카드 통합, `intro_text` 회귀 제거
- **DB**
  - `businesses.ai_info_tab_status TEXT` (실행 완료)
  - `intro_description`, `talktalk_faq_content`: 안내했으나 코드 저장 경로 없음 → **현재 미사용**

---

## 1. 점검 작업 단계별 체크리스트

> 새 대화창에서 이 문서를 열고 ☐를 ☑로 바꿔가며 진행. 각 단계는 독립 실행 가능.

### 단계 1 — 노출 조건 정합성 점검 (예상 30분)

#### 1.1 업종 화이트리스트 일치성
- ☐ `backend/services/score_engine.py` `BRIEFING_ACTIVE_CATEGORIES`와 `frontend/app/(dashboard)/dashboard/page.tsx` `BRIEFING_ACTIVE` 동일 여부 확인
- ☐ `RegisterBusinessForm.tsx` 인라인 `getBriefingEligibility()`도 동일 집합인지 확인
- ☐ 업종 25개 화이트리스트(`businesses.category` CHECK)와 누락/중복 없는지 비교
- ☐ 단일 소스 원칙 위반 시 `score_engine.py` 상수를 `/api/public/categories` 같은 엔드포인트로 노출하고 프론트는 그곳에서 가져오도록 리팩터링 검토

#### 1.2 AI 정보 탭 토글 게이팅
- ☐ `score_engine.py`의 `track1_detail.briefing_meta.ai_info_tab_status`가 5개 값(on/off/disabled/not_visible/unknown) 모두 처리되는지 확인
- ☐ `unknown` 상태에서 사용자에게 명확한 안내가 노출되는지 (`AiInfoTabStatusCard.tsx`) 확인
- ☐ ACTIVE 업종 + 토글 OFF인 경우 `missing_items`에 critical 항목으로 자동 추가되는지 확인
- ☐ INACTIVE 업종에서 `AiInfoTabStatusCard`가 null 반환되어 혼란을 주지 않는지 확인

#### 1.3 점수 가중치 재배분 검증
- ☐ FAQ 25점 제거 후 `calc_smart_place_completeness()` 합계가 100점인지 단위 테스트로 검증
- ☐ 가중치: has_intro 10점 + has_recent_post 25점 + 기타 65점 = 100점 확인
- ☐ Track1 점수에 `briefing_meta`가 반영될 때 INACTIVE 업종은 패널티 없이 "준비도 점수"로만 표시되는지 확인

### 단계 2 — 회귀 / 깨진 곳 점검 (예상 20분)

#### 2.1 대시보드 로딩 회귀
- ☐ 홍뮤직스튜디오(INACTIVE) 계정 로그인 → `/dashboard` 정상 표시 확인
- ☐ ACTIVE 업종(음식점) 테스트 계정 → `IneligibleBusinessNotice`가 null인지 확인
- ☐ LIKELY 업종(미용실) 테스트 계정 → 파란 안내 박스 노출 확인
- ☐ Network 탭에서 `from('businesses').select(...)` 응답 200 + 데이터 비어 있지 않음 확인

#### 2.2 m.place.naver.com 경로 마이그레이션
- ☐ `smart_place_auto_check.py` Playwright 호출이 `/place/{id}` 경로로 가는지 ssh 로그 확인
- ☐ 음식점 / 카페 / 음악스튜디오 3종 사업장 ID로 실측 (`curl -I` 또는 헤드리스 브라우저)
- ☐ 응답이 404거나 SPA 라우팅 변경되었으면 즉시 보고

#### 2.3 미사용 컬럼 정리 결정
- ☐ `intro_description`, `talktalk_faq_content` 컬럼이 실제 어디에도 INSERT/UPDATE 되지 않는지 grep 검증
- ☐ 결정: (A) 현재 미사용이지만 향후 저장 예정 — 유지 / (B) 즉시 DROP — 사용자가 SQL 실행
- ☐ 결정에 따라 `scripts/supabase_schema.sql` 정리

### 단계 3 — 신뢰도/정확도 강화 (예상 60분)

> 단계 1·2가 통과하면 진행. 신뢰도가 핵심이라는 사용자 지시(2026-04-29) 반영.

#### 3.1 Evidence Trail 도입
- ☐ `score_engine.py`의 각 항목 점수에 `evidence: { source, raw, detected_at, confidence }` 부착
- ☐ 예: `has_intro=True`일 때 `evidence.raw=intro_text[0:200]`, `confidence=0.92`
- ☐ 프론트 `ScoreEvidenceCard`에서 항목 클릭 시 evidence 펼침 표시
- ☐ confidence < 0.6 항목은 자동으로 "검증 필요" 배지

#### 3.2 Drift Detection
- ☐ Playwright 크롤러에 DOM 셀렉터 변경 감지: 마지막 성공 셀렉터 / 실패율 30분 모니터링
- ☐ 실패율 ≥ 20%면 관리자 카카오 알림(`AEOLAB_DRIFT_01` 신규 템플릿 또는 이메일)
- ☐ `naver_place_stats.py`, `smart_place_auto_check.py` 양쪽 적용

#### 3.3 노출 조건 외부 변경 모니터링
- ☐ "네이버 AI 브리핑 업종 확대" 키워드 자동 검색(주간 1회) → Claude Haiku로 요약 → 운영자 이메일
- ☐ 변경 감지되면 `BRIEFING_ACTIVE_CATEGORIES` 업데이트 PR 자동 작성 가이드 문서 첨부

### 단계 4 — 신규 사업자 온보딩 정확성 (예상 30분)

- ☐ 회원가입 → 사업장 등록 시 카테고리 선택 즉시 `getBriefingEligibility()` 결과 보여주는지
- ☐ INACTIVE 사용자가 결제 페이지 진입 시 "AI 브리핑 노출은 현재 보장되지 않습니다" 면책 문구 노출 확인
- ☐ 토스 결제 환불 정책 페이지에 "노출 미보장 업종 가입 시 환불 불가능" 명시 여부 결정
- ☐ Trial 결과 페이지에서 INACTIVE 업종에 점수만 보여주고 "AI 브리핑 노출 가이드" CTA는 숨김 처리

### 단계 5 — UX / 텍스트 톤 점검 (예상 20분)

- ☐ "AI 검색 시대의 종합 가시성 최적화" 슬로건이 INACTIVE 사용자에게도 거짓말처럼 보이지 않는지 카피 재검토
- ☐ ACTIVE/LIKELY/INACTIVE 3종 톤 분리 메시지 확인:
  - ACTIVE: "노출 가능합니다. 다음 항목을 채우세요."
  - LIKELY: "확대 예정 업종입니다. 미리 준비해두세요."
  - INACTIVE: "현재 노출 대상이 아닙니다. 대신 ① 블로그 ② ChatGPT ③ Google ④ 카카오 ⑤ 네이버 검색 광고 영역에서의 가시성을 높입니다."
- ☐ PC/모바일 양쪽에서 각 메시지가 잘림 없이 표시되는지 (CLAUDE.md 가독성 원칙)

### 단계 6 — 자동 회귀 테스트 시나리오

- ☐ Playwright 스크립트 작성: ACTIVE/LIKELY/INACTIVE 3개 테스트 계정 로그인 → 대시보드 노출 검증
- ☐ pytest fixture: `ai_info_tab_status` 5개 값 × 업종 3종 = 15 케이스 점수 계산 회귀
- ☐ GitHub Actions에 추가 (main push 시 실행)

---

## 2. 점검 우선순위 매트릭스

| 단계 | 영향도 | 긴급도 | 권장 시점 |
|------|--------|--------|----------|
| 1.1 업종 화이트리스트 일치성 | 高 | 高 | 즉시 |
| 1.2 토글 게이팅 검증 | 高 | 高 | 즉시 |
| 2.1 대시보드 로딩 회귀 | 高 | 高 | 즉시 |
| 2.2 m.place 경로 마이그레이션 | 中 | 高 | 즉시 |
| 1.3 점수 가중치 합계 | 中 | 中 | 1주 내 |
| 2.3 미사용 컬럼 정리 | 低 | 低 | 한가할 때 |
| 4 온보딩 정확성 | 高 | 中 | 1주 내 |
| 5 UX 톤 | 中 | 中 | 1주 내 |
| 3 Evidence/Drift | 中 | 低 | 구독자 20명 이후 |
| 6 자동 회귀 테스트 | 中 | 低 | 구독자 50명 이후 |

---

## 3. 새 대화창에서 작업 재개하는 법

1. **첫 메시지로 이 문서 경로를 알려주기**:
   `"docs/ai_briefing_audit_plan_v1.0.md를 읽고 단계 N부터 진행해주세요."`
2. **에이전트는 자동으로 다음을 수행**:
   - `code-review` 에이전트가 단계 1·2 코드 일치성 검증
   - `db-migrate` 에이전트가 단계 2.3 미사용 컬럼 정리 SQL 작성
   - `frontend-dev` / `backend-dev` 에이전트가 단계 4·5 수정
3. **점검 결과는 같은 문서 하단의 "점검 결과 로그" 섹션에 누적 기록** (아래 빈 섹션)

---

## 4. 추가로 검토해야 할 미해결 질문

- ☐ **Likely 업종 확대 시점**: 네이버가 공식 공지하지 않으면 우리가 어떻게 감지할 것인가? (3.3과 연결)
- ☐ **AI 정보 탭 토글의 자동 감지 가능성**: Playwright로 SmartPlace 관리자 페이지 토글 상태를 감지할 수 있는지(개인정보 동의 필요). 자동화 vs 사용자 자기 보고 중 신뢰도 우위 판단 필요.
- ☐ **소개글 길이 기준의 정확성**: 150자/300자/500자 중 어떤 값이 실측 노출률과 가장 상관 높은지. 베타 사용자 데이터 누적 후 회귀분석 필요.
- ☐ **Trial 결과의 정직성**: 비로그인 Trial에서 INACTIVE 업종에 "노출 가능합니다" 메시지가 섞여 나오지 않는지 trial 코드 별도 점검.
- ☐ **환불 정책 적용 시점**: 단계 4의 면책 문구를 적용한 시점부터 가입한 사용자에게만 적용 가능. 기존 가입자(특히 INACTIVE)는 별도 안내 메일 + 옵션 제공.

---

## 5. 점검 결과 로그 (실행 시 채워나갈 빈 섹션)

```
### YYYY-MM-DD 단계 N 점검 결과
- 발견 사항:
- 수정 커밋:
- 다음 단계 영향:
```

---

*최종 업데이트: 2026-04-30 — 단계 0~3 배포 직후 점검 계획 정립*
