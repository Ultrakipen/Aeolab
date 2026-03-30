# AEOlab — 개발 참고 문서

> AI Engine Optimization Lab: 한국 소상공인을 위한 AI 검색 사업장 성장 플랫폼
> 기획서 v7.2 / 개발문서 v1.2 기준 | 1인 개발 | 로컬 → iwinv 서버 이전 예정

---

## 프로젝트 개요

**서비스 핵심:** 경쟁 사업체를 분석해 평가 기준을 만들고, 그 기준으로 내 사업장을 진단하여 AI 검색 노출 개선 방안을 제공

**3대 사용자:** 소상공인(사업장 성장) / 시장 조사자(업종 분석) / 예비 창업자(시장 조사)

**수익 모델:** 월정액 구독 (Basic 9,900원 / Pro 29,900원 / Biz 79,900원)

**BEP:** 구독자 20명 (월 비용 약 8만원)

---

## 기술 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 프론트엔드 | Next.js | 14 App Router | SSR/SEO |
| 프론트엔드 | Tailwind CSS | 3.x | |
| 프론트엔드 | shadcn/ui | latest | |
| 프론트엔드 | Recharts | 2.x | 대시보드 차트 |
| 백엔드 | Python FastAPI | 0.110+ | 포트 8000 |
| 백엔드 | Pydantic | v2 | |
| 백엔드 | APScheduler | 3.x | 크론잡 |
| 백엔드 | aiohttp | 3.x | AI API 비동기 호출 |
| DB | Supabase | Free Tier | PostgreSQL + Auth + Storage |
| AI 스캔 | Gemini Flash | gemini-1.5-flash | 100회 샘플링 (주력, 저비용) |
| AI 스캔 | OpenAI | gpt-4o-mini | ChatGPT 인용 확인 |
| AI 스캔 | Claude (스캐너) | claude-haiku-4-5 | 6번째 AI 플랫폼 노출 확인 |
| AI 스캔 | Claude (가이드) | claude-sonnet-4-6 | 한국어 개선 가이드 생성 전용 |
| AI 스캔 | Perplexity | llama-3.1-sonar | 출처 기반 검색 |
| AI 스캔 | Grok | grok-beta | 최신 정보 검색 |
| AI 스캔 | 네이버 AI 브리핑 | Playwright 파서 | 네이버 AI 브리핑 DOM 파싱 |
| AI 스캔 | Google AI Overview | Playwright 파서 | 구글 SGE 노출 확인 |
| 스크린샷 | Playwright | 1.44+ | Before/After 캡처 |
| 결제 | 토스페이먼츠 | v2 | 한국 표준 |
| 알림 | 카카오 비즈API | v2 | 알림톡 5유형 |
| 서버 (운영) | iwinv 단독형 | vCPU2/RAM4GB | Ubuntu 24.04 |
| 프록시 | Nginx | 1.24+ | 리버스 프록시 + SSL |
| 프로세스 | PM2 | 5.x | 운영 환경 |
| CI/CD | GitHub Actions | latest | main 브랜치 push 시 자동 배포 |

---

## 프로젝트 폴더 구조

```
aeolab/
  frontend/                   # Next.js 14 앱 (포트 3000)
    app/
      (public)/
        page.tsx              # 랜딩 페이지
        trial/page.tsx        # 무료 원샷 체험 (Phase 0 핵심 전환 UI)
        pricing/page.tsx      # 요금제
      (auth)/
        login/page.tsx
        signup/page.tsx
      (dashboard)/
        layout.tsx            # 대시보드 레이아웃 (인증 필요)
        dashboard/page.tsx    # 메인 대시보드
        competitors/page.tsx  # 경쟁사 관리
        guide/page.tsx        # 개선 가이드
        schema/page.tsx       # JSON-LD 생성
        history/page.tsx      # Before/After 히스토리
      api/
        webhook/              # 토스 결제 웹훅
    components/
      dashboard/
        ScoreCard.tsx         # AI 노출 점수 카드 (Hero 지표)
        RankingBar.tsx        # 경쟁사 비교 바 차트
        TrendLine.tsx         # 30일 추세선
        BeforeAfterCard.tsx   # 비포애프터 카드
      scan/
        ScanProgress.tsx      # 실시간 스캔 진행 SSE UI
        ResultTable.tsx       # AI별 노출 결과 표
    lib/
      supabase/client.ts
      supabase/server.ts
      api.ts                  # FastAPI 호출 래퍼
    types/index.ts
    middleware.ts             # 인증 미들웨어
  backend/                    # Python FastAPI (포트 8000)
    main.py
    routers/
      scan.py                 # AI 스캔 엔드포인트 (trial/full/stream)
      report.py               # 점수/리포트/before-after/ranking
      guide.py                # 개선 가이드 생성
      schema_gen.py           # JSON-LD 생성
      webhook.py              # 결제 웹훅 + 빌링키
      admin.py                # 관리자 대시보드 API
      business.py             # 사업장 CRUD
      competitor.py           # 경쟁사 CRUD
    services/
      ai_scanner/
        gemini_scanner.py     # Gemini Flash 100회 샘플링
        chatgpt_scanner.py    # OpenAI 인용 확인
        perplexity_scanner.py # Perplexity 출처 기반 검색
        grok_scanner.py       # Grok AI 최신 정보
        naver_scanner.py      # 네이버 AI 브리핑 Playwright 파서
        claude_scanner.py     # Claude AI 노출 확인 (haiku)
        google_scanner.py     # Google AI Overview Playwright 파서
        multi_scanner.py      # 8개 AI 병렬 실행 + SSE 진행률
      score_engine.py         # AI Visibility Score 계산
      guide_generator.py      # Claude Sonnet 가이드 생성 (system prompt 포함)
      schema_generator.py     # JSON-LD 자동 생성 (FAQ Schema 포함)
      screenshot.py           # Playwright 스크린샷 + build_queries
      before_after_card.py    # Pillow Before/After 카드 합성
      kakao_notify.py         # 카카오 알림톡 (5유형 + 구독 생애주기)
      toss_billing.py         # 토스 빌링키 발급 + 자동결제
    middleware/
      plan_gate.py            # 플랜별 기능 제한 + @require_plan
      rate_limit.py           # 월별 스캔 횟수 제한
    utils/
      logger.py               # JSON 구조화 로깅 (PM2 연동)
      error_handler.py        # @with_retry, @with_timeout 데코레이터
      alert.py                # Slack 웹훅 오류 알림
    models/                   # Pydantic 스키마
    db/supabase_client.py
    scheduler/jobs.py         # daily_scan + weekly_notify + subscription_lifecycle + after_screenshot
    requirements.txt          # Pillow, psutil 추가됨
  scripts/                    # 배포/유틸리티 스크립트
  .github/workflows/deploy.yml
  ecosystem.config.js         # PM2 설정
  .env.example
  CLAUDE.md                   # 이 파일
  docs/                       # 기획서 + 개발문서 원본
```

---

## 로컬 개발 환경

### 실행 방법
```bash
# 터미널 1: 프론트엔드
cd frontend && npm run dev      # http://localhost:3000

# 터미널 2: 백엔드
cd backend
source venv/bin/activate        # Windows: venv\Scripts\activate
uvicorn main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 환경 요구사항
- Node.js 20 LTS (현재: v20.18.0 ✅)
- Python 3.11+ (현재: 3.12.5 ✅)
- npm 11.x ✅

### Supabase 로컬 개발
- Supabase CLI 없이 → **Supabase Cloud Free Tier 직접 사용**
- 프로젝트 생성: https://supabase.com → 새 프로젝트
- `.env.local`에 URL + anon key 설정

---

## 환경변수 (.env.example 기준)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # 서버 전용 — 클라이언트 노출 금지

# AI API
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
GROK_API_KEY=xai-...

# 결제 (개발: test_ 접두사)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...

# 카카오 알림톡
KAKAO_APP_KEY=...
KAKAO_SENDER_KEY=...

# 네이버 지역 검색 API (경쟁사 지역 검색) — developers.naver.com → 검색 API → 즉시 발급
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...

# 카카오 로컬 API (승인 대기 중 — 승인 완료 시 병행 사용 가능)
KAKAO_REST_API_KEY=...

# 서버
BACKEND_URL=http://localhost:8000
SECRET_KEY=random-32-char-string
```

---

## 데이터베이스 테이블 (Supabase PostgreSQL)

| 테이블명 | 역할 |
|---------|------|
| users | Supabase Auth 연동 사용자 |
| businesses | 등록된 사업장 (category, region, keywords[]) |
| competitors | 경쟁사 목록 |
| scan_results | AI 스캔 결과 (gemini/chatgpt/perplexity/grok/naver/claude/zeta/google_result JSONB, competitor_scores JSONB) |
| ai_citations | AI 인용 실증 (platform, query, mentioned, excerpt) |
| score_history | 점수 시계열 (30일 추세용) |
| before_after | 스크린샷 Before/After |
| guides | 개선 가이드 |
| subscriptions | 구독 정보 (billing_key, customer_key, grace_until) |
| notifications | 알림 발송 이력 |
| profiles | 사용자 프로필 (phone — 카카오 알림용, 회원가입 트리거 자동 생성) |
| team_members | 팀 계정 (Biz: 5명, Enterprise: 20명) |
| api_keys | Public API 키 (Biz/Enterprise 전용, 최대 5개) |
| waitlist | 대기자 명단 (Phase 0) |
| trial_scans | 무료 체험 스캔 결과 (비로그인, IP 해시 저장, scan.py + report.py 참조) |

---

## AI Visibility Score 가중치

| 항목 | 가중치 |
|------|--------|
| AI 검색 노출 빈도 (100회 샘플링) | 30% |
| 리뷰 수·평점·키워드 다양성 | 20% |
| 웹 콘텐츠 구조화 (Schema JSON-LD) | 15% |
| 온라인 언급 빈도 | 15% |
| 정보 완성도 | 10% |
| 콘텐츠 최신성 | 10% |

---

## API 비용 관리 (구독자 20명 BEP 기준)

| API | 단가 | 월 예상 비용 | 용도 |
|-----|------|-------------|------|
| Gemini Flash | $0.10/1M tok | ~$2 | 100회 샘플링 주력 |
| OpenAI GPT-4o-mini | $0.15/1M tok | ~$1 | 인용 예시 확인만 |
| Claude Sonnet | $3/1M tok | ~$3 | 가이드 생성 시만 |
| Perplexity | $5/1M tok | ~$1 | 주 1회 체크 |
| 카카오 알림톡 | 건당 8~15원 | ~800원 | 변화 있을 때만 |
| iwinv 서버 | 27,800원/월 | 고정 | |
| **합계** | | **~8만원** | BEP 비용 구조 |

---

## 백엔드 API 엔드포인트

| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/scan/trial | 무료 원샷 스캔 (비로그인, Gemini만) |
| POST | /api/scan/full | 전체 8개 AI 병렬 스캔 (구독자) |
| POST | /api/scan/stream | 실시간 SSE 스캔 진행률 |
| GET | /api/scan/{id} | 스캔 결과 조회 |
| GET | /api/report/score/{biz_id} | AI Visibility Score |
| GET | /api/report/history/{biz_id} | 30일 점수 추세 |
| GET | /api/report/competitors/{biz_id} | 경쟁사 비교 분석 |
| GET | /api/report/before-after/{biz_id} | Before/After 스크린샷 목록 |
| GET | /api/report/ranking/{category}/{region} | 업종·지역 AI 노출 랭킹 TOP10 |
| GET | /api/report/benchmark/{category}/{region} | 업종 벤치마크 (평균·상위10%·분포) |
| POST | /api/guide/generate | 개선 가이드 생성 (Claude Sonnet) |
| GET | /api/guide/{biz_id}/latest | 최신 가이드 조회 |
| POST | /api/schema/generate | JSON-LD 자동 생성 |
| POST | /api/webhook/toss/confirm | 토스 결제 확정 + 구독 활성화 |
| POST | /api/businesses | 사업장 등록 (Before 스크린샷 자동 캡처) |
| GET | /api/businesses/me | 내 사업장 목록 |
| GET | /api/businesses/{id} | 사업장 조회 |
| PATCH | /api/businesses/{id} | 사업장 수정 |
| GET | /api/competitors/{biz_id} | 경쟁사 목록 |
| POST | /api/competitors | 경쟁사 등록 (플랜별 한도) |
| DELETE | /api/competitors/{id} | 경쟁사 삭제 |
| GET | /api/competitors/search?query=&region= | 카카오 로컬 API 지역 검색 |
| GET | /api/competitors/suggest/list | AEOlab 내 동종업계 추천 |
| GET | /api/report/export/{biz_id} | CSV 내보내기 (Pro+) |
| GET | /api/report/pdf/{biz_id} | PDF 리포트 (Pro+) |
| POST | /api/guide/ad-defense/{biz_id} | ChatGPT 광고 대응 가이드 (Basic+) |
| POST | /api/startup/report | 창업 시장 분석 리포트 (startup/biz+) |
| GET | /api/startup/market/{category}/{region} | 업종·지역 시장 현황 (공개) |
| GET | /api/teams/members | 팀 멤버 목록 (Biz+) |
| POST | /api/teams/invite | 팀원 초대 (Biz+) |
| DELETE | /api/teams/members/{id} | 팀원 제거 |
| GET | /api/v1/keys | API 키 목록 (Biz+) |
| POST | /api/v1/keys | API 키 발급 |
| DELETE | /api/v1/keys/{id} | API 키 폐기 |
| GET | /admin/stats | 관리자: 구독자·MRR·BEP 현황 |
| GET | /admin/subscriptions | 관리자: 구독자 목록 |
| GET | /admin/revenue | 관리자: 월별 매출 추이 |
| GET | /health | 서버·DB 상태 체크 (UptimeRobot) |

---

## 개발 Phase 체크리스트 (v1.3 기준)

### Phase 0 — 검증 (1~2주)
- [x] 랜딩 페이지 (업종/지역 입력 폼)
- [x] 무료 원샷 체험 (Gemini API 연결 + 이메일 수집)
- [x] Supabase 프로젝트 생성 + scripts/supabase_schema.sql 실행
- [x] .env.local / backend/.env 환경변수 설정
- [x] 엔드투엔드 체험 플로우 테스트 (trial 페이지)
- [ ] 소상공인 30명 현장 인터뷰
- [ ] 9,900원 YES 10명+ 확인 → Phase 1 착수 결정

### Phase 1 — MVP (3~10주)
- [x] Supabase Auth (이메일 회원가입/로그인 페이지)
- [x] 사업장 등록 폼 (RegisterBusinessForm + /api/businesses)
- [x] 8개 AI 멀티 스캔 엔진 (Gemini 100회 + ChatGPT/Perplexity/Grok/Naver/Claude/Zeta/Google)
- [x] 경쟁사 등록 + 경쟁사 관리 페이지 (카카오 로컬 검색 + 직접입력 + AEOlab 추천 3-방식)
- [x] AI Visibility Score 대시보드 (ScoreCard + RankingBar + TrendLine)
- [x] Before 스크린샷 자동 저장 (사업장 등록 시 자동 캡처)
- [x] 토스페이먼츠 결제 + 빌링키 발급 (자동갱신)
- [x] 플랜 제한 미들웨어 (PlanGate 컴포넌트 + plan_gate.py)
- [x] Rate Limiting (Nginx 설정 필요 + FastAPI 월별 한도)
- [x] Nginx Rate Limiting 서버 설정 적용
- [ ] 유료 구독자 20명 달성 (BEP)

### Phase 2 — v1.0 (11~24주)
- [x] Claude API 개선 가이드 자동 생성 (guide/page.tsx + system prompt)
- [x] Schema JSON-LD 자동 생성 (schema/page.tsx + FAQ Schema)
- [x] 카카오 알림톡 (구독 생애주기 + 5유형 스켈레톤)
- [x] APScheduler 크론잡 (새벽 2시 자동 스캔 + 구독 만료/갱신 + After 스크린샷)
- [x] After 스크린샷 + Before/After 카드 (Pillow 합성)
- [x] 30일 추세선 차트 (TrendLine + Recharts)
- [x] Before/After 히스토리 페이지
- [x] 관리자 대시보드 API (/admin/stats 등)
- [x] 카카오 알림톡 템플릿 5종 심사 신청 (심사 중 — 승인 후 KAKAO_APP_KEY·KAKAO_SENDER_KEY 입력 필요)
- [x] Pro 플랜 CSV 내보내기 (`/api/report/export/{biz_id}`)
- [x] PDF 리포트 (`services/pdf_generator.py`, reportlab)
- [x] 네이버 플레이스 통계 연동 (`services/naver_place_stats.py`, Playwright)
- [x] 카카오 4종 알림 스케줄러 자동화 (주간: ai_citation/competitor/action_items, 월간: market_news)
- [ ] 구독 100명, MRR 100만원 → 시드 IR

### Phase 3 — v1.5 (6~12개월)
- [x] 창업 패키지 경쟁 분석 리포트 (`services/startup_report.py`, `routers/startup.py`, `startup/page.tsx`)
- [x] 뤼튼(Zeta) AI 스캐너 추가 (`services/ai_scanner/zeta_scanner.py`, wrtn.ai Playwright)
- [ ] 소상공인 디지털 바우처 사업 등록
- [x] Biz 플랜 팀 5계정 기능 (`routers/teams.py`, `settings/team/page.tsx`)

### Phase 4 — v2.0 (12~18개월)
- [x] Public API 키 관리 (`routers/api_keys.py`, `settings/api-keys/page.tsx`)
- [ ] B2G 공식화 (지자체 MOU)
- [x] ChatGPT 광고 한국 도입 대응 가이드 (`services/ad_defense_guide.py`, `ad-defense/page.tsx`)

---

## 운영 서버 이전 시 주의사항

- **서버:** iwinv 단독형 vCPU2/RAM4GB, Ubuntu 24.04 LTS
- **도메인:** aeolab.co.kr
- **Playwright RAM:** 인스턴스 1개 = 300~500MB → 동시 2개 이상 금지, 큐 방식 순차 처리
- **CORS:** `allow_origins=['https://aeolab.co.kr','http://localhost:3000']`
- **Nginx:** `/api/` 경로는 SSE 스트리밍 위해 `proxy_buffering off` 필수
- **Phase 2+ 전환:** Vercel(Next.js) + Railway(FastAPI) 분리 (구독자 100명 이후)

---

## 카카오 알림톡 사전 준비

1. 카카오 비즈니스 채널 개설 → 알림톡 채널 신청
2. 알림톡 템플릿 5종 등록 및 심사 승인 (3~5 영업일 소요)
3. KAKAO_APP_KEY, KAKAO_SENDER_KEY 발급

**템플릿 코드:**
- `AEOLAB_SCORE_01` — 점수 변화
- `AEOLAB_CITE_01` — AI 인용 실증
- `AEOLAB_COMP_01` — 경쟁사 변화
- `AEOLAB_NEWS_01` — 시장 변화 뉴스
- `AEOLAB_ACTION_01` — 이달 할 일 목록

---

## 개발 원칙

- Phase 0~1은 **완벽한 코드보다 작동하는 제품** 우선
- 구독자 20명 BEP 달성 후 코드 품질·테스트·모니터링 체계화
- iwinv 단독 → Vercel+Railway 분리는 구독자 100명 이후 진행
- **비용 최적화:** 100회 샘플링은 Gemini Flash 주력, Claude는 가이드 생성 시만 호출

### 작업 기준 — 실제 서버 우선

> **모든 코드 수정·추가는 실제 서버에 직접 반영하는 것이 기준이다.**
> 로컬 환경은 서버와 동일하게 맞추기 위한 복사본이다.

- **서버 정보:** `root@115.68.231.57`, SSH 키 `~/.ssh/id_ed25519`
- **서버 경로:** `/var/www/aeolab/`
- **로컬 경로:** `C:/app_build/aeolab/`

**작업 순서:**
1. SSH로 서버 파일 직접 수정 또는 `scp`로 서버에 업로드
2. 프론트엔드 변경 시: 서버에서 `npm run build`
3. 재시작: `pm2 restart aeolab-frontend` / `pm2 restart aeolab-backend`
4. 서버 작업 완료 후 `scp 서버 → 로컬`로 동기화하여 로컬도 동일하게 유지

**테스트 URL:** `https://aeolab.co.kr` (로컬호스트 아님)

---

---

## 개발 중 발견된 사항 (트러블슈팅)

### Next.js 버전 이슈
- 현재 설치된 Next.js: **16.2.1** (개발문서 작성 기준은 14였으나 최신 버전으로 설치됨)
- Next.js 16에서 `middleware.ts` → **`proxy.ts`** 로 컨벤션 변경됨
- 함수명도 `middleware` → **`proxy`** 로 변경 필요
- `cookies()` 함수가 **async**로 변경됨: `const cookieStore = await cookies()`
- `lib/supabase/server.ts`의 `createClient()` 함수도 **async** 선언 필요

### Supabase Auth Helpers 패키지 변경
- `@supabase/auth-helpers-nextjs` → Deprecated
- 대신 `@supabase/ssr` 사용 (이미 적용됨)

### 패키지 설치 경로 (로컬)
- Python 가상환경: `backend_venv/` (프로젝트 루트)
- Windows 활성화: `backend_venv\Scripts\activate`
- pip 실행: `backend_venv/Scripts/pip install -r backend/requirements.txt`

### 버그 수정 이력 (v1.2 심화 감사)
- **`rate_limit.py`**: `scan_results.user_id` 없는 컬럼 조회 → `businesses` 테이블 통해 `business_id`로 조회하도록 수정
- **`scheduler/jobs.py`**: `daily_scan_all`에 `naver_result`, `claude_result` 저장 누락 → 추가; `score_history` upsert 누락 → 추가
- **`scheduler/jobs.py`**: After 스크린샷 Storage 버킷명 `before_after` → `before-after`로 통일 (screenshot.py와 일치)
- **`scripts/supabase_schema.sql`**: `subscriptions.grace_until DATE` 컬럼 누락 → 추가
- **`components/scan/ScanProgress.tsx`**: `allResults` 일반 변수 → `useRef` 변경 (Strict Mode 이중 effect 방지)
- **`lib/api.ts`**: `generateSchema()` 타입에 `opening_hours`, `description` 파라미터 누락 → 추가

### 신규 추가 파일 (v1.2)
- `backend/routers/settings.py` — GET/PATCH /api/settings/me, POST /api/settings/cancel
- `frontend/app/(dashboard)/settings/page.tsx` + `SettingsClient.tsx` — 구독 설정 페이지
- `frontend/app/(dashboard)/LogoutButton.tsx` — 로그아웃 버튼 클라이언트 컴포넌트
- `frontend/app/payment/success/page.tsx` — 토스 결제 성공 콜백
- `frontend/app/payment/fail/page.tsx` — 토스 결제 실패 페이지
- `frontend/app/admin/page.tsx` + `AdminDashboard.tsx` — 관리자 대시보드 UI
- `frontend/app/(public)/pricing/PayButton.tsx` — 토스 SDK 결제 버튼

### 추가 구현 완료 (v1.2 추가)
- **`scripts/supabase_schema.sql`**: `profiles` 테이블 + `handle_new_user` 트리거 추가 (카카오 알림용 phone 저장)
- **`backend/scheduler/jobs.py`**: `users(phone)` → `profiles(phone)` 조인 수정 (3개소)
- **`backend/routers/scan.py`**: `_save_scan_results`에 `weekly_change` 실제 계산 + `competitor_scores` 경쟁사 단일 Gemini 스캔으로 채움
- **`backend/routers/report.py`**: `GET /api/report/export/{biz_id}` — Pro+ CSV 내보내기 (utf-8-sig 한글 엑셀 호환)
- **`backend/routers/settings.py`**: PATCH 시 `profiles.phone` upsert + `businesses.phone` 동기화
- **`frontend/app/(dashboard)/history/ExportButton.tsx`**: Pro 플랜 전용 CSV 다운로드 버튼 클라이언트 컴포넌트
- **`frontend/app/(dashboard)/history/page.tsx`**: ExportButton 통합 (구독 플랜 조회 후 전달)
- **`frontend/app/(dashboard)/settings/SettingsClient.tsx`**: 카카오 알림 수신 번호 입력 UI 추가
- **`frontend/app/(dashboard)/settings/page.tsx`**: `profiles.phone` 조회 후 SettingsClient에 전달
- **`frontend/app/(dashboard)/dashboard/page.tsx`**: `competitor_scores`로 RankingBar 실제 데이터 반영
- **`frontend/lib/api.ts`**: `updatePhone()`, `exportReport()` 함수 추가
- **`backend/main.py`**: 버전 `1.1.0` → `1.2.0`

### 추가 구현 완료 (v1.4 — 시장 검토 반영)
- **`backend/routers/competitor.py`**: `GET /api/competitors/search` 추가 — 네이버 지역 검색 API 기반 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요, 일 25,000건 무료, 즉시 사용 가능)
- **`backend/routers/competitor.py`**: `GET /api/competitors/suggest/list` 추가 — AEOlab 내 동종업계 추천 (기존 등록 사업장 기반)
- **`backend/routers/report.py`**: `GET /api/report/benchmark/{category}/{region}` 추가 — 업종 평균·상위10%·분포
- **`frontend/app/(dashboard)/competitors/CompetitorsClient.tsx`**: 탭 UI 개편 — 지역 검색(카카오) / 직접 입력 / AEOlab 추천 3-방식
- **`frontend/app/(dashboard)/dashboard/page.tsx`**: 업종 벤치마크 카드 추가 (내 점수 vs 평균 vs 상위10%)
- **`frontend/app/(dashboard)/guide/GuideClient.tsx`**: 완료 체크리스트 추가 (localStorage 기반 진행률 바)

### 경쟁사 선정 기획 변경 이력
- **배경**: 네이버가 ChatGPT·Gemini·Claude 등 AI 봇 크롤링을 robots.txt로 전면 차단 (2023~2024 적용, 2025-07 공식 확인)
- **기존**: AEOlab 내 등록 사업장만 추천 (초기 데이터 부족 문제)
- **변경**: 카카오 로컬 API로 실제 지역 내 동종업체 검색 → 사용자가 직접 선택·등록
- **의미**: 소상공인에게 경쟁사 = 같은 지역의 같은 업종 → 카카오맵 데이터(한국 최대 POI DB)가 최적

### 신규 추가 파일 (v1.3 — Phase 3·4 구현)
- `backend/services/ai_scanner/zeta_scanner.py` — wrtn.ai Playwright 파서 (7번째 AI 플랫폼)
- `backend/services/pdf_generator.py` — reportlab PDF 리포트 생성 (한글 폰트 자동 탐지)
- `backend/services/startup_report.py` — 창업 패키지 경쟁 강도 분석 + Claude 진입 전략
- `backend/services/ad_defense_guide.py` — ChatGPT 광고 대응 가이드 (Claude Sonnet)
- `backend/services/naver_place_stats.py` — 네이버 플레이스 통계 Playwright 파서
- `backend/routers/startup.py` — POST /api/startup/report, GET /api/startup/market/{cat}/{region}
- `backend/routers/teams.py` — 팀 계정 CRUD (Biz: 5명, Enterprise: 20명)
- `backend/routers/api_keys.py` — Public API 키 발급/폐기 (SHA256 해시 저장)
- `frontend/app/(dashboard)/startup/page.tsx` — 창업 시장 분석 UI
- `frontend/app/(dashboard)/ad-defense/page.tsx` — ChatGPT 광고 대응 가이드 UI
- `frontend/app/(dashboard)/settings/team/page.tsx` — 팀 멤버 초대·관리
- `frontend/app/(dashboard)/settings/api-keys/page.tsx` — API 키 발급·폐기

### 남은 작업 (운영 환경)
- [x] Supabase Cloud 프로젝트 생성 + `scripts/supabase_schema.sql` 실행
- [x] `.env.local` / `backend/.env` 환경변수 설정
- [x] **`KAKAO_REST_API_KEY` 발급 및 설정** — 서버 `.env`에 적용 완료
- [x] Supabase Storage `before-after` 버킷 생성 (Public 읽기 설정 확인 완료)
- [x] 카카오 알림톡 템플릿 5종 심사 신청 완료 (심사 중)
- [x] Nginx Rate Limiting 설정 (`limit_req_zone` + `/api/scan/trial` 적용 완료)
- [x] iwinv 서버에 `reportlab 4.2.2` + `NotoSansCJK` 폰트 설치 완료
- [ ] **카카오 알림톡 심사 승인 후**: `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY` `.env` 입력 → `pm2 restart aeolab-backend`
- [ ] **실결제 전환 시**: `TOSS_SECRET_KEY`를 `test_sk_...` → `live_sk_...` 교체 → 재시작
- [ ] B2G 공식화 (지자체 MOU) — Phase 4

---

### 버그 수정 이력 (v1.5 코드 감사)
- **`score_engine.py`**: `_calc_freshness()`에서 `scan_result.get("created_at")` → `scan_result.get("scanned_at")` 수정 (content_freshness 항상 기본값 반환 버그)
- **`supabase_schema.sql`**: `profiles` 테이블에 `kakao_scan_notify`, `kakao_competitor_notify` 컬럼 추가 (스캔 완료 즉시 카카오 알림 동작 불가 버그)
- **`supabase_schema.sql`**: `ai_citations` 테이블에 `sentiment`, `mention_type` 컬럼 추가 (Pro+ 언급 맥락 분석 카운트 항상 0 버그)
- **`routers/scan.py`**: `_run_full_scan()`에 `weekly_change` 실계산 + `competitor_scores` 경쟁사 스캔 로직 추가 (`/full` 백그라운드 경로에서 경쟁사 비교 데이터 누락 버그)
- **`frontend/package.json`**: deprecated `@supabase/auth-helpers-nextjs` 제거 (`@supabase/ssr`로 이미 교체됨)
- **`gemini_scanner.py`**: `gemini-1.5-flash` → `gemini-2.0-flash` 모델 업그레이드
- **`CLAUDE.md`**: `multi_scanner.py` 주석 및 `/api/scan/full` 설명에서 "6개 AI" → "8개 AI" 정정

### 성능·보안 개선 이력 (v1.6 — 코드 심층 점검)

**보안**
- **`routers/report.py`**: score/history/competitors/before-after 엔드포인트에 `get_current_user` JWT 인증 + 사업장 소유권 검증 추가 (인증 없이 타인 데이터 접근 가능 취약점 수정)
- **`routers/report.py`**: export/pdf 엔드포인트에 소유권 검증(`_verify_biz_ownership`) 추가
- **`main.py`**: CORS `allow_methods=["*"]` → 명시적 5개 메서드로 제한
- **`main.py`**: `SecurityHeadersMiddleware` 추가 (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- **`main.py`**: 운영 환경에서 Swagger UI 비활성화, 오류 메시지 클라이언트 노출 방지
- **`main.py`**: 시작 시점 필수 환경변수 검증 (`_REQUIRED_ENVS`)
- **`services/kakao_notify.py`**: 전화번호 평문 로깅 → 마스킹 처리 (`010****89`)
- **`routers/webhook.py`**: `confirm_payment` Toss API 호출에 `timeout=30` 명시

**성능**
- **`backend/utils/cache.py`**: 신규 — 인메모리 TTL 캐시 모듈 (`get/set/delete/clear_expired/_make_key`)
- **`routers/report.py`**: ranking N+1 쿼리 제거 (사업장 수만큼 DB 조회 → 단일 IN 쿼리)
- **`routers/report.py`**: ranking 30분 캐시, benchmark 1시간 캐시 적용
- **`routers/report.py`**: benchmark `ilike("%region%")` → `ilike("region%")` 접두어 매칭으로 인덱스 활용
- **`routers/report.py`**: score/history/before-after `SELECT *` → 필요 필드만 명시
- **`routers/settings.py`**: 월별 스캔 카운트 루프 N+1 → 단일 IN 쿼리로 변경
- **`main.py`**: `GZipMiddleware` 추가 (1KB 이상 응답 자동 압축, JSON 크기 60~80% 감소)
- **`scripts/supabase_schema.sql`**: 성능 인덱스 6개 추가 (category+active, region lower, score_date, ai_citations, before_after, guides)

**안정성**
- **`routers/scan.py`**: `cleanup_expired_stream_tokens()` 함수 추출 (스케줄러 연동)
- **`routers/scan.py`**: 모든 `except Exception: pass` → `except Exception as e: _logger.warning(...)` 개선
- **`scheduler/jobs.py`**: `_cleanup_memory_stores` 잡 추가 — 10분마다 TTL 캐시·SSE 토큰 정리

### 추가 구현 완료 (v1.7 — AI 채널 분리 + 글로벌 AI 노출 강화)
- **`score_engine.py`**: `_calc_naver_channel_score()` / `_calc_global_channel_score()` 추가, `calculate_score()` 반환에 채널 점수 포함, `_calc_completeness()`에 `google_place_id` / `kakao_place_id` 반영
- **`services/website_checker.py`**: 신규 — aiohttp 기반 경량 웹사이트 SEO 체커 (JSON-LD, Open Graph, viewport, favicon, HTTPS, LocalBusiness schema, 8초 타임아웃)
- **`routers/scan.py`**: 풀스캔에 카카오 가시성 + 웹사이트 체크 병렬 추가; trial 스캔 채널 점수 계산 적용; DB에 `kakao_result`, `website_check_result`, `naver_channel_score`, `global_channel_score` 저장
- **`scripts/supabase_schema.sql`**: v1.7 ALTER TABLE — `businesses`에 `google_place_id`/`kakao_place_id`; `scan_results`에 채널 점수 + `kakao_result` + `website_check_result` + 인덱스 2개
- **`frontend/types/index.ts`**: `Business`, `ScanResult`, `TrialScanResult` 타입 업데이트; `WebsiteCheckResult` 인터페이스 신규
- **`components/dashboard/ChannelScoreCards.tsx`**: 신규 — 네이버 AI 채널 / 글로벌 AI 채널 분리 점수 카드
- **`components/dashboard/GlobalAIBanner.tsx`**: 신규 — 글로벌 AI 점수 30점 미만 시 네이버 robots.txt 차단 교육 배너
- **`components/dashboard/PlatformDistributionChart.tsx`**: 신규 — 채널별 플랫폼 노출 현황 바 차트
- **`components/dashboard/WebsiteCheckCard.tsx`**: 신규 — 웹사이트 SEO 체크리스트 카드
- **`components/scan/ResultTable.tsx`**: 네이버 생태계 / 글로벌 AI 채널 그룹 구분; AI 브리핑 배지 강조
- **`app/(dashboard)/dashboard/page.tsx`**: 신규 컴포넌트 4개 통합
- **`app/(public)/trial/page.tsx`**: 채널 분리 미리보기 + 네이버 robots.txt 교육 배너 추가
- **`components/dashboard/RegisterBusinessForm.tsx`**: Google / 카카오 Place ID 입력 필드 추가

### 운영 환경 추가 필요 작업 (v1.7)
- [x] **Supabase SQL Editor**에서 `scripts/supabase_schema.sql` 하단 v1.7 ALTER TABLE 섹션 실행 완료

### 도메인 모델 시스템 v2.1 구현 완료 (2026-03-30)

**4-도메인 모델 (docs/model_system.md 기준) 전체 구현:**

- **Phase A — 모델 정의**: `backend/models/context.py` (ScanContext Enum), `diagnosis.py`, `market.py`, `gap.py`, `action.py` 신규; `frontend/types/context.ts`, `diagnosis.ts`, `market.ts`, `gap.ts`, `action.ts` 신규
- **Phase B — 스캔 context 분기**: `score_engine.py` WEIGHTS dict를 ScanContext별로 분리; `routers/scan.py` trial 스캔에 non_location 분기 추가 (naver/kakao 스킵, website checker 실행); `models/schemas.py` TrialScanRequest에 `website_url` 추가
- **Phase C — GapAnalysis**: `services/gap_analyzer.py` 신규 — context별 가중치·gap_reason; `routers/report.py`에 `GET /api/report/gap/{biz_id}` 추가
- **Phase D — ActionPlan + ActionTools**: `services/action_tools.py` 신규 (FAQ 7개·블로그 템플릿·스마트플레이스 체크리스트·SEO 체크리스트); `services/guide_generator.py`에 `generate_action_plan()` 추가 (ActionPlan Pydantic 반환)
- **Phase E — 프론트엔드 연결**: `lib/api.ts`에 `getGapAnalysis()`, `getLatestActionPlan()`, `getGapCardUrl()` 추가; `components/dashboard/GapAnalysisCard.tsx` 신규; `competitors/page.tsx`에 GapAnalysis 섹션 통합

**ScanContext 분기 검증 완료 (production 서버 테스트):**
- `location_based`: naver + kakao 데이터 수집, WEIGHTS 30/20/15/15/10/10%
- `non_location`: naver/kakao 스킵, website checker 실행, WEIGHTS 35/10/20/20/10/5%

**Supabase 마이그레이션 완료:**
- [x] `guides` 테이블: `scan_id`, `context`, `next_month_goal`, `tools_json` 컬럼 추가
- [x] `score_history` 테이블: `context` 컬럼 추가
- [x] `businesses` 테이블: `receipt_review_count` 컬럼 추가

### 버그 수정 및 기능 개선 (v2.2 — 2026-03-30)
- **`ScanTrigger.tsx`**: 대시보드 "AI 스캔 시작" 버튼 동작 불가 버그 수정 — 구 방식(`?business_name=`) → stream_token 2단계 인증 방식으로 전환; 버튼 disabled + "준비 중…" 로딩 표시 추가
- **`trial/page.tsx`**: `TRIAL_DAY_LIMIT` 개발용 20 → 운영용 3 복구
- **`SettingsClient.tsx`**: 카카오 알림 수신 설정 토글 UI 추가 (스캔 완료 알림 / 경쟁사 순위변동 알림)
- **`backend/routers/settings.py`**: `PATCH /api/settings/me`에 `kakao_scan_notify`, `kakao_competitor_notify` 필드 저장 지원; `GET /api/settings/me`에 `profile` 반환 추가

### 모델 정합성 개선 (v2.3 — 2026-03-30)
- **`backend/models/entities.py`**: 신규 — Business, Competitor, Subscription 핵심 엔티티 Pydantic 모델 (model_system.md § 4 기준)
- **`frontend/types/entities.ts`**: 신규 — Business, Competitor, Subscription, Plan TypeScript 엔티티 타입 분리
- **`frontend/types/index.ts`**: entities.ts에서 핵심 엔티티 re-export로 변경 (중복 제거)
- **`frontend/types/market.ts`**: MarketLandscape 타입을 API 응답 구조와 동기화
- **`backend/routers/report.py`**: `GET /score/{biz_id}` → DiagnosisReport 전체 구조 반환 (channel_scores + website_health + 하위호환 필드)
- **`backend/routers/report.py`**: `GET /market/{biz_id}` 신규 — MarketLandscape Domain 2 통합 엔드포인트 (30분 캐시)
- **`backend/routers/guide.py`**: `_verify_biz_ownership` 런타임 버그 수정 (미정의 함수 참조)
- **`frontend/lib/api.ts`**: `getMarket()` 추가 (Domain 2 API 호출)
- **`scripts/supabase_schema.sql`**: v2.2 — gap_cards 테이블 + weekly_scores 뷰 추가
- 미커밋 파일 73개 전체 git 추적 추가 및 서버 배포 완료

*최종 업데이트: 2026-03-30 | v2.3 — 도메인 모델 정합성 전면 개선 + 서버 배포 완료*
