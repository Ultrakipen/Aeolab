# AEOlab 코드 점검 체크리스트

> 신규 코드 추가·수정 시 이 목록을 기준으로 점검한다.
> 레벨: 🔴 Critical (반드시 통과) / 🟡 Important (가급적 통과) / 🟢 Optional (시간 여유 있을 때)

---

## 목차

1. [보안 (Security)](#1-보안)
2. [성능 (Performance)](#2-성능)
3. [안정성 (Reliability)](#3-안정성)
4. [AI 스캐너 전용](#4-ai-스캐너-전용)
5. [데이터베이스 (Supabase)](#5-데이터베이스)
6. [프론트엔드 (Next.js)](#6-프론트엔드)
7. [API 설계](#7-api-설계)
8. [인프라 · 운영](#8-인프라--운영)
9. [비용 관리](#9-비용-관리)
10. [신규 파일 추가 체크리스트](#10-신규-파일-추가-체크리스트)

---

## 1. 보안

### 인증 · 인가
- 🔴 모든 `/api/*` 엔드포인트에 `get_current_user` JWT 검증 있음
- 🔴 사업장/경쟁사 데이터 조회 시 **소유권 검증** (`user_id == current_user.id`) 포함
- 🔴 관리자 엔드포인트(`/admin/*`)에 별도 권한 검증 있음
- 🔴 `SUPABASE_SERVICE_ROLE_KEY`가 프론트엔드 코드에 노출되지 않음 (NEXT_PUBLIC_ 접두사 금지)
- 🟡 플랜별 기능 제한 시 `@require_plan` 데코레이터 또는 `PlanGate` 컴포넌트 사용

### 입력 검증
- 🔴 외부 입력(URL 파라미터, 요청 바디)은 Pydantic 모델로 검증
- 🔴 SQL 쿼리에 사용자 입력 직접 삽입 없음 (Supabase SDK `.eq()/.ilike()` 파라미터화 사용)
- 🔴 파일 업로드 경로에 `../` 경로 탈출 방지
- 🟡 문자열 최대 길이 제한 (키워드, 사업장명 등)

### 데이터 노출
- 🔴 에러 응답에 스택 트레이스·내부 경로 노출 없음 (`DEBUG=False` 환경에서)
- 🔴 로그에 API 키, 전화번호 평문 없음 (마스킹 처리: `010****89`)
- 🟡 응답 JSON에 불필요한 민감 필드 미포함 (SELECT * 대신 필요 필드 명시)

### 헤더 · CORS
- 🟡 CORS `allow_origins` 운영 환경에서 `aeolab.co.kr` 도메인만 허용
- 🟡 `SecurityHeadersMiddleware` 헤더 정상 포함 (X-Frame-Options, X-Content-Type-Options)

---

## 2. 성능

### 데이터베이스 쿼리
- 🔴 **N+1 쿼리 없음**: 루프 안에서 DB 조회 없음 → 단일 IN 쿼리로 통합
- 🔴 `SELECT *` 대신 필요 컬럼만 명시 (특히 JSONB 컬럼이 많은 `scan_results`)
- 🟡 자주 조회되는 조합(category+active, region, score+date)에 인덱스 존재 확인
- 🟡 `ilike` 검색 시 `%keyword%` 대신 `keyword%` 접두어 매칭 우선 검토

### 캐시 (`utils/cache.py`)
- 🟡 랭킹/벤치마크처럼 **자주 호출 + 느린 집계 쿼리**에 TTL 캐시 적용
  - ranking: 30분 캐시
  - benchmark: 1시간 캐시
- 🟡 캐시 키에 `category`, `region` 등 파라미터 포함 (키 충돌 방지)
- 🟢 캐시 히트율 주기적 확인 (scheduler `_cleanup_memory_stores` 10분 주기)

### API 응답
- 🟡 `GZipMiddleware` 적용 확인 (1KB 이상 응답 자동 압축)
- 🟡 Playwright 사용 엔드포인트는 **동시 2개 이하** (RAM 4GB 제한)
- 🟢 대용량 응답은 스트리밍(SSE) 또는 페이지네이션 처리

### 비동기 처리
- 🔴 `aiohttp` I/O 작업은 `async/await` 사용 (블로킹 없음)
- 🟡 독립적인 AI 스캐너 호출은 `asyncio.gather()` 병렬 실행
- 🟡 백그라운드 작업(`BackgroundTasks`)에 오래 걸리는 작업 위임

---

## 3. 안정성

### 에러 처리
- 🔴 외부 API 호출(`aiohttp`, Playwright)에 `try/except` + `timeout` 명시
- 🔴 `except Exception: pass` 금지 → `except Exception as e: logger.warning(...)` 로 변경
- 🔴 `@with_retry`, `@with_timeout` 데코레이터를 외부 의존성 호출에 적용
- 🟡 스캐너 개별 실패 시 전체 스캔이 중단되지 않고 해당 플랫폼만 `None` 반환

### 로깅 (`utils/logger.py`)
- 🟡 모든 라우터/서비스 파일 상단에 `logger = get_logger(__name__)` 선언
- 🟡 스캔 시작/완료/실패 이벤트는 INFO 레벨로 기록
- 🟡 외부 API 응답 시간 로깅 (성능 병목 파악용)
- 🟢 JSON 구조화 로그 형식 유지 (PM2 로그 파싱 호환)

### 타임아웃
- 🔴 모든 외부 HTTP 호출에 타임아웃 명시 (Toss API: 30초, AI API: 60초 이하)
- 🔴 Playwright 작업 타임아웃 설정 (`page.goto(timeout=30000)`)
- 🟡 SSE 스트림 연결 유지 최대 시간 제한

### 스케줄러 (`scheduler/jobs.py`)
- 🟡 각 잡 실행 시작·종료 로그 + 소요 시간 기록
- 🟡 잡 실패 시 Slack 알림 (`utils/alert.py`) 발송
- 🟡 `_cleanup_memory_stores` 10분 잡이 활성화되어 있음
- 🟢 동일 잡이 겹쳐 실행되지 않도록 `max_instances=1` 설정 확인

---

## 4. AI 스캐너 전용

### 비용 최적화
- 🔴 100회 샘플링 주력은 **Gemini Flash** (`gemini-2.0-flash`) — 다른 모델 대체 금지
- 🔴 **Claude Sonnet**은 가이드 생성(`guide_generator.py`) 및 광고 대응 시만 호출
- 🔴 **Claude Haiku**는 AI 노출 확인(`claude_scanner.py`)에만 사용
- 🟡 Perplexity는 주 1회 스케줄 호출로 제한 (건당 비용 높음)
- 🟡 프롬프트에 `max_tokens` 명시하여 불필요한 토큰 낭비 방지

### 스캔 안정성
- 🔴 각 스캐너는 독립 실행 가능 (단독 import 후 테스트 가능)
- 🔴 API 키 미설정 시 graceful skip (서비스 중단 아닌 해당 플랫폼만 `None`)
- 🟡 Playwright 스캐너(naver, google, zeta)는 `try/finally`로 브라우저 반드시 종료
- 🟡 Rate limit 에러(429) 수신 시 retry with backoff 처리
- 🟢 스캐너별 응답 시간 모니터링 (느린 스캐너 파악)

### 결과 품질
- 🟡 AI 응답에서 사업장명 추출 시 정규화(공백, 특수문자 처리) 수행
- 🟡 `mentioned: bool` 판정 로직이 모호한 경우 `False`로 보수적 처리
- 🟢 스캐너 결과 샘플을 주기적으로 수동 검증 (허위 양성 확인)

---

## 5. 데이터베이스

### 쿼리 패턴
- 🔴 사용자 데이터 접근 시 항상 `user_id` 또는 `business_id` 필터 포함
- 🔴 upsert 사용 시 `on_conflict` 컬럼 명시
- 🟡 대량 데이터 조회 시 `.limit()` 또는 페이지네이션 적용
- 🟡 `score_history` 조회는 날짜 범위 필터 포함 (전체 조회 금지)

### 스키마 변경 (`scripts/supabase_schema.sql`)
- 🔴 신규 컬럼 추가 시 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 사용
- 🔴 스키마 변경 후 파일 하단에 버전 주석 추가 (`-- v1.8 ...`)
- 🟡 신규 테이블/컬럼에 적절한 인덱스 추가 (자주 조회되는 필드)
- 🟡 JSONB 컬럼의 중첩 키 자주 조회 시 GIN 인덱스 고려

### RLS (Row Level Security)
- 🟡 신규 테이블 생성 시 RLS 정책 확인 (users는 자신의 데이터만 접근)
- 🟢 `SUPABASE_SERVICE_ROLE_KEY` 사용 경로가 최소화되어 있음

---

## 6. 프론트엔드

### 타입 안전성
- 🔴 API 응답 데이터 사용 시 `types/index.ts` 인터페이스 적용
- 🔴 `any` 타입 사용 금지 (불가피한 경우 `// eslint-disable-next-line` + 주석 사유)
- 🟡 신규 API 응답 타입은 `types/index.ts`에 인터페이스 추가

### 인증 · 라우팅
- 🔴 대시보드 페이지는 `(dashboard)/layout.tsx` 내 인증 체크 통과 확인
- 🔴 `NEXT_PUBLIC_*` 환경변수 외 민감 키 클라이언트 코드에 노출 없음
- 🟡 인증 만료 시 `/login`으로 리다이렉트 처리 있음

### 상태 관리 · 렌더링
- 🟡 `useEffect` 의존성 배열 정확히 명시 (빈 배열 `[]` 남용 주의)
- 🟡 Strict Mode 이중 호출 대비: SSE/WebSocket은 `useRef`로 중복 방지
- 🟡 데이터 로딩 중 스켈레톤/로딩 UI 표시
- 🟡 에러 상태 UI 처리 (API 실패 시 빈 화면 아닌 에러 메시지 표시)
- 🟢 불필요한 리렌더링 방지 (`useMemo`, `useCallback` 활용)

### UX
- 🔴 플랜 제한 기능은 `PlanGate` 컴포넌트로 업그레이드 유도 UI 표시
- 🟡 버튼 중복 클릭 방지 (로딩 중 `disabled` 처리)
- 🟡 한국 소상공인 대상 — 전문 용어 최소화, 한글 안내 메시지
- 🟢 모바일 반응형 레이아웃 확인 (Tailwind `sm:`, `md:` 브레이크포인트)

### SEO (공개 페이지)
- 🟡 랜딩·trial·pricing 페이지에 `metadata` 또는 `<Head>` 태그 포함
- 🟢 구조화 데이터(JSON-LD) 랜딩 페이지에 적용

---

## 7. API 설계

### 응답 형식
- 🔴 성공 응답: `{"data": ..., "status": "ok"}` 또는 직접 객체 (라우터 내 일관성 유지)
- 🔴 에러 응답: `{"detail": "메시지"}` 형식 (FastAPI 기본 HTTPException 활용)
- 🟡 HTTP 상태 코드 적절히 사용 (200/201/400/401/403/404/422/500)

### Rate Limiting
- 🔴 Trial 엔드포인트(`/api/scan/trial`)에 IP·이메일 기반 제한 적용
- 🟡 구독자 플랜별 월간 스캔 횟수 제한 (`middleware/rate_limit.py`)
- 🟢 Nginx 레벨 Rate Limiting 설정 (`scripts/nginx_trial_rate_limit.conf`) 적용 확인

### 스트리밍 (SSE)
- 🟡 SSE 엔드포인트 Nginx 설정에 `proxy_buffering off` 적용 확인
- 🟡 클라이언트 연결 끊김 시 서버 스캔 작업이 정리되는지 확인
- 🟢 SSE 토큰 만료 정리(`cleanup_expired_stream_tokens`) 스케줄러 연동

---

## 8. 인프라 · 운영

### PM2 (`ecosystem.config.js`)
- 🔴 백엔드(`aeolab-backend`), 프론트엔드(`aeolab-frontend`) 앱 설정 정상
- 🟡 `max_memory_restart` 설정으로 메모리 누수 시 자동 재시작
- 🟡 `error_file`, `out_file` 로그 경로 설정 확인

### 배포 (`deploy.yml`)
- 🔴 배포 전 `npm run build` 실패 시 배포 중단 (프론트엔드)
- 🔴 환경변수 파일(`.env`) GitHub Secrets에서 주입, 레포에 커밋 금지
- 🟡 배포 후 헬스체크(`GET /health`) 자동 확인
- 🟢 배포 실패 시 Slack 알림 또는 이메일 알림

### 헬스체크 (`GET /health`)
- 🔴 DB 연결 상태 확인 포함
- 🟡 Supabase Storage 버킷(`before-after`) 접근 가능 여부 확인
- 🟢 각 AI API 키 유효성 확인 (선택적)

### Playwright
- 🔴 동시 인스턴스 2개 초과 금지 (RAM 4GB 서버 제한)
- 🔴 `try/finally`로 브라우저 인스턴스 반드시 종료
- 🟡 Playwright 관련 에러는 별도 로그 레벨로 추적

---

## 9. 비용 관리

### API 호출 통제
| AI 서비스 | 허용 호출 경로 | 월 예산 |
|-----------|--------------|---------|
| Gemini Flash | 스캔 100회 샘플링 | ~$2 |
| OpenAI GPT-4o-mini | 인용 예시 확인만 | ~$1 |
| Claude Sonnet | 가이드 생성, 광고 대응만 | ~$3 |
| Perplexity | 주 1회 스케줄 | ~$1 |
| Claude Haiku | AI 노출 확인만 | ~$0.5 |

- 🔴 위 표 외 경로에서 고비용 모델(Claude Sonnet, GPT-4o) 호출 없음
- 🟡 신규 AI 호출 추가 시 월 비용 영향 계산 후 위 표 업데이트
- 🟢 월별 API 사용량 대시보드 또는 알림 설정

### Playwright 비용 (서버 리소스)
- 🟡 Playwright 호출을 트리거하는 엔드포인트는 구독자만 접근 가능
- 🟢 비용 높은 작업(스크린샷, AI 스캔) 중복 실행 방지 (스캔 중 상태 체크)

---

## 10. 신규 파일 추가 체크리스트

### 백엔드 라우터 신규 추가 시
```
□ main.py에 router include 추가
□ CLAUDE.md API 엔드포인트 표에 신규 엔드포인트 추가
□ 인증 미들웨어 적용 여부 확인
□ 플랜 제한 필요 시 @require_plan 데코레이터 추가
□ 소유권 검증 로직 포함
□ 에러 응답 HTTPException 형식 확인
```

### 백엔드 서비스 신규 추가 시
```
□ logger = get_logger(__name__) 선언
□ 외부 API 호출에 timeout 명시
□ try/except 에러 처리 (pass 금지)
□ API 키 없을 때 graceful skip 처리
□ CLAUDE.md 서비스 목록 업데이트
```

### 프론트엔드 페이지 신규 추가 시
```
□ (dashboard)/ 하위: layout.tsx 인증 체크 자동 적용 확인
□ (public)/ 하위: metadata 태그 추가
□ lib/api.ts에 대응하는 API 호출 함수 추가
□ types/index.ts에 응답 타입 추가
□ 로딩/에러 상태 UI 처리
□ PlanGate 필요 여부 검토
```

### 프론트엔드 컴포넌트 신규 추가 시
```
□ TypeScript props 타입 정의
□ 로딩 상태 prop 또는 내부 상태 처리
□ 모바일 반응형 레이아웃 확인
□ 소상공인 친화적 한글 레이블/메시지
```

### 데이터베이스 스키마 변경 시
```
□ supabase_schema.sql에 ALTER TABLE IF NOT EXISTS로 추가
□ 파일 하단에 버전 주석 추가 (-- vX.X ...)
□ CLAUDE.md 데이터베이스 테이블 목록 업데이트
□ 인덱스 필요 여부 검토
□ Supabase SQL Editor에서 직접 실행 확인
```

### AI 스캐너 신규 추가 시
```
□ multi_scanner.py에 통합 (병렬 실행 목록에 추가)
□ API 키 미설정 시 skip 처리
□ CLAUDE.md 기술 스택 표에 추가
□ 비용 추정 후 비용 관리 표 업데이트
□ scan_results 테이블에 결과 컬럼 추가 (schema 변경 체크리스트 수행)
□ ResultTable.tsx UI에 신규 플랫폼 표시 추가
□ score_engine.py 가중치 조정 검토
```

---

## 점검 기록

| 날짜 | 버전 | 점검 범위 | 발견 이슈 | 처리 결과 |
|------|------|----------|----------|----------|
| 2026-03-29 | v1.7 | 전체 최초 점검 체크리스트 작성 | — | — |

---

*최종 업데이트: 2026-03-29 | v1.7 기준*
