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
