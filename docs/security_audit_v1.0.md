# AEOlab 보안 감사 보고서 v1.0 (2026-07-11)

> **2026-07-11 업데이트**: F1~F5 전체 수정+배포+라이브 검증 완료 (git `0562ff8`).
> **2026-07-12 업데이트**: M1~M5 전체 수정+code-review 에이전트 검증+배포+라이브 검증 완료. M1(`/admin/broadcast` → `require_owner`), M2(`guide.py` 월 한도 TOCTOU를 in-memory per-user 락으로 차단), M3(webhook `billing/issue` IP 분당 5회), M4(`feedback.py` IP 분당 10회 + context 5000자 제한), M5(관리자 계정 추가/삭제 로그 이메일 마스킹). 이 감사 문서의 CRITICAL/HIGH/MEDIUM 전 항목 완료 — 재작업 불필요.

> `docs/commercial_launch_readiness_audit_v1.0.md` §A(보안) 실행 결과. `/cso comprehensive` 방법론(OWASP Top 10 + STRIDE + 시크릿 아카이브 + 공급망) 기반이나, gstack 온보딩(텔레메트리·라우팅 등)은 본 작업과 무관해 생략하고 실제 감사 로직만 수행.
>
> **검증 방식**: 5개 병렬 서브에이전트(IDOR·관리자권한·rate limit·XSS/SSRF·PII로그)가 1차 스캔 → 메인 세션이 각 CRITICAL/HIGH 후보를 `Read`/`Grep`/SSH로 직접 재확인 (CLAUDE.md "문제 분류 검증 의무" 준수). 아래 CRITICAL/HIGH 5건은 전부 근거 라인을 메인 세션이 직접 읽고 확인함.

## 요약

| 심각도 | 건수 | 상태 |
|---|---|---|
| CRITICAL/HIGH | 5 | 전부 코드/서버 직접 확인(VERIFIED) |
| MEDIUM | 5 | 서브에이전트 확인 + 일부 메인 세션 재확인 |
| PASS(문제없음, 근거 명시) | IDOR 32개 라우터, XSS 4건, 대부분 rate limit, PII 로그 대부분 | 아래 §3 참조 |

---

## 1. CRITICAL / HIGH — 메인 세션 직접 검증 완료

### F1. SSRF — 인증된 스캔 경로에 IP 검증 누락 (HIGH, confidence 9/10)

**파일**: `backend/routers/scan.py:1938`(스트림), `:2912`(전체), `backend/services/website_checker.py:64`

**근거**: `website_checker.py:64` `session.get(url, allow_redirects=True, ssl=False)` — IP 리터럴·사설망 차단 없음. 반면 같은 파일 `scan.py:626-643`(비인증 트라이얼 경로)는 `_is_safe_url()` 검사를 거친 뒤에만 `check_website_seo()`를 호출함을 직접 확인. **인증된 스트림/전체 스캔 경로에는 이 검사가 없음.**

`business.py:314`의 PATCH 허용 필드 목록에 `website_url` 포함 확인 — 로그인한 사용자가 자유롭게 이 값을 내부 IP로 바꿀 수 있음.

**공격 시나리오**: 가입 후 `PATCH /api/businesses/{id}` → `website_url=http://127.0.0.1:8000` 저장 → `POST /api/scan/full` 또는 `/stream` 트리거 → `website_check_result.title`에 내부 서비스(FastAPI Swagger 등)의 `<title>` 텍스트가 그대로 반영되어 응답으로 반환됨. 단일 vCPU2 서버에 내부 포트가 있다면 포트 스캐닝·서비스 지문 채취 가능.

**반증 시도**: 트라이얼(비인증) 경로는 `_is_safe_url()`로 이미 막혀있어 "SSRF 자체가 설계상 불가능"이라는 반박을 검토했으나, 인증된 경로 2곳은 해당 함수를 호출하지 않음을 라인 단위로 직접 확인 — 반증 실패, CONFIRMED.

**수정 방향**: `_is_safe_url()`(scan.py:629)을 `website_checker.py` 내부로 옮겨 `check_website_seo()` 진입점 하나에서 강제 적용 (호출부 3곳 모두 동일 보호를 받도록 단일화).

---

### F2. ADMIN_SECRET_KEY가 URL 쿼리 파라미터로 노출 (HIGH, confidence 9/10)

**파일**: `backend/routers/admin.py:1055-1079`(`_verify_admin_key`, `email_preview`), `:1171-1174`(HTML 내 링크)

**근거**: `key: str = Query(..., description="ADMIN_SECRET_KEY")` (라인 1069) — 헤더가 아닌 URL 경로로 마스터 시크릿을 받음. 렌더링된 HTML(라인 1171-1174)에도 `href="?key={key}&..."` 형태로 그대로 노출됨을 직접 확인. 독스트링(라인 1077)이 `.../email-preview/day1?key=SECRET&name=...` 형태를 "사용 예시"로 명시.

**연쇄 위험**: `utils/admin_auth.py:34-46`의 `require_owner()` 자체 독스트링이 "ADMIN_SECRET_KEY를 이미 아는 상태에서 curl로 직접 호출하면 X-Admin-Email 헤더를 조작할 수 있다"고 명시함을 직접 확인. 즉 **이 키 하나가 유출되면 `verify_admin` 보호 30개 엔드포인트뿐 아니라, X-Admin-Email 헤더 위조로 `require_owner` 보호 엔드포인트(구독 강제해지·관리자 계정 추가/삭제)까지 전부 접근 가능** — 설계 문서가 이미 인지하고 있는 "시크릿 자체 유출은 방어 범위 밖"이라는 전제가 이 F2로 인해 실제로 뚫리는 구조.

**노출 경로**: Nginx 접근 로그(쿼리스트링 포함 기본 설정), 브라우저 히스토리, Referer 헤더(외부 링크 클릭 시).

**수정 방향**: `key: str = Query(...)` → `Depends(verify_admin)`(헤더 방식)로 교체. HTML 내 탭 전환 링크는 쿼리스트링 대신 JS `fetch` + 세션 상태로 교체.

---

### F3. 대행 서비스 실제 환불 엔드포인트가 owner 검증 없이 실행 가능 (HIGH, confidence 9/10)

**파일**: `backend/routers/delivery.py:779-854`

**근거**: `admin_update_status()`가 `_: None = Depends(verify_admin)`(라인 783)만 사용함을 직접 확인. `verify_admin`(`utils/admin_auth.py:21-31`)은 `ADMIN_SECRET_KEY` 헤더 일치 여부만 확인하며 `admin_users` 테이블의 role을 조회하지 않음 — 즉 owner/support 구분이 전혀 없음. `body.status=="refunded"` 분기(라인 813-854)에서 `_toss_cancel_payment()`(라인 846)를 호출해 **실제 토스 결제 취소(금전 이동)**가 발생함을 확인.

**설계 원칙과의 불일치**: 같은 파일이 아닌 `admin.py:95` `admin_cancel_subscription()`은 `Depends(require_owner)`로 올바르게 보호되어 있음(직접 확인) — "금전이동 액션은 owner 전용"이라는 문서화된 원칙(`admin_service_oversight_design_v1.0.md §3-A-H`)이 구독 취소에는 적용됐으나 **대행 서비스 환불 경로는 누락**됨.

**공격 시나리오**: ADMIN_SECRET_KEY를 아는 support 역할 계정(또는 F2로 키가 유출된 외부 공격자)이 `status=refunded` 요청 → owner 승인 없이 실제 카드 환불 발생.

**수정 방향**: `delivery.py:783` `Depends(verify_admin)` → `Depends(require_owner)`로 교체.

---

### F4. next.js 16.2.1 — 다수 HIGH 심각도 CVE (미패치, fix 존재) (HIGH, confidence 10/10)

**파일**: `frontend/package.json:19` (`"next": "16.2.1"` 고정 버전)

**근거**: `npm audit` 직접 실행 결과(메인 세션이 커맨드 출력을 직접 읽음) — HIGH 2건 + MODERATE 1건:
- GHSA-q4gf-8mx6-v5v3 — Server Components DoS (CVSS 7.5, 범위 `>=16.0.0-beta.0 <16.2.3`)
- GHSA-8h8q-6873-q5fj — Server Components DoS (CVSS 7.5, 범위 `<16.2.5`)
- GHSA-26hh-7cqf-hhc6 — **Middleware/Proxy bypass**(CWE-288, App Router, 범위 `<16.2.6`) — 인증 미들웨어 우회 가능성이 있어 이 서비스의 `middleware.ts` 인증 로직과 직결되는 항목
- GHSA-ffhc-5mcf-pf4q — CSP nonce 우회 XSS (moderate)

`npm audit`이 제시하는 `fixAvailable`은 `next@16.2.10`(현재 16.x 라인 내, semver major 변경 없음) — `npm audit fix`로 해결 가능.

**수정 방향**: `npm install next@16.2.10` 후 서버 배포 절차(빌드+pm2 재시작) 그대로 진행. 특히 GHSA-26hh-7cqf-hhc6(미들웨어 우회)는 이 프로젝트의 `middleware.ts` 인증 게이트와 직접 관련돼 우선순위 높음.

---

### F5. 서버 `.env` 파일 권한이 644(월드 리더블) — 600 아님 (HIGH, confidence 10/10)

**근거**: SSH 직접 확인 (`stat -c '%a %n' /var/www/aeolab/backend/.env` → `644`). `/var/www/aeolab/.env`도 `-rw-r--r--`(644)로 동일. CLAUDE.md 자체가 "서버 파일 권한(600)"을 "미확인" 항목으로 명시했던 부분 — 이번에 실측으로 **미달 확인**.

**추가 이상 징후**: `backend/.env`의 소유자가 `197610:197121`인데, 서버의 `/etc/passwd`에 해당 UID로 매핑되는 로컬 계정이 없음(`getent passwd 197610` 결과 없음 확인) — 표준 `scp root@...`가 아닌 다른 경로(예: 다른 UID 네임스페이스를 가진 컨테이너/클라이언트)로 이 파일이 올라갔을 가능성. 위험도는 낮음(현재 로컬 계정 중 root 외에는 이 파일을 읽을 이유가 없는 단일 목적 서버)이나, 644 권한 자체는 root가 아닌 다른 프로세스(예: 향후 추가될 서비스 계정)가 실수로 읽을 수 있는 불필요한 노출.

**수정 방향**: `chmod 600 /var/www/aeolab/.env /var/www/aeolab/backend/.env`. PM2가 root로 구동 중임을 확인(`pm2 jlist` cwd 확인)해 앱 동작에 영향 없음. **프로덕션 서버 변경이라 사용자 확인 후 적용 권장.**

---

## 2. MEDIUM — 서브에이전트 확인 (일부 메인 세션 재검증)

| # | 파일:라인 | 내용 | 근거 |
|---|---|---|---|
| M1 | `admin.py:643-644` | `/admin/broadcast`(전 구독자 카카오 발송)가 `verify_admin`만 사용 — support 역할도 임의 메시지 대량 발송 가능 | 메인 세션이 라인 직접 확인. 금전이동은 아니나 스팸/사칭 리스크 |
| M2 | `middleware/plan_gate.py:218-243`(`check_guide_limit`) | 월별 가이드 생성 한도가 "읽기→체크→백그라운드 저장" 패턴 — 동시 요청 시 TOCTOU 레이스로 한도 우회 가능 | 메인 세션이 함수 본문 직접 확인: COUNT 쿼리 후 조건부 저장이 아닌 별도 시점에 INSERT. 실제 악용 시 Claude API 비용 초과(자기 계정 한도 우회이므로 공격 대상은 본인 계정이지만 서비스 비용 손실) |
| M3 | `webhook.py:82` | `/toss/billing/issue` — 인증·rate limit 모두 없음. 유효하지 않은 authKey로도 Toss API를 무제한 호출 가능 | ※ 이 엔드포인트가 인증을 안 받는 이유는 이미 조사됨(`project_commercial_inspection_2026_06_18` — 프론트 `apiCall()`이 Authorization 헤더 미전송, Toss authKey 자체가 customerKey에 바인딩되어 IDOR 방어는 Toss 쪽에서 이뤄짐). **재분류**: 계정 탈취형 IDOR 재우려 위험은 낮음(오판 아님, 기존 조사 유효) — 다만 **rate limit 부재로 인한 Toss API 남용/비용 리스크는 별개 문제로 신규 확인**. IP 기준 5회/분 rate limit 추가 권장 |
| M4 | `feedback.py:11` | `/api/feedback` — 인증 선택적, rate limit 없음, `context: dict` 필드 크기 제한 없음 | Supabase Free Tier(500MB) 스토리지 고갈 가능성 |
| M5 | `admin.py:437,450` | 관리자 계정 추가/삭제 로그에 이메일 평문 기록 (`_mask_email` 미적용) | 내부 운영자 이메일 한정, 외부 유출 경로 없음 — 우선순위 낮음 |

---

## 3. PASS (확인됨, 문제 없음) — 근거 요약

- **IDOR**: `backend/routers/` 32개 파일 전수 확인. `_verify_biz_ownership()` / `_get_order_owned_or_403()` / `_get_business_or_403()` 헬퍼 또는 인라인 `.eq("user_id", ...)` 패턴이 자원 소유 엔드포인트 전체에 일관 적용됨. 공개 설계 엔드포인트(공유 카드, 랭킹, 성공사례)는 docstring으로 의도 명시.
- **XSS**: `dangerouslySetInnerHTML` 4건(`layout.tsx`, `faq/page.tsx`, `FAQSection.tsx`, `HeroSampleCard.tsx`) 전부 하드코딩 상수 — 사용자 입력 도달 경로 없음. `SchemaClient.tsx`의 `script_tag` 표시는 React 표준 `{}` 보간(자동 이스케이프)이라 `dangerouslySetInnerHTML` 미사용 확인.
- **Rate limiting**: 트라이얼(IP당 분당 10회, 일 3~5회), FAQ 검색, 네이버 브리핑 스트림, 관리자 score-comparison 등 CLAUDE.md 주장대로 실제 코드에 존재 확인. 문의/가이드 등은 월별 정량 한도로 보호(단 M2 레이스 예외).
- **PII 로그**: 전화번호(`kakao_notify.py` 14곳)·이메일(`email_sender.py` 6곳, `jobs.py` 3곳) 전부 마스킹 패턴(`{phone[:3]}****{phone[-2:]}`, `_mask_email()`) 적용 확인. 카드번호는 Toss가 이미 마스킹해 전달. M5 2곳만 예외.
- **Git 히스토리 시크릿**: `AKIA`, `sk-`, `ghp_`/`github_pat_` 패턴 git 전체 히스토리 검색 — 매치 없음.
- **`.env` 추적 여부**: `.gitignore`에 `.env`/`backend/.env` 명시, git에 추적된 파일은 `*.env.example` 3개뿐 — 실제 시크릿 파일 커밋 이력 없음.
- **CI 워크플로**: `.github/workflows/*.yml` 2개 파일에 인라인 시크릿 없음(전부 `secrets.*` 참조).
- **SSRF(AI 스캐너)**: Gemini/ChatGPT/네이버/구글 스캐너는 고정 도메인만 사용, 사용자 입력은 쿼리 파라미터로만 삽입 — 호스트 조작 불가 확인.

---

## 4. 별도 기록 — LOW/참고

- `backend/services/naver_place_stats.py:257` — `_normalize_place_base_url()`이 `None`을 반환하면 원본 URL을 그대로 Playwright `page.goto()`에 전달하는 폴백 경로 존재(F1과 유사 패턴이나 응답 노출 경로가 PM2 로그 300자 스니펫으로 제한적). F1 수정 시 같은 방식(진입점 검증 강제)으로 함께 처리 권장.
- `pip-audit` 로컬 미설치로 백엔드 Python 의존성 CVE 스캔 미수행 (스킵, 설치 후 재실행 필요 — `requirements.txt`에 고정 버전 다수 확인했으나 CVE 대조는 별도 도구 필요).

---

## 5. 권장 조치 순서

1. **F2, F3** (즉시, 코드 3줄 수준 수정) — 관리자 권한 체계의 핵심 결함, 배포 위험 낮음
2. **F1** (즉시~단기) — SSRF 진입점 통합, `_is_safe_url()` 재사용
3. **F4** (즉시) — `npm install next@16.2.10`, 빌드+재배포
4. **F5** (사용자 확인 후 즉시) — `chmod 600`, 프로덕션 서버 변경이라 확인 요청
5. **M1~M5** — 다음 스프린트, 비즈니스 영향 낮음

---

## 면책

본 감사는 자동화된 AI 기반 1차 스캔이며 전문 침투테스트 업체의 정식 보안 감사를 대체하지 않습니다. 결제·개인정보를 다루는 프로덕션 서비스는 정기적으로 전문 업체의 별도 점검을 권장합니다.
