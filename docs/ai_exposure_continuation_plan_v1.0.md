# AEOlab 네이버 AI 탭 + AI 브리핑 + ChatGPT 대응 연속 작업 계획 v1.1

> 작성 2026-05-18 v1.0 / 갱신 2026-05-18 v1.1 — 문제 분류 검증 절차 통합
> 어느 대화창에서도 §0 트리거 명령으로 이어서 작업 가능
> 외부 자료 조사 + 코드 실측 + 오판 정정 + 우선순위 재분류 결과 반영

---

## §0 트리거 명령 (새 대화창 1줄)

```
docs/ai_exposure_continuation_plan_v1.0.md 기준으로 작업 진행. CLAUDE.md §"문제 분류 검증 의무" 준수하여 P 분류 직전에 반드시 반증 시도 1회. 먼저 §2의 현재 상태가 변동 없는지 SSH로 1분 점검 후, §3에서 가장 위쪽 미완료 항목부터 시작할 것.
```

부분 작업만 원하면 `§3.P1` 또는 `§3.P2-2`처럼 항목 번호로 한정.

### §0.1 작업 시작 전 필수 검증 (모든 P 항목 공통)

CLAUDE.md "문제 분류 검증 의무" 적용. 각 P 항목 착수 전:

1. **단정 근거 라인** — 본 문서 §2/§3에 명시된 file:line을 Read/Grep으로 직접 확인
2. **반증 시도 라인** — 호출처 grep 또는 전체 카운트 grep 중 1회 — "이게 이미 해결돼 있을 가능성"을 적극 찾는다
3. **결과 보고 형식** — `[근거 file:line, 반증 file:line] 작업 착수 / 불필요 판정`

> 본 문서 v1.0 작성 시점에 발생한 오판 3건은 모두 반증 시도 1회로 막을 수 있었음. 작업 진행 전 반드시 적용.

---

## §1 최신 외부 사양 (2026-05-18 조사 기준)

### 1.1 네이버 AI 탭 (2026-04-27 베타 출시)
| 항목 | 사실 | 출처 |
|------|------|------|
| 출시·확대 | 2026-04-27 네이버플러스 멤버십 우선, 2026 **상반기 내 전체 사용자 + 모바일 메인 검색바** 통합 | 아주경제·Korea Herald |
| 업종 제한 | **없음** — 모든 업종 노출 후보 | 네이버 공식 발표 |
| 핵심 가치 | 검색 → 예약 → 결제까지 한 화면 처리하는 **실행형 에이전트** | KMJ·아주경제 |
| 콘텐츠 소스 | Place·Shopping·Blog·Cafe **UGC 종합** | Korea Herald |

### 1.2 네이버 AI 브리핑 (수익화 임박)
| 항목 | 사실 | 출처 |
|------|------|------|
| 침투율 | 2025-12 기준 **전체 검색의 20% 돌파** | 네이트 뉴스 2025-12-15 |
| 2026 Q2 | **광고 테스트 시작** (쇼핑·로컬 결합) | Daum 2026-04-30 |
| 2026 Q3 | 본격 수익화 — ADVoost 광고 솔루션 + 답변형 광고 | Daum 2026-04-30 |
| 노출 알고리즘 | C-rank 4요소(Context/Content/Chain/Creator) + D.I.A. 5요소(주제·경험·충실·독창·적시) | 리드젠랩 |
| 필수 콘텐츠 구조 | 첫 문단 즉답 + H2/H3 + FAQ/비교표 + JSON-LD FAQ 스키마 + 월 1회 업데이트 | 리드젠랩 |
| 업종 제한 | 플레이스형은 ACTIVE 5종(restaurant/cafe/bakery/bar/accommodation) + **프랜차이즈 제외** | 네이버 공식 PDF |

### 1.3 2026 스마트플레이스 알고리즘 변화
- **키워드 삽입 시대 종료** → **실질적 상호작용 지수**(전화·길찾기·저장) 비중 증가
- **포토 리뷰 + 4.5점 + 주 3~5건 점진 축적** 안전
- "잘 만들어진 < **계속 관리되는**" 플레이스 선호
- **AI 리뷰 관리 솔루션** 신기능(2026-04): 플레이스 플러스 베타 사업장에 AI 답글 자동 작성 제공
- 출처: 스토어아트·아이보스·파인애드

### 1.4 글로벌 AI 동향 (ChatGPT/Gemini/Google)
- **E-E-A-T**(Experience·Expertise·Authoritativeness·Trustworthiness) 중요도 상승
- 네이버는 외부 AI 크롤링 차단 → 폐쇄형 전략 (네이버 AI 노출 ↔ 글로벌 AI 노출은 별도 트랙)

---

## §2 현재 구현 실측 상태 (오판 정정 포함)

> 2026-05-18 코드 직접 확인. 이전 점검 일부 오판 정정.

### 2.1 정상 동작 (변경 불필요)

| 영역 | 코드 위치 | 상태 |
|------|---------|------|
| AI 브리핑 ACTIVE 5종 + LIKELY 9종 분리 | `score_engine.py:30,33` `BRIEFING_ACTIVE_CATEGORIES`·`BRIEFING_LIKELY_CATEGORIES` | OK |
| `get_briefing_eligibility()` + `get_ai_tab_eligibility()` 분리 | `score_engine.py:76~` | OK |
| 프랜차이즈 제외 | `score_engine.py` | OK |
| `simulate_ai_tab_answer()` — 모든 업종 처리 + measured/estimated 배지 | `briefing_engine.py:1392` | OK |
| `/api/report/ai-tab-preview/{biz_id}` — INACTIVE도 `available=True` 반환 | `routers/report.py:1355` | OK |
| Basic A안 50/50 (Gemini 50 + ChatGPT 50 + Naver) | `multi_scanner.scan_basic()` | OK |
| Full (Gemini 100 + ChatGPT 100 + Naver + Google) | `multi_scanner.scan_all()` | OK |
| `ai_tab_context` 키워드 — 거의 모든 업종 정의 (legal·accounting·realestate·auto·interior 포함) | `keyword_taxonomy.py` | OK |
| 스케줄러 3종 (ai_tab_trigger / briefing_expansion / inactive_post) | `scheduler/jobs.py:232·256·262` | OK |
| `NaverAiPathwayCard` 자기 업종 배지 분기 | `components/dashboard/NaverAiPathwayCard.tsx` | OK |
| `/guide/ai-tab` 5항목 가이드 (모든 업종) | `app/(dashboard)/guide/ai-tab/page.tsx` | OK |
| `/guide/ai-info-tab` AI 브리핑 분기 안내 | `app/(dashboard)/guide/ai-info-tab/page.tsx` | OK |
| 가격 단일 소스 정합 | `plans.ts` ↔ `prices.py` | OK |
| Playwright Semaphore(1) RAM 보호 | `multi_scanner.py:33` | OK |

### 2.2 이전 점검 오판 정정

| 이전 분류 | 실측 결과 | 정정 |
|---------|---------|------|
| ~~P0: INACTIVE `/ai-tab-preview` 라우터가 `available=false` 반환~~ | `routers/report.py:1355` 항상 `available=True` | **오판** — 옛 주석(:1299)에 의존한 잘못된 판단. 옛 주석만 정리하면 됨 |
| ~~P1: `keyword_taxonomy.py`에서 legal·accounting·realestate·auto `ai_tab_context` 누락~~ | line 988(auto), 1102(accounting), §2.5(legal), §2.16(realestate) 모두 정의됨 | **오판** — 거의 모든 업종에 이미 정의됨 |
| ~~P1: PlanGate `FEATURE_LOSS_MESSAGES`에 `ai_tab_preview`·`keyword_rank`·`chatgpt_mention` 영문 키 누락~~ | 실제 PlanGate 호출처 9곳은 모두 **한글 feature 문자열** 사용 (`"AI 개선 가이드"`, `"키워드 충족도 분석"` 등). 영문 키는 호출되지 않음 | **오판** — 영문 키 추가해도 호출 안 됨. 한글 키에 더 강한 손실 카피 적용은 가능 |

### 2.3 실제 보완이 필요한 항목 (재분류)

§3 작업 항목에서 다룸.

---

## §3 작업 항목 (재분류된 우선순위)

### P0 — 즉시 (오늘~내일, 30분 이내)

#### P0-1. `routers/report.py:1299` 옛 주석 정정
- **현 상태**: 주석 "ACTIVE/LIKELY 업종만 반환. INACTIVE 업종은 available=false." 가 실제 동작과 불일치
- **실제 동작**: 모든 업종 `available=True` (line 1355)
- **작업**: 주석 1줄 수정
```python
# AS-IS (line 1299)
ACTIVE/LIKELY 업종만 반환. INACTIVE 업종은 available=false.
# TO-BE
AI탭(2026-04-27 베타): 업종 제한 없음. INACTIVE 업종도 available=True 반환.
```
- **검증**: `grep -n "INACTIVE" /var/www/aeolab/backend/routers/report.py | head -5`

### P1 — 이번 주 (2~4시간)

#### P1-1. 비ACTIVE 업종 대시보드 상단 명시 배너 (신규)
- **이유**: 현재 `NaverAiPathwayCard`는 비교표 형태로 좋으나, INACTIVE 업종 가입자 첫 진입 시 **"내 업종은 안 되는 줄"** 오해 잔존 가능
- **작업**: `frontend/app/(dashboard)/dashboard/sections/DashboardHeader.tsx` 또는 `DashboardInsightZone.tsx` 최상단에 INACTIVE 업종 + 첫 7일 이내 가입자 한정 1줄 배너 노출
```tsx
// 조건: briefingEligibility === "inactive" && daysSinceSignup <= 7
"💡 AI 브리핑은 비대상 업종이지만, AI탭(모든 업종 베타) + ChatGPT·Gemini 노출은 정상 측정 중입니다."
```
- **검증**: 새 INACTIVE 업종 계정으로 대시보드 진입 → 배너 노출 확인

#### P1-2. 빈 키워드 사업장 시뮬레이션 결과 보강
- **현 상태**: `simulate_ai_tab_answer()`는 정상이나, 사업장이 키워드를 0개 등록한 경우 `matched=[]`로 빈약한 답변
- **작업**: `AiTabPreviewCard.tsx`에서 `matched_contexts.length === 0` 분기 — "키워드를 등록하면 AI탭 답변 추정이 정확해집니다" + 키워드 등록 버튼
- **검증**: 키워드 0개 계정 → 카드에 등록 유도 표시 확인

#### P1-3. AI 브리핑 침투율·광고화 시의성 카피 (랜딩)
- **위치**: `frontend/app/page.tsx` §4-B 비교표 상단 1줄
- **카피**: "AI 브리핑은 이미 네이버 검색 5건 중 1건 (2025-12 기준 20%). 2026 Q2 광고화 시작 — **자연 노출 자리 선점이 마지막 기회**입니다."
- **검증**: 랜딩 §4-B 직접 확인

### P2 — 다음 스프린트 (1~2주)

#### P2-1. taxonomy 단위 `in_ai_tab`·`ad_only` 전역 플래그 신설
- **이유**: CLAUDE.md M1 명세 "WHITELIST 59개 + `in_ai_tab`/`ad_only` 전역 플래그 신설" 미완 (`naver_scanner` 결과 dict에만 존재, taxonomy 레벨 부재)
- **작업**: `keyword_taxonomy.py`의 각 업종 키워드 항목에 `in_ai_tab: bool`·`ad_only: bool` 메타 추가 → `naver_scanner`가 taxonomy 메타와 실측 결과 교차 검증
- **영향 파일**: `keyword_taxonomy.py`, `naver_scanner.py`, `briefing_engine.py`

#### P2-2. PlanGate 한글 손실 카피 강화 (영문 키 추가 아님)
- **현 상태**: PlanGate 9곳 모두 한글 feature 문자열 사용 → fallback `"{feature} 플랜부터 이용 가능합니다"` 노출
- **작업**: `FEATURE_LOSS_MESSAGES`에 **한글 키** 추가
```typescript
'AI 개선 가이드':       'AI 개선 가이드는 Basic부터 이용 가능합니다 (월 5회 무료 시작)',
'키워드 충족도 분석':   '키워드 충족도 분석은 Basic부터 — 부족 키워드 자동 추출',
'AI 인용 현황':         'ChatGPT·Gemini 실제 인용 문장은 Basic부터 — 이번 달 잠금 해제',
'경쟁사 키워드 모니터링': '경쟁사 키워드 변화 알림은 Basic부터 — 매일 자동 추적',
'블로그 AI 진단':        '블로그 AI 진단은 Basic부터 — D.I.A. 5요소 자동 채점',
'ChatGPT 광고 대응 가이드': 'ChatGPT 광고 대응 가이드는 Pro부터',
```
- **검증**: 비로그인 또는 free 사용자가 Basic 잠금 컴포넌트 클릭 → 강화된 카피 표시

#### P2-3. AI 브리핑 광고화 영향 대응 전략 검토 (문서만)
- **이유**: 2026 Q3 본격 광고화 시 자연 노출 자리 축소 예상 → 사용자에게 어떤 가치 새로 제공할지 사전 정의
- **작업**: `docs/post_briefing_ad_strategy_v1.0.md` 신규 작성 (논의 후) — 광고 자리 vs 자연 자리 분리 측정 / 광고 정책 변경 시 대응 매뉴얼

#### P2-4. 현재 가입자 INACTIVE 업종 비율 측정 SQL 잡 (가시화)
- **이유**: INACTIVE 업종 UX 개선 우선순위가 실제 비율에 따라 변동되어야 함
- **작업**: 관리자 대시보드 또는 주간 잡에 다음 쿼리 추가
```sql
SELECT
  CASE WHEN category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'active'
       WHEN category IN ('beauty','nail','skincare','massage','spa','pet','fitness','yoga') THEN 'likely'
       ELSE 'inactive' END AS group,
  COUNT(*) AS count
FROM businesses
GROUP BY 1;
```

### P3 — 사용자 확보 후 (1~3개월, 베타 5명+ 또는 BEP 20명 도달 시)

#### P3-1. 스마트플레이스 상호작용 지수 추적
- **이유**: 2026 알고리즘 핵심 신호. 키워드보다 비중 ↑
- **작업**: 신규 `services/interaction_signals.py` — 전화·길찾기·저장 카운트 추정(스마트플레이스 통계 페이지 Playwright 또는 사용자 수동 입력 폼) → Track1 점수 보정
- **요금제 위치**: Pro/Biz 차별화 카드로 활용
- **트리거**: 베타 5명+ 확보 + 사용자 동의 후

#### P3-2. AI 답글 자동화 차별화 메시지 (포지셔닝)
- **상황**: 네이버가 플레이스 플러스 베타에서 AI 답글 자동 작성 직접 제공 시작
- **AEOlab 차별화**: ① 다매장 통합 ② 답글 톤 일관성 가이드 ③ 답글 후 점수 변화 측정
- **작업**: 랜딩 §5(기능 비교) + 가이드 페이지에 "네이버 자체 AI 답글 + AEOlab의 다매장·톤 통합 관리" 차별점 메시지 추가

#### P3-3. AI 탭 전체 사용자 확대 대응 (2026 상반기)
- **트리거**: 네이버 AI탭이 네이버플러스 외 일반 사용자에게 노출되기 시작
- **자동 감지**: 기존 `ai_tab_trigger_check_job` (월·목 09:00 KST)가 이미 작동
- **작업 예정**: 노출 확인 시 `naver_ai_tab_scanner.py` 신규 (Playwright) + 점수 모델에 AI탭 노출 비중 신설

#### P3-4. 점수 모델 v3.1 활성화
- **트리거**: 기존 자동 감지 잡(`P3-READY` 로그 WARNING)
- **확인 명령**: `ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "P3-READY"'`
- **활성화**: 환경변수 `SCORE_MODEL_VERSION=v3_1` 추가 후 pm2 restart

---

## §4 항목별 실행 SOP (단계별 명령)

### P0-1 실행 (10분)
```bash
# 1. 로컬에서 주석 수정
# C:/app_build/aeolab/backend/routers/report.py:1299

# 2. 서버 동기화 + 검증
scp -i ~/.ssh/id_ed25519 C:/app_build/aeolab/backend/routers/report.py root@115.68.231.57:/var/www/aeolab/backend/routers/report.py
ssh root@115.68.231.57 "grep -n 'INACTIVE' /var/www/aeolab/backend/routers/report.py | head -5"

# 3. 재시작 + 로그 확인
ssh root@115.68.231.57 "pm2 restart aeolab-backend && sleep 3 && pm2 logs aeolab-backend --lines 30 --nostream"
```

### P1 실행 흐름 (frontend-dev 에이전트 위임 권장)
1. `/clear` 후 `/model sonnet`
2. `frontend-dev` 에이전트에 P1-1·P1-2·P1-3 동시 위임 (병렬 작업)
3. 메인 세션에서 SSH grep 3건으로 검증
4. `deploy` 에이전트에 배포 위임

### P2 실행 흐름
- P2-1·P2-2는 `backend-dev`·`frontend-dev` 분리 위임
- P2-3은 사용자와 협의 후 문서만 작성
- P2-4는 `db-migrate` 에이전트로 SQL 잡 등록

### P3 실행 흐름
- 트리거 발생 후 신규 대화창에서 `next-feature` 에이전트로 설계부터 시작

---

## §5 검증 명령 (메인 세션 직접 실행)

### 백엔드 핵심 패턴 검증
```bash
ssh root@115.68.231.57 "cd /var/www/aeolab/backend && grep -n 'available.*True' routers/report.py | grep -i 'ai-tab'"
ssh root@115.68.231.57 "cd /var/www/aeolab/backend && grep -n 'BRIEFING_ACTIVE_CATEGORIES' services/score_engine.py"
ssh root@115.68.231.57 "cd /var/www/aeolab/backend && grep -c 'ai_tab_context' services/keyword_taxonomy.py"
# 70개 이상 매칭 기대
```

### 스케줄러 정상 가동
```bash
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 200 --nostream | grep -E 'ai_tab_trigger|briefing_category|inactive_post' | tail -10"
```

### 프론트 빌드 무결성
```bash
ssh root@115.68.231.57 "cd /var/www/aeolab/frontend && npm run build 2>&1 | tail -30"
```

### 에러 로그 0건
```bash
ssh root@115.68.231.57 "pm2 logs aeolab-backend --err --lines 60 --nostream && echo --- && pm2 logs aeolab-frontend --err --lines 60 --nostream"
```

---

## §6 미래 트리거 조건 자동 감지

| 트리거 | 자동 감지 잡 | 작업 위치 | 알림 방식 |
|--------|---------|---------|---------|
| AI 탭 전체 사용자 확대 | `ai_tab_trigger_check_job` (월·목 09:00 KST) | `scheduler/jobs.py:256` | 로그 + 카카오 알림 |
| AI 브리핑 업종 ACTIVE 승급 | `briefing_category_expansion_monitor_job` (매월 1일 09:00) | `scheduler/jobs.py:262` | 로그 + 카카오 알림 |
| 점수 모델 v3.1 활성화 시점 | 매일 09:15 KST `[P3-READY]` 로그 WARNING | `scheduler/jobs.py` | pm2 logs grep |
| 14일 이상 미작성 사업장 | `inactive_post_alert_job` (매일 09:10) | `scheduler/jobs.py:232` | 카카오 알림 |
| AI 브리핑 광고 적용 (Q2~Q3) | **미감지** — 수동 모니터링 필요 | — | 매주 1회 네이버 검색 결과 직접 확인 |

### Q2/Q3 광고 적용 수동 모니터링 (P2-3 연계)
```bash
# 매주 1회 수동 실행
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def t():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=[\"--no-sandbox\",\"--disable-dev-shm-usage\"])
        pg = await br.new_page()
        await pg.goto(\"https://search.naver.com/search.naver?query=강남역+맛집\", timeout=20000)
        await pg.wait_for_timeout(3000)
        html = await pg.content()
        if \"AD\" in html or \"광고\" in html and \"AI\" in html:
            print(\"AI 브리핑 광고 감지\")
        await br.close()
asyncio.run(t())
"'
```

---

## §7 토큰 효율 작업 분리 (Claude Max 5x 한도 내)

CLAUDE.md "토큰 효율 작업 지침" 준수.

| 단계 | 모델 | 에이전트 |
|------|------|---------|
| §3 우선순위 재확인·전략 결정 | **Opus** | 메인 세션 |
| P0-1, P1-1~3 구현 | **Sonnet** | `frontend-dev` / `backend-dev` |
| P2-1, P2-2, P2-4 구현 | **Sonnet** | `backend-dev` / `frontend-dev` / `db-migrate` 병렬 |
| P2-3 문서 작성 | **Sonnet** | `next-feature` |
| 코드 리뷰 | **Sonnet** | `code-review` |
| 배포 | **Sonnet** | `deploy` |
| 검증 (§5) | 메인 세션 직접 — Bash | — |

작업 단위마다 `/clear` 후 새 세션 시작 권장.

---

## §8 CLAUDE.md 등록 권장

CLAUDE.md "§작업 참고 문서" 표에 추가:

```markdown
| **`docs/ai_exposure_continuation_plan_v1.0.md`** ⭐ | **AI 탭/브리핑/ChatGPT 대응 연속 작업 계획 — 최신 외부 사양 + 코드 실측 + P0~P3 우선순위 + 미래 트리거 감지. §0 트리거 명령으로 어느 대화창에서나 진행** |
```

---

## §9 변경 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| v1.0 | 2026-05-18 | 초안 — 외부 사양 + 오판 정정 + 재분류된 우선순위 |
| v1.1 | 2026-05-18 | §0 트리거 명령에 CLAUDE.md "문제 분류 검증 의무" 준수 명시 + §0.1 작업 시작 전 필수 검증 3단계 신설 |

---

*이 문서는 어느 대화창에서도 §0 1줄 트리거로 정확히 이어서 작업할 수 있도록 자기 완결적으로 작성됨. CLAUDE.md 변경 없이 본 문서만으로 진행 가능.*
