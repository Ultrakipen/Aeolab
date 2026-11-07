# 상업 서비스 시작 전 분야별 전문가 점검 (2026-11-06)

보안·네이버 차단·정보 신뢰성·UI/UX 실측·결제/법무/운영 5개 분야를 에이전트로 병렬 점검하고, 핵심 근거는 메인 세션이 직접 확인했다.
**에이전트 보고에서 오탐·과장이 다수 나왔다 — 아래 '기각'을 다음 점검에서 다시 올리지 말 것.**

## 수정·배포 완료
| 항목 | 내용 | 파일 / 테스트 |
|---|---|---|
| 이중 청구 (P1) | `issue_billing`이 활성 구독을 확인하지 않아 재결제 시 같은 금액이 또 청구되고 `end_at`이 덮어써짐 → 같은 플랜·같은 주기·active·만료 전이면 빌링키 발급 전에 409. 다른 플랜(=유일한 업그레이드 경로)·grace_period(복구)·cancelled(재구독)는 허용, 카드 변경은 `/card/update` 별도 경로 | `routers/webhook.py` / `test_billing_issue_duplicate_guard.py` |
| SSRF (P1) | IP 리터럴만 막아 `*.nip.io` 등 내부 해석 도메인과 `allow_redirects=True` 리다이렉트로 우회 가능 → 연결 시점 리졸버 검사 + 리다이렉트 단계별 검사. 같은 약점이던 `blog_analyzer._analyze_external_blog`에도 적용 | `services/website_checker.py`, `blog_analyzer.py` / `test_website_checker_ssrf.py` |
| 스마트플레이스 점검 한도 | 사용자별 시간당 6회(제안값, `SMARTPLACE_CHECK_HOURLY_CAP`, 0이면 끔) | `routers/report.py` / `test_smartplace_check_user_cap.py` |
| 블로그 초안 템플릿 | 구조 지시가 가격·영업시간을 필수 단계처럼 요구해 '사실 지어내기 금지'와 충돌 → 입력에 있을 때만 쓰도록 정정 | `services/guide_generator.py` / `test_blog_template_no_forced_facts.py` |
| UI | 로그인·가입 `<title>` 분리, 랜딩 PC 차트 라벨 viewBox 7~8→9(렌더 10.5~12→13.6px), 체험 결과의 '오늘 할 일 보기 ↓'·'네이버 플레이스 →' 터치 영역 40px·12→14px | `app/(auth)/*/layout.tsx`, `app/page.tsx`, `TrialResultStep.tsx` |

## 후속 확인 (같은 날 저녁)
- **서버/git drift**: `scripts/check_server_drift.sh` → `[내용DRIFT]` 0건(출력의 ⚠ 줄은 고정 안내문). `[로컬에만]`은 서버 git이 추적하지 않는 새 테스트·문서뿐. 서버 working tree == 로컬 HEAD 내용이라 push 시 `reset --hard`가 서버 내용을 되돌릴 위험은 확인되지 않음. **push는 미실행**(자동 배포 트리거 — 사용자 확인 후).
- **환불 자격 실태(코드 추적, DB 미조회)**: 사업장 등록은 풀 스캔을 자동 실행하지 않는다(`business.py` create 후 작업: 체험 이전·Before 스크린샷·플레이스 동기화·블로그 분석·웰컴 메일). 대시보드에도 자동 측정 없음(첫 측정은 사용자가 직접 누르는 단계). `scan_results` 행이 결제 전에 생기는 경로는 ①체험 결과 이전(`_import_trial_scan`, trial_scan_id 전달 시) ②사용자가 무료 첫 측정을 실행한 경우. 환불 자격은 이 행이 하나도 없어야 하므로(`settings._check_refund_eligibility`) **체험→가입 전환 경로와 무료 첫 측정 이용자는 7일 이내여도 자동 환불 대상에서 제외**된다. 비중은 데이터 미확인. 정책 변경(예: 구독 시작 이후의 이용만 집계)은 사업·법무 결정이라 코드 미변경.
- **로그인 링크**: 모바일 헤더 '로그인' 20px → 클릭 영역 40px(`-my-1`로 헤더 높이 57px 유지, 처음엔 `-my-1` 없이 배포해 헤더가 65px로 커지는 회귀를 라이브 측정으로 잡아 수정). 라이브 확인 시 브라우저가 60초 캐시된 HTML을 받아 구버전처럼 보임 → 쿼리스트링으로 캐시 우회 후 측정.
- **/demo 실측**: PC 텍스트 265개·모바일 262개 모두 14px 이상, 가로 넘침·화면 밖 요소 없음. 로그인 후 실제 대시보드는 계정이 없어 미실측.

## RLS 전수 확인 결과 (2026-11-07, 사용자 SQL 실행)
- 뷰 `score_trend_30d`·`weekly_scores`: `security_invoker=true` → 원본 RLS 적용, 안전.
- **`naver_prescan` P1 확정·조치 완료**: 정책 `service_naver_prescan_all`이 `roles={public}`, `cmd=ALL`, `qual=true`라 공개 anon 키로 조회·쓰기·삭제 가능했음(09-22 `trial_scans`와 같은 패턴). 테이블은 GitHub Actions `Naver Nightly Scan`이 매일 채우고 백엔드 정기·수동 스캔이 재사용하므로 가짜 결과 주입 시 사용자 점수에 가짜 '미노출'이 저장될 수 있었음(실제 악용 흔적은 미확인). 사용자가 `DROP POLICY IF EXISTS "service_naver_prescan_all" ON public.naver_prescan;` 실행·`pg_policies` 재조회 '행 없음' 확인(11-07). 백엔드와 GitHub Actions는 service role(BYPASSRLS)이라 영향 없음(`supabase_client.py:22-24`, `github_naver_scan.py:44-49`). 스키마 파일 끝에 같은 DROP 마이그레이션 + `test_schema_no_open_policies.py`(열린 정책이 뒤에서 닫히는지 검사) 추가.
- 의도된 공개로 판단: `competitor_snapshots`·`scan_analytics`·`index_snapshots`(사업장 식별 컬럼 없는 집계), `notices`·`faqs`·`success_stories`. 낮은 위험: `waitlist`·`inquiries` 익명 INSERT(읽기 불가).
- **미확인**: `support_tickets.public_answered_tickets`는 공개 답변 티켓의 `body`·`attachment_urls`·`user_id`를 익명에게 노출 — 공개 전환이 사용자 선택인지, 첨부 URL이 공개돼도 되는지 확인 안 함. **야간 스캔 사전 스캔 재사용이 정책 삭제 뒤에도 정상인지는 다음 01:00 KST 실행 후 로그로 확인 필요.**
- **결정 필요**: `.github/workflows/naver_scan.yml`('IP Rotation')이 매일 GitHub 서버 IP로 네이버를 스캔 중(최근 6회 success). CLAUDE.md의 '네이버 접속 IP 단일 유지(분산은 차단됐을 때만)' 방침과 충돌 가능, 서버 쿼터·회로를 거치는지 미확인.

## 로그인 후 화면 실측 (2026-11-07, 사용자 제공 개발자 계정 · 읽기 전용)
**방법**: 비밀번호는 문서·메모리에 적지 않음. 스캔·새로고침·결제·저장 버튼은 누르지 않았고 네트워크 요청은 GET 위주로 확인. PC 1440 / 모바일 390.
- **정상**: PC·모바일 모두 가로 넘침 없음, 본문 대부분 14px 이상(12px는 괄호 보조문구·차트 범례), 점수 숫자 직접 노출 없음(텍스트 레이블), 측정 한계 표시 정직("순위 측정 전", "9월 29일 확인·최신 아님", "38일 전·다시 측정 권장"). `/growth`·`/history`·`/guide`는 모바일 잘림·넘침 없음.
- **오탐으로 기각**: ①측정 스크립트에 '화면 밖'으로 잡힌 PC 요소 다수 = 닫힌 슬라이드 패널(`translate-x-full`)이라 시각적 잘림 아님. ②Recharts 콘솔 경고 76건("차트 너비·높이 0") = 초기 렌더 측정 경고, 차트는 실제로 그려짐. ③`/blog-analysis` 모바일의 짧은 문서(909px) = 자동 재분석 진행 중 화면.
- **수정·배포(5파일, 서버 빌드 exit=0, 라이브 실측 확인)**:
  - 모바일 접이식 카드 부제목이 "노…"·"네이…"·"Go…"처럼 조각만 남던 말줄임 → 모바일은 다음 줄 전체 폭(`CollapseSectionWrapper`), sm 이상은 기존 유지.
  - 긴 한글 상호명이 `break-keep` 때문에 줄바꿈 안 돼 '공유' 버튼이 화면 밖으로 40px 밀림(공유 right 415 > 375) → `min-w-0`+`overflow-wrap:anywhere`, 공유 버튼은 모바일 아이콘만(수정 후 right 359). 긴 이름은 2줄로 감싼다.
  - 3칸 카드 상태 문구 "9월 29일 확/인" 어절 중간 줄바꿈 → `break-keep`(`DashboardHeroCard`).
  - 닫힌 '가게 정보 빠른 수정' 패널이 `role=dialog aria-modal`인 채 Tab으로 닿는 요소 19개 → 닫히면 `inert`+`aria-hidden`.
  - 경쟁사 카드 아이콘 새로고침 버튼 터치 영역 확대 + `aria-label` 추가(네이버 접속을 일으키는 버튼이라 오터치 방지).
- **미해결(디자인 결정)**: ①모바일 우하단 플로팅 버튼 2개(AI 도우미 56px·도움말 48px)가 카드 우측 내용·배지를 가림(현재 FAB는 제거하지 않음). ②카드 상세 문구 12px(`text-xs`) — 3열 격자에서 14px로 올리면 줄이 늘어남. ③경쟁사 주소 4건이 모바일에서 약간 말줄임.
- **미확인**: `/settings`, `/review-inbox`, `/ad-defense`, `/delivery`, `/startup`, `/schema` 및 가이드·히스토리·블로그의 PC 실측, 로그인 상태 헤더의 40px 링크.
- **부수 효과(내 방문)**: `/blog-analysis`는 열기만 해도 결과가 없거나 구 형식·오래된 경우 `POST /api/blog/analyze`를 자동 실행한다(`BlogClient.tsx` 자동 분석 effect). 개발 계정(Biz, 월 한도 무제한·쿨다운 없음)의 블로그 분석이 1회 실행됐다. 코드상 이 경로는 공식 검색 API+RSS(aiohttp)만 쓰고 Playwright 호출은 없다. **구독자는 자동 분석이 월 한도(Basic 3회)와 24시간 쿨다운을 소모하는지 확인 필요**(분석은 `notifications.type=blog_analysis`로 집계됨 — 자동·수동 구분 없음).

## 보안: 공개 저장소의 점검용 계정 비밀번호 (조치 필요)
- GitHub `Ultrakipen/Aeolab`은 **PUBLIC**이고, 추적 문서 2개(`commercial_inspection_standard_v1.0.md`, `six_pages_prelaunch_inspection_v1.0.md`)에 점검용 계정 이메일+비밀번호가 평문으로 기록돼 `origin/main`에 올라가 있었다(최초 커밋 `c44b1960`).
- 작업본에서는 문서의 비밀번호를 지웠다(추적 파일 전체 0건). **git 이력에는 남아 있으므로 비밀번호 교체가 실질적 해결**이다. 해당 계정과 같은 비밀번호를 쓰는 다른 계정(관리자 포함)도 같이 바꿔야 한다. 이력 정리(`git filter-repo`+force push)는 공개 저장소 이력 변경이라 사용자 결정 사항.
- 규칙: 점검용 계정 정보는 문서·메모리·커밋에 적지 않는다(점검 때마다 사용자에게 받는다). `.playwright-mcp/`는 gitignore지만 스냅샷 파일에 폼 값이 남을 수 있다.

## 2차 개선 — 결정 실행과 정정 (2026-11-07 새벽)
방침: 사용자가 쉽게 이해하는 방향 · 오판/오탐/누락을 매번 점검 · Gemini 유료 연결은 보류(`GEMINI_MEASUREMENT_LIVE=false` 유지).

### 정정 (이전 제안·보고에서 틀렸던 것)
- **플로팅 버튼 병합 권고 철회**: 2026-07-25에 같은 이유(우하단 버튼 3개 겹침)로 이미 하나를 제거했고(`DashboardShell.tsx` 주석), 남은 두 개 중 도움말 검색은 모바일의 유일한 도움말 검색 진입점(PC 헤더 검색창은 `lg` 미만 숨김, `HelpFAQFloat.tsx`)이다. 합치면 접근성이 줄어 변경하지 않음.
- **9번(측정 방식 안내 추가) 철회**: `how-it-works`에 이미 있다("서울 기준 비로그인 PC/모바일로 측정", "실제로 뜨는지 직접 확인"), 대시보드에도 "어떻게 조사했나요?" 접이식이 있다.
- **`silent`는 자동 실행 표시가 아니다**: `handleAnalyze({silent:true})`는 자동 갱신·재분석 버튼·키워드 변경 3곳에서 쓰인다 → 자동 경로에만 별도 `auto`를 단다.
- **환불 "이용" 판정 보정**: 결제 후 사업장 등록 때 자동 생성되는 체험 가져오기 행(`gemini·chatgpt·naver 결과 전부 NULL`)은 사용자가 한 일이 아니므로 이용으로 세지 않는다(그냥 `scanned_at >= start_at`만 쓰면 오히려 환불이 막힌다).

### 코드로 반영한 것 (서버 배포·라이브 확인 완료, 모두 변이 검증된 테스트 동반)
| 항목 | 내용 | 테스트 |
|---|---|---|
| 자동 블로그 분석 | 화면이 사용자 요청 없이 시작한 분석은 월 한도에서 최대 2회/월 면제(`BLOG_AUTO_FREE_PER_MONTH`, 0이면 끔). `auto`는 클라이언트 값이라 서버가 월 상한을 다시 집계, 집계 실패 시 면제 안 함. 24시간 쿨다운·동시 실행 제한은 그대로(네이버 접속 보호). 면제분은 `notifications.type=blog_analysis_auto`로 별도 기록 | `test_blog_auto_analysis_free.py` |
| 환불 자격 | 구독 시작 이후 + 측정 결과가 있는 스캔, 시작 이후 생성한 가이드만 이용으로 센다. 조회 실패는 해지 500이 아니라 환불 불가로 처리(해지 경로가 예외 처리 없이 호출) | `test_refund_eligibility_scope.py` |
| 공개 티켓 | 백엔드 `/api/support/public` 컬럼 고정 테스트 + 익명 직접 조회 정책 닫는 SQL을 스키마 기록에 추가(**DB 반영은 사용자 SQL 실행 필요, 아래**) | `test_support_public_columns.py` |
| GitHub 야간 스캔 | 저장소 변수 `NAVER_SCAN_DISABLED=true`로 잡 전체 중단 스위치(변수 없으면 기존대로 실행) | `test_naver_scan_workflow_switch.py` |
| 사실 단정 제거 | 소식·소개글·블로그·카페·지식인 초안의 "네이버 예약으로 … 가능", "전화·카카오톡 문의 환영" 등 확인 안 된 영업 사실 7곳 삭제(예약 보유 여부 입력이 없어 문장 자체를 넣지 않음) | `test_briefing_drafts_no_unverified_channel_claims.py` (원본에서 33건 실패) |
| 오래된 측정의 긍정 단정 | 38일 전 측정인데 "정보형 AI 브리핑에도 노출 중입니다"로 현재형 단정하던 맨 위 문구·카드 2곳에 측정일 표기(기존 `positiveDetail` 규칙에서 빠져 있었음) | `test_ui_render_hero_stale_claims.py`(실제 렌더) |

### 사용자 이해 개선 (라이브 모바일·PC 실측 확인)
- **개선 후 반영 예상 기간 패널**: 한 줄에 12px 괄호 설명 4개가 섞이던 5행 → 라벨·기간만 14px 4행, 근거는 "기간이 이렇게 잡힌 이유" 접이식. `(추정)` 표시는 본문에 남김. **Gemini 행은 `GEMINI_LIVE`일 때만**(다른 곳은 이미 그렇게 숨겼는데 이 패널만 항상 보였음).
- **모바일 3칸 카드**: 폭 약 93px에서 "확/인"·"정보형 노출/중"처럼 끊기던 3열 → 모바일은 카드 한 줄씩(아이콘 | 이름·상태·설명 14px), `sm` 이상은 기존 3열.
- **측정 신선도 줄**("38일 전 · 다시 측정 권장") 12px → 14px. 접이식 카드 부제목은 모바일에서 다음 줄 전체 폭. 경쟁사 주소는 말줄임 대신 최대 3줄.
- 12px 텍스트(모바일 대시보드): 13개 → 6개(남은 것: 배지 3종, "오늘의 개선 미션" 라벨).

### 네이버 차단 대응
**현재 상태(11-07 01시 KST)**: `GET /api/status/naver` = `ok`, 서버 킬스위치 파일 없음, 서버 `.env`의 네이버 관련 설정은 `NAVER_SCAN_SLOT_SPREAD=true`뿐(나머지는 코드 기본값). 사용자 보고: 차단 위험 때문에 스캔 횟수를 조정함 — 그 조정 내용은 이 점검에서 코드로 확인하지 못함.

**확인된 구멍 2개** (둘 다 코드·`gh run list`로 확인):
1. **GitHub 야간 스캔(`naver_scan.yml`)이 서버 안전장치 밖이다.** 서버의 쿼터·회로·킬스위치는 **서버 디스크의 파일**(`.naver_place_breaker.json`·`.naver_search_breaker.json`·`.naver_rate_window.json`·`.naver_kill_switch`, `naver_access_guard.py`)이라 GitHub 러너에는 없다 — 러너는 매 실행이 빈 상태로 시작해 전날 차단 이력도 일일 상한도 기억하지 못하고, 서버 킬스위치 파일로도 멈출 수 없다(환경변수 킬스위치는 코드에 있으나 워크플로가 전달하지 않는다). 스크립트는 요금제별 스캔 일정을 보지 않고 **모든 활성 사업장을 매일 밤** 네이버 검색 + 플레이스 페이지까지 스캔한다(서버 정기 스캔은 `NAVER_SCAN_SLOT_SPREAD`로 요일을 나눔). 코드 주석에도 "iwinv IP 차단 우회"라고 적혀 있어 IP 분산 성격이며, 우리 문서상 법적 민감 항목이다.
2. **재사용 설계가 실제로는 작동하지 않는 것으로 보인다.** 서버 정기 스캔(02:00 KST)은 `scan_date=오늘` 사전 스캔 행을 찾는데, GitHub 예약 지연으로 실제 시작은 **04:35~08:13 KST**(최근 8회) → 02:00 시점엔 행이 없다 → 서버가 직접 네이버를 스캔하고 GitHub도 같은 날 늦게 한 번 더 스캔한다(같은 날 늦게 저장된 행은 수동 스캔만 사용). 추정 근거 = 실행 시각 + 조회 날짜 로직. **미확인**: 재사용 로그는 debug 레벨이라 직접 확인 못 함.

**조치**: 중단 스위치만 추가(기본 동작 불변). `gh variable set NAVER_SCAN_DISABLED --body true` / 재개 `gh variable delete NAVER_SCAN_DISABLED`. **끄는 것은 권고하지만 실행하지 않았다** — CLAUDE.md 8번(법적 민감·기능 축소는 사용자 결정 없이 실행 금지). 끄면 서버가 02:00에 직접 하는 접속은 지금과 같고(어차피 재사용 못 함), GitHub 쪽 추가 접속만 사라진다.

**단계별 대응(제안, 11-04 S-1~S-3 문서와 정합)**
- 평시: 상태 `ok` 확인, GitHub 스캔 중복 접속 제거(위 권고).
- S-1 일시(0~3일): 서버 킬스위치 + **GitHub 변수 스위치 둘 다** 켠다(이번에 두 번째가 생김). 측정은 건너뛰고 화면은 "확인 전", 복구 후 가짜 변화 금지(`change_signal_guard`).
- S-2 지속(수 주): 네이버 항목 제외·재정규화, 공식 API·ChatGPT·구글 측정 중심 안내.
- S-3 영구: 제품 정의 재결정 — 사용자 판단.
- **미착수(사용자 결정)**: GitHub 스캔을 끌지, 서버 02:00 이후로 일정을 옮겨 실제로 재사용되게 할지(예: 서버 스캔 시각 조정), 네이버 공식 경로 탐색.

### 사용자가 실행해야 하는 SQL (Supabase SQL Editor)
```sql
DROP POLICY IF EXISTS "public_answered_tickets" ON support_tickets;
DROP POLICY IF EXISTS "user_see_own_replies" ON support_replies;
CREATE POLICY "user_see_own_replies" ON support_replies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_tickets t
            WHERE t.id = support_replies.ticket_id AND t.user_id = (SELECT auth.uid()))
  );
```
근거: 프런트는 `support_tickets`·`support_replies`를 anon 클라이언트로 직접 읽지 않고(frontend app/lib/components grep 0건), 공개 게시판은 백엔드(service role)가 `id, category, title, status, view_count, created_at, answered_at`만 돌려준다. 확인: `select policyname from pg_policies where tablename in ('support_tickets','support_replies');`에서 `public_answered_tickets`가 사라지고 `user_see_own_replies`의 조건에 `visibility`가 없어야 한다.

### 이번 라운드의 오판·오탐·누락 점검
| 구분 | 내용 | 결과 |
|---|---|---|
| 오판 | 플로팅 버튼 병합, 9번 안내 추가 | 둘 다 근거로 철회(위) |
| 오판 | `silent`=자동 | 3곳 호출 확인 후 `auto` 신설 |
| 오탐 | 변이 검증에서 내가 틀린 곳을 지움(`replace(...,1)`이 옛 DROP을 지움) | 마지막 일치를 지워 재검증, 테스트는 정상 |
| 오탐 | 스크립트 한글 깨짐으로 치환 0건 | 파일 기반 UTF-8 실행, 쓰기 전 검증으로 파일 무변경 확인 |
| 누락 | CI의 PyYAML 의존, 환불 쿼리 실패 시 해지 500, 서버 `schema.sql`이 로컬 HEAD와 달라 `--force` 필요했던 점 | 각각 `importorskip`, try/except+테스트, 서버 git HEAD 버전과 일치 확인 후 진행 |
| 미확인 | FAQ 템플릿(`briefing_engine.py` 100~420행, 답변 54개) — 빈칸 `[ ]` 유무로 안전을 가르면 누락이 생긴다(`[전화번호]`만 비우고 "네이버 예약"은 단정). **빈칸 없는 단정이 최소 16개**(채널 단정 9개: 139·188·208·215·242·296·306·387·392행 / 서비스·혜택·비용 단정 193·225·257·323·400·410·415행 등, 일부 겹침; 400행은 일반의약품 일반 사실이라 낮은 위험). 이번엔 소식·소개글·블로그·카페·지식인만 정리 / 로그인 후 일부 페이지·PC 실측 / 자동 분석 면제 월 2회는 제안값 / 환불 쿼리는 실제 DB에서 실행해 본 적 없음 | 후속 |

### 3차 정정 (11-07 오전, 사용자의 "오판·오탐·누락 있었는지" 요청으로 재대조)
| 구분 | 내용 | 정정 |
|---|---|---|
| 오판 | FAQ 단정 예시 "휠체어 가능"(208행) | 깨진 글자를 잘못 해독한 것. 실제는 모발 시술 안내 + "전화나 카카오톡으로 공유". 193행 "10~15분 무료 컨설팅"·257행 "보강 1회 제공"은 맞음. **콘솔 깨짐(cp949)을 눈으로 해독해 예시를 적지 말고 UTF-8 파일로 다시 읽을 것** |
| 누락 | FAQ 단정 후보 수 10개 | `[ ]` 빈칸이 있으면 안전하다고 분류한 기준이 느슨했다. "네이버 예약"이 빈칸 밖에서 단정된 답변이 더 있어 최소 16개/54개 |
| 오표기 | "02:00:02 UTC에 사전 스캔 조회" | 02:00 KST = 17:00 UTC. 서버 로그: 17:00:02 UTC 조회 → 17:08:11 UTC `[naver]` Playwright 기동 |
| 분류 오류 | "서버가 사전 스캔을 재사용하지 않았다"를 '확인한 사실' 표에 넣음 | 간접 증거다: 조회 로그와 8분 뒤 브라우저 기동은 확인했지만 로그에 어느 단계인지는 안 나옴. 근거는 타이밍(GitHub 시작이 04:35 KST 이후) |
| 부정확 | 가드가 "프로세스 메모리" | 서버 디스크의 JSON 파일(위 정정). 결론(러너와 공유 안 됨)은 같음 |
| 약한 근거 | "briefing=False 4/4가 11-05부터" | KST 기준 11-06 아침 실행부터 2회 연속(11-07 아침 실행도 4/4 False). 그 전은 3/4·4/4·3/4 True. 표본이 적은 초기 신호이며 `mentioned`는 일부 True 유지 |
| 추정 | "GitHub 4개 = 서버가 제외한 관리자 3개 + 1개" | 산술은 맞으나(서버 후보 4개−관리자 3개=1개) 두 쪽 대상 필터가 같은지는 확인 못 함 |
| 검증 불가 | 환불 "이용" 판별(결과 3개 모두 NULL = 체험 가져오기 행) | 사용자 SQL 결과: 결과가 모두 빈 행은 `keyword_rank_only` 1건(2026-08-03)뿐 — 체험 가져오기 행(`…추천`)은 실제 DB에 0건이라 이 가정은 **코드로만 근거가 있고 데이터로는 검증되지 않았다** |
| 규칙의 허점 | 구독 후 사용자가 순위 측정만 실행한 경우 | `keyword_rank_only`는 사업장에 스캔 행이 하나도 없을 때만 새로 생기고(`scan.py:4003`·`jobs.py:5642`), 있으면 마지막 행의 `keyword_ranks`만 갱신한다 → 결과 컬럼이 비어 있거나 시각이 옛 행이라 이용으로 세지 않는다. 소비자에게 유리한 쪽·비용 미미라 현재 허용, **정책으로 정할 문제** |
| 미확인 | 환불 SQL 첫 쿼리(전체 건수) | 사용자가 결과를 주지 않아 판단 안 함 |

### FAQ 템플릿 정리 (11-07, 서버 반영 완료)
- 범위: `_FAQ_TEMPLATES` 전체(130~505행). 이전 감사는 420행까지만 봐서 **부동산·인테리어·자동차 15개가 점검 밖**이었고, `[ ]` 유무를 안전 기준으로 삼아 "포장·배달 모두 가능"·"무료 와이파이"·"최대 30% 할인"·"인기가 많습니다" 같은 단정이 빈칸이 하나라도 있는 답변에 숨어 있었다.
- 조치: 채널(네이버 예약·카카오톡·인스타 DM)·혜택(무료·할인)·시설·운영 약속·고객층·평판 단정 55개 답변을 `[확인한 뒤 작성하세요. 예: …]` 빈칸으로 교체(대시보드의 `[` 경고가 뜨게 됨). 같은 패턴 `_make_faq_content` 경쟁사 키워드 FAQ(고정 "전화 또는 네이버 예약")와 `action_tools.py` 소개글 Q&A 3곳("네, {키워드} 가능합니다"·"네이버 예약으로 가능합니다")도 수정.
- 일부러 남긴 것: 약국 일반의약품 안내(400행, 일반 사실), `전화([전화번호])`(번호 자리가 빈칸), 업종 일반 조언 문장.
- 검증: `tests/test_faq_template_no_unverified_service_claims.py`(중첩 대괄호를 안쪽부터 벗기는 헬퍼) — 수정 전 파일로 되돌리면 35건 실패, 복원 후 통과(변이 검증). 전체 로컬 2168 통과, 서버 2166 통과·1 스킵.
- **미확인/한계**: `action_tools.py`의 "AI 브리핑 인용 후보 가능성이 높아집니다" 같은 효과 문구는 이번 범위 밖(프런트 금지 문구 테스트는 frontend만 검사). 템플릿 문구가 실제 사장님 게시에 어떻게 쓰이는지(경고 확인 후 게시) 실사용 데이터는 없음. 빈칸이 늘어 템플릿이 덜 "바로 쓸 수 있게" 보이는 사용성 비용은 실사용자 반응으로 확인해야 함.

### GitHub 야간 스캔 중단 + 하라식당 화면 대조 (11-07)
- 조치: `NAVER_SCAN_DISABLED=true` 설정(해제 `gh variable delete NAVER_SCAN_DISABLED`). 다음 예약 실행이 `skipped`인지는 **미확인**.
- 코드 확인: `naver_scanner.py`가 차단·접속 실패·브리핑 판별 불가를 `error`로 반환하고 `prescan_usable`이 걸러낸다 → "비캡차 차단이 False로 저장된다"는 우려는 오탐이었다. 단 `github_naver_scan.py`는 사업장마다 플레이스 탭 접속(`check_smart_place_completeness`)을 추가로 하고 관리자 제외 필터가 없다(서버 가드 밖).
- DB(서버 읽기 전용): 하라식당 본점 키워드 `일본가정식·규동·초밥·가라아게동`, 11-06(금) 질의 `창원 일본가정식 추천`.
- 로컬 1페이지(비로그인, 11-07): 정상 화면·캡차 없음·AI 브리핑 블록 없음(`AI탭` 링크만). 플레이스 목록은 카쿠레가·삼대초밥 등이고 하라식당은 **첫 화면 밖**(블로그 글 3곳에만 등장). → 스캔의 `briefing=False` 는 이 질의에서 화면과 일치. 표본 1질의·1시점이라 4/4 False 전체를 설명한 것은 아니다.
- **미해결 점검 항목(수정 안 함)**: `naver_scanner._name_in_text`는 공백·특수문자 제거 후 `등록명 ⊂ 텍스트` 또는 `텍스트 ⊂ 등록명`만 본다. 등록명 "하라식당 본점"이 네이버 표시명 "하라식당"/"하라식당 창원본점"과 어긋나면 `등록명 ⊂ 텍스트`가 실패하고, 플레이스 항목 텍스트가 이름 외 내용(별점 등)을 포함하면 `텍스트 ⊂ 등록명`도 실패해 **놓칠 수 있다**(추정, 실제 항목 텍스트 형태는 미확인). 반대로 `mentioned`는 플레이스 15곳 일치 실패 시 **페이지 전체 텍스트 일치**로도 True가 되어(372행) 블로그 글 속 언급이 노출로 잡힐 수 있다 — 이번 하라식당은 이름이 달라 둘 다 해당하지 않았다. 매칭 규칙 변경은 측정 경로라 사용자 결정 전 수정하지 않는다.
- **2번 검증 결과(11-07, 로컬 PC 1페이지 + 서버 DB 읽기 전용)**: ①같은 화면에 `PLACE_SELECTORS` 10개를 그대로 적용하면 **전부 0개** — 실제 플레이스 목록은 난독화 클래스(`li.UEzoS`·이름 `.TYaxT`)에 링크가 `map.naver.com/p/search`다. ②최근 scan_results 600행 중 측정 성공 행에서 `rank`가 채워진 것은 **3건(2026-06 1·07 2, 이후 0)** → 플레이스 순위 판정은 사실상 작동하지 않는다. ③따라서 `mentioned`는 `in_briefing`이거나 **페이지 전체 텍스트에 등록명이 들어 있음**(372행 폴백)이다. 텍스트만으로 True인 행(`mentioned and not in_briefing and rank None`): 2026-11 1/8, 10월 2/33, 9월 1/86, 7월 2/64. ④`calc_naver_exposure`는 `mentioned`에 100점 중 60점(`score_engine.py:565`) — 브리핑이 아닌 블로그 글 속 이름도 점수를 받고, 등록명이 "하라식당 본점"처럼 화면 이름("하라식당")과 다르면 받지 못한다. 현재 영향 행은 소수지만 방향은 양쪽(과대·과소) 모두다.
- **한계/미확인**: 비로그인 로컬 PC 화면 1질의 기준(서버는 쿠키 로그인 상태라 DOM이 다를 수 있음 — 그러나 DB의 rank 3/350 이상이 같은 결론을 뒷받침). Aug·Sep의 in_briefing 90%대 → Oct·Nov 15~25%로 떨어진 원인은 **미확인**(표본 구성·`briefing_present` 필드 도입(10-26)·셀렉터/DOM 변화 모두 가능). 수정하려면 실제 DOM 픽스처·변이 검증·점수 의미 변경에 따른 가짜 변화 방지(`change_signal_guard`)·유명 가게 대조가 필요해 **사용자 결정 대기**.

### 플레이스 목록 판정 — C 단계 진행 기록 (A 유지: 점수는 그대로)
- 단계 1(`a65def36`): `services/ai_scanner/place_list_parser.py`(구조 기반 목록 판정·보수적 이름 일치) + 실제 DOM 픽스처 `tests/fixtures/naver_place_list_2026_11_07.html` + `test_place_list_parser.py`.
- **단계 2(11-07, 서버 반영)**: `naver_scanner._check_single_page`가 이미 열린 페이지에서 `page.evaluate` 한 번으로 목록 DOM을 읽어 **추가 필드만** 저장 — `place_list_found`(True 읽음 / False 목록 없음·못 읽음 / None 읽는 중 오류), `place_list_rank`, `place_list_names`(앞 10개). `mentioned`·`rank`·점수·`prescan_usable`에는 쓰지 않는다. 네이버 요청은 늘지 않는다(goto 1회 그대로, 테스트로 고정). 실제 페이지에서 같은 JS를 돌려 파서에 넣으면 6곳이 정확히 읽히고 순위 판정이 맞음(로컬 확인).
- 검증: `test_place_list_shadow.py` 11개(가짜 페이지로 `_check_single_page` 끝까지 실행, 변이 4종 실패 확인), 전체 로컬 2186·서버 2184(+1 스킵) 통과, 재시작·`/health` 정상.
- **데이터가 쌓이는 속도(중요)**: 섀도 필드는 서버가 네이버 검색을 실제로 돌릴 때만 생긴다. GitHub 스캔은 중단했고 02:00 KST 정기 스캔은 관리자 계정을 제외하므로 **하루 약 1개 사업장 + 사용자 수동 스캔**뿐이다. 단계 3의 비교(텍스트 폴백만으로 True였던 건·이름 불일치 건)는 표본이 모일 때까지 걸린다. **비교 표본을 만들려고 네이버 접속을 늘리지 않는다**(지침 8번). 확인 쿼리: `scan_results.naver_result` 의 `place_list_found / place_list_rank / mentioned / in_briefing`.
- **미확인**: 모바일·로그인 상태·광고 카드 구조, 난독화 클래스가 바뀔 때 구조 규칙이 유지되는지, 섀도 필드가 `naver_result` JSON 크기·다른 소비처(관리자 화면·내보내기 등)에 미치는 영향(저장 키가 늘 뿐 읽는 쪽이 모르는 키를 무시하는지는 코드 전수 확인 안 함).

### 로그인 후 남은 페이지 점검 (11-07: /settings·/review-inbox·/ad-defense·/delivery·/startup·/schema)
- **열기만 해도 도는 호출(useEffect 전수)**: 네이버 접속·Claude 호출·스캔 트리거 **없음**. 읽기 GET(사업장·키·멤버 목록)과 localStorage 복원뿐. 예외 2건은 아래 F1·F2(둘 다 사용자 동작·결제 리다이렉트 뒤에 발생).
- **F1 (P2, 코드 확인)** `review-inbox/page.tsx:68-98` 위기관리 패널은 열리면 곧바로 `crisis-reply`를 POST하고, 의존성에 `rating`이 있어 **패널 안에서 별점 버튼(1·2·3)을 누를 때마다 다시 POST**한다. 백엔드는 성공마다 월 사용량을 센다(`guide.py:1381`) — Basic은 `crisis_reply_monthly=20`(`plan_gate.py:79`), Pro 이상 무제한(분당 10회 상한). 별점을 바꿔 보는 것만으로 Basic 한도가 조용히 줄어든다. 미확인: 의도된 동작인지(별점에 맞춰 답이 달라져야 함), 실제 사용 패턴.
- **F2 (P2, 코드 확인)** `delivery/payment-confirm/page.tsx:22-65` 결제 완료 화면에서 **새로고침·뒤로가기로 이 URL을 다시 열면** 같은 확정 POST가 다시 나가고, 주문이 이미 `paid`라 백엔드가 409(`결제할 수 없는 상태입니다 (status=paid)`, `delivery.py:~735`)를 돌려 프런트가 **결제 실패 화면**을 보여 준다(돈은 정상 결제됨). 백엔드 방어(소유권·상태·금액·크렙 재승인·orderId 대조)는 견고. 실주문 0건이라 영향은 작지만 결제 직후 불안을 만드는 유형. 미확인: 크렙이 같은 `paymentId`로 재승인 호출 시 응답.
- **F3 (P3, 실측)** 사업장 선택 영역에서 긴 이름("홍뮤직스튜디오작곡교습소" 155px)이 약 112~114px에서 잘림 — PC 1280px·모바일 390px 모두(`review-inbox`·`settings` 탭). 전체 이름 확인 수단(툴팁/펼침)은 확인 못 함.
- **F4 (P3, 실측)** 모바일 터치 목표가 작은 요소: settings 키워드 삭제 `×` 16×16(5개), "플랜 변경 · 업그레이드" 링크 높이 20, review-inbox "리뷰 붙여넣고 첫 답변 만들기 →" 높이 20, schema 삭제 버튼 42×20·체크박스 13×13, delivery "1:1 문의" 높이 20.
- **측정 결과(양호)**: 6개 페이지 PC·모바일 모두 가로 넘침 0, 12px 미만 글자 0.
- **기각(오탐)**: 설정의 "다음 결제일 10월 29일(과거)"는 관리자 이메일이면 플랜을 Biz·활성으로 강제(`settings/page.tsx:122`)하고 날짜는 계정 본인의 취소된 Basic 행에서 읽는 **관리자 전용 표시**. `subscriptions.user_id`가 UNIQUE라 실제 사용자는 한 행뿐 — 영향 없음. 서버 구독 행 6건뿐(유료 실구독 0, 활성 3건은 만료 2036·2027의 테스트·관리 계정).
- **미확인**: 로그인 후 화면을 실제 결과가 있는 사업장으로 끝까지 눌러 대조한 것(이번엔 구조·측정 위주, 실행 버튼은 누르지 않음), /delivery/new·/orders 상세·/settings/team·/api-keys의 시각 점검.

### F1·F2 수정 (11-07, 서버 반영 완료)
- **F2** `delivery/payment-confirm/page.tsx`: 확정 POST가 409일 때만 `GET /api/delivery/orders/{id}`로 실제 주문 상태를 읽어 `paid·in_progress·completed`이면 "이미 결제가 확인된 의뢰입니다. 중복 결제되지 않았습니다."로 안내(그 외 409·다른 오류는 기존대로 실패 화면, 상태 조회가 실패해도 실패 화면). 서버 방어(409)는 그대로라 중복 확정은 여전히 불가.
- **F1(추천안)** `review-inbox/page.tsx` `CrisisGuidePanel`: 열 때 자동 생성 제거 → 별점 선택 → "N점 기준으로 가이드 만들기" 버튼(누른 때만 호출, 이용 횟수 1회 사용 안내, 버튼 44px). 별점을 바꾸면 기존 결과 위에 "N점 기준입니다" 안내와 "다시 만들기"가 뜨고 자동 재호출 없음. 원래 문제의 두 번째 결함도 해소: 기본 1점으로 먼저 생성돼 첫 결과가 틀린 별점 기준이었다.
- 검증: 타입 검사 0 오류(`node node_modules/typescript/lib/tsc.js --noEmit`), `test_frontend_crisis_manual_and_payment_reload.py` 5개(변이 4종 실패 확인), 로컬 2191·서버 2189(+1 스킵) 통과, 프런트 md5 일치·빌드·pm2 재시작·빌드 산출물에 새 문구 확인.
- **라이브 확인(F1)**: 테스트 계정으로 리뷰 답변 1건 생성 → 패널 열기: `crisis-reply` 호출 0건 → 별점 3점 클릭: 0건 → 만들기 클릭: 정확히 1건(200) → 별점 1점 클릭: 추가 호출 없음 + 안내·"다시 만들기" 표시, 모바일 390px 넘침 없음. 이때 생긴 `review_replies` 1행·`guides`(crisis_reply) 1행은 id·시각·문구를 대조한 뒤 그 2건만 삭제(잔존 0 확인). Haiku 호출 2회 소모.
- **F2 라이브는 미확인**: 결제된 대행 주문이 없어(실주문 0건) 새로고침 시나리오를 실제로 재현하지 못했고, 구조 테스트·코드 대조로만 검증. 크렙이 같은 `paymentId`로 재승인할 때의 응답도 미확인(서버는 상태 검사로 PG 호출 전에 409를 반환).
- 남음: F3(긴 사업장명 잘림), F4(작은 터치 영역).

## 기각(오탐·과장) — 사유
- **save-email P0**: 속도 제한이 없는 것은 맞지만 메일은 체험당 1회(`scan.py` first_email)이고 체험 생성이 IP당 일 3회 → P2.
- **report.py IP 제한이 Cloudflare 뒤에서 무력화**: nginx `cloudflare-realip.conf`로 실제 IP가 복원됨.
- **blog_analyzer.py:59가 website_checker와 같은 패턴**: 더 엄격한 자체 검사(메타데이터·CGNAT·포트 80/443). 단 리다이렉트·DNS 해석 약점은 실제로 있어 같이 고침.
- **npm audit critical/high**: 전부 `shadcn` CLI(→express·MCP·hono·zod)를 통해 들어오며 코드가 import하지 않음(`globals.css`의 CSS import뿐). `npm audit fix --force`는 `shadcn@1.0.0`으로 바꿔 CSS import를 깨뜨릴 수 있어 금지. 운영에서 실행되는 경로는 `sharp`(Next)뿐이며 HEIF 업로드 경로는 미확인.
- **블로그 RSS 실패가 글 수 0으로 저장**: 호출자가 `rss_failed`로 구분해 '측정 못 함' 처리.
- **약관 청약철회 문구와 환불 코드 불일치**: 환불 코드(`settings._check_refund_eligibility`)는 7일 이내 + 스캔·가이드 미이용으로 약관과 일치.
- **benchmark 엔드포인트에 IP 속도 제한**: 대시보드·성장 페이지가 서버 측에서 호출해 모든 요청이 같은 IP로 보임 → IP 제한이 정상 사용자를 막을 수 있어 적용하지 않음.
- **랜딩 차트 라벨 7~8px(중)**: viewBox 단위값이었고 PC 렌더 10.5~12px, 모바일(390)에서는 렌더되지 않음(PC 전용 레이아웃). 장식 라벨이라 '하'.
- **푸터 링크 24px(중)**: `min-h-[24px]`는 WCAG 2.2 AA(2.5.8) 최소 기준에 부합하는 의도된 값. 44px는 AAA·모바일 가이드 권장치. 미변경.

## 결정이 필요하거나 미확인
- **체험·Quick 점수의 Gemini 미실행 처리**: `calc_multi_ai_exposure`는 `gemini={}`이면 0점으로 계산해 그 항목이 절반이 됨(예: ChatGPT 10/50 → 10, 제외 재정규화면 20). 그런데 `test_keyword_rank_regression.py:300`이 이 동작을 '기존 동작 유지'로 명시 고정. 고치면 Quick 스캔 점수 이력의 기준이 배포 전후로 달라져 가짜 변화 신호가 생길 수 있어 **점수 모델 결정 사항**으로 남김(영향: restaurant 기준 최대 수 점, 점수 숫자는 사용자에게 비노출).
- **환불 자격이 사실상 거의 없을 가능성**: 환불 조건이 '스캔 이력 없음'인데 가입 직후 첫 측정이 자동 실행되면 7일 이내에도 환불 불가. 약관 문구와 코드는 일치하나 청약철회 제한 범위의 적법성은 변호사 확인 사항(신규 구독자의 첫 스캔 시점은 미확인).
- **개인정보처리방침에 네이버 접속(스크래핑) 고지 없음**(확인됨, '네이버' 언급 0건) — 고지 필요 여부는 변호사 확인.
- **`trial_scans` RLS의 이메일 anon 조회 여부 — 사용자 SQL 실행으로 확인(2026-11-06 저녁)**: `trial_scans`는 RLS 켜짐 + 정책 0개 → anon·로그인 사용자 모두 행 접근 불가(서버 service role만). `businesses`·`profiles`·`scan_results`·`subscriptions`·`trial_scans` 5개 모두 `rls_on=true`, `public` 스키마에서 RLS 꺼진 일반 테이블 0개. anon의 테이블 권한(INSERT/SELECT/UPDATE/DELETE/TRUNCATE 등)은 Supabase 기본 부여이며 RLS가 막는다(TRUNCATE는 REST API로 호출 불가라는 일반 구조 판단 — 이 프로젝트에서 실측하지는 않음). **미확인 잔여: ①`trial_scans` 외 테이블의 정책 내용(09-22 사고는 RLS 켜짐인데 정책이 `qual=true`였음) ②뷰(`weekly_scores` 등)가 RLS를 우회하는지(`security_invoker`·anon 권한).** 확인용 SQL은 `pg_policies`에서 `qual='true'` 또는 roles에 anon/public, `pg_views`+`reloptions`+`role_table_grants`.
- 점검하지 못한 것: 구독 갱신 실패→유예→정지 잡·알림톡 변수 대조·AI 비용 상한·백업·Sentry의 라이브 동작은 점검하지 못함.
- UI: 로그인 후 화면(대시보드·성장·가이드) 실측, 색 대비 수치, 360px 체험 화면, 일부 공개 라우트, 이번 UI 수정 중 체험 결과 화면의 실제 렌더(체험 재실행 시 네이버 접속이 발생해 하지 않음).
- 죽은 코드(`OneLineConclusion`·`CompetitorGapHighlightCard`·`TrialStatusSummary`)는 점수 숫자를 출력하지만 렌더되지 않아 사용자 영향 없음. 삭제는 프론트 재빌드 대비 이득이 작아 보류.

## 교훈
- 에이전트 보고의 P0/P1은 이번에도 오판·과장이 섞였다(P0 1건→P2, IP 제한·npm·RSS·약관 불일치 기각). 단정 근거 + 반증 시도를 메인 세션이 직접 확인한 뒤에만 채택.
- 속성값(SVG `font-size`)과 렌더 값은 다르다 — `getBoundingClientRect`·viewBox 배율로 실측.
- 테스트가 현재 동작을 '기존 동작 유지'로 고정해 둔 곳은 단순 버그로 고치지 말고 의도를 먼저 확인.
