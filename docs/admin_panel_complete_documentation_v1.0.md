# 관리자(Admin) 페이지 종합 문서 v1.0

> 2026-07-11 작성. "관리자가 서비스하고 있는 모든 것을 총괄 확인 가능한가"라는 질문에서 시작된 세션(2026-07-10~11)의 전체 작업을 정리한 단일 참조 문서. 설계 배경은 `docs/admin_service_oversight_design_v1.0.md`, 이번 문서는 **as-built(실제 구현된 최종 상태)** 기준.

---

## 0. 접속 정보

- **주소**: `https://aeolab.co.kr/admin` (하위 페이지는 §2 참조)
- **로그인**: `https://aeolab.co.kr/login`에서 Supabase 계정으로 로그인 → `ADMIN_EMAILS`(프론트 `.env.local`) 화이트리스트에 있으면 `/admin/*` 접근 가능
- **자격증명**: `docs/.admin_credentials.local` (git 추적 제외, 로컬 전용 — 이 문서에는 기재하지 않음)
- **owner 권한 계정**: `hoozdev@gmail.com` (`admin_users` 테이블에 `role=owner`로 시딩됨 — 구독 강제해지/환불 등 금전이동 액션 가능)
- ⚠️ **알려진 죽은 UI**: `/admin` 최초 진입 시 "관리자 키 입력" 폼이 뜨지만 입력값이 실제로 전송되지 않음(2026-07-10 발견) — 아무 값이나 입력 후 확인을 누르면 Supabase 세션만으로 통과됨. 정리 필요 시 별도 요청.

---

## 1. 인증 구조 (3단계)

| 계층 | 역할 | 적용 대상 |
|---|---|---|
| ① Supabase 세션 + `ADMIN_EMAILS`(프론트) | `/admin/*` 페이지 자체 접근 여부 | 모든 admin 프론트 페이지(서버 컴포넌트에서 `redirect` 처리) |
| ② `X-Admin-Key`(백엔드 공유 시크릿, `verify_admin`) | 백엔드 API 호출 인증 | 거의 모든 `/admin/*` 백엔드 엔드포인트 |
| ③ `X-Admin-Email` + `admin_users.role`(백엔드, `require_owner`) | 금전이동 등 고위험 액션 추가 인증 | 구독 강제해지, `admin_users` CRUD |

- 프론트 `/api/admin-proxy`(`frontend/app/api/admin-proxy/route.ts`)가 Supabase 세션 검증 → `X-Admin-Key`(서버 환경변수, 클라이언트 비노출) + `X-Admin-Email`(로그인 이메일)을 백엔드로 전달하는 단일 게이트웨이.
- `require_owner`는 `verify_admin`을 내부에서 먼저 호출(①②③ 순차 통과 필요) 후 `admin_users` 테이블에서 `role=owner` 확인.
- **구조적 한계**(설계 문서에 명시): `X-Admin-Key`를 이미 아는 상태에서 curl 직접 호출 시 `X-Admin-Email`은 위조 가능 — 이 인증은 "정상 로그인한 여러 관리자 간 권한 분리"가 목적이며 시크릿 유출 자체에 대한 방어는 아님.

---

## 2. 관리자 페이지 전체 인벤토리 (13개)

| 경로 | 파일 | 기능 | 신규(이번 세션) |
|---|---|---|---|
| `/admin` | `page.tsx`, `AdminDashboard.tsx` | 대시보드(구독·매출·업종분포) + FAQ탭 + 문의탭 + **AI사용량** + **코호트분석** | 일부 확장 |
| `/admin/business` | `page.tsx`, `AdminBusinessSearchClient.tsx` | 사업장 검색(이름·이메일) | ✅ 신규 |
| `/admin/business/[id]` | `page.tsx` | 사업장 상세 — 스캔이력·가이드·경쟁사·블로그진단·변화기록 통합 | ✅ 신규 |
| `/admin/ops` | `page.tsx`, `AdminOpsClient.tsx` | 감사로그·시스템알림·결제이벤트·창업리포트·관리자계정 관리 | ✅ 신규 |
| `/admin/delivery`, `/admin/delivery/[id]` | — | 대행서비스 의뢰 목록·상세 | 기존 |
| `/admin/support`, `/admin/support/[id]` | — | 1:1 문의 티켓 목록·상세(+사업장 정보 카드) | 상세에 사업장카드 추가 |
| `/admin/stories` | — | 성공사례 등록/수정(PATCH 신규)/목록 | 수정 기능 추가 |
| `/admin/notices` | — | 공지사항 CRUD | 기존 |
| `/admin/feedback` | — | 만족도 피드백 집계 | 기존 |
| `/admin/comms` | — | 컨텍스트 팁 + 인앱 메시지 CRUD | 기존 |
| `/admin/score-comparison` | — | v3.0 vs v3.1 점수 비교 | 기존 |

---

## 3. 신규 DB 테이블 (5개, 전부 RLS 활성화 + 정책 없음 = service_role 전용)

| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `admin_audit_log` | 관리자 액션(POST/PATCH/DELETE) 자동 감사로그 | admin_email, method, path, status_code, body_snippet |
| `system_alerts` | 운영 알림(`send_operator_alert`/`send_slack_alert`) 영구 이력 | subject, message, level, source |
| `payment_events` | 결제 이벤트(최초결제·자동갱신) 성공/실패 이력 | user_id, event_type, status, amount, detail |
| `admin_users` | 관리자 권한(owner/support) | email, role |
| `startup_report_log` | 창업 시장분석 리포트 요청 이력(예비창업자 포함) | user_id, business_id(nullable), category, region |

CHECK 제약: `payment_events_event_type_check`, `payment_events_status_check`, `admin_users_role_check` — 임의 문자열 삽입 방지.

---

## 4. 신규 백엔드 엔드포인트 (`backend/routers/admin.py`, 13개)

| 메서드/경로 | 인증 | 설명 |
|---|---|---|
| `POST /subscriptions/{user_id}/cancel` | `require_owner` | 관리자 강제 구독 해지/환불(`settings.py _cancel_subscription_core` 공유 — 안전장치 재구현 안 함) |
| `GET /subscriptions` | `verify_admin` | 구독자 검색(이메일)+필터(플랜/상태)+팀원수/API키수 |
| `GET /businesses` | `verify_admin` | 사업장 검색(이름/소유자이메일) |
| `GET /businesses/{id}` | `verify_admin` | 사업장 상세(스캔10건·가이드10건·경쟁사·블로그진단10건·변화기록10건) |
| `GET /audit-log` | `verify_admin` | 감사로그 조회 |
| `GET /system-alerts` | `verify_admin` | 운영알림 조회 |
| `GET /payment-events` | `verify_admin` | 결제이벤트 조회(이메일 병합) |
| `GET/POST/DELETE /admin-users` | `require_owner` | 관리자 계정 CRUD(자기 자신 강등/삭제 방지) |
| `GET /cohort-analysis` | `verify_admin` | 가입월 코호트 유지율(상태이력 부재로 스냅샷 기준, `data_caveat` 명시) |
| `GET /startup-reports` | `verify_admin` | 창업리포트 요청 이력 |
| `GET /ai-usage` | `verify_admin` | AI채널별(Gemini/ChatGPT/네이버/Google) 스캔세션수 + 가이드/어시스턴트 사용량 |

기존 유지: `GET /stats`, `/revenue`, `/category-distribution`, `/scan-logs`(죽은 엔드포인트, 미연결), `POST /broadcast`(죽은 엔드포인트, 미연결 — 위험도 높아 UI화 보류), `/score-comparison`, `/dia-stats`, `/email-preview`, `/email-test-send`.

**계측 삽입**(기존 로직에 로깅만 추가, 흐름 변경 없음):
- `webhook.py issue_billing` → `payment_events`(billing_issue)
- `services/toss_billing.py retry_billing` → `payment_events`(renewal)
- `services/email_sender.py send_operator_alert`, `utils/alert.py send_slack_alert` → `system_alerts`
- `scheduler/jobs.py` `EVENT_JOB_ERROR` 리스너(`_on_job_error`) → 잡 실패 시 `send_operator_alert` 자동 호출
- `routers/startup.py generate_startup_report` → `startup_report_log`
- `main.py AdminAuditMiddleware` → 모든 관리자 POST/PATCH/DELETE 자동 기록

---

## 5. 작업 순서 및 근거 (git 커밋 순)

| 커밋 | 내용 |
|---|---|
| `9bc825f` | (선행 세션) 관리자 화면 기능 공백 4건: 성공사례 수정·구독자 검색·고객지원 사업장조회·구독 강제해지 |
| `fe963dd` | 1~4단계: 감사로그·알림이력·사업장통합조회(P0)·잡헬스모니터링 |
| `6ac8148` | 1차 재점검 수정: 미들웨어 로그누락(P1)·안전장치(P2) |
| `972d8d7` | 5단계: AI 비용/사용량 모니터링 |
| `ac7d846` | 6·H·I단계: 결제이벤트로그·관리자권한체계·코호트분석 |
| `2879e56` | 2차 재점검 수정: self-downgrade 잠금 위험·이메일 정규화·CHECK제약 등 P1/P2 4건 |
| `c96dbdf` | 설계 약속했으나 누락됐던 블로그진단·변화기록을 사업장 상세뷰에 보완 |
| `f4926d2` | 잔여 공백: 창업리포트 로그(예비창업자 포함)·팀/API키 사용현황 |
| `d6b6025` | 3차(홀리스틱) 재점검 수정: 운영현황 섹션별 독립 에러처리(P1) |
| `03a8117` | 문서화: CLAUDE.md/changelog_archive.md 세션 요약 기록 |

**검증 방법론**: 매 단계 배포 후 curl 스모크테스트 + Playwright 라이브 브라우저 검증 + PM2 에러로그 확인. `code-review` 에이전트 홀리스틱 재검토 3회(P0 발견 0건 유지). 빈 상태(0건)뿐 아니라 실데이터 삽입 후 렌더링까지 검증(초기엔 빈 상태만 확인하고 실데이터 경로를 놓쳤던 3곳 — payment_events·system_alerts·blog_analysis — 을 자체 재점검으로 발견·보완).

---

## 6. 의도적으로 배제한 것 (오판/누락 아님, 문서화된 판단)

- `POST /admin/broadcast` UI화 — 전체 구독자 카카오 발송, dry-run 없이 위험도 높아 이번 범위에서 제외(사용자 결정)
- 개별 관리자 세분화 권한(owner/support 외 3단계 이상) — 관리자 1~2명 규모에서 오버엔지니어링
- 정밀 토큰/원화 비용 산정(AI사용량은 "스캔 세션 수"까지만) — 범위 밖, 후속 과제
- 카카오맵 체크리스트·키워드CRUD 등 보조기능 admin 노출 — 운영 판단 불필요한 조회성 기능이라 제외

---

## 7. 알려진 제약 및 후속 과제

1. **payment_events 소급 불가** — 2026-07-10 테이블 생성 이후 이벤트만 기록. 그 이전 결제 이력은 추적 불가.
2. **cohort-analysis 스냅샷 한계** — `subscriptions`가 상태변경 이력을 안 남겨 정밀 월별 이탈 시점 계산 불가(`data_caveat` 필드로 프론트에도 명시).
3. **admin_users 이메일 위조 구조적 한계** — §1 참조. ADMIN_SECRET_KEY 유출 시 완전한 방어는 아님.
4. **`/admin` 관리자 키 입력 폼이 죽은 UI** — §0 참조. 정리 필요 시 요청.
5. **TOSS_SECRET_KEY가 아직 test_ 모드** — 실결제 미전환. `payment_events`·구독 환불 로직은 테스트 게이트웨이로만 검증됨. 실결제 전환(`test_`→`live_`) 후 소액 실결제로 재검증 권장(CLAUDE.md "남은 작업" 참조).
6. **자동화 유닛테스트 부재** — 이 프로젝트 전체의 구조적 공백(이번 세션 문제 아님). `backend/tests/test_category_alias.py` 1개뿐이며 CI에도 연결 안 됨.

---

## 8. 참고 문서

- `docs/admin_service_oversight_design_v1.0.md` — 설계 배경, 우선순위 결정 근거(4개 축: 고객운영·시스템관찰가능성·거버넌스·비즈니스인텔리전스)
- `docs/admin_functional_gaps_implementation_plan_v1.0.md` — 선행 4개 기능공백 구현 계획
- `docs/admin_screens_inspection_plan_v1.0.md` — 이전 세션의 관리자 화면 버그 점검(P0~P2, 완료됨)
- `docs/.admin_credentials.local` — 로그인 자격증명(git 비추적)

---

## 9. 새 대화창 트리거

> `docs/admin_panel_complete_documentation_v1.0.md 기준으로 관리자 페이지 현황 확인` — 이 문서를 참조점으로 관리자 기능 추가/수정 작업 시작 가능.
