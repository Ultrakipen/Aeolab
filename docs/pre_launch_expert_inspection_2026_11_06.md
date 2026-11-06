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
1. **GitHub 야간 스캔(`naver_scan.yml`)이 서버 안전장치 밖이다.** 서버의 쿼터·회로는 프로세스 메모리, 킬스위치는 서버 파일이라 서버 밖(GitHub 서버)에서 도는 이 잡에는 적용되지 않는다. 스크립트는 요금제별 스캔 일정을 보지 않고 **모든 활성 사업장을 매일 밤** 네이버 검색 + 플레이스 페이지까지 스캔한다(서버 정기 스캔은 `NAVER_SCAN_SLOT_SPREAD`로 요일을 나눔). 코드 주석에도 "iwinv IP 차단 우회"라고 적혀 있어 IP 분산 성격이며, 우리 문서상 법적 민감 항목이다.
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
| 미확인 | FAQ 템플릿(`briefing_engine.py` 138~393행)에도 "네이버 예약", "당일 방문 가능" 같은 단정이 있을 수 있음(이번엔 소식·소개글·블로그·카페·지식인만 정리) / 6개 로그인 후 페이지·PC 일부 실측 / 자동 분석 면제 상한 2회는 제안값 / 환불 쿼리를 실제 DB에서 실행해 본 적 없음(PostgREST 요청 렌더로만 검증) | 후속 |

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
