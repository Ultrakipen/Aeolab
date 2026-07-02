# 9개 페이지 실측 점검 작업 문서 v1.0 (2026-07-02)

> **새 대화창 1줄 트리거**: `docs/nine_pages_measurement_inspection_v1.0.md 기준으로 실측 점검 진행`
> 부분 점검은 `§3의 N번만 점검`처럼 영역 번호 지정 가능.

## §0. 배경

2026-07-02 대시보드(`dashboard/page.tsx` 및 하위 61개 컴포넌트) + 백엔드 측정 파이프라인을 전수 점검해 8건의 실측 무결성 문제를 발견·수정·배포했다 (상세: `docs/changelog_archive.md` 편입 예정, 현재는 메모리 `project_measurement_pipeline_integrity_2026_07_02` 참조, git `2236c11`).

이번 문서는 **같은 방법론을 대시보드 밖 9개 페이지에 적용**하기 위한 작업 문서다. 아래 9개 영역을 점검한다:

1. 경쟁사 관리
2. 변화 기록 (행동-결과 기록)
3. 성장 리포트
4. 개선 가이드
5. 소개글·콘텐츠 생성
6. 블로그 진단
7. 리뷰 답변
8. AI 광고 대비
9. 창업 시장 분석

## §1. 방법론 — 반드시 2개 레이어 모두 점검

> 2026-07-02 세션에서 얻은 핵심 교훈: **프론트엔드 UI 감사만으로는 "실측이 제대로 되는가"에 완전히 답할 수 없다.** UI가 props를 정직하게 표시해도, 그 props를 만드는 백엔드가 "측정 실패"를 "측정된 부정 응답"으로 오집계하면 근본 데이터 자체가 거짓이 된다. 두 레이어를 분리해서 점검할 것.

### 레이어 A — 프론트엔드 UI 하드코딩/더미 감사
각 페이지·컴포넌트에서:
- `Math.random()`, 고정 숫자 배열/퍼센트가 실측처럼 표시되는지
- props/API가 없거나 에러일 때 0이 아닌 그럴듯한 숫자로 fallback하는지 (0/N/A/안내문구는 정상, 무작위·고정 양수는 버그)
- AI Visibility 점수 숫자가 텍스트 레이블(양호/보통/주의) 없이 직접 노출되는지 (`{score}점`, `.toFixed(1)점` 패턴 — 2026-06-10 확정 원칙 회귀 여부)
- 잠금(Lock) UI 뒤 티저 샘플에 임의 숫자를 쓰는지 (`--` 또는 명시적 "샘플" 라벨이어야 정상)
- "데이터 없음" 상태에서 빈 카드 대신 가짜 데이터로 채워지는 곳이 있는지

### 레이어 B — 백엔드 측정 파이프라인 무결성 감사
> 2026-07-02 세션에서 실제로 발견된 패턴들 — 이번에도 동일 계열 버그가 있을 가능성이 높으므로 반드시 체크:
- **성공/실패 구분 없이 집계**: API 타임아웃·예외를 `{"mentioned": False}`류로 변환해 반환값 레벨에서 "측정된 부정 응답"과 구분 불가능하게 만드는 패턴 (`except Exception: return {...False...}`). 분모(sample_size 등)에 실패 건이 포함되는지 확인
- **부분 실패의 불완전한 처리**: 어떤 실패 유형(예: 캡챠)만 가중치 재배분/보정하고 다른 실패 유형(예: 일반 API 오류)은 "진짜 0"으로 처리하는 비일관성
- **추정치에 플래그 누락**: fallback/추정 로직으로 만든 값인데 `is_estimated`/`is_competitor_estimated` 류 플래그가 없어 실측처럼 오인되는 경우 (정상 경로는 플래그를 세팅하는데 fallback 경로만 누락되는 패턴이 실제로 있었음)
- **표본 크기 게이트 누락**: 다른 사업장과 비교하는 통계(업종 평균 등)가 표본 1~2개로도 "평균"처럼 계산되는지 (형제 엔드포인트가 이미 게이트를 걸어뒀다면 그것과 비교)
- **비교 모집단 축소 버그**: "카테고리 내 순위" 류 계산이 실제로는 좁은 부분집합(예: 당일 스캔한 업체끼리만)과 비교하는지
- **dict 키 불일치로 인한 데이터 은닉**: 실제로는 데이터가 있는데 조회 키가 잘못돼 항상 빈 값/일반값 fallback으로 빠지는 경우
- **env var 오타로 인한 프로덕션 전용 실패**: `.env.local`에 정의된 변수명과 컴포넌트가 참조하는 변수명이 다른지 (`grep`으로 실제 정의된 env var 목록과 대조)
- **`except Exception: pass`(로그 없이)**: CLAUDE.md 금지 패턴, 스캐너/서비스 파일 전수 확인

## §2. 검증 절차 (CLAUDE.md 필수 절차 준수)

- 에이전트가 "문제 발견"으로 보고해도 **메인 세션이 file:line을 직접 Read/Grep으로 재확인**하기 전까지는 확정하지 않는다 (2026-05-18 문제 분류 검증 의무 참조)
- P0/P1 단정 전 반증 시도 최소 1회 (다른 유사 로직과 대조, 실제 렌더링/호출 여부 grep 등)
- 수정 전 반드시 서버 md5 선확인 (다르면 서버가 최신 → 서버→로컬 먼저) — 단, 순수 CRLF/LF 차이는 실제 드리프트 아님(2026-07-02 확인된 유령 diff 패턴), `diff -b` 또는 `tr -d '\r'`로 재확인
- 수정 후: 백엔드는 `python -m py_compile`, 프론트는 `npx tsc --noEmit` 통과 확인
- 배포 후: 서버 grep으로 각 수정 라인 반영 확인 → 프론트는 빌드 필수 → PM2 재시작 → `pm2 logs --lines 60 --nostream` 에러 0건 확인 → `curl` 헬스체크
- 로컬 git 커밋 (push는 보류 — 현재 서버 master/로컬 main 미해소 drift 존재, CLAUDE.md 참조)

## §3. 점검 대상 9개 영역 매핑 (2026-07-02 조사)

> ⚠️ 아래는 조사 시점 스냅샷. 실제 작업 시작 전 각 파일이 여전히 존재하는지, 라우터 prefix가 맞는지 재확인할 것 (`backend/main.py`의 `from routers import ...` 확인).

### 1. 경쟁사 관리
- 페이지: `frontend/app/(dashboard)/competitors/page.tsx`, `CompetitorsClient.tsx`, `PioneerKeywordsCard.tsx`
- 컴포넌트: `components/competitors/CompetitorPlaceCard.tsx`, `components/dashboard/CompetitorTimeline.tsx`, `GapAnalysisCard.tsx`, `CompetitorKeywordCompare.tsx`, `PlaceCompareTable.tsx`, `KeywordManagerModal.tsx`
- API: `backend/routers/competitor.py` (search/add/list/update/remove/sync-place/changes), `report.py`(gap), `business.py`(blog-mentions)
- 서비스: `services/competitor_place_crawler.py`, `services/gap_analyzer.py`, `services/keyword_taxonomy.py`

### 2. 변화 기록 (행동-결과 기록)
> ⚠️ 단일 페이지 아님 — 4갈래로 분산:
- `frontend/app/(dashboard)/history/page.tsx` — Supabase 직접 조회(백엔드 라우터 미경유), `TrendLine.tsx`, `ExportButton.tsx`, `BlogScreenshotSection.tsx`
- 대시보드: `ActionCompleteSection.tsx`, `DailyMissionCard.tsx`, `ActionResultCard.tsx` → `backend/routers/actions.py`
- 가이드: `components/guide/ActionTimelineCard.tsx`, `components/dashboard/Action7DayChart.tsx` → `GET /api/report/action-timeline/{biz_id}` (`report.py`) — **Action7DayChart는 2026-07-02 텍스트 레이블 원칙 회귀 1건 이미 수정됨, 재발 여부만 확인**
- 성장 리포트: `GET/POST /api/report/action-log/{biz_id}` (`report.py`)

### 3. 성장 리포트
- 페이지: `frontend/app/(dashboard)/growth/page.tsx`, `GrowthClient.tsx`
- API: `report.py`의 `/history`, `/growth-card`, `/benchmark`, `/action-log` (서버 컴포넌트 병렬 fetch)
- 서비스: `services/score_engine.py`, `services/gap_card.py`

### 4. 개선 가이드
- 페이지: `frontend/app/(dashboard)/guide/page.tsx` + 하위 `guide/ai-info-tab`, `guide/ai-tab`, `guide/blog-strategy`, `guide/score-model-v3-1`
- 컴포넌트: `GuideClient.tsx`, `components/guide/ActionTimelineCard.tsx`, `AICitationHighlight.tsx`, `KeywordCompletenessGauge.tsx`, `CompetitorKeywordAlert.tsx`, `AiInfoTabGuide.tsx`
- API: `backend/routers/guide.py` (generate/latest/checklist)
- 서비스: `services/guide_generator.py`(핵심), `services/gap_analyzer.py`, `services/score_engine.py`

### 5. 소개글·콘텐츠 생성
> ⚠️ 독립 페이지 아님 — 대시보드 메인 페이지의 `dashboard/sections/DashboardGeneratorZone.tsx`(또는 현재 사용 중인 `DashboardContentZone.tsx` — 2026-07-02 감사에서 `DashboardGeneratorZone.tsx`가 미사용 고아 파일로 확인됨, **`DashboardContentZone.tsx`가 실제 사용 경로이니 우선 grep으로 재확인할 것**)에 임베드
- 컴포넌트: `components/dashboard/IntroGeneratorCard.tsx`, `TalktalkFAQGeneratorCard.tsx`
- API: `backend/routers/business.py` (intro-generate, global-ai-intro-generate, talktalk-faq-generate), `backend/routers/guide.py` (`/smartplace-faq`)
- 서비스: `services/guide_generator.py` (generate_naver_intro 등), `services/content_validator.py` (D.I.A. 점수 — 2026-07-02 확인상 AI Visibility 점수와 별개 지표이므로 텍스트 전용 원칙 대상 아님, 혼동 주의)

### 6. 블로그 진단
- 페이지: `frontend/app/(dashboard)/blog-analysis/page.tsx`, `BlogClient.tsx`
- API: `backend/routers/blog.py` (analyze, result), `report.py`(blog-analysis, capture-blog)
- 서비스: `services/blog_analyzer.py`, `services/blog_search_analyzer.py`, `services/screenshot.py`

### 7. 리뷰 답변
- 페이지: `frontend/app/(dashboard)/review-inbox/page.tsx` (인라인 컴포넌트: CrisisGuidePanel, SentimentBadge, CopyButton)
- API: `backend/routers/guide.py` (review-reply, review-replies, usage, crisis-reply)
- 서비스: `services/crisis_guide.py`, `services/review_sentiment.py`, `services/reply_templates.py`

### 8. AI 광고 대비
- 페이지: `frontend/app/(dashboard)/ad-defense/page.tsx`, `AdDefenseClient.tsx`
- API: `POST /api/guide/ad-defense/{biz_id}` (`guide.py`)
- 서비스: `services/ad_defense_guide.py` (`AdDefenseGuideService`)

### 9. 창업 시장 분석
- 페이지: `frontend/app/(dashboard)/startup/page.tsx`, `StartupClient.tsx`
- API: `backend/routers/startup.py` (report, market, timing)
- 서비스: `services/startup_report.py` (`StartupReportService`)

## §4. 작업 순서 제안 (2026-07-02 세션 방식 재사용)

1. **§3 매핑 재확인** — 파일 존재 여부·라우터 prefix를 빠르게 grep으로 재검증 (스냅샷 노후화 대비)
2. **레이어 A (프론트 UI) 병렬 점검** — 9개 영역을 3개씩 묶어 3개 에이전트 병렬 파견 (예: [1,2,3] / [4,5,6] / [7,8,9]), 각 에이전트에게 §1 레이어 A 체크리스트 그대로 전달
3. **레이어 B (백엔드 파이프라인) 병렬 점검** — 각 영역의 서비스 파일 기준으로 3개 에이전트 병렬 파견, §1 레이어 B 체크리스트 전달. 특히 `except Exception:` 반환값이 성공 케이스와 구분되는지가 핵심 체크포인트
4. **메인 세션 직접 검증** — 보고된 P1 후보 전부 file:line Read로 재확인, 반증 시도
5. **오판·누락 재확인** — 사용자에게 "오판과 누락 없는지" 재확인 요청 시 미검증 항목만 골라 추가 검증 (전체 재검증 아님, 효율)
6. **수정** — §2 검증 절차대로 md5 확인 → 수정 → 컴파일/타입체크 → 배포 → grep 검증 → 빌드/재시작/로그 확인 → git 커밋
7. **메모리 기록** — 발견·수정 내역을 세션 종료 전 memory에 저장 (다음 점검 때 중복 방지)

## §5. 참고 — 2026-07-02 세션에서 이미 확인되어 재검증 불필요한 것

- AI탭 measured 파이프(2026-05-20 수정) — 정상, 재발 없음
- naver_scanner·smart_place_auto_check의 실패/부재 구분 — 정상 (참고용 정상 사례로 활용 가능)
- Gemini/ChatGPT `sample_n()`, Google 스캐너 error 처리, `_calc_rank_in_category()` — 이미 수정 완료 (git `2236c11`). 이번 9개 페이지가 같은 함수를 재사용한다면 이미 고쳐진 상태이니 "정상"으로 판정할 것 — 재수정 시도 금지
