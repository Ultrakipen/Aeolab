# 상업 서비스 출시 직전 체크리스트 (2026-10-25 기준)

> 근거: 2026-10-25 종합 점검(`docs/prelaunch_inspection_2026_10_25_v1.0.md`) + 같은 날 네이버·Gemini·결제 후속 확인.
> 원칙: 이 표의 "상태"는 **직접 확인한 것만** 완료로 표시한다. 확인 못 한 것은 "미확인"으로 둔다.
> 담당: **사용자** = 사용자 계정·로그인이 필요한 작업 / **Claude** = 서버·코드·DB 읽기 확인.

---

## 1. 출시 전 반드시 끝나야 하는 것 (하나라도 미완이면 유료 판매 보류)

| # | 항목 | 담당 | 확인 방법 | 상태 |
|---|---|---|---|---|
| 1 | **크렙 결제 심사 통과** | 사용자 | 크렙 심사 결과 통보 | ⏳ 심사 중. 통과 전 심사용 계정(`creb-review@`) 삭제 금지 |
| 2 | **크렙 라이브 키 전환** (§5 절차) | 사용자+Claude | 라이브 키로 결제창 1건 시험 | ⏳ 1번 통과 후 |
| 3 | **Supabase Auth SMTP 확인** — 이메일 인증이 필수(`mailer_autoconfirm=False`)라, 인증 메일이 기본 발송 서버(한도 매우 낮음)로 나가면 출시 직후 가입이 막힘 | 사용자 | Supabase 대시보드 → Auth → SMTP Settings에서 자체 SMTP 설정 여부 확인 | 🔶 **연결 확인(2026-10-26)** — 커스텀 SMTP 켜짐(`smtp.resend.com:465`, 발신 `contact@aeolab.co.kr`), 시험 주소 가입 시 Supabase 응답 200·`confirmation_sent_at` 기록·Resend Emails에 "Confirm Your Signup" 발송 기록(존재하지 않는 주소라 bounced=정상). **남은 것: 실제 외부 메일 주소로 가입해 도착·스팸함·본문·인증 링크 확인**. 인증 메일 제목이 영어 기본값("Confirm Your Signup") — Authentication → Email Templates 한국어화 필요 |
| 4 | **가입 → 인증 메일 도착 → 로그인 → 첫 스캔 전체 테스트** | 사용자(메일 주소 제공)+Claude | 실제 메일함에서 인증 메일 수신, 첫 스캔 결과 화면 확인 | ❌ 한 번도 끝까지 못 함. 가입 완료 *화면*만 가짜 API 응답으로 확인함 |
| 5 | **Gemini 결제 연결 후 성공률 확인** — 무료 티어 한도로 하루 100회 중 92~97회 실패 중(`ResourceExhausted`, 10-16~24 `ai_usage_log`), 결과의 `sample_size`가 4~8 | 사용자(결제)+Claude(확인) | 결제 연결 후 스캔 1회 → `ai_usage_log`에서 gemini 성공이 100에 가까운지, `scan_results.gemini_result.failed_count` 확인. 결제는 `GEMINI_API_KEY`가 속한 Google Cloud 프로젝트에 연결 | ⏳ 사용자가 서비스 개선 후 직접 하기로 함 |
| 6 | **10-25 밤 스캔(KST 02:00경) 정상 확인** — 프록시 제거·접속실패 표시 수정·쿠키·Serper 키 교체 후 첫 실전 스캔 | Claude | 저장된 `naver_result`에 `error`/`page_load_failed` 없음, 구글 측정 정상, 백엔드 로그 새 오류 없음 | ⏳ 사용자가 10-26 오전에 요청하면 확인 |
| 7 | **`@aeolab.co.kr` 수신 정상화 + 운영 알림 수신** — 루트 MX에 SES 반송 서버(`feedback-smtp…amazonses.com`)가 iwinv와 같은 우선순위로 중복돼 수신 메일 약 절반이 `550 Mailbox does not exist!`로 반송됨(6/20 `test@`, 7/11 `contact@`, 10/26 시험). 이 때문에 Resend가 `contact@`를 차단(Suppressed)해 **운영 알림(NID_SES 만료·Gemini 실패 등)이 전부 미도착** | 사용자+Claude | Cloudflare 루트 MX 삭제 → `dig`로 반영 확인 → 외부 메일로 `contact@`·`support@` 수신 확인 → Resend Suppressions에서 `contact@` 삭제 → 시험 메일 도착 | ✅ **완료(2026-10-26)** — 루트 MX 정리, `support@`·외부 메일 수신 확인, Resend Suppressions에서 `contact@` 삭제, `send_operator_alert` 시험 메일이 `contact@` 메일함에 도착함. ⚠️ 이전(~10-26)에 나간 운영 알림(NID_SES 만료·Gemini 실패 등)은 전부 차단돼 도착하지 않았음 |

---

## 2. 하는 편이 좋은 것 (출시를 막지는 않음, 위험을 인지하고 판단)

| # | 항목 | 내용 |
|---|---|---|
| 7 | 법률 | 약관 법률 검토(미결), 정기결제 요금 인상 사전 고지(`docs/legal_compliance_and_infra_resilience_audit_v1.0.md` B축 P1, 법률 자문 권장). 네이버 스캔 방식은 법적 회색지대로 변호사 자문 대기(`docs/naver_scraping_legal_risk_assessment_v1.0.md`) — 사업적 위험을 감수할지는 사용자 판단 |
| 8 | Supabase 동시접속 | 대시보드는 동시 30명 안팎이 안전선이었음(08-23 측정, 이후 개선했으나 **재측정 안 함**). 플랜은 Claude가 확인 불가 |
| 9 | 네이버 서버 IP 차단 위험 | 프록시 없이 서버 한국 IP로 직접 접속 중. 요청이 늘어 차단되면 AI 브리핑 측정 중단 → 그때 유료 한국 프록시 도입(Webshare는 무료 플랜이라 KR 프록시 없음) |
| 10 | git push | 로컬 커밋 13개 미push. 자동 배포가 `reset --hard`라 push 전 내용 점검 필요(9개는 이전 작업분). 서비스 자체는 서버 코드로 동작하므로 출시를 막지는 않음 |
| 11 | 베타 후기 | `frontend/lib/testimonials.ts` 2건 모두 `isPlaceholder:true`라 섹션 숨김. 후기 1~3개 확보 시 `false`로 전환 |
| 12 | 예시 env 파일 | 루트 `.env.example` 등에 토스 줄이 남아 있음(Claude는 권한상 편집 불가). 사용자가 줄 삭제 또는 권한 허용 |
| 13 | 접근성·성능 P3 | 헤더·푸터 링크 높이 20px(24px 권장 미달 가능), 체험 하단 가입 배너 높이 152px(모바일 19%), 랜딩 대비 3건(장식 2·경계 1) |

---

## 3. 이미 확인·완료한 것 (재점검 불필요)

- 요금표: "한눈에 비교" 24칸 + "전체 기능 비교표" 64칸이 `PLAN_LIMITS`와 일치(불일치 0).
- 공개 8페이지 모바일 375px·데스크톱 1280px: 가로 오버플로 0, 12px 미만 글자 0, 대비 부족은 랜딩 3건만 남음.
- 체험 결과 5개 탭 실측: 오버플로 0, 12px 미만 0.
- 인앱 브라우저는 UA 시뮬레이션으로만 확인(**실제 카카오톡·네이버 앱 WebView는 미확인 — 휴대폰에서 링크를 직접 열어 볼 것**).
- 토스 키 삭제: 서버 `.env`·백업 파일 정리 완료(2026-10-25). 크렙 키로 결제 동작.
- FAQ DB 토스페이먼츠 문구 → 크렙, 체험 안내 구글 지도 반영, 흐린 글자 상향, 스캔 이탈 이벤트(`trial_scan_abort`).
- 네이버: `NID_SES`/`NID_AUT` 교체(2026-10-25, 로그인 상태 확인), 프록시 제거(직접 접속, 한국 IP 200), 접속 실패를 "미노출"이 아닌 "측정 실패"로 표시하도록 수정(git `8c2d16b`), AI 브리핑·AI탭 스캐너 실행 검증.
- Serper 키 재발급·교체(옛 키 403 확인, 새 키 200, 구글 스캐너 정상).
- `ai_usage_log` 테이블 존재·데이터 누적 확인(SQL 실행 완료).

---

## 4. 알려진 한계 (출시 후에도 안내·감시 필요)

- **과거 네이버 "미노출" 기록 일부는 부정확할 수 있음**: 접속 실패가 `mentioned:false`로 저장되던 결함(수정 전)이 있었고, 당시 기록에는 구분 표시가 없음. 프록시 407은 로그상 최소 10-17~ 확인(이전은 로그 보관 한계로 불명).
- **짧은 검색어는 AI 브리핑이 안 뜸**: "성수 맛집 추천"·"강남 맛집" 등 5개는 브리핑 없음, 문장형("서울 카페 추천해줘")은 뜸. 서비스가 만드는 검색어 형태가 브리핑을 얼마나 띄우는지는 **미측정** — "미노출" 중 일부는 브리핑 자체가 없는 경우일 수 있음.
- **Gemini 결과 신뢰도**: 결제 연결 전까지 표본 4~8회. 결제 후에도 성공률을 확인하기 전에는 "100회 측정"이라고 안내하지 말 것.
- 폰트 서브셋 밖의 희귀 한글(상호명 등)은 시스템 폰트로 대체 표시. 되돌리려면 git 이전 버전 `PretendardVariable.woff2` 복원 후 빌드.
- 서버 `bandwidth_tracker`의 프록시 월 예산(3GB) 80% 메일 경보는 프록시를 비운 지금 의미 없음(미확인·미조치).
- 오래된 일회성 잡(`ai_tab_trigger_check_job`, 2026-06-01 date)이 재시작 때마다 "146일 늦음" 경고를 찍음 — 실행되지 않는 로그, 무해.

---

## 5. 실결제 전환 절차 (크렙 심사 통과 후)

1. 크렙에서 라이브 `CREB_SID`·`CREB_SECRET_KEY`·클라이언트 키 수령.
2. 서버 `backend/.env`: `CREB_SID`·`CREB_SECRET_KEY` 교체, **`CREB_TEST_PRICE_USER_ID`·`CREB_TEST_PRICE_AMOUNT` 삭제**(지정 계정에 임시 금액이 적용되는 QA용 변수 — 남기면 해당 UID 결제 금액이 바뀜, `delivery.py:369-374`).
3. 서버 `frontend/.env.local`: `NEXT_PUBLIC_CREB_CLIENT_KEY` 교체 → `npm run build`(공개 변수는 빌드에 박힘).
4. `pm2 restart aeolab-backend aeolab-frontend`, `/health` 200 확인.
5. 라이브 키로 소액 결제 1건 시험 → 환불 경로(`delivery.py` `CREB_SID/SECRET_KEY` 사용) 확인.
6. 심사용 계정(`creb-review@`)은 **심사 통과 확인 후** 삭제(Auth + Storage).
7. 변경 후 CLAUDE.md "결제" 줄과 메모리를 갱신.

---

## 6. 운영 반복 작업

| 주기 | 작업 | 담당 |
|---|---|---|
| 월 1회 | `NID_SES`(+`NID_AUT`) 교체 — 마지막 2026-10-25, **다음 ~11-24**(만료 경고는 11-17부터, 운영자 알림 이메일이 실제로 도착하는지 사전 확인 권장). 방법: Chrome naver.com 로그인 → F12 → Application → Cookies → 값 복사 → 서버 `.env` + `*_ISSUED`(오늘) → `pm2 restart aeolab-backend`. 서버에서 `.env`를 `source`하지 말 것(멀티라인 값이 명령으로 실행됨) | 사용자(로그인)+Claude(반영) |
| 주 1회 | `bash scripts/check_server_drift.sh` — `[내용DRIFT] 0건`이 정상 | Claude |
| 상시 | Gemini·OpenAI 사용량·비용(`ai_usage_log`), Google Cloud 예산 알림 설정 | 사용자 |

---

## 7. 비밀 정보 노출 이력 (2026-10-25 대화 중)

- 서버 `.env`에서 읽는 과정에서 Webshare 프록시 계정 정보와 Serper API 키가 대화 출력에 노출됨. Serper 키는 **재발급·교체 완료**. Webshare 계정 정보는 현재 미사용(프록시 제거) — 재도입 시 새로 받은 값 사용.
- 사용자가 제공한 네이버 쿠키(`NID_SES`/`NID_AUT`)와 새 Serper 키는 대화 기록에 남아 있음. 쿠키 계정이 메인 계정이면 네이버 보안 설정에서 로그인 기록 확인·비밀번호 변경 시 이 쿠키도 무효화됨.
