# 홈페이지 접속/로딩 속도 점검 (2026-08-01)

> 사용자 요청: "각 페이지의 접속/로딩 속도가 느린것 같은데 상세히 점검" — 실측 기반 점검 결과.

## 0. 점검 방법과 중요 캐비엇

원격 curl 측정(내 세션 네트워크 → Cloudflare → origin)과 서버 로컬 측정(SSH 후 localhost)을 병행했고,
원격 측정치는 **비교 대조군**(google.com, cloudflare.com)으로 반증했다. 이 캐비엇을 먼저 밝힌다:

- 내 세션에서 `https://aeolab.co.kr/`을 curl하면 TTFB 550~700ms가 나왔으나, 같은 세션에서
  `https://www.google.com/`(TTFB 504ms), `https://www.cloudflare.com/`(TTFB 411ms)도 비슷하게 느리게
  나왔다 → **이건 앱 문제가 아니라 내 점검 환경의 네트워크 경로 지연**이다.
- origin IP(115.68.231.57)에 Cloudflare를 우회해 직접 접속하면 TTFB 65ms로 정상.
- **따라서 이 문서의 "실제 한국 사용자 체감 속도"는 이번 점검으로 확정할 수 없다.** 사용자가 실제
  크롬 개발자도구(Network 탭, "느려진다"고 느낀 그 브라우저에서 직접) 또는 PageSpeed Insights /
  WebPageTest 같은 한국 리전 실측 도구로 재확인하는 걸 권장.

## 1. 확인된 사실 (근거 + 반증)

### 1-A. 서버/앱 자체는 느리지 않음
- **근거**: 서버 localhost에서 프론트엔드 직접 curl → `/`, `/pricing`, `/login`, `/signup` 전부 TTFB 4~6ms
  (Next.js ISR 캐시 HIT). origin IP 직결 TTFB 65ms.
- **반증 시도**: 3회 반복 측정, 페이지별 재확인 — 전부 일관되게 빠름. 문제 없음 확정.

### 1-B. 홈페이지(비로그인 방문자 포함) JS 페이로드 349KB(gzip) 중 Sentry SDK가 129KB(37%)
- **근거**: 홈페이지가 로드하는 15개 JS 청크의 gzip 합산 349,909B(~349KB). 이 중 가장 큰 청크
  `3743pnb5op7et.js`(raw 417KB / gzip 129KB)를 문자열 검색하니 `sentry` 시그니처 121회 매치,
  `recharts`/`d3` 등은 0회 — 이 청크 대부분이 `@sentry/nextjs` 클라이언트 SDK.
  `frontend/instrumentation-client.ts`에 `tracesSampleRate: 0.1`이 설정돼 있어 브라우저 트레이싱
  통합이 기본 번들에 포함됨.
- **반증 시도**: 이 청크가 실제로 홈페이지 HTML의 `<script>` 태그에 포함되는지 직접 확인(포함 확인,
  `/`, `/pricing` 둘 다 로드). 로그인 필요 없는 방문자에게도 매번 나가는 비용 확정.
- **영향**: 마케팅 랜딩페이지 기준 349KB gzip은 다소 무거운 편(권장선 150~200KB대). 특히 CLAUDE.md가
  강조하는 모바일 사용자 비중을 고려하면 파싱·실행 시간에 영향.

### 1-C. middleware.ts의 Supabase Auth 검증(getUser) 자체는 병목이 아님 — 우려했으나 반증됨
- **근거**: `middleware.ts`가 `/dashboard` 등 거의 모든 보호 경로 + `/`, `/pricing`까지 매 요청마다
  `supabase.auth.getUser()`로 Supabase Auth 서버에 JWT 검증 요청을 보낸다(코드 자체는 CLAUDE.md 지침대로
  보안을 위해 의도된 설계). Supabase Auth 엔드포인트를 서버에서 직접 5회 반복 curl한 결과 콜드 1회
  383ms, 이후 30~50ms — 연결 재사용 시 무시할 수준.
- **반증 시도**: Supabase REST(`/rest/v1/`) 엔드포인트도 동일 패턴(콜드 320ms, 웜 30~40ms)으로 별도
  측정해 대조 — Supabase Cloud 자체가 이 서버에서 가깝고 빠름을 확인. 이 항목은 문제 없음으로 결론.

### 1-D. 대시보드 페이지 쿼리는 이미 병렬화되어 있음 — 추가 병목 아님
- **근거**: `frontend/app/(dashboard)/dashboard/page.tsx:60-81`에 "서로 의존관계 없는 조회 5개 ...
  순차 실행하던 것을 하나로 병합" 주석과 함께 `Promise.all` 사용 확인. 이후 `business.id`가 필요한
  2단계 쿼리(스캔결과·경쟁사·이력 등)도 별도 `Promise.all`로 묶여 있음(불가피한 2단계 워터폴,
  business_id를 알아야 하는 구조적 제약).
- **반증 시도**: 코드 직접 Read로 순차 await 패턴이 남아있는지 확인 — 남아있지 않음. 과거(2026-07)
  세션에서 이미 이 문제를 고친 이력과 일치.

### 1-E. backend `/health` 응답이 콜드 640ms, 웜 130~160ms — 원인 미확정, 후속 조사 필요
- **근거**: 서버 localhost에서 `/health` 5회 반복 측정 결과 130~160ms로 일관. 이 엔드포인트는
  Supabase에 `businesses` 테이블 1행 select만 하는데, 같은 서버에서 Supabase REST를 직접 두드리면
  30~40ms(웜)였다 — `/health` 쪽이 3~4배 더 걸림.
- **반증 시도 안 됨 — 원인 미확정**: supabase-py 클라이언트 오버헤드인지, FastAPI 이벤트루프 스케줄링
  지연인지, psutil 메모리체크 코드 때문인지 이번 점검에서 격리하지 못했다. **P2로 분류** — `/health`
  자체는 사용자 체감과 무관(모니터링용)이지만, 같은 supabase-py 호출 패턴이 실제 리포트 API
  (`report.py`의 여러 엔드포인트)에서 반복되면 곱연산으로 누적될 잠재력이 있어 후속 조사 대상으로만
  남긴다.

### 1-F. 이미지/정적 자산은 문제 없음
- **근거**: `frontend/public/` 전체 2MB, 큰 PNG/JPG 없음. `app/(public)/` 랜딩 트리에 raw `<img>` 태그
  0건(grep 확인) — `next/image` 사용 중으로 최적화 경로 정상.

## 2. 미확정 — 이번 점검에서 다루지 못한 것

- **실제 로그인 후 대시보드/가이드/경쟁사 등 리포트 API의 엔드투엔드 응답시간**: 인증 세션이 필요해
  이번 점검에선 측정 못 함. `report.py`의 여러 엔드포인트가 Supabase 쿼리를 몇 번 순차로 호출하는지
  코드 정적 분석은 가능하지만, 실측 없이는 "느리다"고 단정할 근거가 부족해 보류.
- **한국 리전 기준 실사용자 체감 속도**: §0 캐비엇 참조. 원격 측정 신뢰 불가.

## 3. 조치 완료 — Sentry 클라이언트 번들 지연 로드 (2026-08-01)

### 3-A. 최초 가설(tracesSampleRate 하향)이 틀렸음을 소스 코드로 반증
- 사용자가 "tracesSampleRate 낮추기"를 선택했으나, 구현 전 `@sentry/nextjs` v10.69.0 소스
  (`node_modules/@sentry/nextjs/build/esm/client/index.js`의 `getDefaultIntegrations()`)를 직접 읽어
  `browserTracingIntegration()` 포함 여부가 `tracesSampleRate` 값과 무관하게 오직 빌드타임 상수
  `__SENTRY_TRACING__`에만 의존함을 확인 — **tracesSampleRate를 낮춰도 번들 크기는 그대로**.
- `__SENTRY_TRACING__`을 끄는 공식 경로(`withSentryConfig({webpack:{treeshake:{removeTracing:true}}})`)는
  webpack 전용이며, 이 프로젝트는 **Turbopack으로 빌드**(빌드 산출물에 `turbopack-*.js` 청크 확인).
  Sentry의 Turbopack 빌드 설정(`constructTurbopackConfig.js`)에는 이 트리셰이킹 로직 자체가 없음을
  코드로 확인 — 이 SDK 버전+Turbopack 조합에서 tracesSampleRate로 번들을 줄일 방법 자체가 없음.
- 사용자에게 이 반증 결과를 보고 후 대안(랜딩페이지 지연 초기화)으로 재확인 받고 진행.

### 3-B. 구현 — 동적 import + idle 지연 초기화
- `frontend/instrumentation-client.ts`: 최상단 정적 `import * as Sentry from "@sentry/nextjs"`를
  `requestIdleCallback`(폴백 `setTimeout`) 콜백 내부의 동적 `import("@sentry/nextjs")`로 교체.
  번들러가 Sentry 코드를 별도 비동기 청크로 분리해, 초기 페이지 스크립트 목록에서 제외되고
  hydration 이후 idle 시점에만 로드됨. 트레이드오프: 그 지연 구간(수백ms)의 초기 에러는 못 잡을 수
  있음(사용자 승인 후 진행).
- `app/error.tsx`·`app/global-error.tsx`가 에러 바운더리로서 `@sentry/nextjs`를 정적 import하고
  있어(에러 캡처를 위해 항시 대기 필요, 의도된 설계) 그 경로로 딸려 들어가는 일부(gzip 약 60KB raw
  기준)는 여전히 초기 번들에 남음 — 완전 제거가 아니라 "블로킹 경로에서 대부분 제외"가 목표.

### 3-C. 배포 후 실측 검증
- 서버 `npm run build` 성공, `pm2 restart aeolab-frontend` 후 에러 로그(flush 후 재요청) 0건.
- 홈페이지 초기 HTML의 `<script>` 태그에 `sentry` 문자열 매치 0건(재빌드 후 청크 해시 변경, 직접
  grep 확인) — 이전엔 129KB(gzip) 청크가 초기 목록에 있었음.
- 초기(블로킹) JS 페이로드: **349KB → 297KB(gzip)로 약 52KB(15%) 감소**. 나머지 Sentry 무게
  (browserTracingIntegration 포함, gzip 170KB)는 별도 청크(`0vpybkhms3gdj.js`)로 분리돼 초기 스크립트
  목록엔 없고 HTTP 200으로 정상 fetch 가능함을 확인 — 즉 총 전송량이 아니라 **초기 파싱을 막던
  경로에서 대부분 제외**된 것이 핵심 효과.
- 라이브(`https://aeolab.co.kr/`, `/pricing`) HTTP 200 확인.

## 4. 결론 요약

"느린 것 같다"는 체감의 실체는 이번 점검 결과 **서버·Next.js 렌더링·백엔드 인증 자체는 아니다** (전부
반증됨). 실측으로 확정된 개선 여지였던 **Sentry 클라이언트 번들의 초기 로딩 블로킹**은 동적 import
지연 로드로 조치 완료(§3, 초기 블로킹 JS 15% 감소). 나머지(P2 `/health` 오버헤드, 실제 로그인 후 API
응답시간)는 후속 실측이 필요해 단정하지 않는다.
