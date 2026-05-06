# AEOlab 종합 점검 요청 문서 v1.0

> 작성일: 2026-05-01
> 용도: 새 대화창에서 이 문서 하나로 전체 시스템 점검을 순차 진행
> 사용 방법: 새 대화에 "docs/inspection_request_full.md 읽고 §3 순서대로 모든 점검 진행해줘. 토큰 절약하면서 발견 문제는 P0~P2 분류 후 수정·배포까지 자동 진행할것." 입력

---

## 0. 1줄 시작 방법

```
docs/inspection_request_full.md 읽고 §3 순서대로 모든 점검 진행해줘. 토큰 절약하면서 발견 문제는 P0~P2 분류 후 수정·배포까지 자동 진행할것.
```

또는 특정 영역만:
```
docs/inspection_request_full.md §3.2 (스마트플레이스 톡톡 FAQ)만 점검해줘.
```

---

## 1. 사전 컨텍스트 (반드시 먼저 읽어야 할 문서)

| 우선 | 문서 | 역할 |
|---|---|---|
| 1 | `CLAUDE.md` | 전체 시스템 컨텍스트, 에이전트 자동 라우팅 규칙, 필수 코드 패턴, 토큰 효율 지침 |
| 2 | `docs/service_unification_v1.0.md` (v1.2) | 서비스 통합 재편 기획서 — 점수 모델 v3.1, 그룹 분기, KPI |
| 3 | `docs/phase_a_completion_report.md` | Phase A 완료 보고서 — 17건 작업 + 검증 결과 |
| 4 | `docs/naver_ai_briefing_compliance_v1.0.md` | **AI 브리핑 노출 조건 컴플라이언스** — 프랜차이즈 제외·5가지 유형 |
| 5 | `docs/ai_briefing_redesign_v2.0.md` | AI 브리핑 노출 기준 v2.0 최신 설계 |
| 6 | `docs/ai_briefing_implementation_plan_v2.0.md` | v4.1 구현 계획 — 게이팅·프랜차이즈·5단계 가이드·DB 컬럼 |
| 7 | `docs/naver_talktalk_redesign_v1.0.md` | **톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기** 영향 범위·진행 로그 |
| 8 | `docs/session_summary_20260430_naver_briefing_v4.1.md` | v4.1 세션 작업 요약 |
| 9 | `docs/changelog_archive.md` | 과거 v1.2~v3.5 완료 내역 (필요 시) |

> **충돌 시 우선순위**: 본 문서 < CLAUDE.md < 위 참고 문서(항상 최신 실측 반영). 충돌 발견 시 본 문서 즉시 갱신.

---

## 2. 현재 시스템 상태 스냅샷 (2026-05-01)

### 2.1 점수 모델
- `SCORE_MODEL_VERSION` 기본값 `v3_0` (토글 OFF)
- v3.0 = Track1 5항목 (keyword_gap 35% / review 25% / smart_place 15% / naver_exposure 15% / kakao 10%)
- v3.1 = Track1 6항목 그룹별 가중치 (ACTIVE/LIKELY/INACTIVE)
- 베타 5명+ 확보 후 `v3_1` 활성화 예정

### 2.2 카테고리 분류 (단일 소스)
- ACTIVE: restaurant, cafe, bakery, bar, accommodation
- LIKELY: beauty, nail, pet, fitness, yoga, pharmacy
- INACTIVE: 그 외 + 프랜차이즈 가맹점 (전 업종 게이팅)
- 화이트리스트 25개 업종
- 백엔드: `backend/services/score_engine.py:25-30`
- 프론트엔드: `frontend/lib/userGroup.ts`
- 공개 API: `/api/public/briefing-categories`

### 2.3 Phase A 완료 기능 (2026-04-30)
- 네이버 키워드 순위 추적 (Playwright PC/모바일/플레이스)
- 키워드 자동 추천 (Claude Haiku, 월 한도 Free 1·Basic 1·Pro 4·Biz 10)
- 블로그 C-rank 추정
- 카카오맵 자동 점검
- 톡톡 채팅방 메뉴 + 소개글 자동 생성 (Free 0·Basic 5건/월·Pro 무제한·Biz 무제한) — FAQ와 합산

### 2.4 카카오 알림톡 6종
- 5종 승인 완료: AEOLAB_SCORE_01·CITE_01·COMP_01·NEWS_01·ACTION_01
- 1종 신청 대기: AEOLAB_KW_01 (키워드 순위 변동)

### 2.5 서버
- iwinv vCPU2/RAM4GB (홈페이지 완성 후 1단계 업그레이드 예정)
- Playwright Semaphore(2) — 업그레이드 후 Semaphore(3~4) 검토
- BEP 20명 미달

### 2.6 결제
- TOSS_SECRET_KEY 현재 test_ → 실결제 전 live_ 교체 필요

### 2.7 네이버 사양 변경 (2026-05-01 적용)
- **톡톡 FAQ → "톡톡 채팅방 메뉴" 명칭 개편** (2024.02.14 네이버 공식 공지)
  - URL: `partner.talk.naver.com`
  - 사양: `chat_menus[].link_type: "message" | "url"` (단순 문자열 배열 금지)
  - 하위 호환: `_compat_chat_menus()` + `normalizeChatMenus()` 자동 변환
- **스마트플레이스 사장님 Q&A 탭(`/qna`) 폐기** (좌측 메뉴·직접 URL 모두 사망)
  - `_SMARTPLACE_PATHS["faq"]` 제거 / `_detect_faq()` 폐기 / Playwright `/qna` crawl 차단
  - 사용자 노출 deeplink: `/qna` → `/profile`로 교체
- **`has_faq` 점수 가중치 0점**: 25점 → 소식(15→25) + 소개글(10→20) 재배분 (합계 100점 보존: 25+30+25+20)
- **단정 표현 금지**: "직접 인용" 등 사용자 노출 화면에 사용 금지

### 2.8 에이전트 보고 신뢰도 (2026-05-01 신설)
- 2026-05-01 두 사이클 연속 에이전트 거짓 보고 사고 → **신뢰 기반 → 검증 기반** 전환
- 모든 에이전트 위임 작업 후 메인 세션이 SSH/Read/Grep으로 직접 검증
- 거짓 보고 발견 시 즉시 메인 세션 직접 수정, 에이전트 재위임 금지

---

## 3. 점검 영역 (순차 진행)

### §3.1 — 새로운 네이버 AI 브리핑 반영 일관성

**참고**: PDF 6종(2026-04-30 분석) 기준 — 5가지 AI 브리핑 유형 중 플레이스형(소상공인 대상) 사용

**점검 항목**:
- [ ] 백엔드 카테고리 단일 소스 (`score_engine.py` ↔ `briefing_engine.py` ↔ `public_briefing.py`)
- [ ] 프론트엔드 카테고리 중복 정의 없음 (`userGroup.ts` 단일 import)
- [ ] 프랜차이즈 게이팅 UI (`RegisterBusinessForm`·`BusinessQuickEditPanel` 체크박스)
- [ ] `get_briefing_eligibility()` 호출 시 `is_franchise` 인자 전달
- [ ] `briefing_engine.py`가 v3.1 토글 시 6항목 가중치 사용
- [ ] `/guide/ai-info-tab` 5단계 가이드 그룹별 톤 분리
- [ ] 사이드바 "AI 브리핑 5단계" 메뉴 등록 + 모바일/PC 가독성
- [ ] 1일 토글 반영 안내 (소개글·소식 등록 후 1일)

### §3.2 — 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기 반영 (2026-05-01)

**참고**: `docs/naver_talktalk_redesign_v1.0.md` 우선 확인. 단정 표현 "직접 인용" 사용자 노출 화면 사용 금지(CLAUDE.md 규칙).

**A. 톡톡 채팅방 메뉴 개편 (구 FAQ)**:
- [ ] 명칭 일관: 사용자 노출 화면 17개에서 "톡톡 FAQ" → **"톡톡 채팅방 메뉴"** 갱신 완료
- [ ] `POST /api/guide/{biz_id}/smartplace-faq` 엔드포인트 + 플랜 한도 (Free 0/Basic 5건/월/Pro 무제한/Biz 무제한) — `faq_monthly` 공유
- [ ] `businesses.talktalk_faq_draft` JSONB 사양: `chat_menus[].link_type: "message"|"url"` (단순 문자열 배열 금지)
- [ ] 하위 호환: 기존 문자열 배열 또는 `link_type` 누락 dict → backend `_compat_chat_menus()` + frontend `normalizeChatMenus()` 자동 변환
- [ ] 재방문 시 `TalktalkFAQGeneratorCard` 자동 로드 (DB 컬럼 graceful fallback)
- [ ] 한도 뱃지 (Free/Basic/Pro/Biz 색상 분기) 표시
- [ ] `partner.talk.naver.com` 정확 안내 (URL 오타 없음)

**B. 스마트플레이스 Q&A 탭 폐기 대응**:
- [ ] `_SMARTPLACE_PATHS["faq"]` 키 제거 확인 (services/briefing_engine.py·smart_place_auto_check.py)
- [ ] `_detect_faq()` 함수 폐기 / 호출 0건
- [ ] Playwright `/qna` goto 호출 0건 (naver_place_stats.py·competitor_place_crawler.py)
- [ ] `_run_faq_crawl()` deprecated 폴백 (`error: "deprecated_qna_tab_removed"`)
- [ ] 사용자 노출 deeplink: `/qna` 사용 0건 → `/profile`로 교체 (routers/report.py 등)
- [ ] `_ACTION_STEPS["intro_qa"]` + `["talktalk_menu"]` 신규 분리 적용

**C. 점수 재배분 (`has_faq` 25점 → 소식·소개글)**:
- [ ] `score_engine.calc_smart_place_completeness()`: `has_faq` 가중치 0
- [ ] 소식 가중치 15→25, 소개글 가중치 10→20 (합계 100점 보존: 25등록+30순위+25소식+20소개글)
- [ ] `has_faq` 체크박스 UI 제거 (DB 컬럼은 보존)
- [ ] 단정 표현 "직접 인용" 검색 → 사용자 노출 화면 0건
- [ ] `/guide/ai-info-tab` 5단계 "톡톡 채팅방 메뉴 등록" 단계 명칭 일관
- [ ] 랜딩·매뉴얼·요금제 페이지 신 명칭 적용
- [ ] 면책 문구 ("측정 시점·기기·검색 환경에 따라 달라짐") 적용

### §3.3 — 프론트엔드 안내문 일관성

**점검 항목**:
- [ ] v3.0/v3.1 표기 정합성 (토글 OFF 시 v3.1 박스 명확히 "예정" 표기)
- [ ] `score-guide`·`how-it-works`·`ServiceMechanismSection` 점수 항목 수 일치
- [ ] Phase A 신기능 안내 (키워드 순위·자동 추천·톡톡 FAQ·C-rank·카카오맵)
- [ ] 요금제 페이지 측정 주기 행 (월1/주1/일1/6h/1h)
- [ ] 요금제 페이지 한도 행 (키워드 추적·자동 추천·FAQ)
- [ ] ACTIVE/LIKELY/INACTIVE 그룹별 메시지 분기 (트라이얼·대시보드·랜딩)
- [ ] 면책 문구 표준 적용 (KeywordRankCard·ScoreCard·AiCitationCard·TrialResultStep·PDF·how-it-works)

### §3.4 — DB 마이그레이션 미실행 컬럼 확인

**참고**: graceful fallback 적용된 컬럼들이 실제 DB에 존재하는지

**점검 항목**:
- [ ] `businesses.is_franchise BOOLEAN`
- [ ] `businesses.naver_intro_draft TEXT` + `naver_intro_generated_at TIMESTAMPTZ`
- [ ] `businesses.talktalk_faq_draft JSONB` + `talktalk_faq_generated_at TIMESTAMPTZ`
- [ ] `businesses.user_group TEXT`
- [ ] `businesses.kakao_auto_check_result/at`
- [ ] `scan_results.keyword_ranks JSONB` + `measurement_context JSONB` + `blog_crank_score`
- [ ] `score_history.keyword_rank_avg/blog_crank_score/user_group_snapshot`
- [ ] `notifications.keyword_change_payload JSONB`
- [ ] `profiles.keyword_suggest_count_month/reset_at` + `last_dashboard_visit`
- [ ] `trial_scans.claimed_at/claim_email/converted_user_id`

→ Supabase SQL Editor에서 직접 실행 필요한 ALTER 명령 출력

### §3.5 — 보안·플랜 한도·반복 버그 패턴

**참고**: CLAUDE.md "필수 코드 패턴" + "작업 시 피해야 할 패턴"

**점검 항목**:
- [ ] supabase-py: `if not res:` 금지 패턴 위반 없음
- [ ] `except Exception: pass` → `_logger.warning()` 변경 필요한 곳
- [ ] `SELECT *` → 필요 필드 명시 (성능)
- [ ] 플랜 한도 누락 엔드포인트 (Pro+/Biz+ 강제 안 됨)
- [ ] CSV injection 방어 (`_csv_safe()` 적용)
- [ ] RFC 5987 Content-Disposition (한글 파일명)
- [ ] CORS `allow_methods` 명시적
- [ ] Rate Limit 누락 엔드포인트 (특히 공개 API)
- [ ] PII 로깅 위험 (이메일·전화번호 평문)
- [ ] `next` 파라미터 검증 (open redirect 방지)

### §3.6 — 빈 상태·에러 폴백·면책 문구 (실측·사실 원칙)

**참고**: CLAUDE.md "작업 중요 지침 #7" — 가짜 수치 금지

**점검 항목**:
- [ ] 빈 상태 메시지 표준 ("아직 측정 데이터 없음 — 첫 스캔 후 표시")
- [ ] 에러 폴백 시 0/N/A 표시 (무작위 숫자 금지)
- [ ] 추정 데이터 `(추정)` 회색 라벨 + 근거 1줄
- [ ] 사용자 입력 데이터 즉시 반영 (스캔·매뉴얼·트라이얼·보고서)
- [ ] 히어로 섹션 가짜 수치 없음 (과거 사고 재발 방지)
- [ ] 신규 기능 출시 전 베타 1명+ 데이터로 검증

### §3.7 — GA4 이벤트 일관성

**참고**: G-KCZTWYK7QV 라이브

**점검 항목**:
- [ ] 핵심 funnel 이벤트 (`trial_complete`/`signup_complete`/`subscription_active`)
- [ ] Phase A 이벤트 (`keyword_input`/`recommend_click`/`measure_start`/`measure_complete`)
- [ ] Trial conversion (`claim_gate_shown/submitted/success/attached`)
- [ ] Onboarding (`onboarding_action_shown/completed/skipped`)
- [ ] Mobile floating CTA (`mobile_floating_cta_shown/click`)
- [ ] Kakao share (`kakao_share_click`/`referral_visit`)
- [ ] Plan recommender (`plan_recommender_cta_click`)

### §3.8 — 모바일·PC 반응형 가독성

**참고**: CLAUDE.md "작업 중요 지침 #1, #2"

**점검 항목**:
- [ ] PC/모바일 별개 페이지 구현 일관성
- [ ] `text-xs` 사용 위치 → `text-sm` 이상 권장
- [ ] `p-8` 고정 → `p-4 md:p-8` 반응형
- [ ] 모바일 floating CTA 위치 (safe-area-inset-bottom)
- [ ] PC 표 ↔ 모바일 카드 분리 (KeywordRankCard 등)
- [ ] 헤더 nav 모바일 햄버거
- [ ] Touch target 최소 44px

### §3.9 — 카카오 알림톡 6종 매핑 일관성

**점검 항목**:
- [ ] `kakao_notify.TEMPLATES` dict에 6종 모두 매핑
- [ ] 각 템플릿 환경변수 override 가능
- [ ] `KakaoNotifier` 클래스명 일관 (과거 `KakaoNotifyService` 오타 재발 방지)
- [ ] `notifications` 테이블 멱등키 패턴 적용
- [ ] AEOLAB_KW_01 미승인 상태에서 graceful skip 동작

### §3.10 — 결제·구독 인프라

**점검 항목**:
- [ ] `TOSS_SECRET_KEY` test_/live_ 환경변수 분기
- [ ] 첫 달 50% 할인 서버 재검증 (`_is_first_time_subscriber()`)
- [ ] webhook 멱등성 (중복 호출 안전)
- [ ] `subscriptions.grace_until` 구독 만료 처리
- [ ] 단일 소스 가격 (`backend/config/prices.py` ↔ `frontend/lib/plans.ts` ↔ `AdminDashboard.tsx`)
- [ ] PayButton ↔ webhook 금액 일치 검증

### §3.11 — 에이전트 보고 검증 의무 (2026-05-01 신설)

**참고**: CLAUDE.md "에이전트 보고 검증 의무" 섹션. 2026-05-01 두 사이클 연속 거짓 보고 사고 발생.

**점검 항목**:
- [ ] 에이전트 위임 작업 후 메인 세션 직접 검증 절차 운영 중인지
- [ ] 백엔드 수정: `Bash` `grep -n` 또는 `Read`로 변경 라인 1개 이상 직접 확인
- [ ] 배포 검증: `ssh root@115.68.231.57 "grep -n <패턴> /var/www/aeolab/<경로>"`로 서버측 반영 확인
- [ ] PM2 재시작 후 `error.log --lines 60 --nostream` 0건 확인
- [ ] 잠재 root flat 잔재 점검 — 같은 이름 파일 중복 위치 확인 (`backend/<file>.py` vs `backend/routers/<file>.py`)
- [ ] `main.py` import 경로(`from routers import ...`)가 정답 → 그 경로 파일 우선 수정 확인
- [ ] 거짓 보고 발견 시 즉시 메인 세션 직접 수정 (에이전트 재위임 금지)

### §3.12 — 토큰 효율 작업 지침 준수 (Claude Max 5x)

**참고**: CLAUDE.md "토큰 효율 작업 지침" 섹션.

**점검 항목**:
- [ ] **모델 선택**: 일반 코드 수정은 Sonnet 4.6 디폴트, Opus는 계획·설계 단계만
- [ ] 단순 검색·문서 작성은 Haiku 4.5 위임 가능 영역 식별
- [ ] **CLAUDE.md 700줄 이내** 유지 (현재 줄수 확인 후 초과 시 압축)
- [ ] 1개월 지난 "최근 업데이트" 항목 → `docs/changelog_archive.md` 이관 여부
- [ ] 서브에이전트 자동 라우팅 활용도 (검색은 `Explore`, 영역별은 `frontend-dev`/`backend-dev`/`db-migrate`)
- [ ] 도구 병렬 호출 패턴 사용 중인지 (독립 작업 단일 메시지 동시 실행)
- [ ] 야간 자동화(`scheduler/jobs.py`)가 Claude 토큰 0 소비 (백엔드 API만 호출)인지 검증

---

## 4. 진행 순서 (자동 라우팅)

### 4.1 단계
1. **점검 단계** (`code-review` 에이전트 자동 발동, `점검` 키워드)
   - §3.1~§3.10 각 영역 병렬 조사 (Explore 에이전트 활용)
   - 발견 문제 P0/P1/P2 분류
   - 사용자에게 진행 방식 확인 (A/B/C 선택)

2. **수정 단계** (영역별 에이전트 자동 라우팅)
   - 백엔드 수정 → `backend-dev`
   - 프론트엔드 수정 → `frontend-dev`
   - DB 마이그레이션 → `db-migrate` (사용자 직접 실행할 SQL 출력)
   - 점수 엔진 수정 → `scan-engine`

3. **재검증 단계** (`code-review` 재발동)
   - 보안·반복 버그 패턴 재점검
   - High 이상 이슈 모두 해결됐는지 확인

4. **배포 단계** (`deploy` 에이전트)
   - SCP 업로드 → npm build → PM2 재시작
   - 라이브 검증 (핵심 엔드포인트 200 OK)
   - 로컬 동기화 (서버 → 로컬)

### 4.2 우선순위 기준

| 등급 | 정의 | 처리 시점 |
|---|---|---|
| P0 (Critical) | 보안 취약점·기능 완전 불가·환불 사유·데이터 손실 | 즉시 수정 |
| P1 (High) | UX 깨짐·플랜 한도 미적용·일관성 불일치 큰 항목 | 같은 세션 |
| P2 (Medium) | 안내문 누락·면책 문구·매뉴얼 보강 | 같은 세션 |
| P3 (Low) | 코드 스타일·주석·미세 가독성 | 다음 세션 |

---

## 5. 보고 요구사항

### 5.1 점검 보고 형식
- 각 항목에 ✅(통과) / ⚠️(보강 필요) / ❌(즉시 수정)
- 발견 문제는 `파일경로:줄번호` 명시
- P0~P3 우선순위 분류
- 600단어 이내 (영역별)

### 5.2 수정 보고 형식
- 수정 파일 + 핵심 변경 1줄 요약
- AST 파싱·TypeScript 컴파일 EXIT 0 확인
- 250단어 이내 (작업별)

### 5.3 배포 보고 형식
- 업로드 파일 수 + 빌드 결과 + PM2 상태
- 라이브 검증 표 (엔드포인트 / 상태 / 응답 요약)
- 발견 오류 즉시 보고 후 중단
- 400단어 이내

---

## 6. 점검 범위 외 (의도적 제외)

| 영역 | 이유 |
|---|---|
| BEP 20명 이전 자동 회귀 테스트 | 우선순위 낮음 |
| Phase 2+ 인프라 분리 (Vercel + Railway) | 100명 이후 |
| Drift Detection / Evidence Trail | BEP 이후 |
| 키워드 추천 AI v2 | 베타 100명 데이터 후 |
| B2G·디지털 바우처 | Phase 4 |
| 인스타그램·당근마켓 노출 | Phase C 이후 |

---

## 7. 점검 후 사용자 직접 액션 (자동 처리 불가)

- DB 마이그레이션 ALTER (Supabase SQL Editor 수동 실행)
- 카카오 비즈센터 AEOLAB_KW_01 신청
- TOSS_SECRET_KEY test_ → live_ 교체 (실결제 전)
- 베타 사용자 5명+ 확보 → §11 KPI 재측정
- SCORE_MODEL_VERSION=v3_1 활성화 (베타 데이터 검증 후)
- GA4 데이터 누적 (24~48h)
- Phase 0 인터뷰 → `lib/testimonials.ts` 실데이터 교체

---

## 8. 사용 예시

### 8.1 전체 점검
```
docs/inspection_request_full.md 읽고 §3 순서대로 모든 점검 진행해줘.
토큰 절약하면서 발견 문제는 P0~P2 분류 후 수정·배포까지 자동 진행할것.
```

### 8.2 부분 점검
```
docs/inspection_request_full.md §3.2 (톡톡 FAQ) + §3.3 (안내문 일관성)만 점검해줘.
```

### 8.3 새 기능 추가 후 점검
```
docs/inspection_request_full.md 기준으로 점검하되,
[새 기능명] 추가 사항도 §3에 포함해서 함께 진행해줘.
```

### 8.4 P0만 즉시 처리
```
docs/inspection_request_full.md §3 모두 점검 후 P0만 즉시 수정·배포해줘.
P1·P2는 보고만.
```

---

## 9. 문서 갱신 규칙

- 신규 기능 출시 시 §3에 점검 영역 1줄 추가
- DB 컬럼 추가 시 §3.4에 항목 추가
- GA4 이벤트 추가 시 §3.7에 추가
- 점수 모델 v3.1 활성화 시 §2.1·§3.3 갱신
- 네이버 사양 변경 발견 시 §2.7·§3.2 갱신 + `docs/<change>_v<version>.md` 신규 작성
- 에이전트 거짓 보고 패턴 재발 시 §3.11에 항목 추가
- BEP 20명 도달 시 §6 일부 → §3으로 이동

---

*최종 업데이트: 2026-05-01 v1.1 — 톡톡 채팅방 메뉴 개편 + Q&A 폐기 + 에이전트 검증 + 토큰 효율 점검 추가*
*용도: 새 대화창 종합 점검 1회 트리거 문서*
*검증: 본 문서 기반 1회 점검 완료(2026-04-30~2026-05-01) → 13개 파일 수정·배포 성공*
