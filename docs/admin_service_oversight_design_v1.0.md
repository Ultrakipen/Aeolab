# 관리자 서비스 총괄 대시보드 설계 v1.0

> 2026-07-10 작성. "사용자에게 서비스하고 있는 모든 것을 admin이 확인할 수 있는가"라는 질문에서 시작. 라우터 39개(백엔드) + admin 프론트 10페이지 전수 대조로 커버리지를 실측하고, 공백 항목마다 근거+반증을 거쳐 설계했다. **이 문서는 설계안이며 구현 전 사용자 피드백을 받기 위한 것 — 아직 구현하지 않았다.**

---

## 0. 오판·누락 검증 요약 (구현 전 필수 절차 적용)

- **상속/참조 문서 확인**: `docs/admin_screens_inspection_plan_v1.0.md`(§1.1~1.3)는 "`/admin/*` 프론트 페이지가 실제로 무엇과 연결돼 있는가"만 다뤘다. "사용자 대면 라우터 중 admin 대응이 아예 없는 것은 무엇인가"라는 역방향 질문은 다루지 않았다 — 중복 아님, 새 관점.
- **메모리 확인**: `MEMORY.md` 전체에 "admin 총괄/oversight/전체조회" 계열 메모리 없음 — 새로 다루는 주제.
- **코드 단일 소스 확인**: `backend/main.py:100-139`(라우터 39개 mount) + `grep -rl verify_admin backend/routers/*.py`(12개 파일만 관리자 게이팅 보유) 대조로 실측. 표는 §1 참조.
- **반증 시도**: "Supabase Studio로 이미 다 보이는 거 아닌가?" → 맞다, 원본 DB 접근으로는 전부 조회 가능하다(§4에 명시). 하지만 이는 "관리자 화면(앱 내 UI)"이 아니라 raw DB 콘솔이라 검색·필터·고객 대응 속도·오조작 위험 측면에서 별개 문제다 — 그래서 이 갭은 유효하다.
- **❌ 매핑**: 아래 각 항목에 "이게 없으면 어떤 상황에서 못 하는지" 구체적 실패 시나리오를 명시했다.

---

## 1. 커버리지 실측 매트릭스

`backend/main.py` 라우터 mount 39개 전수 grep 결과:

### ✅ admin 화면 보유 (12개 라우터)

| 라우터 | admin 프론트 | 상태 |
|---|---|---|
| `admin.py` | `/admin` 대시보드 | 통계·구독(검색/필터/강제해지 신규)·매출·업종분포·점수비교 |
| `delivery.py` | `/admin/delivery` | 완비 |
| `support.py` | `/admin/support` | 완비(+사업장조회 신규) |
| `stories.py` | `/admin/stories` | 완비(+수정 신규) |
| `notices.py` | `/admin/notices` | 완비 |
| `faq.py` | `/admin` FAQ탭 | 완비 |
| `inquiry.py` | `/admin` 문의탭 | 완비 |
| `feedback.py` | `/admin/feedback` | 완비 |
| `tips.py`, `messages.py`, `system_status.py` | `/admin/comms` | 완비 |
| `scan.py` | (없음) | verify_admin은 트라이얼 쿨다운 우회용, 오versight 아님 |

### ❌ admin 화면 전무 (21개 라우터 — `verify_admin` 자체가 없음)

| 라우터 | 사용자 대면 역할 | 데이터 볼륨(2026-07-10 실측) |
|---|---|---|
| `report.py` | **스캔 결과·점수 리포트 조회 — 서비스 핵심 산출물** | `scan_results` 다수, 지금 이 시각도 계속 쌓임 |
| `guide.py` | AI 개선 가이드 생성(Claude Sonnet 호출) | `guides` 테이블 |
| `business.py` | 사업장 CRUD | 확인된 사업장 7개(§2 조사 중 실측) |
| `competitor.py` | 경쟁사 등록·조회 | `competitors` 테이블 |
| `blog.py` | 블로그 진단 | `blog_analysis`, `blog_score_history` |
| `actions.py` | 변화 기록(행동-결과 타임라인) | `business_action_log` |
| `startup.py` | 창업 리포트 | — |
| `assistant.py` | AI 어시스턴트 채팅(Claude Haiku, 비용 발생) | `assistant_logs` |
| `webhook.py` | 결제 빌링키 발급 | **이벤트 로그 테이블 자체가 없음(§3-C 참조)** |
| `teams.py`, `api_keys.py` | Biz+ 팀·API키 | — |
| `kakao.py`, `tools.py`, `keywords.py`, `business_search.py`, `share.py`, `schema_gen.py`, `public_index.py`, `public_briefing.py` | 보조 기능 | — |

### 부수 발견 (§1.3 계열, 기존 문서에 없던 것)

- `admin.py:GET /scan-logs`는 이미 `businesses(name)` join까지 구현됐지만 **프론트 호출처 0건인 죽은 엔드포인트** — 재활용 가능한 기반 코드.
- `admin.py:POST /broadcast`도 여전히 프론트 미연결(기존 문서 §1.3에 이미 기록됨, 재확인만) — 전체 구독자 카카오 발송, dry-run 없음, 위험도 높음.
- CLAUDE.md API 엔드포인트 표의 `POST /api/webhook/toss/confirm`이 실제 `webhook.py`에는 존재하지 않음(현재는 `/toss/billing/issue` 하나뿐) — 별도로 CLAUDE.md 정정 필요(이 설계와 무관한 문서 drift, §5에 기록만).

---

## 2. 설계안 — 우선순위별

### P0. 사용자/사업장 통합 조회 화면 (신규: `/admin/business/[id]` 또는 `/admin/users`)

**❌ 없으면 어떤 상황에서 못 하는가**: 사용자가 "내 점수가 이상해요" 문의를 넣었는데 아직 지원 티켓을 안 만들었거나, 이메일로 직접 연락 온 경우 — 지금은 그 사업장을 admin 화면에서 검색할 방법이 전혀 없다(§support 조회는 티켓이 있어야만 도달 가능).

**설계**:
- 검색 입력(이메일/사업장명) → `businesses` 테이블 `ilike` 검색(구독자 검색과 동일 패턴) → 사업장 선택 시 상세 패널:
  - 기본 정보 (category, region, is_active, created_at)
  - 최근 스캔 이력 N건 — `admin.py GET /scan-logs`를 `business_id` 필터 파라미터 추가해 재활용(신규 엔드포인트 아님, 기존 죽은 코드 확장)
  - 점수 추이 (track1/track2/unified, `scan_results` 시계열) — `report.py`의 기존 히스토리 쿼리 로직을 admin 버전으로 복제(사용자 인증 대신 `verify_admin`)
  - 최근 가이드 생성 이력 (`guides.select("id, generated_at, summary")`)
  - 등록된 경쟁사 목록 (`competitors`)
- **DB 변경**: 없음 (전부 기존 테이블 read)
- **비용 영향**: 없음 (Supabase read만, AI 호출 없음)
- **재사용**: 이번 세션에서 만든 "고객지원용 사업장 조회"(`support.py admin_get_ticket`의 businesses+scan_results dict-merge 패턴)를 독립 엔드포인트로 승격하면 코드 대부분 재사용 가능

### P1. AI 비용/사용량 모니터링 대시보드 (신규: `/admin` 대시보드에 섹션 추가)

**❌ 없으면 어떤 상황에서 못 하는가**: CLAUDE.md "API 비용 관리" 섹션이 전부 **추정치**("~$3~8", "구독자 확보 후 실측 필요"라고 스스로 명시)인데, 지금 활성 구독자 5명이 실제로 있고 스캔이 계속 발생 중이다(§1 매트릭스에서 확인). 실측 없이 추정치로만 마진율을 판단하는 중 — BEP 20명 앞두고 리스크.

**설계**:
- 기간별(일/주/월) Gemini·ChatGPT·네이버·Google 스캔 실행 횟수 (`scan_results` count, 이미 `admin.py get_stats`에 유사 로직 있음 — 확장)
- `assistant_logs` 건수(Claude Haiku 채팅 호출량)
- `guides` 생성 건수(Claude Sonnet 호출량) — `dia-stats`가 이미 `guides.tools_json`을 읽고 있으니 같은 쿼리에 건수 컬럼만 추가
- **DB 변경**: 없음
- **비용 영향**: 없음 (집계 쿼리만)
- 참고: 정확한 토큰/원화 비용까지 내려면 API 응답의 usage 필드를 별도 저장해야 하는데, 이건 범위가 커서 이번 설계에서는 "호출 횟수" 집계까지만 — 원화 환산은 후속 과제로 분리 제안

### P1-구조적. 결제/웹훅 이벤트 로그 (신규 DB 테이블 필요 — 다른 항목과 성격이 다름)

**❌ 없으면 어떤 상황에서 못 하는가**: 사용자가 "결제했는데 구독이 안 됐어요"라고 문의하면, 지금은 `subscriptions` 테이블의 **현재 상태**만 보이고 "결제 시도가 실패했는지, 애초에 안 들어왔는지"를 구분할 이력이 없다. PM2 로그는 로테이트되어 며칠 지나면 사라진다.

**설계**:
- 신규 테이블 `payment_events`(user_id, event_type, status, amount, raw_response, created_at) — `webhook.py issue_billing`과 `jobs.py retry_billing`에 insert 1줄씩 추가
- **DB 변경 필요** (다른 항목과 달리 스키마 마이그레이션 대상 — Supabase SQL Editor 수동 실행)
- **비용 영향**: 거의 없음 (insert만)
- **주의**: 소급 적용 불가 — 테이블 생성 시점 이후 이벤트부터만 쌓임. 과거 결제 문제는 여전히 추적 불가

### P2. 경쟁사·블로그진단·변화기록·창업리포트 — 별도 화면 대신 P0에 흡수

**근거**: 각각 화면을 새로 만들면 4개 화면이 되지만, 전부 `business_id` 기준 데이터라 P0(사업장 통합 조회)의 탭으로 붙이면 신규 화면 0개로 해결됨. 우선순위를 낮추는 이유는 "안 만들어도 된다"가 아니라 "P0 구현 시 같이 딸려온다"는 것.

### P2. Biz+ 팀·API키 사용 현황

**❌ 매핑 시도 → 반증됨**: 지금 활성 구독자 5명 중 Biz 플랜 3명(§실측)이지만, teams/api_keys 실사용 여부는 미확인. 볼륨이 작아 "이게 없어서 못 하는 구체 상황"을 지금 특정하기 어려움 — **후순위로 명확히 분류, 필요성 재확인 후 착수 권장**.

---

## 3. 손대지 않는 것(의도적 배제)

- `share.py`, `schema_gen.py`, `kakao.py`, `tools.py`, `keywords.py`, `business_search.py`, `public_index.py`, `public_briefing.py` — 전부 조회/보조 기능이거나 정적 콘텐츠 제공. admin이 개입할 운영 판단이 딱히 없음. 필요 시 P0 사업장 상세뷰에 참고 정보로만 곁들이면 충분.
- `/admin/broadcast` UI화 — 이번 설계 범위에서 제외. 위험도가 높아(전체 발송·되돌릴 수 없음·dry-run 없음) 별도로 "발송 대상자 수 미리보기 + 확인모달 + 발송 이력 기록"까지 갖춘 뒤에 손대는 게 안전. **사용자 결정 필요**: 애초에 UI를 만들 계획이 있었는지, 아니면 의도적으로 curl 전용으로 남겨둔 것인지.

---

## 3-A. 장기 사업화 관점 확장 (사용자 요청: "장기적인 사업으로 구상하면 어떤 것이 필요한가")

> P0~P2가 "지금 당장 보이지 않는 데이터"였다면, 아래는 "지금은 1인 개발이라 안 느껴지지만 사업이 커지면 반드시 필요해지는 구조"다. 코드 직접 확인으로 근거를 잡았다.

### E. 관리자 감사 로그(Audit Log) — 가장 시급한 구조적 공백

**근거**: `grep CREATE TABLE ... audit|admin_log`(전체 스키마) → **0건**. `backend/utils/admin_auth.py`의 `verify_admin`은 `ADMIN_SECRET_KEY` **단일 공유 시크릿** 검증만 하고, "누가" 했는지는 전혀 기록하지 않는다. 반면 `frontend`의 `ADMIN_EMAILS`는 **이미 콤마 구분 다중 이메일을 지원하도록 설계돼 있다**(`admin/comms/page.tsx:5` 등 6곳) — 즉 "관리자가 여러 명"인 상황은 이미 프론트에서 전제하고 있는데, 백엔드는 그걸 구분할 방법이 없는 비대칭 상태다.

**❌ 없으면 어떤 상황에서 못 하는가**: 이번에 추가한 "관리자 강제 구독 취소/환불"처럼 **되돌릴 수 없는 금전 이동 액션**이 지금은 "누가 언제 왜 실행했는지" 기록이 전혀 없다. 1인 체제에서는 본인이 기억하면 되지만, 서포트 직원을 채용하는 순간 — "이 환불, 내가 승인 안 했는데 누가 눌렀지?"에 답할 방법이 없다.

**설계**: 신규 테이블 `admin_audit_log`(admin_email, action, target(user_id/business_id/story_id 등), detail_json, created_at) — 이번 세션에서 만든 4개 신규 admin 엔드포인트(성공사례 수정·구독취소·구독검색)부터 우선 계측. **DB 변경 필요**.

### F. 알림 이력 영구 저장

**근거**: `send_operator_alert`(`email_sender.py:1444`)·`send_slack_alert`(`utils/alert.py:9`) 둘 다 **fire-and-forget** — 이메일/Slack으로 보내고 끝, DB에 남기지 않는다.

**❌ 없으면 어떤 상황에서 못 하는가**: "지난주에 결제 실패 알림이 몇 건 왔었지?"를 확인하려면 이메일함을 뒤지는 수밖에 없다. 알림 이메일이 삭제되면 이력 자체가 사라진다.

**설계**: `send_operator_alert` 호출 시 동일 payload를 `system_alerts` 테이블에도 insert(1줄 추가로 가능) + `/admin` 대시보드에 최근 알림 목록 섹션. **DB 변경 필요**하지만 매우 저렴함(기존 함수 1곳만 수정하면 향후 모든 호출처에 자동 적용).

### G. 스케줄러 잡 헬스 모니터링

**근거**: `grep add_listener|EVENT_JOB_ERROR backend/scheduler/jobs.py` → **0건**. CLAUDE.md에 명시된 수십 개 APScheduler 잡(그 중 2개는 Claude 호출·비용 발생) 중 하나가 조용히 실패해도 PM2 로그(로테이트로 며칠 뒤 소멸)에만 남고 admin은 알 방법이 없다.

**❌ 없으면 어떤 상황에서 못 하는가**: `weekly_post_draft_job`처럼 Claude를 호출하는 잡이 매주 조용히 실패하면 — 사용자는 "왜 이번 주 콘텐츠 초안이 안 왔지"라고만 느끼고, admin은 그 문의를 받기 전까지 아예 모른다.

**설계**: `scheduler.add_listener(_on_job_error, EVENT_JOB_ERROR)` 등록 → 실패 시 `send_operator_alert` 자동 호출(위 F의 `system_alerts`에도 쌓임, 시너지). **DB 변경 불필요**(F가 먼저 있으면 이건 리스너 코드만 추가).

### H. 개별 관리자 계정 체계 (지금은 트리거 조건부 보류 권장)

**근거**: 지금은 `ADMIN_SECRET_KEY` 하나로 모든 백엔드 admin 액션이 동일 권한. 프론트는 이메일별 게이트가 있지만 "서포트 직원은 환불 불가, 답변만 가능" 같은 세분화된 권한 분리는 없음.

**반증 시도 → 지금은 보류가 맞음**: 활성 구독자 5명·1인 개발 체제에서 권한 분리는 오버엔지니어링이다. **트리거 조건 명시**: 2번째 admin 계정(서포트 직원 등)이 실제로 생기는 시점에 착수.

### I. 비즈니스 인텔리전스(코호트·이탈률·전환퍼널)

**근거**: CLAUDE.md 목표에 "구독 100명, MRR 100만원 → 시드 IR"이 명시돼 있다 — 투자자 미팅에는 결국 코호트 유지율·이탈률·CAC 같은 지표가 필요해진다. 지금 `admin.py get_revenue`는 월별 매출 합계만 있고 코호트 분석은 없음.

**반증 시도 → 지금은 시기상조**: 활성 구독자 5명으로는 코호트 분석 자체가 통계적으로 의미가 없다(표본 부족). **트리거 조건 명시**: 구독자 30명 이상 또는 시드 준비 착수 시점.

---

## 4. Supabase Studio와의 관계 (중요 전제)

1인 개발 체제라 위 갭들이 있어도 **Supabase Studio(원본 DB 콘솔)로는 지금도 모든 테이블에 접근 가능**하다. 이 설계는 "완전히 안 보인다"를 해결하는 게 아니라, "검색·필터·클릭 한 번으로" 접근 가능하게 해서 고객 대응 속도를 높이고, 원본 DB에서 직접 update/delete하다가 실수할 위험을 줄이는 것이 목적이다.

---

## 5. 이번 설계와 별개로 발견한 문서 drift (참고)

- CLAUDE.md "백엔드 API 엔드포인트" 표에 `POST /api/webhook/toss/confirm`이 기재돼 있으나 실제 `webhook.py`에는 없음(billing/issue로 통합된 것으로 추정). 이 설계 구현과 별도로 CLAUDE.md 정정 필요.

---

## 6. 종합 로드맵 제안 (2026-07-10, 사용자 "장기 사업 관점" 요청 반영)

> `/broadcast` UI화는 이번 범위에서 제외 확정(사용자 결정). 아래는 근거의 시급성 순으로 재정렬한 착수 순서 — E(감사로그)가 P0보다 앞선 이유는 "이미 금전 이동 기능이 배포돼 있는데 무기록 상태"가 P0(불편함)보다 리스크가 크기 때문.

| 단계 | 항목 | DB 변경 | 트리거 조건 |
|---|---|---|---|
| **1** | **E. 관리자 감사 로그** | 신규 테이블(`admin_audit_log`) | 지금 즉시 — 이미 배포된 금전이동 기능(구독 강제해지)이 무기록 상태 |
| **2** | **F. 알림 이력 영구 저장** | 신규 테이블(`system_alerts`) | 지금 즉시 — E와 같은 세션에서 함께 하면 중복 작업 최소화 |
| **3** | **P0. 사용자/사업장 통합 조회** | 없음 | 지금 즉시 — 고객대응 체감 개선 가장 큼 |
| **4** | **G. 스케줄러 잡 헬스 모니터링** | 없음(F 선행 시) | 지금 즉시 — Claude 호출 잡 실패를 놓치면 비용·품질 문제로 직결 |
| **5** | **P1. AI 비용/사용량 모니터링** | 없음 | BEP(20명) 근접 시 — 마진율 재검토 필요 시점과 일치 |
| **6** | **P1-구조적. 결제 이벤트 로그** | 신규 테이블(`payment_events`) | 결제 관련 문의가 실제로 반복될 때 — 선제 구축보다 필요 확인 후 |
| 보류 | H. 개별 관리자 계정 체계 | 신규 테이블 | 2번째 admin 계정이 실제로 생기는 시점 |
| 보류 | I. 비즈니스 인텔리전스 | 없음(집계 쿼리) | 구독자 30명 이상 또는 시드 준비 착수 시점 |

**요약**: 1~4단계(E·F·P0·G)는 전부 DB 영향이 없거나 작은 신규 테이블 1~2개뿐이고, 비용 영향도 없어 지금 한 번에 진행하는 것을 권장. 5~6단계는 실제 규모/문의가 쌓인 뒤 착수해도 늦지 않음. H·I는 지금 만들면 오버엔지니어링.

**다음 단계**: 이 순서에 동의하면 `docs/admin_functional_gaps_implementation_plan_v1.0.md`와 같은 형식으로 1~4단계 구현 계획 문서를 짠 뒤 착수.
