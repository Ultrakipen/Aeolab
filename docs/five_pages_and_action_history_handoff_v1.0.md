# 5개 페이지 상업 서비스 점검 + 변화 기록 재검증 핸드오프 v1.0 (2026-07-06)

> **새 대화창 1줄 트리거**: `docs/five_pages_and_action_history_handoff_v1.0.md 기준으로 §3(잔여 작업)부터 이어서 진행`
> 부분 진행은 `§3의 N번만 진행`처럼 지정 가능.

## §0. 배경

`docs/nine_pages_measurement_inspection_v1.0.md`(2026-07-02 신설) 계획의 9개 영역 중 이번 세션에서 5개를 완료했다: 경쟁사 관리·성장 리포트·개선 가이드·소개글 콘텐츠·변화 기록(2차 재검증). 나머지 4개 중 블로그 진단은 별도 세션에서 이미 완료됐고(`project_blog_analysis_v2_reaudit_2026_07_06` 참조), 3개는 아직 미착수다.

## §1. 이번 세션 완료 내역

### 1-A. 5개 페이지 1차 점검 (git `71707d4`)

**P1 4건**:
- 성장 리포트: `backend/routers/report.py` `get_history()`에 `exposure_freq` 추가 + `score_history` 조인으로 `rank_in_category`/`total_in_category`/`weekly_change` 보완 (업종 순위·노출빈도 카드가 항상 비어있던 버그)
- 개선 가이드: `backend/services/guide_generator.py` 프롬프트가 요약문에 raw 점수 숫자를 강제 삽입하도록 지시하던 부분 제거 + `GuideClient.tsx` `simplify()`에 안전망 정규식 추가
- 경쟁사 관리: `CompetitorTimeline.tsx` 차트 지터가 툴팁 성장단계 판정까지 오염시키던 버그 — 원본 점수를 별도 키(`${name}__raw`)로 보존
- 소개글·콘텐츠: `DashboardContentZone.tsx` "월 5회" 문구가 v3.5 한도 상향(10회) 이후에도 구버전 값으로 남아있던 것 수정

**P2 7건**: 크롤러 서브스텝 부분실패 플래그(`competitor_place_crawler.py`), 가이드 재생성 시 `scan_id` 필터로 구버전 가이드 오인 방지(`guide.py` `/latest`), FAQ 생성 실패 시 폴백+quota 비소비(`guide.py` `/smartplace-faq`), FAQ 한도 버킷 통합(`business.py`), 일괄 동기화·재스캔 실패 시 사용자 피드백(`CompetitorsClient.tsx`/`PlaceCompareTable.tsx`), 점수 범위 숫자 노출 제거(`GapAnalysisCard.tsx`)

**⚠️ 오판 정정**: 1차 감사는 `/guide/chatgpt-search` 링크 8곳이 404라고 P1 확정했으나, 구현 단계에서 이미 `frontend/app/(public)/guide/chatgpt-search/page.tsx`에 완성된 콘텐츠(ChatGPT 노출 조건·체크리스트)가 존재함을 발견. `frontend/app/(dashboard)/guide/**`만 Glob해서 없다고 판단한 게 원인 — **Next.js 라우트 그룹은 URL에 영향 없다는 걸 놓침. 향후 "라우트 없음" 판정 전 반드시 `frontend/app/**/해당경로/**` 전체 검색할 것.**

### 1-B. 변화 기록 2차 재검증 (git `b386cb5`)

1차(2026-07-06, git `833be09`)가 "이상 없음"으로 덮었던 3곳을 재감사에서 추가 발견:
- `jobs.py:765-780` — falsy-zero 버그를 잡 **내부**(`check_action_rescans`/`_fill_action_score_after`)만 고치고 **호출 직전 콜사이트**(`_auto_log_score_change`/`_auto_log_competitor_overtake` 호출부)는 누락. 코드 주석에 "TrendLine 이벤트 오버레이용"이라 명시돼 있어 스코프 안이었음
- `TrendLine.tsx` — `TrendPoint`에 `unified_score` 필드 자체가 없어 30일 추세선이 `total_score`만 그림. 같은 페이지 요약 카드는 `unified_score ?? total_score` 사용 — 한 페이지 안에서 다른 점수 체계를 시각화하던 구조적 결함
- `DashboardDetailZone.tsx` — `Action7DayChart`에 플랜 게이트 누락(형제 섹션 전부 `["basic","startup","pro","biz"].includes(plan)` 게이트 있는데 이것만 예외)

부수 수정: `jobs.py`의 두 자동 로그 함수 `datetime.utcnow()`(timezone-naive) → timezone-aware 통일, `report.py` POST `/action-log` 중복 방지 추가, `BlogScreenshotSection.tsx` 조용한 catch → 에러 메시지 추가.

**교훈**: "이상 없음" 1차 판정은 체크리스트 항목별로는 맞았지만 (a) 같은 버그의 콜사이트 전체를 못 훑었고 (b) "페이지가 참조하는 모든 파일" 매핑이 불완전했음(대시보드 쌍둥이 컴포넌트 누락). **재검증 요청이 오면 이전 감사의 "정상" 판정도 전부 다시 의심하고 호출 그래프·형제 컴포넌트 대조까지 할 것.**

### 1-C. 배포 검증

두 배치 모두 서버 md5 사전확인(git HEAD == 서버, drift 없음 확인 후 진행) → scp → 백엔드 재시작(에러 0건) → 프론트 `npm run build`+재시작(에러 0건) → 서버 grep으로 라인 재확인 → 라이브 curl 헬스체크 → 로컬 git 커밋 완료. push는 보류(기존 서버/로컬 drift 미해소 상태 — CLAUDE.md §Drift 방지 장치 참조).

## §2. 방법론 재확인 (다음 감사에도 적용)

`docs/nine_pages_measurement_inspection_v1.0.md` §1의 2단 레이어(프론트 UI 하드코딩 + 백엔드 측정 파이프라인 무결성)에 더해, 이번 세션에서 추가된 교훈:

1. **콜사이트까지 확인** — falsy-zero류 버그를 고칠 때 대상 함수 내부만 grep하지 말고 그 함수를 호출하는 지점까지 `grep -rn "<함수명>" backend/`로 전부 훑을 것
2. **형제 컴포넌트 대조** — 같은 API를 쓰는 컴포넌트가 여러 곳(대시보드/가이드/성장 리포트 등)에 있으면 하나만 보고 "정상"이라 판정하지 말고 전부 대조할 것 (Action7DayChart vs ActionTimelineCard 사례)
3. **라우트 존재 판정은 전체 app 검색** — `frontend/app/**/<경로>/**`로 검색, 특정 라우트 그룹((dashboard)/(public) 등)으로 좁히지 말 것
4. **재검증 요청 시 이전 "정상" 판정도 의심** — "오판 검증"과 "누락 검증"은 별개 축. 오판은 있는 문제를 없다고 판단한 것, 누락은 안 본 곳이 있는 것. 재검증은 둘 다 열어놓고 시작할 것

## §3. 잔여 작업 (다음 세션 트리거 후보)

### 3-1. falsy-zero 패턴 전역 스윕 (약 20곳, 우선순위 중)
동일 패턴(`unified_score or total_score/track1_score`, 또는 `unified_score or 0`)이 아래에 남아있음:
- `backend/routers/admin.py` (MRR 추세)
- `backend/services/pdf_generator.py`
- `backend/services/score_attribution.py`
- `backend/services/trial_conversion.py`
- `backend/scheduler/jobs.py`의 성장 리포트/창업 시장 분석 관련 잡들
- `backend/routers/report.py`의 growth-card/growth-simulation 엔드포인트
- `backend/routers/report.py:5020` 부근 (`VisitDeltaBanner.tsx`가 쓰는 "오랜만에 방문" 배너 — `unified_score or 0`이 결측치를 진짜 0점으로 취급)

시작점: `grep -rn 'unified_score.*or.*total_score\|unified_score.*or.*track1_score\|unified_score.*or 0' backend/`

### 3-2. 미착수 3개 페이지 (nine_pages 계획 잔여, 우선순위 중)
`docs/nine_pages_measurement_inspection_v1.0.md` §3의 7·8·9번 — 아직 이번 방법론(2단 레이어)으로 감사 안 함:
- 리뷰 답변 (`review-inbox/page.tsx`, `guide.py` review-reply/crisis-reply)
- AI 광고 대비 (`ad-defense/page.tsx`, `ad_defense_guide.py`)
- 창업 시장 분석 (`startup/page.tsx`, `startup_report.py`)

### 3-3. 사소한 정리 (우선순위 낮음, 원하면 진행)
`backend/routers/guide.py:860` — FAQ 생성이 폴백으로 처리돼도 응답의 `"used": used + 1`이 그대로 반환돼, 그 응답 1회에 한해 사용량이 실제보다 1 부풀려 표시됨(DB엔 저장 안 되므로 다음 조회부턴 정상). 화면 표시상 미미한 오차.

## §4. 관련 문서·메모리
- `docs/nine_pages_measurement_inspection_v1.0.md` — 원본 9개 영역 계획·방법론
- 메모리 `project_five_pages_commercial_inspection_2026_07_06` — 1차 점검 상세 + 오판 정정
- 메모리 `project_action_history_measurement_audit_2026_07_06` — 변화 기록 1차+2차 전체 이력
