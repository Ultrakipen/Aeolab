# 5개 페이지 상업 서비스 점검 + 변화 기록 재검증 핸드오프 v1.0 (2026-07-06)

> **새 대화창 1줄 트리거**: `docs/five_pages_and_action_history_handoff_v1.0.md 기준으로 §3(잔여 작업)부터 이어서 진행`
> 부분 진행은 `§3의 N번만 진행`처럼 지정 가능.

## §0. 배경

`docs/nine_pages_measurement_inspection_v1.0.md`(2026-07-02 신설) 계획의 9개 영역 — ✅ 전체 완료(2026-07-06). 경쟁사 관리·성장 리포트·개선 가이드·소개글 콘텐츠·변화 기록(2차 재검증)은 이 문서 §1에서, 블로그 진단은 별도 세션(`project_blog_analysis_v2_reaudit_2026_07_06`), 리뷰 답변·AI 광고 대비·창업 시장 분석은 §3-2(2026-07-06 후속 세션, git `d0d5b3a`)에서 완료.

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

### 3-1. falsy-zero 패턴 전역 스윕 — ✅ 완료 (2026-07-06, git `b9c40ed`)

`grep -rn 'unified_score.*or.*total_score\|unified_score.*or.*track1_score\|unified_score.*or 0' backend/`로 17개 지점 전수 확인. 각 지점을 "같은 `calculate_score()` 호출에서 나온 값이라 `total_score`가 `unified_score`의 완전한 별칭인가(무해)" vs "DB에 저장된 서로 다른 시점 행을 비교하는가(위험)" 기준으로 판정:

**실제 수정 4건**:
- `jobs.py _detect_competitor_score_spike` — **최우선 발견**: `competitor_scores` 딕셔너리의 실제 키는 `"score"` 하나뿐인데 존재한 적 없는 `"unified_score"`/`"total_score"`를 읽어 이 함수가 상시 0점 비교로 완전히 무력화돼 있었음(스파이크 알림이 한 번도 발동한 적 없었을 가능성). 표시 이름이 `comp_id`(uuid)로 나오던 버그, 미정의 변수 `delta_int`(NameError로 알림 발송 후 쿨다운 insert가 매번 스킵 → 향후 스팸 위험) 동반 수정
- `report.py` `/visit-delta` (VisitDeltaBanner) — `unified_score` 컬럼이 나중에 ALTER TABLE로 추가돼 과거 행은 NULL인데 `or 0`이 결측치를 진짜 0점 취급 → 허위 급락/급등 배너. `total_score` fallback 추가
- `business.py` 트라이얼→사업장 전환 시 `score_history`/`scan_results` 초기값 — is-not-None 체인으로 하드닝
- `jobs.py` `weekly_score_report_job`/`_get_score`(월간 성과 이메일) — 동일 원칙 하드닝

**수정 불필요 판정(13곳)**: `admin.py`·`guide.py`·`report.py`(87/2920/4300/4317/4421/4454)·`scan.py`(933/990)·`share.py`·`score_attribution.py`·`trial_conversion.py`·`jobs.py`(2158/2665-2666)·`pdf_generator.py`(406/492/746) — `score_engine.py:982-983`에서 `total_score`가 `unified_score`의 완전한 별칭(`"total_score": unified`)으로 반환되므로, 같은 스캔 호출 내에서는 두 필드가 항상 동일해 `or` 폴백이 실질적으로 다른 값을 끌어올 수 없음. 최초 조사 에이전트가 이 13곳도 BUG로 오판했었음 — **직접 `score_engine.py` 반환 구조를 확인해서 반증한 것이 오판을 막은 핵심**.

배포: md5 사전확인(server==git HEAD 일치 확인) → scp → pm2 restart(에러 0건) → 서버 grep 재확인 → 로컬 git 커밋 완료. push는 보류(기존 drift 미해소).

### 3-2. 리뷰 답변·AI 광고 대비·창업 시장 분석 — ✅ 완료 (2026-07-06, git `d0d5b3a`)

`docs/nine_pages_measurement_inspection_v1.0.md` §3의 7·8·9번을 2단 레이어(Layer A 프론트/Layer B 백엔드) 병렬 에이전트 감사 후 9건 수정·배포:

- `guide.py` review-reply — Claude 실패 시 캔드 답변이 실패 표시 없이 `review_replies` 이력에 영구 저장 + 한도 소비. `is_fallback` 플래그 추가, 폴백이면 저장 생략(같은 파일의 `smartplace-faq`에 이미 있던 패턴과 통일). 프론트 폴백 안내 배너 추가
- `crisis_guide.py` — 위기관리 가이드도 동일 패턴으로 `is_fallback` 부재 → 추가, `CrisisGuidePanel` 안내 배너 추가
- `report.py` `/sentiment` — 감정분석 실패(`status=error`)가 1시간 캐시에 "0/0/0"인 것처럼 저장되던 버그 → error는 캐시 저장 생략
- `ad_defense_guide.py` — Gemini 스캔 전체 실패 시 `sample_size`가 50으로 폴백돼 "50회 측정해서 0회 노출"이라는 허위 확신을 프롬프트에 심던 버그 → 0으로 수정
- `startup.py`/`startup_report.py` — `competitor_count`는 전체 모집단을 보여주면서 `avg_score`는 순서 없는 앞 10~20개만으로 계산하던 불일치 → 전체 모집단 기준 통일. `/report` 인라인 타이밍·`/timing`에 `/market`과 동일한 `is_estimated` 플래그 추가. `/timing` reasoning 텍스트의 원점수 숫자 노출도 텍스트 레이블로 전환(현재 3페이지 미사용 확인, 향후 지뢰 방지)
- `guide.py` scan_snapshot — `naver_measured`만 있고 `chatgpt`/`gemini`는 스캔 실패를 "미언급 확정"과 구분 못 하던 비일관 처리 → `chatgpt_measured`/`gemini_measured` 추가

방법론 노트: Layer A/B 에이전트가 각자 9건을 보고했고 메인 세션이 file:line 직접 Read로 전수 재확인 후 구현. UNCLEAR로 남긴 항목 중 `sample_10()` 비-evidence 버전 데드코드 여부는 후속 재점검(§ 아래, git `963228c`)에서 전수 grep으로 확정 — `chatgpt_scanner.py`는 진짜 데드코드, `gemini_scanner.py`는 `/api/scan/stream` 빠른 진단에서 쓰이는 라이브 코드였고 동일 성공/실패 오집계 버그 + Wilson CI 0나눗셈 크래시 위험까지 있어 수정. crisis-reply 한도 미설정은 여전히 미확정(의도적 설계 가능성 있어 보류).

### 3-3. ✅ 완료 (2026-07-06, git `6cdfb1e`)
`backend/routers/guide.py` smartplace-faq·review-reply 모두 — 폴백(AI 실패) 시 DB 저장은 건너뛰면서도 응답의 `"used"`는 무조건 +1 하던 불일치. `is_fallback`이면 `used`를 그대로 반환하도록 통일(§3-2에서 review-reply에도 새로 생긴 같은 클래스 버그까지 함께 수정).

**§3 전체 완료 — nine_pages_measurement_inspection_v1.0.md 9개 영역 + 잔여 정리까지 모두 처리됨.**

## §4. 관련 문서·메모리
- `docs/nine_pages_measurement_inspection_v1.0.md` — 원본 9개 영역 계획·방법론
- 메모리 `project_five_pages_commercial_inspection_2026_07_06` — 1차 점검 상세 + 오판 정정
- 메모리 `project_action_history_measurement_audit_2026_07_06` — 변화 기록 1차+2차 전체 이력
