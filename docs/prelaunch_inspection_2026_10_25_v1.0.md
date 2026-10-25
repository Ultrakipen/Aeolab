# 상업 서비스 직전 종합 점검 (2026-10-25)

> 범위: 로딩 속도 / 텍스트 크기·가독성 / PC·모바일 화면 / 안내문구 논리 / 이탈률 / 결제·출시 준비.
> 방식: 영역별 에이전트 5개가 읽기 전용으로 조사 → 메인 세션이 근거를 직접 재검증 → 오판 제거 후 수정·배포.

## 1. 수정·배포 완료 (git 커밋 참조)

| # | 내용 | 검증 |
|---|---|---|
| 1 | FAQ DB 행 2건(id 6·8)의 "토스페이먼츠" → "크렙" (+`faq_seed.py:137`). 크렙에서 확인되지 않은 "국내 모든" 카드 표현은 삭제 | 실서버 `/api/faq` 토스 0건 |
| 2 | 체험 화면 흐린 글자(`slate-400`) 상향: ScanningStep 48·89·96, ResultStep 377~381·1030·2089, NaverStatusSection 169·251, TodayOneAction 124 | 라이브 computed color 확인 |
| 3 | 체험 안내문에 "구글 지도" 추가(ScanningStep·InputStep 2곳·FindStep, 총 4곳) — 구글 지도는 실제 측정됨(`scan.py:831`, 결과 `GoogleMapCard`) | 라이브 DOM 텍스트 확인 |
| 4 | 체험 스캔 중 이탈 계측 `trial_scan_abort`(pagehide, step_index, beacon) 신설 | 라이브에서 pagehide 발생 시 `dataLayer`에 이벤트 적재 확인. **실제 탭 종료 시 GA 수신은 미확인** |
| 5 | Pretendard 폰트 서브셋 1.4MB→360KB (KS X 1001 2,350자 + 소스 사용 한글 전부) | 아래 §3 |

## 2. 에이전트 보고 중 오판·오탐으로 판명된 것 (재발 방지용)

- 랜딩 `text-gray-400` 57건 → 오판(`app/page.tsx` 0건, app+components 전체 7파일). 7월 문서의 옛 수치.
- 폰트로 인한 CLS → 오판(CLS 0.0015 이하, `size-adjust` 폴백 존재).
- 가입 완료 화면 "로그인 페이지로" 혼선 → 기각(인증 안내·재발송 버튼·미인증 로그인 오류 문구 모두 존재. `mailer_autoconfirm=False`로 인증은 필수).
- `TrialResultStep:1566`의 slate-400 → 어두운 패널 위라 정상.
- 데스크톱 "7~8px 글자" → 내 측정 도구 오탐(SVG 내부 좌표; 실제 렌더 10.5~12px).
- `CREB_TEST_PRICE_*` "P1 보안" → 과대평가(지정 UID 한정, 실결제 전환 체크리스트 항목).

## 3. 측정 방법 교훈 (이번 세션에서 실제로 틀린 것)

1. **`route.fulfill`은 CDP 네트워크 제한을 우회한다** — 파일을 로컬에서 바로 주므로 다운로드 비용이 0이다. "서브셋 폰트를 쓰면 JS가 4.5초 빨라진다"는 첫 결론은 이 때문에 틀렸다(사실은 "폰트가 없을 때"를 측정한 것).
2. 같은 URL 프로토콜의 서버 경로로 `route.continue({url})` 해야 제한이 적용된다(서버 `public/`에 임시 파일 + pm2 restart 후 삭제).
3. 바른 비교 결과(모바일 느린 4G + CPU 4배): 하이드레이션(버튼·입력 동작) 3.1~3.5초로 폰트와 무관, LCP 동일, **load 이벤트 12.9→7.4초, 전송량 −1.1MB(−54%)**. `lastJsEnd`는 하이드레이션 이후 늦게 받는 청크까지 포함해 사용자 체감 지표로 부적절.
4. SVG `<text>`의 computed `font-size`는 내부 좌표 단위라 실제 px가 아니다(`getScreenCTM().a`를 곱해야 함).
5. 공유 브라우저 접속 실패("Cloudflare 차단")는 영구 상태가 아니다 — 재시도해서 확인할 것.

폰트 서브셋 트레이드오프: 서브셋 밖 한글(사용자 입력 상호명 등 희귀 글자)은 시스템 한글 폰트로 대체 표시된다. 되돌리려면 `git show HEAD~:frontend/public/fonts/PretendardVariable.woff2`(1.4MB 원본)로 복원 후 빌드.

## 4. 실측 요약 (aeolab.co.kr, 2026-10-25)

- 서버 TTFB 0.04~0.16초, gzip 정상, robots/sitemap/OG/favicon 200, 없는 주소 404.
- 7개 공개 페이지 × (375px / 1280px): 가로 오버플로 0건, 모바일 본문 12px 미만 0건.
- 모바일 느린 4G+CPU 4배 콜드로드: FCP 2.0~3.2초, LCP 2.7~3.6초(`/trial` 최대). 보수적 시뮬레이션이며 1회 측정 기준.
- 헤더·푸터 텍스트 링크 높이 20px(WCAG 2.2 SC 2.5.8 24px 미달 가능, 인접 간격 예외 여부 미확인) — P3, 미조치.

## 5. 남은 일 (사용자 확인/작업 필요)

- **Supabase Auth SMTP**: 이메일 인증이 필수인데 Auth 메일의 발송 서버가 기본(발송 한도 매우 낮음)인지 자체 SMTP(Resend 등)인지 확인 못 함. 대시보드 Auth → SMTP Settings 확인 필요. 기본 서버면 출시 직후 가입이 병목.
- 베타 후기 1~3개 확보 → `lib/testimonials.ts` `isPlaceholder:false` (현재 섹션 숨김).
- **실결제 전환 시 서버 `backend/.env`에서 삭제**: `CREB_TEST_PRICE_USER_ID`, `CREB_TEST_PRICE_AMOUNT`, `TOSS_SECRET_KEY`(코드 미사용 잔존, 에이전트 보고) 후 `pm2 restart aeolab-backend`.
- 미실행: 실제 가입→인증메일 도착→첫 스캔 end-to-end, 카카오톡·네이버 인앱 브라우저, 체험 결과 화면 실렌더링(외부 API 비용), 요금 비교표 전수 재대조(에이전트 "전부 일치" 보고만 있음), `ai_usage_log` SQL 실행 여부.
- 서버 `.next` 재빌드 후 `Failed to find Server Action` 로그는 구버전 페이지를 열어 둔 클라이언트/봇 요청으로 보이며(문구 그대로 "older or newer deployment"), 배포 때마다 나올 수 있음.
