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
