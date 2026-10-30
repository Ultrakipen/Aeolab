# Supabase 서버 최대 행 수(1,000) 점검 (2026-10-30)

## 발견
- **서버는 `.limit()`이 얼마든 한 번에 1,000행까지만 돌려준다**(실측, 서버 DB: `.limit(1000)`·`.limit(5000)`·`.limit(20000)` → 모두 1,000행, `.range(1000,1999)`는 정상 1,000행). 페이징(`.range()`)이나 서버 집계(`count="exact"`)를 쓰지 않은 `.limit(>1000)`은 조용히 잘린다.
- 확인된 실피해(수정 완료): 관리자 `/ai-cost`가 항상 1,000건에서 잘림(30일 실제 9,188건), `ai_daily_usage_alert_job`이 임계값 3,000에 **영원히 도달하지 못함**(경보 불능), `ai_capacity` 폴백 경로 상한.
- 도구: `backend/services/db_paging.py` `fetch_all_rows(factory, max_rows)` — 정렬을 붙인 쿼리 팩토리를 받아 1,000행씩 모두 읽고 잘림 여부를 돌려준다.

## 수정한 곳
| 위치 | 조치 |
|---|---|
| `routers/admin.py` `get_ai_cost` | 롤업(`ai_usage_daily`)+원본을 페이징으로 합쳐 집계 |
| `scheduler/jobs.py` `ai_daily_usage_alert_job` | 행 읽기 → 프로바이더별 서버 집계(count) |
| `services/ai_capacity.py` 폴백 | 페이징 |

## 남은 `.limit(1000 초과)` 조회 — 후속 점검 대상 (2026-10-30 시점 grep)
현재는 테이블이 작아 영향이 없거나 작지만, 행이 1,000을 넘는 순간 조용히 과소집계된다. 각 위치에서 "결과가 1,000행에 닿으면 잘렸음을 알 수 없다"는 점을 확인하고 `fetch_all_rows` 또는 count로 바꿀 것.
- `routers/admin.py`: 28(구독 목록 5000)·501·574(trial_scans 5000)·577(businesses 5000)·582·648·909·1067(2000)·1165
- `services/score_model_migration_notice.py`: 110·232(5000)
- `services/index_aggregator.py`: 282(2000, "메모리 안전 상한")
- `scheduler/jobs.py`: 6971(`ai_provider_health_check_job`, 2000 — 최근 30분이라 잘려도 비율 판단에는 지장 적음)·7284(5000)
- 우선순위 제안: 사업장·구독자 수에 비례하는 조회(`admin.py` 28·577, `score_model_migration_notice`)와 호출 로그 비례 조회가 먼저다.

## 로그 롤업·보관 (같은 날 구현)
- 테이블 `ai_usage_daily`(SQL은 `scripts/supabase_schema.sql` 끝, **SQL Editor에서 수동 실행 필요**). 매일 05:20 KST `ai_usage_rollup_job`이 하루가 끝난 날의 `ai_usage_log`를 (일·프로바이더·모델·목적)별로 합치고, **롤업과 원본 건수가 일치한 날만** 보관 기간(`AI_USAGE_LOG_RETENTION_DAYS`, 기본 35일, 0=삭제 안 함) 지난 원본을 한 시간 창씩 지운다. 테이블이 없으면 아무것도 지우지 않고 관리자 집계는 원본으로 폴백한다. 한 번에 처리하는 날짜 수에 상한(롤업 백필 10일·삭제 7일).
- 실서버 확인(테이블 생성 전): 원본 51,474줄 그대로, `/ai-cost`는 `source: raw`로 폴백.

## 후속 정리 (2026-10-30 저녁)
남은 `.limit(>1000)` 조회를 모두 페이징(`fetch_all_rows`)·서버 집계(count)로 교체했다. 대상: `routers/admin.py` 구독 목록·MRR·주간 퍼널 4표·scan_results v31 표본·guides 2곳, `score_model_migration_notice.py` 2곳, `jobs.py` 주간 다이제스트(1,000행 정확히면 잘렸는지도 알 수 없었음)·`ai_provider_health_check_job`(프로바이더별 count)·`backend_scaling_trigger_check_job`, `index_aggregator.py` 인용 표본(.range 루프, 상한 2,000). 구조 테스트 `test_no_limit_above_server_row_cap_remains`가 재유입을 막는다(서버의 추적되지 않는 옛 폴더 `ai_scanner_deploy_tmp/`는 제외 — 임포트 안 됨).
**미조치**: `.limit()` 없는 조회도 1,000행에서 잘림, `.in_("user_id", 수백 개 id)`의 URL 길이 한계(미확인).

## 후속 2 — `.limit()` 없는 조회와 `.in_()` 길이 (2026-10-31)
앞 절의 "미조치" 두 가지를 에이전트 전수 점검(`.table(` 약 700곳, 후보 213곳 중 25건 확정)과 실측으로 처리했다.

### `.in_()` 목록 길이 실측 (서버→Supabase, 존재하지 않는 UUID, 읽기 전용)
| 목록 크기 | 결과 |
|---|---|
| 100 / 200 / 250 / 300 / 400 / 600 | 성공 |
| 700 / 800 / 900 / 1,000 / 1,500 | **400 Bad Request** ("JSON could not be generated") |

한계는 UUID 600~700개(URL 약 23~26KB) 사이다. 에이전트가 추정한 약 220개는 과소평가였다. 한계를 넘으면 예외가 나서 잡 전체가 중단될 수 있으므로
공용 도구 `services/db_paging.py`의 `fetch_all_in_chunks`(150개씩, 한도의 1/4)로 나눠 조회한다. 300명 목표 규모에서는 URL 길이가 아니라 **1,000행 절단이 먼저** 문제다.

### 수정한 곳 (모두 서버 반영·md5 일치·테스트·커밋)
| 영역 | 위치 | 수정 전 문제 |
|---|---|---|
| 야간 스캔 대상 | `scheduler/jobs.py daily_scan_all` | 구독·사업장 1,000행 초과 시 뒤쪽 사용자가 스캔에서 조용히 빠지고, `in_` 한도 초과 시 잡 중단 |
| 경쟁사 크롤 | `competitor_place_sync_job`·`enrich_competitor_details_job`·`detect_competitor_changes` | 경쟁사는 사업장×5~10이라 사업장 100~200곳에서 1,000행 초과. 소유자 맵이 잘리면 정상 구독자의 경쟁사까지 크롤에서 제외 |
| 알림·리포트 잡 | `weekly_kakao_notify`·`daily_kakao_notify`·월간 뉴스·경쟁사 추월·신규 경쟁사·키워드 알림·주간 초안·월간 성장 카드·내 가게 통계·월간 리포트·주간 성적표·브리핑 경보·리뷰 인박스 | 1,000번째 이후 사용자 누락 |
| 업종 내 순위 | `routers/scan.py _calc_rank_in_category` | 서버 상한 외에 **덜 자주 스캔하는 사업장이 모집단에서 통째로 빠지는 결함**(`limit(사업장 수×3)`+날짜 정렬). 이제 최근 14일 안의 점수를 모두 읽음 |
| 용량 기준 | `services/naver_capacity.py active_business_count` | active만 세어 유예·해지 후 만료 전 사용자가 빠지고 관리자 사업장이 들어감 → 야간 스캔과 같은 자격 기준으로 통일 |
| 창업 분석 | `routers/startup.py`(시장 개요·타이밍 지수)·`services/startup_report.py` | 사업장별 최신 1건을 위해 스캔 이력 전체를 읽다 잘림, 추세 구간이 임의로 잘려 부호가 뒤집힐 수 있음 → 최근 30일 기준 |
| 관리자 | `routers/admin.py` 사업장 검색·`/stats`·`/revenue`·업종 분포·전체 알림톡 일괄 발송 | 검색 total이 1,000에 고정(경고도 안 울림), 구독자 1,000명 초과 시 일부에게만 발송되는데 응답은 성공처럼 보임 |
| 이력 | `routers/report.py /history` | 무제한 플랜 최대 3650행이 1,000행에서 잘림 |
| 용량 경보 | `services/ai_capacity.py` | 정렬 키가 고유하지 않아 페이지 경계에서 중복·누락 가능 → `id` 보조 정렬 |

### 재발 방지 (구조 테스트 `tests/test_db_paging_and_alerts.py`)
- 변수·표현식 `.limit()`은 허용 목록(`_VARIABLE_LIMIT_ALLOWED`)에 값의 상한 근거와 함께 올려야 한다. 이전 테스트는 숫자 리터럴만 봐서 `.limit(DB_SCAN_CAP)`·`.limit(limit_rows)`·`.limit(len(x)*3)`이 빠져나갔다.
- `jobs.py`에서 `subscriptions`·`competitors`를 `_db()`로 전체 읽으면 실패한다(`_db_all`/`_db_all_in` 사용). 날짜·플랜으로 좁혀진 8곳은 변수명과 사유로 허용 목록에 있다.

### 아직 고치지 않은 것 (임계값과 이유)
| 위치 | 임계값 | 영향 | 비고 |
|---|---|---|---|
| `jobs.py inactive_post_alert_job` `.limit(500)` | 대상 사업장 500곳 초과 | 정렬이 없어 같은 500곳만 반복 알림 | 300명 목표 아래라 보류 |
| `jobs.py keyword_alert_job` `.limit(200)` | 하루 신규 인용 200건 초과 | 일부 알림 누락 | 의도된 상한 |
| `routers/admin.py` `list_users(per_page=1000)` | 가입자 1,000명 초과 | 관리자 이메일 검색이 빈 결과 | 관리자 전용, 300명 목표 아래 |
| `routers/blog.py` 인용 목록(정렬 없음) | 인용 1,000건 초과 | "인용된 글" 표시가 비결정적으로 누락 | 낮음 |
| `routers/admin.py get_scan_logs` `limit` 요청 파라미터 | 요청이 1,000 초과 | 관리자 화면에서 1,000으로 잘림 | 낮음 |

### 측정에서 확인된 사실
- `verify_nightly_scan.py` 실행 결과 이 점검 시점의 **관리자 소유가 아닌 정기 스캔 대상 사업장은 1곳**(Biz, 창원 마사지)이고, 하라식당 본점·홍스튜디오는 관리자 계정이라 야간 스캔에서 제외된다. 활성 구독 4건 중 나머지 1건(창업패키지)의 소유 사업장·실결제 여부는 확인하지 못했다(미확인). 즉 위 문제들은 **규모가 커질 때 터지는 문제**이며 지금 사용자에게는 영향이 없었다.
