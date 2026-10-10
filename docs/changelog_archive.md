# AEOlab 변경 이력 아카이브 (v1.2 ~ v3.7)

> CLAUDE.md 토큰 절약용 아카이브. 필요 시에만 이 파일 참조. 현재 상태·코드 패턴은 CLAUDE.md 본문 참조.
> 최종 갱신: 2026-08-31

---

## 2026-08-31 창업 시장 분석 종합 개편 — SBIZ 실측 도입부터 AI 전략 3단 고도화까지 (상세)
> CLAUDE.md 본문엔 압축 요약만 유지, 아래가 전체 상세 기록(7개 세션 흐름).

**① 실제 시장 규모 지표 신설 + SBIZ 400오류 근본해결**: "창업 시장 분석 목업이 가치있는 정보인지" 질문에서 출발해 카카오 `meta.total_count` 기반 실제 시장 밀도 지표 신설(네이버 `display` 5건 클램프 버그 발견해 카카오로 전환) → 국세청·카드사 기반 소상공인시장진흥공단 상가정보 API(`services/sbiz_api.py`, data.go.kr B553077) 연동, 상권업종코드 22개 실측 매핑. 배포 직후 curl/bare스크립트는 100% 성공하는데 실제 uvicorn 요청 처리 경로에서만 100% 결정론적으로 `INVALID_REQUEST_PARAMETER_ERROR`(400) 발생 — 최초 세션에서 10여 개 가설 소진하고도 원인 미규명인 채 카카오 폴백으로 커밋(`375e731`). 후속 세션에서 최소재현으로 확정: 미니 FastAPI+Sentry 앱으로 "Sentry 활성+실제 요청"에서만 재현 → `sentry_sdk`가 `aiohttp.ClientSession.__init__`을 전역 패치해 활성 span 중 생성되는 모든 aiohttp 요청에 `sentry-trace`/`baggage` 헤더를 자동 주입(기본 `trace_propagation_targets=None`=전체 전파)하는데 data.go.kr 게이트웨이가 이 낯선 헤더를 거부하는 것이 원인이었음. `main.py`의 `sentry_sdk.init()`에 `trace_propagation_targets=[]` 추가로 해결(단일 지점 수정이라 카카오·네이버 등 aiohttp 쓰는 다른 외부 API 호출에도 동일 안전망 적용됨). git `3195e37`.

**② 반경 행정구역별 자동조정 + restaurant I206 누락 + AI 지어내기 재발 2건**: "2km면 너무 작은 것 같은데 최적은?" 질의에 반경별 실측(1.5~5km, 응답시간 반경무관 0.3~0.6초 확인)으로 "숫자가 아니라 고정 반경 자체가 문제"임을 확인 → 카카오 지오코딩 응답의 `region_2/3depth_name`으로 동=1.2km/구=3km/군=6km/구없는광역시=4km 자동 산정(`sbiz_api.py`, git `455fcc6`). "정상작동·개선점" 재검증 중 `restaurant` 카테고리가 I201~I207 중 I206(기타 외국식) 누락 발견·수정 + 반경 수치 미고지 발견·캐비엇 추가(git `c65e654`). "높은 수준 가치 제공하는지 검증" 요청에 QA 계정으로 실제 리포트 생성 실행 중 Claude가 `estimated_time_to_visibility`를 근거 없이 "3~5개월"로 지어내 CLAUDE.md 자체 기준(2~4주)과 4~10배 괴리(AI 지어내기 패턴 4번째 발견 파일) + "강남구 임대료 3.3㎡당 15만~30만원" 등 프롬프트에 없는 비용 수치까지 임의 생성 발견 → 노출기간은 eligibility 기준 결정론적 문구로 백엔드 강제 산정, 비용 수치는 "지어내지 말고 sg.sbiz.or.kr 등 실제 상권분석 서비스로 안내" 프롬프트 지침 추가 + 업종 raw 코드("fitness") 한글 응답 누출도 `CATEGORY_KO` 매핑으로 수정(git `2ee992e`). "오판과 누락은?" 재확인 요청에 자체 반증 — 비용 지어내기 방지가 프롬프트 지시일 뿐 코드 강제가 아니라는 잔여 리스크와, 반경 티어 주석에 검증 안 된 구체적 면적(㎢) 수치를 적어둔 자기모순을 스스로 발견·인정. "밀도 지표"+"신뢰도 등급" 신설 — `density_per_km2` + `confidence`(동/구=양호, 군·구없는광역단체=낮음), 저신뢰 지역엔 프론트 경고박스+Claude 프롬프트 양쪽에 caveat 주입, 라이브 검증으로 Claude가 실제로 "완주군은 면적이 넓어 실제 경쟁사가 더 많을 수 있다"를 전략 텍스트에 반영하는 것까지 확인(git `9e9182c`).

**③ 경쟁사 준비도 체크 신설 — 순환논리 오판 자체발견 + 캐시버그 2건**: "돈 낼 만한 수준" 논의에서 "실제 경쟁사의 AI노출 준비도까지 보여주면 AEOlab만의 차별점"이라는 방향 → 법적리스크 재확인(제3자 사업장 무단조회라 기존 "본인확인목적" 방어논리 미적용, 로그인우회·AI브리핑체크는 배제하고 공개페이지만 조회하기로 사용자 승인) → 구현 중 실측으로 SBIZ 실제경쟁사 8곳(카페·헬스장) 전수 테스트 결과 네이버 오픈API `link` 필드 기반 place_id 탐색이 스타벅스 등 대형 프랜차이즈에도 100% 실패함을 발견 — 원인은 그 필드가 "네이버플레이스 링크"가 아니라 업체가 등록한 "홈페이지 URL"이라는 구조적 API 특성. "많은 사용자가 몰릴 경우" 질의에 구체 수치로 답변(구독자 100명만 돼도 이 기능 하나가 앱 전체 네이버 크롤링 일일예산 250건의 80%를 잠식) → "기존 competitors 테이블만 재사용하면 되지 않냐" 제안했으나 **사용자가 직접 순환논리 오류를 지적**("창업예정자가 AEOlab 자체 데이터에서만 경쟁사를 찾는 게 모순 아니냐") — 1단계(기존 테이블, 무료)+2단계(캐시 미스 시 실조회, 핵심기능과 분리된 격리 일일상한) 하이브리드로 재설계. 캐시 키 설계 전 실측: "강남"/"강남구"/"서울 강남구" 4개 표기가 전부 동일 업체 반환 확인 → 캐시 키를 지역텍스트 아닌 업체단위(dedup_key)로 설계. "오판 점검하고 진행" 요청에 구현 직후 라이브 테스트로 버그 2건 자체발견: ①캐시에 실패(None) 그대로 저장 → "캐시없음"과 "캐시된 실패" 구분 안 돼 동일요청 반복해도 quota 계속 소모 ②격리상한 도달로 "시도조차 못한" 경우까지 30일 "못찾음"으로 캐싱하면 상한 리셋 후에도 영영 재시도 안 됨 — 둘 다 즉시 수정 후 재검증. 잔여: 2단계 네이버 place_id 탐색 자체는 검색페이지 특유의 차단위험 미검증이라 보류, 기존 오픈API 방식 유지(거의 항상 실패하지만 그레이스풀). git `5789e56`~`ae676cb`.

**④ 페이지 목적 재정의 — AEOlab 자체 데이터 화면 제거**: "이 페이지가 AEOlab 등록 업체와 비교할 필요가 있는지, 원래 창업 예정자를 위한 상권 분석 아닌지" 질의에 명확화 — AEOlab 자체 데이터(경쟁사 수·평균 AI노출·경쟁강도·타이밍지수)는 차후 내부 활용 목적으로 백엔드 계산은 유지하되, 화면에서는 완전히 제거하고 정부·카카오 실측 상권 데이터 중심으로 재구성. "시장 현황" 헤더가 실제로는 AEOlab 고객 수(대부분 0/1건)를 보여주는 제목-내용 불일치를 코드+라이브 스크린샷으로 재확인 후 3박스+타이밍지수+상위경쟁사 섹션 전부 화면에서 제거. **화면만 고치고 끝내지 않고 Claude 프롬프트도 재점검** — competitor_count/competition_level/top_competitors가 여전히 프롬프트에 들어가 Claude가 "AEOlab 등록 경쟁사 1개뿐이라 선점 여지"처럼 내부지표를 시장분석에 섞어 쓰던 것 라이브 테스트로 발견·제거, 재검증으로 Claude 응답에 AEOlab 언급 0건 확인. git `5c4f481`.

**⑤~⑦ AI 전략 프롬프트 3단 개선**: 목업으로 결과를 직접 확인한 사용자가 "일반적인 내용"이라 지적 → "최적 방안을 자료조사 후 오판 선별해서 신중히 도출"하라는 지시로 외부 리서치(Anthropic 공식 프롬프트 엔지니어링 가이드+LLM hallucination survey 논문+few-shot prompting 자료) → Task→Role→Format→Context→**Constraints** 구조에서 기존 프롬프트에 Constraints가 통째로 빠져있던 게 근본원인. "역할부여"는 근거 약해 기각·"검증 재실행"은 비용 커서 2순위 보류. 프롬프트에 "각 문장은 제시된 구체 수치 중 최소 하나 인용 필수, 일반론 절대 금지" 제약 추가 — 라이브 재검증(카페/강남구·헬스장/해운대구)으로 실제 경쟁사명(디끌레·담다·에이치피트니스 등)까지 직접 지목한 조언으로 전환 확인(git `da6bb32`). 이어 자체 재평가로 잔여 이슈 2건 발견("같은 숫자 2~3개를 4개 필드가 전부 우려먹음", "통찰이 상식적 패턴매칭 수준") — 필드별 근거 배정(entry_strategy=시장규모, key_actions=경쟁사명, ai_optimization_tips=AI브리핑 적합성, risk_factors=트렌드) + "서로 다른 두 정보를 결합해 이 조합에서만 성립하는 함의를 도출하라"는 대조 예시 추가. 라이브 재검증(풍부한 데이터 카페/강남구·빈약한 데이터 학원/진도군)으로 업체명만으로 업체 성격을 추론("심스인베스트주"→법인형 다점포, "진도외국어체험센터"→공공기관 성격)하고 "주차 가능" 키워드 존재만으로 "진도군은 차량의존 지역"이라는 함의까지 도출하는 수준 확인(git `96a9ae7`). 마지막으로 "더 개선할 것은?" 질의에 "모바일 가독성 확인" 선택받아 라이브 모바일(390px) 실측 — "AI 진입 전략" 섹션이 문단 하나가 화면 하나를 다 차지할 만큼 길어진 것 발견(통찰강화의 부작용) → "통찰은 유지하되 마침표로 자주 끊어써라, 문장당 약 50자" 제약 추가 — 통찰 자체는 줄이지 않고 분할만 유도. 재검증: 섹션 높이 2288px→1537px(약 33% 감소), 결합추론은 그대로 유지되면서 문장만 짧아짐 확인(git `7672be8`).

## 2026-08-27 how-it-works Gemini 노출기간 서술 검증 — 1차 P1 오판을 반증으로 자체 정정 + 다른 7페이지 9곳 오설명 발견·수정
> "네이버·제미나이 노출기간이 사실적인지" 질의에 최초 `GEMINI_GROUNDING_ENABLED=true`(루트 `.env`)를 근거로 "페이지가 부정확하다" P1 판정했으나, `main.py`의 `load_dotenv()`가 실제로는 `backend/.env`(PM2 `exec cwd`)를 읽는다는 걸 놓친 오판이었음 — `backend/.env`엔 해당 변수 자체가 없어 기본값(false) 적용, pm2 로그(`"[gemini] grounding=False"`)로 실증. 결론: 페이지 서술은 정확했음 — 페이지 수정 불필요, 대신 루트 `.env`의 죽은 `GEMINI_GROUNDING_ENABLED=true`만 `false`로 정정. 이어진 "다른 페이지도 점검 필요한지" 후속조사에서 `dashboard/page.tsx`·`DashboardGlobalAiZone.tsx`·`DashboardGuidanceZone.tsx`·`SchemaClient.tsx`(2곳)·`score-guide/page.tsx`·`AiInfoTabGuide.tsx`·`faq/page.tsx`(2곳)·`demo/page.tsx`(3곳) 9곳이 "실사용 앱 한정" 캐비엇 없이 "Gemini는 실시간 연동 → 수 주~수개월"로 단정한 채 방치돼 실제(grounding=False) 동작과 불일치함을 발견·전부 "AEOlab 스캐너 기준 학습데이터 기반, 수개월~1년" 문구로 통일. md5선확인→scp→빌드→pm2재시작→라이브 curl로 검증.

## 2026-08-24 카카오 알림용 전화번호 결제모달 필수화 + CSP가 유발한 nginx 502 버그 발견·수정
> "전화번호 미등록 gap을 어떻게 할지" 판단 요청에 "무료체험 아닌 결제 확인 모달에 필수화" 권장 후 승인받아 구현(`PayButton.tsx`) — 기존 `updatePhone()`/`PATCH /api/settings/me` 재사용, 검증 실패 시 모달 유지, 결제 성공 여부와 무관하게 Toss 호출 전 저장. QA계정으로 빈값/형식오류/정상값 3케이스 실측 검증 후 계정 삭제(git `2e7b2a0`). 테스트 도중 실제 운영 버그 발견: `/dashboard` 등에서 502 "upstream sent too big header" 발생 — 그날 밤 추가한 CSP 헤더가 Supabase 인증쿠키와 합쳐져 nginx 기본 `proxy_buffer_size`(4~8k)를 초과한 것이 원인(pre-launch라 실사용자 피해 없음). `/etc/nginx/sites-enabled/aeolab`에 `proxy_buffer_size 16k`/`proxy_buffers 8 16k`/`proxy_busy_buffers_size 32k` 추가 후 재현 조건으로 재확인해 해소 확인.

## 2026-08-24 drift 재검증 중 2주+ 방치 미커밋 문서 복구
> `check_server_drift.sh` 재실행 → `package-lock.json` 진짜 drift 해소(서버→로컬, git `ee069f0`) + `git status`에 2026-08-05~08-13 커밋 안 된 실제 분석 작업물 7개 발견·복구(git `ccfac2a`, 가장 중요한 건 네이버 `robots.txt` 원문대조로 법적리스크 반증요소 하나가 무너졌다는 08-08 발견 — 단 법률자문 보류는 사용자 기결정이라 재권고 안 함). 상세는 `project_uncommitted_work_recovery_and_kakao_phone_gap_2026_08_24` 메모리 참조.

## 2026-08-23 CSP(Content-Security-Policy) 신설·강제적용 + 전 영역 + Toss 결제 3개 진입점 전수 실측 검증 완료
> "더 점검할 게 있을지도" 질문에 `loadTossPayments` grep 재검색으로 설정 페이지의 카드 변경(`SettingsClient.tsx handleCardChange`, `requestBillingAuth`)이 미검증이었음을 발견 — QA계정+가짜 active 구독 row로 실측, 위반 0건 확인. 코드베이스의 Toss SDK 호출 3곳(요금제 결제·대행서비스 결제·카드 변경) 전부 검증 완료. "외부 상업 서비스 기준을 직접 대조" 요청 후 CSP가 아예 없던 것을 발견해 신설 — Mozilla HTTP Observatory 실스캔 75점(B, CSP 미구현 -25)→강제적용 후 80점(B→B+). Report-Only 선배포 → QA계정+Playwright로 로그인·요금제 결제모달→Toss 카드입력iframe까지 실측해 위반로그 기반 allowlist 보정 → 강제적용. 재검증 요청이 이어지며 3파전 추가 검증: ①`delivery/new`+`/admin`에서 `google.co.kr` 리마케팅 픽셀 실제 차단 발견·수정 ②admin 전 페이지 11개 전수 실측 위반 0건 ③모바일 뷰포트(390×844)로 랜딩·로그인·대시보드·결제모달까지 실측 위반 0건. git `2507a62`~`f449648`. 상세는 `docs/commercial_launch_20_subscriber_hardening_checklist_v1.0.md`.

## 2026-08-23 cron 타임존 버그 전수 감사 — 10건 발견·수정
> CSP 재검증 도중 `disk_usage_check_job`에서 최초 발견한 타임존 버그(스케줄러가 이미 `timezone="Asia/Seoul"`인데 "UTC 변환"을 적용해 의도와 다른 시각에 실행)를 `jobs.py` 전체로 확대감사 → 9건 추가 발견: `conversion_followup_job`·`delivery_auto_cancel_job`·`delivery_auto_refund_job`·`delivery_stalled_in_progress_alert_job`·`delivery_30day_rescan_job`·`_check_v31_readiness_job`·`_check_data_wiring_readiness_job`·`check_naver_cookie_health_job`·`backend_scaling_trigger_check_job`(대부분 09~12시대 의도가 00~03시대로 밀림) + `ai_daily_usage_alert_job`(00:05 의도가 15:05로 반대방향으로 밀린 예외) — 전부 의도한 KST로 수정. 부가로 `_check_v31_readiness_job`·`_check_data_wiring_readiness_job`의 `get_supabase`(존재하지 않는 함수) ImportError도 `get_client`로 수정. git `29a5754`·`3381ce9`. `feedback_apscheduler_kst_no_utc_conversion` 메모리로 재발방지 기록.

## 2026-08-23 CSP 재검증 계속 — `window.open`+`document.write`+인라인 이벤트핸들러 패턴 신규 발견·검증(문제 없음 확인)
> "계속 이어갈 것" 지시로 `dangerouslySetInnerHTML|document.write|new Worker(` 코드베이스 전체 grep — `GuideClient.tsx`의 QR카드 인쇄 기능(`window.open('','_blank')` 후 `document.write`로 `<img onload="window.print()...">` 삽입)이 지금까지 테스트 안 한 패턴(팝업이 오프너 CSP를 상속하는지가 브라우저 스펙상 불명확한 영역)임을 발견. 실사업장에 QR카드용 tools 데이터가 없어 실제 기능 재현 대신, 동일 패턴(about:blank 팝업+document.write+인라인 onload)을 라이브 origin에서 `browser_evaluate`로 직접 재현 → `onload` 정상 실행 확인(CSP 위반 로그 0건) — 팝업이 오프너의 `script-src 'unsafe-inline'`을 상속해 정상 동작함. 나머지 `dangerouslySetInnerHTML` 사용처(FAQSection·faq/page·layout.tsx)는 전부 `type="application/ld+json"`이라 애초에 script-src 적용 대상 아님(비실행 MIME), `new Worker(` 사용처는 코드베이스에 없음 확인.

## 2026-08-23 출시 전 "운영 중 대응력" 종합 점검 — 결제-구독 불일치 감지 잡 + 디스크 사용률 알림 잡 신설
> "서비스 운영 중 발생 가능한 모든 상황을 대비한 점검"이라는 요청에, 페이지 단위(L1~L4) 대신 "장애·급증·악용 상황에서 운영자가 실제로 대응할 수 있는가"를 4개 영역으로 병렬 조사 후 직접 코드 재검증. 수정·배포 완료(P1 2건, git `ab0c2a0`): (1) Toss 청구 성공 뒤 `subscriptions` upsert만 실패하면 운영자가 알 방법이 없었음 → `payment_subscription_reconciliation_job`(매시 정각) 신설. (2) 서버 디스크 사용량 감시 코드 전무 → `disk_usage_check_job`(매일 09:30 KST — 2026-08-23 밤 타임존버그 발견·수정됨) 신설. 문서화만: 관리자 2FA·Naver/Google 헬스체크 공백·가입 rate limit·journald 디스크 누적. 반증 기각: `record_payment_event` 이중청구는 함수 자체가 예외를 삼키는 설계라 단독 발생 안 함.

## 2026-08-23 대시보드 페이지 부하테스트 실측 — 병목이 vCPU2 서버가 아니라 Supabase임을 발견
> "페이지 동시접속 vs 동시스캔 구분" 재질문 끝에 로그인 후 대시보드를 실측. QA 임시계정+`@supabase/ssr` 쿠키 포맷 리버스엔지니어링으로 실제 인증 세션 확보 → `/dashboard`에 동시성 5~80 램프. 동시 30명까진 3~9초, 50명 부근에서 34초로 급격히 붕괴했으나 그 순간 서버 CPU 0.1~0.2%·RAM 여유 2.7GB로 완전 유휴 — 대시보드 1회 로드의 약 10개 병렬 Supabase 쿼리가 Supabase Cloud 쪽에서 큐잉되는 것이 원인으로 추정, vCPU/RAM 업그레이드로는 해결 안 되는 별도 축의 병목. 페이지 동시접속 실질 안전선 약 30명. 상세는 `docs/dashboard_load_test_and_capacity_v1.0.md`.

## 2026-08-22 무료체험/가입후1회체험 설득력 검토 — P0 콘텐츠 사실 지어내기 3곳 발견·즉시 수정·배포
> "처음 접하는 사용자에게 체험 결과가 설득력·가치 있는지" 질문에 라이브 API 실호출(스타벅스·런던베이글뮤지엄·이혼전문법무사 등)로 시나리오별 재현. 콘텐츠 구조 자체(실측 기반 구체성, INACTIVE 업종 정직 안내)는 강했으나, 재현 도중 `top_missing_keywords`(경쟁사엔 있고 내겐 없는 "미보유 추정" 키워드)를 FAQ·리뷰 답변 자동생성 카피에서 "전문으로 합니다"/"강점으로 하고 있습니다"/"운영하고 있습니다"로 단정 서술하는 버그를 3곳(`scan.py` 체험 FAQ, `briefing_engine.py` 리뷰 답변 4개 분기, `guide.py`의 Basic+ 유료 기능 `smartplace-faq`) 발견 — 2026-07-08 `guide_generator.py` intro 사고와 동일 계열이나 이번엔 비회원 체험이 아니라 유료 구독자가 매달 쓰는 기능이라 더 심각. 단정 문장 → 중립 안내/초대 문장으로 교체, `smartplace-faq` 기본 키워드 출처를 갭분석 대신 사업장 등록 키워드(`biz.keywords`)로 변경. 라이브 curl 재현으로 수정 확인, git `bd379c0`. 잔여 개선안과 사업성장 방안은 `docs/trial_experience_persuasiveness_and_growth_v1.0.md` 참조.

## 2026-08-21 "Phase 기준 배제한 일반 상업기준" 재평가 — 프론트엔드 보안헤더 부재 P1 발견·수정 + PM2 재시작가드 신설 + 경량 부하테스트 실측
> "토스 실키 제외 준비됐는지" 질문에 이어 "Phase(자체유예) 기준 말고 일반 SaaS 기준으로 보면?" 재질문 — 네이버 회색지대·부하테스트부재·단일서버 가용성·제3자 보안점검 부재를 격상 대상으로 재분류 후, 사용자 선택(가벼운 엔드포인트만)에 따라 실행. ①보안헤더 실측 스캔 중 신규 발견: `backend/main.py`의 `SecurityHeadersMiddleware`(X-Frame-Options·CSP 등)가 `/api`·`/health` FastAPI 응답에만 적용되고, Next.js가 렌더링하는 로그인·가입·대시보드 등 실제 사용자 화면 HTML은 `next.config.ts`에 `headers()` 자체가 없어 보안헤더가 전무했음(라이브 curl로 실측 확인). X-Content-Type-Options·X-Frame-Options·Referrer-Policy·HSTS·Permissions-Policy 추가(CSP는 별도 검토로 보류 — 2026-08-23 git `2507a62`로 완료). git `ce20752`. ②PM2 크래시루프 방지 가드 추가(`ecosystem.config.js` min_uptime/max_restarts, `pm2 startOrReload` 결함으로 잠깐 다운됐다 즉시 복구). git `aecd04a`. ③경량 부하테스트 실측 — 동시성 5→30, 오류 0%, p95 1초 미만. ④네이버 법률자문요청서는 2026-08-08 이미 발송 보류 결정된 사안임을 재확인(재권고 안함).

## 2026-08-21 "미점검 영역 전수조사" 재점검 — 이용약관 손해배상 조항 공백 + Sentry 노이즈 필터 발견·수정
> 08-09/08-10 76+페이지 재점검 이후의 커버리지 공백을 조사 — git 커밋 히스토리(08-20 3건, 토스페이먼츠 심사 대응 중 발견해 임기응변 수정된 것으로 CLAUDE.md·메모리 갱신 없이 방치됨) + 서버 drift + PM2 라이브 에러로그를 직접 훑어 신규 갭 2건 확정. ①§9(3) 손해배상 한도 조항이 08-20에 신설된 제5조의2(대행 서비스) 결제금액을 반영 못함: `create_order`(`delivery.py:361`)가 `get_current_user`만 요구해 활성 구독 없이도 대행서비스(최대 119,000원) 결제가 가능한데, 손해배상 한도가 "최근 3개월 구독 요금"만 언급 — "(대행 서비스 이용자의 경우 해당 대행 서비스 결제 금액)" 문구 추가(`frontend/app/(public)/terms/page.tsx`). ②Sentry 무필터 상태에서 봇 트래픽 노이즈 급증(`sentry.server.config.ts`/`sentry.edge.config.ts`에 `ignoreErrors` 필터 전무) → "Server Reference ID..." 패턴 필터 추가. 오판 기각: PM2 restart_time은 크래시가 아니라 수개월 누적 수동 재시작 카운터임을 메모리·로그로 반증.

## 2026-08-21 죽은 NEXT_PUBLIC_ADMIN_SECRET_KEY 발견·제거
> "더 점검할 것 있는지" 후속 스윕 중 서버 `frontend/.env.local`에 관리자 시크릿처럼 보이는 이름+클라이언트노출 접두어 조합의 변수 발견. 4중 반증(현재 코드 참조 0건·빌드된 `.next` 산출물에 값 없음·실사용 `ADMIN_SECRET_KEY`와 다른 값·`admin_auth.py`가 리터럴 이름만 확인) 후 07-11 보안감사 F2 리팩터링 이전의 죽은 값으로 확정 — 백업 후 `.env.local`에서 삭제, 빌드·재시작·라이브 200 확인(git 커밋 불필요, gitignore 대상).

## 2026-08-10 모바일 뷰포트(390×844) 실측 스크린샷 시각 QA — 텍스트 돌출·정렬 4건 발견·수정
> "모바일 화면에 텍스트 돌출·정렬 깨짐이 없는지"라는 사용자 질문에 QA 계정으로 15개 핵심 페이지를 실제 로그인 후 스크린샷 촬영·육안 검토. 11/15 문제없음, 4건 발견·수정: ①`onboarding` 스텝3·②대시보드 인사이트존 아코디언 헤더가 `break-keep` 미적용으로 음절 중간 절단 → 2곳 모두 수정. ③`HelpFAQFloat.tsx`(fixed 물음표 버튼)가 짧은 페이지 최하단 배너와 겹침 → 모바일 전용 우측 여백 추가. ④대시보드 키워드칩 가로스크롤에 시각적 힌트 없어 잘려 보임 → 그라디언트 페이드 추가. git `78ded3c`.

## 2026-07-12 FastAPI/Starlette 업그레이드 완료
> pip-audit로 발견된 `starlette` CVE/PYSEC 7건(최고 CVE-2026-48817/48818) 해결 위해 `fastapi==0.115.0`→`0.135.0`, `starlette==0.38.6`→`1.3.1` (pydantic은 그대로 — 0.135는 `pydantic>=2.7.0` 요구, 현재 2.8.2로 충족돼 변경범위 최소화). 로컬 사전검증(임포트·부팅·SSE스트림·webhook검증·인증경로 회귀 확인, deprecation 경고 0건) → 서버 배포 → 라이브 `/health`·webhook 422·auth 401·CORS 전부 로컬과 동일 동작 확인. git `7d23596`. 재작업 불필요.

## 2026-07-10~11 관리자 화면 전체 점검 + 서비스 총괄 대시보드 신설
> P0~P2 전수 점검(git `27ddf98`~`5424329`) + 감사로그·알림·결제이벤트·권한체계·코호트분석·AI사용량·창업리포트·사업장통합조회 신설(git `9bc825f`~`d6b6025`). 관리자 화면 재점검 불필요.

## 2026-07-10 — 관리자 화면 전체 점검 P0~P2 + 사후재검증 완료
> 6개 사용자화면 점검 세션에서 이어진 관리자(`/admin/*`) 전수 점검. P0(대행의뢰·1:1문의·내부문의 500다운 4건, git `27ddf98`) → P1(score-comparison 100%크래시·죽은"v3.1활성화"UI·NoticesTab중복 3건, git `332af48`~`27b9883`) → P2(notices상세 전체404·FAQ 15개중10개가 4월런칭일오류콘텐츠 그대로방치[가격·폐기AI플랫폼·스캔주기]·FAQ수정UI부재·AI탭스캐너상태GET필드누락으로 항상OFF오표시 4건, git `1857415`~`103e072`)까지 실측재현으로 발견·수정. 사후 재검증에서 오판없음 확인 + 기능공백 4건 식별 + 전 12개 화면 모바일 scrollWidth 실측으로 comms 가로스크롤 버그 추가 발견·수정(git `5424329`). 기능공백 4건은 재조사로 구현범위 확정해 `docs/admin_functional_gaps_implementation_plan_v1.0.md`로 문서화(구독환불 재사용대상 오판 정정 1건 포함).

## 2026-07-10~11 — 관리자 서비스 총괄 대시보드 신설
> "관리자가 서비스하는 모든 것을 총괄 확인 가능한가" 질문에서 시작 — 백엔드 라우터 39개 전수 감사로 3대 공백(고객운영·관찰가능성·거버넌스) 식별 후 설계(`docs/admin_service_oversight_design_v1.0.md`) 및 전 단계 구현. 신규 테이블 6개(`admin_audit_log`·`system_alerts`·`payment_events`·`admin_users`·`startup_report_log` 등): 관리자 액션 자동 감사로그(`AdminAuditMiddleware`, Starlette `_CachedRequest` 바디재생 활용) · 운영알림 영구저장 · 결제이벤트(최초결제·자동갱신) 성공/실패 이력 · owner/support 권한분리(`require_owner`, 금전이동 액션 제한) · 스케줄러 잡 실패 자동알림(`EVENT_JOB_ERROR` 리스너) · 가입코호트 유지율(상태이력 부재 한계를 `data_caveat`로 명시) · AI채널별 사용량 · 창업리포트(예비창업자 포함) · 사업장 통합조회(스캔·가이드·경쟁사·블로그진단·변화기록, P0 설계 약속 중 블로그/변화기록 최초 누락을 자체 재점검으로 발견해 보완) · 팀/API키 현황. 신규 페이지 `/admin/business`(검색+상세)·`/admin/ops`(감사로그·알림·결제·창업리포트·권한관리). code-review 홀리스틱 재검토 3회(P0 0건 유지) — self-downgrade 전원잠금 위험·이메일 대소문자 미정규화 등 P1/P2 다수 발견·수정. 실데이터 삽입까지 포함한 라이브 검증(빈 상태만 확인하고 실데이터 렌더링을 누락했던 경로 3곳을 자체 재점검으로 발견·보완) + `/settings`(결제코드 회귀) 확인. git `9bc825f`~`d6b6025`, push 완료.

## 2026-07-06 — NAVER_SEARCHAD 연동 + 블로그 진단 측정 감사 (1차)
> SearchAd 검색량 연동·NTP drift 발견, 블로그 소재 추천 검색량 연동, "블로그 진단" 페이지 P0(측정실패 오분류) + UI정합성 6건. git `acf9450`·`eeb4615`·`cb9be7f`·`a0b78bd`.

## 2026-07-06 — CLAUDE.md "시기 의존 작업" 표 완료 확인 및 정리 (P2 AI탭·P2 DB·P3 v3.1)
> "중복·오판 점검" 요청으로 CLAUDE.md 전체를 서버 코드와 대조하던 중, `docs/p2_p3_execution_runbook.md` 연동 표(P2 AI탭 스캐너·P2 DB v5.7·P3 점수모델 v3.1)가 실제로는 이미 오래전에 완료된 채 "대기/트리거 확인 필요" 상태로 남아있던 걸 발견 — SSH 직접 확인으로 완료 검증 후 표에서 제거.
- **P2 AI탭 스캐너 활성화**: `backend/.env:36 NAVER_AI_TAB_ENABLED=true` 확인, `multi_scanner.py:119` 분기로 실제 스캔 흐름에 연결되어 있음. 이미 활성 운영 중(별도로 `naver_briefing_block_countermeasure_handoff_v1.0.md`에도 "AI탭 ✅우회운영"으로 기록돼 있었음 — CLAUDE.md 본문과 문서 목록 표가 서로 모순된 상태였음)
- **P2 DB v5.7 컬럼**: CLAUDE.md 운영현황에 이미 "v5.8 컬럼(intro_draft) 실행 완료(2026-05-25)"로 기재돼 있었음 — v5.8까지 끝났으면 v5.7은 당연히 완료
- **P3 점수 모델 v3.1**: `.env`·`backend/.env` 양쪽 `SCORE_MODEL_VERSION=v3_1` 확인(2026-06-12 최초 확인, 2026-07-06 재확인) — 그룹별(ACTIVE/LIKELY/INACTIVE) 가중치로 이미 라이브 중
- 잔여 미완료 항목은 "데이터 배선 확장"(`smart_place_completeness` Playwright 완전 자동화, 50명 이후) 하나뿐 — 이건 CLAUDE.md "미래 과제" 절로 이미 별도 기재돼 있어 중복 표 자체를 삭제

---

## 2026-07-06 — NAVER_SEARCHAD 실검색량 연동 + 파싱 버그 수정 + 서버 시계 drift 발견
> 사용자가 NAVER_SEARCHAD 3개 자격증명(API_KEY/SECRET_KEY/CUSTOMER_ID)을 신규 발급해 서버 `.env`에 반영. 이 과정에서 두 가지 버그를 발견·수정함.
- **403 "Invalid Timestamp" 원인 규명**: 서버 `timedatectl status`가 `System clock synchronized: no` — `systemd-timesyncd`가 3주+ 동안 `ntp.ubuntu.com`에 응답을 못 받고 있었음(iwinv가 NTP UDP 123 포트를 막고 있을 가능성). HTTP Date 헤더로 시계를 수동 보정해 임시 해결했으나 **근본 원인 미해결 — NTP가 계속 막혀 있으면 시계가 다시 drift되어 SearchAd 403이 재발할 수 있음**. 주기적 재보정 크론잡 또는 iwinv 문의 필요(사용자 결정 대기)
- **`_parse_qc_count` 버그 수정**(`naver_searchad.py:116-131`, git `acf9450`): 네이버 API가 월 검색량 10 미만 키워드에 숫자 대신 `"< 10"` 문자열을 반환하는데, 기존 `int()` 직접 변환이 여기서 크래시 → 예외가 바깥 try/except까지 전파돼 **정상 키워드까지 포함한 배치 전체가 빈 결과로 무너지는** 심각한 버그였음. 서버에서 실제 키워드(카페=월 104만회 등)로 재검증 완료
- **DataLab과의 관계 재확인**: DataLab(2026-07-05 완료)은 상대 검색량 지수(0~100)만 제공, SearchAd가 실제 `monthly_volume` 숫자를 제공 — 둘은 별도 자격증명 체계(DataLab은 기존 `NAVER_CLIENT_ID/SECRET` 재사용, SearchAd는 `searchad.naver.com` 별도 계정)

## 2026-07-05 — 네이버 DataLab API 이용 승인 확인 + 라이브 검증
> 사용자가 네이버 개발자센터에서 DataLab(검색어트렌드) API 서비스를 기존 앱에 추가 신청·승인받음. 코드는 이미 완성돼 있었고(`naver_datalab.py`, `/api/report/keyword-trend/{biz_id}`, `KeywordTrendChart.tsx`), 막혀있던 건 API 서비스 승인 여부뿐이었음.
- 서버 직접 호출로 실제 트렌드 데이터 수신 확인(카페 키워드 4개월 ratio 값 정상 반환) + 라이브 대시보드 실측 확인(`GET /api/report/keyword-trend/{biz_id}` → 200)
- 서버 `.env`에 `NAVER_DATALAB_ENABLED=true` 추가. DataLab은 상대 검색량 지수(0~100)만 제공, 실제 `monthly_volume` 숫자는 SearchAd(2026-07-06 별도 연동) 담당

## 2026-06-26 — 대시보드 좌측 메뉴 재편 (소상공인 UX 최적화)
> `DashboardSidebar.tsx` NAV_GROUPS 재구성. git `4d2a453`. 배포 완료.
- **그룹 통합**: "진단"(2) + "변화 보기"(2) → **"내 가게 현황"(4)** — 스크롤 없이 712px→350px대 노출
- **개선 실행 축소**: 6→4개 (AI 브리핑 5단계·ChatGPT 최적화 가이드 → 도움말 섹션 이동)
- **"기타" → "도움말"** 명칭 변경, 학습 콘텐츠 2개 추가 (총 5개)
- **모바일**: `MobileBottomTabs` 하단 "변화" 탭 유지 (변경 불필요)

## 2026-06-26 — 전 서비스 심층 점검 + AI탭 베타 표기 수정
> 브라우저 직접 접속(hoozdev@gmail.com) 전 페이지 점검. CLAUDE.md 사실 전수 검증 완료.
- **P1 수정**: 네이버 AI탭 "베타" → "정식 출시 (2026-06-25)" 8개 파일 수정 (SiteFooter·ChannelDifferentiationCard·pricing/page·PlanRecommender·HeroSampleCard·GlobalAiFocusCard·FAQSection·demo/page)
- **P1 수정**: `SiteFooter.tsx` "네이버 AI 브리핑 노출 관리 서비스" → "AI 검색 노출 관리 서비스" (멀티채널 실제 범위 반영)
- **CLAUDE.md 검증 결과**: ChatGPT cutoff 2024-06-01 ✅ / AI탭 정식 출시 2026-06-25 ✅ / 가격 전체 ✅ / Gemini 기간 추정 유효 ✅
- **기준 문서 신설**: `docs/commercial_inspection_standard_v2.0.md` (페이지별 점검 항목 + 오판 방지 체크리스트)

---

## Google 스크린샷 재도입 상세 (구독자 50명 이후 — CLAUDE.md에서 이관)

**현재 상태 (2026-05-14 제거)**: iwinv 데이터센터 IP → Google 봇 감지 CAPTCHA 100% 발생.
`capture_batch()` 및 `after_screenshot_job`에서 Google 캡처 블록 제거 완료.
`screenshot.py:_is_google_captcha()` 감지 함수는 유지 (재도입 시 재활용).

**재도입 방법 — DataForSEO Screenshot API:**
```python
# capture_ai_result("google", ...) 대신 DataForSEO API 호출
import httpx

async def capture_google_via_dataforseo(query: str) -> Optional[bytes]:
    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
    payload = [{"keyword": query, "language_code": "ko", "location_code": 2410,
                "calculate_rectangles": True, "screenshot": True}]
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload,
                              auth=(DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD))
        data = r.json()
        screenshot_b64 = data["tasks"][0]["result"][0].get("screenshot")
        if screenshot_b64:
            import base64
            return base64.b64decode(screenshot_b64)
    return None
```

- 비용 예측: 약 $0.002/건 → 50명 × 월 1회 = 월 $0.10 수준
- 환경변수 추가: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
- 작업 위치: `services/screenshot.py:capture_ai_result()` Google 분기에 복원

---

## 2026-04-22 — AI 노출 강화 4개
- `KeywordTrendChart.tsx` (Recharts 30일 꺾은선)
- `SmartplaceAutoCheck.tsx` (자동 4개 진단, 미통과 `action_url`)
- `ConditionSearchCard.tsx` gap_reason/gap_missing_keyword
- `GuideClient.tsx` 키워드 검색량 2단계 fetch

## 2026-04-16 — Supabase HTTP/2 500 수정
- `db/supabase_client.py` `_reset_client()` + `RemoteProtocolError` 1회 재시도

## 2026-04-15 — /onboarding 흰 화면
- `middleware.ts` `getSession()` → `getUser()`
- `(dashboard)/layout.tsx` try-catch
- `onboarding/loading.tsx` 신규

---

## v1.2 심화 감사 — 버그 수정
- **`rate_limit.py`**: `scan_results.user_id` 없는 컬럼 조회 → `businesses` 테이블 통해 `business_id`로 조회
- **`scheduler/jobs.py`**: `daily_scan_all`에 `naver_result`, `claude_result` 저장 + `score_history` upsert 추가
- **`scheduler/jobs.py`**: After 스크린샷 Storage 버킷명 `before_after` → `before-after`
- **`scripts/supabase_schema.sql`**: `subscriptions.grace_until DATE` 컬럼 추가
- **`components/scan/ScanProgress.tsx`**: `allResults` → `useRef` (Strict Mode 이중 effect 방지)
- **`lib/api.ts`**: `generateSchema()` 타입에 `opening_hours`, `description` 추가

## v1.2 신규 파일
- `backend/routers/settings.py`, `frontend/app/(dashboard)/settings/*`, `LogoutButton.tsx`, `frontend/app/payment/{success,fail}/page.tsx`, `frontend/app/admin/*`, `frontend/app/(public)/pricing/PayButton.tsx`

## v1.2 추가 구현
- `profiles` 테이블 + `handle_new_user` 트리거; `users(phone)` → `profiles(phone)` 조인 수정
- `_save_scan_results`에 `weekly_change` 실계산 + `competitor_scores` 경쟁사 스캔
- `GET /api/report/export/{biz_id}` CSV 내보내기 (utf-8-sig)
- `profiles.phone` upsert + `businesses.phone` 동기화
- `ExportButton.tsx`, 카카오 알림 수신 번호 UI
- `main.py` 버전 `1.1.0` → `1.2.0`

## v1.4 시장 검토 반영
- `GET /api/competitors/search` (네이버 지역 검색 API), `GET /api/competitors/suggest/list` (AEOlab 내 추천)
- `GET /api/report/benchmark/{category}/{region}` (평균·상위10%·분포)
- `CompetitorsClient.tsx` 탭 3-방식; 업종 벤치마크 카드; 가이드 체크리스트

## 경쟁사 선정 기획 변경
- **배경**: 네이버가 AI 봇 크롤링 robots.txt 전면 차단 (2025-07 공식 확인)
- **변경**: 카카오 로컬 API → 실제 지역 동종업체 검색 + 직접 선택·등록
- **의미**: 소상공인에게 경쟁사 = 같은 지역 같은 업종 → 카카오맵(한국 최대 POI)

## v1.3 Phase 3·4 신규 파일
- `zeta_scanner.py` (이후 제거), `pdf_generator.py` (reportlab), `startup_report.py`, `ad_defense_guide.py`, `naver_place_stats.py`
- `routers/{startup,teams,api_keys}.py`, `frontend/app/(dashboard)/{startup,ad-defense,settings/team,settings/api-keys}/page.tsx`

## v1.5 버그 수정
- `score_engine.py`: `_calc_freshness()` `created_at` → `scanned_at` (content_freshness 기본값 버그)
- `profiles` 테이블에 `kakao_scan_notify`, `kakao_competitor_notify` 컬럼
- `ai_citations`에 `sentiment`, `mention_type` 컬럼
- `_run_full_scan()` `weekly_change` 실계산 + `competitor_scores`
- `@supabase/auth-helpers-nextjs` 제거
- `gemini-1.5-flash` → `gemini-2.0-flash`

## v1.6 성능·보안 개선

**보안:**
- `routers/report.py` score/history/competitors/before-after에 JWT 인증 + 사업장 소유권 검증
- export/pdf에 `_verify_biz_ownership` 추가
- CORS `allow_methods=["*"]` → 명시적 5개 메서드
- `SecurityHeadersMiddleware` 추가
- 운영 환경 Swagger UI 비활성화 + 오류 메시지 마스킹
- 시작 시 필수 환경변수 검증 `_REQUIRED_ENVS`
- 전화번호 평문 로깅 → `010****89` 마스킹
- Toss API `timeout=30` 명시

**성능:**
- `backend/utils/cache.py` 신규 — 인메모리 TTL 캐시
- ranking N+1 → 단일 IN 쿼리; ranking 30분 캐시, benchmark 1시간 캐시
- benchmark `ilike("%region%")` → `ilike("region%")`
- `SELECT *` → 필드 명시
- 월별 스캔 카운트 N+1 → 단일 IN 쿼리
- `GZipMiddleware` (JSON 60~80% 압축)
- 성능 인덱스 6개 추가

**안정성:**
- `cleanup_expired_stream_tokens()` 추출
- `except Exception: pass` → `warning` 로그
- `_cleanup_memory_stores` 잡 10분마다 실행

## v1.7 AI 채널 분리 + 글로벌 AI 노출 강화
- `score_engine.py`: `_calc_naver_channel_score()` / `_calc_global_channel_score()` 추가
- `services/website_checker.py` 신규 (aiohttp JSON-LD/OG/viewport/favicon/HTTPS/LocalBusiness 체크)
- 풀스캔에 카카오 가시성 + 웹사이트 체크 병렬
- `businesses`에 `google_place_id`/`kakao_place_id`; `scan_results`에 채널 점수 + `kakao_result`/`website_check_result`
- `ChannelScoreCards.tsx`, `GlobalAIBanner.tsx`, `PlatformDistributionChart.tsx`, `WebsiteCheckCard.tsx` 신규
- `RegisterBusinessForm.tsx`에 Google/카카오 Place ID 필드

## v2.1 도메인 모델 시스템 구현 (2026-03-30)

**4-도메인 모델 (model_system.md 기준) 전체 구현:**

- **Phase A**: `models/{context,diagnosis,market,gap,action}.py` 신규; `frontend/types/{context,diagnosis,market,gap,action}.ts` 신규
- **Phase B**: `score_engine.py` WEIGHTS를 ScanContext별 분리; trial에 non_location 분기 (naver/kakao 스킵, website checker 실행); `TrialScanRequest`에 `website_url`
- **Phase C**: `gap_analyzer.py` 신규; `GET /api/report/gap/{biz_id}`
- **Phase D**: `action_tools.py` 신규 (FAQ 7개·블로그 템플릿·스마트플레이스 체크리스트·SEO 체크리스트); `generate_action_plan()` 추가
- **Phase E**: `lib/api.ts` getGapAnalysis/getLatestActionPlan/getGapCardUrl; `GapAnalysisCard.tsx`

**ScanContext 분기:**
- `location_based`: naver + kakao, WEIGHTS 30/20/15/15/10/10%
- `non_location`: naver/kakao 스킵, website checker, WEIGHTS 35/10/20/20/10/5%

## v2.2 버그 수정 (2026-03-30)
- `ScanTrigger.tsx` 대시보드 버튼 동작 불가 → stream_token 2단계
- `TRIAL_DAY_LIMIT` 20 → 3 복구
- `SettingsClient.tsx` 카카오 알림 수신 토글
- `PATCH /api/settings/me`에 `kakao_scan_notify`, `kakao_competitor_notify` 저장

## v2.3 모델 정합성 개선 (2026-03-30)
- `models/entities.py`, `frontend/types/entities.ts` 신규 (Business/Competitor/Subscription)
- `types/index.ts` entities.ts re-export; `types/market.ts` API 구조 동기화
- `GET /score/{biz_id}` → DiagnosisReport 전체 구조
- `GET /market/{biz_id}` 신규 (MarketLandscape, 30분 캐시)
- `_verify_biz_ownership` 런타임 버그 수정
- `lib/api.ts` `getMarket()` 추가
- `gap_cards` 테이블 + `weekly_scores` 뷰

## v2.5 모델 엔진 업그레이드 — 소상공인 직접 효과 (2026-03-30)
- `keyword_taxonomy.py` 신규 — 6개 업종 × 5~6 카테고리 × 키워드
- `analyze_keyword_coverage()`, `build_qr_message()`
- `ReviewKeywordGap` + `GrowthStage` 모델 추가
- `_build_keyword_gap()`, `_build_growth_stage()` 추가
- Claude 프롬프트에 키워드 갭/성장 단계 섹션 + 근거 없는 % 예측 금지 지침
- 제거: Engine C (AI 유입 추정치), expected_effect 수치 예측

## v2.6 AI 브리핑 직접 관리 4-경로 엔진 (2026-03-30)
- `briefing_engine.py` 신규 — 경로 B(FAQ)·A(리뷰답변)·C(소식)·D(소개글) 4경로
- `ActionTools`에 `direct_briefing_paths` + `briefing_summary`

## v2.7 가이드 페이지 전면 개편 (2026-03-30)
- `GuideClient.tsx` 전면 재작성: AI 브리핑 배너, GrowthStageCard, BriefingPathsSection, KeywordGapCard, ReviewDraftsSection, QuickToolsSection, FAQSection
- `analyze_gap_from_db()` 개선 (리뷰 발췌문 자동 수집)

## v2.8 미구현 전체 구현 (2026-03-30)
- 업종 3개 추가 (cafe·fitness·pet) + alias 충돌 수정; `analyze_nonlocation_keywords()`
- `competitor_only_keywords` 버그 수정; 경쟁사 미등록 Fallback
- trial 응답에 `growth_stage`
- `daily_scan_all` 후 GrowthStage 변화 감지
- `_enrich_competitor_excerpts` 잡 (새벽 4시)
- `BriefingPathsSection`에 네이버 AI 브리핑 링크; `pioneer_keywords` emerald 배지

## v3.0 모델 엔진 설계 (2026-03-31)

**듀얼트랙 통합 모델:**
- `Unified Score = Track1 × naver_weight + Track2 × global_weight`
- 9개 업종 × naver/global 비율 (restaurant 70/30, legal 20/80 등)
- fallback 기본값 restaurant `{naver: 0.60, global: 0.40}` 중립
- GrowthStage 기준 `track1_score` (unified 아님)
- keyword_gap cold start: 리뷰 → 블로그 → fallback 30.0
- trial Gemini 100 → 10회 분리

**시장 조사:** ChatGPT 한국 MAU 2,162만 (2025-11); 네이버 검색 점유율 62.86%/42.5%; AI 브리핑 CTR +27.4%; 한국 직접 경쟁 없음

## v3.0 구현 완료 (2026-03-31)

- `score_engine.py`: WEIGHTS 제거 → `DUAL_TRACK_RATIO`(9업종) + `NAVER_TRACK_WEIGHTS` + `GLOBAL_TRACK_WEIGHTS`; `calc_track1_score()`, `calc_track2_score()`, `determine_growth_stage()`, `get_dual_track_ratio()`
- `calculate_score()` 반환에 `unified_score·track1_score·track2_score·naver_weight·global_weight·growth_stage·is_keyword_estimated`; `total_score = unified_score` (하위호환)
- `gap_analyzer.py`: `_build_growth_stage()` `track1_score` 기준; `analyze_gap_from_db()` DB에서 track1_score·keyword_coverage 조회 + naver top_blogs cold start
- `TrialScanRequest`에 `has_faq·has_recent_post·has_intro·review_text`
- `_run_trial_gemini()` 분리 (10회)
- zeta_scanner 완전 제거
- `scan_results`/`score_history`에 track1/track2/unified_score 컬럼 + 인덱스 2개
- `DualTrackCard.tsx` 신규; `dashboard/page.tsx` `ScoreCard` → `DualTrackCard`; `trial/page.tsx` 체크박스 3개 + 리뷰 입력

**검증 (production):** trial scan `track1_score=10.0`, `track2_score=20.0`, `unified_score=13.5`; 카페 `naver_weight=0.65`; `smart_place_completeness=40` 반영

## 플랜 시스템 검증 + 비용 최적화 (2026-04-01)
- `webhook.py` `PLAN_PRICES` 가격 수정; `PlanGate.tsx` 가격 동기화
- Trial 제한 20 → 3 복구
- `scan_all_no_perplexity()` 신규 — Perplexity 제외 (월요일만 실행)
- 마진: Basic 86%, Pro 79%, Biz 71%

## 텍스트 가독성 전면 개선 (2026-04-01)
- `DualTrackCard.tsx`: `p-4 md:p-6`, `text-3xl md:text-4xl`
- 전 대시보드 페이지 `p-8` → `p-4 md:p-8`, 헤더 `text-xl md:text-2xl`, `flex-col sm:flex-row`
- 히스토리 테이블 `overflow-x-auto min-w-[480px]` 모바일 가로 스크롤
- trial/demo 페이지 폰트 `text-xs` → `text-sm`

## 요금제 시스템 버그 수정 (2026-04-01)
- `AdminDashboard.tsx` `PLAN_PRICES` 수정 (MRR 과대 계산 버그)
- `subscription?.plan ?? "basic"` → `status === "active" ? (plan ?? "free") : "free"` (비구독자 Basic 권한 버그)
- `nextScanLabel()` fallback `basic` → `free`
- `GET /{biz_id}/qr-card` Basic+ 체크 추가

## 요금제 가치 기반 리포지셔닝 (2026-04-01)
- 창업패키지 14,900 → 16,900원; Pro 19,900 → 22,900원
- 창업패키지 `review_reply_monthly` 10 → 20, `csv` True
- Pro `guide_monthly` 5 → 8, `review_reply_monthly` 30 → 50
- `plans.ts` `valueTag` 필드 추가
- `pricing/page.tsx` 플랜별 기능 비교표 + "광고비 300,000원/일 vs 9,900원/월" 배너

## UX 전면 개선 10항목 (2026-04-01)
- `DashboardSidebar.tsx` 모바일 스크롤 잠금 + 플랜 잠금 뱃지
- `ScanTrigger.tsx` 한도 도달 가시 텍스트 + 성공 메시지
- `login/page.tsx` 오류 메시지 세분화 + SVG 스피너
- `signup/page.tsx` PLAN_LABELS 가격 동기화 + 인증 메일 재발송
- `guide/GuideClient.tsx` `gapLoading` skeleton
- `trial/page.tsx` 쿨다운 카운트다운
- `CompetitorsClient.tsx` Empty State 개선

## 요금제별 차등 기능 추가 (2026-04-14)

**시장 조사:** 네이버 AI 브리핑 2026년 40% 확대; 네이버 플레이스에 AI 브리핑 (2025-06); 소상공인 330만 곳

- `generate_faq_drafts()` — Claude Haiku 업종별 Q&A 5개
- `POST /api/guide/{biz_id}/smartplace-faq` (Basic+, 월 한도)
- `faq_monthly` 한도 (Basic 5, Pro 20, Biz 999)
- `GET /api/report/multi-biz-summary` (Biz+)
- `detect_competitor_changes()` 카카오 알림톡 연결
- `MultiBizTable.tsx` 신규; `SmartplaceFAQSection` 추가

**중기 구현:**
- `GET /api/startup/timing/{category}/{region}` — score_history 트렌드 기반
- `GET /api/report/sentiment/{biz_id}` (Basic+, 1h 캐시, Claude Haiku)
- `GET /api/report/growth-card/{biz_id}`
- `GET /api/guide/{biz_id}/pioneer-detail` (Basic+, 2h 캐시)
- `review_sentiment.py` 신규; `SentimentDashboard.tsx` 신규; `PioneerDetailSection`

## 소상공인 UX 전면 점검 (2026-04-14)
- `TRIAL_DAY_LIMIT = 20` → `3` 복구
- 스티키 배너 "이 분석을 저장" → "매주 자동 진단받고"
- STEP 1 서비스 설명; 체크박스 설명; 쿨다운 카운트다운
- `BriefingPathsSection` 상단 smartplace.naver.com 배너
- 가이드 생성 중 "Claude AI가 만들고 있어요... 약 30초"
- `?keyword=` 파라미터로 amber 하이라이트
- 4번 경로 부분 잠금 (레이블/시간/효과 표시, 복사만 Pro 잠금)
- `DualTrackCard.tsx` 서브레이블 "이 점수가 낮으면 네이버 AI가 내 가게를 잘 모릅니다" / "...ChatGPT·구글 AI에서 안 나옵니다"
- 벤치마크 비교 색상 배경 박스
- 없는 키워드 → `/guide?keyword=` 링크
- `CompetitorsClient.tsx` 탭 설명 + 추가 완료 안내
- `OnboardingProgressBar.tsx` localStorage fallback

## 소상공인 데이터·분석 결과 개선 6개 (2026-04-14)

**B-1 `TopPriorityActionCard.tsx`**: `/gap/{biz_id}` dimensions gap 1위 선택; 6차원 → 소상공인 언어 매핑; "오늘 하루 숨기기" 날짜 기반

**A-4 FAQ 답변 품질**: `_FAQ_TEMPLATES` 8업종 × 5 Q&A; `[예: ...]` 플레이스홀더; "전화로 문의해 주세요" 제거

**A-2 AI 인용 미리보기**: `GET /api/report/ai-citations/{biz_id}` (Basic+); `AICitationCard.tsx`

**A-1 경쟁사별 키워드**: `_build_keyword_gap()`에 `competitor_keyword_sources: dict` 추가; `CompetitorKeywordCompare.tsx`

**A-3 행동-결과 타임라인**: `business_action_log` 테이블; `POST/GET /api/report/action-log/{biz_id}`; `_fill_action_score_after()` 잡 (3:30, 7일 전 score_after 채움); `TrendLine.tsx` `ReferenceLine`

**B-4 체크박스 변경 이력**: `SmartPlaceScorecard.tsx` + `GuideClient.tsx` OFF→ON 자동 로그

**코드 리뷰 수정 (Critical/High):**
- `if not biz:` → `if not (biz and biz.data):` (소유권 검증 우회 버그)
- `latest_score.get()` → `latest_score.data.get()` (AttributeError)
- `logs or []` → `logs.data or []`
- `score_row.get()` → `score_row.data.get()`
- `TopPriorityActionCard.tsx` dismiss 영구 저장 → 날짜 비교

## UX 전면 점검 + 데이터 개선 재배포 (2026-04-14)

- `trial/page.tsx` CTA "Basic 월 9,900원부터 · 언제든 해지 가능"; "빠른 체험 결과 (10회 테스트)" 배너
- `GuideClient.tsx` 가이드 탭 amber 배너 "이 가이드는 AI 스캔 결과 기반으로 자동 생성"
- `TopPriorityActionCard.tsx`, `AICitationCard.tsx`, `CompetitorKeywordCompare.tsx`, `ConditionSearchCard.tsx`, `DiagnosisCounter.tsx` 신규
- `GET /api/report/condition-search/{biz_id}` (Pro+, 1h 캐시)
- `GET /api/scan/trial-count` (공개, 5min 캐시, 최소 표시 47)
- `condition_search_scanner.py` 신규 (Gemini 3회/쿼리, 2/3 임계값)
- `CONDITION_SEARCH_QUERIES` 10업종 × 5쿼리
- `_FAQ_TEMPLATES` 8 카테고리 × 5쌍
- `naver_scanner.py` BRIEFING_SELECTORS 9 → 17개
- 랜딩 3-B 섹션에 실사용 스토리 + DiagnosisCounter

**Supabase 실행 필요:** `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;`

---

## 최근 구현 완료 (2026-04-15 ~ 2026-04-23)

### /onboarding 흰 화면 수정 (2026-04-15)
- `middleware.ts` `getSession()` → `getUser()` (Invalid Refresh Token 안전 처리)
- `(dashboard)/layout.tsx` try-catch 래핑
- `(dashboard)/onboarding/loading.tsx` 신규 (대시보드 스켈레톤 방지)

### Supabase HTTP/2 500 에러 수정 (2026-04-16)
- `db/supabase_client.py` `_create_client()`/`_reset_client()` 분리
- `execute()`에 `RemoteProtocolError` / `Server disconnected` 감지 시 클라이언트 재생성 후 1회 자동 재시도

### AI 노출 강화 기능 4개 (2026-04-22)
- `KeywordTrendChart.tsx` 신규 — `/keyword-trend/{biz_id}` Recharts 꺾은선, `monthly_volume` 배지
- `SmartplaceAutoCheck.tsx` 신규 — `POST /smartplace-check` 자동 1회; 미통과 `action_url`; 30초 로딩
- `ConditionSearchCard.tsx` — `gap_reason`/`gap_missing_keyword` 추가; `/guide?keyword=` 링크
- `GuideClient.tsx` 키워드 검색량 fetch 2단계 (전체 + missing 5개 정밀)

### 대시보드 맞춤 전환 섹션 재작성 (2026-04-23)
- `GET /api/report/conversion-tips/{biz_id}` 신규 (AI 호출 0, DB + 룰 엔진만)
- `ConversionGuideSection.tsx` 전면 재작성 (bizId + plan 2 props)
- 긴급도/근거 배지 + 스마트플레이스 딥링크 + Free 2개만 복사 가능

### v3.2 사용자 맞춤 키워드 시스템 (2026-04-23)
- `businesses`에 `excluded_keywords TEXT[]`, `custom_keywords TEXT[]` + GIN 인덱스
- **Supabase 실행 필요** (아직 미실행):
```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS excluded_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS custom_keywords   TEXT[] DEFAULT ARRAY[]::TEXT[];
```

### v3.3 트라이얼 신뢰도 강화 1라운드 (2026-04-23)
- `smart_place_auto_check.py` 신규 — `naver_place_id` 하나로 4개 자동 진단; Playwright `m.place.naver.com` 3탭; 8초 페이지 / 25초 전체 타임아웃; `Semaphore(1)`
- `TrialScanRequest`에 `naver_place_id`
- `GET /api/scan/trial-search?query=&region=` (비로그인, IP당 분당 10회)
- `trial_scans`에 `place_data`/`smart_place_check` 컬럼
- **Supabase 실행 필요**:
```sql
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS place_data        JSONB,
  ADD COLUMN IF NOT EXISTS smart_place_check JSONB;
```

### v3.5 업종 화이트리스트 25개 확장 (2026-04-23)
- 사업장 등록 폼 25개 업종 vs DB CHECK 7개 불일치 → 25개 화이트리스트로 교체
- 기존 코드 3개 마이그레이션: `hospital` → `medical`, `law` → `legal`, `shop` → `shopping`
- **Supabase 실행 필요**:
```sql
UPDATE businesses SET category = 'medical'  WHERE category = 'hospital';
UPDATE businesses SET category = 'legal'    WHERE category = 'law';
UPDATE businesses SET category = 'shopping' WHERE category = 'shop';

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_category_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_category_check
  CHECK (category IN (
    'restaurant','cafe','bakery','bar','beauty','nail','medical','pharmacy','fitness','yoga',
    'pet','education','tutoring','legal','realestate','interior','auto','cleaning',
    'shopping','fashion','photo','video','design','accommodation','other'
  ));
```

---

## 2026-04-23 — 홈페이지 개선 v1.0 (Phase 1·2·3 통합)

5개 점검 문서·이전 대화 합집합으로 도출한 통합 실행안 17개 항목 전체 완료. 단일 원칙 "덜어내기" 적용.

### 확정 헤드라인 (B+C+네이버 강조 합본)
- 메인: "네이버·ChatGPT가 우리 동네에서 먼저 추천하는 가게, 누구일까요?"
- 서브: "리뷰 100개 쌓아도 AI엔 안 나옵니다 — 업종만 선택하면 30초 안에 확인됩니다"
- 배지: "네이버 검색의 40%가 AI 브리핑으로 바뀝니다 — 2026년 안에"

### Phase 1 — Quick Win (9/9)
헤드라인 교체 / 히어로 단순화(체크리스트 3줄·CTA 2개→1개) / 업종 타일 6개+기타 / 가격 앵커 카드(네이버 광고 vs AEOlab) / 반복 블록 3개 삭제(이런고민·ChatGPT 대화형·업종 캐러셀) / CTA 9종→2종 통일 / 숫자 맥락(상위%·평균선·측정근거) / 감정 이모지 0개 / "결과 화면 미리보기"→"샘플 결과로 먼저 보기 (30초)"

### Phase 2 — 페이지 역할 분리 (4/4)
랜딩→trial state 전달(?industry=cafe) / `/demo` 최상단 "오늘 딱 이거 하나만" 박스+복사 / 결과 항목 `<details>` 접이식 / `/pricing` 상황 질문 4개 → 추천 1개 강조

### Phase 3 — 측정·분해·신뢰·접근성 (4/4)
- GA4 인프라 (`G-KCZTWYK7QV`, gtag 로드 확인, Enhanced Measurement ON)
- trial 페이지 분해: 2,213→522줄(-77%), `TrialInputStep/TrialScanningStep/TrialResultStep`
- Testimonials placeholder (모두 placeholder면 자동 숨김)
- WCAG AA 대비: text-gray-400→500 일괄 -115회

### 페이지 줄 수 변화
- `app/page.tsx`: 1,021 → 264줄 (-74%)
- `app/(public)/trial/page.tsx`: 2,213 → 522줄 (-77%)

### 신규 컴포넌트 7개
HeroIndustryTiles / Testimonials / TodayOneActionBox / PlanRecommender / GA4 / TrackedCTA / lib/analytics.ts(+lib/testimonials.ts)

### 통합 실행안
`홈페이지 개선 계획/AEOlab_홈페이지_개선_통합실행안.md`

---

## 2026-04-24 — Trial Conversion Funnel + 7일 액션 카드 (v3.6)

홈 개선 후속. 신규 가입자 전환·이탈 방지에 집중.

### [A] Trial Conversion Funnel (이메일만 남기면 30일 보관)
- `POST /api/scan/trial-claim` (IP 분당 3회 rate limit) — magic link 발송 + claimed_at 기록
- `POST /api/scan/trial-attach` — 가입 후 본인 계정에 trial_scans 흡수 (`converted_user_id` 매칭)
- `services/trial_conversion.py` — Supabase Auth admin `generate_link` (실패 시 `/signup?trial_id=&email=` 폴백)
- `email_sender.send_trial_claim_link()` — Resend 재활용
- `/api/scan/trial` 응답에 `trial_id` 포함 (사전 uuid 생성 → DB insert 시 명시 → 응답 반환)
- 프론트: `ClaimGate.tsx` (이메일 1줄 + 마케팅 동의), `/trial/claimed`, `auth/callback/route.ts` trial_id 자동 매칭, `TrialAttachTracker`
- GA4 이벤트: `claim_gate_shown / claim_submitted / claim_success / claim_attached`

### [B] 7일 액션 카드 (가입 직후 7일 케어, AI 호출 0)
- `action_tools.pick_top_action(scan_result, biz_category)` — 기존 gap_analyzer 결과 재활용
- `GET /api/report/onboarding-action/{biz_id}` — 첫 스캔 직후 호출, business_action_log 자동 INSERT
- `scheduler/jobs.py: new_user_day7_rescan_job()` — 매일 09:00 KST cron, profiles.created_at = today-7 사용자 자동 재스캔, notifications 멱등키 중복 차단
- 프론트: `Day7ActionCard.tsx` — dashboard 상단 가입 7일 이내만 노출, 복사 버튼 + 완료 표시 + 건너뛰기(localStorage)
- GA4 이벤트: `onboarding_action_shown / completed / skipped`

### DB v3.6
```sql
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS claimed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_email        TEXT,
  ADD COLUMN IF NOT EXISTS converted_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_trial_scans_claimed
  ON trial_scans(claimed_at) WHERE claimed_at IS NOT NULL;
```
초안에서 `users(id)` FK가 잘못 작성 → 표준 패턴 `auth.users(id) ON DELETE SET NULL`로 수정. 실행 완료.

### 비용·운영
- 신규 AI 호출 0원
- Resend 무료 한도 내
- 1인 운영 추가 부담 없음

---

## 2026-05-04 — Basic 자동 스캔 A안 50/50 + AI 브리핑 2026-05 개선 v1.0
> 상세 → `docs/naver_ai_briefing_2026_05_improvements_v1.0.md`
- Basic: Gemini 50회 + ChatGPT 50회 + Naver 병렬. 점수 45+45=90→100 재배분. `sample_n(n=50)` 일반화
- AI탭 답변 시뮬레이션 + 사진 카테고리 진단(JSONB) + 숙박 키워드 4그룹 재편 + C-rank 체크리스트
- 수학적 기법(Wilson CI·베이지안 등) 도입은 베타 10/30/50명 이후 단계적

## 2026-05-01 — 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기 대응 v1.0
> 상세 → `docs/naver_talktalk_redesign_v1.0.md`
- `/qna` 완전 폐기: `_SMARTPLACE_PATHS["faq"]` 제거, `_detect_faq()` 폐기, deeplink → `/profile`
- `has_faq` 0점, 소식 25점·소개글 20점 재배분. "톡톡 채팅방 메뉴" 명칭 17개 화면 일관. 하위 호환 `_compat_chat_menus()` + `normalizeChatMenus()`

## 2026-04-30 — Phase A 서비스 통합 재편 v1.2 + v3.x/v4.1/v5.1~5.4
> 상세 → `docs/service_unification_v1.0.md` v1.2
- DB v3.1: 12컬럼(user_group/keyword_ranks 등) graceful fallback. 가중치 ACTIVE/LIKELY/INACTIVE 그룹별 분기
- 신규: `naver_keyword_rank.py` + `keyword_suggester.py` + `KeywordRankCard.tsx`
- 환경변수: `BACKEND_MAX_CONCURRENCY=2`, `KEYWORD_SUGGEST_MODEL=claude-haiku-4-5-20251001`
- v3.x/v4.1/v5.1~5.4: 프랜차이즈 게이팅·how-it-works·모바일 CTA·온보딩 투어·전환 알림·주간 다이제스트·DB v3.5/v3.6/v4.1·GA4 라이브
- DB 완료 항목: v3.2/v3.3/v3.5/v3.6/v4.1/profiles.email + v4.1 ALTER 5건(is_franchise·naver_intro_draft 등) + 카카오 알림톡 5종 전체 승인

## 2026-07-06 — 블로그 진단 §2-A 라이브 검증 + 재점검 2차 (P0 1건 + P1/P2 8건)
> RSS 부분실패 DB훼손 **P0**(post_count 0덮어씀+쿨다운리셋+quota소비 — commercial_inspection_standard_v2.0 §4 "기능 오작동" 기준, 최초 P1로 오분류했다가 정정) + RSS재시도 + 프론트 P2 5건 + 독립 코드리뷰 2차검증 3건(타임아웃예산·404재시도·biz배너) + 페이지 간결화(중복2건 제거→아코디언, -56%)+요약카드 최상단 재배치. git `31af359`~`99e2c34`. 상세는 메모리 `project_blog_analysis_v2_reaudit_2026_07_06`.

## 2026-07-06 — 5개 페이지 상업 서비스 점검 + 변화 기록 2차 재검증 (P1 4건 + P2 7건 + 재검증 6건)
> 경쟁사관리·성장리포트·개선가이드·소개글콘텐츠 점검(P1 4건+P2 7건, git `71707d4`) — 성장리포트 필드누락·가이드 점수노출·경쟁사 차트지터·소개글 요금제 문구 등. 오판 정정 1건("chatgpt-search 404"는 실제로 다른 라우트 그룹에 존재하던 페이지, 라우트 판정은 전체 app 검색 필수 교훈). 변화 기록 1차(기완료)의 "이상없음" 판정을 재검증해 콜사이트 falsy-zero·TrendLine 필드 불일치·플랜게이트 누락 3건 추가발견·수정(git `b386cb5`).

## 2026-07-06 — falsy-zero 전역 스윕 + nine_pages 잔여 3영역 + 구독 생애주기 점검
> **falsy-zero 스윕**(git `b9c40ed`): `unified_score or total_score or 0` 패턴 17곳 전수 판정, 실제 버그 4건(경쟁사 급등알림 완전무력화+NameError+표시명오류가 최다심각) 수정·13곳은 `score_engine.py` 별칭구조 확인 후 반증(에이전트 오판 방지). **nine_pages 마지막 3영역**(리뷰답변·AI광고대비·창업분석, git `d0d5b3a`+`6cdfb1e`+`963228c`): review-reply 폴백답변 영구저장+quota소비 버그가 최다심각, gemini `sample_10()` 라이브코드 오집계+Wilson CI 0나눗셈 크래시 수정. **crisis-reply 무제한호출→월별한도 신설**(사용자 명시요청, git `7d06b16`) — ⚠️ Supabase SQL Editor `guides_context_check` 제약 추가 마이그레이션 미실행 시 한도 미작동(§남은 작업 참조). **구독 생애주기 점검**(신규 영역, git `df4f55f`+`c9112c2`+`87fd5ad`+`3ee38fb`): 유예기간 재시도 전무→매일 1회 재시도 신설, 죽은 `/toss/confirm` 삭제, **구독 해지 즉시 유료기능 강등**(약속한 end_at까지 유지 안 됨 — 지금까지 최다심각 신뢰 버그) 수정, 정지상태 해지버튼 노출+거짓 데이터삭제 안내 수정, 고아 SettingsClient.tsx 삭제. **미해결**: 7일 청약철회 전액환불 백엔드 미구현(§남은 작업 참조). `docs/nine_pages_measurement_inspection_v1.0.md` 9개 영역 전체 완료. 상세는 `docs/session_2026_07_06_full_wrapup_handoff_v1.0.md`.

## 2026-07-06 — 블로그 진단 §2-A + 5개 페이지·변화 기록 재검증
> **블로그 진단**(git `31af359`~`99e2c34`): RSS 부분실패 DB훼손 P0 + P1/P2 8건 수정, 페이지 간결화(-56%). 상세: 메모리 `project_blog_analysis_v2_reaudit_2026_07_06`. **5개 페이지 + 변화 기록**(git `71707d4`+`b386cb5`): 경쟁사관리·성장리포트·개선가이드·소개글콘텐츠 P1 4건+P2 7건, 변화 기록 재검증 3건(콜사이트 falsy-zero·TrendLine 필드 불일치·플랜게이트 누락). `nine_pages_measurement_inspection_v1.0.md` 9개 영역 전체 완료.

## 2026-07-07 — 구독 갱신 P0 과금오류 + FK조인 버그 + 7일 자동환불
> `jobs.py subscription_lifecycle_job`이 `subscriptions↔profiles` FK 미등록으로 매 실행 PGRST200 발생해 잡 전체가 항상 죽어있던 치명적 버그 신규 발견·수정(분리쿼리 패턴). `end_at` 정확일치→`.lte()` 범위매칭 전환(P0), 연간구독 오청구 수정(P1), 구독자별 try/except 격리, 7일 청약철회 자동환불(대행서비스 delivery_orders 대상, Toss 결제취소 API+운영자 알림) 신규 구현. git `170b002`. 상세: `docs/subscription_lifecycle_inspection_v1.0.md` §7. 구독 생애주기 초기 점검(§6 재점검 포함)도 이 세션에 완결.

## 2026-07-08 — 8개 페이지 상업적 전문성 재점검 + 심층개선
> 경쟁사관리·변화기록·성장리포트·개선가이드·소개글콘텐츠·리뷰답변·AI광고대비·창업분석 재점검(3그룹 병렬 조사, 5기준). P0 2건(FAQ/소개글 월한도 프론트-백엔드 불일치·"SearchGPT" 폐기명칭+시제오류) + P1 8건(exposure_freq 고정표기·History 페이월부재·action-log 미연동 등) 수정·배포·검증(git `258dff7`~`ba02b29`). 후속 심층개선 6건(D.I.A 자동재시도, **창업분석 네이버 DataLab 실측 검색트렌드 연동** 등)까지 완료. 상세: 메모리 `project_eight_pages_recheck_2026_07_08`.

## 2026-07-08~09 — 루트 잔재 332개 제거 + 인용 링크 오류 수정 + git 이메일 정정
> root-level `app/`·`components/`(332개, `frontend/` 구버전 중복, 2026-06-04 이후 미사용) 서버 전체 백업 후 로컬+서버 양쪽 git rm. 홈페이지·`how-it-works`의 "네이버 공식 발표 데이터" 인용 박스가 3개 통계를 무관한 기사 1개에 뭉뚱그려 인용하던 버그를 WebSearch 개별 재검증 후 통계별 출처로 분리. git commit author 이메일을 `hoozdev@gmail.com`으로 통일. git `4bc5b7e`~`bf2cf50`.

## 2026-07-12 — 보안 M1~M5 + day-30 사전고지 + UptimeRobot/Cloudflare 인프라 수정
> `security_audit_v1.0.md` MEDIUM 5건(admin broadcast owner-gate, 가이드 한도 TOCTOU 락, webhook/feedback rate limit, 관리자 로그 이메일 마스킹) 전부 수정·배포. 첫 달 할인 종료 D-3 카카오 사전고지 신설. UptimeRobot HEAD 체크가 FastAPI APIRoute HEAD 자동미지원으로 계속 405였던 것 발견·수정(`/health` HEAD 허용). nginx가 Cloudflare 실제 방문자 IP를 복원 안 해 IP기반 rate limit이 엣지 단위로만 작동하던 것 발견 → `cloudflare-realip.conf` 신설, 전후대조 검증 완료. 상세 `docs/legal_compliance_and_infra_resilience_audit_v1.0.md`. git `7df5e95`·`ded2528`.

## 2026-07-13 — 경쟁사 키워드 노출 기능 실동작화
> 경쟁사 관리 > 키워드 격차 분석의 "경쟁사 독점"/"경쟁사별" 탭이 항상 비활성이던 버그 근본원인 확인·수정 — 유일한 소스였던 Gemini LLM 추측(single_check_with_competitors)이 소상공인급 경쟁사엔 거의 항상 빈 문자열 반환하던 것을, 이미 크롤링만 하고 버리던 `/information`·`/menu` 탭 원문을 `competitors.place_intro_text`/`place_menu_sample`(신규 컬럼)에 보관해 1순위 소스로 전환(`gap_analyzer.py`, `competitor.py`). 라이브 실측: 5곳 중 4곳 원문 수집 성공, 키워드 재분류·출처 표시 확인.

## 2026-07-12 — 상업 서비스 총괄 점검 C(사업성) 축 완료 + AI 텔레메트리 신설 + P0 라이브 장애 발견
> Gemini SDK(0.8.3) thinking_config 미지원 + AI 호출 텔레메트리 전무 발견 → `ai_usage_logger.py` 신설(Gemini 5곳·ChatGPT 2곳 계측) 배포, `ai_usage_log` 테이블 SQL 실행·실동작 검증 완료. 마진율 계산 PG수수료 누락 발견·재계산. trial→가입→전환 선행지표 공백 확인 → `/admin/growth-funnel` 신설·배포. 텔레메트리 검증 도중 우연히 발견(P0): OpenAI 결제수단 미등록으로 ChatGPT 스캔 전체가 `insufficient_quota`로 실패 중이었고 예외를 삼켜 조용히 폴백 — 사용자 카드 등록으로 해결. 재발방지로 `_log_failure()` 대칭 추가 + `ai_provider_health_check_job` 신설. 상세 `docs/business_viability_audit_v1.0.md §1-A, §8`. git `aa42587`~.

## 2026-07-15 — 동시 사용자 증가 대응 종합(세마포어 타임아웃·429 재시도·CPU 블로킹·미들웨어 캐시)
> 세마포어 대기열 타임아웃 부재(Playwright·블로그) → 15s/15s/8s 타임아웃 추가. Gemini/ChatGPT 429 재시도 부재 → 1회 backoff 추가(git `3065558`). CPU 블로킹 미분리(reportlab PDF·PIL 렌더링이 `asyncio.to_thread` 없이 이벤트루프 블로킹) → `report.py`·`share.py`·`guide.py` 전수 분리(git `666edab`·`3e5d412`). 미들웨어 온보딩 DB쿼리 반복 → 쿠키 캐싱(긍정 결과만 캐시, git `e5ac9e1`). 실계정 라이브 검증 완료, 온보딩 리다이렉트 오발생 0건.

## 2026-07-16 — §6-1/nine_pages 오판검증 + 잔여 4건 구현 + PG수수료 재계산
> `commercial_launch_inspection_status_v1.0.md §6-1`·`nine_pages_measurement_inspection_v1.0.md` "미해결" 항목 재검증 — 2개는 이미 완료됐는데 문서 미갱신으로 미해결처럼 보였던 오판. 실제 잔여 4건(AI비용 텔레메트리 집계·개인정보방침 정정·Trial 이메일 동의) 구현·배포(git `95e91fb`). PG 수수료 카테고리 오류 발견 — 브랜드페이(4.3%)가 아닌 표준카드(3.4%)+영세등급(0.40%) 적용, 마진율 재계산(`business_viability_audit_v1.0.md §2`).

## 2026-07-16 — 결제 라이브 키 승인 대비 점검 (오판/누락 재검증 후 3건)
> "토스 결제 키 심사 중" 전제로 점검, 이전 턴 제안 5개 항목을 반증 시도 후 3건만 생존. PM2 워커 증설 위험 문서화(`ecosystem.config.js` 경고 주석). 오프사이트 백업 신설·라이브 검증(Supabase Storage, 43테이블). 차지백 대응 체크리스트 신규 문서화(`docs/chargeback_response_checklist_v1.0.md`). 반증 기각: 결제 라이브 전환 자체 리스크, 부하테스트(도구 미보유로 범위 밖).

## 2026-07-14 — 경쟁사 페이지 종합 점검·수정 (6건)
> `comp_keywords` DB 컬럼 미기록(전원 영구 빈 상태)·`naver_place_name` 스킵링크 오인식(블로그 언급 수 전원 동일값)·리뷰 수 파싱 정규식 불일치·경쟁사 점수 산식 고정값(15.0)+가짜 breakdown·`ReviewKeywordGap` 유령 필드·GrowthStage 라벨 unified score 오적용 6건 발견·수정·배포, 라이브 DB 재검증(경쟁사 9곳 재동기화). git `3515d78`~`766f188`.

## 2026-07-21 — Biz 요금제 팀 계정·API 키 광고 문구 제거
> 팀 초대(이메일 발송 플로우 전무)·API 키(검증 엔드포인트 0건) 둘 다 미작동 확인, 라이브 DB 실사용 0건 확인 후 요금제 비교표·온보딩 업셀·Biz 미리보기 데모에서 관련 문구·UI 전부 제거. `/settings/team`·`/settings/api-keys` 라우트는 유지(진입점만 제거). git `b177104`.

## 2026-08-04 — notifications 테이블 컬럼 누락 P0 발견·수정
> 사용자 전달 Sentry 오류 계기 전수조사 — `scheduler/jobs.py`·`services/monthly_report.py`가 참조하는 8개 컬럼이 실제 `notifications` 테이블에 없었음. 완전크래시 5개 잡(`inactive_post_alert_job` 등)·저하 6개 잡 확인. 코드는 원래 정답이라 컬럼만 ALTER 추가, 라이브 재검증 완료.

## 2026-08-10 — 지난 전체재점검 미착수 갭 4개 후속 점검 + 신규 P1/P2
> 08-09 76+페이지 재점검의 미착수 항목(모바일뷰포트13페이지·버튼실클릭3곳·경쟁사실등록·결제재확인) 전부 PASS. 별도 재조사에서 `async_playwright()` 호출부 19곳 중 네이버quota 세마포어 누락 3곳(`screenshot.py`·`blog_search_analyzer.py`) 추가발견·수정. git `718e11b`, `919bd5b`.

## 2026-08-10 — 모바일 뷰포트(390×844) 실측 스크린샷 시각 QA
> QA계정으로 15개 핵심페이지 실제 로그인 후 스크린샷 육안검토, `break-keep` 미적용 텍스트 절단 2곳·fixed 버튼-배너 겹침 1곳·가로스크롤 발견성 문제 1곳 발견·수정. git `78ded3c`.


## CLAUDE.md 최근 업데이트 이관 (2026-10-10)
> 2026-08-31~09-29 항목 원문 그대로 이관 (CLAUDE.md 700줄 기준 압축)

- **2026-09-28 무료 체험 개선 — 저장 P0·Gemini 제거·비유도 ChatGPT 50회·탭 구조 재구성**: 무료 체험 정보가 실측·사실인지 점검 → ①`trial_scans` insert가 `smart_place_completeness`(INTEGER)에 9.0을 넣어 22P02로 실패, 7/15 이후 저장 0건·즉시 결과 이메일 미발송(정수 변환으로 수정) ②Gemini API 키가 무료 티어(하루 20회·분당 5회)라 체험·스캔 대부분 실패(체험에서 Gemini 호출 제거, 결제 연결은 사용자 작업) ③ChatGPT 판정이 가게명을 넣는 유도형이라 표본 50회에서 가짜 가게가 1~4회 "노출" 판정 → 가게명을 넣지 않는 `sample_recommend`로 교체(가짜 0/50, 부산물로 AI가 추천한 가게 top_places·평균 순서) ④체험 화면을 5탭(한눈에/경쟁 비교/네이버 현황/AI 검색/할 일·로드맵)으로 재구성 — 먼저 고칠 것 3가지·직접 확인(질문 복사)·확인 완료 접기·경쟁 5곳 블로그 막대·키워드 월 검색량(SearchAd, 0→"10회 미만")·AI 추천 가게(네이버 지역검색 대조 exact/similar/none)·Gemini 예시 카드(예시 라벨)·미측정은 "가입 후 실측" 표기. 이름 매칭은 부분 문자열 대신 지점 표기만 허용(`names_match`). 라이브 실측 17~21초·모바일 문서 10,000→5,400px. 상세·잔여 과제 `docs/trial_improvement_2026_09_28_v1.0.md`.
- **2026-09-29 "한 줄 진단" 근거 접기 + 헤드라인-근거 불일치 버그 발견·수정**: "핵심 1문장 강조" 작업 중 기존 코드가 근거를 항상 배열 첫 항목(AI 검색)으로 고정 표시하던 것을 발견 — 헤드라인이 "ChatGPT엔 나오지만 네이버에선 안 보인다"인 경우에도 좋은 소식(AI 검색)만 기본 노출되고 실제 약점(네이버)은 접혀 숨는 모순이 실제 재현됨. 대표 근거를 "warn 톤 우선"으로 바꿔 헤드라인과 항상 일치하도록 수정, 나머지 근거는 "더 보기" 토글로 접어 한 줄 진단을 실제로 한눈에 보이게 함. git `a93565a`. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §16.
- **2026-09-29 온라인·전문직 업종 "먼저 고칠 것" 모순 수정**: "다른 개선 필요한가" 질의로 non_location 경로 라이브 재현 → 경쟁 비교 탭은 "네이버 지역 비교 미제공"이라 안내하면서 첫 화면 최우선 조언은 "스마트플레이스 등록"이던 모순 발견(`priorityItems`에만 business_type 분기 누락, naver_data가 non_location에서 항상 None이라 isSmartPlace가 구조적으로 항상 false). `TodayOneAction.tsx`의 검증된 Google 비즈니스 프로필 문구 재사용해 분기 추가, location_based 회귀 없음 확인. git `16047bf`. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §15.
- **2026-09-29 AI 추천 가게 카드 — 임의성 명시 + 가입 후 직접 등록 비교 안내**: "AI 추천이 실제 경쟁자와 다를 수 있다"는 우려에 가입 후 경쟁사 등록 비교를 안내하자는 제안 → 검증 결과 그 비교 기능은 **ChatGPT 아닌 Gemini 기반**(`single_check_with_competitors` 호출처 3곳 전부 GeminiScanner)이라 채널을 특정하면 허위 안내가 됨 — 중립 문구("가입 후 직접 등록해 AI 노출을 비교할 수 있습니다", 채널 미표기)로 추가. 기존 문구가 "사실과 다를 수 있다"까지만 말하고 "체계적 조사가 아니라 AI가 임의로 답한 이름"이라는 점은 명시 안 하던 것도 함께 보강. git `65c804d`. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §14.
- **2026-09-29 "고치면 어떻게 되나" + 부정 일변도 완화**: 1인칭 사장 관점 평가("나쁜 소식뿐이라 결제까지는 안 갈 듯")에서 나온 개선 2건 — 먼저 고칠 것 각 항목에 반영 기간 효과 문구 추가(기존 TodayOneAction.tsx 근거 재사용, 새 주장 없음), 1위 경쟁사 ChatGPT 노출률도 낮을 때만(30% 미만, 실측 조건부) "아직 승자 없음" 안심 신호를 한 줄 진단에 추가(지어낸 위로 아님, 기존 top_places 측정값 재사용). git `b9746e8`. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §13.
- **2026-09-29 부정 신호만 있는 사업장의 신뢰도 문제 수정**: "모든 정보가 비어있거나 할 일만 나오면 사용자가 시스템을 의심하지 않을까" 질의 → 코드 확인 결과 "완전히 빈 화면"은 재현 안 됨(한 줄 진단·Block A는 항상 구체적 메시지 표시)이나, 경쟁사를 못 찾으면 `CompetitorBlogBars`가 설명 없이 사라지고(`_TRIAL_COMP_SKIP_CATEGORIES` 니치 업종에서 실제 발생 가능) 강점이 0~1개면 `PassedItemsAccordion`도 사라지는 문제는 실제 확인(DB 실사례 "진정한국수" 등) → 두 곳 모두 "측정을 시도했지만 없었다/아직 없다"는 정직한 안내로 교체, 온라인 업종엔 구조적 안내와 중복되지 않게 가드 추가. 유료 API 호출 없이 합성 응답 주입으로 라이브 검증. git `313e38d`. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §12.
- **2026-09-28 §10 사후 검증(유료 AI 호출 없이) — 죽은 코드 1건 제거**: 사용자 지시로 블로그 검증 집계 코드 전체 재검토(코드 읽기·로컬 테스트 86개·서버 md5·헬스체크만 사용, ChatGPT/Gemini 등 유료 호출 없음) — 로직 오류 없음 확인, `naver_visibility.py`의 `blog_query_keyword`(검증 모듈 도입 후 미사용) 죽은 코드만 제거·재검증(git `3561787`). 프론트 "Server Reference ID" 로그 41건은 수정 파일과 무관 확인, 조사는 범위 밖. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §11.
- **2026-09-28 블로그 언급 수 검증 집계 전면 적용(유료 경로 포함) + 지역 판정**: 네이버 블로그 API `total`은 따옴표를 무시해 무관한 글·같은 이름/같은 동네 이름의 다른 지역 글이 합산됨(창원작곡레슨 4,784→24, 흔한 이름 "본가"는 서울 강남구 신사동에서 47%가 다른 지역, 2026-07-14의 "따옴표 exact match 수정"은 효과 없었음) → 신설 `services/blog_mention_verifier.py`(단일 소스): 상위 100건 중 제목·요약에 이름이 실제 나오고(지점·업종서술어 뗀 이름 포함) **지역이 확인되는 글**만 센다(광역시=구 단위, 일반시=시 단위+같은 시 다른 구 제외). `get_naver_visibility`·`fetch_competitor_blog_mentions`·경쟁사 약점 스니펫·체험 화면 적용, 저장값 재계산, 점수는 capped를 100건 초과로 취급. 하한값(본문에만 이름이 나오는 글 제외) 명시. 상세·전/후 실측 `docs/trial_improvement_2026_09_28_v1.0.md` §10. 블로그 수를 "언급 수"로 쓸 때는 반드시 이 모듈을 쓸 것.
- **2026-09-28 체험 정보 신뢰성 재점검 — 블로그 수·AI 추천 가게·ChatGPT 안내**: 한 줄 진단의 "1위 경쟁사 안민 중동 2,336건"을 재현 검증 — 가게는 실제 존재(내 지명 의심은 틀림)하나 네이버 블로그 API가 따옴표를 무시해 무관한 글(민원발급기·병원 목록)이 합산돼 이름이 나온 글은 상위 100건 중 1건, 내 가게도 37건 중 3건. 체험 화면 블로그 수를 "제목·요약에 가게 이름이 나온 글 수(상위 100건, 하한값)"로 교체(`_verified_blog_count`, 점수·DB는 기존 API total 유지, 키워드별 블로그 비교는 검증 불가라 제외), AI 추천 가게는 네이버 확인된 곳만 순위 표시, ChatGPT 미노출 안내에서 입증 안 된 "소개글 Q&A 없음이 원인" 단정 제거. **유료 경로(대시보드·경쟁사·점수)는 아직 API total 사용 — 과대집계 가능성, 별도 결정 필요.** git `a1397bc`~. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §9.
- **2026-09-28 "Google AI Overview 실측" 표기 정정 + 유료 스캔 ChatGPT 비유도형 전환**: 진행 전 반증으로 내 지적 일부가 오판임을 확인(대시보드 `AIDiagnosisCard`는 이미 구분 처리) 후 범위 조정. Serper 12개 질의·저장 301건 모두 AI Overview 0건 → 표기를 "Google 검색 노출"로 정정(git `4fb52e8`), `DashboardDetailZone`의 `in_ai_overview ?? mentioned` 잠복 버그(검색 노출 무시) 수정. 유료 스캔 ChatGPT: 실사업장 43/100·20/100·95/100(지어낸 홍보 인용문) → 비유도형 0/30으로 전환(수동 Quick 포함 전 경로 `sample_recommend`), 회귀 테스트 7개. Gemini는 결제 연결 후 동일 전환 예정. 상세 `docs/trial_improvement_2026_09_28_v1.0.md` §8.
- **2026-09-28 무료 체험 후속(밤) — 스캔 화면 허위 문구 정정·지도 주소 붙여넣기·결과 이메일 카드**: 스캔 진행 화면이 미측정 항목(AI 브리핑·Gemini)을 측정 중이라 표시하던 것 정정, `trial-search` 후보의 `naver_place_id`가 항상 빈 값(API가 place URL 미제공)이라 스마트플레이스 자동 진단이 구조적으로 어려움 → 입력 화면에 "내 가게 네이버 지도 주소(선택)" 추가(`lib/naverPlaceUrl.ts`, 백엔드 place_id 숫자 검증), 결과 이메일: 기존 입력 코드가 죽은 코드였고 `save-email`은 저장만 하던 것 → `TrialEmailCard`(동의 필수)+체험당 최초 1회 결과 메일, 메일 본문의 "어제 스캔"·미측정 소개글 단정 제거. git `47845b3`·`0b8a083`·`e0203ad`. 상세·미진행 항목(유료 스캔 유도형 프로브 교체는 사용자 결정 대기) `docs/trial_improvement_2026_09_28_v1.0.md` §7.
- **2026-09-22 대시보드 로딩 지연 조사 — 5가지 원인 순차 발견·수정, 최댓값 106s→10.7s(완전 해결 아님)**: "접속 로딩 시간이 김" 신고 → ①SSR이 `NEXT_PUBLIC_BACKEND_URL`(공개도메인) 경유로 자기 서버 재호출(4개 페이지 수정, git `4211000`) ②Cloudflare가 한국 트래픽을 PDX/HKG 등 해외 POP로 우회(origin 직접 0.05s vs 공개경로 최대 106s 실측 → DNS 프록시 OFF, nginx h2+gzip 사전 보강) ③서버 DNS가 KT DHCP라 TTL 만료 때 콜드조회 0.9~4.5s 정체(netplan으로 1.1.1.1/8.8.8.8 영구고정, `/tmp/dns_ok` 플래그+2분 자동롤백 안전장치 사용) ④Supabase Performance Advisor로 RLS 정책 중복 206건 발견 — 대시보드 8개 핵심 테이블이 같은 조건의 정책을 최대 4개씩 중복평가 중이던 것 확인·통합(`(select auth.uid())` 패턴, git `4ff0b4d`에 SQL 기록, 교차테넌트 격리 재검증 완료) — 단 service_role 키를 쓰는 백엔드 API는 RLS 자체가 우회돼 효과가 프론트 직접조회에 한정됨을 뒤늦게 확인(격리벤치 개선이 end-to-end 개선을 보장 안 함) ⑤`gap`(`analyze_gap_from_db`) 무캐시로 단독 17.6s 스파이크 실측 → 5분 캐시 추가(git `4ff0b4d`, 22.8s→10.68s). **최종 결론**: gap캐시 후에도 남은 800~2500ms대는 GoTrue/REST/FastAPI 각각 25회 격리재측정 결과 셋 다 정상이라 Supabase측 확률적 간헐정체로 확정 — 코드 최적화로는 "정체에 걸리는 쿼리 수"만 줄일 뿐 근본 제거 불가. 중간에 측정 없이 배포했다 되돌린 가설 4개(토큰캐시 등)도 있음. 상세·재현스크립트·다음 후보(Suspense 스트리밍/Supabase 유료플랜)는 `docs/dashboard_load_delay_investigation_v1.0.md` 참조.
- **2026-08-31 창업 시장 분석 종합 개편 — SBIZ 실측 도입부터 AI 전략 3단 고도화까지**: 카카오 밀도 지표 신설 → 국세청 SBIZ 실연동(Sentry의 aiohttp 헤더 자동주입이 400오류 원인이었음 규명·해결, `trace_propagation_targets=[]`) → 반경 행정구역별 자동조정(동/구/군)+밀도·신뢰도 등급 신설 → 경쟁사 스마트플레이스 준비도 체크(1단계 기존 테이블 무료조회+2단계 격리상한 캐시조회 하이브리드, 캐시버그 2건 실측발견·수정) → 페이지 목적 재정의(AEOlab 자체 데이터 화면·Claude 프롬프트 양쪽에서 제거, 순수 실측 상권분석으로 재편) → AI 전략 프롬프트 3단 개선(일반론 제거 → 필드별 근거다양화·통찰강화 → 모바일 가독성용 문장길이 제약). 전 과정 라이브 QA 계정 실측 검증, AI 지어내기 재발 2건(노출기간·임대료 수치)도 발견 즉시 차단. 잔여: 경쟁사 준비도 2단계(네이버 place_id 탐색)는 오픈API `link` 필드가 "홈페이지 URL"이지 플레이스 링크가 아니라는 구조적 한계로 실효성 낮음 — 더 신뢰도 높은 Playwright 지도검색은 차단위험 미검증이라 보류. git `375e731`~`7672be8`(9개 커밋, 전체 흐름은 changelog_archive.md 참조).
- **2026-08-31 창업 시장 분석 추가개선 점검 — 월한도초과 에러 미처리 버그 발견·수정**: "더 개선할 것 없는지" 질의에 코드 재검토 중 `StartupClient.tsx handleGenerate()`가 403만 처리하고 429(월한도초과)·409(동시생성중)는 처리 안 해 에러 JSON을 그대로 결과로 취급하던 것 발견 — 옵셔널체이닝 덕에 크래시는 안 나지만 사용자에게 아무 설명 없이 빈 화면만 보임. QA계정에 guides 5건 미리 삽입해 한도소진 재현(Claude 호출 낭비 없이) → 명시적 에러 메시지 분기 추가 후 "이번 달 한도(5회)를 초과했습니다" 정상 노출 확인(git `cc1afaa`). **미결 제안(구현 안 함, 확인 대기)**: 유료 `/api/startup/report`(Claude 호출)는 캐싱이 전혀 없음 — 무료 `/market` 미리보기는 이미 30분 캐시 적용 중인 것과 대조적. 같은 업종·지역을 다른 사용자가 반복 조회해도 매번 새로 Claude를 호출해 비용 낭비 — `business_name`은 프롬프트에 장식적으로만 쓰여 캐시 키에서 제외해도 무방함을 확인. 캐시 히트를 월 한도에서 차감할지는 별도 정책 판단 필요.
- **2026-08-31 창업 시장 분석 캐싱 도입 + 결과 화면 시각적 재설계**: "캐싱 진행 + 텍스트만 나열돼 보기 어려움 개선" 요청 처리. 캐싱: 유료 `/api/startup/report`(Claude 호출)에 24시간 캐시 추가 — 캐시 히트는 Claude 재호출도 월 한도 소모도 없음(비용 0원이라 사용자에게 불리할 이유 없다는 정책 판단), business_name은 프롬프트에 장식적으로만 쓰여 캐시 키에서 제외. 라이브 검증: 1차 39.0초→2차(동일쿼리) 1.5초, used 1→1 불변 확인(git `40caf53`). 화면 재설계: 기존 팔레트(블루=시장데이터·에메랄드=경쟁사·앰버=트렌드)는 유지하고 Claude 종합결과("AI 진입 전략")에만 인디고 신규 도입해 원본 데이터와 구분 — 시장규모·밀도를 큰 숫자 타일로 승격, entry_strategy에 "핵심 요약" 좌측강조바, 핵심액션은 화살표→번호 원형배지, 주의사항은 개별 경고카드로 전환. 데스크톱+모바일 라이브 확인(git `663fc1d`).
- **2026-09-01 창업 시장 분석 폐업율(생존 현황) 기능 구현·배포**: `docs/closure_rate_feature_implementation_plan_v1.0.md` 설계대로 backend-dev/frontend-dev 병렬 구현. 신규 `backend/services/localdata_api.py`(행안부 지방행정 인허가 API, 20개 업종 ENDPOINT_MAP, bar는 `BZSTAT_SE_NM::LIKE=호프` 필터, 24h 캐시, 70초 타임아웃) + `startup_report.py`에서 `get_startup_report()` 내부 직접 호출로 통합(별도 엔드포인트 없음) + `StartupReportView.tsx` "시장 현황" 섹션 안 서브블록 추가(신규 최상위 섹션 아님). git `4bd5d14`(frontend)·`ac01425`(backend).
- **2026-09-01 폐업율 기능 후속검증 — 라이브 브라우저 재현으로 시도명 축약형 미매칭 P0 발견·즉시 수정**: 에이전트 완료 보고 + grep 검증만으로 끝내지 않고 QA 임시계정(Biz플랜)으로 실제 `/startup` 화면 라이브 재현 — `real_market`은 정상 렌더링됐지만 폐업율 서브블록 자체가 화면에 없었음. 네트워크 응답 직접 확인 결과 `closure_rate: {"available":false,"reason":"no_data"}` — 원인은 `LOTNO_ADDR::LIKE`가 공식 시도명("서울특별시")만 매칭하는데, **UI가 placeholder로 직접 권장하는 축약 입력("서울 강남구")** 을 그대로 질의에 써서 0건 매칭. `localdata_api.py`에 시도명 축약형→공식명 정규화 테이블(`_normalize_region_for_lotno`, 17개 시도) 추가해 즉시 수정·배포·재검증(같은 QA 계정으로 재현: "생존 현황 76.2%·전국 평균 대비 높음" 정상 렌더링 + `risk_factors`가 실제로 인용하는 것까지 재확인). QA 계정·사업장·구독 테스트 후 완전 삭제 확인. git `037c75e`.
- **2026-09-02 창업 시장 분석 UX 2차 개선 — 색상 통일·범례·접기 토글(이탈 방지)**: "디자인이 세련되고 정리 잘 되어 이탈 방지" 요청에 오판검증(반증) 진행 — ①색상 비일관성은 코드 확인으로 확정(밀도비교 rose/emerald·생존현황 red/green/yellow·AI노출 blue/amber 3곳이 "높음/낮음" 같은 개념에 다른 색조, 신호칩도 "낮음"·"비슷함"을 둘 다 회색으로 뭉갬) → `comparisonColor()`/`comparisonBadgeClass()` 헬퍼로 전체 통일(파랑=기회/주황=주의/회색=중립) ②AI노출 개념 낯섦은 구조적으로 타당 → 1줄 설명 캡션 추가 ③"실측과 AI해석 구분 안 됨"은 **오판으로 정정**(섹션 제목에 이미 라벨링 존재, 과장이었음 — 재수정 안 함) ④페이지 길이는 실측 확인 → "AI 진입 전략 상세" 기본 접힘+토글 신설(핵심 정보는 이미 최상단 노출돼 손실 없음). 라이브 검증: 색상 통일·범례·토글 전부 정상, 페이지 높이 3746px→2811px 축소, 모바일 오버플로우 없음. git `b0c8057`.
- **2026-09-02 창업 시장 분석 결과 화면 시각적 재설계(모바일 포함)**: 사용자 관점 재평가에서 나온 3가지 문제 해결 — ①종합 판단 부재: Claude "핵심 요약"을 페이지 최상단 "AI 종합 판단" 카드로 이동(하단 중복 제거) + 4개 실측 신호(밀도비교/생존율/AI노출/검색트렌드)를 스캔 가능한 칩으로 요약(새 판단 로직 없이 기존 값 재사용) ②AI노출 배지 색상 모순 수정: "미흡·주의필요"(경쟁사가 AI노출 못 챙김=예비창업자에겐 기회)가 기존 경고색(주황)이었던 걸 기회색(파랑)으로, "양호·우수"는 반대로 경쟁치열 신호로 주황 처리 ③폐업율 오독 방지: "자영업은 폐업 회전율이 구조적으로 높다"는 절대 맥락 캡션 추가. 라이브 데스크톱(1400px)+모바일(375px) 실측: 가로 오버플로우 없음, 칩 자연스러운 wrap, 배지 색상 반전 정상 확인. git `3fe5f94`.
- **2026-09-01 창업 시장 분석 — AI 검색 노출 벤치마크 추가(SBIZ 데이터 배제 후 대안)**: "소상공인 데이터는 제외하고 어떤 방법으로 개선할까" 질의에 SBIZ/오픈업/나이스비즈맵 어디도 갖지 못한 AEOlab 고유 자산(AI 검색 노출 실측)을 재점검 — 기존 `/api/report/benchmark/{category}/{region}` 엔드포인트(score_history+trial_scans 합산, 최소 표본 3~5개 게이트)를 그대로 재사용. CLAUDE.md "점수 표시 원칙" 준수해 avg_score 원시 숫자는 응답에서 제외하고 `DualTrackCard.tsx getScoreStatusLabel()`과 동일한 5단계(주의필요/미흡/보통/양호/우수) 텍스트 레이블만 전달, "미흡"이면 위협 아닌 선점기회로 해석하도록 Claude 프롬프트에 프레이밍 지시. 표본 부족(현재 구독자 규모에서 흔함) 시 조용히 생략. 라이브 QA 검증: level="주의 필요"(표본 21곳, 전국 fallback) 정상 표시 + Claude가 "AI 노출 채널이 사실상 비어있다"로 실제 인용 확인. git `82a594b`.
- **2026-09-01 SBIZ 서브코드 부분실패 은폐 P0 발견·수정**: "모두 높은 수준이 되도록 개선" 요청에 오판검증(반증) 진행 중, restaurant 등 7개 서브코드(indsMclsCd)가 `asyncio.gather`로 동시조회되는데 일부만 429(초당 요청제한)로 실패해도 나머지만 합산해 `available:True`로 조용히 반환하던 결함 발견 — 같은 "홍대" 조회가 시점에 따라 47.7~176.8개/㎢(3.7배 차이)로 나오는 걸 실측 재현. `sbiz_api.py`에 부분실패 감지 시 `confidence:"low"`+`partial_failure:true` 강등, 재시도 2→3회·백오프 1초 단위 상향, `market_comparison`에 `compare_radius_m`/`compare_confidence`/`low_confidence` 투명성 필드 추가, 프론트 캐비엇 원인별 분기(면적과소 vs API실패) 완료. 라이브 재검증: 정상케이스 캐비엇 미노출 확인 + 신규필드 전부 정상 반환 확인. git `2fa6a42`.
- **2026-09-01 localStorage 계정공유 P0 수정**: "재로그인 후에도 정보가 유지되는지" 질의로 QA 2계정(A/B) 라이브 재현 — 계정A 분석 후 로그아웃→계정B 로그인 시 B가 A의 결과를 그대로 봄(타임스탬프 일치로 확정). 저장 키를 `aeolab_startup_report_v1:{user.id}`로 사용자 분리, 구버전 고정 키는 마운트 시 자동 정리. 재검증: ①계정 전환 시 미노출 ②같은 계정 재로그인 시 정상 유지 — 둘 다 확인. git `f69012b`.
- **2026-09-01 창업 시장 분석 — 네이버 SearchAd 절대 검색량 추가(전문 리포트 격차 Tier 1 해소)**: "어떤 정보를 추가해야 전문 리포트 수준인가" 질의에 코드 확인으로 "이미 있는데 안 쓴 데이터" 발견 — `naver_datalab.py`의 `monthly_volume` 필드는 이미 존재하고 성장 리포트(`report.py`)·블로그 진단(`blog.py`)이 이미 SearchAd 병합 패턴(`get_volumes_with_cache`, 7일 캐시)을 쓰는데 창업 리포트만 재사용 안 하고 있었음(단순 누락, 의도적 배제 근거 없음). DataLab 트렌드(%)는 방향만 주고 "월 몇 회 검색"이라는 규모는 안 주는데, 오픈업의 "배달주문 건수"·SBIZ의 "매출분석"에 대응하는 위치가 이 절대 검색량 — 새 API 계약·허위수치 위험 없이 기존 패턴만 재사용. `search_trend.keyword_volumes` 필드 신설 + Claude 프롬프트에도 반영 + 프론트 "월간 검색량(SearchAd)" 태그 UI 추가. 라이브 QA(대구 동성로/음식점) 검증: keyword_volumes 정상 반환(프라이빗룸 월910회 등) + Claude가 실제로 절대 검색량을 비교해 우선순위를 정한 전략 생성 확인. git `2a0e23a`. **잔여 Tier 2**: 경쟁사 리뷰수·평점 정량화(추가 API 호출 필요, 미착수), SBIZ 유동인구(별도 활용신청 필요, 미착수).
- **2026-09-01 창업 시장 분석 "전문 보고서 수준" 재평가 + 밀도 비교 레이블 + 결과 저장 기능**: 사용자 질의("전문적인 보고서가 되는가?")에 SBIZ/오픈업/나이스비즈맵 재조사(WebSearch) — 이들은 34쪽 PDF·차트 중심·5축 분석인 반면 AEOlab은 단일화면 텍스트 서술이라 "정식 리포트" 급은 아님, 다만 AI 검색 최적화 플랫폼의 부가 기능으로는 준수(불확실성 고지·AI 종합전략의 구체성은 오히려 우위)라고 결론. 코드 확인으로 새 격차 3개 발견(밀도 비교 레이블 없음/PDF 없음/경쟁사 비교가 텍스트 수준) — PDF·경쟁사 시각화는 스코프 제외, 밀도 비교는 진행. **밀도 "전국 평균" 비교는 채택 안 함** — 국토 대부분인 농어촌 지역 탓에 도심 상권이 항상 "높음"으로 나오는 통계 왜곡 확인(WebSearch로 SBIZ 자체 "상권평가 5단계"는 매출·교통 등 종합 알고리즘이라 재현 불가함도 확인) → 사용자 결정으로 **비교 지역을 사용자가 직접 지정**(`compare_region`)하는 방식 채택, 두 지역 모두 같은 SBIZ API로 실측(허위 위험 없음). 동시에 "분석 결과가 페이지 이동 후 사라짐"(순수 React state, 저장 없음) 문제를 코드로 확인·localStorage 24h 저장/복원으로 해결(서버 캐시 TTL과 동일 기간). 라이브 QA 종단검증: 강남구 vs 홍대 밀도비교 실측(+462.7%) + AI가 실제 인용 + /dashboard 이동 후 /startup 재방문 시 결과 자동복원 확인. git `17765ab`.
- **2026-09-01 bar `national_avg` 왜곡 근사치 정정**: WebSearch로 국세청 TASIS 기반 보도(세정일보·한국경제·파이낸셜뉴스 등) 확인 — 호프주점은 100대 생활업종 중 40~60세·60세 이상 연령대 3년 생존율 최저군, 사업자 수 2018→2026 8년간 46.1% 감소(기타음식점 5.2%·분식점 5.1%보다 훨씬 급격)로 `general_restaurants` 전체 평균과 뚜렷이 다른(더 나쁜) 폐업 패턴. restaurant 전국평균(70.5%)을 bar에 재사용하면 실제보다 좋아 보이게 왜곡할 위험 확인 → bar `national_avg`를 `None`으로 되돌림(계획 원안과 일치). 서버 반영·재검증 완료. git `d8af263`.
- **2026-09-02 창업 시장 분석 페이지 재구성 — AI종합판단 카드 신설+비교색상 통일+세련도 개선**: 소상공인 데이터(SBIZ) 제외 후 대안으로 AI노출 벤치마크(`/benchmark` 재사용, 텍스트 레이블만) 통합 + 네이버 SearchAd 절대 검색량(`git 2a0e23a`, 위 항목) 통합 완료 후, "창업 예비자 관점 솔직 평가" 요청에 색상 불일치(market_comparison=rose/emerald, closure_rate=red/green/yellow, ai_benchmark=blue/amber 제각각) + AI노출"미흡" 배지가 실제로는 긍정 신호(선점 기회)인데 경고색(amber)으로 오분류된 것 발견 → `comparisonColor()`/`comparisonBadgeClass()` 공용 헬퍼로 전체 통일(blue=기회/파랑, amber=주의, gray=중립) + 색상 범례 추가 + "AI 진입 전략 상세" 섹션을 접이식(`useState showDetail`)으로 전환해 정보과다 완화. 이후 "파랑의 이중 의미"(비교판단색 vs 카테고리식별색) 자체점검에서 "실제 시장 규모/밀도" 원시수치 타일이 여전히 blue라 바로 아래 밀도비교 배지(blue=기회)와 의미 충돌하는 것 재발견 → closure_rate 76.2%(slate)와 동일하게 중립 slate로 정정(git `b23fd1d`). 라이브 QA(Biz플랜, 서울강남구 vs 홍대) desktop+mobile 재현 검증 완료. 목업 아티팩트는 https://claude.ai/code/artifact/c4f1c37d-6db0-457a-91af-646aaa99d25d — 최신 반영 필요(잔여 작업).
- **2026-09-02 네이버 Search/DataLab API → NAVER API Hub(NCP) 마이그레이션 완료**: 10개 파일 11개 호출처를 `naver_api_hub.py` 공용 헬퍼로 단일화, `NAVER_API_HUB_ENABLED` 플래그로 라이브 전환. 전환 직후 실제로 발견한 이슈 2건 즉시 수정 — ①Hub가 200 OK에도 `Content-Type: text/plain`으로 응답해 `aiohttp.json()`이 파싱 실패, 전체 네이버 호출이 조용히 fallback되는 회귀가 실운영에 약 5분간 영향(즉시 롤백→16곳 `content_type=None` 수정→재검증→재적용) ②발급 키가 "뉴스" 카드는 미승인(401) — `news`만 레거시 강제 유지하는 예외 처리. 라이브 재검증: 실제 좌표 변환(mapx/mapy WGS84×1e7) 정상 확인. git `41f3c01`~`aa38a1f`.
- **2026-09-02 유료가치 우위 확보 착수 — PDF리포트 제외판단 + 경쟁사비교 Phase 1**: "지불가치를 넘어서는 서비스 가능한가" 질의에 3개 후보(PDF·경쟁사비교·알림톡) 순차 착수. ①PDF: nginx 14일 로그 전수 확인(78,537건 중 PDF 요청 0건) → 제외 결정, 단 이 판단에 "실구독자 4명"을 근거로 넣었다가 **테스트 계정을 실사용자로 오판(3번째 재발, `project_similar_service_comparison_and_strategy_2026_08_25.md` 참조)** — 사용자 정정으로 즉시 메모리 강화(서비스 오픈 전, 실사용자 0명 기본 가정으로 통일). ②경쟁사비교 Phase 1: next-feature 기획에서 나온 "blog_mention_count가 list_competitors SELECT에서 누락" 발견을 코드 추적으로 반증(실제 메인 페이지는 page.tsx 직접쿼리를 써서 영향 없음, 다른 호출처엔 유효) → 정합성 차원 수정. 진짜 사용자체감 개선은 직접 설계한 `CoreGapBadge`(카드 상단 "핵심 격차 1줄", 리뷰수·블로그언급·소개글/메뉴 중 최대 격차 자동선별, DB/AI비용 0원) + **`PlaceCompareTable`이 전혀 다른 데이터소스(`gapAnalysis`, AI스캔 없으면 404)에 잘못 종속되어 스캔 0회 사용자에겐 아예 안 보이던 버그 발견·분리 수정**(스마트플레이스 비교표는 스캔 불필요, 경쟁사 등록+동기화만 있으면 됨). git `0c0b1d4`·`130e957`·`bd356ce`. **라이브 검증 완료**(락 해제 후 QA계정 재현) — 스캔 0회 상태에서 스마트플레이스 비교표가 실데이터로 정상 렌더링됨과 `CoreGapBadge`("경쟁사 소개글 미등록 — 선점 기회") 파란 배지 정확한 위치·문구 확인.
- **2026-09-02 유료가치 우위 확보 ③알림톡 활용도 — 신뢰훼손 버그 3건 수정**: next-feature 기획 → 코드 추적 반증 후 적용(일반론 아님). **P1**: `_send_kakao_notifications()`가 `phone`만 확인하고 `kakao_scan_notify`/`kakao_competitor_notify`를 전혀 체크 안 해 설정에서 알림을 꺼도 SCORE_01·CITE_01·COMP_01·ACTION_01 4종이 계속 발송되던 버그 — weekly/daily_kakao_notify SELECT에 두 컬럼 추가 + 5개 발송 블록 전부 게이트. **P2**: 이메일 fallback이 `_grade_label()` 텍스트("양호 · 업종 3위")에 "점"을 붙여 "양호 · 업종 3위점"으로 문법이 깨지던 것 수정. **P3**: SCORE_01 트리거가 `abs(delta) > 0`이라 Pro/Biz(매일 스캔+매일 알림)는 측정 노이즈(0.1점)에도 매일 카톡 발송 가능 — 3점 이상으로 완화. git `4b682d1`.
- **2026-09-02 알림톡 활용도 — send_scan_complete/send_competitor_overtake 연결 완료(D/E)**: 사용자가 카카오 비즈센터 승인내역 스크린샷 제공 → `AEOLAB_SCAN_01`(스캔완료 즉시)·`AEOLAB_COMP_02`(경쟁사역전 긴급) 승인 확인, CLAUDE.md "5종" 문서가 stale이었음이 드러남(실제 17개+ 승인, 위 "카카오 알림톡 템플릿" 섹션 갱신). `send_scan_complete()`는 `daily_scan_all()` 스캔 완료 직후 연결(top_platform/top_improvement는 이미 계산된 값 재사용, 새 AI호출 없음). `send_competitor_overtake()`는 기존 "20점 이상 격차→business_action_log만 기록"하던 `_auto_log_competitor_overtake()`를 확장해 최근 7일 내 미발송 시에만 카톡 발송(지속 격차 아닌 "새로 벌어진 격차"에만, 매일반복 방지). 같은 자리의 GrowthStage 알림도 phone만 확인하고 토글 무시하던 동일계열 버그 추가 발견·P1 원칙 적용. 배포 전 활성 구독 5건 전화번호 미설정 확인해 실발송 위험 없음 확인. git `50ab946`.
- **2026-09-02 3영역 상업수준 재점검(code-review 병렬 3개) — _auto_log_competitor_overtake NameError 발견·수정**: "개선된 모든 것 다시 상업수준 점검" 요청에 네이버Hub·경쟁사비교·알림톡 3개 code-review 에이전트 병렬 실행. **가장 심각한 발견**: `jobs.py`가 `execute`를 `_db`로만 import하는데 `_auto_log_competitor_overtake`(방금 만든 E 알림 포함)와 인접 `_auto_log_score_change`가 지역 import 없이 bare `execute()`를 호출 — 매번 NameError, 바깥 try/except가 조용히 삼켜서 E 기능이 실제로는 한 번도 실행된 적 없었고 기존 TrendLine 이벤트 오버레이용 점수변화 로깅도 같이 무동작이었음(이번 세션 이전부터의 pre-existing 버그). `execute`→`_db` 전체 교체 후 QA로 `business_action_log` insert 직접 확인해 해소. 그 외 네이버Hub의 JSONDecodeError 미처리(Hub 200+비정상바디 시 500 노출) 6파일 방어, 경쟁사비교의 `myBlogMentions` 기본값 0→null 정정(측정실패를 확정0건으로 오인 방지)+`/suggest/list` 타사용자 점수 노출 제거, 알림톡의 경쟁사역전 dedup이 competitor_name 미구분이라 경쟁사A 알림이 경쟁사B를 막던 버그까지 총 10개 파일 수정·배포·컴파일검증 완료. git `1b3ae58`.
- **2026-09-02 경쟁사 PC/모바일 UX 재점검 + 핵심격차 배지 목록 노출**: "PC/모바일 시안성·지불가치 만족도 재점검" 요청에 QA 계정으로 데스크톱(1400px)+모바일(375px) 라이브 재현. 모바일은 4열 비교표 좌우스와이프 안내 등 문제없음, PC는 "격차 분석" 이하가 화면폭 활용 없이 세로로만 쌓여 페이지가 매우 긺(5500px+) 확인. **`CoreGapBadge`가 "상세" 클릭 후에만 보여 목록 기본화면엔 더 약한 기존 문구("경쟁사가 앞서 있습니다")만 노출되던 것 발견** → 계산 로직을 `computeCoreGap()` 순수함수로 분리해 목록(접힌) 카드에도 동일 적용, 클릭 없이 3가지 톤 전부 라이브 확인. `report.py`의 "개선 필요" 라벨이 항상 최고경쟁사 기준이라 대부분 항목이 경고색으로 뜨는 것도 발견(디자인 의도, 버그 아님 — 재검토 후보로 기록만). git `ae2075c`. **후속 완료(같은 날)**: "개선 필요" 판정을 최고경쟁사→평균 기준으로 완화(경쟁사 3곳 중 2곳보다 앞서는 항목이 전부 빨간불이던 문제 해소) + "격차 분석"의 GapAnalysisCard·키워드격차를 `md:grid-cols-2`로 PC 2열 배치(PlaceCompareTable은 폭 필요해 전체폭 유지). 라이브 QA로 평균 상회 시 "개선 필요" 미표시 정상 확인. git `a92f7a5`. 잔여 후보 없음.
- **2026-09-02 AI 광고 대비 가이드 점검 — guides 테이블 context 필터 누락(교차 기능 오염) P0 발견·수정**: 페이지 점검 중 ad_defense가 `guides` 테이블에 콘텐츠 없는 카운터 행(items_json=null)만 insert하는 걸 확인 → 같은 테이블을 context 필터 없이 "최신 1건"으로 읽는 호출처가 7곳(`check_guide_limit`·`get_latest_guide`·대시보드·`/guide`페이지 2쿼리·`report.py` 2곳·카카오 `AEOLAB_ACTION_01`·`scan.py` 자동가이드 dedup 가드) 발견 — ad_defense/crisis_reply/startup_report/faq_draft/intro_draft/talktalk_faq 중 아무거나 최근에 썼으면 그 콘텐츠 없는 행이 "최신 개선 가이드"로 오인됨. **실제 프로덕션 데이터로 재현 확인**: 한 사업장이 faq_draft·crisis_reply·ad_defense만 쓰고 개선 가이드는 한 번도 생성한 적 없는데도 `check_guide_limit()`이 이 행들을 다 세어 Basic 월 3회 한도가 이미 소진된 것처럼 보고 있었음(핵심 기능을 써보기도 전에 차단). 7곳 전부 `context IN (location_based, non_location)` 필터 추가, `get_latest_guide`는 프론트가 이미 기대하던 `?context=` 파라미터를 실제 구현. 부수로 ad-defense 결과 영구소실 버그도 수정(items_json에 결과 저장 + 페이지 재방문 시 자동 복원 — 기존엔 Pro/Biz 월 5~10회 한도를 태운 결과가 새로고침 한 번에 사라져 다시 보려면 한도를 또 소모해야 했음) + 사업장 전환 시 이전 결과가 라벨 없이 남아있던 버그 수정. git `772089a`.
- **2026-09-02 AI 광고 대비 가이드 "지불가치" 재평가 — 외부조사 반영 + 경쟁사격차·모멘텀·체크리스트 추가**: "비용 지불할 가치 있는 정보인지" 질의에 실사용 데이터(전체 8주간 실사용 1개 사업장 2회뿐, 5개 활성구독 중 자격자 4명)+콘텐츠 구조(기존 `/guide`와 입력값 거의 동일)로 "현재는 근거 약함" 1차 결론 → WebSearch 외부조사로 재검증: ChatGPT 광고가 실제로 2026-08-11 한국 라이브 도입됨(예상보다 훨씬 임박) + 한국 ChatGPT 최근3개월 이용률 54.5%(전년비+15%p) 확인 → "전제는 오히려 강해짐, 실행이 못 따라감"으로 결론 수정. 이후 4개 개선안 제안 → **사용자 지시로 재반증**: ①경쟁사 격차 수치화는 실제론 Gemini 채널 한정 데이터였음(ChatGPT 아님, 라벨 정정) ②"가이드간 변화 비교"에 당초 `score_history` 사용 계획이 실제 라이브 데이터로 falsy-zero 위험 확인(스캔 없이도 매일 0으로 채워짐, 2달간 미스캔 상태인 Biz 활성구독 1건 부수 발견) → `scan_results` 기반 스냅샷 비교로 설계 변경 ③숫자 노출 계획 2건 모두 텍스트 레이블 전용으로 수정(점수표시원칙 위반 사전 차단). 구현 완료: 경쟁사 실측언급 반영(score_estimated 제외)·모멘텀 텍스트배지·체크리스트(기존 `/{guide_id}/checklist` 엔드포인트 재사용, 신규 백엔드 로직 0)·프롬프트 도입일자 갱신. QA 임시계정으로 실제 Claude Sonnet 호출+체크리스트 PATCH end-to-end 검증 후 전부 삭제 확인. git `f2ed080`.
- **2026-09-02 AI 광고 대비 가이드 재점검 — teaser 화면 3곳 카피 불일치 발견·수정**: "다시 페이지 수준 점검" 요청에 코드 재검토(생성 화면·백엔드는 이상 없음 재확인) 중 **정작 유료 생성 화면(`AdDefenseClient.tsx`)만 실제 도입일(08-11)로 갱신하고, 대부분 사용자가 실제로 먼저 보는 teaser 3곳은 방치돼 있었음을 발견**: ①`ad-defense/page.tsx` 비Pro 잠금화면·NoBusiness 문구가 구버전 그대로 ②`PlanGate.tsx` 툴팁이 "2026 하반기 광고화 대비"로 미래형 표현(이미 도입된 사실인데) ③**대시보드 `ProUpgradePreview.tsx`가 "경쟁 업체 3곳이 ChatGPT 검색에서 광고 노출 중"이라는 지어낸 수치로 "경쟁사 광고 노출 감지" 기능을 예고 중이었으나, 실제 `ad_defense_guide.py`엔 이런 감지 기능 자체가 없음(구매 전 약속≠실제 기능 불일치, 허위 티저 사례)** — 실제 제공 기능(광고 리스크 진단)에 맞게 정정. git `c8e3a25`.
- **2026-09-02 AI 광고 대비 가이드 — 듀얼트랙(Track1+Track2) 리스크 진단으로 재설계**: "Track2만 반영" 방향(직전 커밋)을 사용자가 "두 트랙 다 살리면 어떤지" 반문 → 재검토 후 채택: Track1(네이버) 비중을 빼면 네이버80% 업종(예: 음식점)의 실제 낮은 리스크를 놓침, 이 맥락이 AEOlab 듀얼트랙 모델 고유의 정보. **risk_level을 momentum과 동일하게 결정론적 계산으로 전환**(`global_weight × (100-global_channel_score)` 임계값 40/20) — 직전 커밋 QA에서 네이버80% 업종에 Claude가 자유판단으로 risk_level="high"를 낸 오류를 실측 확인했었는데, 이번 재검증에선 "low"로 정확히 계산됨. organic_strategies는 Track2 4항목(`multi_ai_exposure`·`schema_seo`·`online_mentions_t2`·`google_presence`) 화이트리스트로 한정(기존 제외방식(denylist)은 v3.0/v3.1 호환용 레거시 키 오염 위험도 있었음), 네이버 상태는 종합 텍스트로만 situation_summary 배경에 반영. 실측 QA(restaurant, naver80/global20) 검증: risk_level=low 정확 + situation_summary가 "네이버가 튼튼해 리스크 제한적" 프레이밍 + organic_strategies 5개 전부 글로벌 채널만(네이버 항목 0개) 확인. git `3d281de`.
- **2026-09-02 AI 광고 대비 가이드 — 오판·누락 자체점검에서 공개한 잔여 리스크 3건 전부 해소**: 자체 검증 절차("오판과 누락을 충분히 검토했는지?")에서 코드 재확인 중 `exposure_freq`가 "항상 0이라 weak_areas 오염원"이라던 주석 근거가 미검증 추측이었음을 발견·정정(`score_engine.py:800/1001`의 `scan_result.get("gemini")`는 버그 아니고 스캐너 원본 키 사용이 의도된 설계, git `2fbdd25`) — 화이트리스트 로직 자체는 유효해 그대로 둠. 이어서 스스로 공개했던 3개 미해결 리스크(①40/20 임계값이 표본 없이 정한 값 ②실측으로 확인된 스코어 변동성(하루 만에 4.3→19.1)으로 인한 risk_level 경계 흔들림 ③"low=아무것도 안 해도 됨"이 유료가치를 깎는 문제)를 "모두 최적으로 개선" 지시로 해결: exposure의 의미를 "unified score 중 위험 노출 비율(%)"로 명문화 + 재보정용 `risk_calc` 구조적 로그 신설, 직전 risk_level 기준 5%p 히스테리시스로 경계 흔들림 방지, risk_level별 situation_summary 프레이밍 분기(low=선점기회/medium·high=방어) 추가. 실측 QA(직전 medium 상태에서 순수임계값은 low로 나오는 시나리오 재현) 검증: 히스테리시스대로 medium 유지 + risk_calc 로그 정상 기록 + medium 프레이밍대로 문구 생성 확인. git `bf4b0d8`.
- **2026-09-02 AI 광고 대비 가이드 — 처음으로 실제 라이브 브라우저 화면 확인(Playwright QA) + 논리모순 발견·수정**: 이전까지 전부 API/curl 검증이었는데 "사용자 관점 페이지 경험"·"시각적으로 보기 쉬운지·논리적 모순 점검" 요청으로 처음 QA 계정 로그인→PC/모바일 실제 스크린샷 확보. 성과 확인(경쟁사 언급·듀얼트랙 배경설명·저위험 재프레이밍·체크리스트 클릭 상호작용 전부 실제 화면에 정상 렌더링 — 체크리스트 PATCH가 실서버에 200 OK로 반영되는 것도 로그로 확인) 외에 **실제 화면을 봐서만 잡을 수 있는 버그 2건 발견**: ①대시보드 공통 위젯 `HelpFAQFloat.tsx`(`DashboardShell.tsx`가 로드)가 사용자 조작 없이 열린 채 렌더링되고 닫기 버튼도 안 먹어 콘텐츠 중간에 끼어듦(PC·모바일 모두 재현, ad-defense 전용 아닌 전체 대시보드 공통 버그라 이번엔 미수정) ②**텍스트 논리 모순**: 전략1(GBP만)이 "Gemini 노출 10%→30%"라 쓰고 바로 아래 로드맵(GBP+트립어드바이저+리뷰+Schema 전부)은 같은 1개월 목표를 "10%→20%"라 써서 더 적은 액션이 더 큰 수치를 약속하는 모순 확인 — 원인은 메인 개선가이드엔 있는 "숫자 예측 금지" 제약이 ad_defense 프롬프트엔 없었던 것. 퍼센트 예측 전면 금지(정성적 표현으로 대체) 수정 후 재QA로 전체 텍스트 퍼센트 표기 0건 확인. git `d0f2761`. **오판 정정(같은 날 재확인)**: 처음엔 `HelpFAQFloat.tsx` bottom-sheet가 사용자 조작 없이 열린 채 콘텐츠에 끼어드는 버그로 봤으나, 실제로는 Playwright `fullPage:true` 스크린샷이 `position:fixed` 요소를 잘못 합성하는 촬영 아티팩트였음 — 뷰포트 단위 스크린샷으로 재확인 결과 초기 로드 시 정상적으로 닫혀 있고(❓ 버튼만 노출), 열기·닫기 클릭도 정상 작동함을 확인. 실제 버그 아님, 조치 불필요.
- **2026-09-02 AI 광고 대비 가이드 — PC 2단 레이아웃+전략 구조화+상태카드 색상통일**: "각 화면에 알맞게 개선" 지시로 직전 점검에서 발견한 시각 디자인 문제 3건 구현. ①PC 1024px+에서 좌(현재상황+전략)/우(즉시실행액션·AI정보등록·로드맵) 2단 배치로 전환(이전엔 1400px 화면에서도 본문이 항상 ~660px 단일컬럼) ②`organic_strategies`를 description 단일문단(①②③ 기호 문장 내 삽입)에서 summary+steps(배열) 구조로 바꿔 실제 `<ul>` 목록 렌더링(과거 저장 가이드는 description 표시로 하위호환) ③"현재 상황" 3칸 중 ChatGPT만 상태색이 있던 걸 AI노출상태(75/55/30 임계값, DashboardHeroCard와 동일)·Gemini언급(노출비율 기준)도 배경색 적용해 통일. 실측 QA(Playwright 1440px+390px): PC 2단 레이아웃+3칸 전부 다른 색상(파랑/초록/초록)+전략 5개 전부 실제 불릿목록(DOM list/listitem 구조) 확인. 모바일은 DOM 구조로 정상 확인, 뷰포트 단위 스크린샷으로 재확인한 결과 HelpFAQFloat도 실제로는 문제없음(위 항목 참조 — fullPage 스크린샷 아티팩트였음, 실버그 아니었음). git `f57c798`.
- **2026-09-03 전체 사이트 사용자 관점 UX 점검 + 일괄 수정**: "전체 점검을 사용자의 관점에서" 요청에 관리자 제외 66개 페이지를 6개 배치로 나눠 실계정(hoozdev@gmail.com) PC/모바일 라이브 실측. 사용자가 두 차례 "오판과 누락은?" 반문 → 1차: 핵심여정 10페이지 최초 발견 6건 중 5건이 반증으로 기각(생존 1건도 P1→P2 하향) → 이후 배치는 "발견 즉시 자체반증" 규칙 내장. 2차: 메인 세션이 상위 2건을 코드로 직접 재검증(오판 아님 확정) + 전체 페이지 Glob 인벤토리 대조로 배치에서 빠진 6개 페이지 발견·보완 점검(배치⑥). 최종 P1 2건(`guide/score-model-v3-1`가 `searchParams` 없이 임의 사업장 조회하던 실버그, `/keywords`+`[slug]` 21페이지가 로그인 사용자 대시보드 복귀 경로 없던 구조결함)+P2 7건 전부 frontend-dev 위임 구현 후 서버 grep·pm2 로그로 직접 검증, 배포 완료(git `fa8cdb1`). 이어서 "상업 서비스 뛰어난 수준인가" 질의에 Nielsen 10휴리스틱 등 외부자료 대조 후 개선 5개 제안 → 반증으로 1건(자동테스트 부재) 오판 확인·정정 → 4건 구현·배포(온보딩 계측·업종군 배지·e2e 스위트 확장·notices 진입점, git `72d8cb1`) + 1건(긴페이지 접기)은 `/growth`·`/history`·`/guide` 실측 후 이미 토글 충분히 적용돼있어 조치불요로 종결. 상세는 `docs/full_site_user_perspective_ux_audit_v1.0.md` 참조.
