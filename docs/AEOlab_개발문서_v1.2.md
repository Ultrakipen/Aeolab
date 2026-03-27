# AEOlab 개발문서 v1.2

> 작성일: 2026-03-27 | 기준: 개발문서 v1.1 + 개선과제 v1.0 전체 구현 완료
> 이전 버전: `AEOlab_개발문서_v1.1.docx`
> 변경 범위: 개선과제 v1.0 (20개 항목, 22개 구현) 전체 반영

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [v1.2 신규 구현 목록](#4-v12-신규-구현-목록)
5. [API 엔드포인트 전체 목록](#5-api-엔드포인트-전체-목록)
6. [데이터베이스 스키마 v1.4](#6-데이터베이스-스키마-v14)
7. [보안 및 인증 구조](#7-보안-및-인증-구조)
8. [스캐너 아키텍처](#8-스캐너-아키텍처)
9. [프론트엔드 구성](#9-프론트엔드-구성)
10. [스케줄러 잡 목록](#10-스케줄러-잡-목록)
11. [환경변수 목록](#11-환경변수-목록)
12. [운영 환경 설정 체크리스트](#12-운영-환경-설정-체크리스트)
13. [트러블슈팅 이력](#13-트러블슈팅-이력)

---

## 1. 프로젝트 개요

**서비스명:** AEOlab (AI Engine Optimization Lab)
**대상:** 한국 소상공인
**핵심 가치:** AI 검색(Gemini, ChatGPT, Perplexity 등)에서 내 사업장이 얼마나 노출되는지 측정하고 개선 방안 제공
**수익 모델:** 월정액 구독 — Basic 9,900원 / Pro 29,900원 / Biz 79,900원
**BEP:** 구독자 20명 (월 비용 약 8만원)
**개발 형태:** 1인 개발, 로컬 개발 후 iwinv 서버 이전 예정

---

## 2. 기술 스택

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 프론트엔드 | Next.js | **16.2.1** | App Router, 실제 설치 버전 |
| 프론트엔드 | Tailwind CSS | 3.x | |
| 프론트엔드 | shadcn/ui | latest | |
| 프론트엔드 | Recharts | 2.x | 대시보드 차트 |
| 백엔드 | Python FastAPI | 0.110+ | 포트 8000 |
| 백엔드 | Pydantic | v2 | |
| 백엔드 | APScheduler | 3.x | 크론잡 |
| DB | Supabase Cloud | Free Tier | PostgreSQL + Auth + Storage |
| AI (주력) | Gemini Flash | gemini-1.5-flash | 100회 샘플링 |
| AI (인용) | OpenAI | gpt-4o-mini | |
| AI (스캐너) | Claude Haiku | claude-haiku-4-5 | 6번째 AI 플랫폼 확인용 |
| AI (가이드) | Claude Sonnet | claude-sonnet-4-6 | 가이드/분석 생성 전용 |
| AI (검색) | Perplexity | llama-3.1-sonar | |
| AI (최신) | Grok | grok-beta | |
| Playwright | 네이버 AI 브리핑 | 파서 | DOM 파싱 |
| Playwright | Google AI Overview | 파서 | SGE 노출 확인 |
| Playwright | 뤼튼(Zeta) | 파서 | wrtn.ai |
| 결제 | 토스페이먼츠 | v2 | 한국 표준, 자동갱신 |
| 알림 | 카카오 비즈API | v2 | 알림톡 7종 |
| 서버 | iwinv 단독형 | vCPU2/RAM4GB | Ubuntu 24.04 |

---

## 3. 프로젝트 구조

```
aeolab/
  frontend/                         # Next.js 16 (포트 3000)
    app/
      (public)/
        page.tsx                    # 랜딩 (샘플 결과 미리보기 섹션 포함)
        trial/page.tsx              # 무료 원샷 체험 (점수별 업그레이드 amber 박스)
        pricing/page.tsx            # 요금제
        share/[bizId]/page.tsx      # [신규] 공개 공유 페이지 (OG 이미지 포함)
      (auth)/
        login/page.tsx
        signup/page.tsx
      (dashboard)/
        layout.tsx
        dashboard/page.tsx          # 메인 대시보드 (빈 상태 UI + 벤치마크 카드)
        competitors/page.tsx        # 경쟁사 관리 (즉시 스캔 제안 모달)
        guide/page.tsx              # 개선 가이드 (경과시간 카운터)
        schema/page.tsx             # JSON-LD 생성
        history/page.tsx            # Before/After 히스토리
        startup/page.tsx            # 창업 시장 분석
        ad-defense/page.tsx         # ChatGPT 광고 대응 가이드
        settings/
          page.tsx                  # 구독 설정 (카카오 알림 번호 입력)
          team/page.tsx             # 팀 멤버 관리 (Biz+)
          api-keys/page.tsx         # API 키 관리 (Biz+)
    components/
      dashboard/
        ScoreCard.tsx               # 등급 툴팁 추가 (onMouseEnter/Leave)
        RankingBar.tsx
        TrendLine.tsx
        BeforeAfterCard.tsx
        MentionContextCard.tsx      # [신규] 언급 맥락 카드
        RegisterBusinessForm.tsx    # 사업자번호 10자리 자동 조회
      scan/
        ScanProgress.tsx            # SSE 2단계 인증 방식
        ResultTable.tsx
      common/
        PlanGate.tsx
    lib/
      supabase/client.ts
      supabase/server.ts
      api.ts                        # 총 30+ 함수 (v1.2에서 14개 추가)
    types/index.ts                  # 12개 신규 인터페이스 추가

  backend/                          # Python FastAPI (포트 8000)
    main.py                         # v1.3.0
    routers/
      scan.py                       # SSE 2단계 인증 + 중복 방지 + 즉시 카카오 알림
      report.py                     # 벤치마크 3단계 Fallback + Share/Badge/MentionContext
      guide.py
      schema_gen.py
      webhook.py
      admin.py
      business.py
      competitor.py
      settings.py
      startup.py
      teams.py
      api_keys.py
    services/
      ai_scanner/
        gemini_scanner.py           # scan_by_keywords() + analyze_mention_context() 추가
        chatgpt_scanner.py
        perplexity_scanner.py
        grok_scanner.py
        naver_scanner.py
        claude_scanner.py
        google_scanner.py
        zeta_scanner.py
        multi_scanner.py            # Playwright 세마포어(2) + 직렬 처리
      score_engine.py               # content_freshness 실계산 구현
      guide_generator.py
      schema_generator.py
      screenshot.py
      before_after_card.py
      kakao_notify.py               # send_competitor_overtake() + send_scan_complete() 추가
      toss_billing.py
      pdf_generator.py
      startup_report.py
      ad_defense_guide.py
      naver_place_stats.py
    middleware/
      plan_gate.py                  # get_current_user() 추가 (Supabase JWT 검증)
      rate_limit.py
    utils/
      logger.py
      error_handler.py
      alert.py
    scheduler/
      jobs.py                       # check_competitor_overtake() 추가 (매일 03:00)
    scripts/
      supabase_schema.sql           # v1.4 (keyword_scan_results 테이블 추가)
```

---

## 4. v1.2 신규 구현 목록

> 개선과제 v1.0 문서 기준 20개 항목 전체 구현 완료 (2026-03-27)

### 🔴 긴급 — 보안·안정성

#### 1. SSE 인증 2단계 방식 (scan.py, api.ts, ScanProgress.tsx)

**문제:** `EventSource`는 HTTP 헤더 커스터마이징 불가 → Bearer 토큰 전달 불가 → 인증 우회 취약점

**해결:**
- `POST /api/scan/stream/prepare` → 60초 유효 `stream_token` 발급 (인메모리 OTP)
- `GET /api/scan/stream?stream_token=` → 단일 사용 후 즉시 폐기
- `_stream_tokens: dict[str, dict]` 인메모리 저장소 (운영 환경: Redis 권장)

**관련 파일:**
- `backend/routers/scan.py` — `prepare_stream()`, `stream_scan()` 수정
- `backend/middleware/plan_gate.py` — `get_current_user()` 신규 추가
- `frontend/lib/api.ts` — `prepareStreamToken()`, `streamScan()` 2단계 방식
- `frontend/components/scan/ScanProgress.tsx` — 2단계 비동기 SSE 연결

#### 2. Playwright 동시 실행 제어 (multi_scanner.py, jobs.py)

**문제:** Playwright 인스턴스 1개 = RAM 300~500MB → 동시 다수 실행 시 서버(4GB) OOM

**해결:**
- `PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(2)` — 전역 동시 2개 제한
- Playwright 계열(naver/google/zeta) 세마포어 + 직렬 실행 + 2초 해제 대기
- API 계열(gemini/chatgpt/perplexity/grok/claude) 병렬 실행 유지
- 스케줄러 `daily_scan_all()`: 사업장 간 30초 + 5개마다 60초 휴식

---

### 🟠 중요 — 버그·누락

#### 3. content_freshness 실계산 (score_engine.py)

기존 하드코딩 50점 → 실제 데이터 기반 3요소 계산:
- 스캔 날짜 신선도: ≤7일 +20pt, ≤30일 +10pt, >90일 -20pt
- 네이버 최근 리뷰 날짜: `naver_result.recent_review_date`
- Google 최신성 신호: `google_result.recency_signal`

#### 4. api.ts 누락 함수 14개 추가

신규 추가 함수 목록:
```
getBenchmark, downloadPdfReport, generateAdDefenseGuide,
generateStartupReport, getStartupMarket, getTeamMembers,
inviteTeamMember, getApiKeys, createApiKey, revokeApiKey,
searchCompetitors, getSuggestedCompetitors,
getSharePageData, getMentionContext, getBadge
prepareStreamToken, streamScan (2단계 교체)
```

#### 5. 빈 대시보드 개선 (dashboard/page.tsx)

스캔 이력 없을 때: 8개 플랫폼 안내 그리드 + 명확한 "AI 스캔 시작" CTA 화면

#### 6. 벤치마크 3단계 Fallback (report.py)

`GET /api/report/benchmark/{category}/{region}`:
1. 지역+업종 (sample_count ≥ 5)
2. 전국+업종 (sample_count ≥ 3), `fallback: "region"`
3. 전체 서비스 평균, `fallback: "global"`

#### 7. 중복 스캔 방지 (scan.py)

`_active_scans: set[str]` 인메모리 추적:
- scan_key = `"{user_id}:{business_id}"`
- 스캔 중 재요청 시 HTTP 409 응답
- 스캔 완료/오류 시 자동 cleanup

---

### 🟡 보완 — 품질

#### 8. Trial 업그레이드 메시지 (trial/page.tsx)

점수별 동적 메시지 amber 박스:
- 70점 이상: "상위권 진입! Pro로 경쟁사 추적을"
- 50~69점: "개선 여지 있음. 가이드로 점수를 올려보세요"
- 50점 미만: "즉각 조치 필요. 전문 가이드로 시작하세요"

#### 9. 가이드 생성 경과시간 카운터 (guide/GuideClient.tsx)

생성 시작 시 `setInterval(1초)` → `elapsedSeconds` 상태 → "생성 중... 12초" 표시 → 완료 시 `clearInterval`

#### 10. ScoreCard 등급 툴팁 (ScoreCard.tsx)

`GRADE_INFO` 상수: 범위/설명/백분위 정의
등급 버튼 `onMouseEnter/Leave` → 절대 위치 툴팁 팝업

#### 11. 경쟁사 추가 후 즉시 스캔 제안 모달 (CompetitorsClient.tsx)

경쟁사 추가 성공 시 `scanPromptName` 상태 → 모달 표시:
"'{name}'을(를) 지금 바로 비교 스캔할까요?"
확인 시 `/dashboard`로 이동하여 스캔 트리거

#### 12. 사업자번호 10자리 자동 조회 (RegisterBusinessForm.tsx)

`handleRegNoChange()`: 숫자만 추출 → 10자리 완성 시 `setTimeout(() => handleLookup(), 100)` 자동 실행

---

### 🟢 추가 — 신규 기능

#### 13. 랜딩 페이지 샘플 결과 미리보기 (page.tsx)

더미 데이터 기반 점수 카드 + 항목별 점수 바 + 플랫폼 현황 표시
하단 흐림 효과(blur) + "내 사업장 무료 분석" CTA 오버레이

#### 14. Share Card PNG (report.py)

`GET /api/report/share-card/{biz_id}` — Pillow 1080×1080 PNG:
- 다크 배경(#1e293b), 사업장명, 점수, 등급, AI 노출빈도, AEOlab 워터마크
- `image/png` 스트리밍 응답

#### 15. 공개 공유 페이지 (share/[bizId]/page.tsx)

- `generateMetadata()`: OG 이미지 = Share Card PNG URL
- 공개 접근 가능 (인증 불필요)
- 점수/등급 카드 UI + "내 사업장도 무료 분석" CTA

#### 16. AEO 인증 배지 (report.py)

- `GET /api/report/badge/{biz_id}` — JSON (score, grade, issued_at, embed_url 등)
- `GET /api/report/badge/{biz_id}.svg` — 동적 SVG 배지 (70점 이상 조건)
- 미달 시 HTTP 403 반환

#### 17. 언급 맥락 분석 (gemini_scanner.py, report.py)

`analyze_mention_context()`: AI 응답 내 사업장 언급 방식 분석:
- `sentiment`: positive / neutral / negative
- `mention_type`: recommendation / information / comparison / warning
- `excerpt`: 실제 언급 텍스트
- `mentioned_attributes`: 언급된 속성 목록 (맛, 위치, 가격 등)

`GET /api/report/mention-context/{biz_id}` — Pro+ 전용

#### 18. MentionContextCard.tsx (신규 컴포넌트)

`frontend/components/dashboard/MentionContextCard.tsx`:
- sentiment별 색상 스타일 (green/gray/red)
- mention_type 한국어 라벨
- `mentioned_attributes` 해시태그 표시

#### 19. 경쟁사 역전 알림 (jobs.py, kakao_notify.py)

`check_competitor_overtake()` — 매일 03:00 실행:
- 오늘/어제 스캔 결과 비교
- 경쟁사가 내 점수를 역전한 경우 카카오 알림 발송
- 알림 템플릿: `AEOLAB_COMP_02`

#### 20. 스캔 완료 즉시 카카오톡 (scan.py, kakao_notify.py)

`send_scan_complete()` — `/full` 스캔 완료 후 즉시 발송:
- 프로필 `kakao_scan_notify: true` 설정 시 활성화
- 알림 템플릿: `AEOLAB_SCAN_01`

#### 21. 키워드별 노출 추적 (gemini_scanner.py, scan.py)

`scan_by_keywords(business_info, keywords: list[str])`:
- Pro+ 전용, 최대 5개 키워드
- 키워드별 Gemini 100회 샘플링
- 결과 `keyword_scan_results` 테이블 저장

#### 22. keyword_scan_results 테이블 (supabase_schema.sql v1.4)

```sql
CREATE TABLE keyword_scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_results(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    gemini_frequency INTEGER DEFAULT 0,
    mentioned BOOLEAN DEFAULT FALSE,
    result_json JSONB,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API 엔드포인트 전체 목록

### 스캔
| Method | Endpoint | 역할 | 인증 |
|--------|----------|------|------|
| POST | /api/scan/trial | 무료 원샷 스캔 (Gemini만) | 없음 |
| POST | /api/scan/full | 8개 AI 병렬 스캔 | Bearer |
| POST | /api/scan/stream/prepare | SSE 토큰 발급 (60초 OTP) | Bearer |
| GET | /api/scan/stream | SSE 실시간 스캔 진행률 | stream_token |
| GET | /api/scan/{id} | 스캔 결과 조회 | Bearer |

### 리포트
| Method | Endpoint | 역할 | 플랜 |
|--------|----------|------|------|
| GET | /api/report/score/{biz_id} | AI Visibility Score | Basic+ |
| GET | /api/report/history/{biz_id} | 30일 점수 추세 | Basic+ |
| GET | /api/report/competitors/{biz_id} | 경쟁사 비교 | Basic+ |
| GET | /api/report/before-after/{biz_id} | Before/After 스크린샷 | Basic+ |
| GET | /api/report/ranking/{category}/{region} | 업종·지역 랭킹 TOP10 | Basic+ |
| GET | /api/report/benchmark/{category}/{region} | 벤치마크 (3단계 Fallback) | Basic+ |
| GET | /api/report/export/{biz_id} | CSV 내보내기 | Pro+ |
| GET | /api/report/pdf/{biz_id} | PDF 리포트 | Pro+ |
| GET | /api/report/share/{biz_id} | 공유 데이터 JSON | 없음 |
| GET | /api/report/share-card/{biz_id} | Share Card PNG | 없음 |
| GET | /api/report/badge/{biz_id} | AEO 인증 배지 JSON | 없음 |
| GET | /api/report/badge/{biz_id}.svg | AEO 인증 배지 SVG | 없음 |
| GET | /api/report/mention-context/{biz_id} | 언급 맥락 분석 | Pro+ |

### 사업장·경쟁사
| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/businesses | 사업장 등록 (Before 스크린샷 자동) |
| GET | /api/businesses/me | 내 사업장 목록 |
| GET | /api/businesses/{id} | 사업장 조회 |
| PATCH | /api/businesses/{id} | 사업장 수정 |
| GET | /api/competitors/{biz_id} | 경쟁사 목록 |
| POST | /api/competitors | 경쟁사 등록 (플랜별 한도) |
| DELETE | /api/competitors/{id} | 경쟁사 삭제 |
| GET | /api/competitors/search | 네이버 지역 검색 API |
| GET | /api/competitors/suggest/list | AEOlab 내 동종업계 추천 |

### 가이드·스키마
| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/guide/generate | 개선 가이드 (Claude Sonnet) |
| GET | /api/guide/{biz_id}/latest | 최신 가이드 |
| POST | /api/guide/ad-defense/{biz_id} | ChatGPT 광고 대응 가이드 |
| POST | /api/schema/generate | JSON-LD 자동 생성 |

### 창업·팀·API 키
| Method | Endpoint | 역할 | 플랜 |
|--------|----------|------|------|
| POST | /api/startup/report | 창업 시장 분석 리포트 | Biz+ |
| GET | /api/startup/market/{cat}/{region} | 업종·지역 시장 현황 | 없음 |
| GET | /api/teams/members | 팀 멤버 목록 | Biz+ |
| POST | /api/teams/invite | 팀원 초대 | Biz+ |
| DELETE | /api/teams/members/{id} | 팀원 제거 | Biz+ |
| GET | /api/v1/keys | API 키 목록 | Biz+ |
| POST | /api/v1/keys | API 키 발급 | Biz+ |
| DELETE | /api/v1/keys/{id} | API 키 폐기 | Biz+ |

### 설정·결제·관리자
| Method | Endpoint | 역할 |
|--------|----------|------|
| GET | /api/settings/me | 내 구독/설정 조회 |
| PATCH | /api/settings/me | 설정 수정 (phone 포함) |
| POST | /api/settings/cancel | 구독 취소 |
| POST | /api/webhook/toss/confirm | 토스 결제 확정 |
| GET | /admin/stats | 구독자·MRR·BEP |
| GET | /admin/subscriptions | 구독자 목록 |
| GET | /admin/revenue | 월별 매출 추이 |
| GET | /health | 서버·DB 상태 |

---

## 6. 데이터베이스 스키마 v1.4

| 테이블 | 변경 이력 |
|--------|----------|
| users | Supabase Auth (변경 없음) |
| businesses | (변경 없음) |
| competitors | (변경 없음) |
| scan_results | gemini/chatgpt/perplexity/grok/naver/claude/zeta/google_result JSONB, competitor_scores JSONB |
| ai_citations | platform, query, mentioned, excerpt |
| score_history | 점수 시계열 30일 |
| before_after | 스크린샷 Before/After |
| guides | 개선 가이드 |
| subscriptions | billing_key, customer_key, **grace_until DATE** (v1.2 추가) |
| notifications | 알림 발송 이력 |
| profiles | phone — 카카오 알림용 (v1.2, 회원가입 트리거 자동 생성) |
| team_members | Biz: 5명, Enterprise: 20명 (v1.3 추가) |
| api_keys | SHA256 해시 저장, Biz+ 최대 5개 (v1.3 추가) |
| waitlist | Phase 0 대기자 |
| **keyword_scan_results** | **키워드별 노출 추적 (v1.4 신규)** |

### keyword_scan_results 스키마

```sql
CREATE TABLE keyword_scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_results(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    gemini_frequency INTEGER DEFAULT 0,
    mentioned BOOLEAN DEFAULT FALSE,
    result_json JSONB,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ksr_business_id ON keyword_scan_results(business_id);
CREATE INDEX idx_ksr_scanned_at ON keyword_scan_results(scanned_at DESC);
```

---

## 7. 보안 및 인증 구조

### Supabase JWT 검증 (plan_gate.py)

```python
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    token = authorization.removeprefix("Bearer ").strip()
    response = supabase.auth.get_user(token)  # Supabase 서버 검증
    return {"id": response.user.id, "email": response.user.email}
```

모든 인증 필요 엔드포인트: `user = Depends(get_current_user)`

### SSE 2단계 인증 흐름

```
[프론트엔드]                          [백엔드]
ScanProgress.tsx
  ↓ POST /stream/prepare (Bearer 헤더)
                                    ← { stream_token: "abc...", expires_in: 60 }
  ↓ new EventSource("/stream?stream_token=abc...")
                                    토큰 검증 + 폐기 → SSE 스트림 시작
```

### 중복 스캔 방지

```python
_active_scans: set[str] = set()
scan_key = f"{user_id}:{business_id}"
if scan_key in _active_scans:
    raise HTTPException(409, "이미 스캔이 진행 중입니다")
_active_scans.add(scan_key)
try:
    # 스캔 실행
finally:
    _active_scans.discard(scan_key)
```

### 플랜 제한 미들웨어

`@require_plan("pro")` 데코레이터 → plan_gate.py:
- DB `subscriptions.plan` 조회
- 미달 시 HTTP 403 반환

---

## 8. 스캐너 아키텍처

### 병렬/직렬 실행 구조

```
scan_all() 호출
├── [동시 실행] API 계열 5개
│   ├── gemini_scanner.scan()
│   ├── chatgpt_scanner.scan()
│   ├── perplexity_scanner.scan()
│   ├── grok_scanner.scan()
│   └── claude_scanner.scan()
└── [직렬 + 세마포어(2)] Playwright 계열
    ├── naver_scanner.scan()    ← 2초 대기
    ├── google_scanner.scan()   ← 2초 대기
    └── zeta_scanner.scan()
```

### Playwright 세마포어 (RAM 보호)

```python
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(2)  # 전역, 최대 동시 2개

async def _run_playwright(self, fn, *args):
    async with PLAYWRIGHT_SEMAPHORE:
        result = await fn(*args)
    await asyncio.sleep(2)  # 메모리 해제 대기
    return result
```

### AI Visibility Score 가중치

| 항목 | 가중치 | 계산 방식 |
|------|--------|----------|
| AI 검색 노출 빈도 | 30% | Gemini 100회 샘플링 빈도 |
| 리뷰 수·평점 | 20% | 리뷰 수 + 평점 + 키워드 다양성 |
| Schema JSON-LD | 15% | 구조화 데이터 완성도 |
| 온라인 언급 빈도 | 15% | 복수 AI 플랫폼 언급 합산 |
| 정보 완성도 | 10% | 사업장 프로필 필드 완성률 |
| 콘텐츠 최신성 | 10% | 스캔 날짜 + 네이버 리뷰 날짜 + Google 신호 |

---

## 9. 프론트엔드 구성

### api.ts 주요 함수 (v1.2 기준)

**인증**
- `supabase.auth.*` 직접 사용

**스캔**
- `prepareStreamToken(bizId, authToken)` → `stream_token`
- `streamScan(bizId, authToken)` → `EventSource`
- `triggerFullScan(bizId, authToken)`

**리포트**
- `getScore(bizId)`, `getHistory(bizId)`, `getCompetitorReport(bizId)`
- `getBenchmark(category, region)` — 3단계 Fallback
- `downloadCsvReport(bizId)`, `downloadPdfReport(bizId)`
- `getSharePageData(bizId)`, `getMentionContext(bizId)`, `getBadge(bizId)`

**가이드**
- `generateGuide(bizId)`, `getLatestGuide(bizId)`
- `generateAdDefenseGuide(bizId)`

**사업장·경쟁사**
- `registerBusiness(data)`, `getMyBusinesses()`, `updateBusiness(id, data)`
- `getCompetitors(bizId)`, `addCompetitor(data)`, `deleteCompetitor(id)`
- `searchCompetitors(query, region)` — 네이버 지역 검색
- `getSuggestedCompetitors(bizId)` — AEOlab 추천

**팀·API 키**
- `getTeamMembers()`, `inviteTeamMember(email, role)`
- `getApiKeys()`, `createApiKey(name)`, `revokeApiKey(id)`

**창업 분석**
- `generateStartupReport(data)`, `getStartupMarket(category, region)`

### types/index.ts 주요 인터페이스

```typescript
// v1.2 신규 추가
interface BenchmarkData { avg_score, top10_score, count, distribution, fallback? }
interface MentionContext { platform, sentiment, mention_type, excerpt?, mentioned_attributes }
interface SharePageData { business_name, score, grade, gemini_frequency, scanned_at, ... }
interface BadgeData { eligible, score, grade, svg_url, embed_code }
interface AdDefenseGuide { strategy, action_items, risk_level }
interface StartupReportRequest { category, region, keywords }
interface StartupReport { market_size, competition_level, entry_strategy }
interface TeamMember { id, email, role, joined_at }
interface ApiKey { id, name, key_prefix, created_at, last_used_at }
interface CompetitorSearchResult { name, address, phone, category }
interface CompetitorSuggestion { business_id, name, score }
```

---

## 10. 스케줄러 잡 목록

| 잡 이름 | 실행 시각 | 역할 |
|---------|----------|------|
| `daily_scan_all` | 매일 02:00 | 전 사업장 자동 스캔 (30초 간격, 5개마다 60초 휴식) |
| `after_screenshot_check` | 매일 02:30 | 30/60/90일 After 스크린샷 캡처 + Pillow 합성 |
| `subscription_lifecycle` | 매일 09:00 | 만료 경고(D-7), 자동결제 재시도, grace→suspended |
| `weekly_kakao_notify` | 매주 월 08:00 | AI 인용/경쟁사/action_items 카카오 알림 |
| `monthly_market_news` | 매월 1일 08:00 | 시장 변화 뉴스 카카오 알림 |
| **`check_competitor_overtake`** | **매일 03:00** | **경쟁사 역전 감지 → 즉시 카카오 알림** |

---

## 11. 환경변수 목록

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버 전용

# AI API
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
PERPLEXITY_API_KEY=
GROK_API_KEY=

# 결제
NEXT_PUBLIC_TOSS_CLIENT_KEY=    # test_ck_... (개발)
TOSS_SECRET_KEY=                # test_sk_... (개발)

# 카카오
KAKAO_APP_KEY=                  # 알림톡 JS 키
KAKAO_SENDER_KEY=               # 알림톡 발신 키
KAKAO_REST_API_KEY=             # 로컬 검색 REST 키

# 네이버 지역 검색
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

# 서버
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
SECRET_KEY=                     # 32자 랜덤 문자열

# 알림 (선택)
SLACK_WEBHOOK_URL=              # 오류 알림용
```

---

## 12. 운영 환경 설정 체크리스트

### 필수 (서비스 시작 전)

- [ ] Supabase Cloud 프로젝트 생성
- [ ] `scripts/supabase_schema.sql` 실행 (v1.4 기준)
- [ ] Storage `before-after` 버킷 생성 (Public 읽기 설정)
- [ ] `.env.local` (프론트엔드) 환경변수 설정
- [ ] `backend/.env` (백엔드) 환경변수 설정
- [ ] 카카오 알림톡 채널 개설 + 템플릿 7종 심사 신청 (3~5 영업일)
- [ ] iwinv 서버: `pip install reportlab pillow playwright`
- [ ] iwinv 서버: `apt install fonts-noto-cjk` (PDF 한글 폰트)
- [ ] iwinv 서버: `playwright install chromium`
- [ ] Nginx Rate Limiting 설정
- [ ] Nginx SSE: `proxy_buffering off` (`/api/scan/stream` 경로)

### 카카오 알림톡 템플릿 7종

| 코드 | 용도 |
|------|------|
| `AEOLAB_SCORE_01` | 점수 변화 |
| `AEOLAB_CITE_01` | AI 인용 실증 |
| `AEOLAB_COMP_01` | 경쟁사 변화 |
| `AEOLAB_COMP_02` | **경쟁사 역전 알림** (v1.2 신규) |
| `AEOLAB_NEWS_01` | 시장 변화 뉴스 |
| `AEOLAB_ACTION_01` | 이달 할 일 목록 |
| `AEOLAB_SCAN_01` | **스캔 완료 즉시 알림** (v1.2 신규) |

### Phase 0 체험 플로우 테스트

- [ ] `/trial` 페이지 → Gemini 스캔 → 점수 표시 → 업그레이드 메시지
- [ ] 회원가입 → 사업장 등록 → Before 스크린샷 자동 캡처 확인
- [ ] 결제 → 구독 활성화 → 플랜 기능 해제 확인
- [ ] SSE 스캔 진행률 실시간 표시 확인
- [ ] 카카오 알림 발송 확인 (스캔 완료)

---

## 13. 트러블슈팅 이력

| 버전 | 문제 | 해결 |
|------|------|------|
| v1.0 | Next.js 16에서 `middleware.ts` 미인식 | `proxy.ts`로 파일명 변경, 함수명 `proxy`로 변경 |
| v1.0 | `cookies()` 동기 호출 오류 | `const cookieStore = await cookies()` — async 필수 |
| v1.0 | `@supabase/auth-helpers-nextjs` deprecated | `@supabase/ssr` 패키지로 교체 |
| v1.1 | `scan_results.user_id` 컬럼 없음 | `businesses` 조인 후 `business_id`로 rate_limit 체크 |
| v1.1 | `score_history` upsert 누락 | `daily_scan_all` 완료 후 자동 upsert 추가 |
| v1.1 | Before/After 스크린샷 버킷명 불일치 | `before_after` → `before-after` 통일 |
| v1.1 | `ScanProgress.tsx` Strict Mode 이중 실행 | `allResults` → `useRef` 변경 |
| v1.2 | `datetime.utcnow()` Python 3.12 deprecation | `datetime.now(timezone.utc)` 전체 교체 |
| v1.2 | `get_current_user` 미존재 | `plan_gate.py`에 Supabase JWT 검증 함수 신규 추가 |
| v1.2 | Playwright 동시 실행 OOM (RAM 4GB) | `asyncio.Semaphore(2)` + 직렬 처리 + 2초 대기 |
| v1.2 | EventSource Bearer 헤더 불가 | `/stream/prepare` OTP 토큰 2단계 방식 |

---

*최종 업데이트: 2026-03-27 | v1.2 — 개선과제 v1.0 전체 구현 완료*
