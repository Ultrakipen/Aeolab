# AEOlab 변경 이력 아카이브 (v1.2 ~ v3.7)

> CLAUDE.md 토큰 절약용 아카이브. 필요 시에만 이 파일 참조. 현재 상태·코드 패턴은 CLAUDE.md 본문 참조.
> 최종 갱신: 2026-04-24

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
