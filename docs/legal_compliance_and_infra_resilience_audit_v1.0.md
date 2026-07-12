# B(법적/컴플라이언스) + D(인프라 복원력) 점검 결과 v1.0

> 작성일 2026-07-12. `docs/commercial_launch_readiness_audit_v1.0.md`의 B·D 축 실행 결과.
> A(보안)는 `docs/security_audit_v1.0.md`(git `0562ff8`)로 이미 완료. C(사업성)는 이번 세션 생략(사용자 결정 — 수치 가정이 많아 별도 논의 필요).

## B. 법적/컴플라이언스

### P1 — 정기결제 요금 인상 사전고지 미비 → 수정 완료 (2026-07-12)

- **근거**: 전자상거래법 시행령 — 정기결제 대금 증액 또는 무료→유료 전환 시 "그 이전 30일 이내"에 소비자 동의를 받고 취소 조건·방법을 고지할 의무. 2025-02-14 시행(이미 17개월 시행 중인 기존 법령, WebSearch로 정책브리핑·이데일리 등 복수 매체 확인).
- **현황(당시)**: Basic 플랜은 첫 달 4,950원 → 30일 후 9,900원으로 자동 인상(`backend/routers/webhook.py:199`가 `first_month_discount_until`을 기록). 그러나 이 컬럼을 읽어 인상 임박 시점에 재고지하는 로직이 전무(`grep -rn "first_month_discount_until" backend/` 결과 1건, 쓰기만 존재). 고지는 최초 결제 시점(가입 시, `PayButton.tsx:136`) 1회뿐.
- **반증 시도**: 결제 확인 모달에 "30일 뒤부터 매월 9,900원 자동 결제" 문구가 이미 존재함을 확인 — 즉 "정보 제공"은 있으나, 법령이 요구하는 "그 증액 시점 임박 30일 이내 동의"를 최초 가입 시점의 사전 안내가 충족하는지는 해석 영역. 정식 법률 자문 없이 위반 단정은 불가 — 다만 실무 관행(증액 임박 시점 별도 고지)에 맞춰 안전하게 보완.
- **조치**: `backend/scheduler/jobs.py` `subscription_lifecycle_job`에 새 단계 추가 — `first_month_discount_until` D-3에 정확일치로 조회해 `KakaoNotifier.send_price_increase_notice()`(신규, 기존 승인 템플릿 `AEOLAB_NOTICE_01` 재사용, 신규 템플릿 승인 불필요)로 카카오 알림톡 발송. 로컬 임포트·날짜 포맷 일치 검증 + code-review 에이전트 검증 완료, 서버 배포·pm2 재시작 무에러 확인(git `7df5e95`).
- **잔여**: PM2가 같은 날 재시작되면 중복발송 가능(기존 `send_expire_warning`과 동일한 무-dedup 패턴, 신규 도입 위험 아님) — 필요 시 다음 스프린트에서 두 알림 함수를 묶어 idempotency key 적용 검토.

### P2 — 개인정보처리방침 §2 수집 항목과 실제 코드 불일치 (2건)

1. `business_registration_no`(사업자등록번호, 선택)가 `backend/models/schemas.py:84`, `backend/routers/business.py:185-186`에서 API로 수집·저장되나 방침 목록에 없음. 반증: 프론트 입력폼 없음(현재 실사용 경로 없음, API 직접호출 시에만 노출).
2. 방침은 "카드번호 제외, 빌링키로만 위탁저장"이라 명시하나 실제로는 `card_issuer_code`+`card_number_masked`(마스킹된 카드번호)가 `subscriptions` 테이블에 로컬 저장됨(`backend/routers/settings.py:368-394`, `backend/routers/webhook.py:108-196`). 마스킹이라 위험도는 낮으나 문구 불일치.

### P2 — Trial 익명 이메일 수집 시 별도 동의 표시 없음 (법률 자문 권장)

- `frontend/app/(public)/trial/components/TrialInputStep.tsx:1057` — 비회원 대상 이메일 수집(선택)에 목적 안내 문구만 있고 개인정보 수집·이용 동의 체크박스/링크 없음.
- WebSearch 확인: 비회원 대상 개인정보 수집도 원칙적으로 동의 필요. 다만 이용자가 직접 입력·제출하는 최소 선택 정보라는 점에서 정도의 문제 — 법률 자문 권장.

### 반증되어 기각된 항목 (감사 문서상 "미확인"이었으나 이미 해결됨)

- 청약철회 7일 고지: 이미 결제 확인 모달에 명시(`PayButton.tsx:140`) — 문제 없음.
- 표시광고법 과장 표현: `how-it-works` 페이지의 "100%"는 가중치 합계 표기이며 인근에 "노출을 100% 보장하지 않습니다" 명시적 disclaimer 존재 — 문제 없음.

## D. 인프라 복원력

### P0 — DB 백업이 생성 이래 단 한 번도 성공한 적 없었음 (수정 완료)

- **근거**: `/var/log/aeolab_backup.log` 전체 이력(28줄, 전부 "백업 실패", 성공 0건, 2026-03-30~04-02) + `journalctl`로 cron이 매일 03:00 정상 실행 중임을 확인(2026-07-05~07-11) — 즉 무한정 실패가 3개월+ 조용히 지속.
- **원인 이중 확정(라이브 재현)**:
  1. 서버→Supabase Postgres 포트(5432/6543) TCP 아웃바운드 자체가 차단됨(직접 `/dev/tcp` 테스트로 확인; HTTPS 443 REST API는 정상)
  2. `.env`에 `SUPABASE_DB_PASSWORD` 변수가 존재하지 않아 비밀번호 공백으로 연결 시도(이중 실패 요인)
  3. Supabase Free Tier는 플랫폼 자체 자동 백업도 없음(WebSearch 공식 확인) — 즉 대체 안전망 자체가 없었음
- **기존 fallback(`backup_json.py`, REST 방식)도 14개 테이블(v1.0 시절)만 커버 — 결제이벤트·대행주문·문의·블로그분석 등 현재 스키마 다수 누락 상태였음
- **조치(git `3ab9545`)**: pg_dump 경로 제거, REST API(443, 정상 확인됨) 방식을 유일 백업 경로로 전환. 테이블 커버리지 14→43개로 확장(존재하지 않는 것으로 확인된 `keyword_scan_results`·`keyword_search_volume` 2개는 앱 코드 어디서도 참조되지 않아 제외). 실패 시 운영자 이메일 알림 추가(`send_operator_alert`와 동일한 Resend 채널·발신 주소 사용).
- **라이브 검증(수동)**: 서버에서 직접 실행 → 43개 테이블 전체 성공, 6,338행 백업, exit code 0 확인(`/var/www/aeolab/backups/*_20260712_0016.json.gz`). md5 확인 후 로컬 git 커밋 완료.
- **라이브 검증(무인, 2026-07-12 03:00)**: 수동 테스트만으로는 "사람이 지켜볼 때만 되는 것"일 위험이 있어(과거 3개월 실패도 겉으로는 스크립트가 존재했음), 실제 cron이 아무 개입 없이 발동하는 순간까지 확인함. `journalctl _COMM=cron`으로 03:00:01 정시 발동 확인 + `/var/log/aeolab_backup.log`에 `총 6365행 백업 완료 (테이블 43개 중 실패 0개)` + `[20260712_0300] 백업 완료` 기록 + 43개 테이블 전부 `_0300` 타임스탬프 파일 실존 확인. **이것으로 D축 P0는 "무인 재현까지 확인된 수정 완료"로 격상.**
- **잔여**: 7일 롤링 삭제(`find -mtime +7 -delete`)는 유지. 오프사이트(서버 외부) 백업 복제는 없음 — 서버 자체가 손실되면 백업도 함께 손실. 구독자 확보 후 재검토 권장(예: 백업 파일을 이메일 첨부 또는 별도 스토리지로 주기 전송).

### P1 — 백업 실패 알림 부재 → 수정 완료 (위 항목에 포함)

- 기존에는 백업 스크립트가 스케줄러 잡 알림 시스템(`send_operator_alert`)과 분리된 순수 bash+cron이라 실패해도 아무도 알 수 없었음. 이번 수정으로 실패 시 이메일 알림 연결(Resend API, git `8c95e22` — Cloudflare가 기본 Python urllib User-Agent를 차단하던 문제를 `User-Agent` 헤더 추가로 해결·HTTP 200 실측 확인).
- 추가로 Healthchecks.io 외부 하트비트(start/success/fail 핑, git `fe1022d`)도 연결 — 이메일 알림과 달리 "스크립트 자체가 실행 안 됨"까지 잡는 독립 안전망. 03:00 무인 실행에서 curl 에러 없이 정상 핑 확인.

### P1 — 외부 업타임 모니터링이 등록돼 있었으나 전 체크가 405로 실패 중이었음 → 수정 완료 (2026-07-12)

- **경위**: 이 문서 작성 시점(2026-07-12 이전)엔 "미해결·계정 가입 필요"로 기록했으나, 이후 사용자가 이미 UptimeRobot에 가입해 `/health`를 모니터링 중이라고 알려옴. 신뢰 대신 실측 검증(CLAUDE.md 검증 문화) — `main.py:202` 독스트링에도 "UptimeRobot 5분 간격"이라는 기존 주석이 있어 실제 동작 여부를 nginx 로그로 직접 확인.
- **근거(발견)**: `ssh ... grep -i uptimerobot /var/log/nginx/access.log*` 결과 실제 UptimeRobot User-Agent 요청이 존재했으나 **전부 `HEAD /health` → `405 Method Not Allowed`**. 원인: FastAPI의 `APIRoute`는 Starlette 기본 `Route`와 달리 `methods=["GET"]` 등록만으로 `HEAD`를 자동 추가해주지 않음(`backend_venv/Lib/site-packages/fastapi/routing.py`에 Starlette `routing.py:234`의 `if "GET" in self.methods: self.methods.add("HEAD")` 로직이 없음 — 직접 소스 대조 확인).
- **반증 시도**: 같은 엔드포인트에 `GET`은 로컬·라이브 전부 200 정상 — 문제가 엔드포인트 전체 장애가 아니라 정확히 HTTP 메서드 불일치임을 격리 확인. 이 버그는 오늘 세션의 FastAPI/Starlette 업그레이드와 무관 — `/health` 라우트가 생긴 이래(구버전에서도 동일 구조) 계속 있었던 결함으로 추정.
- **의미**: UptimeRobot이 HTTP(s) 모니터를 HEAD 방식으로 체크하도록 설정돼 있었다면, 가입 이래 모든 체크가 실패(다운)로 기록되고 있었을 가능성이 높음 — 있으나 마나 한 모니터링 상태.
- **조치**: `backend/main.py` `/health` 라우트를 `@app.get(...)` → `@app.api_route("/health", methods=["GET", "HEAD"])`로 변경. 로컬 GET/HEAD 200 확인 → 서버 배포·pm2 재시작 무에러 → 라이브 `curl -X HEAD https://aeolab.co.kr/health` 200 확인(git `7df5e95`).
- **잔여**: UptimeRobot 대시보드 자체의 과거 다운타임 기록(이 버그로 인한 오탐)은 그대로 남아있을 수 있음 — 사용자가 UptimeRobot 대시보드에서 직접 확인 권장.

### 정보 제공 (조치 불필요, 현재 리스크 낮음)

- Supabase Free Tier 사용량 한도 대비 현재 사용량: 실사용자 0명 상태라 리스크 낮음 — 구독자 확보 후 재점검.
- 서버 단일 인스턴스(SPOF): 현 규모에서 의도적 트레이드오프로 판단, 이중화는 시기상조.

### P1(신규 발견, 2026-07-12) — nginx가 Cloudflare 실제 방문자 IP를 복원하지 않음 → 수정 완료 (2026-07-13)

- **경위**: M3(webhook rate limit) 라이브 검증 중 발견 — 같은 curl 클라이언트로 6회 연속 호출했는데 rate limit(분당 5회)이 전혀 걸리지 않음.
- **근거**: `curl -sI https://aeolab.co.kr`에 `Server: cloudflare`+`CF-RAY` 헤더 존재, DNS가 Cloudflare Anycast 대역(`104.21.x`, `172.67.x`)으로 응답 — 사이트가 Cloudflare 프록시(orange-cloud) 뒤에 있음을 확인. `ssh ... grep -rn 'set_real_ip_from\|real_ip_header' /etc/nginx/` 결과 0건 — Cloudflare의 실제 방문자 IP 복원 설정이 nginx에 없음.
- **의미**: nginx의 `proxy_set_header X-Real-IP $remote_addr`이 실제로 넘기는 값은 방문자의 진짜 IP가 아니라 **Cloudflare 엣지 노드의 IP**(요청마다 다른 엣지로 라우팅되어 값이 자주 바뀜). 이 백엔드의 IP 기반 rate limit(`scan.py` trial·trial-search·naver briefing·claim-stats 등 6곳 + 오늘 신설한 webhook/feedback 2곳) 전부가 "실제 방문자 단위"가 아닌 "Cloudflare 엣지 단위"로 카운트되고 있어, 설계 의도(예: 무료 체험 스캔 IP당 분당 10회·일 3~5회 — 유료 AI API 호출 남용 방지용 핵심 장치)가 실효를 갖지 못할 가능성이 있음. `_is_admin_request()`의 IP 화이트리스트 우회 경로도 같은 이유로 사실상 항상 미매치(다만 `X-Admin-Key` 헤더 경로가 별도로 있어 완전히 막힌 기능은 아님).
- **반증 시도**: nginx 설정 전체(`/etc/nginx/sites-enabled/*`)를 grep해 다른 파일·다른 서버블록에 real_ip 설정이 있는지 확인 — 0건, 반증 실패(진짜 공백).
- **조치(2026-07-13)**: `/etc/nginx/conf.d/cloudflare-realip.conf` 신설 — Cloudflare 공식 IPv4/IPv6 전체 대역(`https://www.cloudflare.com/ips-v4`, `-v6`) `set_real_ip_from` + `real_ip_header CF-Connecting-IP;`. 변경 전 `/root/nginx_backups/pre_cloudflare_realip_<timestamp>/`에 `sites-enabled`+`conf.d` 백업. `nginx -t` 통과 → `systemctl reload nginx`(무중단) → 라이브 검증 완료.
- **라이브 검증**: `curl https://api.ipify.org`로 확인한 실제 로컬 IP가 리로드 이후 요청부터 nginx `access.log`에 그대로 찍힘(리로드 전 로그는 여전히 Cloudflare 엣지 IP로 남아있어 전/후 대조 가능). M3 webhook rate limit 재테스트 — 동일 클라이언트 6회 연속 호출 시 이번엔 정확히 6번째 호출에서 `429` 발생(리로드 전엔 6회 전부 통과했었음) — IP 기반 rate limit이 실제로 작동하기 시작했음을 직접 확인.
- **참고(별도 발견, 미조치)**: 검증 중 `nginx -t`가 `conflicting server name "aeolab.co.kr"` 등 6개 경고를 냄 — 원인은 `sites-enabled/aeolab.bak.20260404_234049`가 여전히 활성 폴더에 있어 `include sites-enabled/*`(확장자 필터 없음)로 같이 로드되기 때문(3개월 이상 방치된 백업 파일, 실제 서비스는 정상 파일이 먼저 매치돼 문제 없음). 이번 작업 범위 밖이라 조치 안 함 — 향후 정리 시 `sites-available/`로 옮기거나 삭제 권장.

## 다음 단계 트리거

- `docs/commercial_launch_readiness_audit_v1.0.md 기준으로 C(사업성) 점검 진행` — 별도 세션 권장
- (선택) `sites-enabled`의 stale `.bak` 파일 정리 — 낮은 우선순위, 현재 위험 없음
