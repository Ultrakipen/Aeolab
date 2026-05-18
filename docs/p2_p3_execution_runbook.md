# P2 / P3 실행 런북

> 작성일: 2026-05-17 | 갱신: 2026-05-18 (v2 — `where=AI` URL 가정 오류 정정)
> 기준: 실제 코드 전수 조사 + 네이버 서비스 현황
>
> **이 문서의 목적**: 때가 됐을 때 새 대화창에서 "docs/p2_p3_execution_runbook.md 기준으로 P2 실행"
> 한 줄로 전체 작업을 시작할 수 있도록 정확한 트리거·명령어·코드 변경사항을 사전 기술.
>
> **2026-05-18 v2 정정**:
> - `where=AI` URL 파라미터는 미검증 추정이었음. **AI탭은 통합검색 결과 페이지 내 섹션**으로 별도 URL 불필요.
> - 트리거 확인 방식을 일반 검색 결과 페이지에서 **AI탭 섹션 DOM 셀렉터** 탐색으로 변경.
> - **본 런북의 M3-1 작업은 `docs/naver_ai_search_optimization_plan_v1.0.md` M3-1로 흡수됨** — 자동화 잡 활용 권장.

---

## P2 — 네이버 AI탭 스캐너 활성화

### 트리거 조건 (2가지 중 하나 충족 시)

**조건 A (권장)**: 네이버 일반 검색 페이지에서 AI탭 섹션 노출 확인 (모니터링 주 2회: 월·목)
```bash
# 서버에서 비로그인 통합검색 페이지에서 AI탭 섹션 DOM 확인
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
import asyncio
from playwright.async_api import async_playwright

AI_TAB_SELECTORS = [
    \"[data-tab=ai]\", \"[data-section=ai_tab]\",
    \"div[class*=AiTab]\", \"div[class*=ai_tab]\",
    \".ai_tab_section\", \"#ai_tab\",
]

async def test():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=[\"--no-sandbox\",\"--disable-dev-shm-usage\"])
        pg = await br.new_page()
        # AI탭은 통합검색 결과 페이지 내 섹션 (별도 URL 없음)
        await pg.goto(\"https://search.naver.com/search.naver?query=강남역+맛집\", timeout=20000)
        await pg.wait_for_timeout(3000)
        found = False
        for sel in AI_TAB_SELECTORS:
            el = await pg.query_selector(sel)
            if el:
                txt = await el.inner_text()
                print(f\"FOUND: {sel} -> {txt[:80]}\")
                found = True
        if not found:
            print(\"AI탭 섹션 미탐지 — 아직 베타 한정 또는 셀렉터 변경 가능성\")
        await br.close()
asyncio.run(test())
"'
# 출력에 "FOUND" 항목이 있으면 비로그인 AI탭 노출 가능 = P2 트리거
```

**조건 B**: 백엔드 로그에서 AI탭 접근 성공 신호 감지
```bash
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 200 --nostream | grep "naver_ai_tab"'
```

---

### P2 실행 순서 (조건 충족 후)

#### Step 1: Supabase SQL v5.7 실행

Supabase Dashboard → SQL Editor → 아래 SQL 실행:

```sql
-- scripts/supabase_schema.sql v5.7 섹션 (이미 파일에 있음)
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_ai_tab_visible    BOOLEAN   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_rank        SMALLINT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_excerpt     TEXT      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_reservation_linked BOOLEAN   DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_scan_results_ai_tab_visible
  ON scan_results (naver_ai_tab_visible)
  WHERE naver_ai_tab_visible IS NOT NULL;
```

#### Step 2: .env에 환경변수 추가

```bash
ssh root@115.68.231.57 'echo "NAVER_AI_TAB_ENABLED=true" >> /var/www/aeolab/backend/.env'
# 확인
ssh root@115.68.231.57 'grep NAVER_AI_TAB /var/www/aeolab/backend/.env'
```

#### Step 3: multi_scanner.py — AI탭 스캐너 Full 스캔에 통합

**파일**: `/var/www/aeolab/backend/services/ai_scanner/multi_scanner.py`

`scan_full()` 함수 내 Google 스캐너 이후에 추가:
```python
# AI탭 스캐너 (P2 활성화 — NAVER_AI_TAB_ENABLED=true 시 실행)
from services.ai_scanner.naver_ai_tab_scanner import scan as ai_tab_scan
ai_tab_results = {}
for query in queries[:4]:
    result = await ai_tab_scan(query, biz_name)
    if result:
        ai_tab_results[query] = result
        await asyncio.sleep(2)  # RAM 보호
results["naver_ai_tab"] = ai_tab_results
```

#### Step 4: score_engine.py — AI탭 노출 Track1 반영

**파일**: `/var/www/aeolab/backend/services/score_engine.py`

`calc_naver_exposure()` 함수 찾아서 수정:
```python
def calc_naver_exposure(scan_result: dict) -> float:
    """네이버 AI 브리핑 + AI탭 노출 통합 점수 (0~100).
    
    - AI 브리핑(ACTIVE/LIKELY): 기존 로직 유지
    - AI탭(모든 업종): naver_ai_tab_visible=True 시 보너스 +20점 (상한 100)
    """
    # 기존 AI 브리핑 점수 계산 (현재 로직 유지)
    briefing_score = _calc_briefing_exposure(scan_result)
    
    # AI탭 보너스 (P2 신규)
    ai_tab_visible = scan_result.get("naver_ai_tab_visible")
    if ai_tab_visible is True:
        return min(100.0, briefing_score + 20.0)
    return briefing_score
```

**주의**: 기존 `calc_naver_exposure` 함수 위치를 먼저 grep으로 확인 후 수정.

#### Step 5: after_screenshot_job — AI탭 스크린샷 전 업종 추가

**파일**: `/var/www/aeolab/backend/scheduler/jobs.py` (라인 ~1173)

현재:
```python
if _needs_naver_ai_shot(biz.get("category", ""), bool(biz.get("is_franchise"))):
```

변경 후 (AI탭 스크린샷은 모든 업종):
```python
# AI 브리핑 스크린샷 (ACTIVE/LIKELY만)
if _needs_naver_ai_shot(biz.get("category", ""), bool(biz.get("is_franchise"))):
    # ... 기존 naver_ai 캡처 로직 ...
    pass

# AI탭 스크린샷 (모든 업종 — P2 활성화)
import os
if os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true":
    try:
        for q in queries[:2]:
            ai_tab_url = await capture_ai_result("naver_ai_tab", q, biz["id"], f"after_{days}d_ai_tab")
            if ai_tab_url:
                await _db(
                    supabase.table("before_after").insert({
                        "business_id": biz["id"],
                        "capture_type": f"after_{days}d_ai_tab",
                        "image_url": ai_tab_url,
                        "query_used": q,
                    })
                )
            await asyncio.sleep(3)
    except Exception as e_tab:
        logger.warning(f"ai_tab after screenshot failed for {biz.get('name')}: {e_tab}")
```

#### Step 6: AiTabPreviewCard.tsx — 시뮬레이션에서 실제 데이터로 전환

**파일**: `/var/www/aeolab/frontend/components/dashboard/AiTabPreviewCard.tsx`

현재 "시뮬레이션 (추정)" 레이블 → 실제 스캔 데이터 존재 시 "실측 결과"로 분기:
```tsx
// 스캔 결과에 naver_ai_tab_visible 필드가 있으면 실측 데이터 표시
const isRealData = latestScan?.naver_ai_tab_visible !== undefined && 
                   latestScan?.naver_ai_tab_visible !== null;
// 헤더 레이블 분기
<span className="text-xs text-gray-500">
  {isRealData ? "AI탭 실측 결과" : "AI탭 답변 시뮬레이션 (추정)"}
</span>
```

#### Step 7: 재시작 및 검증

```bash
ssh root@115.68.231.57 'cd /var/www/aeolab/frontend && npm run build && pm2 restart all'

# 검증 1: 환경변수 확인
ssh root@115.68.231.57 'grep NAVER_AI_TAB /var/www/aeolab/backend/.env'

# 검증 2: 스캐너 활성화 로그 확인 (수동 스캔 1회 후)
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 100 --nostream | grep "naver_ai_tab"'

# 검증 3: DB 컬럼 존재 확인 (Supabase Dashboard에서)
# scan_results 테이블에 naver_ai_tab_visible 컬럼 확인

# 검증 4: PM2 에러 0건
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 30 --nostream 2>&1 | grep -i error'
```

---

### P2 선택적 추가 작업 (권장하지만 필수 아님)

#### naver_exposure_confirmed → 브리핑/AI탭 분리 (점수 투명성 향상)

**파일**: `backend/services/score_engine.py` (6곳 변경)

```python
# 현재 (NAVER_TRACK_WEIGHTS):
"naver_exposure_confirmed": 0.15,

# 변경 후:
"naver_briefing_confirmed": 0.10,  # AI 브리핑 실제 노출 (ACTIVE/LIKELY만)
"naver_ai_tab_visible":     0.05,  # AI탭 노출 (모든 업종, P2 활성화)
```

**주의**: 6곳 모두 변경 + Track1 합계 100점 검증 필수. 새 대화창에서 "score_engine.py naver_exposure_confirmed 분리" 작업으로 의뢰.

---

## P3 — 점수 모델 v3.1 활성화

### 트리거 조건

**자동 알림 확인**:
```bash
# 매일 09:15 KST 실행되는 _check_v31_readiness_job 로그 확인
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "P3-READY"'
# 출력 예: [P3-READY] 베타 구독자 5명 달성 — SCORE_MODEL_VERSION=v3_1 활성화 준비 완료.
```

**수동 확인**:
```bash
# 구독자 수 직접 확인 (Supabase SQL Editor)
SELECT COUNT(*) FROM subscriptions WHERE status = 'active';
```

---

### P3 실행 순서 (구독자 5명 달성 후)

#### Step 1: 활성화 전 사전 체크

```bash
# Track1 6항목 모두 실측값 있는지 확인 (최소 5명의 스캔 데이터)
# Supabase SQL Editor에서:
SELECT 
  COUNT(*) as total_scans,
  AVG((track1_score->>'keyword_gap')::float) as avg_kw_gap,
  AVG((track1_score->>'smart_place_completeness')::float) as avg_sp,
  COUNT(CASE WHEN track1_score->>'keyword_gap' IS NOT NULL THEN 1 END) as has_kw_data
FROM scan_results 
WHERE scanned_at > NOW() - INTERVAL '30 days';
-- avg_kw_gap, avg_sp가 NULL이 아니어야 함 (실측 데이터 존재)
```

#### Step 2: .env 변경

```bash
ssh root@115.68.231.57 'sed -i "s/SCORE_MODEL_VERSION=v3_0/SCORE_MODEL_VERSION=v3_1/" /var/www/aeolab/backend/.env'
# 또는 없으면 추가:
# ssh root@115.68.231.57 'echo "SCORE_MODEL_VERSION=v3_1" >> /var/www/aeolab/backend/.env'

# 확인
ssh root@115.68.231.57 'grep SCORE_MODEL_VERSION /var/www/aeolab/backend/.env'
```

#### Step 3: 재시작

```bash
ssh root@115.68.231.57 'pm2 restart aeolab-backend'
```

#### Step 4: 점수 변동 검증

```bash
# 재시작 후 30초 대기 후 health 확인
ssh root@115.68.231.57 'sleep 30 && curl -s http://localhost:8000/health | python3 -m json.tool'

# v3.1 활성화 로그 확인
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 30 --nostream | grep "v3_1\|SCORE_MODEL"'

# 기존 사용자 점수 급락 없는지 확인 (Supabase에서 최근 score_history 비교)
# Supabase SQL Editor:
SELECT biz.name, sh.unified_score, sh.context, sh.recorded_at
FROM score_history sh JOIN businesses biz ON biz.id = sh.business_id
ORDER BY sh.recorded_at DESC LIMIT 10;
```

#### Step 5: 롤백 (점수 급락 시)

```bash
ssh root@115.68.231.57 'sed -i "s/SCORE_MODEL_VERSION=v3_1/SCORE_MODEL_VERSION=v3_0/" /var/www/aeolab/backend/.env && pm2 restart aeolab-backend'
```

---

## 전체 타임라인 요약

```
현재 (2026-05-17)
  ├─ P2 트리거 모니터링: 주 1회 AI탭 탭 표시 여부 확인 (6월 전체 확대 예정)
  └─ P3 트리거 모니터링: 매일 09:15 [P3-READY] 로그 자동 확인 중

6월 AI탭 전체 확대 후 (예상: 2026-06~07)
  └─ P2 실행: SQL v5.7 → .env → multi_scanner → score_engine → jobs.py → 빌드·재시작

베타 구독자 5명 달성 후 (시점 미정)
  └─ P3 실행: .env SCORE_MODEL_VERSION=v3_1 → 재시작 → 점수 검증
```

---

## 새 대화창에서 이 런북으로 작업 시작하는 방법

```
docs/p2_p3_execution_runbook.md 기준으로 [P2 / P3] 실행할 것.
트리거 조건 먼저 확인하고 충족 시 순서대로 진행.
```

**⚠️ 중요**: 본 런북 작업 전 `docs/naver_ai_search_optimization_plan_v1.0.md`를 먼저 읽을 것.
M1(즉시·사양 무관) 작업이 완료되어 있어야 P2 진행 의미 있음.

---

## 2026-05-18 갱신 사항

- ✅ 트리거 확인 URL 정정 (`where=AI` 파라미터 → 통합검색 페이지 + AI탭 섹션 DOM 셀렉터)
- ✅ 모니터링 주기 단축 (주 1회 → 주 2회 월·목)
- 📋 본 런북 M3-1(P2 트리거 자동 감지)은 `naver_ai_search_optimization_plan_v1.0.md` M3-1로 흡수
- 📋 **광고 영역 감지 (M1-2)는 P2 진입 전 필수** — 광고 출시 후 점수 거짓 상승 차단

---

*작성: 2026-05-17 | 갱신: 2026-05-18 | 다음 리뷰: P2 트리거 확인 시 / P3 [P3-READY] 로그 발생 시*
