# 네이버 꺼짐 의존성 표 (2026-10-29)

> 핸드오프 §3 작업. **코드를 읽어 확인한 것만 "확인", 읽지 않은 것은 "미확인"** 으로 표시했다. 실측(실제 차단 상황 재현)은 하지 않았다 — 서버에서 네이버 점검 함수를 연속 호출하면 차단되므로 코드 호출 그래프로만 정리.
> 차단 = 회로 차단기 쿨다운(`naver_access_guard.begin_*_access`) 또는 일일 상한(`check_naver_playwright_quota`) 또는 캡차/접속 실패.

## 1. 접속 지점별: 차단되면 무엇을 반환하나 (확인)

| 접속 지점 | 접속 방식 | 차단 시 반환 | 위치 |
|---|---|---|---|
| 네이버 AI 브리핑 `check_mention` | Playwright 검색 화면 | `error:"naver_search_cooldown"` / `quota_skipped` | `naver_scanner.py:437-440` |
| 브리핑 다중 질의 | 〃 | 쿨다운·상한 시 해당 질의 결과 + 중단 | `naver_scanner.py:516-523` |
| AI탭 `scan` | Playwright | `None` (스킵) | `naver_ai_tab_scanner.py:174-181` |
| 키워드 순위 | Playwright PC·모바일 | `pc_rank/mobile_rank = None` + `error` (0점 아님) | `naver_keyword_rank.py:464-469` |
| 내 가게 통계 `fetch_stats` | Playwright 플레이스 | `{error: …}` | `naver_place_stats.py:55-65` |
| 스마트플레이스 점검 | Playwright 플레이스 | `{**default, error}` | `naver_place_stats.py:251-260` |
| 스마트플레이스 자동 점검 | 〃 | `_failed_result(원인)` | `smart_place_auto_check.py:109-111` |
| 경쟁사 크롤 | 〃 | `{**default, error}` | `competitor_place_crawler.py:233-236` |
| 블로그 검색 분석 | Playwright 검색 | `total_found:0, my_rank:None, captcha_detected:False` | `blog_search_analyzer.py:72-80` |
| 플레이스 ID 확정 | Playwright 검색 | `RuntimeError("naver_search_cooldown")` | `naver_place_resolver.py:123-124` |
| 스크린샷 | Playwright | `None` | `screenshot.py:224-225` |

공식 API(검색·DataLab·검색광고·지역검색)는 위 회로와 무관 — 파일: `naver_api_hub.py`, `naver_datalab.py`, `naver_searchad.py`, `local_search.py`.

## 2. 소비 쪽: 그 표식을 "확인 전"으로 다루나

| 경로 | 판정 | 근거 |
|---|---|---|
| 브리핑·AI탭 → 점수 | **확인 전 처리 확인** (제외 후 재정규화) | `score_engine._is_naver_unmeasured` `:509`, 사용처 `:1551`·`:1688`, `_renormalized_track1` `:1491` |
| 브리핑·AI탭 → 스캔 저장 | 확인 | `scan.py:2194-2198` (캡차·상한·`page_load_failed`·`briefing_unrecognized`를 미노출로 저장하지 않음) |
| 브리핑·AI탭 → 화면 | 확인 | `frontend/lib/naverMeasure.ts` `isNaverUnmeasured`, 마지막 성공 결과를 날짜와 함께 표시(30일 이내) |
| 키워드 순위 → 점수 | 확인 (`measured` 플래그, 미측정은 제외) | `score_engine.py:1554`, `:1582` |
| 스마트플레이스 점검 → 스캔 DB | 확인 (`error`면 저장 안 함, 측정된 항목만 기록) | `scan.py:2708-2731`, `:3181` 이후 `recent_post_measured`/`intro_measured` |
| 스마트플레이스 직접 점검 API | 확인 (503 "지금은 점검할 수 없습니다", 항목은 `passed=None·measured=False`) | `report.py:5226-5245` |
| 내 가게 통계 → 덮어쓰기 | 확인 (읽은 값이 0보다 클 때만) | `naver_place_stats.py:686` |
| 경쟁사 평점 저장 | 확인 (0이면 `None`) | `competitor_place_crawler.py:908` |
| 경쟁사 점수 계산 | **수정 완료(2026-10-29, git `a10bd6c`)** — 평점 결측 시 리뷰 수만으로 100점 환산. 리뷰 수 0은 읽지 못한 것과 구분 불가라 0점 유지 | `competitor_place_crawler.py:761-775` |
| 블로그 검색 분석 | **확인 — 정상** (2026-10-29). 반환에 `error`가 있으면 저장하지 않고 이전 결과를 유지, 실패 키워드를 30분 상태 캐시에 남겨 화면이 "일시적 차단 또는 측정 오류로 갱신하지 못해 이전 결과를 표시 중" 안내. 소비처는 `report.py` 한 곳뿐 | `report.py:4619-4632`, `:4655-4667`, `BlogScreenshotSection.tsx:585-589`. 사소한 문구 한계: 이전 결과가 아예 없는 첫 분석이 막혀도 "이전 결과를 표시 중"이라고 나옴(미수정, 이전 결과 유무 판단 로직 미확인) |
| 순위·경쟁사·스크린샷의 각 화면 문구 | **미확인** | 백엔드 표식까지만 추적, 프론트 개별 컴포넌트 라이브 대조 없음 |

## 3. 이번에 찾은 접속 구멍

- `detect_new_competitors`(월 04:30)가 사업장마다 경쟁사 최대 3곳의 스마트플레이스 점검을 호출해 `has_faq`를 읽었으나, `has_faq`는 Q&A 탭 폐기 후 항상 `False`(`naver_place_stats.py:452`)라 결과가 항상 0이었다. 용량 모델에도 없던 접속. **제거함** (git `7c6170d`, `tests/test_new_competitor_job_no_place_crawl.py`).
- 같은 유형 점검 필요(미수행): `check_smart_place_completeness`·`auto_check_smart_place`의 다른 호출처(`business.py:635`, `scan.py:954`)가 쓰는 필드 중 폐기된 값이 더 있는지.

## 4. 네이버가 완전히 꺼져도 남는 것 (코드상)

글로벌 AI 트랙(Gemini·ChatGPT·구글·스키마·언급), 공식 API 기반 순위(place_rank)·검색량·지역검색, 사용자 입력(별점·리뷰·키워드), 콘텐츠 생성 도구(소개글·FAQ·가이드). **다만 ACTIVE 업종은 네이버 트랙 비중이 커서 점수 자체는 "확인 전" 제외 후 재정규화로 남은 항목만 반영된다.** 이 재정규화 결과가 사용자에게 "충분히 의미 있는 점수"인지(예: 브리핑 25%·순위 25%가 모두 빠진 경우)는 **미확인** — 결정이 필요하면 별도 점검.

## 5. 다음 점검 후보 (우선순위 제안)

1. (완료) 경쟁사 점수의 평점 결측 재정규화.
2. (완료) 블로그 검색 분석 차단 시 화면 — 정상 확인.
3. 네이버 트랙 항목 대부분이 빠졌을 때의 점수·문구(§4).

## 6. 구독자가 있다고 가정한 용량 점검 (2026-10-29, 코드 기준 모델 — 실측 아님)

**서버에 실제 켜진 조합**(슬롯 분산 꺼짐, 경쟁사 오래된 순서 켜짐)으로 요일별 하루 네이버 페이지 수를 계산했다(`scripts/naver_load_model.py`의 `daily_loads`, 키워드 4·경쟁사 3·상한 600·배치 몫 420, 사전 스캔 재사용 가정).

- **발견**: 부하가 월요일 하루에 몰린다. 30곳에서 월 534 vs 화 91·일 91. 상한에 닿는 시점이 월요일 하나로 정해졌다. 월요일 최대 항목은 Basic(가게의 약 70%) 키워드 순위가 전부 월요일에 모이는 것이었다.
- **조치**: Basic 순위 잡을 매일 실행하고 가게별 요일(`scan_scheduling.keyword_rank_day`, 경쟁사/스캔 슬롯과 다른 소금값)에만 측정 — 가게당 주 1회는 그대로, 공개 문구에 순위 요일 약속 없음(grep 확인). `tests/test_keyword_rank_schedule.py`가 고정(변이 3종 검증).
- **효과(모델)**: 월요일 부하 20곳 356→252, 30곳 534→366, 50곳 854→590. 일일 상한 600 초과 시점이 약 40곳→50곳 이상, 배치 몫 420 초과 시점이 30곳→50곳 부근.
- **남은 한계**: 월요일이 여전히 가장 무겁다(Pro·창업·Biz 순위가 월·수·금, 스캔이 월·목 중심, 내 가게 통계가 월요일). 100곳에서는 월·수·목·금이 상한을 넘는다. 다음 후보: ① 내 가게 통계(주 1회, 월요일 6%)도 가게별 요일로, ② Pro 이상 순위를 가게별 3요일 패턴으로, ③ 스캔 슬롯 분산(패턴이 불균등해 켜기 전 수정 필요). ②·③은 플랜 약속(주 N회)과 연결돼 별도 결정.
- **전환 주 영향 없음**: 기존 잡은 월요일에 전원을 쟀으므로 이번 주는 누락·중복 없음.
- **미확인**: 첫 금요일 04:00 실행 로그("대상=N건"), 실제 가게 분포, 실제 사용자 수동 스캔 빈도(가정 0.2회/일), 캐시 적중률.
