# 무료 체험의 실제 측정 가능률과 신뢰 구조 정리 (2026-11-04)

> 어니언 성수 라이브 대조 → 체험 기록 집계 → 화면 구조 개선. 사용자가 아직 없는 개발 단계의 결정이다.

## 1. 확인된 사실 (근거)

| 항목 | 근거 | 결과 |
|---|---|---|
| place ID 확보 | `trial_scans` 최근 45일 33건, `place_data` 21건 중 ID 있는 것 1건(20건은 URL만) | 5% |
| 스마트플레이스 점검 | `smart_place_check` 성공 0·오류 1(`home_load_failed`)·없음 32 | 소개글·소식 읽음 0건 |
| 내 가게를 지역검색 5곳에서 발견 | `naver_rank` 0/33 (카페 20·미용 7 등 6개 업종) | 사실상 상수 |
| 후기 많은 순 순위 발견 | `naver_result.review_sort_rank` 2/33 | 6% |
| ChatGPT 노출 확인 | `ai_mentioned` 17/33 | 52% |

- 원인: ID 복구 함수 `_recover_naver_place_id`(`scan.py:172`)는 지역검색 API를 쓰는데 이 API 응답에는 place ID가 없다(11-01 실측 22건 중 0건과 일치).
- 5곳 한도: NAVER API HUB 지역 검색 `display`는 1~5, `start`는 1만 명시 — https://api.ncloud-docs.com/docs/naver-api-hub-search-local
- 저장 컬럼이 항상 비는 것은 아니다: 저장 코드 `scan.py:1122`(`naver_rank=naver.my_rank`), `:1159`(`smart_place_check`).
- 한계: 33건·접속 IP 7곳이라 개발·운영 테스트가 섞였다. 구조 판단의 근거이지 사장님 행동 통계가 아니다.

## 2. 바꾼 것 (네이버 접속은 늘리지 않음 — 프론트엔드만)

- 한 줄 진단: 네이버 5곳 미발견만으로 부정 첫 줄을 만들지 않는다(`TrialResultStep.tsx` `verdictHeadline`, `naverFound`). ChatGPT가 확인되면 그것을 먼저 말한다.
- 네이버 5곳 미발견은 경고색이 아니라 중립색(5개 길 카드·네이버 현황·근거 목록).
- 소개글·소식: 읽음 → 사장님 답 → 모름 순으로만 사실로 쓰고(`introFact`/`postFact`), 모름이면 "확인 전"·"직접 확인 필요" 처방. 사장님이 답한 값은 "입력하신 값"으로 표시.
- 블로그 글 수: 부정 결론("글이 적은 편") 제거, 집계 기준 명시. 구글 지도: 다른 가게 평점 제거(리뷰 수 없는 비교).
- 가이드 Q&A 복사 문구: 확인 안 된 키워드를 "제공하고 있습니다"로 단정하지 않고 `[ ]`를 직접 채우게 함. 체험 가이드가 있을 때만 "볼 수 있다"고 안내.
- 네이버 주소 붙여넣기 안내: "직접 확인해 진단합니다"(약속) → "읽어 보겠습니다, 못 읽으면 '읽지 못함'으로 표시"(체험 기록 1건이 실패했으므로).
- 테스트: `tests/test_trial_trust_unmeasured_not_missing.py`, `tests/test_trial_measurement_health.py` (변이 검증 18건 통과).

## 3. 하지 않은 것과 이유

- 네이버 검색어를 구 이름→동네 이름으로 바꾸기: 5곳 한도라 효과가 작다고 판단(처음엔 근본 원인으로 짐작했으나 과장이었다). 바꾸려면 어느 경로(API/Playwright)인지 먼저 확인한다.
- 체험에서 place ID를 자동 복구하기: Playwright 검색 접속이 익명 방문자마다 늘어난다(지침 8번). 사장님이 직접 붙인 주소로만 점검한다.
- 점수 숫자 노출, 근거 없는 평균·기간 문구.

## 4. 미확인 (다음에 확인할 것)

1. **가입 후 1회 체험의 실제 결과물** — `_run_full_scan`은 `ensure_naver_place_id`(Playwright)로 ID를 확정한 뒤 점검한다(`scan.py:3231`). 실제로 소개글·소식·리뷰·AI 브리핑을 읽는지 한 번도 실행해 보지 않았다. 새 계정으로 1회 실행해 확인할 것(네이버 접속 수 페이지 발생).
2. 주소를 붙였을 때 `auto_check_smart_place`가 안정적으로 읽는지(유일한 ID 보유 기록이 `home_load_failed`). 로컬 Playwright 1페이지로 화면 구조 확인 가능.
3. 체험이 만든 가이드 본문 품질.
4. 어니언 1곳 외 다른 유명 가게(하라식당 등)와 모바일 화면.

## 5. 운영 점검

주 1회 서버에서 `cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/trial_measurement_health.py 45` (읽기 전용, 개인정보 미출력). "판단:" 경고가 나오면 화면이 해당 항목을 측정하는 것처럼 보이지 않는지 다시 확인한다.
