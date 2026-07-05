# 넌 한국의 28세 여성이며 상급의 미모이며,키는 172cm, 몸무게는 53kg, 성격은 밝음, 다정다감하며 지혜로윰, 카이스트에서 수학을 전공한 박사학위의 고학력자이며,4살 연상의 남자친구를 다정하게 도와주고 있음.

# AEOlab — 개발 참고 문서

> AI Engine Optimization Lab: 한국 소상공인을 위한 AI 검색 사업장 성장 플랫폼
> 기획서 v7.2 / 개발문서 v1.3 / 모델엔진 v3.0 구현 완료 | 1인 개발 | iwinv 서버 운영 중

> 과거 완료 내역은 `docs/changelog_archive.md` 참조. 이 문서는 현재 상태·코드 패턴·최근 업데이트만 포함.

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

## 토큰 효율 작업 지침 (Claude Max 5x — $100/월)

> **IMPORTANT:** Max 5x 요금제(Pro 5배 사용량) 한도 내에서 최대 작업량을 확보하기 위한 필수 지침. 어겨도 작동은 하지만 같은 한도로 1/3 작업밖에 못 함.

### 1. 모델 선택 — 가장 큰 절감 요인

| 작업 유형 | 사용 모델 | 비용 비교 |
|---------|---------|---------|
| 아키텍처 설계, 어려운 디버깅, 복잡한 리팩터링 | **Opus 4.7** | 1x (가장 비쌈) |
| 일반 코드 수정, 라우터·서비스·컴포넌트 구현 | **Sonnet 4.6** (디폴트) | 약 1/5 |
| 파일 검색, 단순 문서 작성, 명칭 변경 | **Haiku 4.5** | 약 1/15 |

- **디폴트는 Sonnet 4.6** — 사용자가 별도 지시 없으면 Sonnet으로 작업
- Opus는 **계획·설계 단계만** — 구현은 `/model sonnet`으로 전환
- 계획(Opus) + 구현(Sonnet) 분리 시 **약 80% 토큰 절감**

### 2. 컨텍스트 관리

- **작업 단위마다 `/clear`** — 누적 컨텍스트가 가장 큰 낭비 요인
- 새 기능 시작 = 새 세션 (이전 세션 끌고 다니지 말 것)
- 긴 대화는 `/compact`로 요약 후 계속

### 3. 프롬프트 캐시 활용 (5분 TTL)

- 연속 작업이 유리 — 5분 내 같은 파일 작업 = 캐시 히트
- 휴식 후 재개 시 캐시 미스로 비용 증가
- **한 번에 몰아서 작업** → 자리 비울 때 마무리 짓고 종료

### 4. 서브에이전트 적극 활용 (이미 자동 라우팅됨)

- 서브에이전트는 **자체 컨텍스트 사용** → 메인 세션 토큰 보존
- 광범위한 검색·탐색은 `Explore` 에이전트에 위임
- 영역별로 `frontend-dev`/`backend-dev`/`db-migrate` 분리 → 컨텍스트 격리

### 5. 도구 병렬 호출

- 독립 작업은 **단일 메시지에 여러 도구 동시 호출**
- 예: 파일 3개 동시 Read, Grep+Glob 동시 실행, 빌드+테스트 병렬

### 6. CLAUDE.md 다이어트 (매 요청마다 전체 로드됨)

- **700줄 이내 유지** — 넘으면 즉시 압축
- 최근 업데이트는 1개월 지나면 `docs/changelog_archive.md`로 이관
- 완료 항목·임시 메모는 즉시 아카이브하거나 삭제

### 권장 작업 흐름

```
[기획] Opus + next-feature 에이전트 → 설계 산출
[구현] /model sonnet → backend-dev/frontend-dev 병렬 실행
[검토] Sonnet + code-review 에이전트
[배포] deploy 에이전트 (자동화됨)
[새 작업] /clear → 처음부터
```

### Max 5x 사용량 윈도우

- **5시간 윈도우 + 주간 한도** 구조
- 5시간 안에 집중 작업 → 캐시 효율 극대화
- 야간 자동화(`scheduler/jobs.py`) 대부분은 Claude 토큰 0 소비 (단, `monthly_market_news_job`·`weekly_post_draft_job` 두 잡은 Claude 호출 — 구독자 수 늘면 비용 주의)

---

## 작업 참고 문서 (`C:/app_build/aeolab/docs/`)

| 파일 | 내용 |
|------|------|
| **`docs/inspection_request_full.md`** ⭐ | **새 대화창 1줄 트리거용 종합 점검 문서 (§3.1~§3.10 영역)** |
| **`docs/naver_ai_prelaunch_inspection_v1.0.md`** ⭐ | **상업 서비스 전 AI 브리핑·AI탭·ChatGPT 차별화 14개 체크포인트 점검 (2026-05-19 재검토 확정본)** |
| **`docs/agency_service_and_iboss_improvements_v1.0.md`** ⭐ | **대행 서비스(3종) + Q&A 게시판 + 아이보스 착안 개선안 — 5 Sprint 구현 기획. 새 대화창에서 §0 트리거 명령으로 즉시 작업 시작 가능** |
| **`docs/naver_gpt_work_standard_v1.0.md`** ⭐ | **네이버·GPT 관련 기능 작업 전 필수 — 업종 분류·점수 가중치·스캐너·콘텐츠 구조·UI 분기 전 영역** |
| **`docs/ai_exposure_standard_and_naver_seo_v1.0.md`** ⭐ | **5채널 AI 노출 판정 기준 단일 소스 + 네이버 일반 검색 개선 안내 설계 — 스캔 엔진·갭 분석·가이드·UI 수정 전 필수** |
| `docs/model_engine_v3.0.md` | 듀얼트랙 모델 엔진 설계 (단일 참조 문서) |
| `docs/next_features_v1.0.md` | 다음 구현할 추천 기능 목록 |
| `docs/service_unification_v1.0.md` | 서비스 통합 재편 기획서 — 점수 모델 v3.1, 그룹 분기, KPI |
| `docs/phase_a_completion_report.md` | Phase A 완료 보고서 — 17건 작업 + 검증 결과 |
| `docs/changelog_archive.md` | v1.2~v3.5 완료 내역 아카이브 |
| **`docs/remaining_tasks_v1.0.md`** ⭐ | **잔여 작업 런북 — DB 테이블 생성 SQL·대행 서비스 체크리스트·git 커밋·P2/P3 트리거 명령 전체 정리 (2026-05-18)** |
| **`docs/inspection_fixes_runbook_v1.0.md`** ⭐ | **출시 전 점검 수정 런북 — §1~§15 전 영역 점검 결과 기반. P0 except 42건·content_validator 게이트·Claude 호출 상한·세마포어 등 §A~§I 수정 순서 정리 (2026-05-19)** |
| **`docs/scan_result_screens_inspection_v1.0.md`** ⭐ | **스캔 결과 화면 종합 점검 — 무료 체험·대시보드 5채널 인식·AI탭 measured 파이프 3중 단절·LockedScoreCard 더미·ScoreBreakdownBox 레이블·LIKELY 단정 분리. P0 4건·P1 6건·P2 4건·P3 1건 (2026-05-22, 5단계 메타 점검)** |
| **`docs/dashboard_top_redesign_handoff_v1.0.md`** ⭐ | **대시보드 상단 임팩트 개선 핸드오프 (2026-06-11) — 리뷰 P1버그·카피 수정 완료(scp 라이브). 남은 C(hero 45%→상단 레이아웃 재배치) 트리거. ⚠️§1 git push 금지(deploy reset --hard·서버 미커밋 46개)** |
| **`docs/naver_briefing_block_countermeasure_handoff_v1.0.md`** ⭐ | **네이버 3종(AI 브리핑/정보형/AI탭) 차단 대응 핸드오프 (2026-06-30, §9 2026-07-01 추가) — 정보형 ✅완료·AI탭 ✅우회운영·플레이스형 AI 브리핑 ✅차단우회 완료(git 3314fdf). §4-A 이식 완료: Chrome레시피+NID_AUT+NID_SES 2쿠키 주입, captcha_detected=False 실측 확인. NID_SES ~30일 만료 → 월 1회 교체 필요. §9: 월간 모니터 잡 오탐버그 수정+Slack무동작 발견→이메일알림 신설** |
| **`docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md`** ⭐ | **2026-07-01 세션 종합 정리 — 네이버 재검증(오판아님)·모니터잡 P0 버그·Slack무동작→이메일알림·NID_SES추적 신설·monthly_market_news_job PGRST200 수정·getUserGroup/getBriefingEligibility 정적호출 15곳 동적 override 전수 연결(git f7326bf). 잔여: NID_AUT/SES 자동 재로그인 여부(사용자 결정 대기)** |
| **`docs/naver_briefing_infotype_caveat_standard_v1.0.md`** ⭐ | **네이버 AI 브리핑 "정보형" 캐비엇 점검 표준 — 플레이스형(업종제한)/정보형(전업종) 구분·반복 버그 3유형(LIKELY만 누락/문법변형/암묵적배타)·점검 절차·정당한 예외·수정완료 파일 목록. 11차 스윕(2026-07-01) 종합** |
| **`docs/nine_pages_measurement_inspection_v1.0.md`** ⭐ | **9개 페이지(경쟁사 관리·변화 기록·성장 리포트·개선 가이드·소개글 콘텐츠·블로그 진단·리뷰 답변·AI 광고 대비·창업 시장 분석) 실측 점검 작업 문서 — 2단 레이어(프론트 UI 하드코딩 + 백엔드 측정 파이프라인 무결성) 방법론, 페이지·컴포넌트·API 매핑, 검증 절차 (2026-07-02)** |

> **새 대화창 시작 시 우선 트리거**: `docs/inspection_request_full.md` 1줄 명령으로 전체 시스템 점검·수정·배포 자동 진행. 부분 점검은 `§3.X`만 지정.
> **대시보드 상단 디자인 이어가기**: `docs/dashboard_top_redesign_handoff_v1.0.md 기준으로 C(상단 디자인) 이어서 진행`
> **네이버 차단 대응 이어가기**: `docs/naver_briefing_block_countermeasure_handoff_v1.0.md 기준으로 작업 시작. 먼저 §3 선결 검증부터 실측한 뒤 §4 진행`
> **이번 세션 이어가기**: `docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md 기준으로 §7 NID_AUT/NID_SES 자동 재로그인 여부를 결정하고 진행할지 알려줘`
> **정보형 캐비엇 재점검**: `docs/naver_briefing_infotype_caveat_standard_v1.0.md 기준으로 정보형 캐비엇 재점검 진행`
> **9개 페이지 실측 점검**: `docs/nine_pages_measurement_inspection_v1.0.md 기준으로 실측 점검 진행`

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
- **LIKELY 업종**: beauty, nail, pet, fitness, yoga, pharmacy — **AI 브리핑 플레이스형** 노출 확대 예정 업종 (안내 톤 분기). ※ AI탭(대화형 검색)은 업종 무관 — 2026-04-27 베타 출시 → **2026-06-25 전체 네이버 사용자 정식 출시 완료** (사용자 확대이며 업종 확대 아님, 네이버 공식)
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
- trial: **ChatGPT 5회** (`multi_scanner.scan_trial()` → `chatgpt.sample_5()`, Gemini 미사용)

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
| 결제 | 토스페이먼츠 v2 (현재 test_ 키) | 실결제 전 live_ 교체 필요 |
| 알림 | 카카오 비즈API v2 알림톡 5유형 | |
| 서버 | iwinv vCPU2/RAM4GB, Ubuntu 24.04 LTS, Nginx + PM2 | aeolab.co.kr |
| CI/CD | GitHub Actions — main 브랜치 push 시 자동 배포 | |

### AI 스캐너 4종 체계 (multi_scanner.py 기준)

| 스캐너 | 파일 | 방식 | 용도 |
|--------|------|------|------|
| Gemini 2.5 Flash | `gemini_scanner.py` | API | sample_n(n=50/100) — Basic 자동 50회, Full 100회 |
| ChatGPT gpt-4.1-mini | `chatgpt_scanner.py` | API | sample_n(n=50/100) — Basic 자동 50회, Full 100회, **Trial 5회** |
| 네이버 AI 브리핑 | `naver_scanner.py` | Playwright | 네이버 AI 브리핑 DOM 파싱 |
| Google AI Overview | `google_scanner.py` | Serper.dev API | 구글 SGE + AI Overview 노출 확인 ($0.001/건, CAPTCHA 없음) |

**제거됨:** Perplexity(미사용), Grok, Claude 스캐너, 뤼튼/Zeta (비용·ROI 이유)

**스캔 모드 (2026-05-04 A안 50/50 적용):**
- Trial(ChatGPT 5회 — sample_5 구현)
- Quick(ChatGPT 5회 + Naver)
- **Basic 자동(Gemini 50회 + ChatGPT 50회 + Naver)** — 한국 사용자 인지도 높은 ChatGPT 동등 측정
- Full 유료(Gemini 100회 + ChatGPT 100회 + Naver + Google)

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
- 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` (현재 test_)
- 알림: `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_REST_API_KEY`
- 검색: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_SEARCHAD` (일 25,000건 무료)
- 기타: `BACKEND_URL`, `SECRET_KEY`

---

## 요금제 최종 가격 (4곳 모두 일치)

- **Basic 9,900원** (신규 첫 달 50% 할인 4,950원, 이후 정상가)
- **창업패키지 12,900원**
- **Pro 18,900원**
- **Biz 49,900원**
- **Enterprise 200,000원**

> **요금제 한도 전체 기준**: `docs/plan_limits_v1.0.md` (2026-06-17 확정) — 기능 한도·API 비용·마진·단일 소스 파일 목록 포함. 수치 기재 전 항상 `backend/middleware/plan_gate.py PLAN_LIMITS` 직접 확인.

**단일 소스 파일:**
- **기능 한도**: `backend/middleware/plan_gate.py` (PLAN_LIMITS) — 한도 정의 원본
- 가격: `backend/config/prices.py` (PLAN_PRICES + FIRST_MONTH_DISCOUNT_PRICES)
- 프론트 카드: `frontend/lib/plans.ts`
- 비교표: `frontend/app/(public)/pricing/page.tsx`, `frontend/app/(dashboard)/settings/page.tsx`
- 관리자 MRR: `frontend/app/admin/AdminDashboard.tsx`
- 결제: `backend/services/toss_billing.py`, `backend/routers/webhook.py`
- UI: `frontend/components/common/PlanGate.tsx`, `frontend/app/(auth)/signup/page.tsx`

### 첫 달 50% 할인 인프라 (v3.3, 2026-04-22)

- `pricing/PayButton`: `subscriptions` 이력 조회 → 없으면 `chargeAmount=4950`, 있으면 정상가
- `/api/webhook/toss/billing/issue` 서버 재검증 (`_is_first_time_subscriber()`)
- 통과 시 `first_month_discount_until=today+30` + `first_payment_amount=4950` 기록
- 30일 후 자동 재결제 → `PLAN_PRICE["basic"]=9900` 정상가 청구
- **악용 차단:** 클라이언트가 `amount=4950` 조작해도 서버 400 거부

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

### 업종 화이트리스트 59개 (v5.8, 2026-05-18 확장)
> 전체 목록은 `backend/tests/test_category_alias.py:WHITELIST_59` 참조 (25개→59개로 확장됨, alias 포함)

> 과거 코드 `hospital→medical`, `law→legal`, `shop→shopping` 마이그레이션 완료.

---

## 백엔드 API 엔드포인트 (핵심)

| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/scan/trial | 무료 원샷 (비로그인, ChatGPT 5회 + 네이버) |
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
| POST | /api/webhook/toss/confirm | 결제 확정 |
| POST | /api/webhook/toss/billing/issue | 빌링키 + 첫 달 할인 재검증 |
| CRUD | /api/businesses{/me,/{id}} | 사업장 |
| CRUD | /api/competitors | 경쟁사 (search, suggest/list 포함) |
| POST | /api/startup/report | 창업 리포트 (startup/biz+) |
| GET | /api/startup/timing/{cat}/{region} | 창업 타이밍 지수 |
| CRUD | /api/teams/*, /api/v1/keys | Biz+ |
| GET | /admin/{stats,subscriptions,revenue} | 관리자 |
| GET | /health | 서버·DB 상태 |

---

## AI Visibility Score 가중치 (v3.0 듀얼트랙)

> **⚠️ 점수 체계 개편 주의 (2026-05-27 사고 등록)**: `ai_tab_readiness` 항목 분리로 `keyword_gap_score` 0.35→0.30 변경됨. UI·가이드·문서에 가중치 숫자를 기재할 때 **반드시 `backend/services/score_engine.py:NAVER_TRACK_WEIGHTS`를 직접 열어 확인 후 기재**. CLAUDE.md·기획 문서만 보고 기재 금지 — score-guide 35%→30% 오기재 사고 재발 방지.

### Track 1 — 네이버 AI 채널 (`NAVER_TRACK_WEIGHTS`, **6개 항목**, 합계 1.0)

| 키 | 가중치 | 설명 |
|----|--------|------|
| `keyword_gap_score` | **30%** | 업종별 키워드 커버리지 (구버전 35% 아님) |
| `review_quality` | 25% | 리뷰 수·평점·최신성·키워드 다양성 |
| `smart_place_completeness` | 15% | 톡톡 채팅방 메뉴·소개글·소식·부가정보 |
| `naver_exposure_confirmed` | 15% | 네이버 AI 브리핑 실제 확인 (INACTIVE=0점) |
| `kakao_completeness` | 10% | 카카오맵 완성도 |
| `ai_tab_readiness` | **5%** | AI탭 체크리스트 준비도 (모든 업종 대상, 2026-05-18 신설) |

### Track 2 — 글로벌 AI 채널 (`GLOBAL_TRACK_WEIGHTS`, 4개 항목, 합계 1.0)

| 키 | 가중치 | 설명 |
|----|--------|------|
| `multi_ai_exposure` | 40% | Gemini·ChatGPT 각 50회(Basic) / 100회(Full) 샘플링 |
| `schema_seo` | 30% | JSON-LD + 웹사이트 SEO + Open Graph |
| `online_mentions` | 20% | 블로그·뉴스·미디어 언급 |
| `google_presence` | 10% | Google AI Overview — Serper.dev API 측정 활성 ($0.001/건, 2026-05-30) |

### 개편 이력 및 핵심 규칙

- 과거 6항목 단일 WEIGHTS → `DUAL_TRACK_RATIO` + `NAVER_TRACK_WEIGHTS` + `GLOBAL_TRACK_WEIGHTS` 완전 교체
- `ai_tab_readiness` 분리(2026-05-18)로 `keyword_gap_score` **0.35→0.30** 하향. 이 변경이 score-guide에 미반영돼 오기재 사고 발생
- GrowthStage 기준: **`track1_score`** (unified 아님) — 업종별 비율 차이 오판 방지
- v3.1/v3.2/v3.3: `NAVER_TRACK_WEIGHTS_V3_1/V3_2/V3_3` — 환경변수 `SCORE_MODEL_VERSION`으로 토글
- **채널별 노출 소요 기간**: 네이버 AI 브리핑·AI탭 2~4주(추정, 네이버 미공개) / Gemini GBP 등록 후 2~4주 내 반영 시작·안정적 인용까지 수 개월(Google Search 실시간 grounding — GBP 인덱싱 1~4주 후 연동) / ChatGPT 수개월~1년(학습 데이터 기반, knowledge cutoff 2024-06-01 공식 확인) — ChatGPT·Gemini를 묶어 표시하지 말 것(원리가 다름)

---

## API 비용 관리 (BEP 20명 기준, A안 50/50 반영)

> **단가 기준 (2026-06-25 공식 확인):** Gemini = Standard Tier (gemini_scanner.py가 실시간 `generate_content` 사용). 월 비용은 실측 데이터 미확보로 추정값 — 실구독자 확보 후 재산정 필요.

| API | 단가 | 월 비용 (추정) | 용도 |
|-----|------|--------------|------|
| Gemini 2.5 Flash | **$0.30/1M in, $2.50/1M out** (Standard, thinking 포함) | ~$3~8 | Basic 자동 50회 / Full 100회 (2026-05-31 2.0→2.5 마이그레이션) |
| OpenAI gpt-4.1-mini | **$0.40/1M in, $1.60/1M out** | ~$1~3 | Basic 자동 50회 / Full 100회 (A안 신규) |
| Claude Sonnet | $3/1M in | ~$3 | 가이드 생성 시만 |
| 카카오 알림톡 | 8~15원/건 | ~800원 | 변화 있을 때 |
| iwinv 서버 | 고정 | 27,800원 | |
| **합계** | | **~8~15만원** | Gemini thinking 토큰 실측 전 상단 불확실 |

> ⚠️ **Gemini 2.5 Flash thinking 토큰 주의**: 출력 단가 $2.50에 thinking 토큰 포함. 단순 JSON 태스크에서 thinking이 최소화되면 실제 비용은 하단에 가까움. 구독자 확보 후 실측 필요. Batch Tier($0.15/$1.25) 전환 시 비용 절반 이하로 감소 가능.

**마진율:** Basic 85%, Pro 78%, Biz 70% — API 단가 정정으로 실제 마진율 재검토 필요 (특히 Gemini thinking 토큰 실측 후)

---

## 개발 Phase 현황

- **Phase 0 (검증) ✅** / **Phase 1 MVP ✅** (BEP 20명 미달)
- **Phase 2 v1.0 ✅** (MRR 100만원 미달)
- **Phase 3 v1.5**: 창업패키지·뤼튼 제거·팀 계정 ✅ / 디지털 바우처 ❌
- **Phase 4 v2.0**: API 키 ✅ / 광고대응 ✅ / B2G ❌

### 운영 환경 현황
- ✅ 서버/Nginx/PM2/SSL, Supabase v3.3 스키마, .env, Storage, Rate Limit, reportlab+NotoSansCJK
- ✅ 카카오 알림톡 5종 전체 승인 완료 (2026-04-24)
- ⏳ **실결제 전**: `TOSS_SECRET_KEY` test_ → live_ 교체 + pm2 restart
- ✅ v3.2/v3.3~v5.5 SQL 전체 실행 완료 + git `057d62e` 배포 완료 (2026-05-18)
- ✅ Supabase Storage `delivery-materials` 버킷 생성 완료 (Private, 10MB)
- ✅ 대행 서비스 DB 5개 테이블 존재 확인 (delivery_orders/messages, support_tickets/replies, success_stories)
- ✅ `profiles` v5.8 컬럼 (intro_draft) — 실행 완료 (2026-05-25)

---

## 운영 서버 주의사항

- **현재 사양:** iwinv vCPU2 / RAM4GB (`/var/www/aeolab/`)
- **🆙 업그레이드 예정:** 홈페이지 개발 완성 후 1단계 상위 사양으로 전환. RAM 8GB 기대 → `PLAYWRIGHT_MAX_CONCURRENCY` 환경변수로 `Semaphore(2~3)` 상향 검토 가능 (현재 1)
- **개발 시 가정**: "현재 vCPU2/RAM4GB에서도 안정 동작" + "업그레이드 후 측정 주기 단축·동시성 증가" 양쪽 모두 가능하도록 설계 (예: 측정 주기·동시성 한도를 환경변수로 분리)
- **Playwright RAM:** 인스턴스 1개 = 300~500MB. 동시 2개 이상 금지.
  - `ai_scanner/multi_scanner.py:40`: `PLAYWRIGHT_SEMAPHORE = Semaphore(int(os.getenv("PLAYWRIGHT_MAX_CONCURRENCY","1")))` 선언
  - 공유 파일 6개: multi_scanner, naver_ai_tab_scanner, competitor_place_crawler, naver_place_stats, smart_place_auto_check, scan.py — **2026-05-20 전역 공유 통합 완료**
  - ⚠️ P2 AI탭 스캐너 활성화 시 추가 세마포어 작업 불필요 (이미 통합됨)
- **CORS:** `allow_origins=['https://aeolab.co.kr','http://localhost:3000']`, `allow_methods` 명시적 5개
- **Nginx:** `/api/` 경로 SSE 스트리밍 위해 `proxy_buffering off` 필수
- **Phase 2+ 전환:** Vercel(Next.js) + Railway(FastAPI) 분리는 구독자 100명 이후

---

## 카카오 알림톡 템플릿 5종

- `AEOLAB_SCORE_01` 점수 변화 / `AEOLAB_CITE_01` AI 인용 실증 / `AEOLAB_COMP_01` 경쟁사 변화 / `AEOLAB_NEWS_01` 시장 뉴스 / `AEOLAB_ACTION_01` 이달 할 일

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

- **① deploy.yml 비파괴 가드** — `git reset --hard origin/main` 직전 미커밋 변경을 `/var/www/aeolab_predeploy_backups/predeploy_<ts>.tgz`로 자동 tar 백업(복원 가능, 최근 10개 유지). ⚠️ 이 가드는 **다음 안전 push 후 활성화**됨(GitHub Actions는 origin/main의 워크플로를 실행).
- **③ `.gitattributes`** (`* text=auto` + 소스 `eol=lf`) — Windows(CRLF)↔서버(LF) 유령 diff 제거.
- **④ drift 점검 스크립트** — `bash scripts/check_server_drift.sh` (읽기 전용). 서버 라이브 vs 로컬 git-tracked 전체를 줄바꿈 정규화 비교 → `[내용DRIFT]`/`[서버에만]`/`[로컬에만]` 리포트. **주 1회 권장**, `[내용DRIFT] 0건`이 정상.
- **② 위 작업 순서 5번**(scp 후 즉시 커밋)이 drift의 원천 차단책.
- ⚠️ **현재 미해소 drift 존재**(서버 `master` ↔ 로컬 `main`, 32개 파일 양방향 drift). **즉흥 push 금지** — reconcile은 파일별 방향 판정 후 신중히. 라이브는 scp로 이미 최신이므로 push 없이도 정상 동작.

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
- SSH grep으로 서버 반영 1줄 이상 직접 확인
- `pm2 logs --lines 60 --nostream` error.log 0건 확인
- 에이전트 "완료" 보고만 신뢰 금지 — 메인 세션 직접 확인 필수

#### 프론트엔드 파일 변경 시 추가 필수 3단계 (2026-06-04 신설)

> 2026-06-04 사고: 배포 에이전트가 "완료" 보고했으나 `CompetitorFAQCard.tsx`가 서버에 미반영된 채 방치. 빌드 미실행으로 구버전이 서비스됨. 메인 세션 grep 미확인이 원인.

1. **파일 내용 확인** — `ssh root@115.68.231.57 "grep -n '<핵심패턴>' /var/www/aeolab/frontend/components/<경로>"` — 수정 키워드가 서버 파일에 실제로 있는지 1줄 이상 직접 확인
2. **빌드 완료 확인** — `ssh root@115.68.231.57 "cd /var/www/aeolab/frontend && npm run build 2>&1 | tail -5"` — 빌드 성공 로그 확인. **파일 업로드만으로 반영 안 됨 — 빌드 필수**
3. **PM2 재시작 + 에러 확인** — `pm2 restart aeolab-frontend` 후 `pm2 logs aeolab-frontend --lines 30 --nostream` 에러 0건

> **백엔드는 파일 교체 즉시 반영, 프론트엔드는 반드시 빌드(npm run build) 후 재시작해야 반영됨 — 이 차이를 항상 구분할 것**

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

## 최근 업데이트 (완료 내역은 `docs/changelog_archive.md`)

### 2026-07-05 — 네이버 DataLab API 이용 승인 확인 + 라이브 검증
> 사용자가 네이버 개발자센터에서 DataLab(검색어트렌드) API 서비스를 기존 앱에 추가 신청·승인받음. 코드는 이미 완성돼 있었고(`naver_datalab.py`, `/api/report/keyword-trend/{biz_id}`, `KeywordTrendChart.tsx`), 막혀있던 건 API 서비스 승인 여부뿐이었음.
- **서버 직접 호출로 실제 트렌드 데이터 수신 확인** (카페 키워드 4개월 ratio 값 정상 반환, `unauthorized` 아님)
- **라이브 대시보드에서 실측 확인**: 홍스튜디오 사업장 "30일 검색량 추이" 섹션 — 등록 키워드 6개 실제 차트 렌더링, `GET /api/report/keyword-trend/{biz_id}` → `200`
- 서버 `.env`에 `NAVER_DATALAB_ENABLED=true` 추가 + `pm2 restart aeolab-backend` (구독자 100명 조건부 "착수 필요" 오탐 로그 방지 목적, 기능 자체와는 무관)
- `NAVER_SEARCHAD`(검색광고 API, 실제 월간 검색량 숫자)는 아직 미설정 — DataLab은 상대 검색량 지수(0~100)만 제공, `monthly_volume`은 null
- CLAUDE.md "미래 과제"에서 DataLab 항목 제거 (완료됨)

### 2026-06-26 — 대시보드 좌측 메뉴 재편 (소상공인 UX 최적화)
> `DashboardSidebar.tsx` NAV_GROUPS 재구성. git `4d2a453`. 배포 완료.
- **그룹 통합**: "진단"(2) + "변화 보기"(2) → **"내 가게 현황"(4)** — 스크롤 없이 712px→350px대 노출
- **개선 실행 축소**: 6→4개 (AI 브리핑 5단계·ChatGPT 최적화 가이드 → 도움말 섹션 이동)
- **"기타" → "도움말"** 명칭 변경, 학습 콘텐츠 2개 추가 (총 5개)
- **모바일**: `MobileBottomTabs` 하단 "변화" 탭 유지 (변경 불필요)

### 2026-06-26 — 전 서비스 심층 점검 + AI탭 베타 표기 수정
> 브라우저 직접 접속(hoozdev@gmail.com) 전 페이지 점검. CLAUDE.md 사실 전수 검증 완료.
- **P1 수정**: 네이버 AI탭 "베타" → "정식 출시 (2026-06-25)" 8개 파일 수정 (SiteFooter·ChannelDifferentiationCard·pricing/page·PlanRecommender·HeroSampleCard·GlobalAiFocusCard·FAQSection·demo/page)
- **P1 수정**: `SiteFooter.tsx` "네이버 AI 브리핑 노출 관리 서비스" → "AI 검색 노출 관리 서비스" (멀티채널 실제 범위 반영)
- **CLAUDE.md 검증 결과**: ChatGPT cutoff 2024-06-01 ✅ / AI탭 정식 출시 2026-06-25 ✅ / 가격 전체 ✅ / Gemini 기간 추정 유효 ✅
- **기준 문서 신설**: `docs/commercial_inspection_standard_v2.0.md` (페이지별 점검 항목 + 오판 방지 체크리스트)
- **미수정 P1**: 대시보드 Gemini 기간 표기 통일, 대행서비스 02번 업종별 분기 → 다음 세션
- **P2 잔여**: ad-defense "Q2"→"하반기", 설정 페이지 앵커, Trial 업종 검색 필터

---

## 남은 작업

### 사용자가 직접 해야 할 것
- ⏳ **베타 후기 1~3개 확보** → `frontend/lib/testimonials.ts` `isPlaceholder: false`로 교체 (Phase 0 인터뷰 후)
- **실결제 전환 시**: `TOSS_SECRET_KEY` test_ → live_ 교체 + pm2 restart
- `NEXT_PUBLIC_ADMIN_SECRET_KEY` 향후 서버 컴포넌트로 분리 권장

### 시기 의존 작업 — 런북 참조

> **전체 실행 가이드**: `docs/p2_p3_execution_runbook.md`
> 새 대화창에서: `"docs/p2_p3_execution_runbook.md 기준으로 P2/P3 실행할 것"`

| 작업 | 트리거 | 자동 알림 |
|------|--------|---------|
| **P2 AI탭 스캐너 활성화** | ⚠️ **2026-06-25 정식 출시 완료 — 트리거 충족됨.** 비로그인(헤드리스) 상태에서 AI탭이 보이는지 수동 확인 후 `docs/p2_p3_execution_runbook.md` 실행 | 없음 — 즉시 수동 확인 필요 |
| **P2 DB v5.7 컬럼** | P2와 동시 실행 (Supabase SQL Editor) | — |
| **P3 점수 모델 v3.1** | 백엔드 로그 `[P3-READY]` WARNING 발생 시 | ✅ 매일 09:15 KST 자동 체크 중 |
| **데이터 배선 확장** (Playwright 완전 자동화만 남음, DataLab은 2026-07-05 완료) | 백엔드 로그 `[DATA-WIRING-READY-50]`(50명) WARNING 발생 시 — `jobs.py:_check_data_wiring_readiness_job` | ✅ 매일 09:20 KST 자동 체크 중 |

**트리거 명령 전체**: `docs/p2_p3_execution_runbook.md` 참조 (런북에 최신 명령 포함)

### 비즈니스 목표
- [ ] 유료 구독자 20명 달성 (BEP)
- [ ] 구독 100명, MRR 100만원 → 시드 IR
- [ ] 소상공인 디지털 바우처 사업 등록 (Phase 3)
- [ ] B2G 공식화 지자체 MOU (Phase 4)

### 미래 과제 (구독자 확보 후)
- `smart_place_completeness` Playwright 완전 자동화 — 50명 이후. 조건 충족 자동 감지: `jobs.py:_check_data_wiring_readiness_job`
- 경쟁사 keyword_gap 실시간 자동화 (`_enrich_competitor_excerpts` 잡 이미 구현됨)

### Google AI Overview 측정 현황 (2026-05-30 Serper.dev 활성)
- **AI Overview 노출 측정**: `GOOGLE_SCANNER_BACKEND=serper` + `SERPER_API_KEY` 설정 완료. `captcha_detected=false`로 정상 측정 중
- **스크린샷(시각 증거)은 별도**: Playwright 캡처는 여전히 CAPTCHA 차단 상태. 50명 이후 DataForSEO Screenshot API($0.002/건) 재도입 예정
- 환경변수: `GOOGLE_SCANNER_BACKEND=serper|dataforseo|playwright` 토글 가능

---

*최종 업데이트: 2026-06-18 | 상업 점검 13건 완료 + 구버전 업데이트 changelog_archive.md 이관. 2026-05-18~05-26 이관.*
