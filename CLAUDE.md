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
| **`docs/naver_scraping_legal_risk_assessment_v1.0.md`** ⭐ | **네이버 AI브리핑 스캔의 로그인우회·CAPTCHA우회 기법(NID_AUT/NID_SES 쿠키 주입+stealth+IP로테이션)에 대한 정보통신망법 제48조·판례(대법원 2021도1533, 부산지법 2017노4344) 기반 법적 리스크 평가. 결론: 회색지대, 변호사 자문 필요 — 핵심 사업가치라 코드 임의 축소 금지 (2026-07-13)** |
| **`docs/naver_scraping_legal_risk_resolution_plan_v1.0.md`** ⭐ | **위 문서의 후속 실행계획 — Phase 0(법률자문요청서+약관원문대조, 사용자액션)~4(계정정지 감지 알림) 단계별 방안. stealth는 이미 제거됨, "CAPTCHA우회"는 실제론 능동 풀이 코드 없는 "회피+감지"임을 재확인·정정. 구조적 해법은 Phase 2(사용자 본인계정+크롬익스텐션) 제안, 코드 변경은 전부 사용자 승인 대기 (2026-08-08)** |
| **`docs/commercial_launch_inspection_status_v1.0.md`** ⭐ | **상업 서비스 점검 이력·비중분석·잔여과제 마스터 요약 — L1~L4(페이지단위)+A~D(서비스전체) 두 축 정리, 어디에 비중을 뒀는지·어디가 공백이었는지(A/D축 3개월 무점검이 최대 공백) 분석. §6에 실제 미해결 잔여과제 전체 정리(개인정보방침 문구 2건·PG우대등급확인·pip-audit 등). 신규 배포마다 L1+A 스팟체크 반복 필요 원칙 명시 (2026-07-13)** |
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
| `docs/blog_analysis_improvement_v2.0.md` | 블로그 관리 페이지 개선 v2.0 — 전체 결론남(2026-07-17). 재점검 불필요 |
| `docs/five_pages_and_action_history_handoff_v1.0.md` | 경쟁사관리·성장리포트·개선가이드·소개글콘텐츠·변화기록 + 9개 영역 전체 완료(git `71707d4`~`963228c`, 2026-07-06). 재점검 불필요 |
| `docs/subscription_lifecycle_inspection_v1.0.md` | 구독 생애주기(갱신·카드변경·해지) 점검 — §1~4(git `df4f55f`~`3ee38fb`) + §6 P0/P1/FK조인버그 + §5 7일 자동환불 전체 배포완료(git `170b002`). 잔여 없음 |
| **`docs/eight_pages_commercial_professionalism_recheck_v1.0.md`** ⭐ | **8개 페이지 상업적 전문성 재점검 — P0 2건(FAQ한도·SearchGPT)+P1 8건 + 심층개선 6건(DataLab연동 등) + 실API호출로 발견한 최고심각도 2건(가이드 max_tokens 침묵실패, 소개글 허위수치 지어내기) + intro_draft CHECK 제약 사전존재 버그 + keyword_taxonomy law/미술 별칭 버그(전수검증). §13에 잔여 작업 5건 정리(max_tokens 타업종 점검·타업종 소개글 종단테스트·경쟁사 AI언급 추정치 한계·git push 결정 등) (git `258dff7`~`89afa5e`, 2026-07-08)** |
| **`docs/external_benchmark_commercial_quality_v1.0.md`** ⭐ | **외부 벤치마크(Nielsen 10휴리스틱·WCAG 2.1 AA·상업 SaaS 도구·감사이력 UX 관행) 기반 상업적 수준 점검 방법론 — 7단계 절차(과거이력→코드재검증→라이브접속→외부조사→반증→수정→드리프트확인). 경쟁사관리 3건·변화기록 2건·성장리포트 2건+P1·개선가이드 6건(1라운드 정보구조4건+2라운드 WCAG접근성2건) 수정 완료. 미점검 6개 페이지는 `docs/six_pages_external_benchmark_inspection_plan_v1.0.md`로 이관 (2026-07-09)** |
| `docs/six_pages_external_benchmark_inspection_plan_v1.0.md` | 6개 페이지 외부벤치마크 점검 전체 완료(git `368c1f2`~`4cc68ca`, 2026-07-09). 재점검 불필요 |
| **`docs/master_inspection_plan_v1.0.md`** ⭐ | **8개 파편화 점검 문서를 4-레이어(L1사실정확성·L2기능정합성·L3외부벤치마크·L4실측재현)로 통합 + 영역×레이어 매트릭스. 핵심 발견: 전환 퍼널(랜딩·요금제·trial·온보딩)은 L3 미적용. §5.1: 랜딩 실측으로 text-gray-400 대비율 위반 800+건(161개 파일) 발견, 8건만 수정(git `00bbcff`), 잔여 대량 작업 다음 세션 트리거 (2026-07-11)** |
| `docs/dashboard_external_benchmark_inspection_plan_v1.0.md` | 대시보드 외부벤치마크 점검 계획 — 이 축(Nielsen/WCAG)에서 유일하게 남은 대상. §1 필수 참고(소상공인은 네이버 100% 신뢰·대행업체 의뢰 실증 → 네이버 정보 최상단 배치·"AI노출개선→네이버SEO상위노출" 정방향 메시징·AI채널별 노출기간 정확 안내 3대 원칙), §3에 과거 점검 이력 전수 정리("닫힌 이슈 재점검 금지"), §2에 편집 지뢰(DualTrackCard 고아파일 경로) 경고, §5에 27개+ 컴포넌트 구역별 분할 진행 순서 (2026-07-09)** |
| `docs/admin_screens_inspection_plan_v1.0.md` | 관리자(`/admin/*`) 화면 전체 점검 — P0/P1/P2 전체 완료+사후재검증까지 완료(git `27ddf98`~`6da216c`). 재점검 불필요 |
| **`docs/admin_panel_complete_documentation_v1.0.md`** ⭐ | **관리자 페이지 종합 문서(as-built) — 접속정보·인증구조 3단계·페이지 13개 전체 인벤토리·신규 DB테이블 5개·신규 엔드포인트 13개·git커밋 이력·알려진 제약 6건. 관리자 기능 추가/수정 작업 전 필수 참조 (2026-07-11)** |
| **`docs/session_2026_07_11_next_steps_handoff_v1.0.md`** ⭐ | **마스터 점검 계획 전체 완료 후 다음 단계 핸드오프 — A(정리: origin 대비 51커밋 push·스크린샷93개 정리·stale 문서 정리)와 B(신규 기능: next-feature 에이전트로 스코프 재기획) 2트랙. A 먼저 권장 (2026-07-11)** |
| **`docs/commercial_launch_readiness_audit_v1.0.md`** ⭐ | **상업 서비스 총괄 점검 계획 — 4개 신규 축(A보안·B법적컴플라이언스·C사업성·D인프라복원력). A·B·C·D 전체 완료(2026-07-12)** |
| **`docs/legal_compliance_and_infra_resilience_audit_v1.0.md`** ⭐ | **B(법적)+D(인프라) 점검 결과 — D축 P0(DB 백업 생성 이래 0회 성공, pg_dump 아웃바운드 차단+비밀번호 미설정 이중원인) 발견 즉시 수정(REST API 전환, 43개 테이블, 실패알림, git `3ab9545`). B축 P1(정기결제 요금인상 사전고지, 법률자문 권장)+P2 3건은 문서화만(사용자 결정 대기). 잔여: 외부 업타임 모니터링·day-30 알림 구현 (2026-07-12)** |
| **`docs/business_viability_audit_v1.0.md`** ⭐ | **C(사업성) 점검 결과 — Gemini SDK(0.8.3) thinking_config 미지원+AI 호출 텔레메트리 전무 발견(ai_usage_logger.py 신설·배포·SQL실행·실측검증 완료), 마진율 계산에서 PG수수료 누락 발견·재계산 — **2026-07-16 재확인으로 브랜드페이(4.3%)→표준카드(3.4%) 카테고리 정정 + 영세등급(0.40%) 사용자 확인 + 현재가 반영, 최종 Basic 83.8%/창업 83.9%/Pro 86.4%/Biz 91.4%**, 경쟁사가격비교 "없음" 주장은 오판(TalkB 비교표 기존재), trial→가입→유료전환 선행지표 실제공백 확인→`/admin/growth-funnel` 신설. **§1-A: 실측검증 도중 OpenAI 결제수단 미등록으로 ChatGPT 스캔 전면실패(insufficient_quota) P0 우연 발견·사용자 카드등록으로 해결**. 후속과제 잔여: max_tokens 등 (2026-07-12, PG 우대등급 항목은 2026-07-16 해소)** |
| **`docs/naver_api_hub_migration_v1.0.md`** ⭐ | **네이버 개발자센터 Search API·DataLab API가 NAVER API Hub(NCP)로 이관 — 2027-06-30 전면 종료 전까지만 마이그레이션 완료하면 됨(현재 수정 불필요). 사용 파일 9개 전수 확인 포함 (2026-07-15)** |
| **`docs/chargeback_response_checklist_v1.0.md`** ⭐ | **카드 분쟁(차지백) 대응 체크리스트 — 결제 라이브 키 승인 전 점검에서 발견한 누락(코드·문서 0건). 이미 있는 증빙 소스(payment_events·subscriptions 등) 정리 + 통보받았을 때 절차만 문서화, 코드 변경 없음 (2026-07-16)** |
| **`docs/blog_diagnosis_session_2026_07_18_handoff_v1.0.md`** ⭐ | **블로그 진단 페이지 종합 핸드오프 — 목적 확정(①내블로그현황 ②AI노출개선, 경쟁사대비는 방식A(comp_keywords 재사용, 부하없음)로 포함/방식B(실시간블로그크롤링)는 비채택)·20개상한 키워드누락 P0(git `a8f76ec`)·자기추세 upsert 누락(git `dc59ae4`)·comp_keywords 오판 2회 정정 상세. **재점검 발견**: `showDetail`(기본값 false) 단일 토글이 키워드커버리지·자기추세·경쟁사대비 3축을 전부 기본 숨김 처리 중 — §6-1 토글 재설계가 최우선 (2026-07-18)** |
| `docs/fastapi_starlette_upgrade_handoff_v1.0.md` | A·B·C·D 3개 문서 재검증 세션(2026-07-12) 결과물 — privacy §4 Resend 위탁 누락·§3 IP해시 문구 불일치·DMARC 부재·성능측정 이력 0건·pip-audit 미실행 5건 수정·배포(git `f51f490`·`6c65ab8`). `starlette` CVE 7건 → **fastapi 0.135.0+starlette 1.3.1 업그레이드 완료**(로컬 회귀검증 후 서버 배포·라이브 검증, git `7d23596`) — 이 문서 시리즈 전체 종료, 재작업 불필요 |
| **`docs/trial_experience_persuasiveness_and_growth_v1.0.md`** ⭐ | **무료체험/가입후1회체험 설득력 검토 — 시나리오 5개 라이브 실측 + P0(FAQ·리뷰답변 자동생성 카피가 "미보유 추정" 키워드를 "전문으로 합니다/운영하고 있습니다"로 단정 서술, `smartplace-faq` 등 3곳) 발견 즉시 수정·배포(git `bd379c0`). §3 잔여(채널강점 vs 총점라벨 불일치·죽은 3단계비교박스 정리·프랜차이즈 메시징 재확인) + §5 사업성장 방안(결제심사 대기 중 체험 최적화 우선순위) (2026-08-22)** |
| `docs/closure_rate_data_source_investigation_v1.0.md` | 창업 시장 분석용 지역별 폐업율 데이터 소스 조사 — **조사·매핑·라이브 검증 전부 완료(2026-09-01), 재점검 불필요.** 행안부 지방행정 인허가 통합API로 16개 업종(음식점·카페·미용·숙박·피트니스·애견·약국·마사지·댄스·무술·안경원·노래방·당구장 등) 검증 완료, 지역 필터는 `cond[LOTNO_ADDR::LIKE]=<지역명>` 확정. `bar`는 `general_restaurants`를 `BZSTAT_SE_NM`으로 필터링. 골프·수영장·찜질방은 SearchAd 실측 검색량이 낮아 제외 확정. 학원/독서실(NEIS)은 폐업 이력이 없어 이 기능엔 사용 불가. 요가/필라테스·스터디카페·클라이밍·방탈출은 커버 불가. **다음 단계는 조사 아닌 구현** — `next-feature` 에이전트로 |
| **`docs/dashboard_load_test_and_capacity_v1.0.md`** ⭐ | **대시보드 페이지 부하테스트 실측 — QA임시계정+`@supabase/ssr` 쿠키 리버스엔지니어링으로 실제 로그인 세션 확보해 라이브 `/dashboard` 동시성 5~80 램프. 동시 30명은 3~9초, 50명 부근에서 34초로 급붕괴하나 그 순간 서버 CPU/RAM은 완전 유휴 — **병목이 vCPU2 서버가 아니라 대시보드 1회 로드당 약10개 Supabase 병렬쿼리의 Supabase Cloud 큐잉**임을 확인. vCPU/RAM 업그레이드로 해결 안 되는 별도 축(기존 Playwright 세마포어/워커=1 이슈와 무관). 페이지 동시접속 실질 안전선 약 30명 (2026-08-23)** |

> **새 대화창 시작 시 우선 트리거**: `docs/inspection_request_full.md` 1줄 명령으로 전체 시스템 점검·수정·배포 자동 진행. 부분 점검은 `§3.X`만 지정.
> **관리자 화면 점검**: 완료됨 — 재점검 불필요(위 표 참조)
> **관리자 기능 작업**: `docs/admin_panel_complete_documentation_v1.0.md 기준으로 관리자 페이지 현황 확인 후 진행`
> **대시보드 상단 디자인 이어가기**: `docs/dashboard_top_redesign_handoff_v1.0.md 기준으로 C(상단 디자인) 이어서 진행`
> **네이버 차단 대응 이어가기**: `docs/naver_briefing_block_countermeasure_handoff_v1.0.md 기준으로 작업 시작. 먼저 §3 선결 검증부터 실측한 뒤 §4 진행`
> **이번 세션 이어가기**: `docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md 기준으로 §7 NID_AUT/NID_SES 자동 재로그인 여부를 결정하고 진행할지 알려줘`
> **정보형 캐비엇 재점검**: `docs/naver_briefing_infotype_caveat_standard_v1.0.md 기준으로 정보형 캐비엇 재점검 진행`
> **9개 페이지 실측 점검**: `docs/nine_pages_measurement_inspection_v1.0.md 기준으로 실측 점검 진행`
> **블로그 진단 페이지 잔여작업**: `docs/blog_analysis_improvement_v2.0.md §4 기준으로 CI테스트게이트·비동기테스트·git reconcile 중 진행할 것 선택`
> **8개 페이지 상업적 전문성 재점검 잔여작업**: `docs/eight_pages_commercial_professionalism_recheck_v1.0.md 기준으로 §13 남은 작업 이어서 진행`
> **외부 벤치마크 기반 상업적 수준 점검**: 9개 페이지(경쟁사관리·성장리포트·개선가이드·변화기록·소개글콘텐츠·블로그진단·리뷰답변·AI광고대비·창업시장분석) 전체 완료. 남은 건 대시보드뿐
> **대시보드 외부벤치마크 점검**: `docs/dashboard_external_benchmark_inspection_plan_v1.0.md 기준으로 대시보드 점검 진행`
> **마스터 점검 계획 이어가기(전환 퍼널 L3 + 대비율 800건 잔여)**: `docs/master_inspection_plan_v1.0.md §5.1 기준으로 이어서 진행` — 2026-07-11 전 항목 완료됨, 재점검 불필요
> **마스터 점검 종료 후 다음 단계(정리 또는 신규 기획)**: `docs/session_2026_07_11_next_steps_handoff_v1.0.md 기준으로 A(정리) 먼저 진행 후 B(신규 기능 기획)로 넘어가줘`
> **창업 시장 분석 폐업율 기능 구현 착수**: `docs/closure_rate_data_source_investigation_v1.0.md 조사 결과(전 업종 라이브 검증·매핑 완료) 기준으로 next-feature 에이전트로 폐업율 기능 범위 설계부터 시작`
> **상업 서비스 총괄 점검(보안/법적/사업성/인프라)**: A·B·C·D 전체 완료(2026-07-12) — A·B·D는 `docs/legal_compliance_and_infra_resilience_audit_v1.0.md`(git `3ab9545`), C는 `docs/business_viability_audit_v1.0.md` 참조. 재점검 불필요, 후속 과제만 `docs/business_viability_audit_v1.0.md §6` 참조
> **FastAPI/Starlette 업그레이드**: 완료됨(2026-07-12, git `7d23596`) — 재작업 불필요
> **상업 서비스 점검 현황 파악/이어가기**: `docs/commercial_launch_inspection_status_v1.0.md 기준으로 §6-1(즉시 가치) 항목부터 진행`
> **블로그 진단 페이지 잔여작업 이어가기**: `docs/blog_diagnosis_session_2026_07_18_handoff_v1.0.md 기준으로 §6-1(showDetail 토글 재설계)부터 진행`

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
| 결제 | 토스페이먼츠 v2 (test_ 키) | §"남은 작업" 참조 |
| 알림 | 카카오 비즈API v2 알림톡 5유형 | |
| 서버 | iwinv vCPU2/RAM4GB, Ubuntu 24.04 LTS, Nginx + PM2 | aeolab.co.kr |
| CI/CD | GitHub Actions — main 브랜치 push 시 자동 배포 | |

### AI 스캐너 4종 체계 (multi_scanner.py 기준)

| 스캐너 | 파일 | 방식 | 용도 |
|--------|------|------|------|
| Gemini 2.5 Flash | `gemini_scanner.py` | API | sample_n(n=50/100) — scan_basic()은 50회, scan_all()은 100회 |
| ChatGPT gpt-4.1-mini | `chatgpt_scanner.py` | API | sample_n(n=50/100) — scan_basic()은 50회, scan_all()은 100회, **Trial 5회** |
| 네이버 AI 브리핑 | `naver_scanner.py` | Playwright | 네이버 AI 브리핑 DOM 파싱 |
| Google AI Overview | `google_scanner.py` | Serper.dev API | 구글 SGE + AI Overview 노출 확인 ($0.001/건, CAPTCHA 없음) |

**제거됨:** Perplexity(미사용), Grok, Claude 스캐너, 뤼튼/Zeta (비용·ROI 이유)

**스캔 모드 (2026-07-27 `jobs.py:467-482` 재확인 — "Basic=scan_basic()" 서술이 stale이었음을 발견·정정):**
- Trial(ChatGPT 5회 — sample_5 구현, 비로그인 1회성)
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
- 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` (현재 test_)
- 알림: `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_REST_API_KEY`
- 검색: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` (Open API, DataLab 겸용) / `NAVER_SEARCHAD_API_KEY`, `NAVER_SEARCHAD_SECRET_KEY`, `NAVER_SEARCHAD_CUSTOMER_ID` (검색광고 키워드도구 API, searchad.naver.com 별도 발급 — 미설정 시 graceful degradation)
- 기타: `BACKEND_URL`, `SECRET_KEY`

---

## 요금제 최종 가격 (4곳 모두 일치)

- **Basic 11,900원** (신규 첫 달 50% 할인 5,950원, 이후 정상가)
- **창업패키지 12,900원**
- **Pro 23,900원**
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

- `pricing/PayButton`: `subscriptions` 이력 조회 → 없으면 `chargeAmount=5950`, 있으면 정상가
- `/api/webhook/toss/billing/issue` 서버 재검증 (`_is_first_time_subscriber()`)
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

**마진율(2026-07-16 재계산, `docs/business_viability_audit_v1.0.md` §2):** Basic 83.8%, 창업패키지 83.9%, Pro 86.4%, Biz(1사업장) 91.4% — 2026-07-12 수치(76.3/79.6/78.6/87.1%)는 PG 수수료 자체는 반영했으나 **상품 카테고리를 잘못 짚어(브랜드페이 4.3% 적용, 실제는 표준카드 3.4%) + 영세 우대등급 미확인 + 가격 인상 전(Basic 9,900→11,900원 등) 구가격**으로 계산된 값이었음. 위 수치도 API 비용 축(Gemini thinking 토큰 미실측)은 여전히 추정치 — PG 수수료 축만 확정 값(사용자 확인 완료)

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
- §"에이전트 보고 검증 의무" 절차와 동일하게 적용 (SSH grep 확인 · pm2 error.log 확인 · 에이전트 보고 신뢰 금지)

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

## 최근 업데이트 (2026-08-23~08-27 상세 내역은 `docs/changelog_archive.md`로 이관)

- **2026-08-31 창업 시장 분석 종합 개편 — SBIZ 실측 도입부터 AI 전략 3단 고도화까지**: 카카오 밀도 지표 신설 → 국세청 SBIZ 실연동(Sentry의 aiohttp 헤더 자동주입이 400오류 원인이었음 규명·해결, `trace_propagation_targets=[]`) → 반경 행정구역별 자동조정(동/구/군)+밀도·신뢰도 등급 신설 → 경쟁사 스마트플레이스 준비도 체크(1단계 기존 테이블 무료조회+2단계 격리상한 캐시조회 하이브리드, 캐시버그 2건 실측발견·수정) → 페이지 목적 재정의(AEOlab 자체 데이터 화면·Claude 프롬프트 양쪽에서 제거, 순수 실측 상권분석으로 재편) → AI 전략 프롬프트 3단 개선(일반론 제거 → 필드별 근거다양화·통찰강화 → 모바일 가독성용 문장길이 제약). 전 과정 라이브 QA 계정 실측 검증, AI 지어내기 재발 2건(노출기간·임대료 수치)도 발견 즉시 차단. 잔여: 경쟁사 준비도 2단계(네이버 place_id 탐색)는 오픈API `link` 필드가 "홈페이지 URL"이지 플레이스 링크가 아니라는 구조적 한계로 실효성 낮음 — 더 신뢰도 높은 Playwright 지도검색은 차단위험 미검증이라 보류. git `375e731`~`7672be8`(9개 커밋, 전체 흐름은 changelog_archive.md 참조).
- **2026-08-31 창업 시장 분석 추가개선 점검 — 월한도초과 에러 미처리 버그 발견·수정**: "더 개선할 것 없는지" 질의에 코드 재검토 중 `StartupClient.tsx handleGenerate()`가 403만 처리하고 429(월한도초과)·409(동시생성중)는 처리 안 해 에러 JSON을 그대로 결과로 취급하던 것 발견 — 옵셔널체이닝 덕에 크래시는 안 나지만 사용자에게 아무 설명 없이 빈 화면만 보임. QA계정에 guides 5건 미리 삽입해 한도소진 재현(Claude 호출 낭비 없이) → 명시적 에러 메시지 분기 추가 후 "이번 달 한도(5회)를 초과했습니다" 정상 노출 확인(git `cc1afaa`). **미결 제안(구현 안 함, 확인 대기)**: 유료 `/api/startup/report`(Claude 호출)는 캐싱이 전혀 없음 — 무료 `/market` 미리보기는 이미 30분 캐시 적용 중인 것과 대조적. 같은 업종·지역을 다른 사용자가 반복 조회해도 매번 새로 Claude를 호출해 비용 낭비 — `business_name`은 프롬프트에 장식적으로만 쓰여 캐시 키에서 제외해도 무방함을 확인. 캐시 히트를 월 한도에서 차감할지는 별도 정책 판단 필요.
- **2026-08-31 창업 시장 분석 캐싱 도입 + 결과 화면 시각적 재설계**: "캐싱 진행 + 텍스트만 나열돼 보기 어려움 개선" 요청 처리. 캐싱: 유료 `/api/startup/report`(Claude 호출)에 24시간 캐시 추가 — 캐시 히트는 Claude 재호출도 월 한도 소모도 없음(비용 0원이라 사용자에게 불리할 이유 없다는 정책 판단), business_name은 프롬프트에 장식적으로만 쓰여 캐시 키에서 제외. 라이브 검증: 1차 39.0초→2차(동일쿼리) 1.5초, used 1→1 불변 확인(git `40caf53`). 화면 재설계: 기존 팔레트(블루=시장데이터·에메랄드=경쟁사·앰버=트렌드)는 유지하고 Claude 종합결과("AI 진입 전략")에만 인디고 신규 도입해 원본 데이터와 구분 — 시장규모·밀도를 큰 숫자 타일로 승격, entry_strategy에 "핵심 요약" 좌측강조바, 핵심액션은 화살표→번호 원형배지, 주의사항은 개별 경고카드로 전환. 데스크톱+모바일 라이브 확인(git `663fc1d`).
## 남은 작업

### 사용자가 직접 해야 할 것
- ⏳ **베타 후기 1~3개 확보** → `frontend/lib/testimonials.ts` `isPlaceholder: false`로 교체 (Phase 0 인터뷰 후)
- **실결제 전환 시**: `TOSS_SECRET_KEY` test_ → live_ 교체 + pm2 restart
- ✅ **네이버 서치어드바이저 사이트 등록 + 사이트맵 제출 완료** (2026-08-07) — HTML 파일 방식으로 소유확인(`frontend/public/naver90ab854379ebb072c6795b390f874ac8.html`, git `b45b952`, 라이브 200 확인) 후 사이트맵 제출까지 사용자 완료. 색인 반영은 네이버 측 처리 시간 소요 — 재작업 불필요

### 비즈니스 목표
- [ ] 유료 구독자 20명 달성 (BEP)
- [ ] 구독 100명, MRR 100만원 → 시드 IR
- [ ] 소상공인 디지털 바우처 사업 등록 (Phase 3)
- [ ] B2G 공식화 지자체 MOU (Phase 4)

### 외부 API 마감 대응 (하드 마감일 있음)
- [ ] **네이버 Search API·DataLab API → NAVER API Hub(NCP) 마이그레이션** — 마감 **2027-06-30**(전면 종료). 현재 수정 불필요, 마감 전 아무때나 진행. 상세 `docs/naver_api_hub_migration_v1.0.md`

### 미래 과제 (구독자 확보 후)
- `smart_place_completeness` Playwright 완전 자동화 — 50명 이후. 조건 충족 자동 감지: `jobs.py:_check_data_wiring_readiness_job` (`[DATA-WIRING-READY-50]` WARNING, 매일 09:20 KST 자동 체크 — 2026-08-23 타임존버그+get_supabase ImportError 둘 다 수정 완료, git `3381ce9`). DataLab 연동은 2026-07-05 완료
- 경쟁사 keyword_gap 실시간 자동화 (`_enrich_competitor_excerpts` 잡 이미 구현됨)
- 백엔드 `--workers 1` → Redis/DB 락 마이그레이션 — in-memory 락 9개(6파일)·Playwright 세마포어가 프로세스 간 미공유라 보류 중. 트리거 조건·현황 전체: `docs/backend_worker_scaling_trigger_v1.0.md` (2026-07-19)

### Google AI Overview 측정 현황 (2026-05-30 Serper.dev 활성)
- **AI Overview 노출 측정**: `GOOGLE_SCANNER_BACKEND=serper` + `SERPER_API_KEY` 설정 완료. `captcha_detected=false`로 정상 측정 중
- **스크린샷(시각 증거)은 별도**: Playwright 캡처는 여전히 CAPTCHA 차단 상태. 50명 이후 DataForSEO Screenshot API($0.002/건) 재도입 예정
- 환경변수: `GOOGLE_SCANNER_BACKEND=serper|dataforseo|playwright` 토글 가능

---

*최종 업데이트: 2026-08-31 | 창업 시장 분석: SBIZ 400오류 근본해결 + 반경 자동조정 + AI 지어내기 재발 발견·수정 + 밀도·신뢰도 등급 신설 + 경쟁사 준비도 체크 신설 + 페이지 목적 재정의 + AI 전략 프롬프트 3단 개선(일반론 제거 → 근거 다양화·통찰 강화 → 모바일 가독성 회복). 상세는 위 항목 참조.*
*문서 정리(2026-08-31): "최근 업데이트" 8/23~8/27 상세 내역(13개 항목) 전량을 `docs/changelog_archive.md`로 이관하고 요약 1줄만 유지 — 91,375→72,722바이트(약 20% 감소), 754→742줄. 700줄 기준은 아직 근소 초과이나, 남은 초과분은 문서 전체에 흩어진 활성 참조 섹션(현재 패턴·경로·수치)이라 추가로 줄이려면 실질 정보 손실이 불가피해 보류 — 다음 압축은 이번에 새로 쌓이는 "최근 업데이트" 항목이 1개월 지난 시점에 진행할 것.*
