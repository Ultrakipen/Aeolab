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
