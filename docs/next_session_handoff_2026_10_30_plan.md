# 새 대화창 인수 문서 — 2026-10-30 (측정 신뢰·300명 대응·처방 품질)

> **새 대화창 트리거**: `docs/next_session_handoff_2026_10_30_plan.md 기준으로 §4의 N단계 이어서 진행`
> 이 문서는 2026-10-30 대화의 합의·현재 상태·남은 작업을 담는다. 수치는 모두 출처와 "실측/모델/추정/미확인"을 구분해 적었다.
> 먼저 CLAUDE.md '작업 중요 지침 8~10번'(차단 대응·사용자 신뢰도·오판/오탐/누락 재검증)을 읽을 것. 최종 보고 끝에 "오판/오탐/누락 재확인" 1~3줄, 확인 못 한 것은 "미확인".

---

## 0. 사용자가 확정한 방향 (10-30 대화)

| 항목 | 내용 |
|---|---|
| 제품 가치 | **개선 처방** — 사용자에게 필요한 정보와 그에 따른 신뢰도 향상 |
| 신뢰의 비중 | **측정의 정확도와 안정성**이 큼 (측정이 흔들리면 처방도 신뢰를 잃는다) |
| 규모 목표 | **사용자가 300명까지 늘어도 대응 가능**해야 함 (한꺼번에 가입해도 원활하게) |
| 네이버 차단 | 위험이 있으므로 **미리 보완** |
| 경쟁사 정보 갱신 | **2주 유지** (3·4주 레버를 용량 대응책으로 제안 금지 — 메모리 `feedback_competitor_refresh_keep_2weeks_2026_10_30`) |
| 용량 스위치 | 안전망일 뿐 해법이 아니다. 300명 목표와는 반대 방향(한도에서 멈추는 장치) |
| 제외(사용자 몫) | Gemini 유료 결제 후 `GEMINI_MEASUREMENT_LIVE=true`(무료 한도 소진 뒤), Claude 크레딧 충전, Supabase Pro 상향 |

### 이 대화에서 내가 한 오판 (같은 실수 반복 금지)
- "유료 스캔 사업장 5곳 안팎, 관리자·테스트 위주" → **근거 약함**. 5는 비유도 프로브 비교 표본 수였다. 실측: 사업장 9개(활성 8), 활성 구독 4건(창업 1·Biz 3), Basic 해지 2. 활성 구독이 실결제인지 관리자/테스트인지는 **미확인**.
- "전환 병목이 풀린 기록이 없다" → 과장. 07-20 이후 히어로 검색 막힘 버그·체험 개선이 여러 번 있었다. 전환율 자체는 측정 기록이 없어 **모름**.
- "코드로 할 수 있는 부분은 거의 했다" → 과장. 워커 분리 등이 남음.
- "300명이 한꺼번에 들어올 일은 거의 없다" → 근거 없는 가정이었다. 사용자는 **한꺼번에 가입해도 대응**이 목표.
- "점진 허용(대기자로 돌려 천천히 풀기)" 제안 → 사용자 요구와 맞지 않아 철회.

---

## 1. 현재 상태 (2026-10-30 기준, 모두 서버 반영·커밋·push 완료)

- 서버 git HEAD `a1061ea4` 이후 + 이 문서 커밋. pm2 backend/frontend online, `/health` 정상. 테스트: 로컬 990개, 서버 988개 통과(+1 skip).
- **오늘 완료**: `.limit(>1000)` 14곳 페이징·count 교체(`7b27db8`), 유도형 query_exposure 중단(`2788794`), 액션 재스캔 비유도 전환(`7ac7655`), 죽은 코드 삭제(`d191838`), `score_history.sample_size` NULL화+화면 "확인 전"(`2efc818`), 수용 스위치 캐시 초기값 결함 수정(`a1061ea`), 문서 동기화, **대행 알림톡 `KAKAO_TEMPLATE_DELIVERY_01~04=AEOLAB_DELIVERY_01~04` 서버 `backend/.env` 설정+재시작**(백업 `/root/backend_env_backup_20261030_delivery_tpl`).
- **수용 스위치(`NEW_SUBSCRIBER_CAPACITY_GATE`)는 서버 .env에 없음 = 꺼짐.** CLAUDE.md의 "사용자 결정으로 켬" 문구는 실제와 다르다(정정 필요, §4-1).
- `ai_usage_daily` 테이블은 존재(0행). 내일 05:20 KST 첫 롤업.

### 실측 사실 (이번 대화에서 읽기 전용 조회)
| 항목 | 값 |
|---|---|
| 구독 | 창업패키지 active 1, Biz active 3, Basic cancelled 2 |
| 사업장 | 전체 9, 활성 8 |
| 체험 기록 | trial_scans 261행 |
| 경쟁사 행 | 9개(플레이스 ID 있는 것 8). 활성 사업장 2곳(3개·5개 등록), **공유 경쟁사 0곳**, 캐시 기록은 10-29 하루(적중 0/미적중 8) → **겹침 측정 불가 단계** |

### 공개 데이터 겹침 추정 (시뮬레이션, 실측 아님)
- 방법: 카카오 로컬 공식 API(호출 66회, 네이버 미접속)로 6지역×3업종 18구역, 구역당 가상 사업장 N개가 실제 추천 로직(검색어 상위 5곳)대로 경쟁사 3곳 선택.
- 결과(절감률=겹쳐서 크롤 안 해도 되는 비율): 구역당 5개 → 평균 35~45%(13~60%), 20개 → 67~90%. 미용 업종은 후보 풀이 작아 겹침이 특히 큼.
- **해석**: 사용자가 소수 지역·업종에 몰리면 크고, 전국에 흩어지면 0에 가깝다. 모델의 가정 40%는 구역당 5개 안팎일 때 수준. **300곳 계획은 겹침 0~30%로 보수적으로**, 40%는 실제 분포 확인 뒤 반영.
- 한계: 모두 같은 구역에 있다고 가정, 직접 검색한 경쟁사·AI 언급 우선 규칙 미반영, 카카오 ID≠네이버 플레이스 ID, 카카오 순서≠네이버 순서. 사용자 분포는 **미확인**.

---

## 2. 반드시 지킬 규칙 (요약)

- 편집 전 로컬/서버 md5 비교(`tr -d '\r'`) → 로컬 편집 → scp(LF) → 서버 pytest → pm2 restart(백엔드) / `npm run build`+restart(프론트) → 라이브 검증 → **git 커밋 필수**. **push는 사용자가 지시할 때만.** 커밋 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 서버에서 네이버 점검 함수를 연속 호출 금지(2026-10-27 서버 IP 차단). 화면 확인은 로컬 Playwright 1페이지, 서버는 공식 API·DB 읽기 전용만. 구글은 서버에서 직접 접속 금지.
- error ≠ false(차단·실패를 미노출/0점으로 저장 금지). 측정 못 한 것은 "확인 전". 점수 숫자 직접 노출 금지(텍스트 라벨), PC/모바일 분리, text-sm 이상.
- Gemini 프롬프트에 개인정보 금지. AI 생성 콘텐츠 사실 지어내기 금지. 키 값은 화면·명령행·문서·메모리에 기록 금지.
- 프록시·기능 축소·IP 분산은 사용자 결정 없이 금지.
- 테스트는 `backend` 폴더에서 실행. 변이 검증(수정을 빼면 실패하는지), 픽스처는 실제 응답.
- 복잡한 패치는 Write로 스크립트 파일을 만들어 실행. Windows Git Bash `sleep` 단독 대기 금지(`until ...; do sleep; done`).
- 서버 스크립트 실행: `cd /var/www/aeolab/backend && set -a && . ./.env 2>/dev/null && set +a && PYTHONPATH=. /var/www/aeolab/venv/bin/python 스크립트` (scp 후 실행·삭제). `.env` source 시 78행 때문에 경고가 나지만 동작한다. Supabase 접근은 `from db.supabase_client import get_client`.
- 서버 `.env` 두 파일: `backend/.env`(백엔드가 읽음), `/var/www/aeolab/.env`.

---

## 3. 사용자 몫 / 사용자 결정 대기

**사용자가 직접**: Gemini 유료 결제→(무료 한도 소진 뒤) `GEMINI_MEASUREMENT_LIVE=true`+프론트 재빌드 / Claude 크레딧 충전 / Supabase Pro 상향 / V1 수기 비교(`docs/v1_measurement_validity_protocol_2026_10_30.md`) / 알림톡 승인 본문 4개 전달 / 법적 자문(개인정보처리방침 AI 업체 명시·국외 이전, 네이버 접속, GitHub 사전 스캔 IP) / 계정 비밀번호 변경 / 서버 `.env` chmod 600 / 구글 콘솔 청구 확인 / 베타 후기 1~3개.

**결정 대기**: 300곳 목표 시점·쓸 레버 범위(AI탭 질의 축소 B안, `NAVER_CAPACITY_BUSINESSES` 상향, 플랜별 한도 차등, 범위 축소, IP 분산) / 용량 스위치 켜는 기준(한도의 몇 %)·대기자 안내 / 질의 공유 캐시 켜기(켜면 "각 N회 독립 측정" 표현 금지) / 검증용 사업장 야간 스캔 포함 / "언급됨" 기준 재검토 / 서버 옛 폴더 `backend/services/ai_scanner_deploy_tmp/` 삭제.

---

## 4. 작업 순서 (내가 진행)

### 1단계 — 바로 가능한 정리
1. **CLAUDE.md 정정** (700줄 이내 유지 — 현재 약 697줄이라 새 항목은 오래된 "최근 업데이트"를 `docs/changelog_archive.md`로 이관하며 추가):
   - 수용 스위치 "사용자 결정으로 켬" → 실제는 꺼짐.
   - "서버 `KAKAO_TEMPLATE_DELIVERY_01~04` 전부 비어 있음" → 10-30 설정 완료(승인 본문 변수 대조는 미완).
   - 경쟁사 갱신 2주 유지 결정, 겹침 추정 요약, 이 문서 링크를 '작업 참고 문서' 표 ②그룹에 추가.
2. **용량 모델 겹침 가정 보수화**: `scripts/naver_load_model.py`에서 경쟁사 겹침 가정(40%)에 0%·30% 시나리오를 추가하고 300곳 결과를 다시 계산 → `docs/naver_capacity_300_playbook_2026_10_29.md`에 반영. 경쟁사 주기는 2주 고정.

### 2단계 — 측정 정확도·안정성 (최우선)
3. **야간 스캔 결과 검증**(읽기 전용): 최근 scan_results의 `gemini_result.probe`(`recommend_v1`)·`sample_size`(≈100)·`ai_basis`, `scan_analytics.query_exposure`가 `recommend`만 기록되는지, `business_action_log`의 재스캔(`rescan_done`, 표본 0이면 미설정) 결과. 유도형 호출이 없는지 로그 확인.
4. **롤업 첫 실행**(내일 05:20 KST 이후): `ai_usage_rollup_job` 로그, `ai_usage_daily` 행 생성·unique(`day,provider,model,purpose`)와 upsert 일치, `/ai-cost`의 `source`가 `raw`→롤업으로 바뀌는지, 35일 지난 원본 삭제는 "롤업=원본 건수"일 때만. ※ 내일 09:50 Gemini 70% 알림은 시험 호출 때문에 가짜일 수 있음.
5. **1,000행 잘림 전수 점검**: `.limit()` 없는 조회·`.range()` 없는 select가 1,000행을 넘을 수 있는 곳(관리자·잡). 구조 테스트 `test_no_limit_above_server_row_cap_remains`는 `.limit(>1000)`만 막는다. 또 `.in_("user_id", 수백 개)`의 URL 길이 한계(PostgREST) 확인 — 추정만 있고 **미확인**.
6. **네이버 트랙이 빠진 상태 재현 점검**: 쿨다운·일일 상한·캡차일 때 대시보드·결과 화면·알림이 "확인 전"으로 정직하게 보이는지(`NaverStatusBanner`, `naver_status`). 서버에서 네이버를 호출하지 말고 임시 상태 파일/단위 테스트로 재현. 실제 차단 상황은 **미확인**.
7. **라이브 화면 확인**(로그인 필요 → 사용자와 함께): 변화 기록 "확인 전" 렌더링, `PayButton` 대기자 안내, 가입 후 첫 측정 완주(`/basic-trial` 접수→status 폴링), 실제 네이버 포함 수동 측정 총 시간(`ScanProgress` 90초 안전망 대비).

### 3단계 — 300명 대응
8. **정기 스캔 워커 분리 설계**: 현재 `uvicorn --workers 1`, in-memory 락 9개(6파일)·Playwright 세마포어가 프로세스 간 미공유. 참고 `docs/backend_worker_scaling_trigger_v1.0.md`. 설계만(구현은 트리거·결정 후).
9. **접속량 절감(기능 손실 없는 것부터)**: `naver_capacity.PLAYBOOK` 단계별 레버. 경쟁사 주기는 건드리지 않음. 만료 계정 제외는 적용 완료(경쟁사 크롤 81%가 만료·관리자 계정이었음). 효과는 03:30 로그의 "서비스 기간이 끝난 계정 제외" 줄과 `/admin/naver-access` 경쟁사 출처 페이지 수(기대 약 48→18, 미확인).
10. **공유 캐시 겹침 실측 재조회**: 가입자 10~20곳이 생긴 뒤 §1의 조회를 다시(경쟁사 행 중 활성 사업장 기준 `naver_place_id` 공유 수 + `/admin/naver-access`의 `rank_card_cache`·`place_cache_snapshot` 적중률).
11. **용량 보정**: 활성 사업장이 한도의 90%일 때 `scripts/naver_model_calibrate.py` 실행.
12. **수용 스위치 기준 확정**(결정 후): `NEW_SUBSCRIBER_CAPACITY_GATE=true`+`CAPACITY_GATE_PCT`, 서버 `.env` 한 줄+재시작. 이것은 마지막 안전망.

### 4단계 — 처방 품질 (제품 가치)
13. **가이드·처방 점검**: 유명 가게(어니언 성수·하라식당 등)와 실사용자 가게로 가이드를 끝까지 읽어 ①지어낸 사실(가격·영업시간·시설 등) 없음 ②측정된 격차에서 나온 처방인지 ③"확인 전" 항목을 처방 근거로 쓰지 않는지. 과거 사실 지어내기 사고가 3번 있었다(`guide_generator.py`, `briefing_engine`, 이메일).
14. **처방 효과 추적**: 첫 실사용자가 처방을 실행→`business_action_log`→7일 뒤 재스캔(`check_action_rescans`, 표본 10회 비유도)으로 변화가 보이는지. 실사용 데이터가 있어야 완결(현재 표본 없음).

### 5단계 — 정리 (급하지 않음)
15. 조건 검색(`condition_search_scanner.py`, 소개글 포함이라 의도적 유도형)과 경쟁사 소개문 보강 잡(`jobs.py:_enrich_competitor_excerpts`, 일 02:00, 옛 항목만·주 최대 50회)은 옛 항목이 사라지면 삭제 검토.
16. 서버 옛 폴더 삭제(사용자 승인 후).

---

## 5. 참고 문서·메모리
- 방향·재검증 기록: 이 문서 §0~1. 마스터 인수: `docs/next_session_handoff_master_2026_10_29.md`, `docs/session_handoff_2026_10_29_naver_block_scale_work_v1.0.md`.
- 용량: `docs/naver_capacity_300_playbook_2026_10_29.md`, `backend/services/naver_capacity.py`(PLAYBOOK), `scripts/naver_load_model.py`(`--levers 300`).
- 1,000행 상한: `docs/supabase_row_cap_audit_2026_10_30.md`. Gemini 비유도 전환: `docs/gemini_guided_calls_unguided_conversion_design_2026_10_30.md`.
- 독립·구글: `docs/naver_independence_design_v2.0_final_2026_10_29.md`. V1 검증: `docs/v1_measurement_validity_protocol_2026_10_30.md`.
- 메모리: `feedback_competitor_refresh_keep_2weeks_2026_10_30`, `project_capacity_billing_wrapup_2026_10_29`.

## 6. 미확인 목록 (추정을 사실로 쓰지 말 것)
활성 구독 4건의 실결제 여부 / 체험→가입 전환율 / 실제 가입자 지역·업종 분포와 경쟁사 겹침 / 네이버의 실제 차단 기준(우리 600건 상한은 제안값) / 오늘 밤 야간 스캔 결과 / 롤업·`/ai-cost` 동작 / 알림톡 승인 본문 변수와 코드 일치(01·03: 주문번호·패키지명·사업장명, 02: +예상일수, 04: 주문번호·사업장명·등급변화) / 실제 차단 상황의 사용자 화면 / 로그인 상태 화면 렌더링 / 경쟁사 크롤 절감 라이브 효과 / 처방의 실효.
