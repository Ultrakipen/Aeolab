# AEOlab 변경 이력 아카이브 (v1.2 ~ v3.7)

> CLAUDE.md 토큰 절약용 아카이브. 필요 시에만 이 파일 참조. 현재 상태·코드 패턴은 CLAUDE.md 본문 참조.
> 최종 갱신: 2026-08-23

---

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
