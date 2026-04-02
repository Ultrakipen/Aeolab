# AEOlab 서비스 오픈 전 점검 체크리스트

> 버전: v1.0 | 작성일: 2026-04-02  
> 목적: 배포 전, 기능 추가 후, 정기 점검 시 동일한 기준으로 서비스 품질을 검증한다.  
> 사용법: 각 항목을 직접 확인하고 `[x]`로 체크. 🔴 항목 미통과 시 배포 금지.

---

## 1. 환경변수 & 설정

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정됨 | `frontend/.env.local` 확인 |
| 🔴 | `SUPABASE_SERVICE_ROLE_KEY` 백엔드 전용 (NEXT_PUBLIC 아님) | `backend/.env` 확인 |
| 🔴 | `GEMINI_API_KEY` 유효 | `/health` 엔드포인트 또는 trial 스캔 1회 |
| 🔴 | `ANTHROPIC_API_KEY` 유효 | 가이드 생성 1회 테스트 |
| 🔴 | `TOSS_SECRET_KEY` — 운영 환경은 반드시 `live_sk_` 접두사 | `backend/.env` 확인 |
| 🔴 | `SECRET_KEY` 32자 이상 랜덤 문자열 | `backend/.env` 확인 |
| 🟡 | `KAKAO_REST_API_KEY` 설정됨 (경쟁사 지역 검색용) | `backend/.env` 확인 |
| 🟡 | `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` 설정됨 | `backend/.env` 확인 |
| 🟡 | `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GROK_API_KEY` 유효 | full scan 테스트 |
| 🟢 | `KAKAO_APP_KEY` / `KAKAO_SENDER_KEY` — 알림톡 승인 후 입력 | 템플릿 승인 후 처리 |

---

## 2. 인증 & 보안

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | Trial 스캔 쿨다운 우회 로직 없음 (isAdmin 제거 확인) | `trial/page.tsx` 검색: `isAdmin` 없어야 함 |
| 🔴 | `NEXT_PUBLIC_` 접두사에 민감 키 없음 | `frontend/.env.local`에서 `NEXT_PUBLIC_` 변수 전체 확인 |
| 🔴 | 모든 대시보드 API에 `get_current_user` 의존성 적용 | `routers/` 전체 grep: `Depends(get_current_user)` |
| 🔴 | `user["id"]` 키 접근 (속성 접근 `user.id` 없음) | `scan.py` grep: `user.id` 없어야 함 |
| 🔴 | 사업장 소유권 검증 (`_verify_biz_ownership`) 적용 | `report.py`, `guide.py`, `business.py` 확인 |
| 🔴 | 구독 플랜 체크 시 `status === "active"` 검증 포함 | `dashboard/page.tsx`, `guide/page.tsx`, `history/page.tsx` |
| 🟡 | CORS `allow_origins` 운영 도메인만 허용 | `main.py`: `https://aeolab.co.kr`, `http://localhost:3000` |
| 🟡 | Swagger UI 운영 환경 비활성화 | `main.py` `ENVIRONMENT != "production"` 조건 확인 |
| 🟡 | 보안 헤더 미들웨어 적용 | `main.py`: `SecurityHeadersMiddleware` |
| 🟡 | 결제 webhook에 orderId 유효성 검증 | `webhook.py` confirm 엔드포인트 확인 |

---

## 3. 라우터 & API 엔드포인트

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | FastAPI 라우터 경로 순서: 고정 경로가 파라미터 경로보다 앞에 선언 | `competitor.py`: `/suggest/list`가 `/{biz_id}` 앞에 있어야 함 |
| 🔴 | Supabase `.order()` 문법: `desc=True` (dict 인자 금지) | `report.py` 전체 grep: `.order(` |
| 🔴 | 컬럼 조회 테이블 일치: `tools_json`은 `guides` 테이블 | `report.py` smartplace 엔드포인트 확인 |
| 🟡 | 모든 SELECT 쿼리에서 필요 컬럼만 명시 (SELECT * 최소화) | `routers/` 전체 grep: `select("*")` |
| 🟡 | N+1 쿼리 없음 (ranking, benchmark 등 IN 쿼리 사용) | `report.py` ranking 엔드포인트 확인 |
| 🟡 | 캐시 적용 확인: ranking 30분, benchmark 1시간 | `report.py` `_cache.get(` 확인 |
| 🟢 | 미사용 import 없음 | `settings.py` 등 각 라우터 파일 상단 |

---

## 4. 플랜 게이트 & 요금제

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | 가격 4곳 일치: `webhook.py` = `plans.ts` = `PlanGate.tsx` = `admin.py` | Basic 9,900 / 창업 16,900 / Pro 22,900 / Biz 49,900 |
| 🔴 | Trial 1일 한도 3회 (개발용 20 아님) | `scan.py` `_TRIAL_LIMIT_PER_DAY = 3` |
| 🔴 | 결제 테스트키 → 운영키 전환 확인 | `TOSS_SECRET_KEY=live_sk_` 확인 |
| 🟡 | `plan_gate.py` 한도와 프론트엔드 표시 한도 일치 | Pro 가이드 8회, 창업패키지 리뷰답변 20회 등 |
| 🟡 | 플랜 미만 기능 접근 시 upgrade 팝업 표시 | `PlanGate.tsx` 동작 확인 |
| 🟡 | 사이드바 잠금 배지 정확성 | Basic 미만: 리뷰답변·스키마, Pro 미만: 광고대응 |
| 🟢 | 구독 만료 시 grace_until 처리 | `scheduler/jobs.py` subscription_lifecycle 확인 |

---

## 5. 스캔 엔진 (핵심 기능)

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | Trial 스캔 응답에 `track1_score`, `track2_score`, `unified_score` 포함 | POST `/api/scan/trial` 실제 호출 |
| 🔴 | Full 스캔 `user["id"]` 키 접근 (속성 접근 오류 없음) | POST `/api/scan/full` 실제 호출 |
| 🔴 | 듀얼트랙 비율: 9개 업종 `DUAL_TRACK_RATIO` 적용 | `score_engine.py` 확인 |
| 🔴 | `zeta_scanner.py` 삭제 완료, 참조 없음 | grep: `zeta_scanner` 없어야 함 |
| 🟡 | 자동 스캔(스케줄러)에 v3.0 점수 컬럼 저장 | `scheduler/jobs.py` INSERT 컬럼 확인 |
| 🟡 | GrowthStage 판정 기준: `track1_score` (total_score 아님) | `gap_analyzer.py`, `scheduler/jobs.py` |
| 🟡 | SSE 스트림 스캔 토큰 인증 2단계 정상 작동 | `/api/scan/stream` 실제 테스트 |
| 🟡 | Playwright 동시 실행 1개 제한 | `screenshot.py` `Semaphore(1)` 확인 |
| 🟢 | keyword_gap cold start 처리 (리뷰 없어도 fallback 30.0) | `gap_analyzer.py` `_build_keyword_gap` |

---

## 6. 데이터베이스 & Supabase

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | `scripts/supabase_schema.sql` 최신 버전 실행 완료 | Supabase SQL Editor에서 테이블 구조 확인 |
| 🔴 | `scan_results`: `track1_score`, `track2_score`, `unified_score`, `keyword_coverage` 컬럼 존재 | Supabase 테이블 편집기 |
| 🔴 | `score_history`: `track1_score`, `track2_score`, `unified_score` 컬럼 존재 | Supabase 테이블 편집기 |
| 🔴 | `profiles` 테이블: `kakao_scan_notify`, `kakao_competitor_notify` 컬럼 존재 | Supabase 테이블 편집기 |
| 🔴 | `gap_cards` 테이블 존재 | Supabase 테이블 편집기 |
| 🟡 | Supabase Storage `before-after` 버킷 존재 + Public 읽기 설정 | Supabase Storage 확인 |
| 🟡 | `handle_new_user` 트리거 활성화 (회원가입 시 profiles 자동 생성) | Supabase Database → Functions |
| 🟡 | RLS 정책 활성화 (users는 자신의 데이터만 접근) | Supabase → Authentication → Policies |
| 🟢 | 성능 인덱스 6개 생성됨 | Supabase → Database → Indexes |

---

## 7. 결제 플로우 (토스페이먼츠)

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | 운영키 `live_sk_` 사용 (테스트키 `test_sk_` 아님) | `backend/.env` |
| 🔴 | 결제 성공 후 구독 상태 `active` 전환 확인 | 테스트 결제 → DB `subscriptions` 확인 |
| 🔴 | 결제 실패 페이지 `/payment/fail` 정상 표시 | 실패 시나리오 테스트 |
| 🟡 | 빌링키 자동 갱신 스케줄러 동작 확인 | `scheduler/jobs.py` subscription_lifecycle |
| 🟡 | 구독 만료 카카오 알림 발송 (승인 후) | 알림톡 템플릿 승인 필요 |
| 🟢 | 환불 처리 시나리오 정의 | 운영 정책 문서 필요 |

---

## 8. 프론트엔드 품질

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | TypeScript 빌드 오류 0개 | `npm run build` 성공 확인 |
| 🔴 | 모바일(375px) 레이아웃 깨짐 없음 | Chrome DevTools 모바일 뷰 |
| 🔴 | PC(1280px) 레이아웃 정상 | 브라우저 전체화면 확인 |
| 🟡 | 본문 텍스트 최소 14px (`text-sm` 이상) | 모든 페이지 시각 확인 |
| 🟡 | 로딩 상태 표시 (스켈레톤 또는 스피너) | 각 데이터 fetch 시 확인 |
| 🟡 | 빈 데이터 상태(Empty State) 안내 문구 | 경쟁사 미등록, 스캔 기록 없음 등 |
| 🟡 | 에러 상태 처리 (API 실패 시 toast 또는 안내) | 네트워크 차단 후 테스트 |
| 🟢 | 이미지 alt 텍스트 존재 | 접근성 기본 준수 |
| 🟢 | 페이지 타이틀 각각 다름 (`<title>`) | 브라우저 탭 확인 |

---

## 9. 서버 & 인프라

| 우선도 | 항목 | 확인 방법 |
|--------|------|-----------|
| 🔴 | `GET /health` 응답: `{"status": "ok"}` | `curl https://aeolab.co.kr/api/health` |
| 🔴 | PM2 프로세스 2개 `online` 상태 | `pm2 list` |
| 🔴 | HTTPS 인증서 유효 (SSL) | 브라우저 자물쇠 아이콘 확인 |
| 🔴 | Nginx `/api/` 경로 `proxy_buffering off` (SSE 필수) | `nginx.conf` 확인 |
| 🟡 | Nginx Rate Limiting 적용: `/api/scan/trial` | `nginx.conf` `limit_req` 확인 |
| 🟡 | PM2 자동 재시작 설정 (`--restart-delay`, max_memory_restart) | `ecosystem.config.js` 확인 |
| 🟡 | 서버 디스크 용량 여유 (20% 이상) | `df -h` |
| 🟡 | 서버 메모리 여유 (Playwright 동시 실행 고려) | `free -h` |
| 🟢 | UptimeRobot 또는 헬스체크 모니터링 설정 | `/health` 엔드포인트 대상 |
| 🟢 | 로그 로테이션 설정 (PM2 `logrotate`) | `pm2 install pm2-logrotate` 확인 |

---

## 10. E2E 핵심 플로우 테스트

> 실제 브라우저에서 직접 수행. 자동화 테스트 전까지 수동 확인.

| 우선도 | 시나리오 | 기대 결과 |
|--------|----------|-----------|
| 🔴 | 랜딩 페이지 → Trial 스캔 → 결과 확인 | DualTrackCard + 키워드 갭 표시 |
| 🔴 | 회원가입 → 이메일 인증 → 로그인 | 대시보드 진입 |
| 🔴 | 사업장 등록 → AI 스캔 시작 → 결과 | 점수 카드 표시, DB 저장 확인 |
| 🔴 | 경쟁사 검색 → 등록 → 경쟁사 목록 확인 | 지역 검색 결과 표시 |
| 🔴 | 결제 → 구독 활성화 → 플랜 기능 접근 | Pro 기능 잠금 해제 |
| 🟡 | 가이드 생성 → AI 브리핑 경로 4개 확인 | 복사 버튼 동작 |
| 🟡 | Schema JSON-LD 생성 → 복사 | JSON 정상 출력 |
| 🟡 | 스캔 한도 초과 → 플랜 업그레이드 팝업 | PlanGate 표시 |
| 🟡 | 모바일(375px) 전체 플로우 | 레이아웃 깨짐 없음 |
| 🟢 | 비로그인 상태 대시보드 직접 URL 접근 | 로그인 페이지 리다이렉트 |

---

## 11. 소상공인 신뢰도 & UX 체크

| 우선도 | 항목 | 기준 |
|--------|------|------|
| 🔴 | 서비스 설명이 소상공인 언어로 작성됨 | "AI Visibility"가 아닌 "네이버 AI 브리핑 노출" 등 |
| 🟡 | 개인정보처리방침 페이지 존재 | `/privacy` URL |
| 🟡 | 이용약관 페이지 존재 | `/terms` URL |
| 🟡 | 고객 문의 수단 명시 (이메일 또는 카카오채널) | 랜딩 페이지 또는 footer |
| 🟡 | 결제 전 "환불 정책" 안내 | 결제 페이지 또는 약관 |
| 🟡 | 404 에러 페이지 존재 | 잘못된 URL 접근 시 |
| 🟢 | favicon 설정됨 | 브라우저 탭 아이콘 |
| 🟢 | OG 태그 설정 (소셜 공유 미리보기) | `layout.tsx` 메타태그 |

---

## 점검 결과 기록

```
점검일: ________
점검자: ________
버전: ________

🔴 미통과 항목:
- 

🟡 보완 필요 항목:
- 

배포 가능 여부: [ ] YES  [ ] NO (🔴 항목 없을 때만 YES)

비고:
```

---

## 점검 주기 권고

| 시점 | 점검 범위 |
|------|-----------|
| 첫 서비스 오픈 전 | 1~11 전체 |
| 기능 추가 후 배포 전 | 영향 받는 섹션 + 섹션 10 (E2E) |
| 매주 (운영 중) | 섹션 9 (서버 상태) + 섹션 10 중 🔴 항목 |
| 매월 | 섹션 4 (플랜/가격), 섹션 7 (결제), 섹션 6 (DB) |

---

*최종 업데이트: 2026-04-02 | v1.0 초안*
