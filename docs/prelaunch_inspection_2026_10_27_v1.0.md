# 상업 출시 전 전체 점검 (2026-10-27) — 결과와 잔여 과제

방법: 서버 운영 상태 실측 + 라이브 브라우저(PC·모바일) 공개 페이지 순회 + 3개 읽기 전용 에이전트(공개 문구 사실 대조 / 실패 경로 사용자 노출 / 최근 변경 보안) 후 메인이 근거 라인을 직접 재검증.
에이전트 보고 중 라인 번호가 틀리거나(가이드 실패 처리 위치) 과장된 항목(변화 기록 페이지는 이미 대체 조회가 있음)은 정정했다.

## 1. 이번 점검에서 고친 것
| 구분 | 내용 | 근거 |
|---|---|---|
| 사용자 접속 | www.aeolab.co.kr가 리다이렉트 없이 열려, 페이지의 API 호출(본 도메인)이 CSP connect-src에 막혀 체험·요금제 데이터가 비어 보였음 → nginx 301 (www→본 도메인), 설정 백업 `/root/nginx_aeolab_backup_20261027` | 라이브 콘솔 CSP 오류 실측 |
| 신뢰 | 가이드 생성 실패(크레딧 소진 등)가 140초 뒤 "시간이 걸립니다"로만 보임 → 실패 기록 후 503+코드로 즉시 원인 안내(월 한도 미차감 사실 확인) | `routers/guide.py`, `GuideClient.tsx` |
| 점수 정확성 | 한쪽 AI(Gemini/ChatGPT) 측정이 오류·대량 실패(성공 표본<10, 실패≥10)면 0점으로 세던 것 → 다른 쪽만으로 평가, 둘 다 실패면 기존 0점 | `score_engine._ai_measurement_failed` + 테스트 |
| 신뢰 | 체험 화면 "상위 20위" 단정(지역 검색 API는 요청과 무관하게 최대 5곳만 반환 — 서버 실측) → "지역 검색 상위 5곳" | `NaverStatusSection`, `TrialCompetitorGapCard` |
| 신뢰 | 성장 리포트 기록 조회 실패 시 "기록 없음"과 구분 없이 빈 화면 → 안내 배너 | `growth/page.tsx`, `GrowthClient.tsx` |
| 사실 오기재 | Basic 자동 스캔을 "각 50회"로 안내(실제 scan_all 100회) — 공개 가이드·대시보드·카드 문구 정정 | `jobs.py:526-532` |
| 남용 | 수동 순위 측정에 사용자당 시간당 5회 제한(전역 상한 선점 방지) | `scan.py keyword-rank` |
| 보안 | 결제 실패 화면이 주소의 임의 문구를 그대로 표시 → 짧은 한글 문구만 허용 | `payment/fail/page.tsx` |
| 보안 | Next.js 16.2.11→16.4.3(next/og·이미지 최적화 RCE 권고, 앱이 ImageResponse 사용), @sentry/nextjs 10.76.2, aiohttp 3.14.4, Pillow 13.0.0 | npm audit·pip-audit |
| 운영 | 순위 측정 정답 점검 잡(매일 04:50, 환경변수 RANK_CANARY), 대량 실패 알림, 사용량 70/90% 경고, 추이 화면의 점수 계산 방식 변경 안내 | 별도 커밋 |

## 2. 확인된 정상 상태
- 디스크 35%, 메모리 여유 충분, 헬스 ok, pm2 2프로세스, 인증서 만료 2026-12-24(certbot.timer 자동 갱신), 6시간 주기 DB 백업+오프사이트 업로드(최근 10-26 21:00 성공), CI 전부 success.
- 공개 페이지 12종 PC·모바일: 200, 가로 스크롤 없음, 깨진 이미지 없음, apex 기준 콘솔 오류 없음. 가격·PG(크렙)·점수 비중·스캔 주기 문구는 단일 소스와 일치.
- 새 엔드포인트(strengths·resolve-place·keyword-rank) 인증·소유권 검증 정상, SSRF 경로 없음, 새 컴포넌트 외부 링크 rel 적용.
- 사전 스캔: 10-26까지 행은 구코드 실행분(`briefing_present` 등 None). 신코드 확인은 10-27 새벽 실행분부터.

## 3. 남은 과제 (결정·조치 필요)
1. **Claude 크레딧 충전(필수)** — 충전 전에는 가이드 생성이 실패한다(이제 원인은 안내됨).
2. **Gemini 결제 연결** — 연결 전에는 랜딩·요금제의 "Gemini·ChatGPT 각 100회 자동 측정" 문구가 현재 실패율(성공 표본 4~9회)과 다르다. 출시 전 연결하거나 문구를 조정해야 한다.
3. 크렙 심사 통과 후 라이브 키 전환(`CREB_TEST_PRICE_*` 삭제), 결제 실패 코드 매핑은 토스 기준이라 크렙 실제 코드로 재확인.
4. 실사용자 화면 확인: 로그인 대시보드의 "측정으로 확인된 점" 카드·순위 카드(서비스 계정 토큰 발급은 권한 분류기가 거부해 직접 확인하지 못함).
5. 후기 확보(`testimonials.ts` isPlaceholder).
6. 의심(미확정): `MentionContextSection`의 오류 경계, 경쟁사 관리 페이지 일부 조회 실패 시 빈 상태, 크렙 결제 취소 흐름 실결제 검증.
7. 의존성: 남은 high/critical은 `shadcn` CLI의 전이 의존성(런타임 미사용)과 sharp(libheif, 사용자 HEIF 미처리) — 실질 노출 낮음, shadcn을 devDependencies로 옮기는 정리는 선택.
8. 점수 연결·요일 분산·강점 신호 임계값 조정은 사용자 데이터 확보 후.

## 4. Gemini 측정 문구 임시 조정 (2026-10-27 추가)
- 배경: Gemini 무료 티어 한도로 100회 중 90회 이상 실패(성공 표본 4~9회) → "Gemini·ChatGPT 각 100회 자동 측정" 안내가 사실과 다름.
- 조치: `frontend/lib/featureFlags.ts`의 `GEMINI_MEASUREMENT_LIVE=false` 플래그를 두고, 랜딩 통계(4종→3종, 100회는 ChatGPT 기준)·기능 설명·요금제 설명·추천기·가입·결제완료·설정·체험 안내·대시보드 측정 타일·메타 설명 문구를 플래그에 따라 바꿈. 교육용 설명(Gemini 반영 원리·기간)은 그대로 유지.
- **되돌리는 법**: Gemini 결제 연결 후 대시보드에서 Gemini 표본이 정상(100회 근처)으로 쌓이는 것을 확인하고 플래그를 `true`로 바꾼 뒤 프론트를 재빌드·재시작한다.
- 남은 곳(미변경): 데모 페이지의 샘플 문구(데모 표시됨), `how-it-works`·`faq`·가이드의 교육용 설명, 랭킹 페이지·OG 이미지의 "4곳" 문구, 대시보드 내부 카드 일부의 Gemini 표본 표시(실제 표본 수를 그대로 보여주므로 사실과 일치).

## 5. 결제·크레딧 연결 가정으로 전환 (2026-10-27)
- 사용자 지시: Claude 크레딧 충전과 Gemini 결제를 곧 연결하므로 연결된 상태를 가정해 구현한다 → `GEMINI_MEASUREMENT_LIVE=true`로 되돌려 재배포(문구는 원래의 "Gemini·ChatGPT 각 100회").
- 연결 직후 확인: `ssh root@115.68.231.57 "cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python ../scripts/check_ai_providers.py"` — Claude·OpenAI 각 1건, Gemini 10회(스캐너와 같은 경로) 호출 결과를 출력.
  현재(연결 전) 결과: Claude `credit balance is too low`, OpenAI OK, Gemini 10회 중 성공 3회.
- Gemini 10회 중 9회 미만 성공이면 플래그를 false로 되돌리고 재빌드(안내 문구가 사실과 어긋나므로).
- 비용 확인 필요(미확정): 스캐너가 Gemini 2.5 Flash에 Google Search 그라운딩을 켜고 호출한다(`gemini_scanner.py:39-42`). 그라운딩 요금(일일 무료 한도 초과분)은 검색 결과가 모델·시점별로 상충해 확인하지 못했으므로 결제 연결 후 `ai_usage_log`와 Google 청구서로 실측할 것.
