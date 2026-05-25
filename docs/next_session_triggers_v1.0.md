# AEOlab 다음 세션 권장 트리거 v1.0

> 작성일: 2026-05-20 | 최종 갱신: 2026-05-23
> 용도: 새 대화창에서 1줄 트리거 명령으로 즉시 작업 시작 가능하도록 사전 작성
> 마지막 본 세션: §1~§13 전체 점검 완료 (2026-05-23). 즉시 가능 항목 전부 완료. 트리거 대기: §5(P2 AI탭), §6(P3 구독자 4/5명). 사용자 직접: §7.

---

## 0. 트리거 사용법

새 대화창에서 아래 명령 1줄 입력:

```
docs/next_session_triggers_v1.0.md §X 작업 진행해줘.
```

각 섹션은 독립적으로 실행 가능. 우선순위는 §1 > §2 > §3 > §4 순.

---

## §1. 챗봇 UI 헤더 통합 + 모바일 floating

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §1 챗봇 UI 헤더 통합 진행해줘`
> **예상 공수**: 2~3시간
> **우선순위**: 출시 후 1주 내 권장 (운영자 1:1 응대 부담 감소)
> **이미 완료된 기반**:
> - 백엔드 `GET /api/faq/search?q=&limit=10` 엔드포인트 (라우터 `backend/routers/faq.py:52` `search_faqs`)
> - 프론트 `frontend/components/common/HelpSearchInput.tsx` 검색창 컴포넌트 (디바운스·키보드 내비게이션·접근성 완비)

### 작업 범위

1. **사이트 헤더 통합** — `frontend/components/site/SiteHeader.tsx`(또는 동등 위치) PC 헤더에 `HelpSearchInput` 우측 배치. 검색창 placeholder "도움말 검색…"
2. **모바일 floating 버튼** — 화면 우하단 고정. 클릭 시 모달 또는 bottom sheet로 HelpSearchInput + 결과 표시. `safe-area-inset-bottom` 적용
3. **결과 없을 때 fallback** — "찾는 답변이 없으신가요? Q&A 게시판에 문의" CTA로 `/support` 연결
4. **검색 분석 이벤트** — GA4 `help_search_query`, `help_search_result_click`, `help_search_no_result`
5. **FAQ 데이터 보강** — 현재 `faq` 테이블 데이터 점검 후 핵심 30개 항목 미달 시 보강(요금제·환불·스캔 사용법·AI 차별화 설명·플랜별 차이 등)

### 검증

- 비로그인·로그인 모두 헤더 검색 가능
- 모바일 floating 버튼이 다른 floating CTA(예: 트라이얼)와 z-index 충돌 없음
- 검색어 0회·1회 입력 시 디바운스 정상 작동

---

## §2. D.I.A. 70점 미달 가이드 자동 차단/재생성

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §2 D.I.A. 차단 로직 진행해줘`
> **예상 공수**: 2시간
> **우선순위**: 출시 후 1주 내 권장 (낮은 품질 가이드 사용자 노출 차단)
> **현재 상태**: `backend/services/guide_generator.py:326` `if score < 70: logger.warning(...)` — **경고만, 차단 없음**

### 작업 범위

1. **재생성 로직** — D.I.A. 점수 70점 미만 시 자동 재생성(최대 2회). 재생성 시 system_prompt에 "이전 답변의 D.I.A. 점수가 X점이었습니다. 다음 부족 요소를 보강해 주세요: [낮은 점수 요소 리스트]" 추가 컨텍스트
2. **재생성 후에도 70점 미만 시** — 사용자에게 "초안 생성 실패 — 잠시 후 다시 시도해 주세요" 안내 + 운영자 알림 로그(`logger.error` + Slack/이메일 옵션)
3. **점수별 차등 정책**:
   - 90점 이상: 그대로 전달
   - 70~89점: 그대로 전달 + 사용자에게 "추가 보강 가능 항목" 1~2개 안내
   - 70점 미만: 재생성 또는 차단
4. **사용량 관리** — 재생성 시 Claude API 호출 1회 추가. `MAX_CLAUDE_CALLS_PER_JOB` 환경변수 한도 고려
5. **Admin 통계** — `/admin/feedback` 페이지에 D.I.A. 점수 분포 차트 추가

### 검증

- 임의 사업장 5개 가이드 생성 후 모두 70점 이상 통과 확인
- 재생성 1회 발생 시 Claude API 호출량 2배 → 비용 모니터링

---

## §3. 트라이얼 가입 CTA 업종 인지 메시지

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §3 트라이얼 CTA 업종 분기 진행해줘`
> **예상 공수**: 1~2시간
> **우선순위**: 전환율 직결 — 출시 후 1주 내 권장

### 작업 범위

1. `frontend/app/(public)/trial/components/TrialResultStep.tsx` 가입 유도 CTA 업종별 분기:
   - **ACTIVE 업종 (restaurant·cafe·bakery·bar·accommodation)**: "가입하고 네이버 AI 브리핑 노출 시작하기"
   - **LIKELY 업종 (beauty·nail·pet·fitness·yoga·pharmacy 등)**: "가입하고 AI탭 노출 + 확대 예정 대비하기"
   - **INACTIVE 업종 (legal·shopping·accounting 등)**: "가입하고 ChatGPT·Gemini 최적화 진단 받기"
   - **프랜차이즈**: "가입하고 글로벌 AI 노출 시작하기"
2. 기존 단일 "가입하고 정밀 진단받기" CTA 위치 모두 동일 분기
3. GA4 이벤트에 업종 그룹 dimension 추가 (`signup_cta_clicked_active`, `_likely`, `_inactive`, `_franchise`)

### 검증

- 5개 페르소나(restaurant·nail·legal·shopping·franchise) 트라이얼 결과 화면에서 각각 다른 CTA 문구 노출

---

## §4. 점수 모델 v3.1 사전 준비 (선택)

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §4 v3.1 사전 준비 [A/B/C] 진행해줘`
> **현재 상태**: 활성화 인프라 완성 — `.env` `SCORE_MODEL_VERSION=v3_1` + `pm2 restart`만 하면 즉시 적용
> **추가 사전 준비**: 활성화 의사결정 안전망 구축

### Option A — Shadow 모드 (4시간, 권장)

활성화 전에 30일치 v3.0 vs v3.1 비교 데이터 자동 누적.

1. `backend/scheduler/jobs.py daily_scan_all` 잡에서 v3.0 운영 점수와 별도로 v3.1 시뮬레이션도 함께 계산
2. `score_history` 테이블에 `track1_score_v31 NUMERIC` 컬럼 신규 추가 (Supabase SQL Editor):
   ```sql
   ALTER TABLE score_history ADD COLUMN IF NOT EXISTS track1_score_v31 NUMERIC;
   ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS track1_score_v31 NUMERIC;
   ```
3. `score_engine.py` Shadow 헬퍼 함수 신규: `calc_track1_shadow_v31(scan_dict)` — 환경변수 분기 무관 항상 v3.1 계산
4. daily_scan_all에서 `track1_score_v31`도 INSERT
5. 활성화 전 베타 사용자 누적 데이터로 평균 변화량 산출 — 급락 위험 사전 진단

### Option B — Admin 비교 페이지 (2시간)

`/admin/score-comparison` 신규 페이지:
- 최근 30일 사용자별 unified_score(v3.0) vs unified_score(v3.1) 산점도
- ACTIVE/LIKELY/INACTIVE 그룹별 평균 변화량·표준편차·outlier(±20점 이상 변동)
- "활성화 안전 진단" 박스 — 평균 변동 5점 이내·outlier 10% 미만이면 GREEN, 그 외 YELLOW/RED

> **선결 조건**: Option A의 `track1_score_v31` 컬럼·계산 적용 후 30일치 데이터 축적 필요. Option A 없이 B만 단독 실행 불가.

### Option C — 활성화 시 사용자 알림 사전 작성 (1시간)

활성화 시점에 1-click으로 발송할 수 있는 알림 템플릿 사전 작성.

1. `backend/services/score_model_migration_notice.py` 신규:
   ```python
   IN_APP_MESSAGE_TEMPLATE = {
       "title": "점수 산정 방식 개선 안내",
       "body": "AEOlab 점수 모델이 v3.1로 업그레이드됐습니다. 업종별 가중치가 정교화되어 더 정확한 진단을 받으실 수 있습니다.",
       "cta_label": "변화 내용 자세히 보기",
       "cta_url": "/guide/score-model-v3-1",
       "target_segment": "all",
   }
   ```
2. `frontend/app/(dashboard)/guide/score-model-v3-1/page.tsx` 신규 — v3.0 vs v3.1 차이 설명 가이드 페이지
3. 카카오 알림톡 템플릿 `AEOLAB_SCORE_MODEL_01` 비즈센터 신청 (사용자 직접)
4. 활성화 시점 1-click 발송 헬퍼: `send_v3_1_activation_notice()` — 전체 활성 사용자에게 in_app_messages INSERT + 카카오 발송

### Option D — 문서화만 (5분, 최소)

본 §4의 옵션 A/B/C를 모두 다음 세션 트리거로만 남기고 코드 작업 안 함.

### 권장 조합

**가장 안전한 활성화 경로**:
1. 지금: Option A (Shadow 모드) 구현 + Option C (알림 템플릿) 작성
2. 베타 5명 도달 + 30일 후: Option B (비교 페이지) 구현 후 의사결정
3. 안전 진단 GREEN: `.env` 활성화 + Option C 헬퍼로 사용자 알림 발송

---

## §5. P2 — 네이버 AI탭 스캐너 활성화 (6월 트리거)

> **트리거 명령**: `docs/p2_p3_execution_runbook.md 기준으로 P2 실행할 것`
> **트리거 조건**: 네이버 AI탭이 비로그인 일반 사용자에게 노출 확인 (주 2회 월·목 자동 모니터링)
> **예상 시점**: 2026-06~07

기존 런북: `docs/p2_p3_execution_runbook.md` §P2 (Step 1~8) 그대로 사용. 본 문서에서는 트리거 명령만 안내.

### 트리거 확인 명령 (주 2회 자동)

`scheduler/jobs.py:ai_tab_trigger_check_job` — 매주 월·목 09:00 KST 자동 점검 + 트리거 충족 시 카카오 알림(예정).

수동 확인:
```bash
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "ai_tab_trigger"'
```

---

## §6. P3 — 점수 모델 v3.1 활성화 (베타 5명 트리거)

> **트리거 명령**: `docs/p2_p3_execution_runbook.md §P3 실행할 것 (단, §4 사전 준비 옵션 결과 먼저 검토)`
> **트리거 조건**: 베타 구독자 5명 이상 — `[P3-READY]` 자동 로그 발생
> **현재 상태**: 베타 0명 (또는 미달)

### 트리거 확인 명령 (매일 09:15 KST 자동)

`scheduler/jobs.py:5025 _check_v3_1_readiness_job` — 매일 09:15 KST 베타 구독자 수 점검 + 5명 도달 시 `[P3-READY]` warning 로그.

수동 확인:
```bash
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "P3-READY"'
```

### 활성화 1줄 명령

```bash
ssh root@115.68.231.57 'sed -i "s/SCORE_MODEL_VERSION=v3_0/SCORE_MODEL_VERSION=v3_1/" /var/www/aeolab/backend/.env && pm2 restart aeolab-backend'
```

(`.env`에 키가 없으면 `echo "SCORE_MODEL_VERSION=v3_1" >> /var/www/aeolab/backend/.env` 사용)

### 롤백 1줄 명령

```bash
ssh root@115.68.231.57 'sed -i "s/SCORE_MODEL_VERSION=v3_1/SCORE_MODEL_VERSION=v3_0/" /var/www/aeolab/backend/.env && pm2 restart aeolab-backend'
```

---

## §9. 경쟁사 keyword_gap 자동화

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §9 경쟁사 keyword_gap 자동화 진행해줘`
> **예상 공수**: 2~3시간
> **우선순위**: 즉시 가능 (구독자 0명도 가능)
> **현재 상태**: `backend/scheduler/jobs.py` `_enrich_competitor_excerpts` 함수 구현됨, APScheduler 미등록

### 작업 범위

1. `backend/scheduler/jobs.py`에서 `_enrich_competitor_excerpts` 잡을 APScheduler에 등록
   - 주기: 매주 일요일 02:00 KST (트래픽 최저점)
   - 대상: 최근 30일 내 스캔된 사업장의 경쟁사
2. 에러 핸들링: 실패 시 `logger.warning()` 후 다음 경쟁사로 continue (전체 중단 방지)
3. API 비용 상한: 잡당 최대 Claude 호출 `MAX_CLAUDE_CALLS_PER_JOB` 환경변수 적용
4. 로그: `[keyword_gap_enrich] 완료 N건 / 실패 M건` 형태로 요약 출력

### 검증

- APScheduler job list에 `enrich_competitor_keywords_job` 등록 확인
- SSH: `pm2 logs aeolab-backend --lines 100 | grep keyword_gap`

---

## §10. 대행 서비스 주문 플로우 완성

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §10 대행 서비스 주문 플로우 진행해줘`
> **예상 공수**: 4~5시간
> **우선순위**: 즉시 가능 — BEP 달성에 직결
> **현재 상태**: `AgencyServiceSection.tsx` 정적 카드만 존재. 주문 플로우 미연결.
> **참고 문서**: `docs/agency_service_and_iboss_improvements_v1.0.md`

### 작업 범위

1. **주문 생성 API** — `POST /api/agency/order` (인증 필요, Basic+ 플랜 게이트)
   - `delivery_orders` 테이블에 INSERT (service_type, amount, status="pending")
   - 토스페이먼츠 단건 결제 confirm API 연동 (`/api/payments/confirm`)
2. **주문 완료 UI** — 결제 성공 시 주문 번호 + "영업일 3일 내 연락드립니다" 안내
3. **카카오 알림톡** — `AEOLAB_DELIVERY_01`(주문접수) 발송 (사업자 → 운영자 이메일도 동시)
4. **운영자 알림** — `contact@aeolab.co.kr` 새 주문 이메일 알림
5. **주문 내역 페이지** — `(dashboard)/delivery/orders/page.tsx` 신규 (주문 목록 + 상태)

### 사전 필요 (사용자 직접)

- 토스페이먼츠 대시보드에서 1회성 결제 상품 등록
- 카카오 비즈센터 `AEOLAB_DELIVERY_01~04` 템플릿 신청

---

## §11. 신규 기능 기획 및 구현

> **트리거 명령**: `CLAUDE.md와 docs/next_features_v1.0.md를 읽을 것. next-feature 에이전트를 사용해서 BEP 20명 달성에 가장 직접적으로 기여하는 다음 기능을 선택하고 백엔드·프론트엔드·DB 변경 범위를 설계한 후 구현 순서를 제시할 것.`
> **예상 공수**: 기능에 따라 2~8시간
> **우선순위**: §10 완료 후

### 후보 기능 (next_features_v1.0.md 기준)

| 기능 | BEP 기여도 | 공수 |
|------|-----------|------|
| Growth Card 이미지 공유 | 중 (바이럴) | 3h |
| 경쟁사 실시간 모니터링 알림 | 상 (재방문) | 4h |
| 월간 시장 리포트 이메일 | 상 (유지율) | 3h |
| 키워드 순위 30일 트렌드 차트 | 중 (깊이) | 2h |

---

## §12. 소개글 AI 초안 생성기

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §12 소개글 AI 초안 생성기 진행해줘`
> **트리거 조건**: 유료 구독자 5명 이상 (BEP 도달 전후)
> **예상 공수**: 3~4시간
> **참고 문서**: `docs/remaining_tasks_v1.0.md §3`

### 작업 범위

1. **백엔드** — `POST /api/tools/intro-draft` (Basic+ 플랜 게이트, Claude Haiku)
   - 입력: 업종, 사업장명, 키워드 3~5개, 특징 텍스트
   - 출력: 소개글 초안 200자 이내 (네이버 스마트플레이스 기준)
   - 월 한도: `faq_monthly` 플랜 게이트 공유 (기존 가이드 생성 한도와 합산)
   - 결과 저장: `businesses.naver_intro_draft` 업데이트
2. **프론트엔드** — 가이드 페이지 또는 대시보드 내 버튼 + 결과 미리보기 + 복사 버튼
3. **graceful fallback** — 컬럼 미존재 시 0건 처리 (Supabase v4.1 적용됨)

---

## §13. 서버 업그레이드 후 Playwright 동시성 상향

> **트리거 명령**: `docs/next_session_triggers_v1.0.md §13 Playwright 동시성 상향 진행해줘`
> **트리거 조건**: iwinv 서버 업그레이드 완료 (vCPU2/RAM4GB → 상위 사양)
> **예상 공수**: 1시간

### 작업 범위

1. `backend/services/multi_scanner.py` `PLAYWRIGHT_SEMAPHORE = Semaphore(1)` → `Semaphore(int(os.getenv("PLAYWRIGHT_MAX_CONCURRENCY", "1")))`
2. `backend/services/naver_ai_tab_scanner.py` `_AI_TAB_SEMAPHORE = Semaphore(1)` → 동일 환경변수 또는 공유 세마포어로 통합
3. 서버 `.env`에 `PLAYWRIGHT_MAX_CONCURRENCY=2` 추가 (RAM 8GB 기준)
4. 배포 후 `pm2 logs`에서 동시 Playwright 2개 동작 확인

---

## §7. 비즈니스 KPI 작업 (사용자 직접)

> 코드 변경 불필요. 사용자가 외부 시스템에서 진행.

| 작업 | 트리거 | 방법 |
|------|------|------|
| 베타 후기 1~3개 확보 | Phase 0 인터뷰 후 | `frontend/lib/testimonials.ts` `isPlaceholder: false` 처리 |
| TOSS_SECRET_KEY live_ 전환 | 실결제 시작 직전 | 서버 `.env` 수정 + `pm2 restart aeolab-backend` |
| 카카오 비즈센터 `AEOLAB_DELIVERY_01~04` 신청 | §10 대행 서비스 주문 플로우 진행 전 | 비즈센터 → 알림톡 채널 → 템플릿 추가 |
| 토스페이먼츠 1회성 결제 상품 등록 | §10 진행 전 | 토스 대시보드 → 상품 등록 |
| 카카오 비즈센터 `AEOLAB_KW_01` 신청 | 키워드 순위 알림 활성화 시 | 비즈센터 → 알림톡 채널 → 템플릿 추가 |
| 카카오 비즈센터 `AEOLAB_SCORE_MODEL_01` 신청 | §4 Option C 진행 시 | 동일 |
| 점수 모델 v3.1 활성화 결정 | §4·§6 완료 후 | §6 1줄 명령 |
| 서버 업그레이드 | 구독자 확보 + 서버 비용 감당 가능 시 | iwinv 대시보드 → 사양 업그레이드 → §13 진행 |

---

## §8. 시기 의존 모니터링 (자동화됨)

> 사용자 액션 불필요. 자동으로 트리거되어 알림이 옴.

| 자동 잡 | 주기 | 트리거 시 알림 |
|---------|------|---------|
| `ai_tab_trigger_check_job` | 월·목 09:00 KST | AI탭 노출 트리거 충족 시 |
| `_check_v3_1_readiness_job` | 매일 09:15 KST | 베타 5명+ 도달 시 `[P3-READY]` 로그 |
| `briefing_category_expansion_monitor_job` | 매월 1일 09:00 KST | LIKELY 업종 ACTIVE 승급 후보 감지 시 |
| `inactive_post_alert_job` | 매일 09:00 KST | 14일 소식 미작성 사용자에게 카카오 알림 |
| `daily_scan_all` | 매일 03:00 KST | 자동 스캔 — 알림 없이 백그라운드 |

---

## 새 대화창 빠른 시작 명령 모음

```
# ─── 즉시 가능 (구독자 0명도 가능) ──────────────────────────────
# BEP 달성 직결 — 대행 서비스 주문 플로우
docs/next_session_triggers_v1.0.md §10 대행 서비스 주문 플로우 진행해줘

# 경쟁사 keyword_gap 자동화
docs/next_session_triggers_v1.0.md §9 경쟁사 keyword_gap 자동화 진행해줘

# 다음 신규 기능 기획
CLAUDE.md와 docs/next_features_v1.0.md를 읽을 것. next-feature 에이전트를 사용해서 BEP 20명 달성에 가장 직접적으로 기여하는 다음 기능을 선택하고 설계·구현 순서를 제시할 것.

# 운영 안정화 + 전환율
docs/next_session_triggers_v1.0.md §1 챗봇 UI 헤더 통합 진행해줘
docs/next_session_triggers_v1.0.md §3 트라이얼 CTA 업종 분기 진행해줘
docs/next_session_triggers_v1.0.md §2 D.I.A. 차단 로직 진행해줘

# v3.1 사전 준비 (선택 - 사용자가 옵션 결정)
docs/next_session_triggers_v1.0.md §4 v3.1 사전 준비 [A/B/C] 진행해줘

# ─── 조건부 (트리거 대기) ───────────────────────────────────────
# 유료 구독자 5명+ 달성 시
docs/next_session_triggers_v1.0.md §12 소개글 AI 초안 생성기 진행해줘

# 6월 네이버 AI탭 비로그인 표시 확인 후
docs/p2_p3_execution_runbook.md 기준으로 P2 실행할 것

# pm2 logs에서 [P3-READY] 확인 후
docs/p2_p3_execution_runbook.md 기준으로 P3 실행할 것

# 서버 업그레이드 완료 후
docs/next_session_triggers_v1.0.md §13 Playwright 동시성 상향 진행해줘
```

---

## 본 세션 작업 완료 내역 (2026-05-20)

### 1차 — 코드 결함 점검 후 P1 5 + P2 6 + 추가 기능 3 = 14건 배포
- 보안: faq/inquiry/notices timing attack 제거 + admin_auth 통합
- Admin UI: `/admin/feedback` 피드백 집계, `/admin/notices` 공지 CRUD 신규
- 인프라: 세마포어 공유, silent except 제거, ai_tab_checklists briefing_engine 연결
- 추가: pricing FAQ 환불 조건, FAQ 검색 API, HelpSearchInput 컴포넌트

### 2차 — 콘텐츠 맞춤화 깊이 점검 후 P1 2 + P2 4 = 6건 배포
- globalWeight 업종별 기본값(`lib/dualTrack.ts` 신규, 57개 업종)
- AiTabPreviewCard checklist 인터페이스 + weight 기반 렌더링
- industry_prompt_rules._RULES 25 → 45개 (massage·skincare·accounting 등 20개 추가)
- briefing_engine 답변 템플릿 6종 (restaurant_group·beauty_group·medical_group·professional_group·fitness_group·default)
- AiInfoTabGuide Step 2 외부 smartplace 링크
- NaverAiPathwayCard 채널 측정 차이 미니 안내

**서비스 핵심 가치(업종별 AI 차별화 정보 제공) 도달도 — 종합 등급: 상.**

---

## 본 세션 작업 완료 내역 (2026-05-22)

### inspection_fixes_runbook §A~§I + scan_result_screens P0~P3 + prelaunch 14개 점검

| 완료 항목 | 커밋 |
|----------|------|
| §H text-xs → text-sm (TrialResultStep + NaverAiPathwayCard) | `c879278` |
| P2-1 ScoreEvidenceCard V3_2_WEIGHTS + ⑦ AI탭 블록 | `c879278` |
| 프리런치 점검 14개 체크포인트 전항목 ✅ (docs 기록) | `b4f5f5f` |
| P1-3 AI 브리핑 LIKELY "확대 예정" → "확대 검토 중" | `6ad05e4` |
| P1-4 DashboardHeroCard Google AI 추가 + 5채널 표기 | `6ad05e4` |
| P1-6 TrialResultStep AI탭(확대 예정) ↔ AI 브리핑(검토 중) 분리 | `6ad05e4` |
| 9-A-2 가이드 페이지 동작 확인 (chatgpt-search·blog-strategy) | 확인만 |
| 9-A-3 simulate_ai_tab_answer v2 필드 확인 | 확인만 |

---

## 본 세션 작업 완료 내역 (2026-05-23 추가)

### §1~§13 전체 점검 + P2 사전 코드 통합

| 완료 항목 | 커밋 |
|----------|------|
| §9 keyword_gap 자동화: 주기 일요일 02:00 + 비용상한 + 로그 | `7ccb04c` |
| §13 Playwright 동시성 환경변수 분리 (PLAYWRIGHT_MAX_CONCURRENCY) | `51aa644` |
| P2 multi_scanner.scan_all() AI탭 통합 (NAVER_AI_TAB_ENABLED 분기) | `068ee62` |
| P2 score_engine.calc_naver_exposure() AI탭 +20점 보너스 | `068ee62` |
| §1~§4·§10~§12 기구현 확인, §5 DB 5테이블·RESEND·qrcode 설치 확인 | 확인만 |

### 현재 상태 요약

| 항목 | 상태 |
|------|------|
| §1~§4, §9~§13 즉시 가능 전체 | ✅ 완료 |
| 팔로업 이메일 (RESEND_API_KEY 설정 완료) | ✅ 매일 10:00 자동 실행 중 |
| 대행 서비스 DB 5테이블 | ✅ 존재 확인 |
| §5 P2 AI탭 스캐너 활성화 | ⏳ AI탭 비로그인 노출 확인 후 `.env NAVER_AI_TAB_ENABLED=true` |
| §6 P3 v3.1 활성화 | ⏳ 구독자 4/5명 — 1명 달성 후 `.env SCORE_MODEL_VERSION=v3_1` |
| §7 비즈니스 KPI | 사용자 직접 |
| §8 자동화 잡 | ✅ 5개 전부 등록·실행 중 |

---

## 본 세션 작업 완료 내역 (2026-05-23 §11)

### §11 Growth Card 카카오 공유 + 공개 공유 랜딩 (신규 기능)

| 완료 항목 | 파일 |
|----------|------|
| GrowthClient.tsx 카카오 공유 버튼 + handleGrowthShare | `growth/GrowthClient.tsx:148,207,791` |
| `/share/growth` 공개 공유 랜딩 페이지 (OG 메타) | `(public)/share/growth/page.tsx` |
| GrowthShareClient.tsx (링크 복사 fallback) | `(public)/share/growth/GrowthShareClient.tsx` |
| 서버 빌드 성공 + PM2 both online | 배포 완료 |

공유 URL 형태: `https://aeolab.co.kr/share/growth?img=...&biz=...&score=...`

---

*최종 업데이트: 2026-05-23 | 다음 갱신: P2 트리거 충족 시 또는 P3 [P3-READY] 로그 발생 시*
