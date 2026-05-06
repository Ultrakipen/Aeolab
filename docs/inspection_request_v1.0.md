# AEOlab 종합 점검 요청 가이드 — v1.0

> **작성일**: 2026-05-01
> **목적**: 새 대화창에서 본 문서 1줄 참조만으로 효율적인 종합 점검 진행
> **대상**: 2026-05-01 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 폐기 대응 + DB 컬럼 정합성 작업 이후 전체 서비스 검증

---

## ⚡ 새 대화창 1줄 시작

새 대화창을 열고 다음 문장 그대로 붙여넣으세요. 자동 라우팅으로 점검이 시작됩니다.

```
docs/inspection_request_v1.0.md를 읽고 그 안의 점검 절차를 순서대로 실행. 단계별로 실행 후 메인 세션이 SSH grep·헬스체크로 직접 검증한다 (CLAUDE.md 에이전트 검증 의무 준수).
```

---

## 0. 점검 배경 (꼭 읽기)

### 본 세션 변경 사항 요약 (점검 대상)

**컴플라이언스 문서 2종**:
- `docs/naver_ai_briefing_compliance_v1.0.md` — P0~P2 (URL 동적화·즉답형 가이드·D.I.A. 5요소 등)
- `docs/naver_talktalk_redesign_v1.0.md` — 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭(`/qna`) 폐기 대응

**핵심 변경**:
1. **스마트플레이스 사장님 Q&A 탭 폐기 대응** — `_SMARTPLACE_PATHS["faq"]` 제거, `_ACTION_STEPS["intro_qa"]` + `["talktalk_menu"]` 신규
2. **톡톡 채팅방 메뉴 신규 사양** — 6개 메뉴 + `link_type: "message"|"url"` + 메뉴명 6자
3. **점수 모델 일관화** — `has_faq` 가중치 0, 25점 → 소식 25 + 소개글 20 재배분
4. **DB 컬럼 오류 수정** — `profiles.id` → `user_id` (16건), `index_snapshots.avg_score` → `avg_unified` (응답 키 호환), `score_history.score_breakdown` ALTER 추가
5. **사용자 노출 화면 표현 정리** — "AI 브리핑 직접 인용" 단정 표현 0건, "사장님 Q&A 탭" → "소개글 Q&A 섹션"
6. **고아 파일 7개 삭제** + 서버 root flat 잔재 5개 정리

### 검증 의무 (CLAUDE.md 신설 — 2026-05-01)

> 두 사이클 연속 에이전트 거짓 보고 사고 발생. 신뢰 기반이 아닌 검증 기반으로 전환.

- 모든 에이전트 위임 작업 완료 후, **메인 세션이 직접 SSH grep·헬스체크로 검증**
- 거짓 보고 발견 시 즉시 메인 세션에서 직접 처리 (재위임 금지)

---

## 1. 점검 범위·우선순위

| 우선순위 | 영역 | 핵심 질문 |
|---|---|---|
| **P0 운영 안정성** | 백엔드 import·DB 컬럼·살아있는 죽은 URL | 서버가 NameError·죽은 URL 없이 정상 동작하는가 |
| **P1 사용자 노출 일관성** | 안내 문구·요금제·트라이얼·데모 페이지 | "직접 인용" 단정 표현·"Q&A 탭" 등 폐기 안내 0건인가 |
| **P2 사용자 시나리오 E2E** | 가입→트라이얼→대시보드→가이드→결제 흐름 | 실제 사용자가 막힘 없이 진행 가능한가 |
| **P3 비즈니스 가치 검증** | 네이버 데이터 → 사용자 맞춤 → AI 노출 가능성 | 서비스 약속이 실제로 작동하는가 |
| **P4 모니터링** | 카카오 알림톡·이메일·스케줄러 | 백그라운드 작업 정상 동작 |

---

## 2. 단계별 점검 프롬프트 (복사용)

### 2-1. P0 백엔드 일관성 점검

새 대화창에 그대로 붙여넣어 사용. **메인 세션이 위임 후 직접 검증**.

```
backend-dev 에이전트로 위임 후 메인 세션 검증.

목표: 본 세션(2026-05-01)에서 수정된 백엔드 코드가 운영 서버에서 정상 동작하는지 확인.

작업:
1. 다음 파일에서 살아있는 코드의 `/qna` 잔존 검색 (주석 [DEPRECATED] 제외):
   backend/services/{briefing_engine,smart_place_auto_check,score_engine,guide_generator,naver_place_stats,competitor_place_crawler}.py
   backend/routers/{report,guide,scan,public_index}.py
   backend/scheduler/jobs.py
   기준: `grep -rn "/qna\|qna\"" backend/ | grep -v "DEPRECATED\|deprecated"` → 0건

2. profiles 테이블 .eq("id", X) 잔존 검색:
   `grep -rn 'table("profiles")' backend/ -A 4 | grep -E '\.eq\("id"|\.in_\("id"'` → 0건

3. score_history.score_breakdown ALTER 적용 후 컬럼 정상 사용 확인:
   - 코드 SELECT에 score_breakdown 포함됨 (routers/report.py L:4738~)
   - 새 스캔 시 INSERT에 score_breakdown 포함됨 (routers/scan.py SSE 스트림 + Full 스캔)

4. SSH 검증 (메인 세션이 직접):
   - `ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 200 --nostream | grep -iE 'error|exception|nameerror|attributeerror|profiles\.id|score_breakdown.*does not exist|column.*does not exist' | head -20"` → 0건
   - `ssh root@115.68.231.57 "ls /var/www/aeolab/backend/report.py /var/www/aeolab/backend/services/jobs.py 2>&1"` → 'No such file' (root flat 잔재 0건)

5. /health, /api/report/visit-delta/test, /api/report/score-attribution/test, /api/public/index/summary 응답 코드 확인.

결과 형식: Critical / High / 통과 항목으로 분류. 검증 명령 출력 함께 첨부.
수정 작업 금지 — 검토·보고만. Critical 발견 시 메인 세션이 직접 수정.
```

### 2-2. P1 프론트엔드 안내 문구 일관성 점검

```
frontend-dev 에이전트로 위임 후 메인 세션 검증.

목표: 본 세션(2026-05-01) 이후 사용자 노출 화면에 폐기된 표현 잔존 0건 확인.

작업:
1. 다음 표현 검색 — 사용자 노출 경로(.tsx)만, 의도적 유지 1건(how-it-works:231 네이버 공식 인용)은 제외:
   - "직접 인용합니다" / "직접 인용 경로" / "가장 빠른 방법" / "가장 직접적"
   - "사장님 Q&A 탭" / "Q&A 탭에" / "스마트플레이스 → Q&A"
   - "톡톡 FAQ" (→ "톡톡 채팅방 메뉴"로 모두 갱신되어야 함)
   - "/qna" / "smartplace.naver.com/places/.*/qna"
   - has_faq 체크박스 + "+30점" 표시 (BusinessManager·RegisterBusinessForm UI에 잔존 시 사용자 허위 점수)

   기준: `grep -rn "<패턴>" frontend/app/ frontend/components/ --include="*.tsx" --include="*.ts"` → 0건 (의도 유지 1건 제외)

2. 다음 페이지의 "톡톡 채팅방 메뉴" 명칭·"partner.talk.naver.com" 정확 안내 확인:
   - frontend/components/dashboard/TalktalkFAQGeneratorCard.tsx
   - frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx (단계 3-b)
   - frontend/app/(public)/how-it-works/page.tsx (Phase A 3번 카드)
   - frontend/app/(dashboard)/guide/GuideClient.tsx (소개글 Q&A 섹션 안내)
   - frontend/app/(public)/demo/page.tsx (시나리오 4곳)
   - frontend/app/(public)/trial/components/TrialResultStep.tsx
   - frontend/app/(public)/pricing/page.tsx (요금제 비교표 "톡톡 채팅방 메뉴 AI 생성")

3. tsc --noEmit 0 오류:
   `cd frontend && npx tsc --noEmit 2>&1 | tail -20`

4. 고아 파일 잔존 0건:
   `ls frontend/app/GuideClient.tsx frontend/app/(dashboard)/competitors/GuideClient.tsx 2>&1` → 'No such file'

결과 형식: 잔존 표현이 발견되면 정확 좌표(파일:라인) + 컨텍스트 + 수정 권장 문구. 0건이면 "통과".
수정 작업 금지 — 검토·보고만.
```

### 2-3. P2 사용자 시나리오 E2E 테스트 (실제 브라우저)

> 본 영역은 자동화가 어렵습니다. **사용자(개발자)가 직접 브라우저에서 실행**하거나 가능한 범위만 자동화합니다.

```
backend-dev + frontend-dev 협업 (메인 세션이 조율).

목표: 실제 사용자(소상공인) 입장에서 다음 시나리오가 막힘 없이 진행되는지 확인.

시나리오 A — 비로그인 트라이얼 → 가입 전환:
1. https://aeolab.co.kr/trial 접속 → 업종·지역·가게명 입력
2. 트라이얼 결과 화면 표시 — 점수·키워드 갭·소개글 Q&A 섹션 안내 확인
   - 폐기된 "사장님 Q&A 탭" 표현 없는지
   - 카카오톡 공유·텍스트 공유 버튼 동작
3. ClaimGate에서 이메일 입력 → 매직링크 발송 → /trial/claimed 경로 정상 도착
4. 회원가입 완료 → 대시보드 진입

시나리오 B — 대시보드 사용자 가이드 흐름:
1. 대시보드 진입 → 스마트플레이스 점수 표시 (smart_place_completeness 합계 100점 기준)
2. /guide/ai-info-tab 접속 → 단계 3-b "톡톡 채팅방 메뉴 등록" 명칭 확인
3. "대시보드에서 채팅방 메뉴 자동 생성하기" 버튼 → 신규 카드(6개 메뉴 + 메시지/URL 토글) 동작
4. "톡톡 파트너센터 열기" → partner.talk.naver.com 정확 이동

시나리오 C — 점수 변화 추적:
1. 가게 등록 후 → /score-attribution 엔드포인트 응답 정상 (401이면 인증 필요만 확인)
2. 매주 월요일 04:00 keyword_rank_basic_weekly_job 정상 실행 (다음 실행 시점 PM2 로그 모니터)
3. 점수 항목별 분해(score_breakdown JSONB) 누적 시작 — 다음 스캔부터

검증 명령 (메인 세션 직접):
- `ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 300 --nostream | grep -iE 'scan|score|trial|kakao' | tail -20"`
- `curl -sI https://aeolab.co.kr/{trial,how-it-works,pricing,demo,signup,login,faq}` → 모두 200

결과 형식: 시나리오별 통과/실패 + 막힌 지점 정확한 화면 캡처(가능 시) + 막힌 사유.
브라우저 자동화 도구 사용 가능하면 활용 (예: Playwright 스크립트). 없으면 수동 점검 권장 항목으로 보고.
```

### 2-4. P3 비즈니스 가치 검증 (네이버 데이터 → 사용자 맞춤 → AI 노출)

```
scan-engine 에이전트로 위임 후 메인 세션 검증.

목표: 서비스 약속(네이버 데이터 수집 → 사용자 맞춤 방안 → AI 브리핑·ChatGPT 실질 노출)이 실제로 작동하는지 검증.

검증 항목:

A. 네이버 데이터 수집 정상 동작:
1. naver_visibility.py — 가게명 검색 시 블로그 언급 수·플레이스 노출·AI 브리핑 mention 수집
2. naver_keyword_rank.py — 사용자 등록 키워드의 PC/모바일/플레이스 순위 측정 (Playwright Semaphore(2))
3. naver_place_stats.py — 스마트플레이스 정보 탭에서 소개글·소식·has_faq 텍스트 추출 (/qna 폐기 후)
4. naver_scanner.py — 네이버 AI 브리핑 DOM 파싱 mention 검출

→ 베타 1호(education, INACTIVE) 데이터로 sample 호출 시 모든 모듈 정상 응답 확인.

B. 사용자 맞춤 방안 제시 (gap_analyzer + briefing_engine):
1. gap_analyzer.analyze_gap_from_db() — keyword_gap·pioneer_keywords·missing_keywords 산출
2. briefing_engine.build_direct_briefing_paths() — 4경로(intro_qa·review_response·post·intro) 생성
3. 각 경로의 action_url이 살아있는 URL인지 (qna 절대 안 나와야 함)
4. _ACTION_STEPS[intro_qa] 정확한 안내: "스마트플레이스 → 업체정보 → 소개글에 Q&A 5개 포함"

C. AI 노출 가능성 (실측 + 모델 정합성):
1. score_engine.calc_track1_score() — 6항목 가중치 합 100% (NAVER_TRACK_WEIGHTS_V3_1 검증)
2. calc_smart_place_completeness() 만점 100점 — 25(등록)+30(순위)+25(소식)+20(소개글) 합계 검증
3. INACTIVE 업종(education 등) — Track2 Global 채널이 더 큰 비중 (DUAL_TRACK_RATIO 정상 적용)
4. ai_citations 테이블 — Gemini·ChatGPT 인용 실증 데이터 누적 시작 (베타 1호 기준)

D. 정직성 원칙 준수:
1. 모든 변동 데이터에 "측정 시점·기기·로그인 상태에 따라 달라질 수 있음" 면책 일관 적용
2. (추정) 배지 정확히 표시 (블로그 C-rank·키워드 갭 cold start 등)
3. 빈 상태에서 "아직 데이터 없음 — 첫 스캔 후 표시" 안내

검증 방법:
- 점수 시뮬레이션: 베타 1호 실제 데이터로 calc_track1_score() dry-run → 변화 폭 ±5점 이내
- 4경로 생성 dry-run: 임의 biz dict로 build_direct_briefing_paths() 호출 → action_url 모두 살아있음
- 면책 문구 grep: `grep -rn "측정 시점" frontend/` → 5건 이상 일관 사용

결과 형식: 모듈별 통과/실패 + 점수 시뮬레이션 결과 + 정직성 원칙 위반 라인 (있으면).
```

### 2-5. P4 모니터링 (카카오 알림톡·이메일·스케줄러)

```
backend-dev 에이전트로 SSH 직접 점검.

목표: profiles.id → user_id 수정 후 카카오 알림톡·이메일 발송이 실제로 정상화됐는지 확인.

검증 항목:
1. 다음 잡의 직전 실행 결과 — PM2 로그에서 success/skipped/failed 카운트 확인:
   - keyword_rank_basic_weekly_job (월 04:00) — 키워드 순위 변동 시 카카오 알림
   - new_user_day7_rescan_job (매일 09:00) — 신규 사용자 7일 재스캔 알림
   - conversion_followup_job (매일 10:00) — D+7/D+14/D+30 미결제 알림
   - weekly_digest_job (월 08:30) — 주간 이메일 다이제스트
   - check_low_rating_reviews — 부정 리뷰 감지 알림
   - detect_competitor_changes — 경쟁사 변화 알림
   - check_briefing_alert_job — AI 브리핑 신호 알림

2. SSH 검증:
   ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 1000 --nostream | grep -E 'kakao|notify|email|digest' | tail -50"
   ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 1000 --nostream | grep -iE 'phone.*조회 실패|profiles.*does not exist'" → 0건이어야 함

3. 카카오 알림톡 5종 + AEOLAB_KW_01 신규 템플릿 승인 상태 .env 확인:
   ssh root@115.68.231.57 "grep -E 'KAKAO_TEMPLATE|KAKAO_APP_KEY|KAKAO_SENDER_KEY' /var/www/aeolab/.env | wc -l" → 5개 이상

4. 이메일 발송 (Resend) 확인:
   ssh root@115.68.231.57 "grep RESEND_API_KEY /var/www/aeolab/.env" → 키 설정됨

결과 형식: 잡별 직전 실행 시점·success 카운트·실패 사유 (있으면).
미실행 잡(다음 시점 대기 중)은 "대기 중" 표시.
```

### 2-6. 종합 보고서 작성 (점검 마무리)

```
모든 단계 완료 후 메인 세션이 직접 작성.

종합 보고서 형식:

## 점검 결과 — YYYY-MM-DD

### 1. P0 운영 안정성
- Critical: N건
- 통과 항목: ...
- 검증 명령 출력 첨부

### 2. P1 사용자 노출 일관성
- 잔존 표현: N건 (있으면 정확 좌표)
- 통과 항목: ...

### 3. P2 사용자 시나리오 E2E
- 시나리오 A/B/C 통과 여부
- 막힌 지점 (있으면)

### 4. P3 비즈니스 가치
- 네이버 데이터 수집: 통과/실패
- 사용자 맞춤 방안: 통과/실패
- AI 노출 가능성: 점수 정합성 통과/실패

### 5. P4 모니터링
- 잡별 직전 실행 결과

### 6. 발견 이슈 우선순위
- Critical (배포 차단): ...
- High (단기 수정): ...
- Medium (다음 사이클): ...

### 7. 종합 판단
- "안정 상태" / "추가 fix 필요" / "회귀 발생" 중 하나
- 근거 1줄

### 8. 다음 추천 작업
```

---

## 3. 검증 명령 모음 (메인 세션 직접 실행용)

### 3-1. SSH 직접 검증

```bash
# 운영 서버 헬스
ssh root@115.68.231.57 "pm2 status | grep aeolab"
curl -s https://aeolab.co.kr/health

# 백엔드 오류 0건 확인 (점검의 가장 중요한 1줄)
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 300 --nostream | grep -iE 'error|exception|nameerror|attributeerror|importerror|profiles\.id|score_breakdown.*does not exist|column.*does not exist' | head -20"

# 코드 변경 실제 반영 확인 (root flat 잔재 함정 회피)
ssh root@115.68.231.57 "ls /var/www/aeolab/backend/{report,smart_place_auto_check}.py /var/www/aeolab/backend/services/jobs.py 2>&1"
# → 'No such file' 3건 모두 나와야 정상

# /qna 살아있는 코드 잔존 0건
ssh root@115.68.231.57 "grep -rn '/qna' /var/www/aeolab/backend/ /var/www/aeolab/frontend/app/ /var/www/aeolab/frontend/components/ 2>/dev/null | grep -v 'DEPRECATED\|node_modules\|\.next' | wc -l"

# 핵심 페이지 200 응답
for path in / /trial /pricing /demo /how-it-works /faq /signup /login; do
  echo "$path: $(curl -s -o /dev/null -w '%{http_code}' https://aeolab.co.kr$path)"
done
```

### 3-2. DB 컬럼 존재 확인 (Supabase SQL Editor)

```sql
-- score_history.score_breakdown 컬럼 (이번 세션 ALTER 실행 후)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'score_history';

-- profiles 테이블 PK 확인 (user_id여야 함)
SELECT a.attname AS pk_column
FROM   pg_index i
JOIN   pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
WHERE  i.indrelid = 'profiles'::regclass AND i.indisprimary;

-- index_snapshots 컬럼 (avg_unified 존재해야 함)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'index_snapshots'
  AND column_name IN ('avg_unified', 'avg_score', 'p25_unified', 'p75_unified');

-- 미실행 v4.1 ALTER 5건 (선택 사항이므로 미실행도 정상)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'businesses'
  AND column_name IN ('is_franchise','naver_intro_draft','naver_intro_generated_at','talktalk_faq_draft','talktalk_faq_generated_at');
```

---

## 4. 거짓 보고 방지 체크리스트

> 2026-05-01 두 사이클 연속 에이전트 거짓 보고 사고 발생. 다음 항목 통과 없으면 "점검 완료" 보고 금지.

- [ ] 메인 세션이 SSH로 핵심 변경 라인을 직접 grep해서 본 적 있음 (최소 1개 파일)
- [ ] PM2 backend·frontend 모두 `online` 상태 직접 확인
- [ ] 백엔드 `error.log` 비어있음 또는 무관한 오류만 있음 직접 확인
- [ ] 핵심 페이지(/health, /trial, /how-it-works, /pricing) 모두 200 직접 확인
- [ ] root flat 잔재 파일 0건 (`backend/report.py` 등) 직접 확인
- [ ] `/qna` 살아있는 코드 0건 직접 grep 확인

---

## 5. 새 대화창에서 효율적인 진행 순서

1. **먼저** 새 대화창 열고 **이 문서 1줄 트리거 (§ ⚡)** 붙여넣기
2. 자동 라우팅으로 단계별 점검 시작
3. 각 단계 완료 후 메인 세션이 § 3 검증 명령 직접 실행
4. § 4 체크리스트 모두 통과 시 § 2-6 종합 보고서 작성
5. Critical/High 발견 시 메인 세션에서 직접 수정 (에이전트 재위임 금지 — CLAUDE.md 검증 의무)

### 예상 소요 시간 (단계별)

| 단계 | 시간 | 비고 |
|---|---|---|
| 2-1 P0 백엔드 일관성 | 10~15분 | grep + SSH 검증 위주 |
| 2-2 P1 프론트엔드 안내 | 10~15분 | grep + tsc --noEmit |
| 2-3 P2 사용자 시나리오 | 30~60분 | 브라우저 수동 또는 Playwright 자동화 |
| 2-4 P3 비즈니스 가치 | 15~25분 | 점수 시뮬레이션 + 모듈 dry-run |
| 2-5 P4 모니터링 | 5~10분 | PM2 로그 모니터 위주 |
| 2-6 종합 보고서 | 5~10분 | |
| **총합** | **75~135분** | |

---

## 6. 문서 변경 이력

| 일시 | 변경 |
|---|---|
| 2026-05-01 | v1.0 초안 작성 — 2026-05-01 톡톡 개편·Q&A 폐기·DB 컬럼 정합성 작업 직후 종합 점검용 |

---

## 7. 관련 문서

- 컴플라이언스: `docs/naver_ai_briefing_compliance_v1.0.md`, `docs/naver_talktalk_redesign_v1.0.md`
- 점검 체크리스트: `docs/code_review_checklist.md` (코드 품질 일반 체크)
- 모델 엔진: `docs/model_engine_v3.0.md`
- 프로젝트 컨텍스트: `CLAUDE.md` (특히 § 작업 중요 지침 + § 에이전트 보고 검증 의무)

---

*이 문서를 새 대화창에서 그대로 사용. 점검 결과 → § 2-6 형식으로 보고 → 발견 이슈 직접 수정 → 배포까지 한 사이클.*
