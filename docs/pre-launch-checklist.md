# AEOlab 출시 전 전체 심층 점검 체크리스트

> 버전: v3.0 | 최초 작성: 2026-04-03 | 마지막 점검: 2026-04-05 (6차 점검 + scan.py grace_period 누락 수정 + X-Forwarded-For 스푸핑 방지 + Perplexity 점수 0 버그 + trial 체크박스 점수 미반영 + asyncio deprecated 교체 + teams.py 플랜 체크 누락 + api_keys 404 처리 + 회원가입 에러 한국어 + UptimeRobot 설정 완료)  
> 목적: 매 배포 전, 기능 추가 후, 정기 점검 시 동일한 기준으로 품질을 검증한다.  
> 사용법: 이미 확인된 항목은 [x], 확인 필요 항목은 [ ], 이슈 발생 시 하단 이슈 섹션에 기록.  
> Critical/High 미통과 시 배포 금지.

---

## 점검 결과 요약 (2026-04-05 기준 — 6차 점검)

| 등급 | 건수 | 내용 |
|------|------|------|
| Critical | **0** | ~~C-01 결제 이중호출~~ ✅ / ~~C-02 scan.py grace_period 스캔 차단~~ ✅ 2026-04-05 수정 / ~~C-03 X-Forwarded-For 스푸핑~~ ✅ 2026-04-05 수정 |
| High | **1** | ~~H-01~H-05 전체~~ ✅ / **H-06 jobs.py 동기 DB 호출** → BEP 후 처리 유보 |
| Medium | **1** | ~~전체~~ ✅ / **M-06 개인정보처리방침 수집항목** 미확인 (수동 검토 필요) |
| 6차 신규 발견 | ~~10~~ → **0** | ~~Perplexity 점수 0 버그~~ ✅ / ~~trial 체크박스 점수 미반영~~ ✅ / ~~asyncio deprecated~~ ✅ / ~~teams.py 플랜 체크 누락~~ ✅ / ~~api_keys 404 처리~~ ✅ / ~~회원가입 에러 한국어~~ ✅ / ~~billing_key 노출~~ ✅ / ~~competitor TimeoutError~~ ✅ / ~~startup PLAN_RANK 미사용~~ ✅ / ~~알림 토글 롤백 누락~~ ✅ |
| 운영 모니터링 | **완료** | SSL 자동갱신 ✅ / **UptimeRobot ✅ 2026-04-05 설정 완료** (`https://aeolab.co.kr/health`, 5분 간격, 이메일 알림) |
| 결제/빌드 | **부분** | 빌드 ✅ (34페이지) / E2E 결제 테스트 미완 / Toss webhook URL 미확인 |
| 통과 | 다수 | 아래 섹션별 상세 기술 |

---

## 1. 보안 (Security)

### 1-1. 인증 미들웨어

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| get_current_user 적용 | scan.py `/full`, `/stream/prepare`, `/{scan_id}` | [x] 확인됨 | Depends(get_current_user) |
| get_current_user 적용 | report.py 모든 엔드포인트 | [x] 확인됨 | score/history/competitors/before-after/market 전체 |
| get_current_user 적용 | guide.py 모든 엔드포인트 | [x] 확인됨 | generate/latest/review-reply/qr-card/ad-defense |
| get_current_user 적용 | competitor.py 모든 엔드포인트 | [x] 확인됨 | search/add/list/delete |
| get_current_user 적용 | startup.py `/report` | [x] 확인됨 | |
| admin.py 보호 | verify_admin (Header X-Admin-Key + secrets.compare_digest) | [x] 확인됨 | |
| trial 비인증 허용 | scan.py `/trial` | [x] 의도된 설계 | IP 레이트리밋 적용됨 |
| ranking/benchmark 비인증 허용 | report.py | [x] 의도된 설계 | 공개 API |

### 1-2. 소유권 검증 (user_id 비교)

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| _verify_biz_ownership | report.py: score/history/competitors/before-after/market | [x] 확인됨 | 404 반환 (403 아닌 이유: 존재 노출 방지) |
| _verify_biz_ownership | guide.py: latest/review-reply/qr-card/ad-defense | [x] 확인됨 | |
| 사업장 소유권 검증 | competitor.py add: biz.user_id != x_user_id → 403 | [x] 확인됨 | |
| 경쟁사 소유권 검증 | competitor.py delete: competitor → business → user_id 체인 | [x] 확인됨 | |
| SSE 스트림 소유권 | scan.py stream: biz.eq("user_id", user_id) | [x] 확인됨 | |
| 스캔 결과 소유권 | scan.py `/{scan_id}`: business의 user_id 확인 | [x] 확인됨 | |

### 1-3. 환경변수 노출 위험

| 항목 | 상태 | 비고 |
|------|------|------|
| SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_ 접두사 없음 | [x] 확인됨 | package.json에 없음 |
| ADMIN_SECRET_KEY NEXT_PUBLIC_ 접두사 없음 | [x] 확인됨 | |
| TOSS_SECRET_KEY NEXT_PUBLIC_ 접두사 없음 | [x] 확인됨 | |
| admin-proxy: ADMIN_KEY는 서버 사이드에서만 사용 | [x] 확인됨 | process.env.ADMIN_SECRET_KEY (서버 전용) |
| **[CRITICAL] admin-proxy 자체 인증 없음** | **[x] 수정됨 (2026-04-03)** | Supabase getUser + ADMIN_EMAILS 이중 인증 추가 |
| **ADMIN_EMAILS fallback 하드코딩** | **[x] 수정됨 (2026-04-04)** | admin-auth/route.ts + admin-proxy/route.ts 2곳 fallback `""` + `.filter(Boolean)` 적용 |

**Critical 이슈 — admin-proxy/route.ts**

`frontend/app/api/admin-proxy/route.ts`는 Supabase 세션 인증 없이 모든 요청을 백엔드 `/admin/*`에 프록시한다. 백엔드 `verify_admin`이 X-Admin-Key 헤더로 보호하고, 이 키는 서버 사이드 환경변수라 클라이언트에 노출되지 않는다. 그러나 `admin-auth/route.ts`를 통해 인증된 관리자 세션을 확인하는 절차가 `admin-proxy/route.ts` 내부에 없다.

현재 흐름:
1. `AdminDashboard.tsx` 클라이언트가 먼저 `/api/admin-auth` 호출 → 관리자 이메일 검증
2. 성공하면 관리자 키를 받아 이후 `/api/admin-proxy`를 호출

문제: `/api/admin-proxy`는 직접 호출 가능하다. 즉 `admin-auth`를 거치지 않고 누군가 `/api/admin-proxy?path=admin/stats`를 직접 호출하면 백엔드의 `X-Admin-Key`가 서버 사이드에서 자동 첨부되어 관리자 데이터가 노출된다. 백엔드 자체가 `ADMIN_SECRET_KEY`로 최종 보호되고 있으나 이 키가 유출된 경우 이중 방어가 없다.

권고: `admin-proxy/route.ts` 내부에서도 Supabase 세션 + ADMIN_EMAILS 확인을 추가해야 한다.

### 1-4. CORS / 보안 헤더

| 항목 | 상태 | 비고 |
|------|------|------|
| CORS allow_origins 명시적 지정 | [x] 확인됨 | aeolab.co.kr + localhost:3000 |
| allow_methods 명시적 제한 | [x] 확인됨 | GET/POST/PATCH/DELETE/OPTIONS (5개) |
| SecurityHeadersMiddleware | [x] 확인됨 | X-Content-Type-Options/X-Frame-Options/X-XSS-Protection |
| GZipMiddleware | [x] 확인됨 | 1KB 이상 자동 압축 |
| 운영 환경 Swagger UI 비활성화 | [x] 확인됨 | APP_ENV=production 시 docs_url=None |
| 운영 환경 오류 상세 숨김 | [x] 확인됨 | global_exception_handler |

### 1-5. SQL Injection / 데이터 접근

| 항목 | 상태 | 비고 |
|------|------|------|
| Supabase 클라이언트 파라미터 바인딩 사용 | [x] 확인됨 | f-string SQL 없음 |
| 전화번호 로그 마스킹 | [x] 부분 확인됨 | kakao_notify.py에서 마스킹 처리 |
| admin.py broadcast: phone 마스킹 | [x] 수정됨 (2026-04-03) | `010****89` 형식으로 변경 완료 |

### 1-6. Rate Limiting

| 항목 | 상태 | 비고 |
|------|------|------|
| Trial IP 레이트리밋 | [x] 확인됨 | _TRIAL_LIMIT_PER_DAY=3 (운영값 정상) |
| Trial 인메모리 캐시 TTL=24h | [x] 확인됨 | _cache.set(key, 1, 86400) |
| 월별 스캔 한도 (rate_limit.py) | [x] 확인됨 | check_monthly_scan_limit |
| 하루 수동 스캔 한도 (plan_gate.py) | [x] 확인됨 | check_manual_scan_limit |
| 관리자 IP 우회 | [x] 확인됨 | _ADMIN_IPS + X-Admin-Key |

---

## 2. 데이터 정합성 (Data Integrity)

### 2-1. 플랜 가격 3곳 일치 여부

| 플랜 | webhook.py (PLAN_PRICES) | plans.ts (amount) | AdminDashboard.tsx | 일치 |
|------|--------------------------|-------------------|--------------------|------|
| basic | 9,900 | 9,900 | 9,900 | [x] |
| pro | 22,900 | 22,900 | 22,900 | [x] |
| biz | 49,900 | 49,900 | 49,900 | [x] |
| startup | 16,900 | 16,900 | 16,900 | [x] |
| enterprise | 200,000 | — | 200,000 | [x] (plans.ts에 없음 — 이메일 영업 전용) |

모든 플랜 가격 3곳 일치 확인됨.

### 2-2. pricing 페이지 비교표 vs plans.ts 기능 한도

| 항목 | pricing 비교표 | plan_gate.py PLAN_LIMITS | 일치 |
|------|--------------|--------------------------|------|
| Basic 자동 스캔 | 주 1회 | auto_scan_mode="basic" | [x] |
| Basic 경쟁사 | 3곳 | competitors=3 | [x] |
| Basic 가이드 | 월 1회 | guide_monthly=1 | [x] |
| Basic 리뷰답변 | 월 10회 | review_reply_monthly=10 | [x] |
| Basic 히스토리 | 30일 | history_days=30 | [x] |
| Basic CSV | — | csv=False | [x] |
| Basic PDF | — | pdf=False | [x] |
| Pro 자동 스캔 | 주 3회 | auto_scan_mode="pro" | [x] |
| Pro 경쟁사 | 10곳 | competitors=10 | [x] |
| Pro 가이드 | 월 8회 | guide_monthly=8 | [x] |
| Pro 리뷰답변 | 월 50회 | review_reply_monthly=50 | [x] |
| Pro 히스토리 | 90일 | history_days=90 | [x] |
| Pro CSV | ✓ | csv=True | [x] |
| Pro PDF | ✓ | pdf=True | [x] |
| Pro 광고대응 | ✓ | ad_defense=True | [x] |
| **창업패키지 경쟁사** | **5곳** | **competitors=5** | **[x]** |
| Biz 경쟁사 | 무제한 | competitors=999 | [x] |
| Biz 리뷰답변 | 무제한 | review_reply_monthly=999 | [x] |
| **창업 시장 분석** | Biz=✓, 창업=✓ | startup_report: biz=True, startup=True | **[ ] 주의** |

주의: pricing 비교표 (pricing/page.tsx line 60) "창업 시장 분석 — ✓, ✓" 4번째 열이 창업패키지를 의미하는지 명확하지 않음. 현재 배열은 [Basic, Pro, Biz, 창업패키지] 순서이므로 창업패키지 열에 "✓"가 맞음. 확인 요망.

### 2-3. DB 컬럼 vs 코드 일치

| 항목 | 상태 | 비고 |
|------|------|------|
| scan_results: track1_score/track2_score/unified_score/keyword_coverage | [x] 확인됨 | v3.0 마이그레이션 완료 |
| score_history: track1_score/track2_score/unified_score | [x] 확인됨 | v3.0 마이그레이션 완료 |
| scan_results.user_id 직접 참조 없음 | [x] 확인됨 | businesses 경유 user_id 조회 |
| Storage 버킷명 before-after (하이픈) | [x] 확인됨 | jobs.py before-after 사용 |
| score_history context 컬럼 | [x] 확인됨 | v2.1 마이그레이션 완료 |

---

## 3. API 안정성 (API Reliability)

### 3-1. 에러 핸들링

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| except Exception as e: logger 패턴 | 전체 라우터 | [x] 확인됨 | `except Exception: pass` 패턴 없음 |
| 글로벌 예외 핸들러 | main.py | [x] 확인됨 | global_exception_handler → JSON 반환 |
| guide 백그라운드 태스크 예외 처리 | guide.py _generate_and_save | [x] 확인됨 | logger.error + exc_info=True |
| scan 백그라운드 저장 예외 처리 | scan.py _save | [x] 확인됨 | logger.warning |

### 3-2. None/null 안전성

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| score.get("total_score") or 0 | report.py | [x] 확인됨 | |
| result.data[0] 접근 전 빈 리스트 체크 | report.py | [x] 확인됨 | `if not row: raise 404` |
| competitors 없을 시 Fallback | gap_analyzer.py | [x] 확인됨 | v2.8에서 수정됨 |
| naver_data None 처리 | scan.py trial | [x] 확인됨 | `naver_data or {}` |

### 3-3. 비동기 처리

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| Supabase execute() await 적용 | report.py, guide.py, competitor.py | [x] 확인됨 | |
| **jobs.py 동기 호출** | **scheduler/jobs.py** | **[ ] High** | **아래 상세 참조** |

**High 이슈 — scheduler/jobs.py 동기 DB 호출**

`jobs.py` daily_scan_all 내부에서 (line 102~108, 141~178) `supabase.table(...).execute()` 패턴을 사용한다. 이는 `await execute(...)` 래퍼 없이 직접 Supabase 동기 클라이언트를 호출하는 형태다. AsyncIOScheduler 환경에서 동기 블로킹 호출은 이벤트 루프를 점유한다. 구독자 수가 적은 초기에는 무방하나 20명 이상에서는 새벽 스캔이 지연될 수 있다.

권고: `await asyncio.to_thread(...)` 래핑 또는 `execute()` 래퍼 적용을 구독자 50명 이전에 처리.

### 3-4. Playwright RAM 제한

| 항목 | 상태 | 비고 |
|------|------|------|
| PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(1) | [x] 확인됨 | multi_scanner.py line 12 |
| Playwright 직렬 실행 후 2초 대기 | [x] 확인됨 | asyncio.sleep(2) |

---

## 4. 비즈니스 로직 (Business Logic)

### 4-1. Trial 스캔 제한

| 항목 | 파일:라인 | 상태 | 비고 |
|------|----------|------|------|
| _TRIAL_LIMIT_PER_DAY = 3 (운영값) | scan.py:61 | [x] 확인됨 | 개발값 20이 아닌 3으로 복구됨 |
| IP 기반 카운터 24시간 TTL | scan.py:92~109 | [x] 확인됨 | 인메모리 캐시 |
| 관리자 IP 우회 | scan.py:80~89 | [x] 확인됨 | |

### 4-2. 구독 플랜 상태 체크

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| status === "active" 체크 (프론트) | dashboard/page.tsx:198 | [x] 확인됨 | `subscription?.status === "active" ? plan : "free"` |
| status != "active" 차단 (백엔드) | guide.py review-reply:140 | [x] 확인됨 | `_status != "active" → 403` |
| status != "active" 차단 (백엔드) | guide.py qr-card:269 | [x] 확인됨 | |
| status != "active" 차단 (백엔드) | guide.py ad-defense:332 | [x] 확인됨 | |
| get_user_plan: status="active" 체크 | plan_gate.py:105 | [x] 확인됨 | .eq("status", "active") |
| layout.tsx 플랜 표시 | layout.tsx:34 | [x] 확인됨 | `sub?.status === "active" ? plan : null` |

### 4-3. @require_plan 데코레이터 적용

현재 `@require_plan` 데코레이터 대신 인라인 구독 체크 패턴 사용 중. 기능적으로 동일하나 코드 중복이 있음.

| 기능 | 방식 | 상태 |
|------|------|------|
| 가이드 생성 한도 | check_guide_limit() 함수 | [x] |
| 리뷰답변 한도 | check_review_reply_limit() 함수 | [x] |
| 경쟁사 한도 | PLAN_LIMITS 직접 참조 | [x] |
| startup/ad-defense | 인라인 plan 체크 | [x] |

### 4-4. 모델 엔진 v3.0 정합성

| 항목 | 상태 | 비고 |
|------|------|------|
| WEIGHTS 6항목 dict 제거 완료 | [x] 확인됨 | DUAL_TRACK_RATIO + 트랙별 가중치로 대체 |
| GrowthStage: track1_score 기준 | [x] 확인됨 | score_engine.py |
| zeta_result 참조 제거 완료 | [x] 확인됨 | 백엔드·프론트 전체 grep 결과 없음 |
| zeta_scanner.py 삭제 완료 | [x] 확인됨 | multi_scanner.py import 없음 |
| expected_effect 필드 백엔드 존재 여부 | [x] 수정됨 (2026-04-03) | types/action.ts ActionItem에서 제거 완료 |

**Medium 이슈 — expected_effect 타입 잔존**

`frontend/types/action.ts:11`에 `expected_effect: string` 필드가 ActionItem 인터페이스에 남아있다. v2.5에서 "근거 없는 % 예측 금지" 방침에 따라 삭제 예정이었으나 타입 파일에서 제거되지 않았다. 백엔드 Python 모델에서는 삭제 확인됨. 타입 불일치 상태.

권고: `frontend/types/action.ts`의 ActionItem에서 `expected_effect: string` 제거.

### 4-5. 구독 만료/Grace Period

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| subscription_lifecycle_job | jobs.py:19 | [x] 확인됨 | 매일 새벽 1시 실행 |
| grace_until 컬럼 | supabase_schema.sql | [x] 확인됨 | v1.1에서 추가됨 |

---

## 5. 프론트엔드 (Frontend)

### 5-1. 인증 보호

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| 대시보드 레이아웃 세션 체크 | layout.tsx:10~14 | [x] 확인됨 | createClient + getUser + redirect("/login") |
| dashboard/page.tsx 세션 체크 | page.tsx:115~116 | [x] 확인됨 | |
| admin 페이지 인증 | admin-auth/route.ts + AdminDashboard | [x] 확인됨 | ADMIN_EMAILS 환경변수 + fallback `""` + `.filter(Boolean)` 적용 완료 (2026-04-04) |

~~**Medium 이슈 — admin-auth 이메일 하드코딩**~~ ✅ **수정 완료 (2026-04-04)**

`admin-auth/route.ts` / `admin-proxy/route.ts` 2곳 모두 fallback을 `""` + `.filter(Boolean)`으로 교체. 서버 `.env`에 `ADMIN_EMAILS=hoozdev@gmail.com` 명시 설정 완료.

### 5-2. @supabase/auth-helpers-nextjs

| 항목 | 상태 | 비고 |
|------|------|------|
| package.json에서 제거됨 | [x] 확인됨 | `@supabase/ssr`만 사용 |
| ~~**package-lock.json에 잔재**~~ | **[x] 확인됨 (2026-04-04)** | 실제 grep 결과 0건 — 이미 정리 완료 |

~~**High 이슈 — package-lock.json auth-helpers 잔재**~~ ✅ **해결 확인 (2026-04-04)**

`package-lock.json` 전체 grep 결과 `auth-helpers-nextjs` 0건. 이미 정리 완료 상태. 추가 조치 불필요.

### 5-3. 반응형 / 가독성

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| p-8 → p-4 md:p-8 반응형 | 주요 페이지 | [x] 확인됨 | v3.1 가독성 개선 적용됨 |
| 테이블 overflow-x-auto | history/page.tsx | [x] 확인됨 | |
| text-xs 단독 사용 | 주요 페이지 | [x] 확인됨 | grep 결과 없음 |
| 모바일 스크롤 잠금 | DashboardSidebar.tsx | [x] 확인됨 | document.body.style.overflow |

### 5-4. 로딩/에러 상태

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| 스캔 진행 중 버튼 disabled | ScanTrigger.tsx | [x] 확인됨 | "준비 중…" 표시 |
| 스캔 완료 성공 메시지 | ScanTrigger.tsx | [x] 확인됨 | 5초 표시 |
| 스캔 한도 초과 안내 | ScanTrigger.tsx | [x] 확인됨 | "새벽 2시 자동 스캔" 안내 |
| 경쟁사 없음 Empty State | CompetitorsClient.tsx | [x] 확인됨 | 이모지+안내문구 |
| 가이드 로딩 skeleton | GuideClient.tsx | [x] 확인됨 | gapLoading pulse |
| Trial 쿨다운 카운트다운 | trial/page.tsx | [x] 확인됨 | amber 배너 |

### 5-5. Next.js 16 호환성

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| cookies() await 처리 | lib/supabase/server.ts | [x] 확인됨 | createClient async |
| createClient() async | layout.tsx, dashboard/page.tsx | [x] 확인됨 | `await createClient()` |
| searchParams: Promise<...> | dashboard/page.tsx:109 | [x] 확인됨 | `await searchParams` |

---

## 6. 스케줄러 (Scheduler)

### 6-1. 등록된 잡 목록

| 잡 ID | 실행 시간 | 상태 | 비고 |
|-------|----------|------|------|
| daily_scan | 새벽 2시 매일 | [x] 확인됨 | |
| weekly_notify | 월요일 오전 9시 | [x] 확인됨 | |
| daily_notify | 매일 오전 9:10 | [x] 확인됨 | |
| subscription_lifecycle | 새벽 1시 매일 | [x] 확인됨 | |
| after_screenshot | 오전 8시 매일 | [x] 확인됨 | |
| monthly_market_news | 매월 1일 오전 10시 | [x] 확인됨 | |
| competitor_overtake | 새벽 3시 매일 | [x] 확인됨 | |
| memory_cleanup | 10분마다 | [x] 확인됨 | TTL 캐시 + SSE 토큰 |
| competitor_excerpts | 새벽 4시 매일 | [x] 확인됨 | |
| detect_new_competitors | 월요일 오전 4:30 | [x] 확인됨 | |
| keyword_alert | 오전 8시 매일 | [x] 확인됨 | |
| trial_followup | 오전 10시 매일 | [x] 확인됨 | |
| low_rating_check | 6시간마다 | [x] 확인됨 | |
| monthly_growth_report | 매월 1일 오전 9시 | [x] 확인됨 | |
| weekly_post_draft | 월요일 오전 9시 | [x] 확인됨 | |
| monthly_growth_card | 매월 말일 오후 6시 | [x] 확인됨 | |

### 6-2. 스캔 전략 정합성

| 플랜 | 실제 동작 (jobs.py) | plans.ts 설명 | 일치 |
|------|-------------------|--------------|------|
| basic | 평일=Gemini+네이버, 월요일=풀스캔 | 매일+월요일 전체 | [x] |
| startup | 동일 basic | 매일+월요일 전체 | [x] |
| pro | 월·수·금=풀스캔, 나머지=기본 | 주 3회 | [x] |
| biz/enterprise | 매일 풀스캔 | 매일 | [x] |
| Perplexity | 월요일 풀스캔에서만 | 별도 명시 없음 | [x] 비용 최적화 |

---

## 7. 알림 시스템 (Notifications)

### 7-1. Slack 알림

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| send_slack_alert 구현 | utils/alert.py | [x] 확인됨 | httpx 비동기, timeout=10 |
| SLACK_WEBHOOK_URL 미설정 시 graceful skip | alert.py:12~13 | [x] 확인됨 | logger.debug만 출력 |
| 운영 환경에서 실제 호출 여부 | — | [ ] 미확인 | SLACK_WEBHOOK_URL 서버 .env 설정 여부 확인 필요 |

### 7-2. 카카오 알림

| 항목 | 상태 | 비고 |
|------|------|------|
| 카카오 알림 템플릿 5종 심사 중 | [ ] 승인 대기 | 승인 후 KAKAO_APP_KEY/KAKAO_SENDER_KEY 입력 필요 |
| 전화번호 마스킹 (kakao_notify.py) | [x] 확인됨 | `010****89` 형태 |

---

## 8. 성능 (Performance)

| 항목 | 파일 | 상태 | 비고 |
|------|------|------|------|
| ranking N+1 제거 (단일 IN 쿼리) | report.py:217~231 | [x] 확인됨 | |
| ranking 30분 캐시 | report.py:_TTL_RANKING=1800 | [x] 확인됨 | |
| benchmark 1시간 캐시 | report.py:_TTL_BENCHMARK=3600 | [x] 확인됨 | |
| market overview 30분 캐시 | startup.py:_TTL_MARKET=1800 | [x] 확인됨 | |
| market biz_id 30분 캐시 | report.py:get_market | [x] 확인됨 | |
| benchmark ilike 접두어 매칭 | report.py | [x] 확인됨 | `region%` (인덱스 활용) |
| SELECT * 없음 | report.py | [x] 확인됨 | 필요 컬럼만 명시 |

---

## 9. 도메인 모델 일관성

| 항목 | 상태 | 비고 |
|------|------|------|
| WEIGHTS 6항목 dict 전면 제거 | [x] 확인됨 | |
| DUAL_TRACK_RATIO 적용 | [x] 확인됨 | score_engine.py |
| NAVER_TRACK_WEIGHTS / GLOBAL_TRACK_WEIGHTS | [x] 확인됨 | |
| GrowthStage: unified_score 아닌 track1_score 기준 | [x] 확인됨 | |
| trial Gemini: 10회 분리 (_run_trial_gemini) | [x] 확인됨 | |
| zeta_result 참조 전면 제거 | [x] 확인됨 | Python + TypeScript 모두 없음 |
| expected_effect 백엔드 제거 | [x] 확인됨 | |
| expected_effect 프론트 타입 잔존 | [x] 수정됨 (2026-04-03) | types/action.ts:11 제거 완료 |

---

## 10. 타입 안전성

| 항목 | 상태 | 비고 |
|------|------|------|
| Pydantic v2 문법 (schemas.py) | [x] 확인됨 | BaseModel 정상 사용 |
| @supabase/auth-helpers-nextjs 코드에서 미사용 | [x] 확인됨 | package.json에 없음 |
| package-lock.json 잔재 | [x] 확인됨 (2026-04-04) | grep 결과 0건 — 이미 정리 완료 |
| TypeScript strict 오류 | [x] 확인됨 (2026-04-04) | npm run build 33개 페이지 오류 없이 성공 |

---

## 11. 운영 모니터링 (Monitoring)

### 11-1. 외부 업타임 모니터링

| 항목 | 상태 | 비고 |
|------|------|------|
| UptimeRobot 모니터링 설정 | [x] 완료 (2026-04-05) | URL: `https://aeolab.co.kr/health`, 5분 간격 |
| 장애 발생 시 이메일 알림 | [x] 완료 (2026-04-05) | `hoozdev@gmail.com` 알림 설정 완료 |

### 11-2. SSL 인증서

| 항목 | 상태 | 비고 |
|------|------|------|
| SSL 인증서 만료일 | [x] 확인됨 | **2026-06-26** 만료 — certbot.timer (systemd) 자동갱신 정상 작동 + cron.d 백업 이중 보호 (2026-04-04 확인) |
| HTTPS 리다이렉트 | [x] 확인됨 | Nginx에서 처리 |

### 11-3. Supabase 무료 티어 한도

| 항목 | 한도 | 상태 |
|------|------|------|
| DB 스토리지 | 500MB | [ ] 사용량 미확인 — Supabase 대시보드에서 확인 필요 |
| 파일 스토리지 (before-after 버킷) | 1GB | [ ] 사용량 미확인 |
| MAU (월간 활성 사용자) | 50,000명 | [ ] 현재 수준 확인 필요 (BEP 20명 수준에서는 무관) |
| Edge Function 호출 | 500,000회/월 | [ ] 미사용 — 해당 없음 |

### 11-4. PM2 설정

| 항목 | 상태 | 비고 |
|------|------|------|
| max_memory_restart: frontend 800M | [x] 확인됨 | ecosystem.config.js |
| max_memory_restart: backend 1G | [x] 확인됨 | ecosystem.config.js |
| 로그 경로 설정 | [x] 확인됨 | `/var/log/pm2/` frontend/backend 각각 |
| pm2-logrotate 설치 | [x] 확인됨 | PM2 모듈 목록에서 online 확인됨 |

### 11-5. 스케줄러 잡 실패 알림

| 항목 | 상태 | 비고 |
|------|------|------|
| 잡 실패 시 `send_slack_alert` 호출 | [x] 확인됨 (2026-04-04) | `from utils.alert import send_slack_alert` import 있음, 각 잡 except 블록에 호출됨 |
| max_instances=1 설정 | [x] 확인됨 (2026-04-04) | 4개 잡 모두 `max_instances=1` 명시 확인 |

---

## 12. 결제 흐름 (Payment)

### 12-1. Toss 설정

| 항목 | 상태 | 비고 |
|------|------|------|
| Toss 대시보드 webhook URL 등록 | [ ] 미확인 | `https://aeolab.co.kr/api/webhook/toss/confirm` 등록 여부 확인 필요 |
| test_sk_ 키 → live_sk_ 전환 준비 | [ ] 심사 후 처리 | Toss 심사 승인 후 교체 필요 |
| TOSS_SECRET_KEY 서버 .env 설정됨 | [x] 확인됨 | (test_sk_ 상태) |

### 12-2. 결제 흐름 시나리오

| 시나리오 | 상태 | 비고 |
|---------|------|------|
| 결제 성공 → 구독 활성화 | [ ] 수동 테스트 필요 | `/payment/success` 콜백 → webhook → subscriptions 테이블 |
| 결제 실패 → 에러 페이지 | [ ] 수동 테스트 필요 | `/payment/fail` 페이지 표시 |
| 자동결제 실패 → grace_period | [ ] 로직 확인 필요 | `webhook.py` 자동결제 실패 분기 처리 여부 |
| 구독 해지 → 기간 만료 후 해지 | [x] 확인됨 | settings.py `cancel` — DB 상태 변경 + 토스 빌링키 삭제 API 호출 (2026-04-04 완성) |
| 카드 변경 | [x] 구현 완료 (2026-04-04) | `/settings/card/update` 백엔드 + `/payment/card-update` 콜백 페이지 + UI 버튼 신규 구현 |

---

## 13. 빌드 검증 (Build Validation)

| 항목 | 상태 | 비고 |
|------|------|------|
| `npm run build` TypeScript 에러 없음 | [x] 확인됨 (2026-04-04) | 33개 페이지 오류 없이 빌드 완료 |
| `npm run build` 출력에 `error` 없음 | [x] 확인됨 (2026-04-04) | 서버에서 빌드 성공 확인 |
| Python 문법 오류 없음 | [x] 확인됨 (2026-04-04) | 7개 핵심 파일 py_compile 통과 |
| 백엔드 시작 시 필수 env 검증 통과 | [x] 확인됨 | `main.py _REQUIRED_ENVS` 체크 — 미설정 시 시작 불가 |

---

## 14. 법적 · 프라이버시 (Legal)

| 항목 | 상태 | 비고 |
|------|------|------|
| 개인정보처리방침 페이지 | [x] 존재 | `app/(public)/privacy/page.tsx` |
| 이용약관 페이지 | [x] 존재 | `app/(public)/terms/page.tsx` |
| 회원가입 시 약관 동의 체크박스 | [x] 확인됨 (2026-04-04) | 필수 2종(이용약관·개인정보) + 선택(마케팅), 미동의 시 제출 차단 정상 |
| 개인정보처리방침 푸터 링크 | [ ] 미확인 | 랜딩·pricing 페이지 푸터에서 링크 연결 여부 |
| 수집 항목 명시 정확성 | [ ] 미확인 | 실제 수집하는 데이터(이메일, 전화번호, 사업장 정보)와 방침 내용 일치 여부 |

---

## 15. 환경변수 완전성 (Env Vars)

서버 `.env` 키 개수: **23개** (`.env.example` 기준 11개 — 서버가 더 많음, 정상)

| 키 그룹 | 상태 | 비고 |
|---------|------|------|
| Supabase URL / ANON_KEY / SERVICE_ROLE_KEY | [x] 설정됨 | |
| GEMINI_API_KEY | [x] 설정됨 | |
| OPENAI_API_KEY | [x] 설정됨 | |
| ANTHROPIC_API_KEY | [x] 설정됨 | |
| PERPLEXITY_API_KEY | [x] 설정됨 | |
| GROK_API_KEY | [x] 설정됨 | |
| NAVER_CLIENT_ID / NAVER_CLIENT_SECRET | [x] 설정됨 | |
| KAKAO_REST_API_KEY | [x] 설정됨 | |
| KAKAO_APP_KEY / KAKAO_SENDER_KEY | [ ] 심사 후 설정 | 알림톡 승인 후 |
| TOSS_SECRET_KEY | [x] 설정됨 | test_sk_ 상태 |
| ADMIN_SECRET_KEY | [x] 설정됨 | |
| APP_ENV=production | [x] 설정됨 | Swagger UI 비활성화됨 |
| SLACK_WEBHOOK_URL | [x] 설정됨 | 테스트 성공 확인됨 |
| SECRET_KEY | [x] 설정됨 | JWT 서명 키 |
| ADMIN_EMAILS | [x] 설정됨 (2026-04-04) | 서버 backend/.env에 `ADMIN_EMAILS=hoozdev@gmail.com` 추가 완료. 코드 fallback도 `""` + `.filter(Boolean)` 교체 |
| BACKEND_URL (frontend .env.local) | [x] 설정됨 (2026-04-04) | `BACKEND_URL=http://localhost:8000` 추가 완료 |

---

## 16. SEO · 메타태그 (SEO)

| 항목 | 상태 | 비고 |
|------|------|------|
| 전역 metadata (layout.tsx) | [x] 확인됨 | title, description, openGraph, twitter 모두 설정됨 |
| og-image.png 파일 존재 | [x] 확인됨 (2026-04-04) | `app/opengraph-image.tsx` ImageResponse 방식으로 구현 (1200×630, edge runtime) |
| sitemap.xml | [x] 확인됨 (2026-04-04) | `app/sitemap.ts` 존재 — `/`, `/trial`, `/pricing`, `/login`, `/signup` 5개 URL |
| robots.txt | [x] 확인됨 (2026-04-04) | `app/robots.ts` 존재 — 대시보드·admin·api 등 10개 경로 disallow |
| pricing 페이지 개별 metadata | [x] 추가됨 (2026-04-04) | `metadata` export 추가 완료 (title, description, openGraph) |
| trial 페이지 개별 metadata | [ ] 불가 | `"use client"` 컴포넌트 — 전역 metadata 상속 (수용 가능) |

---

## 17. AI API 키 유효성 (API Keys Health)

운영 환경에서 각 AI 스캐너 실제 동작 여부 (마지막 확인: 2026-04-03 trial 스캔 성공)

| AI 플랫폼 | 상태 | 마지막 확인 |
|----------|------|------------|
| Gemini Flash (주력) | [x] 정상 | 2026-04-03 trial 스캔 결과 반환 확인 |
| OpenAI GPT-4o-mini | [ ] 미확인 | 별도 단독 테스트 필요 |
| Anthropic Claude (Haiku/Sonnet) | [ ] 미확인 | 별도 단독 테스트 필요 |
| Perplexity | [ ] 미확인 | 월요일 스케줄에서만 실행 |
| Grok | [ ] 미확인 | |
| Naver Playwright | [ ] 미확인 | 네이버 DOM 변경 시 파싱 실패 가능성 있음 |
| Google AI Overview Playwright | [ ] 미확인 | |

---

## 18. 스케줄러 안정성 (Scheduler Stability)

| 항목 | 상태 | 비고 |
|------|------|------|
| `max_instances=1` 명시적 설정 | [ ] **미설정** | APScheduler 기본값은 cron=1이나, 잡 실행 시간이 다음 주기를 넘길 경우 큐에 쌓일 수 있음. 명시 권장 |
| 잡 실패 시 Slack 알림 | [ ] **미구현** | `jobs.py`에 `from utils.alert import send_slack_alert` 없음. 새벽 자동 스캔 실패를 모를 수 있음 |
| 잡 실행 시작/종료 시간 로깅 | [ ] 미확인 | 각 잡 함수 시작 시 `logger.info("daily_scan_all start")` 패턴 여부 |
| daily_scan 완료 시간 (20명 기준 예상) | [ ] 미추정 | 사업장 1개당 약 30~60초 → 20개 시 최대 20분 소요. 새벽 2시 시작 시 3시 이전 완료 예상 |

---

## 발견된 이슈 종합

### Critical (즉시 수정 필요)

~~**[C-01] admin-proxy 자체 인증 없음**~~ ✅ **수정 완료 (2026-04-03)**
- 파일: `frontend/app/api/admin-proxy/route.ts`
- 수정: createClient + getUser + ADMIN_EMAILS 이중 인증 추가 완료

~~**[C-02] payment/success useEffect 이중 호출**~~ ✅ **수정 완료 (2026-04-04)**
- 파일: `frontend/app/payment/success/page.tsx`
- 수정: `useRef<boolean>(false)` 플래그(`calledRef`) 추가, 의존성 배열 `[]`로 변경

### High (배포 전 수정)

~~**[H-01] package-lock.json에 @supabase/auth-helpers-nextjs 잔재**~~ ✅ **해결 확인 (2026-04-04)**
- 실제 grep 결과 0건 — 이미 정리 완료. 추가 조치 불필요.

~~**[H-02] frontend/types/action.ts expected_effect 잔존**~~ ✅ **수정 완료 (2026-04-03)**
- ActionItem 인터페이스에서 `expected_effect` 제거 완료.

~~**[H-03] grace_period 사용자 기능 전면 차단**~~ ✅ **수정 완료 (2026-04-04)**
- 파일: `backend/middleware/plan_gate.py:105`
- 수정: `.eq("status", "active")` → `.in_("status", ["active", "grace_period"])` — 유예기간 중 유료 기능 유지

~~**[H-04] 랜딩 페이지 푸터 법적 링크 부재**~~ ✅ **수정 완료 (2026-04-04)**
- 파일: `frontend/app/page.tsx` 푸터
- 수정: `/terms`(이용약관), `/privacy`(개인정보처리방침) 링크 추가, `flex-wrap` 모바일 대응

~~**[H-05] 404/500 에러 페이지 미존재**~~ ✅ **수정 완료 (2026-04-04)**
- `frontend/app/not-found.tsx` — 기존 구현 확인 (정상)
- `frontend/app/error.tsx` — 신규 생성 완료 (`"use client"`, reset/홈 버튼 포함)

**[H-06] scheduler/jobs.py 동기 Supabase 호출** — 유보 (BEP 후 처리)
- 파일: `backend/scheduler/jobs.py`
- 현상: AsyncIOScheduler 환경에서 동기 `.execute()` — 구독자 20명 이하에서는 무방
- 수정 시점: 구독자 20~50명 사이에서 `asyncio.to_thread()` 래핑

### Medium

~~**[M-01] admin-auth 이메일 하드코딩**~~ ✅ **수정 완료 (2026-04-04)**

~~**[M-02] pricing 비교표 창업패키지 행 검증**~~ ✅ **확인 완료 (2026-04-04)**

~~**[M-03] admin.py broadcast 전화번호 마스킹 미흡**~~ ✅ **수정 완료 (2026-04-03)**

~~**[M-04] 해지 실패 시 오류 안내 없음**~~ ✅ **수정 완료 (2026-04-04)**
- 파일: `frontend/app/(dashboard)/settings/SettingsClient.tsx`
- 수정: `cancelError` state 추가, `handleCancel` else 분기 및 오류 메시지 UI 추가

~~**[M-05] payment/success "7개 AI" 문구 오류**~~ ✅ **수정 완료 (2026-04-04)**
- `이제 7개 AI 플랫폼` → `이제 최대 8개 AI 플랫폼` 으로 수정

**[M-06] 개인정보처리방침 수집 항목 명시 정확성** — 미확인 (수동 점검 필요)
- `privacy/page.tsx` 내 수집 항목이 실제 수집 데이터(이메일·전화·IP해시·결제정보·카카오번호)와 일치하는지 검토 필요

**[M-07] Grok 모델명** ✅ **확인 완료 (2026-04-04)**
- `grok-3` — x.ai API에서 2025년 2월 정식 출시, 정상 서비스 중. 수정 불필요.

~~**[N-01] 스케줄러 잡 실패 Slack 알림 미구현**~~ ✅ **확인 완료 (2026-04-04)**

~~**[N-02] sitemap.xml / robots.txt 미구현**~~ ✅ **확인 완료 (2026-04-04)**

~~**[N-03] 회원가입 약관 동의 체크박스 미확인**~~ ✅ **확인 완료 (2026-04-04)**

### 잔여 — 운영 준비 (출시 전 필수, 사업자 직접 처리)

- **결제 E2E 테스트**: 회원가입 → 사업장 등록 → Toss test_sk_ 결제 → 구독 활성화 수동 확인 필요
- **카드 변경 E2E 테스트**: 구독 후 /settings → "카드 변경" → 토스 인증 → /payment/card-update → DB 업데이트 확인 (토스 심사 후)
- **Toss 대시보드 webhook URL 등록**: `https://aeolab.co.kr/api/webhook/toss/confirm` 등록 여부 확인
- ~~**UptimeRobot**~~ ✅ **완료 (2026-04-05)** — `https://aeolab.co.kr/health` 5분 주기, 이메일 알림 설정 완료
- **KAKAO_APP_KEY / KAKAO_SENDER_KEY**: 알림톡 심사 승인 후 서버 .env 설정 필요
- **TOSS_SECRET_KEY live 전환**: 실결제 심사 승인 후 `test_sk_` → `live_sk_` 교체
- **개인정보처리방침 수집 항목 검토**: `privacy/page.tsx` 내용 vs 실제 수집 항목 대조

---

## 운영 환경 최종 확인 (배포 직전 체크)

```
환경변수
[x] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 서버 .env 설정됨
[x] GEMINI_API_KEY / ANTHROPIC_API_KEY / TOSS_SECRET_KEY 서버 .env 설정됨
[x] ADMIN_SECRET_KEY 서버 .env 설정됨
[x] APP_ENV=production 서버 .env 설정됨 (Swagger UI 비활성화)
[x] SLACK_WEBHOOK_URL 서버 .env 설정됨 + curl 테스트 성공
[ ] TOSS_SECRET_KEY live_sk_... (실결제 전환 시)
[ ] KAKAO_APP_KEY / KAKAO_SENDER_KEY (알림톡 심사 승인 후)
[x] ADMIN_EMAILS 서버 .env 명시적 설정 완료 (2026-04-04)

인프라
[x] Supabase Storage before-after 버킷 Public 읽기 설정 확인됨
[x] Nginx proxy_buffering off (SSE 경로 /api/scan/stream)
[x] PM2 aeolab-backend + aeolab-frontend 모두 online
[x] SSL 인증서 유효 (만료: 2026-06-26)
[x] /health 엔드포인트 응답 정상 (status: ok)

기능 테스트
[x] trial 스캔 1회 실제 테스트 — track1/track2/unified 정상 반환 확인됨
[ ] 회원가입 → 이메일 인증 → 로그인 → 사업장 등록 → 스캔 전체 플로우
[ ] 유료 결제 1건 테스트 (test_sk_ 기준) → 구독 활성화 확인
[ ] Toss 대시보드에 webhook URL 등록 여부 확인

모니터링
[x] UptimeRobot 외부 업타임 모니터링 설정 완료 (2026-04-05)
[ ] Supabase 대시보드에서 DB/Storage 사용량 확인
```

---

## 다음 점검 시 업데이트 항목

- 이 파일의 "마지막 점검" 날짜를 최상단에서 업데이트
- 신규 발견 이슈는 "발견된 이슈 종합" 섹션에 추가
- 해결된 이슈는 [x]로 체크 후 비고에 해결 날짜 기록
- 새 기능 추가 시 관련 섹션에 항목 추가

---

*최초 작성: 2026-04-03 | v2.2 업데이트: 2026-04-03 — 섹션 11~18 추가*
*v2.3 업데이트: 2026-04-04 — 3차 점검: Critical 0건, High 1건(유보), Medium 0건 달성. ADMIN_EMAILS 하드코딩 수정, pricing metadata 추가, 서버 env 설정, SSL 자동갱신 확인, 빌드·Python 검증 완료*
*v2.4 업데이트: 2026-04-04 — 4차 점검: 구독 해지 토스 빌링키 취소 API 추가(settings.py), 카드 변경 기능 전체 신규 구현(백엔드 POST /api/settings/card/update + 프론트 SettingsClient.tsx + /payment/card-update 콜백 페이지 + api.ts updateBillingCard). 토스 심사 완료 후 E2E 테스트 예정.*
*v2.5 업데이트: 2026-04-04 — 5차 점검(코드 리뷰 심층 점검): C-02 결제 이중호출 방지(useRef 플래그), H-03 grace_period 차단 버그 수정(plan_gate.py), H-04 랜딩 푸터 법적 링크 추가, H-05 error.tsx 에러 페이지 신규 생성, M-04 해지 실패 오류 안내 추가, M-05 AI 플랫폼 수 문구 수정. Critical 0건, High 1건(유보), 빌드 34페이지 성공, 서버 배포 완료.*

*v3.0 업데이트: 2026-04-05 — 6차 점검(미발견 이슈 심층 탐색): Critical 2건(scan.py grace_period 스캔 차단·X-Forwarded-For 스푸핑) 수정. High: Perplexity 점수 항상 0 버그(score_engine.py), trial 체크박스 점수 미반영(scan.py biz_ctx), asyncio.get_event_loop() deprecated→to_thread 교체(guide_generator.py). Medium: teams.py remove/update_role Biz+ 플랜 체크 누락, api_keys 폐기 404 처리, 회원가입 에러 메시지 한국어화, billing_key 응답 노출 제거, competitor TimeoutError catch, startup PLAN_RANK 미사용 제거, 알림 토글 실패 롤백 추가. UptimeRobot 외부 모니터링 설정 완료(hoozdev@gmail.com, 5분 간격). Critical 0건, High 1건(유보), 빌드 34페이지 성공, 서버 배포 완료.*
