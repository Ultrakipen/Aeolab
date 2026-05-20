# 상업 서비스 출시 전 종합 점검 체크리스트 v2.0

> 작성일: 2026-05-19
> 작성 경위: v1.0(14개 체크포인트)을 흡수하며 누락 위험 영역(업종 60개 확장·점수 모델 3중 동거·스캐너 안정성·콘텐츠 D.I.A.·가이드 생성·플랜 게이트·스케줄러·운영 검증)까지 심층 확장
> 점검 핵심: **네이버 AI 브리핑·AI탭·ChatGPT 차별성이 60개 업종 전체에서 일관·최적 동작하는가**
> 적용 우선순위: P0(즉시) > P1(당일) > P2(다음 세션) > P3(다음 스프린트)
> 충돌 시 우선순위: 본 문서 < CLAUDE.md < 참고 문서(최신 실측)

---

## 0. 1줄 트리거 (새 대화창)

```
docs/commercial_launch_inspection_v2.0.md §1~§16 순서대로 점검 진행. 토큰 절약하며 발견 문제는 P0~P2 분류 후 수정·배포까지 자동 진행. 모든 보고에 단정 근거 + 반증 시도 각 1라인 첨부.
```

영역별 트리거:
```
docs/commercial_launch_inspection_v2.0.md §3 (AI탭) + §4 (ChatGPT 차별성)만 점검해줘.
```

---

## 1. 카테고리 분류 — 단일 소스 일관성 (가장 위험)

> **사고 패턴**: 백엔드·프론트 한쪽만 갱신 시 P0 사용자 오안내(2026-05 두 차례 발생).

### 1.1 ACTIVE 5개 단일 소스 동기화 (P0)
- [ ] `backend/services/score_engine.py:30` `BRIEFING_ACTIVE_CATEGORIES` = `["restaurant","cafe","bakery","bar","accommodation"]`
- [ ] `frontend/lib/userGroup.ts:20` `ACTIVE_CATEGORIES` Set = 동일 5개
- [ ] `frontend/lib/userGroup.ts:43` `BRIEFING_ACTIVE_CATEGORIES` 별칭 export = 동일 5개
- [ ] 두 파일 SHA·diff 직접 확인 후 불일치 0건 확정

### 1.2 LIKELY 12개 단일 소스 동기화 (P0)
- [ ] `backend/services/score_engine.py:33` `BRIEFING_LIKELY_CATEGORIES` = beauty·nail·skincare·massage·spa·pet·fitness·yoga·pharmacy·dance·ballet·semi_permanent (12개)
- [ ] `frontend/lib/userGroup.ts:28` `LIKELY_CATEGORIES` Set = 동일 12개
- [ ] 항목 누락·순서 변경 시 P0

### 1.3 INACTIVE 명시 목록 (P1)
- [ ] `score_engine.py:36` `BRIEFING_INACTIVE_CATEGORIES` 명시 50+ 업종 확인
- [ ] 25개 화이트리스트 외 신규 35개 업종 모두 INACTIVE 분기되는가
- [x] `other`·`기타` → `get_briefing_eligibility` 직접 `"inactive"` 반환 — `score_engine.py:73-75`에서 `normalize_category` 호출 전에 이미 처리됨 (완료 확인. 추가 검증 불필요)

### 1.4 화이트리스트 25개 vs DUAL_TRACK_RATIO ~60개 확장 (P1)
- [ ] `DUAL_TRACK_RATIO` 직접 정의 ~54개 키 + alias 경유 ~3개 + `DEFAULT_DUAL_TRACK_RATIO(0.60/0.40)` fallback 존재
- [ ] `keyword_taxonomy.py`에 정의된 모든 업종이 `DUAL_TRACK_RATIO`에도 존재 (누락 시 fallback 60/40 적용됨 → 의도된 비율 손실 위험)
- [x] **`yoga` DUAL_TRACK_RATIO 등록 완료** — 2026-05-19 수정: LIKELY 업종이었으나 미등록 → `{"naver": 0.60, "global": 0.40}` fitness 동일 비율로 추가 (`score_engine.py`)
- [ ] **25개 화이트리스트 전체 커버 확인** — `yoga`, `education`, `tutoring`, `cleaning`, `fashion`이 alias 또는 직접 키로 처리되는지 확인 (`education→academy`, `fashion→clothing` alias 검증)
- [ ] 키워드 그룹·점수 모델·가이드·UI 4영역 모두 커버

### 1.5 프랜차이즈 게이팅 일관 (P0)
- [ ] `get_briefing_eligibility(category, is_franchise=True)` → `"inactive"`
- [ ] `getBriefingEligibility(category, true)` → `"inactive"`
- [ ] `RegisterBusinessForm` 체크박스 + `BusinessQuickEditPanel` 체크박스 모두 존재
- [ ] 모든 호출처에서 `is_franchise` 인자 전달 (생략 시 False 기본 → 미체크 우회 위험)
- [ ] `getUserGroup` 반환 `"franchise"` 별도 분기 (UI 메시지 차별)

### 1.6 alias 처리 (P2)
- [ ] `normalize_category` alias: `bakery → cafe`, `bar → restaurant`, `nail → beauty` (의도)
- [ ] alias 후에도 점수 그룹은 원본 카테고리(예: bakery는 ACTIVE)로 평가되는가
- [ ] 신규 별개 키(`spa`, `clothing` 등 v5.7) alias 충돌 없음

### 1.7 동적 카테고리 API 경로 (P2 — 보완)
- [ ] `backend/routers/public_briefing.py` `GET /api/public/briefing-categories` 응답에 ACTIVE+LIKELY 동시 포함
- [ ] `frontend/lib/briefingCategoriesServer.ts` 또는 `fetchBriefingCategories` 호출 페이지 목록 확인
- [ ] 백엔드만 갱신해도 프론트가 자동 반영되는 페이지 vs 하드코딩 fallback만 사용 페이지 분리
- [ ] 캐시 TTL·revalidate 정책 충돌 없음

---

## 2. 네이버 AI 브리핑 (ACTIVE/LIKELY/INACTIVE 분기)

> **사고 패턴**: INACTIVE 업종 대시보드에 "AI 브리핑 등록 가이드" 노출 → 이탈.

### 2.1 호출처 일관성 (P0)
- [ ] `get_briefing_eligibility()` 전수 grep — `is_franchise` 인자 누락 호출 0건
- [ ] `briefing_engine.build_briefing_paths()` INACTIVE 업종 → 글로벌 AI 경로만 반환
- [ ] `report.py`·`guide.py`·`scan.py` 등 라우터의 eligibility 분기 일관

### 2.2 INACTIVE UX (P0)
- [ ] 대시보드 상단 배너 "AI 브리핑 비대상 → AI탭 가이드로 이동" 자동 노출
- [ ] `/guide` 허브에서 AI 브리핑 카드 비활성/숨김 (잠금 UI도 금지 — 비대상 업종에 강요 인상 금지)
- [ ] `AiTabPreviewCard` `available: false` 시 카드 자체 비표시
- [ ] 트라이얼 결과 화면 INACTIVE 분기 — 글로벌 AI(ChatGPT·Gemini·Google) 강조

### 2.3 ACTIVE/LIKELY UX (P1)
- [ ] `GROUP_MESSAGES.ACTIVE` headline·sub·badge 노출 확인
- [ ] `GROUP_MESSAGES.LIKELY` "확대 예정" 톤 — 단정 표현 없음 ("AI 브리핑 대상" 단언 금지)
- [ ] `GROUP_MESSAGES.franchise` 별도 보라색 배지

### 2.4 점수 모델 v3.1 ai_briefing_score 가중치 (P1)
- [ ] `NAVER_TRACK_WEIGHTS_V3_1["ACTIVE"]["ai_briefing_score"]` = 0.25
- [ ] `NAVER_TRACK_WEIGHTS_V3_1["LIKELY"]["ai_briefing_score"]` = 0.15
- [ ] `NAVER_TRACK_WEIGHTS_V3_1["INACTIVE"]["ai_briefing_score"]` = 0.00
- [ ] `_validate_v3_1_weights()` 자동 합계 1.0 검증 통과
- [ ] `SCORE_MODEL_VERSION` 환경변수: 운영 서버 `.env` 확인 (미설정 시 v3_0 안전 기본값)

### 2.5 `/qna` 폐기 잔재 0건 (P0)
- [ ] `goto(.*qna`, `href.*qna`, `deeplink.*qna` 실제 네트워크 호출 0건 (주석은 폐기 사유 명시 허용)
- [ ] `_SMARTPLACE_PATHS["faq"]` 키 제거 확인
- [ ] `_detect_faq()` 호출 0건
- [ ] 사용자 노출 deeplink `/qna` 사용 0건 → `/profile`로 교체

### 2.6 has_faq 25점 → 소식·소개글 재배분 (P1)
- [ ] `calc_smart_place_completeness()` 합계 100점 보존: 등록 25 + 순위 30 + 소식 25 + 소개글 20
- [ ] `has_faq` 가중치 0점이지만 DB 컬럼은 보존 (`businesses.has_faq` graceful fallback)
- [ ] UI 체크박스 제거됨 (사용자 노출 0건)

### 2.7 톡톡 채팅방 메뉴 (P2)
- [ ] 명칭 일관: 17개 사용자 화면 "톡톡 FAQ" → "톡톡 채팅방 메뉴"
- [ ] `chat_menus[].link_type: "message" | "url"` 사양
- [ ] `_compat_chat_menus()` + `normalizeChatMenus()` 하위 호환 동작
- [ ] `partner.talk.naver.com` URL 오타 없음

### 2.8 5단계 가이드 톤 (P2)
- [ ] `/guide/ai-info-tab` 5단계 가이드 ACTIVE/LIKELY/INACTIVE 톤 분기
- [ ] 사이드바 진입점 카드 2종 (AI 브리핑·AI탭) 명확 분리
- [ ] 단정 표현 "직접 인용" 사용자 노출 화면 0건

---

## 3. 네이버 AI탭 (모든 업종 베타)

> **사고 패턴**: AI 브리핑 업종 제한을 AI탭에도 잘못 적용 → INACTIVE 업종 "내 업종은 AI에서 안 됨" 오해 이탈.

### 3.1 게이팅 분리 (P0)
- [ ] `get_ai_tab_eligibility(category)` 항상 `"beta"` 반환 (업종 무관)
- [ ] 호출처 전수 grep — 업종 분기 적용 0건
- [ ] `briefing_eligibility` ≠ `ai_tab_eligibility` 변수명 분리 일관 (`dashboard/page.tsx` 두 변수 분리 확인)

### 3.2 용어 분리 UI (P0)
- [ ] "AI탭"(검색결과 화면) vs "AI 정보 탭"(스마트플레이스 내부 메뉴) 혼용 0건
- [ ] `AiInfoTabStatusCard` 제목 "네이버 AI 브리핑 노출 설정" 명시
- [ ] `AiTabPreviewCard` 헤더 "네이버 AI탭 답변 미리보기 + 검색결과 AI탭·베타·모든 업종" 부제
- [ ] 랜딩 §4-B 2-컬럼 비교 표 (AI 브리핑 vs AI탭) 존재

### 3.3 NaverAiPathwayCard (P1)
- [ ] INACTIVE 업종에도 AI탭 경로 안내 표시
- [ ] 자기 업종 자동 배지 (ACTIVE/LIKELY/INACTIVE/franchise 분기)
- [ ] DashboardInsightZone 상단 위치

### 3.4 simulate_ai_tab_answer() 시뮬레이션 (P1)
- [ ] `briefing_engine.simulate_ai_tab_answer()` 함수 존재 확인 (라인 번호 참조 금지 — 코드 변경 시 스테일)
- [ ] 반환 dict의 `data_source`: `"measured"` | `"estimated"`
- [ ] `confirmed_in_ai_tab`: bool (measured일 때만 신뢰)
- [ ] `AiTabPreviewCard.tsx`가 `data_source` 받아 배지 분기 렌더링
- [ ] `estimated` 시 면책 문구 자동 표시 — "측정 시점·기기·로그인 상태에 따라 달라질 수 있음"

### 3.5 ai_tab_context 키워드 그룹 (P2)
- [ ] 60개 업종 전부 `ai_tab_context` 그룹 존재 (시뮬레이션 전용, weight 0.05)
- [ ] weight 0.05 모든 업종 동일 — 점수 무영향 의도 유지
- [ ] Group D 10개 업종 매핑 완성 (M2 작업)

### 3.6 `/guide/ai-tab` 가이드 (P1)
- [ ] "모든 업종 가능 (2026-04-27 베타)" 명시
- [ ] 5항목 가이드: 소개글·사진·예약·리뷰·블로그 UGC
- [ ] `ai_tab_checklists.py` 25종 단일 소스 매핑
- [ ] 광고 공지 배너 — `ad_only=true` 시 점수 제외 안내

### 3.7 AI탭 광고영역 ad_only 플래그 (P1)
- [ ] 전역 플래그 `in_ai_tab` / `ad_only` 신설 확인 (M1 작업)
- [ ] `ad_only=true` 노출 → 점수 산정 제외 로직
- [ ] 사용자 화면 광고영역 경고 UI

### 3.8 P2 미구현 명시 (P3)
- [ ] `naver_ai_tab_scanner.py` 미구현 상태 사용자 화면에 "실측 미구현 — 추정값" 라벨
- [ ] 6월 AI탭 전체 확대 트리거 확인 명령 주 1회 실행 (CLAUDE.md §"시기 의존 작업")

---

## 4. ChatGPT 측정 차별성 (학습 데이터 한계 면책)

> **사고 패턴**: ChatGPT 학습 데이터에 없는 소상공인 → `mentioned=False` 과다 → 사용자 "내 가게 ChatGPT에 안 나옴" 오해.

### 4.1 면책 문구 전수 확인 (P0)
- [ ] 17개 ChatGPT 노출 화면 모두 다음 문구 포함:
  > "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- [ ] 화면별 grep 누락 0건 (ChannelScoreCards, ChatGPTDiffCard, AICitationCard, DualTrackCard, ChatGPTCompareSection 등)
- [ ] 면책 문구 위치: ChatGPT 점수/결과 표시 직하 또는 카드 footer

### 4.2 50/50 분할 Basic 자동 (P1)
- [ ] `chatgpt_scanner.sample_n(n=50)` 구현 확인
- [ ] `gemini_scanner.sample_n(n=50)` 구현 확인
- [ ] Basic 자동: Gemini 50 + ChatGPT 50 + Naver 병렬
- [ ] Quick: ChatGPT 5 + Naver
- [ ] Full: Gemini 100 + ChatGPT 100 + Naver + Google
- [ ] Trial: Gemini 10 (비로그인 IP 해시 + 분당 10회)

### 4.3 calc_multi_ai_exposure 재배분 (P1)
- [ ] `score_engine.py:575` sample_size 자동 처리 (50/100/boolean 모두 호환)
- [ ] 점수: Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분
- [ ] boolean 폴백 유지 (Quick 모드)

### 4.4 queries_used 응답 포함 (P2)
- [ ] Gemini·ChatGPT 결과 dict에 `queries_used` 배열 포함
- [ ] 어떤 3변형 쿼리로 측정했는지 사용자에게 노출 가능 상태

### 4.5 Wilson 95% 신뢰구간 (P3 — 출시 후)
- [ ] `confidence.lower / upper` 반환
- [ ] UI에 "95% CI" 표기 (Pro+ 노출 또는 PDF 보고서)
- **⚠️ 출시 전 불필요**: `project_quant_methods.md` 기준 베타 10명+ 이후 도입. 출시 체크 대상 아님.

### 4.6 쿼리 3변형 분산 (P1)
- [ ] `scan.py` `_scan_queries`: 지역 有 → ["{지역} {키워드} 추천","{지역} {키워드}","{키워드} 잘하는 {지역}"]
- [ ] 지역 無 → ["{키워드} 추천","{키워드}","{키워드} 잘하는 곳"]
- [ ] Playwright(naver·google): `_scan_queries[0]` 첫 쿼리만 사용
- [ ] API 스캐너(Gemini·ChatGPT): 전체 리스트 전달 → 내부 `divmod` 균등 분산

### 4.7 ChatGPTDiffCard 차별화 메시지 (P1)
- [ ] "ChatGPT는 학습 데이터 기반 vs 네이버는 실시간 검색" 차이 명확 설명
- [ ] 사용자 행동 가이드 (블로그 작성·JSON-LD 등) 업종별 분기

### 4.8 N/A 폴백 (P0)
- [ ] ChatGPT API 실패 시 0 또는 N/A 표시 (`Math.random()` 호출 0건)
- [ ] `mentioned=False` 100% 시 사용자 화면 — 0점 + 면책 + "ChatGPT 학습 데이터 미반영" 안내

### 4.9 ChannelDifferentiationCard (P2)
- [ ] 4개 채널(네이버·ChatGPT·Gemini·Google) 차별화 매트릭스 노출
- [ ] 업종별 우선 채널 표시 (`DUAL_TRACK_RATIO` 기반)

---

## 5. 업종별 콘텐츠 최적화 (D.I.A. 5요소)

### 5.1 keyword_taxonomy weight 합계 1.0 검증 (P0)
- [ ] 60개 업종 각 그룹 weight 합계 1.0 자동 검증 (시작 시 assertion)
- [ ] `ai_tab_context` 그룹 weight 0.05 일관 (점수 무영향 유지)

### 5.2 업종별 키워드 그룹 ≥ 5 (P1)
- [ ] restaurant 6그룹: 접근편의·단체모임·분위기상황·동반자조건·메뉴특장점·운영정보
- [ ] cafe 6그룹: 공간분위기·음료메뉴·이용목적·동반자조건·운영정보·ai_tab_context
- [ ] accommodation 6그룹: facility·room·dining·activity·value·ai_tab_context (4그룹 재편 후)
- [ ] medical/legal/education 등 INACTIVE 업종 5그룹 이상 확인
- [ ] WHITELIST 59개 업종 키워드 매핑 (M1 작업)

### 5.3 D.I.A. 5요소 강제 (P1)
- [ ] `guide_generator.py` 가이드 생성 시 D.I.A. 5요소 프롬프트 강제
- [ ] `content_validator.py:33` 정규식 적시성 인식 정상 (한 차례 사고 수정 후 유지)
- [ ] 사후 검증 0~100점 (AI 호출 0회) — 실측 90.0 이상

### 5.4 LSI 연관키워드 (P2)
- [ ] 가이드 생성 시 LSI 자연 배치 (템플릿 복붙 금지 검증)
- [ ] 업종별 LSI 사전 존재 (taxonomy 기반)

### 5.5 적시성 표기 (P2)
- [ ] 가이드·소식·블로그 템플릿에 `[YYYY년 M월 업데이트]` 자동 삽입
- [ ] 14일 미작성 시 `inactive_post_alert_job` 카카오 알림

### 5.6 FAQ 30~60자 즉답형 (P2)
- [ ] FAQ 생성기 (`/api/guide/{biz_id}/smartplace-faq`) 답변 길이 검증
- [ ] 월 한도: Free 0 / Basic 5 / Pro 무제한 / Biz 무제한

### 5.7 ai_tab_checklists.py 25종 (P2)
- [ ] 업종별 AI탭 체크리스트 단일 소스 통일
- [ ] `AiTabPreviewCard`·`AiInfoTabGuide` 두 곳 모두 동일 소스 사용

### 5.8 사진 카테고리 9업종 (P2)
- [ ] `photo_categories.py` 9업종 × 3~4 카테고리 단일 소스
- [ ] 백 9업종 = 프 9업종 mirror
- [ ] `_parse_photo_categories()` + `scan_results.photo_categories JSONB`
- [ ] `PhotoCategoryCard.tsx` 진단 노출

### 5.9 블로그 C-rank 추정 (P2)
- [ ] `blog_analyzer.py` 결과 → `blogMentionCount` Track1 점수 반영
- [ ] `AiTabPreviewCard`·`AiInfoTabGuide` 블로그 UGC 가이드 노출

---

## 6. 스캐너 4종 운영 안정성

### 6.1 Gemini 2.0 Flash (P1)
- [ ] `gemini_scanner.py` `sample_n(n=50/100)` 정상
- [ ] API 키 `GEMINI_API_KEY` 환경변수 로드
- [ ] 타임아웃·재시도 정책 (HTTP 5xx, rate limit)
- [ ] `queries_used` 반환

### 6.2 ChatGPT GPT-4o-mini (P1)
- [ ] `chatgpt_scanner.py` `sample_n(n=50/100)`, `sample_5()` 정상
- [ ] `OPENAI_API_KEY` 환경변수 로드
- [ ] mentioned 정규식 robustness (사업장명·지역 변형)

### 6.3 네이버 Playwright (P0)
- [ ] `naver_scanner.py` Playwright launch 옵션 `--no-sandbox --disable-dev-shm-usage`
- [ ] `Semaphore(2)` 적용 (RAM 4GB 보호)
- [ ] CAPTCHA 감지 시 graceful fallback (`_is_google_captcha()` 패턴 유사 적용)
- [ ] 네이버 AI 브리핑 DOM 셀렉터 변경 대응 (월 1회 회귀 테스트)

### 6.4 Google Playwright 제거 상태 (P2)
- [ ] `screenshot.py` Google 캡처 블록 제거 완료 확인 (2026-05-14)
- [ ] `_is_google_captcha()` 감지 함수 유지 (재도입 시 재활용)
- [ ] 재도입 트리거: 구독자 50명 이후 DataForSEO Screenshot API 도입 계획

### 6.5 daily_scan_all (P1)
- [ ] 야간 자동 스캔 → `ai_citations` INSERT 추가 (2026-05-04 적용)
- [ ] 스캔 결과 → `scan_results.competitor_scores`, `track1/track2/unified_score`

### 6.6 SSE 진행률 (P1)
- [ ] `POST /api/scan/stream/prepare` → `stream_token` 60초 OTP
- [ ] `GET /api/scan/stream?stream_token=` 토큰 검증
- [ ] Nginx `/api/` `proxy_buffering off` 설정 확인

### 6.7 Trial 스캔 (P0)
- [ ] `POST /api/scan/trial` IP 해시 + 분당 10회 제한
- [ ] Gemini 10회 (Full 100회와 분리)
- [ ] `place_data` JSONB + `smart_place_check` 저장
- [ ] 공개 누적 체험 카운터 `GET /api/scan/trial-count`
- [ ] **INACTIVE 업종 trial 결과 화면 분기** — 글로벌 AI(ChatGPT·Gemini) 강조 + 네이버 AI 브리핑 비대상 안내가 trial 결과 컴포넌트에서 실제로 분기되는지 확인

---

## 7. 점수 모델 v3.0/v3.1/v3.2 3중 동거

> **위험**: 운영 서버 환경변수 미설정 시 v3.0 안전 기본값. v3.1/v3.2 토글 시 즉시 점수 급변 위험.

### 7.1 SCORE_MODEL_VERSION 환경변수 (P0)
- [ ] 운영 서버 `.env`에 미설정 → v3_0 기본값 (안전)
- [ ] `v3_1` 활성화 조건: 베타 구독자 5명+ 확보 후
- [ ] `v3_2` 활성화 조건: 자동 트리거 또는 수동 토글
- [ ] 로그 `[P3-READY]` WARNING 감지 시 환경변수 전환

### 7.2 v3.0 NAVER_TRACK_WEIGHTS 합계 1.0 (P0)
- [ ] keyword_gap 0.35 + review 0.25 + smart_place 0.15 + naver_exposure 0.15 + kakao 0.10 = 1.00

### 7.3 v3.1 그룹별 6항목 (P1)
- [ ] `NAVER_TRACK_WEIGHTS_V3_1["ACTIVE"]` 합계 1.0
- [ ] `["LIKELY"]` 합계 1.0
- [ ] `["INACTIVE"]` 합계 1.0
- [ ] `_validate_v3_1_weights()` 모듈 import 시 자동 검증

### 7.4 v3.2 AI탭 항목 추가 (P1)
- [ ] `NAVER_TRACK_WEIGHTS_V3_2` Group A/B/C/D별 차별화
- [ ] `_validate_v3_2_weights()` 자동 합계 1.0 검증

### 7.5 GLOBAL_TRACK_WEIGHTS 합계 1.0 (P0)
- [ ] `multi_ai_exposure` 0.40 + `schema_seo` 0.30 + `online_mentions` 0.20 + `google_presence` 0.10 = 1.00
  > ⚠️ 코드 실제 키명: `online_mentions`(mentions 아님), `google_presence`(google 아님) — grep 시 정확한 키명 사용

### 7.6 DUAL_TRACK_RATIO 합계 1.0 (P0)
- [ ] ~60개 업종(직접 키 ~54개 + alias 경유 ~3개) 각 naver+global = 1.00
- [ ] `DEFAULT_DUAL_TRACK_RATIO` 60/40 fallback 정상 동작

### 7.7 GrowthStage 기준 (P1)
- [ ] 판정 기준 `track1_score` (unified 아님 — 업종 비율 차이 오판 방지)
- [ ] dashboard·preview·trial 일관

### 7.8 keyword_gap cold start (P2)
- [ ] 첫 스캔 시 리뷰 데이터 부재 → 블로그 자동 추출
- [ ] 블로그도 없으면 fallback 30.0
- [ ] cold start 시 사용자 화면 "(추정)" 라벨 노출

---

## 8. UI / 모바일 / PC 가독성

### 8.1 PC/모바일 별개 페이지 (P1)
- [ ] 핵심 페이지 4종(랜딩·대시보드·trial·guide) PC·모바일 라우팅 분리
- [ ] `text-xs` → `text-sm` 이상 (가독성)
- [ ] `p-8` 고정 → `p-4 md:p-8` 반응형 패딩
- [ ] Touch target 최소 44px

### 8.2 그룹별 배너 (P1)
- [ ] ACTIVE 녹색 / LIKELY 파랑 / INACTIVE 황색 / franchise 보라
- [ ] 7일 INACTIVE 배너 (M1) 정상 표시
- [ ] 모바일 floating CTA `safe-area-inset-bottom`

### 8.3 사이드바 메뉴 (P2)
- [ ] "AI 브리핑 5단계 가이드" (ACTIVE/LIKELY만 노출)
- [ ] "AI탭 가이드" (전 업종 노출)
- [ ] 모바일 햄버거 nav 정상

### 8.4 ChannelScoreCards (P1)
- [ ] **5개** 채널 카드 (네이버 AI 브리핑·AI탭·ChatGPT·Gemini·Google)
- [ ] 면책 문구 footer 일관

### 8.5 NaverAiPathwayCard (P1)
- [ ] AI 브리핑 vs AI탭 2-컬럼 비교
- [ ] 자기 업종 배지 자동
- [ ] 클릭 시 각 가이드 페이지 이동

---

## 9. 실측·사실 원칙

> **사고 패턴**: 히어로 섹션 가짜 수치(과거 사고). 재발 방지 필수.

### 9.1 더미·임의 추정 수치 0건 (P0)
- [ ] 프론트 전체 `Math.random()` 호출 grep — 사용자 노출 코드 0건
- [ ] 하드코딩 점수·키워드 순위 노출 0건 (베타 후기 placeholder 제외)

### 9.2 빈 상태 표준 (P1)
- [ ] "아직 데이터 없음 — 첫 스캔 후 표시" 일관
- [ ] 비로그인 트라이얼 결과 후 가입 유도 CTA

### 9.3 API 실패 폴백 (P0)
- [ ] 점수·키워드·인용 모든 변동 데이터 — API 실패 시 0 또는 N/A
- [ ] 무작위 숫자 폴백 0건

### 9.4 추정 라벨 (P1)
- [ ] `(추정)` 회색 라벨 + 근거 1줄
- [ ] `simulate_ai_tab_answer` `data_source: "estimated"` 시 자동 적용

### 9.5 면책 문구 표준 5종 (P1)
- [ ] "측정 시점·기기·로그인 상태에 따라 달라질 수 있음" (변동 데이터 전반)
- [ ] "ChatGPT 측정은 AI 학습 데이터 기반..." (ChatGPT 전용)
- [ ] "프랜차이즈는 네이버 AI 브리핑 대상에서 제외됩니다 (본사 정책)"
- [ ] "AI탭은 2026-04-27 베타, 모든 업종 대상"
- [ ] "측정 결과 검증 후 추가 콘텐츠 작성 권장"

### 9.6 사용자 입력 즉시 반영 (P2)
- [ ] 키워드·스마트플레이스·소개글 입력 → 사업장 정보·점수·매뉴얼·트라이얼·보고서 5곳 동기

---

## 10. DB / 마이그레이션

### 10.1 v4.1 ALTER 5건 (P0) — ✅ 완료 (2026-05-19 실DB 직접 확인)
- [x] `businesses.is_franchise BOOLEAN` 적용
- [x] `naver_intro_draft TEXT` + `naver_intro_generated_at TIMESTAMPTZ` 적용
- [x] `talktalk_faq_draft JSONB` + `talktalk_faq_generated_at TIMESTAMPTZ` 적용

### 10.2 v3.x/v5.x ALTER (P1)
- [ ] `scan_results.keyword_ranks JSONB`, `measurement_context JSONB`, `blog_crank_score`, `photo_categories JSONB`
- [ ] `score_history.keyword_rank_avg/blog_crank_score/user_group_snapshot`
- [ ] `businesses.user_group TEXT`, `last_post_at TIMESTAMPTZ`
- [ ] `profiles.keyword_suggest_count_month/reset_at`, `last_dashboard_visit`, `intro_draft`
- [ ] `notifications.keyword_change_payload JSONB`
- [ ] `trial_scans.claimed_at/claim_email/converted_user_id`

### 10.3 graceful fallback (P1)
- [ ] 모든 신규 컬럼 미적용 시 graceful fallback 동작 (KeyError 발생 0건)
- [ ] `Supabase Storage delivery-materials` 버킷 존재 확인

### 10.4 RLS 정책 (P1)
- [ ] `businesses`, `scan_results`, `competitors`, `ai_citations` RLS 적용
- [ ] Service role 우회 경로만 admin API 사용

---

## 11. 가이드 생성 / AI 호출 비용

### 11.1 Claude Sonnet 가이드 (P1)
- [ ] `POST /api/guide/generate` D.I.A. 5요소 프롬프트 강제
- [ ] `content_validator.py` 사후 검증 — 90점 이상 통과
- [ ] 업종별 톤 분기 (ACTIVE/LIKELY/INACTIVE)

### 11.2 Claude Haiku FAQ·감정 (P2)
- [ ] FAQ 월 한도: Free 0 / Basic 5 / Pro 무제한 / Biz 무제한
- [ ] 감정 분석 1h 캐시
- [ ] `KEYWORD_SUGGEST_MODEL=claude-haiku-4-5-20251001`

### 11.3 photo_guide 9업종 (P2)
- [ ] 3~4 카테고리 모달 UI 정상
- [ ] 미지원 업종 404 처리

### 11.4 inactive_post_alert_job (P2)
- [ ] 14일 미작성 시 카카오 알림
- [ ] `businesses.last_post_at` graceful fallback

---

## 12. 스케줄러 / 자동화

### 12.1 ai_tab_trigger_check_job (P2)
- [ ] 월·목 09:00 KST 실행
- [ ] AI탭 노출 트리거 조건 자동 점검 + 카카오 알림

### 12.2 briefing_category_expansion_monitor_job (P2)
- [ ] 매월 1일 09:00 KST 실행
- [ ] LIKELY 업종 ACTIVE 승급 후보 감지 + 알림

### 12.3 daily_scan_all (P1)
- [ ] 야간 자동 스캔 정상
- [ ] `ai_citations` INSERT 정상

### 12.4 Claude 호출 잡 주의 (P2)
- [ ] `monthly_market_news_job` 구독자 수 비례 Claude 호출
- [ ] `weekly_post_draft_job` Claude 호출
- [ ] 비용 모니터링 — 50명 이상 시 비용 알림

### 12.5 P2 트리거 확인 (P3)
- [ ] AI탭 전체 확대 트리거 주 1회 수동 확인 (CLAUDE.md §"시기 의존 작업")
- [ ] `P3-READY` 로그 발생 시 알림

---

## 13. 결제 / 플랜 게이트

### 13.1 TOSS 키 분기 (P0)
- [ ] `TOSS_SECRET_KEY` 현재 test_ — 실결제 전 live_ 교체 필수
- [ ] 교체 후 pm2 restart

### 13.2 첫 달 50% 할인 (P1)
- [ ] 서버 재검증 `_is_first_time_subscriber()`
- [ ] 클라이언트 amount 조작 차단 (400 거부)
- [ ] `first_month_discount_until=today+30` 기록

### 13.3 PlanGate 누락 (P0)
- [ ] Basic+/Pro+/Biz+ 엔드포인트 플랜 한도 강제
- [ ] middleware/plan_gate.py 전수 확인
- [ ] 정상가·할인가 일치 (`prices.py` ↔ `plans.ts` ↔ `AdminDashboard.tsx` ↔ `webhook.py`)

### 13.4 멱등성 (P1)
- [ ] webhook 중복 호출 안전
- [ ] `subscriptions.grace_until` 만료 처리

### 13.5 결제 실패 복구 시나리오 (P1)
- [ ] 첫 결제 실패 시 `grace_until` 미부여 — 즉시 Free 상태 유지 확인
- [ ] 결제 실패 후 재구독 시 중복 빌링키 충돌 없음
- [ ] 실패 알림(카카오 또는 이메일) 발송 여부 확인
- [ ] `subscriptions.billing_key` null 상태에서 자동 재결제 잡이 실행 시 에러 없이 skip

---

## 14. 보안 / 일반 코드 품질

### 14.1 supabase-py 패턴 (P0)
- [ ] `if not res:` 금지 (항상 truthy) → `if not (res and res.data):`
- [ ] `res.data[0]` 사용 (NOT `res[0]` or `res.get()`)
- [ ] 소유권 검증 우회 0건 (2026-04-14 사고 재발 방지)

### 14.2 except 패턴 (P1)
- [ ] `except Exception: pass` → `_logger.warning()` 교체
- [ ] silent pass 0건 (2026-05-18 P2 수정 완료, 회귀 검증)

### 14.3 SELECT * (P2)
- [ ] 필요 필드만 명시 (성능)
- [ ] `ilike("%region%")` → `ilike("region%")` 접두어 매칭

### 14.4 PII 로깅 (P0)
- [ ] 이메일·전화번호 평문 로깅 0건
- [ ] Sentry 또는 file log 마스킹

### 14.5 open redirect (P0)
- [ ] `next` 파라미터 검증 — 외부 URL 거부
- [ ] CORS `allow_methods` 명시 5개 (GET/POST/PUT/DELETE/OPTIONS)

### 14.6 Rate Limit (P1)
- [ ] 공개 API 전체 적용 (`/api/scan/trial`, `/api/scan/trial-search`, `/api/scan/trial-count`)
- [ ] IP 해시 기반 분당 10회

### 14.7 CSV injection (P1)
- [ ] `_csv_safe()` 적용
- [ ] RFC 5987 Content-Disposition (한글 파일명)

### 14.8 api_keys SHA256 해시 저장 (P1)
- [ ] `api_keys` 테이블에 키 원문 미저장 확인 — SHA256 해시만 저장되는지 검증
- [ ] `POST /api/v1/keys` 키 생성 시 원문 1회 노출 후 해시만 DB 저장
- [ ] 검증 시 `hashlib.sha256(input_key).hexdigest()` 비교 경로 확인

---

## 15. 운영 / 배포 / 검증

### 15.1 SSH 검증 의무 (P0)
- [ ] 모든 에이전트 위임 후 메인 세션 직접 grep 1줄+ 확인
- [ ] 거짓 보고 발견 시 즉시 메인 세션 직접 수정
- [ ] 잠재 root flat 잔재 파일 점검 (`backend/<file>.py` vs `backend/routers/<file>.py`)

### 15.2 PM2 안정성 (P0)
- [ ] `pm2 logs aeolab-backend --lines 60 --nostream` error 0건
- [ ] `pm2 logs aeolab-frontend --lines 60 --nostream` error 0건
- [ ] 두 프로세스 online

### 15.3 Playwright Semaphore (P1)
- [ ] `Semaphore(2)` 유지 (서버 업그레이드 전)
- [ ] 환경변수 분리 `BACKEND_MAX_CONCURRENCY=2`

### 15.4 카카오 알림톡 (P1)
- [ ] 5종 승인 완료 (SCORE·CITE·COMP·NEWS·ACTION)
- [ ] `AEOLAB_KW_01` 미승인 상태 graceful skip
- [ ] `kakao_notify.TEMPLATES` dict 매핑 일관

### 15.5 GA4 (P1)
- [ ] G-KCZTWYK7QV 라이브
- [ ] 핵심 funnel: trial_complete / signup_complete / subscription_active
- [ ] Phase A: keyword_input / recommend_click / measure_start / measure_complete

### 15.6 SSL / Nginx (P0)
- [ ] aeolab.co.kr SSL 정상
- [ ] SSL 인증서 만료 잔여일 확인:
  ```bash
  echo | openssl s_client -connect aeolab.co.kr:443 2>/dev/null | openssl x509 -noout -dates
  ```
- [ ] `/api/` SSE 위해 `proxy_buffering off`

### 15.7 환경변수 필수 키 전체 로드 확인 (P1)
- [ ] 서버 `.env` vs `.env.example` 키 목록 동기화 (누락 키 0건)
- [ ] 필수 AI 키 존재 확인: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- [ ] 필수 결제/알림 키 존재: `TOSS_SECRET_KEY`, `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_REST_API_KEY`
- [ ] 필수 인프라 키: `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- [ ] 키 미설정 시 서버 시작 단계에서 즉시 오류 발생 여부 확인 (무음 실패 방지)

---

## 16. 점검 진행 방법

### 16.1 자동 라우팅
1. 점검 → `code-review` 에이전트 (§1~§16 영역별 병렬)
2. 발견 문제 P0~P3 분류 + `파일경로:라인번호` 명시
3. 수정 → 영역별 에이전트 자동 (backend-dev / frontend-dev / db-migrate / scan-engine)
4. 재검증 → `code-review` 재발동 High 이슈 0건 확인
5. 배포 → `deploy` 에이전트 + SSH 검증

### 16.2 우선순위
| 등급 | 정의 | 처리 시점 |
|------|------|----------|
| P0 | 보안·기능 차단·데이터 오염 | 즉시 |
| P1 | UX 깨짐·플랜 한도 미적용·일관성 큰 항목 | 같은 세션 |
| P2 | 안내문·면책·매뉴얼 보강 | 같은 세션 또는 다음 |
| P3 | 코드 스타일·미세 가독성 | 다음 스프린트 |

### 16.3 보고 형식 (필수)
- 각 항목 ✅ 통과 / ⚠️ 보강 필요 / ❌ 즉시 수정
- 발견 문제: **단정 근거 file:line + 반증 시도 file:line** 각 1라인 첨부 (2026-05-18 문제 분류 검증 의무)
- 600단어 이내 (영역별)

---

## 17. 점검 후 사용자 직접 액션

| 작업 | 시점 |
|------|------|
| DB 마이그레이션 ALTER (Supabase SQL Editor) | §10 발견 미적용 컬럼 |
| `TOSS_SECRET_KEY` test_ → live_ 교체 | 실결제 전환 시 |
| `SCORE_MODEL_VERSION=v3_1` 활성화 | 베타 5명+ 데이터 검증 후 |
| `SCORE_MODEL_VERSION=v3_2` 활성화 | `[P3-READY]` 로그 발생 시 |
| 카카오 비즈센터 `AEOLAB_KW_01` 신청 | 키워드 알림 활성화 시 |
| AI탭 전체 확대 트리거 확인 | 6월 네이버 공식 확대 후 |
| 베타 후기 실데이터 교체 (`lib/testimonials.ts`) | Phase 0 인터뷰 1~3명 확보 후 |

---

## 18. 점검 결과 기록란

| # | 영역 | 결과 | P0 | P1 | P2 | P3 |
|---|------|------|----|----|----|----|
| §1 | 카테고리 단일 소스 | | | | | |
| §2 | AI 브리핑 분기 | | | | | |
| §3 | AI탭 베타 | | | | | |
| §4 | ChatGPT 차별성 | | | | | |
| §5 | 업종별 콘텐츠 D.I.A. | | | | | |
| §6 | 스캐너 4종 | | | | | |
| §7 | 점수 모델 3중 동거 | | | | | |
| §8 | UI 가독성 | | | | | |
| §9 | 실측 원칙 | | | | | |
| §10 | DB 마이그레이션 | | | | | |
| §11 | 가이드 생성 | | | | | |
| §12 | 스케줄러 | | | | | |
| §13 | 결제·플랜 | | | | | |
| §14 | 보안·일반 | | | | | |
| §15 | 운영·배포 | | | | | |
| **합계** | | | | | | |

---

*최종 업데이트 2026-05-19 | v2.1 — 오판 4건 수정(§1.3 완료확인·§4.5 P3강등·§8.4 오기·§10.1 완료표기) + 누락 7건 추가(yoga DUAL_TRACK 코드수정·§1.4 커버리지·§6.7 trial분기·§7.5 키명·§13.5 결제복구·§14.8 API키해시·§15.7 환경변수·§15.6 SSL만료일) + yoga score_engine.py 실코드 수정*
*다음 갱신 트리거: 점수 모델 v3.2 활성화·AI탭 스캐너 P2 구현·신규 업종 추가·네이버 사양 변경*
