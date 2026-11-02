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
| **② 네이버 차단·접속 보호·법적** ⭐ | `naver_scraping_legal_risk_assessment_v1.0.md`(회색지대, 코드 임의 축소 금지) · `naver_scraping_legal_risk_resolution_plan_v1.0.md` · `naver_briefing_block_countermeasure_handoff_v1.0.md`(NID_SES 월 1회 교체) · `naver_place_access_protection_2026_10_27.md` · `naver_request_load_spreading_design_v1.0.md` · `next_session_handoff_trust_block_scale_v1.0.md` · `popular_shop_trust_improvement_handoff_v1.0.md` · `scale_roadmap_1000_businesses_2026_10_28.md`(1,000곳 확장 로드맵·유료 서비스 평가) · `next_session_handoff_naver_independence_2026_10_28.md`(차단·인기 가게·네이버 독립·적법성·별점 입력 완료/미완 현황, 새 대화창 트리거) · `next_session_handoff_master_2026_10_29.md`(⭐ 최신 마스터 — 인기 가게 저평가·차단·사용자 증가·독립·결제 전체 정리, 새 대화창 트리거) · `next_session_handoff_2026_10_30_plan.md`(⭐ 10-30 최신 — 방향 합의·300명 대응·측정 신뢰·처방 품질 단계별 작업) · `session_handoff_2026_10_29_naver_block_scale_work_v1.0.md`(⭐ 10-29 대화 작업 기록 — 변경 커밋·실측 사용량·600건 상한은 제안값·순위 장애 54일·Supabase 진단·미확인·내일 검증, 네이버 독립 서비스 개발 인수용) | 차단 대응·속도 기준·공유 캐시·인기 가게 신뢰도·300~500명 대응(과제 01/02/02-1/03) |
| **②-b 상업 서비스 종합(11-01)** ⭐ | `commercial_launch_naver_scale_value_plan_2026_11_01.md`(⭐ 새 대화창 트리거 §0 — 네이버 차단 런북 S1~S7·사용자 증가 단계별 운영·유료 가치 평가와 보완 로드맵·결정 D-1~D-9·작업 백로그 T-1~T-15) · `openai_model_migration_eval_2026_11_01.md` · `ai_vendor_data_flow_privacy_check_2026_11_01.md` · `first_customer_rehearsal_plan_2026_11_01.md` | 소프트 런치 판단·차단 대응·규모 운영·가치 가설 검증 |
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

- **2026-10-29 ~ 11-01 요약 (정확한 수치·근거·커밋은 `docs/changelog_archive.md` "CLAUDE.md 최근 업데이트 이관(2026-11-01)" 원문)** — 사용자 방침: 오판·오탐·누락에 신중, **장기 운영 가능한 상업 서비스**. 방향: 제품 가치=개선 처방, 신뢰=측정 정확도·안정성, 경쟁사 갱신 2주 유지(3·4주 레버를 용량 대응책으로 제안 금지), 네이버 접속 IP 단일 유지(분산은 차단됐을 때만), Gemini 프롬프트에 개인정보 금지.
- **측정·문구 원칙(11-01 V1 검증 결과)**: 기억 모드(ChatGPT·Gemini 비유도 표본)의 0을 '안 나옴'으로 단정하지 않는다 — "이번 측정에서는 확인되지 않았고 검색을 켠 화면에서는 다를 수 있다". '낮아도 정상/일반적' 단정·근거 없는 평균 수치·개선 보장 표현 금지(`tests/test_frontend_no_unverified_ai_claims.py`가 금지 문구 10종을 막는다 — **서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 백엔드 테스트를 배포**). 표본 10회 미만은 '참고용' 표시(`DashboardGlobalAiZone`). 점수 영향은 음식점 기준 ChatGPT 최대 약 3%라 점수 모델은 유지. 화면·알림의 등급 이름·경계는 `stage_names` 단일 소스(시작 전/보강 단계/개선 중/양호, 30/55/75) — 알림 `_grade`가 따로 쓰던 옛 이름(우수/보통/개선 필요, 80/60/40)은 통일됨.
- **알림톡 규칙**: 승인 본문 기준 `docs/kakao_alimtalk_console_bodies_2026_10_31.md`(콘솔 캡처 24장), 규칙 `docs/kakao_alimtalk_sending_rules_2026_10_31.md`, 정리안 `docs/kakao_alimtalk_template_plan_2026_11_01.md`. 변수 키는 `#{ }` 없이, **값은 14자 이하**(15자부터 전체 실패, 안전망이 끝을 "…"로 자름), 자유 문구 경로 불가(`KAKAO_ALLOW_FREE_TEXT` 기본 꺼짐), 해지·만료 계정 번호 차단(`notify_gate`), 확인 못 한 것은 저장·알림하지 않는다(`None`). **새 알림은 본문에 값을 끼운 최종 문장을 `backend/scripts/render_alimtalk_messages.py`로 재현 → 관리자 번호 시험 1건 → 연결** 순서(시험 발송 성공 ≠ 문장이 자연스러움). 소식 14일 미작성·가입 7일차·경쟁사 급등·신규 경쟁사 알림은 알림톡에서 제외(스위치 기본 꺼짐), 경쟁사 변화 알림은 `services/competitor_alert.py` 규칙(같은 측정 방식·등급 구간 변경·변화폭 10↑·텍스트만·사업장당 7일 1회·전달 성공 때만 기록), 스캔 완료는 언급 플랫폼이 없으면 미발송. **승인 상태(11-02 사용자 전달)**: `AEOLAB_SCORE_02`(SCORE_01 개정)·`AEOLAB_SCAN_02`(SCAN_01 개정) 등 CANCEL_02를 뺀 신청 건은 **승인됨 — 아직 코드 전환 전**(승인된 실제 본문·변수 이름을 사용자에게 받아 대조한 뒤 전환, 절차는 메모리 `project_alimtalk_all_sends_failing_2026_10_31.md`). `AEOLAB_CANCEL_02`는 **11-02 승인·서버 활성화 완료**(콘솔 본문 변수 `#{환불금액}` 확인, 서버 `backend/.env`에 `KAKAO_TEMPLATE_CANCEL_REFUND=AEOLAB_CANCEL_02` 추가·재시작, 백업 `/root/backend_env_backup_20261102_cancel02`). 환불 경로는 7일 이내 해지 때만 타므로 실제 도착은 첫 환불 사례에서 확인(관리자 시험 발송은 보류). **SCORE_02·SCAN_02는 11-02 서버 활성화 완료**(시험 발송 resultCode 0 ×2·사용자가 폰에서 문장 확인, 서버 `backend/.env`에 `KAKAO_TEMPLATE_SCORE_CHANGE=AEOLAB_SCORE_02`·`KAKAO_TEMPLATE_SCAN_COMPLETE=AEOLAB_SCAN_02` 추가, 백업 `/root/backend_env_backup_20261102_score02_scan02`, 되돌리려면 두 줄 삭제+재시작). 전환 후 동작: SCORE_02는 **등급이 바뀐 경우에만** 발송·순위는 집계 3곳 이상일 때만 "N위"(아니면 "집계 전"), SCAN_02는 언급 플랫폼 조건 없이 번호당 주 1건(`NOTIFY_SCAN_COMPLETE_WEEKLY`). 11-01 운영자 폰에 정기 알림 실제 도착 확인(제3자 번호 발송은 미확인).
- **점검·테스트 도구(11-01 신설, 새 라우트·컬럼을 배포한 뒤 다시 돌린다)**: 안전 배포 `bash scripts/deploy_backend_files.sh [--force] <파일들>`(로컬 문법→서버 상태→백업→업로드→서버 테스트→재시작→`/health`→실패 시 복구, 서버가 HEAD와 다르면 중단 — 내 직전 배포일 때만 `--force`). GET 전수 `backend/scripts/route_smoke_readonly.py`(서버에서 실행, 외부 연결·Playwright·Gemini·**DB 쓰기 차단·기록**, 쓰기 시도 목록은 상태 의존이라 불완전). 쓰기 라우트 `route_write_dryrun.py`(쓰기를 httpx 층에서 가로채 스키마 대조 후 가짜 성공, 설계 `docs/write_route_isolated_test_design_2026_11_01.md`, 파괴적·결제·관리자 발송 라우트는 제외, 스테이징 DB는 구독자 발생 시). 컬럼 존재 `tests/test_db_columns_exist.py`(정답 `tests/fixtures/db_columns.json` — **SQL Editor로 컬럼을 추가한 뒤 서버에서 `backend/scripts/refresh_db_columns_snapshot.py`로 갱신·커밋해야 새 컬럼을 쓰는 코드가 통과**). 없는 이름 import 정적 검사 `test_import_names_resolve.py`, `score_breakdown`의 숫자 항목은 `services/breakdown_utils.numeric_breakdown_items`로만 고른다(비숫자 값 `user_group:'INACTIVE'` 등이 섞여 있다), `Content-Disposition`은 `filename*=UTF-8''` 인코딩(한글 이름 500 방지). **한글이 든 파이썬은 `python - <<EOF` 금지**(cp949로 깨짐 — 파일로 작성, `Edit`는 안전), 파이썬 파일을 스크립트로 고친 뒤에는 배포 전 `ast.parse`.
- **11-01 사고 교훈**: ①'읽기 전용' 점검이 DB 쓰기를 막지 않아 `GET /api/kakao/check`가 `businesses.kakao_registered`를 False로 덮어씀(카카오 공식 API 실응답으로 복원) → **외부 API 실패는 `None`(확인 못 함)으로 돌려 저장하지 않는다**, 복원은 추측이 아니라 공식 소스로, 내가 만든 행은 시각·사업장·라우트를 확인한 뒤 정확히 그것만 삭제. ②함수·import만 고치면 그 뒤에 가려진 결함을 놓친다 → 사용자 라우트는 서버에서 `TestClient`+`dependency_overrides`로 실호출(QR 카드: import 오류 뒤에 한글 헤더 오류). ③수정 배포 시각까지 확인(순위 추이 장애기 09-02~10-26 — 수정이 10-26 17:52라 그날 값도 실패값, `RANK_MEASUREMENT_TRUSTED_FROM=2026-10-27`, 2026-11-26 이후 제거 가능). ④분류 개수는 손으로 합치지 말고 전체 목록에서 다시 센다. ⑤경쟁사 보강 잡(`_enrich_competitor_excerpts`)은 일요일 05:00(02:00 야간 스캔과 Gemini 호출 경합 의심, 11-08 표본으로 확인).
- **허위 미노출 점검(11-01)** — 실제 가게가 네이버에 있는데 '없음'으로 나오는 경로: ①`naver_visibility._name_matches`가 등록명에만 붙은 '본사·본점·(주)'를 못 떼서 '법무법인 리얼로펌 본사'가 미등록으로 판정됨(네이버엔 '법무법인 리얼 로펌 …창원분사무소') → 핵심 이름 재대조+`_search_names` 재검색으로 수정, 위치 지점명(…마산점)은 거부. ②순위 배지 '미노출'→'첫 화면 밖'(5~13곳 밖이지 네이버에 없다는 뜻이 아님). **주의(11-01 실측)**: 지역검색 API `link`에는 `/place/<숫자>`가 없다(22건 중 0건) → `naver_place_id`는 API 경로에서 쓸모없고 API 순위·등록 판정은 **이름 대조만**이며, `/api/businesses/search`의 `naver_place_id`는 항상 빈 값이라 등록 시 ID는 서버 확정(Playwright)으로만 얻는다. 같은 날 이 사실을 모르고 'place_id가 있으면 안전'이라고 보고해 정정함. 미해결: Playwright 경로 `_is_match`는 '홍스튜디오'가 '더홍스튜디오'에 맞는 오탐, 등록명이 네이버 표시명보다 긴 경우(홍뮤직스튜디오작곡교습소↔홍뮤직스튜디오)와 지점 표기 차이(강남역점↔강남R점)는 API 경로에서 못 찾음. 죽은 컴포넌트 `RegisterBusinessForm.tsx`(실제 등록은 `onboarding/page.tsx`).
- **랜딩·체험 문구 일관성(11-02)** — 랜딩 안내가 체험 결과·FAQ·플래그와 모순되지 않게 정리: 무료 진단 범위=네이버 검색·ChatGPT·구글 지도·스마트플레이스 등록과 (직접 입력 기준) 부족 항목 체크·블로그 글 수 비교·경쟁 가게·먼저 고칠 것(체험 결과 탭 5개), 가입 후=AI 브리핑·AI탭·매주 자동 추적·경쟁사 3곳 비교. **제미나이는 `GEMINI_MEASUREMENT_LIVE=false`인 동안 '준비 중'**(테스트가 강제), 기간·효과·보장 단정 금지(금지어 테스트 확장), 소셜 프루프 카운터는 누적 4회 이상 IP를 제외(`TRIAL_COUNT_MAX_RUNS_PER_IP`, 개발·운영 테스트 추정, 현재 32). 새 문구는 체험 결과·FAQ와 같은 기준으로 쓸 것. **제미나이 문구는 `GEMINI_MEASUREMENT_LIVE` 하나로 '준비 중'↔'정상 측정'이 바뀐다(11-02 점검: 켠 상태 빌드에서 '제미나이 준비 중' 0건 확인)** — 유료화 후 켜는 절차는 `lib/featureFlags.ts` 주석(유료 등급·30건 동시 시험·check_ai_providers·야간 표본·`GEMINI_MIN_INTERVAL` 조정 확인 후 true+재빌드), 고정 '준비 중' 문구는 테스트가 막는다.
- **'측정 빠진 스캔' 비교 금지 규칙(11-02, 커밋 `8ac0798`~`09da306e`)** — 네이버 측정이 빠진 스캔(차단·캡차·상한·화면 변경)의 점수는 항목을 0점이 아니라 제외·재정규화하므로 측정 성공일과 **척도가 다르다**(같은 가게 시험 64.5↔54.6). 그 점수를 직전·처음·전/후 점수와 비교해 "하락/개선/등급 변화/역전/상승/증감"으로 기록·알림·표시하면 가짜 변화가 나가고, 차단이 풀린 다음 날 반대 방향 가짜 변화도 나간다. **새 변화 문구·알림·기록·전후 저장은 반드시 `services/change_signal_guard.py`를 거친다** (`comparable_scans`·`comparable_to_previous_scan`(저장 전 호출)·`window_comparison_unmeasured`(기간 양 끝)·`unmeasured_on_dates`(점수 행 KST 날짜)·`latest_measured_score`(전/후 점수 저장)). 원칙 한 줄: **비교의 양 끝이 모두 네이버까지 정상 측정됐을 때만 변화로 말하고, 확인하지 못해도 말하지 않는다.** 저장하는 점수 자체는 바꾸지 않는다(정직한 재정규화 값). 적용 완료: 야간 스캔 5신호·수동 스캔 3경로·재방문 배너·주간 성적표·월간 리포트 2잡·월간 카드·30/60/90일 메일·주간 다이제스트·성장 리포트/이력/GrowthClient·행동 전/후·대행 전/후. **미적용(사용자 결정 대기)**: 점수 추이 그래프의 차단일 점(표시 방식 결정 필요). 네이버 킬스위치는 서버에서 `touch /var/www/aeolab/backend/.naver_kill_switch`(해제 `rm -f`), 상세 `docs/commercial_launch_naver_scale_value_plan_2026_11_01.md` §7.2~7.5. 같은 계열 점검에서 **테스트가 운영 자원을 건드린 위험**도 발견: 알림 함수 5단계는 갭 카드를 운영 Storage에 올리므로 `conftest.py` autouse로 막았고, 접속 가드 테스트는 모듈별 `async_playwright`를 함정으로 바꿔 둔다.
- **정기 알림톡 발송 간격·문구 규칙(11-02, 커밋 `ed691a8d`~`3dde1243`)** — 운영자 계정에서 매일 3~4건이 와서 점검: `daily_kakao_notify`(09:10 매일)가 "이달 할 일"(가이드 있으면 매번)·AI 인용(24시간 내 언급 있으면 매일)·점수 변화(±3점)를 횟수 제한 없이 보냈다. **`services/notify_cadence.py`**: 종류별 최소 간격(할 일 28일·AI 인용 14일·점수 변화 7일 — **제안값**, 환경변수 `NOTIFY_MIN_DAYS_<종류>`로 조정, 0이면 제한 해제), 사업장 단위 기록 `notifications.type=cadence_<종류>`, **전달 성공이 확인된 때만 기록·기록을 못 읽으면 미발송**, 주간 성적표가 성공하면 점수 변화 간격도 시작. **새 정기 알림은 반드시 간격 규칙을 정하고 이 모듈을 거친다.** **사용자(번호)당 주 3건 상한(사용자 결정, 커밋 `3650f429`)**: `services/notify_weekly_cap.py`가 모든 정기 알림이 거치는 `KakaoNotifier._send`에서 번호별 최근 7일(롤링) 전달 성공 건수를 막는다(`NOTIFY_WEEKLY_CAP` 기본 3, **0이면 끔 — 관리자 시험 발송·긴급 해제**), 마지막 한 칸(`NOTIFY_WEEKLY_RESERVE` 기본 1)은 주간 성적표·월간 리포트·경쟁사 역전/변화·성장 단계용으로 비운다, 결제·구독·대행 안내(`_send_delivery_template`)와 공지는 세지도 막지도 않는다, 기록 `notifications.type=periodic_sent`(번호 해시만 저장), 실패는 세지 않고 조회 실패 시 미발송, 상한에 걸린 알림은 None(미전달)이라 종류별 간격 기록이 시작되지 않아 다음 기회에 재시도. **새 템플릿 key를 `_send`에 추가하면 `PERIODIC_TYPES`에 넣을지 결정할 것**(테스트가 실제 `TEMPLATES`와의 불일치를 막는다). 테스트는 conftest autouse로 상한을 꺼 둔다(`_send`가 운영 DB를 읽고 쓰므로). 미구현: 스캔 완료 알림 자체 빈도 조정. 문구: 경쟁사 점수는 간이 추정치라 사용자 화면·알림에 숫자("N점 앞서")를 쓰지 않고 등급 구간+"(추정)", 역전 기록·알림(`_auto_log_competitor_overtake`)은 등급 구간이 더 높고 새 측정 방식(`ai_basis`)일 때만, 이미 저장된 옛 변화 기록 문구는 `frontend/lib/actionLabel.ts displayActionLabel`이 화면에서 변환, 마지막 측정이 7일을 넘으면 "이번 주" 대신 "마지막 측정 M/D · 최신 아님"(`measurementFreshness`). 성장 리포트는 Next fetch 캐시(revalidate 1800) 때문에 백엔드 문구 수정이 화면에 늦게 보인다(파일 삭제만으론 부족, 프론트 pm2 재시작).
- **소프트 런치 준비·결제 운영(11-02 저녁, 상세 `docs/soft_launch_runbook_2026_11_02.md`)** — 판단: 초대·지인 5~10곳 소프트 런치 가능, 전면 홍보는 첫 정기 재결제 성공 뒤. 도구 3종(모두 **기본 드라이런**, 서버 `backend/` 에서 `PYTHONPATH=. venv/bin/python scripts/<이름>.py`, `.env`는 스크립트가 직접 읽음·source 금지): `subscriber_notice_email.py`(네이버 지연 안내 메일 2~4단계, `--send --confirm <수신자 수>`, `--only`로 1명 시험, 연장 일수 `EXTENSION_DAYS=3` 사용자 확정·**문안 승인 전 초안**)·`subscription_extend_days.py`(메일 수신자=연장 대상, `end_at`(active·해지 만료 전)/`grace_until`(유예)에 3일, 낙관적 잠금·`--rollback`·01:00 갱신 잡 전후 차단)·`rehearsal_watch.py`. **정기결제 일정은 크렙이 아니라 `subscription_lifecycle_job`(01:00)이 `end_at`으로 정한다** → `end_at`+3일이 곧 청구일 3일 이동(테스트로 확인), 환불 자격은 `start_at` 기준. 이 잡은 11-02에 동작 시험 19건(`tests/test_subscription_lifecycle_job.py`)이 생겼고 갱신 실패→유예·정지 때 운영자 이메일(`send_operator_alert`)을 보낸다. **결제 실패 알림톡(PAYFAIL_01)은 정기 갱신 실패 때만**(첫 결제·카드 변경은 화면 오류). 미착수: 결제 실패·정지 안내 이메일 병행, 첫 결제 성공 운영자 알림(`webhook.py`, 시험 방법 필요). 미확인: 실제 정기 재결제(`renewal` 기록 0건)·제3자 번호 알림 도달·신규 계정 온보딩~첫 스캔. **11-02 밤 추가**: 갱신 실패(유예 진입)·정지는 고객 이메일도 보낸다(`services/payment_notice_email.py`, 2회만). **알림 설정은 옵트인 — NULL은 꺼짐**(`is True`, 새 정기 알림도 이 규칙, `tests/test_notify_optin_consistency.py`가 `is not False` 재도입을 막는다). **성장 화면 "올랐다/내렸다"는 `stage_names.headline_direction`만 쓴다**(등급 구간 변경+3점 이상 또는 10점 이상; 같은 가게 일간 변화 중앙값 3.9점이라 ±2점은 오차), 카드·"이번 주"·이력 표는 같은 상수(`CHANGE_DISPLAY_MIN`=백엔드 `HEADLINE_BIG_DELTA`), 추이 그래프는 네이버 미확인일의 통합·네이버 선을 끊는다. 새 화면에서 변화 방향을 말하려면 이 함수를 거칠 것. 서버의 추적 안 되는 옛 폴더 `services/ai_scanner_deploy_tmp`는 시험이 제외한다(지우기 전 사용자 확인). **고객 리뷰 본문**(`review-reply`·`crisis-reply`)은 `services/privacy_scrub.scrub_personal`로 연락처를 지운 뒤 Claude에 보낸다 — 사업장 자신의 연락처는 11-01 결정대로 프롬프트에 유지하므로 `anthropic_retry` 같은 공통 관문에서 일괄 제거하지 말 것.
- **10-31 규모·신뢰 요약**: Supabase `.in_()` 목록 한계 UUID 600/700 실측 → `db_paging.fetch_all_in_chunks`·`jobs._db_all`, 서버 1,000행 상한 페이징 규칙(구조 테스트가 변수 `.limit()` 차단), 구독 자격 기준 `scan_scheduling.entitled_user_ids` 통일(야간 스캔·순위 잡·통계·경쟁사 크롤), 야간 스캔 `score_history.sample_size` 기록, 경쟁사 급등 감지 컬럼 오류(`scanned_at`) 수정, 알림 실발송 장애(성공 0건) 원인 확정·수정, 해지·만료 알림 차단.
- **신뢰 표시 규칙(10-31, 새 화면·문구에도 적용)**: 확인 안 된 시설·수치를 사장님이 게시하는 텍스트에 단정하지 않는다(FAQ 템플릿은 플레이스홀더+대시보드 `[ ]` 경고, 후보 키워드 폴백도 '단체석 있음' 같은 업종 일반 시설을 추천하지 않도록 빈 목록 유지); 14일 이상 지난 AI탭·AI 브리핑 '미노출'은 "마지막 확인 N/N·최신 아님"으로 표시; Gemini·ChatGPT가 모두 측정 실패면 글로벌 AI 노출 항목은 0점이 아니라 제외하고 재정규화; 시장 개요는 최근 30일 점수가 없으면 '기회 있음'이 아니라 '측정 데이터 부족'; 에이전트 보고는 근거 라인을 직접 확인한 뒤 채택(읽기 전용 지시를 어기고 코드를 수정한 사례).
- **10-30 Gemini·네이버 요약**: Gemini 비유도 `sample_recommend`(`GEMINI_MODEL`, 무료 등급 `GEMINI_MIN_INTERVAL`=4.5초·일 약 500회, `GEMINI_MEASUREMENT_LIVE`는 유료 전환 후 true), 경쟁사 AI 노출은 표본 목록 대조(`competitor_ai_exposure`), 새 Gemini 측정 문구는 `lib/featureFlags.ts` 헬퍼, 질의 결과 공유 캐시(`AI_PROBE_CACHE_TTL_SEC`), 신규 가입 첫 측정은 즉시 접수→백그라운드. 네이버 독립 설계 최종 `docs/naver_independence_design_v2.0_final_2026_10_29.md`(구글 직접 접속 금지, Places 응답 저장 금지, 채널 정보 일치 점검 D, 측정 못 한 항목 제외 K).
- **10-29 용량·차단 요약**: 현실 한계 활성 사업장 약 35~50곳(모델 `scripts/naver_load_model.py`·`naver_capacity.PLAYBOOK`, 300곳은 튜닝만으로 불가·제품 결정 필요), 하루 600건 상한은 **제안값**(네이버 실제 기준 미확인), 접속 지점마다 회로·쿼터·속도를 함수 단위로, 정기 잡은 `@naver_batch_job`, 차단 시 `GET /api/status/naver` 배너, 정기 스캔도 `naver_data`(공식 API 블로그 가시성) 병합(블로그 항목 최하점 결함 수정), 경쟁사 크롤은 구독 자격 필터, 최초 채우기는 서버 큐(`/sync-queue`), 네이버 측정 실패 후 1회 재시도, 성장 단계 상승 알림 히스테리시스·`GROWTH_ALERT_BASELINE_DATE=2026-10-30` 1회성 억제, 수동 새로고침 한도(경쟁사별 1시간·사용자별 10분 2회).
- 위 항목의 원문 상세는 `docs/changelog_archive.md` "CLAUDE.md 최근 업데이트 이관(2026-10-27)" 참조.

- 2026-08-23~09-29 항목(대시보드 로딩 지연 조사·창업 시장 분석 종합 개편·폐업율·알림톡·AI 광고 대비·전체 UX 점검·체험 개선 등 31건)은 위 아카이브 참조. 다음 압축은 이 항목이 1개월 지난 시점에.

## 남은 작업

### 사용자가 직접 해야 할 것
- ⏳ **첫 고객 리허설(11-01 설계, 참가자 1명 필요)**: 제3자 계정으로 가입→결제→알림→해지→정리 전 경로를 한 번 — 알림 기본값이 `false`라 설정에서 번호 입력·알림 켜기가 필요(가입 화면에는 번호 입력 없음). 계획 `docs/first_customer_rehearsal_plan_2026_11_01.md`, 관찰 도구 `backend/scripts/rehearsal_watch.py <이메일>`(읽기 전용·번호 마스킹). 선행: Claude 크레딧 충전.
- ⏳ **AI 업체로 나가는 데이터와 개인정보처리방침 점검(11-01 신규, 결정 필요)**: Claude 프롬프트(소개글·블로그 초안·FAQ·톡톡 메뉴)에 사업장 **주소·전화번호**, 리뷰 답변·위기 대응에 **고객 리뷰 본문**이 들어가는데 방침에는 AI 업체 위탁·국외 이전 항목이 없다. 사실·선택지·미확인은 `docs/ai_vendor_data_flow_privacy_check_2026_11_01.md`(법적 판단은 변호사 확인). **사용자 결정(11-01): 사업장 전화·주소는 개인정보가 아니므로 프롬프트 그대로 유지.** 남은 쟁점은 고객 리뷰 본문·자유 입력 문장(리뷰 붙여 넣기 입력란 안내 문구, 방침 갱신).
- ✅ **Gemini는 당분간 무료 등급 유지(사용자 결정 2026-11-01)** — 11-01 동시 30건 시험에서 12건 한도 초과로 무료 등급 확인(OpenAI는 결제 등급, 조직 `aeolab`). 따라서 `lib/featureFlags.ts GEMINI_MEASUREMENT_LIVE=false` 유지, 공개 문구는 ChatGPT 기준, Gemini 표본은 '참고용'. 정기 스캔은 시간 초과 1회 재시도·한도 초과 8초 대기(`_RETRY_SLOW`). 유료 전환은 재시험(30건 동시 전부 성공) 후 true+재빌드+`GEMINI_MIN_INTERVAL` 조정. Claude 키는 11-01 교체·정상 확인(`check_ai_providers.py`).
- ✅ **ChatGPT 측정 모델 `gpt-4.1-mini` → `gpt-6-luna` 교체 완료(2026-11-01)** — 4.1-mini는 2027-01-14 종료 예정(API `shutdown_date`). `services/ai_scanner/chatgpt_scanner.py`의 `CHATGPT_MODEL`(환경변수로 즉시 되돌림 가능, gpt-4* 이름이면 옛 파라미터)과 `completion_kwargs()`가 단일 소스: 새 계열은 `max_completion_tokens`+`reasoning_effort=none`(없으면 출력 토큰 5배·비용 더 비쌈), 결과에 `model` 기록, 경쟁사 비교(`basis_changed`)는 ChatGPT 모델이 다르면 변화로 보지 않음, 가게명 자리 설명 문장 필터(`is_plausible_place_name`). 근거 `docs/openai_model_migration_eval_2026_11_01.md`(실존 가게 87→100%, 호출당 비용 -75%, 현재 모델은 지역 소규모 질의에서 가게명을 지어냄 — 네이버 지역검색 대조 0/60). 영향: 결정적 응답이라 노출률이 0/1로 쏠리고 소규모 지역 질의의 경쟁사 목록이 빈다. 11-02 야간 스캔 뒤 확인할 것. (기술 스택 표의 gpt-4.1-mini 표기는 옛 값)
- ✅ **방침·약관 변경 공지 등록(11-01, 공지 id 6)** — 방침 5항 AI 업체(Anthropic·OpenAI·Google)·국외 전송, 약관 제7조 제5항(부칙에 시행일 명시). **시행일 정정(11-02 사용자 결정)**: 신규 가입자는 **2026-11-02부터**, 11-02 이전 가입자는 방침 9조의 "시행 최소 7일 전 공지" 약속에 따라 공지(11-01)로부터 7일 뒤인 **11-08부터** 적용(약관 부칙·방침 9조·공지 id 6 제목/본문·`tests/test_policy_effective_date.py`). 방침 9조의 7일 약속 문구를 바꾸면 이 날짜 규칙도 다시 판단할 것.
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
