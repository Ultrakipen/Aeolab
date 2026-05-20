# AEOlab 다음 세션 권장 트리거 v1.0

> 작성일: 2026-05-20
> 용도: 새 대화창에서 1줄 트리거 명령으로 즉시 작업 시작 가능하도록 사전 작성
> 마지막 본 세션: 콘텐츠 맞춤화 깊이 강화(P1 2 + P2 4) 배포 완료. 서비스 핵심 가치 도달도 "상" 등급 달성.

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

## §7. 비즈니스 KPI 작업 (사용자 직접)

> 코드 변경 불필요. 사용자가 외부 시스템에서 진행.

| 작업 | 트리거 | 방법 |
|------|------|------|
| 베타 후기 1~3개 확보 | Phase 0 인터뷰 후 | `frontend/lib/testimonials.ts` `isPlaceholder: false` 처리 |
| TOSS_SECRET_KEY live_ 전환 | 실결제 시작 직전 | 서버 `.env` 수정 + `pm2 restart aeolab-backend` |
| 카카오 비즈센터 `AEOLAB_KW_01` 신청 | 키워드 순위 알림 활성화 시 | 비즈센터 → 알림톡 채널 → 템플릿 추가 |
| 카카오 비즈센터 `AEOLAB_SCORE_MODEL_01` 신청 | §4 Option C 진행 시 | 동일 |
| 점수 모델 v3.1 활성화 결정 | §4·§6 완료 후 | §6 1줄 명령 |

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
# 출시 직후 1주 내 권장 (운영 안정화 + 전환율)
docs/next_session_triggers_v1.0.md §1 챗봇 UI 헤더 통합 진행해줘
docs/next_session_triggers_v1.0.md §3 트라이얼 CTA 업종 분기 진행해줘
docs/next_session_triggers_v1.0.md §2 D.I.A. 차단 로직 진행해줘

# v3.1 사전 준비 (선택 - 사용자가 옵션 결정)
docs/next_session_triggers_v1.0.md §4 v3.1 사전 준비 [A/B/C] 진행해줘

# 시기 의존 (자동 알림 받은 후)
docs/p2_p3_execution_runbook.md 기준으로 P2 실행할 것
docs/p2_p3_execution_runbook.md 기준으로 P3 실행할 것
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

*최종 업데이트: 2026-05-20 | 다음 갱신: §1·§2·§3 작업 완료 시 또는 v3.1·P2 활성화 시*
