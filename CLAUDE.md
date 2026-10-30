# AEOlab — 개발 참고 문서

> AI Engine Optimization Lab: 한국 소상공인을 위한 AI 검색 사업장 성장 플랫폼
> 기획서 v7.2 / 개발문서 v1.3 / 모델엔진 v3.0 구현 완료 | 1인 개발 | iwinv 서버 운영 중

> 과거 완료 내역은 `docs/changelog_archive.md` 참조. 이 문서는 현재 상태·코드 패턴·최근 업데이트만 포함.
> **최우선 지침 3가지 — '작업 중요 지침' 8~10번: ① 네이버 차단 대응 ② 사용자 신뢰도(인기 가게 저평가·미끼 상품 인상 방지) ③ 오판·오탐·누락 재차 검증(변이 검증·실제 응답 픽스처·미확인 명시). 네이버 접속·점수·알림·결과 화면을 건드리는 모든 작업의 마감 절차다.**

---

## 에이전트 자동 라우팅 규칙

> **IMPORTANT:** 사용자의 요청을 분류하여 **자동으로 해당 에이전트를 사용**한다. 에이전트 선택을 사용자에게 묻지 말 것.

### 에이전트 목록 (`.claude/agents/`)

| 에이전트 | 파일 | 자동 발동 키워드 / 조건 |
|---------|------|----------------------|
| **deploy** | `deploy.md` | 배포, 서버 반영, scp, pm2, 업로드, 서버에 올려, 재시작, 빌드 |
| **backend-dev** | `backend-dev.md` | FastAPI, 라우터, 서비스, 백엔드, API 엔드포인트, Pydantic, 스케줄러, .py 파일 수정 |
| **frontend-dev** | `frontend-dev.md` | Next.js, 컴포넌트, 페이지, 프론트엔드, UI, tsx, CSS, 반응형, 모바일 화면 |
| **db-migrate** | `db-migrate.md` | 테이블, 컬럼 추가, 마이그레이션, Supabase SQL, 인덱스, schema.sql |
| **scan-engine** | `scan-engine.md` | 스캔 엔진, 점수, 스코어, 듀얼트랙, keyword_gap, GrowthStage, AI 스캐너, briefing_engine |
| **code-review** | `code-review.md` | 코드 검토, 리뷰, 점검, 버그 확인, 보안 검토, 배포 전 확인 |
| **next-feature** | `next-feature.md` | 새 기능, 다음 구현, 기획, 설계, 구현 범위, 어떻게 만들지 |

### 자동 라우팅 원칙

1. **단일 영역 요청** → 해당 에이전트 1개 즉시 사용
2. **복합 영역 요청** → 에이전트 병렬 실행 (독립 작업이면 동시에)
3. **새 기능 시작** → 반드시 `next-feature` 에이전트 먼저 (범위·DB 변경·비용 분석)
4. **구현 완료 후** → `code-review` 자동 점검 후 `deploy`
5. **모호한 요청** → 가장 관련성 높은 에이전트 1개 선택하여 즉시 시작. 묻지 말 것.

### 에이전트 보고 검증 의무 (2026-05-01 신설)

> 2026-05-01 두 사이클 연속으로 **에이전트의 "수정·배포 완료" 보고가 사실과 달랐던** 사고 발생. 신뢰 기반이 아닌 검증 기반으로 전환.

- **모든 에이전트 위임 작업 완료 후, 메인 세션이 직접 검증한다.** 검증 없이 다음 단계 진행 금지.
- **백엔드 수정 검증** — `Bash`로 `grep -n "<핵심 패턴>" <파일경로>` 또는 `Read`로 변경 라인 직접 확인. 최소 1개 핵심 변경 라인을 메인 세션이 본 적이 있어야 다음 단계로 진행.
- **배포 검증** — `ssh root@115.68.231.57 "grep -n <패턴> /var/www/aeolab/<경로>"`로 **서버측 파일에 변경이 실제 반영됐는지 1줄 이상 확인**. PM2 재시작 후 `error.log` `--lines 60 --nostream` 0건 확인.
- **잠재 root flat 잔재 점검** — 서버에 같은 이름의 파일이 여러 위치에 존재할 수 있음(`backend/<file>.py` vs `backend/routers/<file>.py` 등). `main.py`의 `from routers import ...` `from scheduler import ...` import 경로가 정답이며, 그 경로의 파일이 실제로 수정됐는지 우선 확인.
- **거짓 보고 발견 시** — 즉시 메인 세션에서 직접 수정. 에이전트 재위임 금지. 향후 동일 패턴 작업도 직접 처리 우선.

### 문제 분류 검증 의무 (2026-05-18 신설)

> 2026-05-18 P0/P1 분류에서 옛 주석·부분 grep 결과만으로 단정한 **오판 3건** 발생 (라우터 차단 의심·taxonomy 누락 의심·PlanGate 영문 키 누락 의심). 모두 반증 시도로 막을 수 있었음.

- **"P0/P1 문제다"라고 보고하기 직전**, 메인 세션이 **단정 근거 라인 + 반증 시도 라인** 각 1개 이상을 직접 본 적이 있어야 함
- **반증 시도** — 호출처 grep / 실제 반환값 Read / 옛 주석 vs 실제 코드 일치 / 전체 grep 카운트 — 중 최소 1개
- **보고 형식** — "P1 — [근거 file:line, 반증 file:line] 문제 확인"
- **적용 대상** — 메인 세션 자체 분석 + 에이전트 보고 양쪽 모두. 단정 근거만으로 P0/P1 분류 금지.
- **외부 사실 주장 검증(2026-07-01 확장)** — 내부 문서끼리 상호 인용(예: "홈페이지에도, CLAUDE.md에도 그렇게 적혀있음")은 순환참조일 뿐 반증이 아님. 네이버·ChatGPT 등 외부 사양·발표는 `WebSearch`로 원문 매체명·날짜까지 확인해야 진짜 검증. 검증된 사실(예: 날짜)과 AEOlab의 해석(예: "업종 제한 없음")을 한 문장에 섞지 말 것 — 해석까지 공식인 것처럼 읽힘.

### 개선 과제·누락(gap) 제안 검증 의무 (2026-06-17 신설)

> 2026-06-17 "구멍 4개"를 단정 보고했으나 반증해보니 2개가 오판(①테스트 데이터 전제는 상속 문서에 이미 존재 ④점검 진행 대장은 메모리 시스템이 이미 수행 중). 오판/누락 판단은 짝 규칙 — **오판 방지는 위 "문제 분류 검증 의무"(있는 문제를 없다/작다고 잘못 판단하지 않기), 누락 방지는 이 절(없는 문제를 있다고 잘못 판단하지 않기)**. 둘 다 "단정 후 반증"이 아니라 **"반증 후 단정"** 순서.

- **"이건 구멍/누락이다"라고 제안하기 직전**, 항목마다 다음을 거쳐 반증부터 시도:
  1. **상속/참조 문서 확인** — 이 작업이 참조하는 상위 문서를 `grep`으로 먼저 검색, 이미 다뤄졌는지 확인
  2. **메모리 시스템 확인** — `MEMORY.md`에 이미 같은 역할의 메모리·관행이 있는지 확인
  3. **코드 단일 소스 확인** — 수치·정책·분기는 실제 코드(`score_engine.py`·`prices.py`·`userGroup.ts` 등)로 대조
  4. **반증 견딘 것만 제안** — 각 항목에 "근거 1줄 + 반증 시도 1줄" 명시. 반증에 무너지면 오판으로 기록하고 제외
  5. **❌ 매핑 필수** — 살아남은 제안도 구체적으로 놓치는 문제(실패 시나리오)에 매핑. 취향·일반론 항목은 배제

### 에이전트 수정 권장 → 구현 전 필수 절차 (2026-06-02 신설)

> 2026-06-02 에이전트가 권장한 `check_mention()` 세마포어 추가를 호출 그래프 확인 없이 적용 → `_run_playwright()` 중첩 획득으로 asyncio 데드락 발생. 에이전트는 **"발견"만**, 수정 방향 결정은 메인 세션이 코드를 직접 보고 판단.

**P0/P1 수정 구현 전 필수 3단계 (건너뛰기 금지):**

1. **모든 호출처 확인** — `grep -rn "<대상 함수명>" backend/` 로 호출 그래프 전체 추적. 세마포어·락·비동기 패턴 수정은 중첩 획득 여부 반드시 체크.
2. **반증 케이스 먼저** — "이 수정이 틀렸다면 어떤 경로에서?" 시나리오 1개 이상 직접 확인 후 구현.
3. **에이전트 권장 조치는 방향만** — 구체 구현 방법은 메인 세션이 코드를 직접 보고 결정. 에이전트 권장을 코드 확인 없이 그대로 적용 금지.

**CLAUDE.md·문서 신뢰도 원칙:**
- CLAUDE.md는 스냅샷 — 수치·패턴 기재 내용은 항상 실제 코드로 검증 우선
- 문서에 수치/패턴 기재 시 `file:line` 명시 권장 (예: `PLAYWRIGHT_SEMAPHORE`: `multi_scanner.py:40`)
- 에이전트 보고·문서 기반 판단 전 실제 코드 경로를 직접 추적

---

### 작업 진행 시 공통 필수 — 오판·오탐·누락 재확인 (2026-10-27 신설)

> 모든 작업(수정·점검·보고·문서화)은 **완료 선언 직전에 아래 3종을 재확인**한다. 위 검증 의무 3개 절(문제 분류·개선 과제·에이전트 보고)의 공통 마감 절차.

- **오판 재확인** — 있는 문제를 없다/작다고, 또는 없는 문제를 있다고 단정하지 않았는가? 단정 근거 `file:line` + 반증 시도 `file:line` 각 1개 이상. 옛 주석·CLAUDE.md 수치는 실제 코드로 대조.
- **오탐 재확인** — 정상 동작을 버그/위반으로 잡지 않았는가? 호출처 grep·실제 반환값·라이브 재현으로 확인(grep만으론 UI 기능 검증 불충분). 에이전트 보고의 오탐은 기각하고 기각 사유를 기록.
- **누락 재확인** — 같은 패턴의 다른 파일·PC/모바일 양쪽·백엔드↔프론트 쌍(`score_engine.py`↔`userGroup.ts` 등)·서버 반영(md5/grep/빌드/pm2)·git 커밋·문서 갱신을 빠뜨리지 않았는가? "완료했는지" 재질문 시 진짜 누락이 나온 전례 있음.
- **보고 형식** — 최종 보고 끝에 "오판/오탐/누락 재확인: 확인 항목 · 결과(없음 또는 정정 내역)" 1~3줄을 반드시 포함.

## 토큰 효율 작업 지침 (Claude Max 5x) — 요약 (전문은 `docs/token_efficiency_guide.md`)

- 디폴트 모델은 Sonnet. Opus는 계획·설계·어려운 디버깅만, 단순 검색·명칭 변경은 Haiku. 계획(Opus)+구현(Sonnet) 분리가 가장 큰 절감.
- 작업 단위마다 `/clear`, 새 기능은 새 세션. 긴 대화는 `/compact`.
- 광범위 검색·탐색은 서브에이전트에 위임(자체 컨텍스트 사용), 독립 도구 호출은 한 메시지에 병렬로.
- CLAUDE.md는 매 요청마다 전체 로드되므로 700줄 이내 유지 — 넘으면 오래된 "최근 업데이트"·완료 문서 행을 아카이브로 이관.

## 작업 참고 문서 (`C:/app_build/aeolab/docs/`)

> 전체 원본 표(행별 상세 설명 + 이어가기 트리거 15건)는 `docs/claude_md_reference_docs_archive_2026_10_27.md`. 아래는 주제별 그룹 색인 — 파일명만 보고 필요한 문서를 골라 열 것. **이어가기 트리거 형식**: `docs/<파일> 기준으로 <§N> 이어서 진행`.

| 그룹 | 문서 (`docs/`) | 용도 |
|------|---------------|------|
| **① 필수 선독 표준** ⭐ | `naver_gpt_work_standard_v1.0.md` · `ai_exposure_standard_and_naver_seo_v1.0.md` · `naver_briefing_infotype_caveat_standard_v1.0.md` · `model_engine_v3.0.md` · `plan_limits_v1.0.md` | 네이버·GPT 기능 작업 전: 업종분류·점수 가중치·5채널 판정·플레이스형/정보형 구분·요금제 한도 |
| **② 네이버 차단·접속 보호·법적** ⭐ | `naver_scraping_legal_risk_assessment_v1.0.md`(회색지대, 코드 임의 축소 금지) · `naver_scraping_legal_risk_resolution_plan_v1.0.md` · `naver_briefing_block_countermeasure_handoff_v1.0.md`(NID_SES 월 1회 교체) · `naver_place_access_protection_2026_10_27.md` · `naver_request_load_spreading_design_v1.0.md` · `next_session_handoff_trust_block_scale_v1.0.md` · `popular_shop_trust_improvement_handoff_v1.0.md` · `scale_roadmap_1000_businesses_2026_10_28.md`(1,000곳 확장 로드맵·유료 서비스 평가) · `next_session_handoff_naver_independence_2026_10_28.md`(차단·인기 가게·네이버 독립·적법성·별점 입력 완료/미완 현황, 새 대화창 트리거) · `next_session_handoff_master_2026_10_29.md`(⭐ 최신 마스터 — 인기 가게 저평가·차단·사용자 증가·독립·결제 전체 정리, 새 대화창 트리거) · `session_handoff_2026_10_29_naver_block_scale_work_v1.0.md`(⭐ 10-29 대화 작업 기록 — 변경 커밋·실측 사용량·600건 상한은 제안값·순위 장애 54일·Supabase 진단·미확인·내일 검증, 네이버 독립 서비스 개발 인수용) | 차단 대응·속도 기준·공유 캐시·인기 가게 신뢰도·300~500명 대응(과제 01/02/02-1/03) |
| **③ 점검 마스터·방법론** ⭐ | `commercial_launch_inspection_status_v1.0.md` · `master_inspection_plan_v1.0.md` · `inspection_request_full.md`(1줄 트리거 §3.X) · `external_benchmark_commercial_quality_v1.0.md` · `inspection_fixes_runbook_v1.0.md` · `naver_ai_prelaunch_inspection_v1.0.md` · `scan_result_screens_inspection_v1.0.md` | 4-레이어(사실·기능·외부벤치마크·실측) 점검 절차, 점검 이력·잔여과제 |
| **④ 페이지별 점검·개선** | `nine_pages_measurement_inspection_v1.0.md` · `eight_pages_commercial_professionalism_recheck_v1.0.md`(§13 잔여) · `dashboard_external_benchmark_inspection_plan_v1.0.md` · `guide_sibling_pages_inspection_v1.0.md`(`/guide/channels/[category]`) · `blog_analysis_improvement_v2.0.md`(종결) · `blog_diagnosis_session_2026_07_18_handoff_v1.0.md` | 9/8개 페이지 실측·대시보드·가이드·블로그 진단 |
| **⑤ 대시보드·체험 성능/UX** | `dashboard_top_redesign_handoff_v1.0.md` · `dashboard_load_delay_investigation_v1.0.md`(§6 Suspense/유료플랜 미착수) · `dashboard_load_test_and_capacity_v1.0.md`(안전선 약 30명, 병목=Supabase) · `trial_experience_persuasiveness_and_growth_v1.0.md` · `trial_improvement_2026_09_28_v1.0.md` | 로딩 지연·부하·무료 체험 설득력·저장 P0 |
| **⑥ 결제·구독·사업성·법적·인프라** | `subscription_lifecycle_inspection_v1.0.md`(종결) · `business_viability_audit_v1.0.md` · `legal_compliance_and_infra_resilience_audit_v1.0.md` · `chargeback_response_checklist_v1.0.md` · `launch_checklist_2026_10_25_v1.0.md` · `prelaunch_inspection_2026_10_25_v1.0.md` | 마진·PG수수료·AI 비용 텔레메트리·차지백·출시 체크리스트·백업 |
| **⑦ 관리자·대행서비스·기획** | `admin_panel_complete_documentation_v1.0.md` · `agency_service_and_iboss_improvements_v1.0.md` · `next_features_v1.0.md` · `remaining_tasks_v1.0.md` · `service_unification_v1.0.md` · `session_2026_07_11_next_steps_handoff_v1.0.md` · `session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md` | 관리자 기능·대행 3종·다음 기능·잔여 런북 |
| **⑧ 아카이브** | `changelog_archive.md` · `claude_md_completed_refs_archive.md` · `phase_a_completion_report.md` · `claude_md_reference_docs_archive_2026_10_27.md` | 완료 내역·종결 문서 (재점검 불필요) |


## 작업 중요 지침
1. PC화면과 모바일 화면이 별개의 페이지로 구현되어야 함 (PC/모바일에 알맞은 화면 구성)
2. 각 화면 항목·텍스트 크기·가독성 최적화. 작게 나타나지 않도록 유의
3. 같은 실수(코드 오류, CSS 깨짐 등) 반복하지 않도록 작업 사항 기록
4. 구현마다 프론트엔드와 백엔드 상호작용 오류 검증·테스트
5. **실제 서버 우선**: 서버에서 작업 → 로컬에 복사. 테스트 URL은 `https://aeolab.co.kr` (로컬호스트 아님)
6. 문서를 생성하면 로컬 폴더(`C:/app_build/aeolab/docs/`)에 저장
7. **사용자에게 실측·사실적 정보만 제공** (홈페이지 개발 완성 후 서버 사양 1단계 업그레이드 예정 — 데이터 수집 한계로 인한 임시 추정값 허용 범위 더욱 줄어듦):
   - **금지**: 임의 더미 수치, 계산 근거 없는 추정 점수, "예시 데이터" 표시
   - **허용**: 실측 데이터(스캔 결과·키워드 순위·AI 인용·블로그 발견 수 등) + 데이터 부족 시 명시적 추정 배지(`(추정)` 회색 라벨 + 근거 1줄)
   - **모든 변동 데이터**(키워드 순위·AI 인용·점수)에 면책 문구 일관 적용: "측정 시점·기기·로그인 상태에 따라 달라질 수 있음"
   - **신규 기능 출시 전**: 실제 사용자 1명 이상의 데이터로 검증한 화면만 노출. 빈 상태에서는 "아직 데이터 없음 — 첫 스캔 후 표시" 안내
   - **사용자 입력 데이터**(키워드·스마트플레이스·소개글 등)는 즉시 사업장 정보·점수·매뉴얼·트라이얼·보고서 모든 곳에 반영
   - **에러 폴백 시 허위 수치 금지**: API 실패 시 0/N/A로 표시, 무작위 숫자 절대 금지 (과거 히어로 섹션 사고 재발 방지)
   - **AI 생성 콘텐츠(소개글·FAQ 등)의 사실 지어내기 금지 (2026-07-08 사고)**: 사장님이 그대로 외부(스마트플레이스 등)에 게시하는 AI 생성 텍스트는 가격·영업시간·수용인원·시설(단체석·프라이빗룸 등)·운영기간·수상 등을 실제 입력 데이터 없이 "구체 수치 N개 이상 포함" 식으로 강제 지시하면 안 됨 — 확인 안 된 항목은 반드시 생략하거나 "스마트플레이스에서 확인하세요" 안내로 대체. D.I.A. 등 콘텐츠 품질 지표를 높이려고 이 원칙을 어기지 말 것 (`guide_generator.py` intro 프롬프트 사고, git `fd946a9`~`501b37e`)

8. **[최우선 지침] 네이버 차단 대응 (2026-10-28 지정)** — 스캔·순위·플레이스·브리핑 등 핵심 기능이 모두 네이버 접속에 의존하므로 차단되면 서비스 전체가 멈춘다. 네이버에 접속하는 코드를 새로 만들거나 고칠 때:
   - **접속 지점마다 회로·쿼터·속도를 "함수 단위"로 확인**(`begin_place_access`/`begin_search_access`, `reserve_place_pages`, `check_naver_playwright_quota`). 파일 단위로 세면 같은 파일의 다른 함수 구멍이 가려진다(2026-10-28 구멍 4곳 발견, `tests/test_place_path_coverage.py` 구조 감사).
   - **정기 잡은 `@naver_batch_job`(배치 몫)** + 사업장 순서는 오래된 순 회전 + 막히면 중단·건너뜀 기록. **새 접속량은 `scripts/naver_load_model.py`에 반영**(별점 잡이 모델에서 빠진 채 최대 소비처(주간 접속의 47%)였던 사고).
   - **서버에서 네이버 점검 함수를 연속 호출하지 말 것**(2026-10-27 서버 IP 차단). 화면 구조 확인은 로컬 Playwright 1페이지, 서버는 공식 API·DB 읽기 전용만.
   - **차단 화면·접속 실패를 "미노출·0점·낮은 별점 없음"으로 저장·알리지 말 것**(error ≠ false). 조회 함수는 "확인했는지"를 함께 반환(`check_low_rating_reviews_for`).
   - **사용자 알림은 최소 빈도로**(빈번한 알림은 신뢰를 깎는다 — 별점 알림을 6시간→주 2회로 변경한 이유). 프록시·기능 축소 등 법적 민감 항목은 사용자 결정 없이 실행 금지.
   - 참고: `docs/naver_place_access_protection_2026_10_27.md`, `docs/low_rating_alert_job_2026_10_28.md`, `docs/naver_block_scale_decision_brief_2026_10_27.md`.
   - **구글 접속(2026-10-30)**: 서버에서 `google.com`에 Playwright로 직접 접속하지 않는다(구글 데이터는 Serper·공식 API 경유, `GOOGLE_SCANNER_BACKEND` 미설정이면 측정 불가로 처리). Places API 응답은 `place_id` 외 저장·캐시 금지이고 표시할 때 공식 Google Maps 로고를 쓴다. Gemini 검색 접지 결과는 저장·분석 금지(약관 문의는 하지 않기로 결정 → 접지 기반 기능 제외). 상세 `docs/naver_independence_design_v2.0_final_2026_10_29.md` §8.
9. **[최우선 지침] 사용자 신뢰도 — 인기 가게도 저평가·"미끼 상품"으로 보이지 않게 (2026-10-28 지정)**:
   - **측정 못 한 것은 0점이 아니라 "확인 전"/제외 후 재정규화.** 사용자 입력은 측정값과 분리 표시("입력하신 값"). 측정으로 확인된 강점을 경고와 함께 첫 화면에. 측정 한계(상위 5곳 등)를 결과처럼 말하지 않기. "인기와 무관" 같은 단정 금지(리뷰·블로그·순위는 인기와 상관).
   - **화면·점수·알림을 고친 뒤 유명 가게(어니언 성수·하라식당 등)로 실제 결과 화면을 끝까지 눌러 대조**(grep만으론 불충분). 저장된 과거 값 vs 현재 코드 재계산도 비교(저장값은 옛 코드 결과일 수 있고 소급되지 않는다).
   - **알림톡은 승인 템플릿의 발송 조건·변수와 코드가 일치하는지 대조**(GROWTH_01이 하락에도 "업그레이드 안내"를 보내던 사고), 발송 실패를 성공으로 기록하지 말 것.
   - 참고: `docs/popular_shop_trust_improvement_handoff_v1.0.md`, `docs/popular_shop_trust_cases_2026_10_28.md`.
10. **오판·오탐·누락 재차 검증 — 8·9번 작업의 필수 마감 절차**:
   - **오판**: 단정 전에 반증부터. 가설을 세웠으면 실데이터로 반박을 시도(블로그 지역규칙 과소집계 가설은 실측으로 기각).
   - **오탐**: 정상 동작을 결함으로 잡지 않기 — 호출 그래프·실제 반환값·라이브 재현으로 확인(반대로 구글 지도 "미등록" 오탐은 실제 외부 응답을 찍어서 발견).
   - **누락**: 같은 패턴의 다른 함수·PC/모바일·백엔드↔프론트 쌍·서버 반영(md5·빌드·pm2)·git·문서를 재확인. "완료했는지" 재질문이 오면 다시 대조.
   - **테스트는 변이 검증**(수정을 빼면 실패하는지), **픽스처는 실제 외부 응답으로**(지어낸 형식이 결함을 가림 — 별점 파서), 실행 순서를 바꿔도 통과하는지 확인.
   - 최종 보고 끝에 "오판/오탐/누락 재확인" 1~3줄, **확인하지 못한 것은 "미확인"으로 명시**(추정을 사실처럼 쓰지 않기).

---

## 네이버 AI 브리핑 + 사양 변경 대응 지침 (2026-05-01 신설)

> 네이버는 AI 브리핑 노출 조건·스마트플레이스·톡톡 사양을 자주 변경한다. 다음 원칙으로 일관 대응한다. AI/LLM 일반 지식 신뢰 금지 — 사용자 실측·공식 공지 우선.

### 참고 문서 (작업 시작 전 반드시 확인)

| 문서 | 내용 |
|------|------|
| `docs/naver_ai_briefing_compliance_v1.0.md` | 네이버 공식 PDF 기반 AI 브리핑 노출 조건·프랜차이즈 제외·5가지 유형 컴플라이언스 |
| `docs/ai_briefing_redesign_v2.0.md` | AI 브리핑 노출 기준 v2.0 최신 설계 (이전 버전 v1.0/v1.1는 히스토리) |
| `docs/ai_briefing_implementation_plan_v2.0.md` | v4.1 구현 계획 — 게이팅·프랜차이즈·5단계 가이드·DB 컬럼 |
| `docs/ai_briefing_audit_plan_v1.0.md` | AI 브리핑 노출 점검·검증 절차 |
| `docs/naver_talktalk_redesign_v1.0.md` | 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기 영향 범위·진행 로그 |
| `docs/session_summary_20260430_naver_briefing_v4.1.md` | 2026-04-30 v4.1 세션 작업 요약 |

> **작업 규칙**: 본 지침과 참고 문서 간 충돌 시 **참고 문서가 우선**(항상 최신 실측 반영). 충돌 발견 시 본 지침을 즉시 갱신할 것.

### 1. AI 브리핑 노출 게이팅 (단일 진실)

> **⚠️ 플레이스형 vs 정보형 구분 (2026-06-29 실측 신설)**: 네이버 AI 브리핑 5유형 중 ACTIVE/LIKELY/INACTIVE 분류는 **"플레이스형(가게 플레이스 카드 요약형)" 한정**이다. **"정보형/공식형 멀티출처(추천형)"는 업종 제한이 없어 블로그·콘텐츠가 출처로 채택되면 전 업종이 노출**된다(2026-06-29 "창원 웨딩 스냅 촬영 추천" → 사진/웨딩스냅 노출 실측). 따라서 INACTIVE 업종을 "네이버 AI 브리핑 전면 불가"로 안내 금지 — `userGroup.ts GROUP_MESSAGES`가 "플레이스형 미대상이나 정보형은 콘텐츠로 노출 가능"으로 정정됨(git `aeb5c2b`). 처방 차이: 플레이스형=스마트플레이스 완성도 / 정보형=블로그·콘텐츠 C-rank·D.I.A.

- **ACTIVE 업종**: restaurant, cafe, bakery, bar, accommodation — 네이버 AI 브리핑 **플레이스형** 노출 대상 (beauty·nail은 LIKELY, 코드 `score_engine.py:30` 기준)
- **LIKELY 업종**: beauty, nail, skincare, massage, spa, pet, fitness, yoga, pharmacy, dance, ballet, semi_permanent (12개, `score_engine.py:37-38`) — **AI 브리핑 플레이스형** 노출 확대 예정 업종 (안내 톤 분기). ※ AI탭(대화형 검색)은 업종 무관 — 2026-04-27 베타 출시 → **2026-06-25 전체 네이버 사용자 정식 출시 완료** (사용자 확대이며 업종 확대 아님, 네이버 공식)
- **INACTIVE 업종**: 그 외 모든 업종 → 글로벌 AI(ChatGPT·Gemini·Google AI) 중심 안내
- **프랜차이즈는 ACTIVE 업종이라도 제외** (네이버 공식 정책) — `get_briefing_eligibility(category, is_franchise)` 사용
- **단일 소스 동기화**: backend `score_engine.py:30` `BRIEFING_ACTIVE_CATEGORIES` ↔ frontend `lib/userGroup.ts:43` `BRIEFING_ACTIVE_CATEGORIES` — 한쪽 변경 시 양쪽 동시 수정 필수 (RegisterBusinessForm.tsx·dashboard/page.tsx는 userGroup.ts를 import)
- **점수 모델 v3.1**: ACTIVE/LIKELY/INACTIVE 그룹별 Track1 가중치 (`NAVER_TRACK_WEIGHTS_V3_1`) 사용. INACTIVE는 `has_faq=0`점

### 2. 톡톡 채팅방 메뉴 (구 FAQ 개편, 2024.02.14)

- **명칭 일관**: "톡톡 FAQ" → **"톡톡 채팅방 메뉴"** (사용자 노출 화면 전체 적용)
- **URL**: `partner.talk.naver.com` (사장님 직접 설정)
- **사양**: `chat_menus[].link_type: "message" | "url"` — 단순 문자열 배열 사용 금지
- **하위 호환**: 기존 `talktalk_faq_draft` 문자열 배열 → backend `_compat_chat_menus()` + frontend `normalizeChatMenus()` 자동 변환. DB 마이그레이션 불필요
- **DB 컬럼 보존**: `has_faq` 가중치 0이지만 컬럼은 유지 (과거 데이터 호환)

### 3. 스마트플레이스 Q&A 탭 폐기 (2026-05-01 실측 확인)

- **폐기됨**: `/qna` 경로 — 좌측 메뉴·직접 URL 모두 사망
- **금지**: `_SMARTPLACE_PATHS["faq"]` 경로 사용, `/qna` Playwright crawl, `_detect_faq()` 호출
- **사용자 노출 deeplink**: `/qna` 사용 금지 → `/profile`로 교체
- **점수 재배분**: `has_faq` 25점 → 소식(15→25) + 소개글(10→20)로 분배 (합계 100점 보존)
- **단정 표현 금지**: "직접 인용" 등 사용자 노출 화면에 사용 금지 (체크박스 UI도 제거)

### 4. 향후 네이버 사양 변경 발견 시 (재발 방지)

- 영향 범위 문서 신규 작성: `docs/<change>_v<version>.md`
- **작업 순서**: 백엔드 P0 → 프론트엔드 → 사용자 노출 화면 → DB 호환
- SSH 직접 검증 필수 (에이전트 보고만 신뢰 금지 — 2026-05-01 사고 사례 참조: 1차 에이전트 "수정 완료" 보고했으나 실제 미반영)

### 5. AI 노출 기준 작업 시 필수 참조 (2026-05-04 신설)

> **네이버·GPT 관련 기능(스캔·점수·콘텐츠 생성·UI·갭 분석·가이드·키워드) 작업 전 반드시 읽을 것:**
> `docs/naver_gpt_work_standard_v1.0.md` — 업종 분류·스캐너 4종·쿼리 3변형·점수 가중치·콘텐츠 구조·UI 분기·면책 문구 전 영역 포함

**핵심 원칙 3가지**
- ACTIVE/LIKELY/INACTIVE 업종 분류 + 프랜차이즈 제외는 `score_engine.py:30` 단일 소스
- ChatGPT UI 면책 문구 필수: "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- `/qna` 경로 사용 금지 (2026-05-01 폐기) → `/profile` 대체

---

## 프로젝트 개요

**서비스 핵심:** 경쟁 사업체를 분석해 평가 기준을 만들고, 그 기준으로 내 사업장을 진단하여 AI 검색 노출 개선 방안을 제공

**3대 사용자:** 소상공인(사업장 성장) / 시장 조사자(업종 분석) / 예비 창업자(시장 조사)

**소상공인 관점:** 네이버에서 내 가게가 얼마나 노출되는지 + 네이버 AI 브리핑에 잘 나오는지 + 인근 경쟁업체와의 차이 + 개선 방안과 실행 방법을 알 수 있어야 한다.

**BEP:** 구독자 20명 (월 비용 약 8만원)

### 모델 엔진 v3.0 (듀얼트랙)

`Unified Score = Track1 × naver_weight + Track2 × global_weight`

- `DUAL_TRACK_RATIO`: 42개+ 업종 × naver/global 비율 (`score_engine.py:114`; restaurant 80/20, cafe 75/25, legal 20/80, shopping 10/90 등) — 2026-06-23 restaurant 70→80 상향
- fallback: `DEFAULT_DUAL_TRACK_RATIO = {naver: 0.60, global: 0.40}` — 미등록 업종 중립 기본값 (restaurant 자체는 70/30)
- GrowthStage 기준: **`track1_score`** (unified 아님 — 업종 비율 차이로 오판 방지)
- keyword_gap cold start: 리뷰 → 블로그 자동 추출 → fallback 30.0
- trial: **ChatGPT 50회 비유도형** (`multi_scanner.scan_trial()` → `chatgpt.sample_recommend(n=50)` — 가게명을 프롬프트에 넣지 않고 추천 가게를 나열시켜 내 가게가 자발적으로 나오는지 대조, 2026-09-28. Gemini 미사용)

모델 엔진 관련 작업 시 `docs/model_engine_v3.0.md`를 먼저 읽고 개선 사항을 알릴 것.

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 16.2.1 App Router + Tailwind + shadcn/ui + Recharts | 포트 3000 |
| 백엔드 | Python FastAPI + Pydantic v2 + APScheduler + aiohttp | 포트 8000 |
| DB | Supabase Cloud Free Tier (PostgreSQL + Auth + Storage) | |
| AI 스캔 | Gemini 2.5 Flash + OpenAI gpt-4.1-mini (Basic 자동 50/50 분할, Full 각 100회) + 네이버 AI 브리핑(Playwright) + Google AI Overview(Serper.dev API) | 4종 운영 |
| AI 가이드 | Claude sonnet-4-6 (가이드 전용) + Claude Haiku (FAQ/감정분석) | |
| 스크린샷 | Playwright 1.44+ | `PLAYWRIGHT_SEMAPHORE = Semaphore(int(os.getenv("PLAYWRIGHT_MAX_CONCURRENCY","1")))` 전역 공유 (6개 파일 통합 완료 2026-05-20) |
| 결제 | 크렙(Creb) PG (심사 중, 테스트 키). 토스페이먼츠는 사용 중단·키 삭제(2026-10-25) | §"남은 작업" 참조 |
| 알림 | 카카오 비즈API v2 알림톡 5유형 | |
| 서버 | iwinv vCPU2/RAM4GB, Ubuntu 24.04 LTS, Nginx + PM2 | aeolab.co.kr |
| CI/CD | GitHub Actions — main 브랜치 push 시 자동 배포 | |

### AI 스캐너 4종 체계 (multi_scanner.py 기준)

| 스캐너 | 파일 | 방식 | 용도 |
|--------|------|------|------|
| Gemini 2.5 Flash | `gemini_scanner.py` | API | sample_recommend(비유도, n=50/100) — scan_basic()은 50회, scan_all()은 100회 |
| ChatGPT gpt-4.1-mini | `chatgpt_scanner.py` | API | **전 경로 `sample_recommend`(비유도형, 2026-09-28)** — scan_basic() 50회, scan_all() 100회, Quick 5회, Trial 50회. 유도형 `sample_n`은 호출처 없음(실사업장 43~95/100 부풀림·환각 인용문 확인) |
| 네이버 AI 브리핑 | `naver_scanner.py` | Playwright | 네이버 AI 브리핑 DOM 파싱 |
| Google AI Overview | `google_scanner.py` | Serper.dev API | 구글 SGE + AI Overview 노출 확인 ($0.001/건, CAPTCHA 없음) |

**제거됨:** Perplexity(미사용), Grok, Claude 스캐너, 뤼튼/Zeta (비용·ROI 이유)

**스캔 모드 (2026-07-27 `jobs.py:467-482` 재확인 — "Basic=scan_basic()" 서술이 stale이었음을 발견·정정):**
- Trial(ChatGPT 50회 비유도 sample_recommend + 네이버·카카오 API, 비로그인 1회성, Gemini 미사용 — 무료 티어 한도로 제거)
- Quick(ChatGPT 5회 + Naver)
- **`scan_basic()`(Gemini 50회 + ChatGPT 50회 + Naver + Google)** — `multi_scanner.py:185`. ⚠️ 실제 호출처는 전체 백엔드에 `jobs.py:480` 단 1곳뿐이며 **Pro 플랜의 경량 스캔일(화·수·목·토·일 — 월·수·금만 풀스캔)에만 쓰임**. 이름과 달리 Basic 플랜에는 쓰이지 않음
- **`scan_all()`(Gemini 100회 + ChatGPT 100회 + Naver AI브리핑 + Google + AI탭)** — Basic(월·목, 주2회)·창업패키지(월, 주1회)·Pro(월·수·금, 주3회)·Biz(매일) **전부** 이 풀스캔 사용(`jobs.py:467-482`). Basic 무료체험(`run_basic_trial`)도 동일하게 `scan_all()` 재사용. "Basic 자동 50회"로 기재됐던 과거 서술은 오류 — Basic도 스캔할 때는 실제로 100회씩 측정함

**점수 산식 (calc_multi_ai_exposure):** Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분. sample_size 자동 처리로 50회·100회·boolean 모두 호환.

---

## 프로젝트 경로 및 환경

- **서버:** `root@115.68.231.57`, SSH 키 `~/.ssh/id_ed25519`, `/var/www/aeolab/`
- **로컬:** `C:/app_build/aeolab/`
- **Python venv:** 서버 `/var/www/aeolab/venv/`, 로컬 `backend_venv/` (루트)
- **PM2:** `aeolab-backend` (8000), `aeolab-frontend` (3000)
- **Node:** 20 LTS | **Python:** 3.11+

### 실행 방법 (로컬)
```bash
# 터미널 1: 프론트엔드
cd frontend && npm run dev      # http://localhost:3000
# 터미널 2: 백엔드
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 환경변수 요약 (`.env.example`)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- AI: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- 결제: `NEXT_PUBLIC_CREB_CLIENT_KEY`(프론트), `CREB_SID`, `CREB_SECRET_KEY`(백엔드) — 현재 테스트 키. 크렙 심사 승인(2026-10-27) — 키는 그대로 사용, QA용 `CREB_TEST_PRICE_*`는 서버 `.env`에서 삭제 완료(백업 `/root/backend_env_backup_20261027_creb_live`). ⚠️ 라이브 결제는 테스트와 달리 자동 취소가 없음 — 시험 결제는 직접 취소(`docs/launch_checklist_2026_10_25_v1.0.md` §5-1). (토스 키는 2026-10-25 서버에서 삭제)
- 알림: `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_REST_API_KEY`
- 검색: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (Open API, DataLab 겸용) / `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID` (검색광고 키워드도구 API, searchad.naver.com 별도 발급 — 미설정 시 graceful degradation)
- 기타: `BACKEND_URL`, `SECRET_KEY`

---

## 요금제 최종 가격 (4곳 모두 일치)

- **Basic 17,900원** (신규 첫 달 50% 할인 8,950원, 이후 정상가)
- **창업패키지 23,900원**
- **Pro 29,900원**
- **Biz 79,500원** (이메일 문의 전용, 결제 링크 별도)
- **Enterprise 200,000원**
- 연간 결제액(백엔드 `prices.py` 한정, 프론트 미노출) = 월가 ×10 (179,000/239,000/299,000/795,000)
- **2026-09-30 가격 재조정** (기존 11,900/12,900/23,900/49,900). 시장조사 근거: 플레이스 바로미터 19,900~·블랙키위 프리미엄 89,100·대행 월 30만~. Biz는 팀 계정·API 키가 껍데기(초대 기록만, 키 검증 엔드포인트 없음)라 판매 문구에서 제외 — 수요 확인 후 완성 검토

> **요금제 한도 전체 기준**: `docs/plan_limits_v1.0.md` (2026-06-17 확정) — 기능 한도·API 비용·마진·단일 소스 파일 목록 포함. 수치 기재 전 항상 `backend/middleware/plan_gate.py PLAN_LIMITS` 직접 확인.

**단일 소스 파일:**
- **기능 한도**: `backend/middleware/plan_gate.py` (PLAN_LIMITS) — 한도 정의 원본
- 가격: `backend/config/prices.py` (PLAN_PRICES + FIRST_MONTH_DISCOUNT_PRICES)
- 프론트 카드: `frontend/lib/plans.ts`
- 비교표: `frontend/app/(public)/pricing/page.tsx`, `frontend/app/(dashboard)/settings/page.tsx`
- 관리자 MRR: `frontend/app/admin/AdminDashboard.tsx`
- 결제: `backend/services/creb_billing.py`·`creb_client.py`, `backend/routers/webhook.py` (토스는 2026-10-25 폐기)
- UI: `frontend/components/common/PlanGate.tsx`, `frontend/app/(auth)/signup/page.tsx`

### 첫 달 50% 할인 인프라 (v3.3, 2026-04-22)

- `pricing/PayButton`: `subscriptions` 이력 조회 → 없으면 `chargeAmount=5950`, 있으면 정상가
- `/api/webhook/creb/billing/issue` 서버 재검증 (`_is_first_time_subscriber()`)
- 통과 시 `first_month_discount_until=today+30` + `first_payment_amount=5950` 기록
- 30일 후 자동 재결제 → `PLAN_PRICE["basic"]=11900` 정상가 청구
- **악용 차단:** 클라이언트가 `amount=5950` 조작해도 서버 400 거부

---

## 데이터베이스 테이블 (Supabase PostgreSQL)

| 테이블 | 역할 |
|--------|------|
| users | Supabase Auth |
| businesses | 사업장 (category, region, keywords[], naver/google/kakao_place_id, excluded/custom_keywords, blog_analysis_json, receipt_review_count) |
| competitors | 경쟁사 |
| scan_results | 스캔 결과 (gemini/chatgpt/naver/google_result, kakao_result, website_check_result, competitor_scores, track1/track2/unified_score, keyword_coverage) |
| ai_citations | AI 인용 실증 (platform, query, mentioned, excerpt, sentiment, mention_type) |
| score_history | 점수 시계열 30일 (context, track1/track2/unified_score) |
| before_after | 스크린샷 |
| guides | 개선 가이드 (scan_id, context, next_month_goal, tools_json) |
| subscriptions | 구독 (billing_key, customer_key, grace_until, first_month_discount_until, first_payment_amount) |
| profiles | 사용자 프로필 (phone, kakao_scan_notify, kakao_competitor_notify, onboarding_done, basic_trial_used) |
| notifications | 알림 발송 이력 |
| team_members | 팀 계정 (Biz 5, Enterprise 20) |
| api_keys | Public API 키 (Biz+, SHA256 해시 저장) |
| waitlist | 대기자 명단 |
| trial_scans | 무료 체험 (IP 해시, place_data, smart_place_check) |
| business_action_log | 행동-결과 타임라인 (action_type, action_date, score_before/after) |
| gap_cards | 갭 분석 카드 |
| weekly_scores | 주간 점수 뷰 |
| ai_usage_log | AI 실사용 토큰·비용 텔레메트리 (provider/model/purpose/tokens_in/out/thinking_tokens/estimated_cost_krw, 2026-07-12 신설, SQL 수동 실행 필요) |

### 업종 화이트리스트 59개 (v5.8, 2026-05-18 확장)
> 전체 목록은 `backend/tests/test_category_alias.py:WHITELIST_59` 참조 (25개→59개로 확장됨, alias 포함)

> 과거 코드 `hospital→medical`, `law→legal`, `shop→shopping` 마이그레이션 완료.

---

## 백엔드 API 엔드포인트 (핵심)

| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/scan/trial | 무료 원샷 (비로그인, ChatGPT 50회 비유도 + 네이버, IP당 3회/일) |
| GET | /api/scan/trial-search | 네이버 지역검색 후보 (IP당 분당 10회) |
| GET | /api/scan/trial-count | 공개 누적 체험 카운터 |
| POST | /api/scan/full | 전체 4개 AI 병렬 (구독자) |
| POST | /api/scan/stream | 실시간 SSE 진행률 |
| GET | /api/report/score/{biz_id} | DiagnosisReport (channel_scores + website_health) |
| GET | /api/report/market/{biz_id} | MarketLandscape (30분 캐시) |
| GET | /api/report/gap/{biz_id} | GapAnalysis |
| GET | /api/report/history/{biz_id} | 30일 추세 |
| GET | /api/report/competitors/{biz_id} | 경쟁사 비교 |
| GET | /api/report/ranking/{category}/{region} | TOP10 (30분 캐시) |
| GET | /api/report/benchmark/{category}/{region} | 업종 벤치마크 (1h 캐시) |
| GET | /api/report/ai-citations/{biz_id} | AI 인용 미리보기 (Basic+) |
| GET | /api/report/sentiment/{biz_id} | 리뷰 감정 분석 (Basic+, 1h 캐시) |
| GET | /api/report/condition-search/{biz_id} | 조건 검색 (Pro+, 1h 캐시) |
| GET | /api/report/conversion-tips/{biz_id} | 대시보드 맞춤 전환 팁 (AI 호출 0) |
| GET | /api/report/keyword-trend/{biz_id} | 키워드 30일 트렌드 |
| POST | /api/report/smartplace-check | 스마트플레이스 자동 점검 |
| POST/GET | /api/report/action-log/{biz_id} | 행동-결과 타임라인 |
| GET | /api/report/multi-biz-summary | Biz+ 멀티 사업장 |
| GET | /api/report/growth-card/{biz_id} | Growth Card 이미지 |
| GET | /api/share/image/{trial_id} | 카카오 공유 카드 PNG (인증 불필요, 24h 캐시) |
| GET | /api/report/export/{biz_id} | CSV (Pro+) |
| GET | /api/report/pdf/{biz_id} | PDF (Pro+) |
| POST | /api/guide/generate | Claude Sonnet 가이드 |
| POST | /api/guide/{biz_id}/smartplace-faq | FAQ 초안 (Basic+, 월 한도) |
| GET | /api/guide/{biz_id}/pioneer-detail | 선점 키워드 상세 (Basic+, 2h 캐시) |
| POST | /api/schema/generate | JSON-LD |
| POST | /api/webhook/creb/billing/issue | 빌링키 발급 + 첫 결제 + 첫 달 할인 재검증 (크렙, 단일 경로) |
| CRUD | /api/businesses{/me,/{id}} | 사업장 |
| CRUD | /api/competitors | 경쟁사 (search, suggest/list 포함) |
| POST | /api/startup/report | 창업 리포트 (startup/biz+) |
| GET | /api/startup/timing/{cat}/{region} | 창업 타이밍 지수 |
| CRUD | /api/teams/*, /api/v1/keys | Biz+ |
| GET | /admin/{stats,subscriptions,revenue} | 관리자 |
| GET | /health | 서버·DB 상태 |

---

## AI Visibility Score 가중치 (라이브 v3_1 — 그룹별 가중치)

> **⚠️ 가중치 기재 전 서버 `.env`의 `SCORE_MODEL_VERSION` 항상 먼저 확인** (`score_engine.py:24`, 미설정 시 `"v3_0"` 폴백). 2026-07-06 SSH 재확인: `.env`·`backend/.env` 양쪽 `SCORE_MODEL_VERSION=v3_1` — **v3.0 단일 `NAVER_TRACK_WEIGHTS`는 라이브 아님, 하위 호환 폴백용**. v3.0 dict를 "현재"로 오기재한 사고가 2026-06-12·2026-07-06 두 번 반복됨.

### Track 1 — 네이버 AI 채널 (`NAVER_TRACK_WEIGHTS_V3_1`, 그룹별 6항목, 각 합계 1.0, `score_engine.py:1097`)

| 키 | ACTIVE | LIKELY | INACTIVE | 설명 |
|----|--------|--------|----------|------|
| `keyword_search_rank` | 25% | 30% | 35% | Playwright 실측 키워드 순위 (v3.0 `keyword_gap_score`에서 교체) |
| `review_quality` | 15% | 17% | 20% | 리뷰 수·평점·최신성 |
| `smart_place_completeness` | 15% | 18% | 20% | 스마트플레이스 + 키워드 갭 콘텐츠 매칭 흡수 |
| `blog_crank` | 10% | 10% | 10% | 블로그 C-rank 추정 (신규 분리) |
| `local_map_score` | 10% | 10% | 15% | 네이버 지도 + 카카오맵 통합 (구 `kakao_completeness`) |
| `ai_briefing_score` | 25% | 15% | 0% | AI 브리핑 인용 (구 `naver_exposure_confirmed`, INACTIVE=0점 유지) |

### Track 2 — 글로벌 AI 채널 (`GLOBAL_TRACK_WEIGHTS`, 4개 항목, 합계 1.0, `score_engine.py:296` — 버전 무관 공통)

| 키 | 가중치 | 설명 |
|----|--------|------|
| `multi_ai_exposure` | 30% | Gemini·ChatGPT 각 50회(Basic) / 100회(Full) 샘플링 — 소상공인 학습데이터 미반영 현실 반영해 40%→30% 하향(2026-06-23) |
| `schema_seo` | 30% | JSON-LD + 웹사이트 SEO + Open Graph |
| `online_mentions` | 20% | 블로그·뉴스·미디어 언급 |
| `google_presence` | 20% | Google AI Overview — Serper.dev 실시간 실측, 신뢰도 높아 10%→20% 상향(2026-06-23) |

### 개편 이력 및 핵심 규칙

- v3.0(단일 `NAVER_TRACK_WEIGHTS` 6항목) → **v3_1(그룹별 6항목, 항목명도 재편)** → v3.2/v3.3도 존재, `SCORE_MODEL_VERSION` 환경변수로 토글
- GrowthStage 기준: **`track1_score`** (unified 아님) — 업종별 비율 차이 오판 방지
- **채널별 노출 소요 기간**: 네이버 AI 브리핑·AI탭 2~4주(추정, 네이버 미공개) / Gemini GBP 등록 후 2~4주 내 반영 시작·안정적 인용까지 수 개월(Google Search 실시간 grounding — GBP 인덱싱 1~4주 후 연동) / ChatGPT 수개월~1년(학습 데이터 기반, knowledge cutoff 2024-06-01 공식 확인) — ChatGPT·Gemini를 묶어 표시하지 말 것(원리가 다름)

---

## API 비용 관리 (BEP 20명 기준, A안 50/50 반영)

> **단가 기준 (2026-06-25 공식 확인):** Gemini = Standard Tier (gemini_scanner.py가 실시간 `generate_content` 사용). 월 비용은 실측 데이터 미확보로 추정값 — 실구독자 확보 후 재산정 필요.
> **2026-07-12 발견 (`docs/business_viability_audit_v1.0.md` §1):** 설치된 SDK(`google-generativeai==0.8.3`)는 protobuf `GenerationConfig`에 `thinking_config` 필드 자체가 없어 Gemini 2.5 Flash의 동적 사고(thinking, 기본값 Auto)를 코드로 끌 방법이 없었음 — 그리고 어떤 AI 호출에도 토큰 사용량 로깅이 전무해 아래 표 전체가 출시 이후 한 번도 실측 검증되지 않았음. `ai_usage_logger.py` 신설로 Gemini/ChatGPT 스캔 호출 계측 시작(배포 후 실측 누적 예정, `ai_usage_log` 테이블 — 아직 SQL 미실행 시 수동 실행 필요).

| API | 단가 | 월 비용 (추정) | 용도 |
|-----|------|--------------|------|
| Gemini 2.5 Flash | **$0.30/1M in, $2.50/1M out** (Standard, thinking 포함) | ~$3~8 | scan_basic() 50회 / scan_all() 100회 (2026-05-31 2.0→2.5 마이그레이션) |
| OpenAI gpt-4.1-mini | **$0.40/1M in, $1.60/1M out** | ~$1~3 | scan_basic() 50회 / scan_all() 100회 |
| Claude Sonnet | $3/1M in | ~$3 | 가이드 생성 시만 |
| 카카오 알림톡 | 8~15원/건 | ~800원 | 변화 있을 때 |
| iwinv 서버 | 고정 | 27,800원 | |
| **합계** | | **~8~15만원** | Gemini thinking 토큰 실측 전 상단 불확실 |

> **⚠️ 2026-07-27 재확인**: 위 추정치는 "Basic 자동 스캔=scan_basic()(50회)"라는 전제로 산정됐으나, 실제 `jobs.py:467-482`는 Basic·창업패키지·Biz 전부 `scan_all()`(100회)을 씀 — Basic 스캔 1회당 실제 API 호출량이 이 표 산정 전제의 약 2배. 구독자당 스캔 빈도(Basic 주2회)까지 고려한 재추정 필요 — `ai_usage_log` 실측 데이터 누적 후 정확히 재계산할 것.

> **PG(결제대행) 수수료 — 2026-07-16 재확인, 카테고리·등급 2건 정정**: 2026-07-12엔 "정기결제(빌링) 4.3%+VAT"로 기재했으나, 이는 토스의 **브랜드페이** 상품 수수료였음 — AEOlab이 실제 쓰는 API(`webhook.py`의 `/v1/billing/authorizations/issue`, `/v1/billing/{billingKey}`)는 브랜드페이가 아닌 **표준 신용카드 자동결제(빌링키)** 상품이라 일반 등급은 **3.4%+VAT**가 맞는 카테고리(토스 공식 수수료 페이지 확인). 여기에 **사용자 확인 결과 AEOlab 사업자는 연매출 3억원 이하 "영세" 등급**(국세청 매년 1·7월 자동 산정·소급적용, 토스페이먼츠 공식 문서 확인) → 신용카드 **0.40%+VAT(실효 0.44%)**. 마진율 재계산은 `docs/business_viability_audit_v1.0.md` §2 참조.

> ⚠️ **Gemini 2.5 Flash thinking 토큰 주의**: 출력 단가 $2.50에 thinking 토큰 포함. 단순 JSON 태스크에서 thinking이 최소화되면 실제 비용은 하단에 가까움. 구독자 확보 후 실측 필요. Batch Tier($0.15/$1.25) 전환 시 비용 절반 이하로 감소 가능.

**마진율(2026-09-30 신가격+실측 단가 재계산, `docs/plan_limits_v1.0.md` 상단):** Basic 85.7%, 창업 86.7%, Pro 83.5%, Biz(1사업장) 89.8%(5사업장 풀사용 82.9%) — 한도 100% 사용 보수 기준, 평균 사용 시 86~93%. 이전 07-16 수치(83.8/83.9/86.4/91.4%)는 옛 가격 기준. 2026-07-12 수치(76.3/79.6/78.6/87.1%)는 PG 수수료 자체는 반영했으나 **상품 카테고리를 잘못 짚어(브랜드페이 4.3% 적용, 실제는 표준카드 3.4%) + 영세 우대등급 미확인 + 가격 인상 전(Basic 9,900→11,900원 등) 구가격**으로 계산된 값이었음. 위 수치도 API 비용 축(Gemini thinking 토큰 미실측)은 여전히 추정치 — PG 수수료 축만 확정 값(사용자 확인 완료)

---

## 개발 Phase 현황

- **Phase 0 (검증) ✅** / **Phase 1 MVP ✅** (BEP 20명 미달)
- **Phase 2 v1.0 ✅** (MRR 100만원 미달)
- **Phase 3 v1.5**: 창업패키지·뤼튼 제거·팀 계정 ✅ / 디지털 바우처 ❌
- **Phase 4 v2.0**: API 키 ✅ / 광고대응 ✅ / B2G ❌

### 운영 환경 현황
- ✅ 서버/Nginx/PM2/SSL, Supabase v3.3 스키마, .env, Storage, Rate Limit, reportlab+NotoSansCJK
- ✅ 카카오 알림톡 5종 전체 승인 완료 (2026-04-24)
- ⏳ 실결제 전환 (§"남은 작업 — 사용자가 직접 해야 할 것" 참조)
- ✅ v3.2/v3.3~v5.5 SQL 전체 실행 완료 + git `057d62e` 배포 완료 (2026-05-18)
- ✅ Supabase Storage `delivery-materials` 버킷 생성 완료 (Private, 10MB)
- ✅ 대행 서비스 DB 5개 테이블 존재 확인 (delivery_orders/messages, support_tickets/replies, success_stories)
- ✅ `profiles` v5.8 컬럼 (intro_draft) — 실행 완료 (2026-05-25)
- ✅ Sentry 에러 모니터링 프론트+백엔드 도입 완료 (2026-08-01, git `4b38856`) — `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` 서버 `.env` 설정됨, `send_default_pii=False`

---

## 운영 서버 주의사항

- **현재 사양:** iwinv vCPU2 / RAM4GB (`/var/www/aeolab/`)
- **🆙 업그레이드 예정:** 홈페이지 개발 완성 후 1단계 상위 사양으로 전환. RAM 8GB 기대 → `PLAYWRIGHT_MAX_CONCURRENCY` 환경변수로 `Semaphore(2~3)` 상향 검토 가능 (현재 1)
- **개발 시 가정**: "현재 vCPU2/RAM4GB에서도 안정 동작" + "업그레이드 후 측정 주기 단축·동시성 증가" 양쪽 모두 가능하도록 설계 (예: 측정 주기·동시성 한도를 환경변수로 분리)
- **⚠️ 페이지 동시 접속 병목은 vCPU/RAM이 아니라 Supabase다 (2026-08-23 실측)**: 대시보드 실측 부하테스트 결과 동시접속 50명 부근에서 응답시간이 34초로 급붕괴하는 순간에도 서버 CPU 0.1~0.2%·RAM 여유 2.7GB로 완전 유휴 상태였음 — 원인은 대시보드 1회 로드당 약 10개 병렬 Supabase 쿼리가 Supabase Cloud(Free Tier)에서 큐잉되는 것으로 추정. 즉 **"서버 업그레이드하면 페이지 동시접속 대응력이 늘 것"이라는 가정은 이 축에선 성립 안 함** — 해결하려면 Supabase 유료 플랜 또는 쿼리 통합/캐싱이 필요. (위 Playwright 세마포어/워커=1 축은 CPU·RAM 제약이 맞으므로 이 문단과 혼동 금지). 상세 `docs/dashboard_load_test_and_capacity_v1.0.md`
- **Playwright RAM:** 인스턴스 1개 = 300~500MB. 동시 2개 이상 금지.
  - `ai_scanner/multi_scanner.py:40`: `PLAYWRIGHT_SEMAPHORE = Semaphore(int(os.getenv("PLAYWRIGHT_MAX_CONCURRENCY","1")))` 선언
  - 공유 파일 6개: multi_scanner, naver_ai_tab_scanner, competitor_place_crawler, naver_place_stats, smart_place_auto_check, scan.py — **2026-05-20 전역 공유 통합 완료**
  - AI탭 스캐너(`NAVER_AI_TAB_ENABLED=true`, 활성 운영 중)도 별도 세마포어 작업 없이 동일 공유 세마포어 사용
- **CORS:** `allow_origins=['https://aeolab.co.kr','http://localhost:3000']`, `allow_methods` 명시적 5개
- **Nginx:** `/api/` 경로 SSE 스트리밍 위해 `proxy_buffering off` 필수. `proxy_buffer_size 16k`/`proxy_buffers 8 16k`/`proxy_busy_buffers_size 32k`(server 블록 전역, 2026-08-24 추가) — CSP+Supabase 인증쿠키 합산이 nginx 기본버퍼(4~8k)를 넘겨 502 "upstream sent too big header" 유발했던 것 수정. 향후 응답 헤더(쿠키·CSP 등)를 늘릴 때마다 이 한도 재확인 필요
- **Phase 2+ 전환:** Vercel(Next.js) + Railway(FastAPI) 분리는 구독자 100명 이후

---

## 카카오 알림톡 템플릿 (2026-09-02 비즈센터 승인내역 스크린샷으로 재확인 — 과거 "5종" 기재는 stale이었음, 실제 17개+ 승인됨)

**핵심 5종(주기적 잡)**: `AEOLAB_SCORE_01` 점수 변화 / `AEOLAB_CITE_01` AI 인용 실증 / `AEOLAB_COMP_01` 경쟁사 변화 / `AEOLAB_NEWS_01` 시장 뉴스 / `AEOLAB_ACTION_01` 이달 할 일

**그 외 승인 확인됨(2026-09-02)**: `AEOLAB_SCAN_01`(스캔 완료 즉시) · `AEOLAB_COMP_02`(경쟁사 역전 긴급) · `AEOLAB_ALERT_01`(별점 낮은 리뷰 긴급) · `AEOLAB_GROWTH_01`(성장 단계 업그레이드) · `AEOLAB_WEEKLY_01`(주간 성적표) · `AEOLAB_CANCEL_01`/`AEOLAB_EXPIRE_01`/`AEOLAB_SUSPEND_01`/`AEOLAB_RESUME_01`/`AEOLAB_PAYFAIL_01`/`AEOLAB_PRICEUP_01`(구독/결제 상태 안내) · `AEOLAB_DELIVERY_01~04`(대행 서비스) · `SCOREMODEL01`

새 알림 트리거 추가 시 "AEOLAB_XXX_01 미승인이라 보류" 판단 전에 반드시 사용자에게 비즈센터 승인내역 재확인 요청할 것 — 코드에 이미 구현돼 있어도 CLAUDE.md 기재가 실제 승인 현황보다 낡아있을 수 있음.

---

## 개발 원칙

- Phase 0~1은 **완벽한 코드보다 작동하는 제품** 우선
- BEP 20명 이후 코드 품질·테스트·모니터링 체계화
- 비용 최적화: 100회 샘플링은 Gemini Flash 주력, Claude는 가이드 생성 시만

### 작업 기준 — 실제 서버 우선

**모든 코드 수정은 실제 서버에 직접 반영하는 것이 기준. 로컬은 서버 복사본.**

> **⚠️ 편집 전 md5 선확인 필수 (2026-06-11 신설).** "무작정 로컬 수정 → scp 업로드"는 **금지** — 로컬이 구버전이면 서버 최신본을 덮어쓴다(2026-06-11 `ScanResultNavBar.tsx` 로컬이 서버보다 구버전이라 오판한 사고). TSX 멀티라인은 SSH 직접편집이 비현실적이라 **"md5 선확인 → 로컬편집 → scp"가 현실적 안전경로**이며, 핵심은 *편집 직전 로컬==서버 일치 확인*이다.

**작업 순서:**
0. **md5 선확인** — `ssh root@115.68.231.57 "md5sum /var/www/aeolab/<경로>"` vs 로컬 `md5sum`. **다르면 서버가 진실 → 먼저 `scp 서버→로컬`로 받은 뒤** 편집. 같을 때만 바로 편집.
1. 로컬 편집 후 `scp 로컬→서버` (또는 SSH 직접 수정)
2. 프론트엔드 변경 시 서버에서 `npm run build`
3. `pm2 restart aeolab-frontend` / `pm2 restart aeolab-backend`
4. 라이브 검증(`https://aeolab.co.kr`, PC+모바일) 후 `scp 서버 → 로컬` 동기화 + **md5 재일치 확인**
5. **git 커밋 (drift 차단 — 2026-06-12 신설)** — scp 배포가 끝나면 **반드시 같은 변경을 로컬 git에 커밋**(`git add <파일> && git commit`)한다. **push는 선택**(자동배포 `reset --hard` 위험으로 reconcile 전엔 보류 가능)이나 **커밋은 필수** — 이 단계를 빠뜨리면 "서버엔 있고 git엔 없는" 변경이 누적돼 양방향 drift가 발생한다(2026-06-12 서버/로컬 32개 파일 drift 사고).

### Drift 방지 장치 (2026-06-12 신설)

> scp 직접 배포 ↔ git `reset --hard` 두 경로가 어긋나 누적되던 drift를 막는 3종 + 규칙 1.

- **① deploy.yml 비파괴 가드** — `git reset --hard origin/main` 직전 미커밋 변경을 `/var/www/aeolab_predeploy_backups/predeploy_<ts>.tgz`로 자동 tar 백업(복원 가능, 최근 10개 유지). 2026-07-08 push로 **최초 실제 작동 확인**(`predeploy_20260708_174019.tgz`).
- **③ `.gitattributes`** (`* text=auto` + 소스 `eol=lf`) — Windows(CRLF)↔서버(LF) 유령 diff 제거.
- **④ drift 점검 스크립트** — `bash scripts/check_server_drift.sh` (읽기 전용). 서버 라이브 vs 로컬 git-tracked 전체를 줄바꿈 정규화 비교 → `[내용DRIFT]`/`[서버에만]`/`[로컬에만]` 리포트. **주 1회 권장**, `[내용DRIFT] 0건`이 정상.
- **② 위 작업 순서 5번**(scp 후 즉시 커밋)이 drift의 원천 차단책.
- **2026-07-08 drift 해소 완료** — 실제 점검 결과 "32개 파일 양방향 drift"는 과거 기록보다 훨씬 양호했음: `[서버에만]` 0건, `[내용DRIFT]` 5건(문서 3·`plans.ts` 문구·`package-lock.json` 패치버전 — 전부 방향 판정 후 정리), `[로컬에만]` 103건(대부분 문서/스크린샷 + scp로 이미 서버에 실존하는 프론트 컴포넌트, git만 미추적). 서버 전체 백업(`aeolab_live_backup_20260708.tgz`, node_modules·`.next`·venv 제외) 선행 후 440커밋 push, CI/CD 배포 정상 완료(git `62a8bf5`, backend/frontend 재시작 에러 0건). 이제 서버 git HEAD == 로컬 main, 미해소 drift 없음.

---

## 코드 수정 요청 시 필수 절차 (자동 적용)

> 수정 요청을 받으면 아래 순서를 반드시 따를 것. 건너뛰기 금지.

### Step 1 — 현재 상태 파악 (수정 전)
- `Read`로 대상 파일 전체 구조 확인
- `Grep`으로 동일 패턴의 다른 파일 영향 범위 확인
- **서버 파일과 로컬 파일 md5 비교 필수** (어느 쪽이 최신인지 SSH로 확인). 다르면 서버가 진실 → `scp 서버→로컬` 먼저. 이 단계 건너뛰면 구버전 로컬로 오판·클로버 발생 (§"작업 기준 — 실제 서버 우선" 0번 참조)

### Step 2 — 외부 사양 변경 의심 시
- 네이버·ChatGPT·Google 정책 관련이면 `WebSearch`로 최신 공식 자료 먼저 확인
- CLAUDE.md의 기존 기준과 충돌 시 → 실측 우선, CLAUDE.md 즉시 갱신

### Step 3 — 수정
- 최소 변경 원칙 (필요한 라인만, 불필요한 리팩터링 금지)
- PC/모바일 분리 레이아웃 유지
- `text-sm` 이상 가독성 준수

### Step 4 — 검증 (수정 후)
- **오판·오탐·누락 재확인 필수** — §"작업 진행 시 공통 필수" 3종을 완료 선언 전 수행하고 보고에 결과 명시
- §"에이전트 보고 검증 의무" 절차와 동일하게 적용 (SSH grep 확인 · pm2 error.log 확인 · 에이전트 보고 신뢰 금지)

#### 프론트엔드 파일 변경 시 추가 필수 3단계 (2026-06-04 신설)

> 2026-06-04 사고: 배포 에이전트가 "완료" 보고했으나 `CompetitorFAQCard.tsx`가 서버에 미반영된 채 방치. 빌드 미실행으로 구버전이 서비스됨. 메인 세션 grep 미확인이 원인.

1. **파일 내용 확인** — `ssh root@115.68.231.57 "grep -n '<핵심패턴>' /var/www/aeolab/frontend/components/<경로>"` — 수정 키워드가 서버 파일에 실제로 있는지 1줄 이상 직접 확인
2. **빌드 완료 확인** — `ssh root@115.68.231.57 "cd /var/www/aeolab/frontend && npm run build 2>&1 | tail -5"` — 빌드 성공 로그 확인. **파일 업로드만으로 반영 안 됨 — 빌드 필수**
3. **PM2 재시작 + 에러 확인** — `pm2 restart aeolab-frontend` 후 `pm2 logs aeolab-frontend --lines 30 --nostream` 에러 0건

> **백엔드는 `uvicorn --workers 1`을 `--reload` 없이 실행 중(2026-10-10 `pm2 describe` 확인)이라 `.py`를 올린 뒤 `pm2 restart aeolab-backend`를 해야 반영된다. 프론트엔드는 `npm run build` 후 `pm2 restart aeolab-frontend`. 둘 다 파일만 올려서는 반영되지 않는다.**

---

## 필수 코드 패턴 (과거 버그 재발 방지)

### Next.js 16 + Supabase Auth
```typescript
// middleware.ts — 항상 getUser() 사용 (getSession() 금지, Invalid Refresh Token 안전)
const { data, error } = await supabase.auth.getUser();
if (!error) user = data.user;

// (dashboard)/layout.tsx — try-catch 필수
try {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) user = data.user;
} catch { /* AuthApiError → 비로그인 처리 → /login redirect */ }
```
- Next.js 16: `middleware.ts` 파일명 그대로 유지 (`proxy.ts`로 변경 금지 — 실제 코드 `frontend/middleware.ts` 사용 중), `cookies()` **async**, `createClient()` **async**
- `@supabase/auth-helpers-nextjs` **Deprecated** → `@supabase/ssr` 사용

### supabase-py 2.7.4 응답 객체 (필수)
```python
# .execute() 반환값은 항상 truthy → 반드시 .data 확인
res = supabase.table("x").select("*").execute()
if not (res and res.data):      # NOT `if not res:` (항상 False)
    return None
row = res.data[0]               # NOT `res[0]` or `res.get()`
```
- 2026-04-14 Critical 버그: `if not biz:` 소유권 검증 우회 전면 수정함
- `res.data[0]` (list 접근), `logs.data or []` 패턴 유지 (`res.data.get()` 금지 — list에 get() 없음)

### Supabase HTTP/2 연결 끊김 방어 (`backend/db/supabase_client.py`)
- `execute()`에 `RemoteProtocolError` / `Server disconnected` 감지 시 `_reset_client()` 후 1회 자동 재시도
- silent pass 금지 — 재시도 실패 시 `_logger.warning()` 후 raise

### SSE 스캔 진행률
- `POST /stream/prepare` → `stream_token` (60초 OTP)
- `GET /stream?stream_token=` (토큰으로 연결)

### DB 마이그레이션
- Supabase Management API 미지원 → SQL Editor 수동 실행
- `scripts/supabase_schema.sql`에 ALTER TABLE 섹션 유지

### 로컬 Python venv 경로
- Windows: `backend_venv\Scripts\activate`
- pip: `backend_venv/Scripts/pip install -r backend/requirements.txt`

### 점수 표시 원칙 (2026-06-10 확정, 2026-06-17 스코프 명확화)

> **⚠️ AI Visibility 점수 수치(숫자)는 사용자에게 직접 표시하지 않는다.** AI Visibility(`total_score`·`track1_score`·`track2_score`·`unified_score`) 모든 파생 숫자는 텍스트 레이블로만 노출. 대시보드·타임라인·가이드 전 컴포넌트에 적용됨.

- **금지**: `72점`, `track1Score: 68`, `total_score.toFixed(1)점` 등 AI Visibility 숫자 직접 노출 — HeroCard·DualTrackCard·ChannelScoreCards·**CompetitorTimeline**·**BriefingTimeline** 모든 컴포넌트에 적용
- **티저 UI 더미 숫자도 금지**: 잠금(Lock) UI 뒤에 표시하는 샘플도 임의 숫자(`43점`·`51점`·`78점` 등) 사용 금지 → `--` 또는 의미 텍스트로 대체
- **허용**: `"양호"`, `"보통"`, `"주의 필요"`, `"업종 상위권"`, `"AI 검색 노출 개선 중"` 등 의미 레이블; 진행률 바(%) 시각 보조 — 단, 숫자 레이블 없이
- **구현 완료 파일 (텍스트 레이블 적용됨)**:
  - `DualTrackCard.tsx` → `getScoreStatusLabel()` (양호/보통/주의 필요)
  - `DashboardHeroCard.tsx` → `getStage()` (AI 검색 노출 양호/개선 중/미흡/시작 전)
  - `BriefingTimeline.tsx` → `getScoreTextLabel()` (툴팁·마일스톤·변화 방향 텍스트 — 2026-06-17 수정)
- **미수정 파일**: 현재 없음 (2026-06-17 기준 전체 적용 완료)
- **이유**: 낮은 점수 숫자가 사용자에게 불안감을 주고, 절대 수치보다 상대적 위치(업종 평균 대비, 단계)가 더 유용하다는 UX 판단
- **주의**: 점수 수치 추가를 "개선"이라고 판단하지 말 것 — 의도적 설계 결정임

### 작업 시 피해야 할 패턴
- `except Exception: pass` — 반드시 `warning` 로그 남길 것
- `SELECT *` — 필요 필드만 명시 (성능)
- `ilike("%region%")` — 가능하면 `ilike("region%")` 접두어 매칭 (인덱스 활용)
- 텍스트 `text-xs` — `text-sm` 이상 권장 (가독성)
- 페이지 `p-8` 고정 — `p-4 md:p-8` 반응형 패딩

---

## 최근 업데이트 (2026-10-10 이전 상세 내역은 `docs/changelog_archive.md` "CLAUDE.md 최근 업데이트 이관(2026-10-10 / 10-27 / 10-30)"로 이관)

- **2026-10-29 밤 구독 자격 기준 통일 (서버 배포·md5 일치, 테스트 772개, push 미실행)**: 네이버·AI 스캔 비용이 드는 정기 잡 3곳이 서로 다른 기준을 써 "해지해도 만료일까지 서비스 유지"(설정 화면 안내·`get_user_plan`)와 어긋났다 — 야간 스캔은 active·grace_period, 순위 잡·내 가게 통계는 active만. 이제 셋 모두 `scan_scheduling.entitled_sub_rows`(경쟁사 크롤 필터와 같은 `entitled_user_ids`)를 쓴다(`tests/test_entitlement_shared_rule.py`, 변이 검증). 현재 데이터에는 영향 없음(해지 2건 모두 만료일 경과, 읽기 전용 계산). **알림·리포트 발송 잡 약 17개는 의도적으로 제외**(해지 사용자에게 알림을 계속 보낼지는 다른 결정). 사용자 몫 네이버 4페이지(`naver_place_resolver`)는 사업장 등록 화면의 가게 찾기(`/business/resolve-place`, 사용자당 시간당 10회·결과 캐시) 경로로 확인 — 낭비가 아니라 정상 사용자 요청.
- **2026-10-29 밤 경쟁사 정기 크롤의 불필요한 네이버 접속 제거 (서버 배포·md5 일치, 테스트 770개, push 미실행)**: ①**측정**: 이날 서버의 네이버 페이지 사용 59건 중 경쟁사 크롤이 48건(81%)이었고, 그 8곳은 전부 **만료된 해지 계정(5곳, `end_at` 경과 → 앱 기준 free, free의 경쟁사 한도는 0)과 관리자 계정(3곳)**의 경쟁사였다. `competitor_place_sync_job`만 구독 필터가 없었다(야간 스캔·순위 잡·내 가게 통계는 이미 활성 구독만). ②**수정**: `scan_scheduling.entitled_user_ids`(`get_user_plan`과 같은 기준: active·grace_period·`end_at`이 남은 해지 + 관리자)로 크롤 대상을 거른다. 필터 조회가 실패하면 전체를 처리(정기 갱신이 멈추는 쪽이 더 나쁨). 재구독하면 오래된 순으로 다시 채워진다. 변이 2종 검증. 라이브 확인은 내일 03:30 로그의 "서비스 기간이 끝난 계정 제외" 줄과 `/admin/naver-access`의 경쟁사 출처 페이지 수(기대: 약 48→18)로 — 이 잡은 네이버에 접속하므로 서버에서 임의 실행하지 않았다. ③**기준 정정**: 하루 600건 상한은 네이버의 실제 차단 기준이 아니다(코드 주석·문서가 "실측 근거 없는 제안값", 처음 250은 테스트 데이터 추정 하루 요청의 3배 여유로 정함, 10-27 단위 변경 때 같은 여유로 600). 10-27 IP 차단의 유력 원인도 총량이 아니라 짧은 시간에 몰린 연속 호출(65~70페이지, 1~2분)이었고 이것도 확정은 아니다. 따라서 "300곳 = 상한의 2.4배" 같은 문장은 우리 상한 대비 상대적 크기일 뿐 네이버 허용량이 아니다. **미확인**: 네이버의 실제 기준, 위 필터의 라이브 효과, `naver_place_resolver`가 쓰는 사용자 몫 4페이지의 경로.
- **2026-10-29 밤 경쟁사 최초 채우기를 서버 큐로 (C-2, 서버 배포·md5 일치, 테스트 764개, push 미실행)**: 이전에는 브라우저 탭이 경쟁사를 하나씩 `sync-place`로 불렀고, 새로고침 한도(10분 2회)에 걸리면 탭이 남은 시간을 세며 기다려 **탭을 닫으면 그 자리에서 멈췄다**(5곳이면 최대 20분). 이제 `POST /api/competitors/{biz_id}/sync-queue`가 평점 없는(방금 1시간 안에 확인한 곳 제외) 경쟁사를 서버 백그라운드(`services/competitor_sync_queue.py`)에서 순서대로 처리하고 `GET`이 진행 상태를 준다(DB 접근 없음, 화면이 4초마다 읽음). **새 네이버 접속 경로가 아니다** — 경쟁사마다 기존 수동 새로고침 본체 `_sync_one_competitor`(개별 엔드포인트도 이것을 부름)를 그대로 호출하므로 사용자별 한도·공유 캐시·회로·속도·일일 상한이 모두 그대로이고, `scripts/naver_load_model.py`는 변경 없음. 동작: 한도(429)면 `Retry-After`(상한 20분)만큼 쉬고 같은 경쟁사부터 최대 3번, 네이버 쪽 사정(503)·한도 반복이면 남은 곳에 요청을 보내지 않고 멈춤(`paused`, 저장값 유지, 실패로 세지 않음), 플레이스 못 찾음(422)은 실패로 세고 계속, 삭제된 곳(404)은 제외. 사용자당 큐 1개(한도를 다투지 않게)·동시 5개·한 번에 20곳 상한, 남의 큐는 보이지 않음. **상태는 프로세스 메모리**라 서버를 재시작하면 큐가 사라진다(화면은 처음 상태, 남은 곳은 다시 누르거나 정기 갱신이 채움). 화면(`CompetitorsClient.tsx`): 진행 중에 탭을 닫았다 다시 열면 이어서 보여 주고, 끝나면 `router.refresh()`. 변이 5종 검증(`tests/test_competitor_sync_queue.py` 14개), 임시 계정 라이브 검증(가짜 경쟁사 2곳·공식 검색 API만 사용 → running→done, 남의 사업장 404·다른 사용자 idle, 계정 삭제 검증 남은 행 0). **미확인**: 실제 한도(429)·차단(503) 상황에서의 서버 큐 동작과 화면 문구(라이브에서 만들 수 없음), 실제 로그인 화면 렌더링.
- **2026-10-29 밤 네이버 측정 실패 후 1회 재시도 (C-1, 서버 배포·md5 일치, 테스트 750개, push 미실행)**: 정기 스캔에서 네이버 측정이 실패하면(차단·캡차·일일 상한·접속 실패) 스캔하지 않는 날이 많은 플랜(Basic 주 2회·창업 주 1회)은 다음 정기 스캔까지 며칠 "확인 전"으로 남았다. 이제 **스캔하지 않는 날이어도 직전 스캔의 네이버 측정이 실패했다면 하루 뒤 한 번만** 기존 `daily_scan_all` 경로로 다시 스캔한다(`scan_scheduling.naver_retry_due`: 직전 스캔이 오늘이 아니고 36시간 이내·네이버 접속이 지금 막혀 있지 않음·연속 실패 1회 이내=재시도도 실패하면 정기 일정 대기). 새 측정 코드가 아니라 같은 경로·같은 가드(쿨다운·속도·일일 상한·`@naver_batch_job`)라 새 접속 경로가 아니고, 재시도 스캔은 `AEOLAB_SCAN_01`(스캔 완료) 알림을 한 번 더 보내지 않는다. Pro·Biz는 스캔하지 않는 날이 없거나 경량 스캔을 하므로 해당 없음. AI 호출 비용은 정상 스캔 1회분(실패 에피소드당 최대 1회). `scripts/naver_load_model.py`에는 반영하지 않았다 — 모델은 실패가 없는 정상 상태 가정이고 재시도는 실패 에피소드당 스캔 1회가 정상 스캔을 앞당겨 대체하는 정도. **구현 중 실수 1건**: 헬퍼를 끼워 넣다 `@_naver_batch_job`이 헬퍼로 옮겨 가 야간 스캔이 배치 몫 보호를 잃을 뻔했고, 즉시 되돌리고 구조 테스트로 고정(`tests/test_naver_retry.py`). 현재 데이터 기준 재시도 대상 0곳(읽기 전용 확인), **라이브 동작은 실제 차단이 일어나야 확인 가능(미확인)**.
- **2026-10-29 밤 동시 접속 재측정 + 토큰 검증 캐시 (git 아래 커밋, 서버 배포·md5 일치, 테스트 731개, push 미실행)**: ①**재측정(운영 서버 내부 포트, 임시 계정 생성·삭제 검증, 남은 행 0)**: 대시보드 동시 5/10/20/30/40/50명 → 2.7/1.1/12/39/24/42초(1회차), 서버 CPU 1~3%. 같은 조건 재측정은 5명 13초·2초처럼 **같은 인원에서도 2~13초로 흔들려** 개선 전후를 구분할 수 없다. ②**시간대별 1초 간격 측정(150초)**: PostgREST·Auth·백엔드 `/health`가 **자주(7분 관측 중 3분) :44~:48초 부근에 동시에 1~1.7초 멈춘다**("매분"은 부정확했음 — 사전 메모리의 ":45 정렬"과 일치). 동시 인원이 늘면 그 구간에 요청이 쌓여 수 초~수십 초로 증폭. ③계층별: PostgREST는 서비스키·사용자 JWT(RLS) 모두 동시 80에서 0.1~1.5초, **Auth `/auth/v1/user`가 가장 불안정**(동시 10명 2.7초·80명 6.4초) → 8월의 "Supabase 무료 티어 큐잉, 안전선 30명" 결론은 **'동시 인원 N명 절벽'이 아니라 '간헐적 멈춤 + 대기열'로 정정**. **원인 위치 확정(2026-10-29 저녁)**: 서버와 로컬 PC에서 같은 6분을 동시에 재니 서버의 멈춤 8회가 모두 로컬과 2초 이내로 겹침(8/8) → 우리 서버·네트워크가 아니라 Supabase(또는 그 앞단) 쪽. 우리 쪽 정기 작업도 기각: 스케줄러 최소 간격 10분·서버 cron은 하루 4회 백업+10분 단위 sysstat뿐이고, `pg_cron` 미설치(`cron.job` 없음). 남은 확인: Supabase 대시보드 Reports(DB CPU·Disk IO 예산)에서 같은 시각 그래프. ④**백엔드 `get_current_user` 토큰 검증 60초 캐시 + single-flight**(`middleware/plan_gate.py`, 토큰 해시 키·토큰 `exp` 상한·실패 미캐시·취소 안전, 변이 4종 검증): 인증 필요한 요청마다 Auth를 다시 부르던 낭비 제거 — **효과는 측정으로 입증하지 못했다**(변동이 효과보다 큼). 로그아웃·권한 회수는 최대 60초 늦게 반영.
- **2026-10-30 Gemini 비유도 전환·무료 등급 운영 (git `32619bc`·`019ba7b`·`e914bd0` + 검증용 포함 옵션, 서버 배포·md5 일치, 테스트 840개, push 미실행)**: ①Gemini도 ChatGPT처럼 **비유도 `sample_recommend`**(가게명 미포함, 실패 샘플 분모 제외, 키 호환)로 전환 — `sample_50/100`·`multi_scanner.py:143`이 위임, 유도형 `sample_10`·`single_check*`는 범위 밖. ②**새 Google 프로젝트 키는 `gemini-2.5-flash`가 404**(신규 사용자 제공 종료), `gemini-2.0-flash`는 전면 종료(블로그 주제 생성 `guide.py`도 이 모델을 직접 불러 깨져 있었음 → `GEMINI_MODEL` 따라가도록 수정). 모델은 `GEMINI_MODEL` env(기본 2.5, 서버는 `gemini-3.1-flash-lite`), 단가표에 없는 모델은 비용 None. ③**무료 등급 한도(실측)**: flash-lite 일 500회·분당 약 15회(동시 10개 몰면 429, 4초 간격이면 성공), `gemini-3.6-flash` 일 20회, `gemini-3.8-flash`는 20초 제한에 타임아웃 → 프로세스 전체 호출 간격 `GEMINI_MIN_INTERVAL`(서버 4.5초, 기본 0=불변)을 6개 호출 지점 앞에 적용(100표본 약 7~8분, 24표본 24/24 실측). 하루 호출은 최근 7일 100~200회. 무료 등급은 Google이 입력·응답을 제품 개선에 쓸 수 있음(약관) — 프롬프트에 개인정보는 확인되지 않았으나 방침 명시 여부는 미확인. **Gemini 프롬프트에 개인정보(전화·이메일·결제·사용자 입력 원문·리뷰 내용)를 넣지 않는다(10-30 사용자 결정)** — 무료 등급은 입력이 제품 개선에 쓰일 수 있고 개인정보처리방침 위탁 표에 AI 업체가 없음(전송 내용: 검색어·사업장명·AI 응답 발췌 + Pro+ 조건 검색의 소개글 초안 400자·키워드 — 후자는 `scrub_personal`로 전화·이메일·사업자번호를 제거. 10-30 점검 전 '검색어·공개 사업장명·AI 응답 발췌뿐'이라 한 설명은 이 경로를 놓친 오류였음), 새 기능이 이를 바꾸면 방침·국외 이전 고지를 먼저 검토. **10-30 점검에서 플래그 무관 고정 문구 7곳 추가 정리**(`demo`·`score-guide`·체험 결과·`BasicTrialBanner`·`FactEvidenceSection`·`FirstScanBanner` — 'Gemini·ChatGPT 각 100회' 등, `lib/featureFlags.ts`의 `aiEach`·`AI_COUNT_N` 사용, 정식 구독 '각 50회'는 코드(Basic=`scan_all` 100회)와 달라 100회로 정정, 가입 후 체험 50회는 코드와 일치해 유지). 새 Gemini 측정 문구는 반드시 이 헬퍼를 쓸 것. 이후 공개·가입·체험·랭킹·블로그 분석 등 14곳 추가 정리(Pro 경량 스캔 설명 '나머지 날: Gemini+네이버만'은 코드(`scan_basic`=Gemini·ChatGPT·네이버·Google 각 50회)와 달라 정정, 공개 공유 페이지는 Gemini 노출 0회를 측정 실패와 구분할 수 없어 양수일 때만 표시 — `report.py` `gemini_frequency`가 0·NULL이면 None). **경쟁사 AI 노출 판정을 비유도 표본 목록 대조로 전환(10-30, 사용자 승인)**: `services/competitor_ai_exposure.py` — 가게 이름을 직접 묻던 호출 4곳(`scan.py`×2·`jobs.py`·`competitor.py`)을 스캔의 `place_counts`(표본별 추천 이름) 대조로 교체, 메모리에선 전체(상한 600), 저장·응답 직전 `compact_for_storage`로 상위 40개 압축(전체 저장 시 스캔당 약 29KB). 새 `gemini_result`·`chatgpt_result` 저장 지점은 반드시 이 함수를 거칠 것(구조 테스트가 막음). **경쟁사 페이지 순위·막대는 내 가게도 경쟁사와 같은 공식으로 비교**(`services/compare_score.py`, 갭 응답 `my_compare`, 입력 부족 시 None→종합 점수 폴백+안내; 실측: 홍뮤직스튜디오작곡교습소 종합 22.4→비교용 46.8, 순위 5→4위; 대시보드 종합 점수·성장 단계는 불변). **검색 켠 ChatGPT 격차 시험**: JSON 전용 판은 무효(일반 이름·자리표시자), 자연 질문+이름 추출 판(`scripts/pilot_search_vs_memory.py`)은 어니언 기억 1/4·검색 0/4, 소도시 4곳 모두 0/4 — 기억 모드가 체계적으로 과소평가한다는 징후는 없음(표본 4·API≠앱, V1 수기 비교 유지). **Track1 `ai_briefing_score`를 이번+직전 측정 성공 스캔 2건(14일 내) 평균으로 평활화**(`services/briefing_smoothing.py`, 야간·수동 스캔이 `attach_prior_naver`로 이전 스캔을 붙임, 이전 없음·실패 스캔·시뮬레이션은 기존 동작) — 실측 이력 재현에서 브리핑 점수 일별 변화 합 5600→2453(44%), 단계 경계 넘나듦은 전체 점수 이력의 18%(54/293)였음. 지연 대가: 노출 급락도 3스캔에 걸쳐 반영. 남은 유도형(질의 상세·조건 검색·액션 재스캔·소개문 보강)과 설계: `docs/gemini_guided_calls_unguided_conversion_design_2026_10_30.md` §6. ④`GEMINI_MEASUREMENT_LIVE`는 **false 유지 — 사용자 결정(10-30): 무료 한도를 다 쓴 뒤에 true 복귀** — 다음 야간 스캔에서 `gemini_result.probe=recommend_v1`·`sample_size`≈100 확인 후 true 복귀·재빌드. 경량 모델의 측정 특성(점수 영향)은 비교 시험 전 미확인. ⑤`NIGHTLY_SCAN_INCLUDE_BIZ_IDS`(기본 빈 값=불변)로 관리자 소유 검증용 사업장을 야간 스캔에 포함 가능(`scan_scheduling.exclude_admin_businesses`) — 네이버 접속량이 늘므로 켜는 것은 사용자 결정, `scripts/naver_load_model.py`는 미반영. ⑥**사용자 증가 대비(호출 집계는 스캐너 전 지점+블로그 주제 생성 기록, 대기열 상한 `GEMINI_MAX_WAIT_SEC` 120초 초과 호출은 측정 안 됨으로 포기, 수동 빠른 스캔 `sample_10`도 비유도 전환)**: `services/ai_capacity.py` — 최근 24시간(롤링) Gemini 호출 수 vs `GEMINI_DAILY_LIMIT`(기본 500), 70/90/100% 도달 시 운영자 메일(`ai_capacity_check_job` 매일 09:50, 7일 중복 억제, 결제·스캔은 막지 않음), `/admin/naver-access`의 `ai_capacity`. `services/ai_scanner/probe_cache.py` — **질의 결과 공유 캐시**(비유도 프로브는 질의에 사업장명이 없어 같은 지역·업종·키워드면 표본 공유 가능, 호출량이 구독자 수가 아니라 질의 조합 수에 비례): 서버 `.env` `AI_PROBE_CACHE_TTL_SEC=21600` + 재시작으로 켬(기본 0=끔, ChatGPT·Gemini `sample_recommend`만 적용, 성공 표본만 저장, 모델이 키에 포함). 켜면 같은 질의를 TTL 안에 재측정해도 같은 표본이 재사용되므로 "각 N회 독립 측정" 표현 금지. 유료 결제는 기존 계획(유료 구독자 발생 시) 유지. 선불 크레딧 방식 키는 잔액 0이면 429("prepayment credits are depleted"), 무료 키로 교체해 사용 중.
- **2026-10-30 네이버 독립·AI 노출 설계 + 구현 (git `601d1cd`·`475ca3a`·`3990333` + 문서 커밋, 서버 배포·md5 일치, 테스트 810개, push 미실행)**: 최종 설계서 `docs/naver_independence_design_v2.0_final_2026_10_29.md`(이전 2개 문서는 과정 기록). 결론: 설계는 **노출을 올리는 기능이 아니라 측정·정확도·연속성**이고, 새 비유도 프로브(`recommend_v1`) 기준 유료 스캔 5개 가게 중 ChatGPT 노출은 1곳뿐(표본 작고 관리자·테스트 위주). ①**S-safe**: `GOOGLE_SCANNER_BACKEND` 기본값을 비워 미설정 시 `google.com` 직접 접속 대신 `error=backend_not_configured`(점수에서는 `_is_google_unmeasured`로 제외). ②**D 채널 정보 일치 점검**(Basic 이상, 하루 2번·Pro 3·Biz 5): 입력값 vs 카카오·네이버(공식 지역검색 API만)·구글 지도(Places API New) 이름·주소·전화·웹사이트 결정적 비교, 대시보드 `ChannelConsistencyCard`. 구글 응답은 **약관상 저장하지 않고**(`place_id`만 `businesses.google_place_id`), 사용 횟수만 `consistency_checks`(SQL 실행 완료, RLS 확인). 네이버 지역검색 API는 전화번호를 주지 않고(4개 질의 16건 전부 빈 값), 구글은 전화 미등록 가게의 필드를 응답에서 뺀다 → "다름"이 아니라 "확인 못함". 프랜차이즈 포함(`is_franchise`는 네이버 AI 브리핑 자격 전용). ③**K 점검**(`docs/k_naver_unmeasured_score_check_2026_10_30.md`): `smart_place_completeness`·`local_map_score`는 "읽은 적 없음" 제외 규칙이 없어, 네이버를 못 읽은 신규 가게는 남는 가중치 25~43%만으로 모두 "시작 전" — **후보 결함 → 같은 날 수정(스마트플레이스·지도 "읽은 적 없음" 제외 + coverage 40% 미만이면 성장 단계 상승 알림 억제, 테스트 13개)**. ④**V1 측정 타당성 검증**(`docs/v1_measurement_validity_protocol_2026_10_30.md`): 검색을 켠 실제 AI 답변 vs 우리 기억 모드 수기 비교, **사용자 입력 대기**. ⑤외부 사실: 네이버 블로그·카페 `robots.txt`는 GPTBot·OAI-SearchBot·ClaudeBot 등 AI 봇 전면 차단(브런치는 학습 봇만 차단·검색 봇 허용, 당근은 업체 프로필 경로만 AI 검색 봇에 허용), Gemini 검색 접지는 현행 약관상 결과 저장·분석 금지(구글 문의는 하지 않기로 결정 → 접지 기반 기능 제외), Custom Search JSON API는 신규 종료·2027-01-01 전면 종료, ChatGPT 검색엔진 비율은 비공개라 `/guide/chatgpt-search`의 "구글 검색 중심" 단정 문구를 완화(10-30). 이 대화에서 철회된 제안: `llms.txt`·QR 스캔 계측·리뷰 격차 추적·속성 질의 점검(바닥 효과)·유튜브 점검. 구글 접속 원칙은 작업 중요 지침 8번 하위에 추가함. 구글 로고는 공식 에셋(높이 18px)으로 반영. 미확인: 로그인 상태 대시보드 화면, 구글 콘솔 실제 청구 단계, 로고 규정의 구글 측 해석.
- **2026-10-29 밤 차단 보완·사용자 안내 (git `70c3bfd` + 프론트 배너, 서버 배포·md5 일치, 테스트 716개, push 미실행)**: ①**야간 스캔의 차단 `break` 제거** — 캡차 연속 2회에 루프를 끊어 남은 사업장의 글로벌 AI 스캔·점수·알림이 그날 통째로 빠지고 현재 사업장의 이미 끝난 AI 결과(API 비용)도 저장 전에 버려지던 것. 스캐너가 캡차를 만나면 검색 쿨다운(`report_search_block`)이 열려 이후 네이버 측정은 요청 없이 `naver_search_cooldown`(측정 불가, 점수 제외)으로 끝나므로 break는 불필요했다. 이제 운영자 알림 1회 후 스캔 계속(`tests/test_naver_block_keeps_scanning.py`). ②**`GET /api/status/naver`**(인증 불필요, 읽기 전용, `services/naver_status.py`): 쿨다운/일일 한도/복구 확인 중을 `ok·delayed·recovering`과 예상 재개("약 3시간 뒤"·"내일")로 — 한도·횟수·차단 단계 등 내부 수치는 내보내지 않는다(테스트가 검사). ③대시보드 레이아웃에 `NaverStatusBanner`(정상이면 아무것도 안 보임, 5분마다·탭 복귀 시 갱신, 상태 조회 실패해도 화면은 그대로). ④수동 새로고침 503이 "잠시 후"만이 아니라 쿨다운 중에는 예상 시점을 안내. **미확인**: 배너 실제 렌더링(로그인 필요 — 서버에서 임시 상태 파일로 문구만 재현), 실제 차단 상황에서의 동작.
- **2026-10-29 저녁 용량·알림 후속 (git `7cbc6b3`·`8072c1f`·`5c20dd2`, 서버 배포·md5 일치, 테스트 694개, push 미실행)**: 사용자 결정으로 ①**슬롯 분산 켬**(서버 `backend/.env` `NAVER_SCAN_SLOT_SPREAD=true`, 백업 `/root/backend_env_backup_20261029_slot_spread`; 8곳 기준 요일별 최대 8→7곳, 전환 첫 주에는 가게별 패턴이 바뀌어 스캔 간격이 하루 이틀 흔들릴 수 있음) ②**수동 새로고침 10분 한도 3→2회**(`competitor.py` `_MANUAL_SYNC_BURST_CAP`) ③**성장 단계 상승 알림 히스테리시스**(`stage_names.upgrade_alert_allowed`: 새 단계 하한+3점 이상이고 최근 28일에 하한+3점을 넘은 적이 없을 때만, 확인 실패 시 보내지 않음; `GROWTH_ALERT_BASELINE_DATE` 1회성 억제와 별개로 항상 적용) ④**용량 절감 레버를 코드에 준비하되 켜지 않음**: `NAVER_RANK_MOBILE_ONLY`(PC 순위 미측정), `COMPETITOR_REFRESH_WEEKS`(2·3·4, 기본 2=현재값, `scan_scheduling.refresh_params`가 TTL·pacing 단일 출처), AI탭은 기존 `NAVER_AI_TAB_ENABLED`·`NAVER_AI_TAB_MAX_QUERIES`. 8곳은 용량의 약 5%라 줄여도 얻는 것이 없고 사용자에게 보이는 기능만 잃으므로 대응표(`naver_capacity.PLAYBOOK`) 임계에서 `.env` 한 줄로 켠다 — **경쟁사 4주는 공개 문구 '2주마다' 4곳도 함께 고쳐야 하고, 플랜별 키워드·경쟁사 한도 축소는 환경변수 레버가 없다(PLAN_LIMITS·plans.ts·요금제·비교표·약관 동시 수정)**. ⑤**키워드 순위 측정이 프록시 범위("search")를 따르도록 연결**(`naver_keyword_rank.py`; 이전엔 어떤 프록시를 설정해도 서버 IP 직접 접속) — `NAVER_PROXY_LIST`가 비어 있어 **지금은 동작 그대로, 프록시 미구매·미적용**(법적 자문은 사용자가 보류 중인 사안).
- **2026-10-29 오후 인기 가게 저평가 원인 3건 수정 (git `00dbcde`·`f8edbe8`·`df6a405`, 서버 배포·md5 일치, 테스트 658개, push 미실행)**: ①**정기 스캔(`daily_scan_all`, `jobs.py`)이 `naver_data` 없이 `calculate_score`를 호출해 블로그 항목(Track1 `blog_crank` 10%·Track2 `online_mentions` 20%)이 항상 최하점이었음** — 수동 스캔은 공식 검색 API 가시성을 넘겨 같은 가게라도 점수가 달랐다. 이제 정기 스캔도 `get_naver_visibility_multi`(공식 API, Playwright·차단 무관)를 조회해 `build_naver_data`(`naver_visibility.py`, 수동 스캔과 공용 병합)로 넘긴다. 실측(읽기 전용): 하라식당 정기 스캔 통합 55.8→68.0(개선 중→양호), 어니언 성수 41.8→50.3. ⚠️ 다음 야간 스캔부터 점수가 오르므로 단계 상승 비교가 실제 성장 없이 생긴다 — **`GROWTH_ALERT_BASELINE_DATE=2026-10-30`(서버 `backend/.env`, 사용자 결정으로 1회성 억제)**: 이전 기록이 이 날짜보다 이르면 `AEOLAB_GROWTH_01` 상승 알림을 생략(`stage_names.prev_scored_before_baseline`, git `1f4946e`), 보정 후 첫 스캔이 기록되면 자동 재개되니 정리 불필요. ②블로그 조회 실패(`_get`이 오류를 `{}`로 삼킴 → `blog_mentions=0`)를 "블로그 없음"이 아닌 "모름"으로: `blog_checked=False` 표시 → v3.1·v3.2 Track1에서 `blog_crank`, Track2에서 `online_mentions`를 제외하고 재정규화(키가 없는 기존 데이터는 이전과 동일). ③별점 출처 오표기 2건: 크롤이 별점을 못 읽을 때 사용자 입력 별점을 "확인한 값"으로 바꾸던 것(`naver_place_stats.py`), 사업장 등록(POST)이 입력값의 출처를 기록하지 않던 것(`business.py`). 변이 검증 완료. **미확인**: 저장된 스캔에는 블로그 입력이 보존되지 않아 과거 점수의 정확한 소급 재계산은 불가. 핸드오프의 "현재 코드 재계산 48.8/32.5"도 블로그 입력이 빠진 값이라 낮게 나온 것.
- **2026-10-29 용량·신뢰·결제 정리 (git `fa0d6f5`~`5099525`, 서버 배포·md5 일치, 테스트 628개, push 미실행)**: ①**용량 판단**: 수용량은 서버 사양이 아니라 **네이버 차단 위험**이 정한다(일 600·속도 기준은 10-27 IP 차단 사건 하나에서 나온 보수적 제안값, 실제 기준 미확인). 현재 구조의 현실적 한계는 활성 사업장 **약 35~50곳**(모델), 대시보드 동시 접속 약 30명(08-23 측정, 재측정 안 함). 100곳부터는 플랜 한도 축소 등 사용자 결정이 필요하고 300곳은 튜닝만으로 불가 — `python scripts/naver_load_model.py --levers 300`, 단계별 대응표는 `backend/services/naver_capacity.py` `PLAYBOOK`(용량 알림 메일·`/admin/naver-access`의 `capacity.next_steps`), 문서 `docs/naver_capacity_300_playbook_2026_10_29.md`. ②**접속 줄이기**: AI탭 질의 수 `NAVER_AI_TAB_MAX_QUERIES`(1~4, 기본 4=현재), 수동 스캔 `quick`·`full`도 당일 사전 스캔(GitHub 야간 워크플로 `naver_scan.yml`, 매일 다른 IP)이 쓸 만하면 서버 브리핑 접속 생략(`services/naver_prescan.prescan_usable`, 야간 스캔과 같은 규칙). ⚠️ **대시보드 "지금 측정"(`/api/scan/stream`)은 사전 스캔을 쓰지 않는다**(질의 형태가 달라 점수 입력이 바뀔 수 있어 미착수). 사전 스캔의 GitHub IP 접속은 법적 검토 대상(프록시와 같은 성격). ③**수동 새로고침 보호**: 경쟁사별 1시간·사용자별 10분 3회/1시간 15회, 네이버 쪽 거절(속도 제한·쿨다운·일일 상한)은 500이 아니라 503+한도 환급. ④**계측**: `services/naver_usage_meter.py`가 사용자 요청(정기 잡 아닌) 접속 페이지와 수동 스캔 횟수를 센다(`/admin/naver-access`의 `usage`, 표본 없으면 None). 한도 일별 이력이 서버에 한 번도 안 생기던 결함 수정(배포가 잦아 자정을 넘기는 프로세스가 없었음). 첫 이력 확인은 2026-10-30 새벽. ⑤**공개 문구**: 스캔·순위 요일 표기("월·목" 등) 프론트 19곳+FAQ 2행 제거, "2주마다"→"약 2주 간격", how-it-works 순위표의 "매일 04:30" 오표기 정정. ⑥**신뢰**: 체험 결과 히어로도 플레이스 점검 실패 시 "일부 항목 확인 전"(대시보드와 같은 규칙, 라이브 미확인). ⑦**결제**: 구독 `start_at`이 시간대 없는 KST로 저장돼 9시간 뒤로 기록되던 결함 수정(`utils/kst.py`, 알림 잡은 한국 날짜 비교). **Gemini 무료 티어 한도(하루 100회 중 92~97회 실패)·Claude 크레딧 충전은 사용자 결제 대기** — 결제 후 `gemini_result.sample_size`가 100 근처인지로 확인.

- **2026-10-28 경쟁사 크롤 예산이 캐시 적중을 반영하도록 개선**: 캐시는 플레이스 ID 기준 공유(`competitor_place_crawler.py:36`, 적중하면 쿼터·회로·속도 모두 안 쓰고 첫 줄에서 반환)인데 일정 선택(`build_stale_items`)은 경쟁사 행마다 6페이지를 무조건 더해 겹침이 많을수록 예산을 과대 계산했다. 이제 `place_cache_fresh_ids`(읽기 전용·TTL-6시간 마진)로 **지금 캐시가 유효한 행은 0페이지**, 단 **pacing 한도는 할인 전 합(`pages_full`) 기준**(할인 후 합으로 잡으면 한도가 같이 줄어 처리량이 막힘 — 시뮬레이션으로 확인한 함정). 시뮬레이션(300곳·겹침 약 40%, 예산 252): 갱신 간격 최대 29일→17일·14일 초과 99%→16%, 실제 접속은 예산 이내. 겹침이 없으면 이전과 동일(테스트). 20곳 규모는 변화 없음. **실제 겹침 비율은 구독자가 없어 미확인** — `place_cache_snapshot`의 일별 적중률로 실측할 것. 사업장 300곳·겹침 0%이면 여전히 21일 간격(예산 한계)이라 그 경우는 문구 수정·상한 확대(사용자 결정). 변이 4종 검증, `tests/test_competitor_stale_first.py`.
- **2026-10-28 경쟁사 정보 갱신 주기 1주→2주 (사용자 결정, 문구 동시 수정)**: 캐시 TTL 6.5일→**13.5일**(`COMPETITOR_PLACE_CACHE_TTL_SEC` 기본 1166400, 서버 `.env`에 덮어쓰기 없음 확인), `select_stale_first` pacing 6→**13일**(`scan_scheduling.COMPETITOR_REFRESH_TTL_SEC`·`COMPETITOR_PACE_DAYS`, 14일이 아니라 13.5/13인 이유는 14일째 아침에 못 들어와 하루씩 밀리기 때문). **사용자가 기다리는 경로(신규 경쟁사 등록 2곳·창업 리포트)는 `INTERACTIVE_MAX_AGE_SEC`(6.5일)로 좁혀** 최대 2주 옛 값을 보이지 않게 했고, 수동 새로고침은 원래 1시간(`max_age_sec=3600`). 변화 감지(`detect_competitor_changes`, 월 04:00)는 매주 현재값과 직전값을 비교해 직전값을 덮어쓰는 구조라 2주 데이터에서도 정상(알림은 사업장별로 갱신된 다음 월요일에 나감, ≥5건 변화 기준은 2주 누적이 됨). `weekly_competitor_sync_job`은 등록되지 않은 죽은 코드(변경 없음). 문구는 **크롤 데이터에 해당하는 4곳만** 수정: `demo/page.tsx` "2주마다 자동으로 모읍니다", `PlanGate.tsx` "경쟁사 정보를 2주마다 자동 추적", `onboarding/page.tsx` "경쟁사 변화 자동 알림 (정보는 2주마다 갱신)", `CompetitorsClient.tsx` 안내. "경쟁사 비교"(AI 스캔 기반, 주 1~3회)·`GuideClient` 사장님 할 일 문구는 해당 없어 그대로. 시뮬레이션(20곳)에서 정상 간격 14일·일 최대 36페이지, 신규 5곳 추가 시 기존 곳이 최대 17~19일까지 밀림(한 주기를 통째로 건너뛰면 27일+라 상한 20일로 테스트 고정). 용량 모델 20곳 주간: 키워드 순위 256·스캔 184·경쟁사 180·통계 40 = 660페이지(오늘 작업 전 1,032), 상한 초과 시점은 경쟁사 분산 시나리오 기준 배치 몫 40곳/전체 50곳(코드 기준 모델, 실측 아님). 위 "경쟁사 크롤이 다시 최대 항목" 서술은 이 변경 이전 값. `tests/test_competitor_stale_first.py`(주기 상수 일치·등록 경로 제한 테스트 포함), 변이 3종 검증.
- **2026-10-28 키워드 순위 잡 주기 조정**: Pro·창업·Biz·Enterprise 순위 측정을 매일→**월·수·금 04:30**(스캔 요일과 동일, Basic은 월 1회 그대로). 사업장 30%가 순위 부하의 75%였고 20곳 모델 기준 주간 순위 448→256페이지(-43%, 전체 -19%, 순위 비중 43%→30%, 경쟁사 크롤 43%가 다시 최대). 공개 문구에 순위 주기 약속은 데모의 "주 1회"뿐이라 충돌 없음, 저장 순위를 읽는 신선도 기준은 7일·30일이라 영향 없음. 잡 id·함수명의 "daily"는 호환용으로 유지, 카나리 점검(04:50)은 독립 측정이라 매일 유지. `tests/test_keyword_rank_schedule.py`가 일정을 고정(변이 검증 완료). 검색어 단위 공유 캐시(6시간, 메모리) 적중률은 모델 미반영 — 첫 유료 구독자부터 `/admin/naver-access`의 `rank_card_cache`와 출처별 일별 기록으로 모델 가정(키워드 수·경쟁사 수·중복률)을 실측으로 교체할 것. 추세 점이 주 3개로 성겨짐(순위 급변은 최대 2일 늦게 보임).
- **2026-10-28 후반 네이버 접속 정리 (git fc85b90 + 경쟁사 크롤 축소, 서버 배포·md5 일치, 백엔드 474개 통과, push 미실행)**: ①**별점 낮은 리뷰 알림 잡 제거**(사용자 결정 — 공개 약속 없음·최대 소비처·알림 빈도 신뢰; 파서·조회·순서 회전·발송 함수·테스트·용량 모델 항목 삭제, 승인 템플릿 `AEOLAB_ALERT_01`은 유지, 리뷰 수는 기존 주 1회 `weekly_my_place_stats_job` 그대로). 아래 "별점 잡 수리" 서술은 제거 전 기록. ②**경쟁사 크롤 `_run_place_crawl` 페이지 이동 최대 12→6회**(탭마다 홈 복귀 5회·메뉴 탭 같은 조건 중복 방문 제거, 홈 DOM에서만 보이는 메뉴 링크·외부 웹사이트 링크는 첫 홈 방문 때 추출; quota/속도 cost와 `scan_scheduling.COMPETITOR_PAGE_COST` 10→6; 정보 손실 없음을 **수정 전 코드로 찍은 기준값과 반환값 동일 비교**(`tests/test_competitor_crawl_navigation.py`, 가짜 브라우저 `tests/crawl_nav_harness.py`)하고 변이 4종으로 검증). 20곳 모델 기준 주간 접속에서 경쟁사 크롤 58%→35%, 최대 항목은 키워드 순위 43%(코드 기준 모델, 실측 아님). **크롤 주기를 늘리는 안(캐시 TTL 6.5일→13일)은 공개 문구(`demo/page.tsx:1414` "경쟁사 정보를 매주 자동으로 모읍니다", `PlanGate.tsx:39` "주 1회 자동 추적")와 충돌해 보류 — 사용자 결정 대기.** 용량 한계(모든 개선 적용 기준 상한 초과 시점)는 `scripts/naver_load_model.py` 재실행으로 갱신할 것. 나머지 설계(수동 풀스캔에서 홈 중복 로드, `fetch_stats` 단기 캐시)는 미착수.
- **2026-10-28 인기 가게 체험 점검 + 별점 잡 수리 (git 9d48882·1b48d14·6119e83·0f329a9 등, 서버 배포·md5 일치, 백엔드 436개 통과, push 미실행)**: ①어니언 성수 체험 실행으로 **구글 지도 오탐** 발견·수정(Serper 주소가 구 이름 없이 도로명만 와서 `성동구` 검사가 등록된 가게를 거절) ②체험 첫 화면 한 줄 진단 카드에 "측정으로 확인된 것" 추가 + "네이버 상위 5곳까지만 볼 수 있다" 측정 한계 문구 ③체험 결과에 **리뷰 수·평점 직접 입력**(`TrialReviewInputCard`, "입력하신 값·AEOlab이 확인한 값이 아니에요"로 측정과 분리 표시, 서버 미저장, localStorage `aeolab_trial_review_input`→온보딩이 `createBusiness`로 이어받음) ④**별점 낮은 리뷰 알림 잡이 한 번도 동작한 적 없음을 발견**(실제 화면은 `별점/5/점` 세 줄이라 정규식 0건 일치, 기본 정렬이 추천순, 테스트 픽스처가 실제에 없는 형식, `review_id`가 순번) → 파서·최신순 클릭·해시 ID·첫 확인 기준선·배치 몫·오래된 순서 회전·막힘 구분·조용한 고장 슬랙 알림. **이 잡은 6시간마다(하루 8페이지/곳)일 때 20곳 기준 주간 네이버 접속의 47%(최대 소비처)였고, 사용자 결정("빈번한 알림은 신뢰를 깎는다")으로 2026-10-28 매주 월·목 10:00(주 2회, 약 6%, 알림 지연 최대 3~4일)으로 변경 — `day_of_week="mon,thu", hour=10`, `tests/test_low_rating_schedule.py`가 일정 고정.** 알림 조건은 평균 별점 변화가 아니라 **새로 보인 1~2점 개별 리뷰**(사업장당 실행당 1건). ⚠️ 알림 실발송은 라이브 미확인(다음 실행 18:00은 기준선만 기록). 상세 `docs/low_rating_alert_job_2026_10_28.md`·`docs/popular_shop_trust_cases_2026_10_28.md`. ⑤**AEOLAB_GROWTH_01 하락 시에도 "업그레이드 안내"가 나가던 결함 수정**(`jobs.py`가 `prev != curr`만 봄 → 승인 조건 "상승이 확인될 경우"에 맞춰 `stage_names.is_stage_upgrade`로 상승에만 발송, 인자 순서까지 소스 검사 테스트로 고정; 점수가 경계에서 흔들리면 상승 알림이 반복될 수 있음 — 히스테리시스는 미구현). ⑥**별점 알림 발송 실패가 '발송됨'으로 기록되던 결함 수정**(`kakao_notify._send_raw`가 반환값이 없었음 → 성공만 True, 잡은 실패 시 재시도·슬랙 알림). 알림톡 `#{리뷰내용}` 50자 제한의 NHN 공식 수치는 미확인. ⑦**차단 뒤 회복 확인 시 운영자 메일**(`naver_access_guard._alert_recovery`, 플레이스·검색 화면 각각, 차단 이력이 있을 때만 — 10-28 첫 회복을 로그를 직접 읽어서야 알았던 것). ⑧**유명 가게가 약해 보이는 원인을 실데이터로 반증·정량화**(`docs/popular_shop_trust_cases_2026_10_28.md` 후속 2): 블로그 건수 지역 규칙 과소집계 가설은 기각(제외 3건뿐), 이름 변형은 부분 맞으나 "어니언링" 오탐 위험으로 산식 보류, 지역검색 **후기 많은 순(sort=comment) 상위 5곳 순위를 있을 때만 표시**(`review_sort_rank`, 없다고 감점 안 함, 키워드에 따라 있고 없음 — 하라식당은 없음), 등록 사업장 리뷰 DB 기본값 0을 `naver_place_id` 없을 때만 미측정으로(`_is_review_unmeasured`, 영향 실측 구독자 0곳). ⑪**체험 결과 판정이 표본 잡음에 뒤집히던 것 수정**(ChatGPT 구 이름 결과가 같은 가게에서 12~28/50으로 흔들려 한 줄 진단이 바뀜 → Wilson 상한 기준 `lib/sampling.ts`, 후기순 상위 5곳이면 네이버 약함 아님, `/quick`의 "5회" 오표기 정정). **체험 한도는 메모리 카운터(재시작 시 초기화)라 "한도 소진"을 추정하지 말 것** — 검증은 `scripts/trial_replay/`(저장 응답 재생, 한도·비용 없음, 후보 검색 분당 10회 주의). ⑩**공개 공유 경로가 유명 가게를 "0점·시작 전·D등급"으로 보이게 하던 결함 수정**(`score_history` 최신 1행이 순위 행(NULL)이면 0점 — 실측 하라식당 49.0이 0으로 공개됨, 같은 유형 14곳 수정 + `tests/test_score_history_latest_row.py` 구조 테스트가 신규 지점도 차단; 공유 카드 PNG의 점수 숫자·등급 문자·"100회 중" 제거, 업종 한글화; 공유 페이지 구간 75/55/30·track1 통일). 배지 SVG의 A/B 등급 표기는 사용자 결정 대기. ⑨**기대 설정 문구**("네이버에서 유명한 것과 AI 검색에 잘 나오는 것은 같지 않아요…", `lib/scoreLabels.ts` `READINESS_NOTE`·`TRIAL_SCOPE_NOTE`): "AI 검색 준비도" 라벨이 보이는 대시보드 히어로·/demo·체험 "네이버 현황" 탭과 체험 진단 카드에 추가("인기와 무관"으로 단정하지 않음 — 리뷰·블로그·순위는 인기와 상관). 미해결: 체험 리뷰 수 자동 수집(플레이스 접속 필요), 새 후기순 문구·체험 진단 카드 문구는 오늘 체험 한도 소진으로 라이브 미확인(내일 어니언 성수 "카페+베이커리"로 확인). **교훈: 테스트 픽스처는 실제 외부 응답을 한 번 찍어 만든다(지어낸 형식은 결함을 가린다).**
- **2026-10-27 신뢰 정보·차단 방지 후속 5건 (git c90b2a4·74cdb31·be51f87·9f4c4a3·0989809, 서버 배포 완료·md5 일치, push 미실행)**: ①리뷰 미수집(None)·구글 미측정이 0점으로 평균에 들어가던 것을 제외 후 재정규화(`score_engine._is_review_unmeasured`·`_is_google_unmeasured`, v3.1·v3.2) — 단 수정 후에도 체험은 통합 약 27점 D라 "전부 D"의 주원인은 아님 ②체험 가게 찾기를 **동네 + 가게 이름 두 칸**으로(네이버 지역검색 API는 5건만 반환해 이름만 검색하면 다른 지역 같은 이름 가게가 먼저 나옴; 랜딩 히어로 검색은 지역칸 선택 입력 그대로) ③공유 카드 업종 평균 표본 5건 미만 생략 ④검색 화면 쿨다운 게이트 5곳(가게 카드 확정·블로그 검색 분석·스크린샷 3종, `begin_search_access`) ⑤차단·회복 사건 기록 `naver_block_events`(SQL 실행 완료·테이블 확인, `/admin/naver-access`의 `block_events`). 새 테스트는 변이 검증(수정을 빼면 실패하는지)으로 확인 — 무의미한 테스트 3개를 발견·수정. **10-28 추가(git b4121c8)**: ⑥경쟁사 크롤 요일 배정(md5%7)은 20곳에서 용량 44% 손실이라 **"마지막 관측이 오래된 순서 + 일일 예산 + 주간 pacing"으로 교체**(`scan_scheduling.select_stale_first`, 플래그 `NAVER_COMPETITOR_STALE_FIRST` 서버 켬·롤백은 env 한 줄; 60일 시뮬레이션으로 20곳 일 최대 120페이지·간격 7일, 기존 고정 화요일 600). enrich는 요일(목) 유지+캐시 유효한 경쟁사만. ⑦속도 제한: 정기 잡은 각 윈도우의 0.7배만 사용(`batch_rate_ratio`)해 사용자 요청 몫 확보. **스캔 슬롯 분산은 켜지 않기를 권장**(월·목 유지) — 슬롯 설계 자체가 불균등(Pro 수·금 71%, Basic 월·목 43%·일 0%)해 켜기 전에 패턴 수정 필요. **10-28 추가2(git af20d18·c0d0599·19bf4e8)**: ⑧랜딩 히어로 검색을 동네→가게 이름 순서·동네 필수로(후보 선택 시 지역은 주소에서, 입력한 동네는 `neighborhood` 파라미터로 체험 페이지에 전달 — **플레이스 ID 없는 후보 경로에서 동네가 비던 결함을 라이브 재검증으로 발견·수정**) ⑨랜딩 "N개 가게 분석 완료" 카운터가 체험 **행 수(254)**를 그대로 보여 개발자 테스트까지 세던 것을 서로 다른 가게(이름+지역, 테스트 이름 제외) 수로(76, 라이브 API와 DB 독립 계산 일치) — "오늘"도 한국 0시 기준·시각 비교로, `DiagnosisCounter`의 확인되지 않은 "지금도 진행 중" 주장 제거. **10-28 추가3(git 650734c·89407f7)**: ⑩히어로·랜딩 네이버 AI 브리핑 통계(+27.4%/+10.4%/+8%) 표기를 **네이버 보도자료 원문(2025-08-21, navercorp pressReleasesDetail seq=33232)** 에 맞춤 — 범위는 "식당·카페 등"(업종별 내역은 원문에 없음), "1위 노출 시"는 원문에 없는 주장(원문은 적용 **전후** 비교, 기간·대조군·표본 미공개), "클릭률"은 추가 탐색 활동 지표, "AEOlab 효과가 아님" 명시. ⑪**프록시 사용 범위 `NAVER_PROXY_SCOPE`(place/search/all, 기본 place,search=기존 동작)** + 접속 구분별 사용 기록(`/admin/naver-access`의 `proxy`, 주소·계정 미포함) — 호출 지점 11곳이 구분을 넘기고 소스 검사 테스트가 인자 없는 호출을 막음. ⚠️ **키워드 순위 측정(`naver_keyword_rank.py`)은 프록시 인자가 없어 어떤 프록시를 사도 항상 서버 IP 직접 접속**(범위 설정과 무관, 미연결). 서버에 추적되지 않는 옛 폴더 `backend/services/ai_scanner_deploy_tmp/`(2026-08-08, 임포트 안 됨)가 있음 — 삭제는 사용자 승인 후. **10-28 추가4(git b9a1ddb)**: ⑫**함수 단위 감사로 플레이스 접속 구멍 2곳 발견·수정** — `get_recent_low_rating_reviews`(별점 낮은 리뷰 알림 잡)는 일일 상한만 있고 회로·속도·차단 보고가 없어 쿨다운 만료 7초 전에도 접속했고, `naver_place_resolver._fetch_place_page_text`(주소 대조용 가게 상세)도 회로를 안 거쳤으며 차단 화면을 주소 **불일치**로 오판할 수 있었다. 어젯밤 "보호 현황표"를 **파일 단위**로 세서 같은 파일의 다른 함수가 구멍을 가렸다 — 새 접속 경로를 만들면 파일이 아니라 **함수** 단위로 `begin_place_access`/`begin_search_access`를 확인(`tests/test_place_path_coverage.py` 구조 감사 테스트가 막음). 같은 날 새벽 잡 실측: 02:00 스캔 성공·03:30 경쟁사 동기화 "후보 2곳 중 0곳"(예측대로)·04:50 카나리 어니언 성수 PC·모바일 1위 정상·검색 화면 차단 없음. **키워드 수는 모델 가정(3개)보다 많음**(실측 사업장 평균 4개, 2~6) — `scripts/naver_load_model.py` 기본값을 4로 갱신, **모든 개선 적용 기준 상한 초과 시점이 40~50곳 → 30~40곳**(300곳 최대일 3,795 → 4,395페이지)으로 앞당겨짐(위 "약 40~50곳 한계" 서술은 키워드 3개 가정이라 낙관적이었음). **10-28 추가5(git 010c216)**: ⑬검색 화면 쪽 함수 단위 감사 — `ai_tab_trigger_check_job`(월·목 09:00)은 회로·쿼터·세마포어가 전무, `briefing_category_expansion_monitor_job`(매월 1일)은 회로·세마포어가 없던 것을 수정(차단 화면이면 나머지 쿼리 중단·회로 보고·일부 측정 결과로 AI탭 설정/업종 확대 알림을 내지 않음, 공용 `naver_block.is_naver_search_block`). `check_naver_cookie_health_job`은 주 1회 naver.com 로그인 상태 1페이지라 의도적으로 제외(구조 감사 테스트 허용 목록에 사유 명시). AI탭 스캐너는 진입 함수 `scan()`에 게이트가 있어 정상(`_run_scan`은 실행부). **10-28 추가6(git c955e84)**: ⑭**성장 단계 이름 통일 — `시작 전 / 보강 단계 / 개선 중 / 양호`**(survival/stability/growth/dominance, 점수 30/55/75, 내부 코드·구간 불변). 같은 구간을 세 벌 이상(히어로·공유카드 "AI 검색 준비도 · …" / score_engine·갭카드·점수안내 "시작 단계…지역 1등" / gap_analyzer·알림톡·이메일·가이드 "생존기…지배기")+공유 페이지 "안정 궤도…"+DualTrackCard "다음 단계" 표로 부르던 것을 **백엔드 `services/stage_names.py`·프론트 `lib/scoreLabels.ts` STAGE_NAME 한 쌍**으로 통일(`tests/test_stage_names.py`가 두 표 일치·옛 이름 재유입을 검사, 변이 검증 완료). "지역 1등"·"지배기(업계 최상위)"·"지역 상위권입니다" 같은 순위 과장 제거. DB의 옛 `growth_stage_label`은 코드 기준으로 새 이름 표시(`normalize_stage_label`/`normalizeStageLabel`), 알림톡은 단계 이름이 템플릿 변수라 이름만 바뀜(승인 본문은 10-28 사용자 제공으로 확인 — 변수 `#{사업장명}·#{이전단계}·#{현재단계}·#{이번주추천}`, 코드와 일치, 재승인 불필요). **남은 불일치(미통일, 의도적 범위 밖)**: ①`share/[bizId]` 공유 페이지의 구간이 70/50/30(다른 곳은 75/55/30) ②압축 라벨 `getScoreTextLabel`(양호/보통/주의 필요/시작 전)과 단계 이름의 중간 구간 어휘 차이 ③갭 분석 카드의 지표별 수준 라벨(상위권/중위권/개선 구간/시작 단계)·채널 점수 5단계(우수/양호/보통/미흡/시작 단계) ④성장 단계가 `score_engine`과 `gap_analyzer._build_growth_stage`(스마트플레이스 미등록→survival, 등록+리뷰→최소 stability 보정) 두 곳에서 따로 계산됨 — 이름만 통일했고 판정 규칙은 그대로. **미결(사용자 결정)**: 프록시 구매(구매 기준은 사건 기록, 구매한다면 Decodo — 우리 환경 연결 기록 + 포트 7000 열림, 가격은 결제 페이지 재확인)·Phase 2. 상세 `docs/naver_block_scale_decision_brief_2026_10_27.md` §3-5.
- 위 항목의 원문 상세는 `docs/changelog_archive.md` "CLAUDE.md 최근 업데이트 이관(2026-10-27)" 참조.

- 2026-08-23~09-29 항목(대시보드 로딩 지연 조사·창업 시장 분석 종합 개편·폐업율·알림톡·AI 광고 대비·전체 UX 점검·체험 개선 등 31건)은 위 아카이브 참조. 다음 압축은 이 항목이 1개월 지난 시점에.

## 남은 작업

### 사용자가 직접 해야 할 것
- ⏳ **베타 후기 1~3개 확보** → `frontend/lib/testimonials.ts` `isPlaceholder: false`로 교체 (Phase 0 인터뷰 후)
- ✅ **크렙 심사 승인·`CREB_TEST_PRICE_*` 삭제 완료(2026-10-27)** — 키 교체 불필요. 10-27 실결제 시험(Basic 8,950원 결제→환불·빌링키 삭제) 서버 기록으로 확인: 빌키 심사 포함 확인됨, 심사용 계정 삭제 완료(2026-10-29). 남은 것: 30일 뒤 정기 재결제 동작 미확인
- ✅ **NAVER API Hub 키 발급·전환 완료** (2026-09-02) — 마이그레이션 실질 완료, 재작업 불필요
- ✅ **카카오 비즈센터 승인내역 확인 완료** (2026-09-02, 스크린샷 제공) — `AEOLAB_SCAN_01`/`AEOLAB_COMP_02` 승인 확인 후 `send_scan_complete()`/`send_competitor_overtake()` 연결 완료(git `50ab946`). 재작업 불필요
- ✅ **네이버 서치어드바이저 사이트 등록 + 사이트맵 제출 완료** (2026-08-07) — HTML 파일 방식으로 소유확인(`frontend/public/naver90ab854379ebb072c6795b390f874ac8.html`, git `b45b952`, 라이브 200 확인) 후 사이트맵 제출까지 사용자 완료. 색인 반영은 네이버 측 처리 시간 소요 — 재작업 불필요

### 비즈니스 목표
- [ ] 유료 구독자 20명 달성 (BEP)
- [ ] 구독 100명, MRR 100만원 → 시드 IR
- [ ] 소상공인 디지털 바우처 사업 등록 (Phase 3)
- [ ] B2G 공식화 지자체 MOU (Phase 4)

### 외부 API 마감 대응 (하드 마감일 있음)
- [x] ~~네이버 Search API·DataLab API → NAVER API Hub(NCP) 마이그레이션~~ 완료(2026-09-02, git `41f3c01`+`aa38a1f`) — 라이브 전환 완료. 상세 `docs/naver_api_hub_migration_v1.0.md`

### 미래 과제 (구독자 확보 후)
- `smart_place_completeness` Playwright 완전 자동화 — 50명 이후. 조건 충족 자동 감지: `jobs.py:_check_data_wiring_readiness_job` (`[DATA-WIRING-READY-50]` WARNING, 매일 09:20 KST 자동 체크 — 2026-08-23 타임존버그+get_supabase ImportError 둘 다 수정 완료, git `3381ce9`). DataLab 연동은 2026-07-05 완료
- 경쟁사 keyword_gap 실시간 자동화 (`_enrich_competitor_excerpts` 잡 이미 구현됨)
- 백엔드 `--workers 1` → Redis/DB 락 마이그레이션 — in-memory 락 9개(6파일)·Playwright 세마포어가 프로세스 간 미공유라 보류 중. 트리거 조건·현황 전체: `docs/backend_worker_scaling_trigger_v1.0.md` (2026-07-19)

### Google AI Overview 측정 현황 (2026-05-30 Serper.dev 활성)
- **AI Overview 노출 측정**: `GOOGLE_SCANNER_BACKEND=serper` + `SERPER_API_KEY` 설정 완료. `captcha_detected=false`로 정상 측정 중
- **스크린샷(시각 증거)은 별도**: Playwright 캡처는 여전히 CAPTCHA 차단 상태. 50명 이후 DataForSEO Screenshot API($0.002/건) 재도입 예정
- 환경변수: `GOOGLE_SCANNER_BACKEND=serper|dataforseo|playwright` 토글 가능

---

*최종 업데이트: 2026-09-22 | 대시보드 로딩 지연 조사 — 5가지 원인(SSR공개도메인경유·Cloudflare해외우회·서버DNS정체·RLS정책중복·gap무캐시) 순차 발견·수정, 최댓값 106s→10.7s. 남은 지연은 격리테스트로 Supabase측 확률적 정체임을 확정, 다음 후보(Suspense 스트리밍/유료플랜)는 미착수 — 상세 `docs/dashboard_load_delay_investigation_v1.0.md`. 이전(2026-09-02) 항목은 위 목록 참조. 압축은 문서 하단 다음 문단 계획대로 다음 달 진행.*
*문서 정리(2026-08-31): "최근 업데이트" 8/23~8/27 상세 내역(13개 항목) 전량을 `docs/changelog_archive.md`로 이관하고 요약 1줄만 유지 — 91,375→72,722바이트(약 20% 감소), 754→742줄. 700줄 기준은 아직 근소 초과이나, 남은 초과분은 문서 전체에 흩어진 활성 참조 섹션(현재 패턴·경로·수치)이라 추가로 줄이려면 실질 정보 손실이 불가피해 보류 — 다음 압축은 이번에 새로 쌓이는 "최근 업데이트" 항목이 1개월 지난 시점에 진행할 것.*
