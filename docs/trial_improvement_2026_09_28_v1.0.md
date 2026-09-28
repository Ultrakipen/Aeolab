# 무료 체험 개선 작업 기록 v1.0 (2026-09-28)

> 계기: "무료 체험에서 나오는 정보가 실측·사실이고 가치 있는가" 점검 → 결과 화면 재구성.
> 목업(Claude 아티팩트) → 사용자 확정 → 구현·배포·라이브 검증까지 완료. git `6b9a0a0`·`2799350` + 이후 커밋.

---

## 1. 발견한 문제 (근거·검증 완료)

| # | 문제 | 근거 | 조치 |
|---|---|---|---|
| P0 | **체험 결과가 DB에 저장되지 않음** (7/15 이후 0건) → 즉시 결과 이메일도 미발송 | 로그 `22P02 invalid input syntax for type integer: "9.0"` — `trial_scans.smart_place_completeness`가 INTEGER인데 점수엔진이 실수를 넣음 (`scan.py` `_to_int_or_none`) | 정수 변환. 서버 라이브 저장 확인 |
| P1 | **Gemini 무료 티어 한도** — 하루 20회·분당 5회. 체험이 10회 호출해 대부분 실패, 실패가 "미노출"로 표시 | 서버 직접 호출 429 `GenerateRequestsPerDayPerProject-FreeTier`; `ai_usage_log` 9/17~ 성공 ~20 vs 실패 190~290/일; 최근 스캔 60건 Gemini 유효샘플 0~9/50~100 | **체험에서 Gemini 호출 제거**. 유료 스캔 영향은 미해결(결제 연결 = 사용자 작업) |
| P1 | **ChatGPT 유도형 프롬프트 오탐** — 가게명을 프롬프트에 넣어 "추천되나요?"라고 물음. 표본 5→50회로 늘리자 단 1회 환각이 "노출 확인"으로 표시 | 가짜 가게 3곳 중 2곳이 50회에서 1~4회 노출 (`쿠쿠루삥뽕헤어` 1/50, `은하수필라테스스튜디오` 4/50) | **비유도형 추천 프로브** `sample_recommend` — 가짜 가게 0/50 |
| P2 | 미측정을 "미노출"로 표기 (네이버 AI 브리핑·Gemini) | 체험 응답에 `in_briefing` 키 없음(null) → `briefingOk = inBriefing===true` | "가입 후 실측"으로 표기 |
| P2 | 과장·모순 문구 (Google AI/네이버 AI 측정처럼 읽힘, "경쟁 가게 소개글 분석", stale 항목 비중 30/25/15/15/10) | 코드 대조 | 정정 |
| P3 | 복사용 문구(FAQ·리뷰답변·소식)가 내용 없거나 미보유 특징을 암시 | 라이브 화면 | `[ ]` 빈칸 방식으로 변경 |

## 2. 구현 내용

### 백엔드
- `routers/scan.py`: 저장 정수 변환, 체험 Gemini 호출 제거(non_location/location 분기 모두), `_verify_places_on_naver`(AI 추천 가게를 네이버 지역검색과 대조 — exact/similar/none/None), `_competitor_blog_counts`(경쟁 5곳 블로그 건수, 이종 업종 제외 규칙은 `naver_visibility` 1위 경쟁사 선정과 동일), `keyword_volumes`(SearchAd 월 검색량, **요청 키워드만** 담음 — API가 연관 키워드 수백 개를 함께 반환), FAQ 복사 문구 `[ ]` 빈칸
- `services/ai_scanner/chatgpt_scanner.py`: `sample_recommend`(비유도, 50회, 10개씩 배치) + `names_match`(부분 문자열 대신 **지점 표기 접미사만 허용** — "카페 모모"가 "카페 모모카"에 걸리던 오탐 수정)
- `services/ai_scanner/multi_scanner.py`: `scan_trial` → `sample_recommend(n=50)`
- 서버 실측: 체험 응답 약 17~21초(진행 화면 "30~60초" 안내 범위 내), 표본 50/50 성공

### 프런트엔드
- **탭 구조**(한눈에 / 경쟁 비교 / 네이버 현황 / AI 검색 / 할 일·로드맵) — `TrialResultStep.tsx`. 모바일 문서 길이 약 10,000px → 약 5,400px, 가로 넘침 0
- 신규 `components/trial/TrialResultExtras.tsx`: `ResultTabs`, `PriorityFixCard`(먼저 고칠 것 3가지), `DirectCheckCard`(직접 확인 — 질문 복사·네이버/구글/ChatGPT 열기), `NextWeekBand`, `GeminiExampleCard`(**예시 화면 라벨 + 가입 후 실측**, 구글 비즈니스 프로필 체크리스트), `PassedItemsAccordion`, `AIRecommendedPlacesCard`, `CompetitorBlogBars`, `ChannelPeriodsCard`, `RoadmapCard`
- `NaverStatusSection`에 `part="compete"|"place"|"all"` 추가(경쟁 비교/네이버 현황 탭 분리)
- `TrialKeywordRecommendCard`: 키워드 그룹별 보기 + 월 검색량(0 → "10회 미만"), 업종 표준 가중치("노출 영향도 N%") 표기 제거
- 하단 가입 배너: 스크롤 420px 이후에 노출(모바일 첫 화면 25% 가림 해소)
- 입력 화면·결과 화면 카피 정정 (Google AI / 네이버 AI 측정 표현 제거, 체험 vs 가입 후 범위 정확 안내)

## 3. 지켜야 할 원칙 (이번 작업에서 재확인)
- 더미·예시 수치 금지. 신규 카드는 실측이 있을 때만 숫자 표시, 예시는 "예시 화면 · 실제 결과 아님" 라벨로 분리
- 점수 숫자 비노출 유지 (건수·회수·순서·검색량 같은 실측값은 표시)
- 미측정은 "미측정/가입 후 실측", 추정은 "(추정)" — 실패를 "미노출"로 표기 금지
- 이름 매칭에 부분 문자열 포함 금지 (`names_match`)

## 4. 잔여 과제 / 알려진 한계

1. **Gemini 결제 연결 (사용자 작업)** — 유료 스캔(scan_all/basic_trial)의 Gemini는 여전히 무료 티어 한도로 대부분 실패. 결제 연결 후 `ai_usage_log`로 성공률 재확인. 코드의 `gemini-2.5-flash` 하드코딩은 환경변수화 권장(같은 계열 Lite가 이미 종료 통보)
2. **유료 스캔의 ChatGPT도 유도형 프로브** — `_check()`(scan_all/scan_basic)는 아직 가게명을 프롬프트에 넣음. 과거 이력 연속성 때문에 이번엔 체험만 교체. 교체 여부 결정 필요
3. **"Google AI Overview" 채널 실체** — Serper 응답에 `aiOverview`가 오지 않음(서버 직접 4개 질의 0/4, 저장 스캔 301건 in_ai_overview 0건). "mentioned"는 organic 검색 언급까지 포함. 체험에는 미포함(→ "구글 검색 노출"로 정직하게 추가 가능). 유료 화면의 "Google AI Overview 실측" 문구 재검토 필요
4. **표본 5→50 후 남은 문구**: 목업에서 사용자가 "단순 5→50 치환"으로 확정. 실제 화면은 신뢰구간을 데이터에서 계산해 표시(50회 0건 → 0~7%)
5. 체험 IP 제한(3회/일)으로 라이브 반복 검증 시 캐시 주입 방식 사용(`trial_result_cache`, sessionStorage+localStorage)
6. 결과 이메일 발송이 `trial_scans` insert와 같은 try 블록 — insert 실패 시 이메일 미발송 구조는 유지(저장 버그만 수정)
7. 이전 `trial_scans` 집계(벤치마크·growth-funnel)는 7/15~9/28 공백 존재 — 07-20 "체험 전환 0건이 병목" 결론은 이 공백의 영향 가능성이 있어 재점검 필요(미검증)
8. 목업 주석 정정: "썬댄스"는 댄스학원이 아니라 카테고리 `음식점>양식`의 실제 음식점이었음 — 필터 불필요

## 5. 검증 이력
- 서버 직접 호출: 저장(DB 행 확인), 표본 50/50, Gemini None, top_places·on_naver·competitor_blog_counts·keyword_volumes 반환
- 라이브 브라우저(PC 1280 / 모바일 390): 탭 5개 전환·aria-selected·hidden 상태, 가로 넘침 0, 새 카드 렌더링, 캐시 주입 복원
- 목업: https://claude.ai/artifact/89XTRvXcEafy382M7cw9Ck (PC·모바일·3단계 사다리)

---

## 6. 후속 개선 (같은 날 저녁) — 첫 화면 진단·길이 축소·계측

솔직한 평가(첫 5초 설득력 5/10, 길이, 계측 부재)에 따른 3건. 서버 반영·라이브 검증 완료.

1. **첫 화면 "한 줄 진단"** (`TrialVerdictCard`): 실측·입력에서 계산한 문장만 사용 — 헤드라인(AI/네이버 약함 여부 조합) + 불릿 3개(AI 검색: ChatGPT N회 중 M회·네이버에서 확인된 추천 가게 / 네이버 검색: 상위 결과 여부 / 블로그: 1위 경쟁사와 건수 차). 바로 아래에 "먼저 고칠 것 3가지". 추천 가게는 **네이버에서 확인된(exact/similar) 곳만** 이름으로 안내하고 "자주"라고 단정하지 않음
2. **길이 축소**: 성장단계 히어로를 네이버 전용인 "네이버 현황" 탭으로 이동(한 줄 진단과 중복), 구독 기능 잠금은 "할 일" 탭에만, 다음 측정일 중복 제거, 체험 vs 구독 비교표 접이식. 모바일 탭별 약 13~25%↓ (한눈에 5,373→4,052px, PC 3,751→2,730px). 진단 카드가 추가된 뒤의 순감소
3. **계측(GA4)**: `trial_tab_view`{tab}, `trial_priority_more_click`, `trial_direct_check`{channel, action=copy|open}, `trial_signup_cta_click`{location=next_week_band}, `trial_sub_compare_toggle`{open}. 기존 `trial_complete`·`trial_signup_cta_click`(sticky_banner/action_features_lock)과 함께 볼 것
4. **결함 수정**: `NextWeekBand`의 "무료 가입하고 다음 결과 받기"가 `onSaveTrialData`만 호출하고 가입 페이지로 이동하지 않던 것을 `Link href="/signup"`으로 수정 (기존 CTA와 동일 패턴)

남은 한계: 길이는 여전히 모바일 4,000~5,400px — 하단 공유·구독 비교 외에 탭 본문(키워드 그룹·항목별 분석 등)이 김. 사용자 반응(이탈·전환)은 계측 데이터가 쌓여야 판단 가능

---

## 7. 후속 개선 2 (같은 날 밤) — 개선안 ①③④ 순차 진행 (git `47845b3`·`0b8a083`·`e0203ad`)

"개선 방안을 찾아줘" → 코드·실측으로 반증한 항목만 제안, 사용자 "순차적으로 진행" 승인. 결과:

| # | 항목 | 결과 |
|---|---|---|
| ① | 스캔 진행 화면 문구 | `page.tsx` SCAN_STEPS가 "네이버 AI 브리핑 검색 중"(미측정)·"가게명 확인 중"(현재는 비유도 추천 프로브)이었음 → 실제 측정 내용으로 교체. `TrialScanningStep`의 "네이버·ChatGPT·Gemini AI에게 직접 물어보고 있습니다"(Gemini 미사용)·"30~60초"(실측 17~21초)도 정정. 진행 단계 간격 2초→4초(5단계가 8초 만에 끝나 "결과 정리 중"에 12초 머물던 것) |
| ③ | 스마트플레이스 자동 진단 커버리지 | **근거 실측**: `trial-search` 후보의 `naver_place_id`가 `""` (네이버 지역검색 API가 place URL을 주지 않음) → 후보를 골라도 자동 진단 불가가 구조적. 입력 화면에 "내 가게 네이버 지도 주소(선택)" 추가 — `lib/naverPlaceUrl.ts`가 place_id 추출(백엔드 `business.py::_extract_naver_place_id`와 같은 규칙, naver.me 단축주소·타 도메인은 안내), 붙여넣으면 검색 단계 생략 + 버튼 "붙여넣은 주소의 가게로 진단 시작". 백엔드 `TrialScanRequest.naver_place_id`에 숫자 5~15자리 검증 추가(그 외는 None 처리 — 이 값이 Playwright URL에 들어가므로). 라이브 종단 확인: 실제 UI에서 붙여넣기 → 서버 로그 `smart_place_auto_check: place_id=898503091` 실행. Playwright 전역 일일 상한(`check_naver_playwright_quota`)은 `auto_check_smart_place` 내부에서 이미 적용(초과 시 graceful 실패) |
| ④ | 결과 이메일 | **제안 당시 전제가 틀렸음**: "이메일 받을 곳이 없다"고 했으나 `TodayOneAction`에 이메일 저장 코드가 있었다 — 단 JSX에 렌더링되지 않는 죽은 코드였고, `save-email`은 주소만 저장하고 메일을 보내지 않으며 팔로업 잡은 비활성. → 결과 화면(한눈에 탭)에 `TrialEmailCard` 신설(개인정보 동의 필수, 서버 응답 ok일 때만 "보냈습니다" 표시), `save-email`이 **체험당 최초 등록 때만 1회** 결과 요약 메일 발송(반복 호출로 임의 주소에 발송하는 남용 차단). 메일 본문 정정: "어제 스캔에서 발견한 것"(즉시 발송인데 어제라고 씀)→"방금 진단에서 확인한 것", **미응답을 '소개글 없음'으로 처리하는 입력 기본값을 근거로 "AI가 내 가게를 설명하지 못합니다"라 단정하던 것**은 `place_measured`(스마트플레이스 실제 진단) 때만 허용, "내 가게 소개글에 없습니다" 단정 → "소개글에 넣어 보세요" |

### 제안했으나 하지 않은 것 (사유)
- **⑤ 탭 안 중복 제거**: 라이브 실측 결과 ChatGPT 카드 "지금 할 일"과 다른 곳의 중복은 약 200자 — AI 검색 탭 1,603자 중 작고, `ChatGPTResultCard`는 공용이라 위험 대비 이득이 작아 보류(제안 당시 "겹친다고 본다"는 가설이었고 이번 실측으로 규모가 작음을 확인)
- **⑥ 흔한 이름 경고**: 지역을 질의에 함께 넣고 있어 영향 제한적 — 우선순위 낮아 보류
- **② 유료 스캔 ChatGPT 유도형→비유도형 교체**: 유료 점수 이력에 영향 — 사용자 결정 필요(문서 §4-2)

### 검증
- 서버 직접: `save-email` 첫 호출 sent=true(Resend 정상 → 서버 로그 `팔로업 이메일 발송 OK`), 재호출 sent=false, 잘못된 주소 400. 체험 저장은 백그라운드라 스캔 직후 즉시 호출하면 404 가능(실사용에선 사용자가 결과를 본 뒤 제출하므로 무관)
- 라이브 UI(PC): 주소 붙여넣기 4상태(ok/short/invalid/empty), 스캔 → 결과 → 이메일 카드 동의 게이트 → 제출 → "결과 요약을 이메일로 보냈습니다". 모바일 390px 가로 넘침 없음
- 테스트로 만든 `trial_scans` 3행(하라식당 본점, 수신 `delivered@resend.dev`) 삭제 완료 — 통계 오염 방지
- **미검증**: 실제 사용자 수신함 도달(스팸함 여부) — Resend 샌드박스 주소로만 확인. GA4 이벤트가 실제 수집되는지는 GA4 실시간 화면에서 확인 필요(CSP·환경변수는 정상)
