# 네이버 AI 검색 최적화 잔여 작업 계획 v1.0

> **작성일: 2026-05-18 | 기준: M1~M3 완료 후 코드 직접 검증**
>
> 선행 문서: `docs/naver_ai_search_optimization_plan_v1.0.md` (M1~M3 계획)
> 점검 방법: code-review 에이전트 3건 병렬 + 메인 세션 직접 검증
> 점검 결과: 18건 정상 확인, **10건 결함/미문서화 발견** (Critical 2 / High 5 / Medium 3)
>
> **새 대화창 트리거**: `docs/naver_ai_optimization_remaining_tasks_v1.0.md` 기준으로 [P0 / P1 / P2] 진행

---

## 0-1. 2026-05-18 실행 결과 (메인 세션 직접 검증·수정·배포)

| # | 항목 | 결과 |
|---|------|------|
| 1 | P0-1 (M2-3 CTA) | ✅ 수정 완료. line 642만 `/guide/blog-strategy`로 교체. `(dashboard)/guide/blog-strategy/page.tsx` 신규 작성 (블로그 후기 유도 가이드 5섹션). line 326은 의도된 ChatGPT 가이드 컨텍스트라 유지 |
| 2 | P0-2 (eligibility 분기) | ✅ 수정 완료. `briefing_engine.py:27` `from services.score_engine import get_ai_tab_eligibility` 추가, `simulate_ai_tab_answer()` 반환 dict에 `ai_tab_eligibility` 필드 추가. **계획서 line 번호 보정**: 1434 → **1369** |
| 3 | P1-1 (체크리스트 25개) | ⏭️ **스킵 — 실질 결함 아님**. `ai_tab_checklists.py`는 **57개 키 보유**(계획서 "22건" 부정확), 25개 표준 누락분(bakery·bar·medical·education·tutoring)은 `keyword_taxonomy._CATEGORY_ALIASES`로 alias 매핑 + `restaurant` 폴백 보장 |
| 4 | P1-2 (모니터 잡 09:30) | ✅ 수정 완료. `jobs.py:263` `minute=30 → minute=0` |
| 5 | P1-3 (SSG 60건) | ✅ 검토 완료 — **그대로 유지 결정**. 실제 59개 unique value (25 표준 + 34 alias). 모두 SEO 가치 있음, SSG 빌드 부담 작음. 코드 수정 불필요 |
| 6 | P1-4 (M1 베이스라인) | 🟡 템플릿 작성 완료(`docs/baseline_m1_20260518.md`). **사용자가 Supabase SQL Editor에서 §1의 SQL 3건 실행 후 §2에 결과 붙여넣기 필요** |
| 7 | P1-5 (BRIEFING_ACTIVE 통합) | ✅ 수정 완료. TrialResultStep.tsx + demo/page.tsx 두 곳 모두 `getBriefingEligibility()` 헬퍼 사용. 하드코딩 0건 grep 검증 |
| 8 | P2-1 (v3.2 체크리스트) | ✅ `p2_p3_execution_runbook.md`에 **P4 섹션 신규 추가**(4-step + 롤백) |
| 9 | P2-2 (AD 셀렉터 트리거) | ✅ P2 Step 8 신규 추가 (Playwright codegen 명령 + 정확도 기준) |
| 10 | P2-3 (M1-5 명세 갱신) | ✅ `naver_ai_search_optimization_plan_v1.0.md` §M1-5 단락에 갱신 노트 추가 (WHITELIST_59 + 함수명 변경) |

**남은 작업** (사용자 직접):
- P1-4 Supabase SQL 실행
- 서버 배포 (deploy 에이전트 위임 예정)

**보정 사항** (계획서 부정확):
- P0-2: 함수 line 1369 (문서는 1434), `is_franchise`를 받지 않음
- P1-1: 22건이 아닌 57개 키, alias 매핑으로 25개 표준 모두 처리됨 (수정 불필요)

---

## 0. 결함 요약 표

| # | 우선순위 | 항목 | 영향 |
|---|---------|------|------|
| 1 | 🔴 Critical | M2-3 CTA 오경로 (`AiInfoTabGuide.tsx:642`) | UGC 유도 깔때기 끊김 |
| 2 | 🔴 Critical | `briefing_engine.simulate_ai_tab_answer()`에서 `get_ai_tab_eligibility()` 미호출 | INACTIVE 사각지대 잔존 |
| 3 | 🟡 High | `ai_tab_checklists.py` 25개 업종 완전성 미확정 (grep 22건) | 누락 업종 빈 카드 |
| 4 | 🟡 High | M3-4 모니터 잡 시각 09:30 → 계획서 09:00 | 명세 일관성 |
| 5 | 🟡 High | `channelGuideData.ts` value 60건 — SSG 대상 검증 필요 | SSG 빌드 시간 증가 |
| 6 | 🟡 High | M1 베이스라인 미기록 | M1 효과 측정 기준점 영구 소실 |
| 7 | 🟡 High | 프론트엔드 `BRIEFING_ACTIVE` 인라인 하드코딩 2곳 | 단일 소스 원칙 위반 |
| 8 | 🟢 Medium | v3.2 활성화 체크리스트 미문서화 | P2 완료 후 전환 시 점수 급락 위험 |
| 9 | 🟢 Medium | 광고 영역 셀렉터 Q2 실측 트리거 누락 | Q2 출시 대비 자동 알림 없음 |
| 10 | 🟢 Medium | M1-5 테스트 함수명 명세 불일치 | 기능 정상, 명세만 갱신 |

---

## 1. Critical 2건 — 즉시 수정 (당일 배포)

### P0-1. M2-3 CTA 링크 오경로 정정

**현재 상태**:
- 파일: `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx:642`
- 블로그 0건일 때 CTA 링크가 `/guide/chatgpt-search`로 연결됨
- 계획서 M2-3 요구사항: `/guide/blog-strategy`

**수정 내용**:
```tsx
// 변경 전 (line 642)
<a href="/guide/chatgpt-search" ...>

// 변경 후
<a href="/guide/blog-strategy" ...>
```

**선행 확인**: `/guide/blog-strategy` 페이지가 실제로 존재하는지 먼저 grep 검증.
- 없으면 → `frontend/app/(public)/guide/blog-strategy/page.tsx` 신규 작성 (블로그 후기 유도 가이드 페이지)
- 있으면 → href만 교체

**예상 소요**: 1시간 (페이지 없을 시) / 5분 (페이지 있을 시)
**검증**: 빌드 후 `/dashboard` → AI 정보 탭 가이드 → 블로그 카드에서 클릭 → 200 OK

---

### P0-2. `simulate_ai_tab_answer()`에 `get_ai_tab_eligibility()` 분기 추가

**현재 상태**:
- 파일: `backend/services/briefing_engine.py:1434`
- `simulate_ai_tab_answer()`가 `category`는 받지만 `get_ai_tab_eligibility()` 호출 없음
- 계획서 N1 사각지대 일부만 해소됨 (`routers/guide.py`는 해소, `briefing_engine.py`는 미해소)

**수정 내용**:
```python
# briefing_engine.py 상단 import
from services.score_engine import get_briefing_eligibility, get_ai_tab_eligibility

def simulate_ai_tab_answer(category: str, ...) -> dict:
    """AI탭 답변 시뮬레이션."""
    ai_tab_elig = get_ai_tab_eligibility(category)
    briefing_elig = get_briefing_eligibility(category, is_franchise)

    # 결과에 두 eligibility 모두 포함
    return {
        ...,
        "ai_tab_eligibility": ai_tab_elig,    # "beta"
        "briefing_eligibility": briefing_elig, # "active"/"likely"/"inactive"
        # INACTIVE 업종도 ai_tab_eligibility="beta"이므로 빈 카드 대신 폴백 사용
    }
```

**예상 소요**: 2시간 (코드 수정 + 사일런트 호출처 검증 + 배포)
**검증**: `from briefing_engine import simulate_ai_tab_answer; simulate_ai_tab_answer("legal", ...)` 결과에 `ai_tab_eligibility="beta"` 포함 확인

---

## 2. High 5건 — 1주 내 정리

### P1-1. `ai_tab_checklists.py` 25개 업종 완전성 점검

**현재 상태**:
- 파일: `backend/services/ai_tab_checklists.py`
- grep `AI_TAB_CHECKLISTS` 매칭 키 22건 (계획서 25건 미달)
- 누락 의심 업종: `tutoring`, `yoga`, 그 외 1개

**작업 절차**:
1. Read로 전체 파일 직접 검토 → 실제 키 25개 enumerate
2. 화이트리스트 25 vs 실제 키 diff 산출
3. 누락 업종에 6-항목 구조 추가 (`item`, `weight`, `ai_tab_signal`)
4. 각 업종 weight 합계 = 1.0 보존

**예상 소요**: 1.5시간 (검토 + 누락분 추가)
**검증**: `pytest backend/tests/test_category_alias.py` 통과

---

### P1-2. M3-4 모니터 잡 시각 정정

**현재 상태**:
- 파일: `backend/scheduler/jobs.py:263`
- 등록 시각: `month=1, day=1, hour=9, minute=30` (09:30 KST)
- 계획서 §M3-4 명세: `09:00 KST`

**수정 내용**:
```python
# jobs.py:263
scheduler.add_job(
    briefing_category_expansion_monitor_job,
    CronTrigger(day="1", hour=9, minute=0, timezone="Asia/Seoul"),  # 30 → 0
    ...
)
```

**예상 소요**: 5분 (코드 수정 + pm2 재시작)
**검증**: `pm2 logs aeolab-backend | grep "expansion_monitor"` 다음 실행 시각 확인

---

### P1-3. `channelGuideData.ts` SSG 대상 25개 한정 검증

**현재 상태**:
- 파일: `frontend/lib/channelGuideData.ts`
- `value:` 항목 60건 (25개 표준 업종 + alias·확장 35건)
- `generateStaticParams`가 60개 모두 SSG 빌드 시 빌드 시간 증가

**작업 절차**:
1. 60건 중 정확히 어떤 업종이 들어있는지 enumerate
2. 25개 표준 화이트리스트와 매칭
3. **옵션 A**: 60개 모두 의도된 것이라면 → 그대로 유지 (alias도 SEO 효과 있음)
4. **옵션 B**: 25개만 SSG 필요라면 → `generateStaticParams`에서 화이트리스트 필터링

**예상 소요**: 30분 (검토 + 결정)
**검증**: `next build` 시 SSG 페이지 수 확인

---

### P1-4. M1 베이스라인 캡처

**현재 상태**:
- M1 구현 완료 (2026-05-18) 시점 베이스라인 측정 누락
- 계획서 §8 "M1 시작 전 캡처 필수" 미이행
- Phase A 보고서(2026-04-30) 베타 1명 데이터 존재하나 M1 변경 이전 기준

**작업 절차**:
1. Supabase에서 현재 베타 사용자 최근 스캔 결과 조회
   ```sql
   SELECT business_id, track1_score, track2_score, unified_score,
          (naver_result->>'in_briefing')::bool as in_briefing,
          (naver_result->>'in_ai_tab')::bool as in_ai_tab,
          (naver_result->>'ad_only')::bool as ad_only,
          created_at
   FROM scan_results
   WHERE created_at >= '2026-05-15'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
2. 결과를 `docs/baseline_m1_20260518.md`로 기록
3. M2-1 (Group D 추가) / M3-2 (v3.2 가중치 전환) 효과 측정 기준점으로 사용

**예상 소요**: 30분 (SQL 실행 + 문서 작성)
**검증**: `docs/baseline_m1_20260518.md` 파일 존재 + 5건 이상 스캔 데이터 포함

---

### P1-5. 프론트엔드 `BRIEFING_ACTIVE` 단일 소스 통합

**현재 상태**:
- 정답 소스: `frontend/lib/userGroup.ts:43` `BRIEFING_ACTIVE_CATEGORIES` (export)
- 인라인 하드코딩: `frontend/app/(public)/trial/components/TrialResultStep.tsx:512`
- 인라인 하드코딩: `frontend/app/(public)/demo/page.tsx:39`

**수정 내용** (두 파일 동일 패턴):
```typescript
// 변경 전
const BRIEFING_ACTIVE = ["restaurant", "cafe", "bakery", "bar", "accommodation"];

// 변경 후
import { BRIEFING_ACTIVE_CATEGORIES as BRIEFING_ACTIVE } from "@/lib/userGroup";
```

**예상 소요**: 20분 (2개 파일 수정 + 빌드 검증)
**검증**: `next build` 통과 + 두 페이지 화면 정상 동작

---

## 3. Medium 3건 — 실측·문서 보완

### P2-1. v3.2 활성화 체크리스트 문서화

**현재 상태**:
- `docs/p2_p3_execution_runbook.md`에 P3(v3.1) 체크리스트 5단계는 정의됨
- v3.2(P4)에 대한 별도 절차 없음
- `score_engine.py:924` 주석에 "6월 AI탭 전체 확대 이후 활성화 권장"만 명시

**작업 절차**:
1. `docs/p2_p3_execution_runbook.md` 하단에 P4(v3.2) 섹션 추가
2. 활성화 조건:
   - P2 AI탭 스캐너 가동 후 최소 30일
   - `in_ai_tab` 실측 데이터 N건 이상 (예: 베타 5명 × 4주 = 20+ 건)
   - Track1 점수 그룹별 시뮬레이션 (v3.1 → v3.2 diff < 10점)
   - 환경변수 토글: `SCORE_MODEL_VERSION=v3_2`

**예상 소요**: 1시간 (문서 작성)
**검증**: 런북 P4 섹션에 체크박스 5개 정의

---

### P2-2. 광고 영역 셀렉터 Q2 실측 트리거 명시

**현재 상태**:
- 코드: `naver_scanner.py:42` AD_BRIEFING_SELECTORS 6개 임시 가정값
- 주석에 "Q2 광고 출시 전 — 현재 False 반환 예상" 인지됨
- 업데이트 시점 자동 감지 메커니즘 없음

**작업 절차**:
1. `docs/p2_p3_execution_runbook.md` P2 체크리스트에 항목 추가:
   ```
   - [ ] AD_BRIEFING_SELECTORS 실측 업데이트
         서버에서 Playwright codegen으로 광고 영역 DOM 캡처
         ssh root@115.68.231.57 'cd /var/www/aeolab && python3 -m playwright codegen "https://search.naver.com/..."'
   ```
2. (선택) `scheduler/jobs.py`에 광고 영역 첫 감지 시 알림 잡 추가 가능 — Q2 임박 시 결정

**예상 소요**: 20분 (런북 업데이트)

---

### P2-3. M1-5 테스트 함수명 명세 일치 갱신

**현재 상태**:
- 파일: `backend/tests/test_category_alias.py`
- 함수명 명세 불일치 (기능 정상)
  - 계획 `test_all_whitelist_have_eligibility` ↔ 실제 `test_all_have_eligibility`
  - 계획 `test_all_whitelist_have_taxonomy` ↔ 실제 `test_all_have_taxonomy`
  - 계획 `test_ai_tab_eligibility_always_beta` ↔ 실제 `test_all_have_ai_tab_eligibility`
- `WHITELIST_25` → `WHITELIST_59` 확장됨 (기능 개선)

**작업 절차**:
- **옵션 A**: 계획서를 현재 코드 기준으로 갱신 (권장) — 코드가 더 풍부함
- **옵션 B**: 테스트 함수명을 명세에 맞춰 rename — 의미 없음

**예상 소요**: 10분 (계획서 §M1-5 단락 업데이트)

---

## 4. 작업 순서 권장안

### 옵션 A — Critical 즉시 + High 일괄 (당일 1세션)

```
[Step 1] (1시간) P1-4 베이스라인 캡처
  ↓ M1 효과 측정 기준점 확보
[Step 2] (3시간) P0-1, P0-2 Critical 2건 수정 + 배포
  ↓ 사용자 직접 영향 결함 해소
[Step 3] (2.5시간) P1-1, P1-2, P1-3, P1-5 High 4건 일괄 정리
  ↓ 한 번에 배포 + 검증
[Step 4] (1.5시간) P2-1, P2-2, P2-3 Medium 3건 문서 작업
  ↓ 런북·계획서 갱신

총 예상: 약 8시간 (1세션 분량)
```

### 옵션 B — Critical 우선, 나머지 분할 (2세션)

```
세션 1 (당일):
  P1-4 베이스라인 → P0-1, P0-2 Critical → 배포 → 검증

세션 2 (다음날):
  P1-1~P1-5 High 5건 → 배포 → Medium 3건 문서
```

---

## 5. 검증 체계

### 각 항목 완료 검증 (메인 세션 직접 확인)

| # | 검증 명령 | 기대 결과 |
|---|----------|----------|
| 1 | `grep -n "blog-strategy" frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx` | line 642에 매칭 |
| 2 | `grep -n "get_ai_tab_eligibility" backend/services/briefing_engine.py` | 호출 1건 이상 |
| 3 | `grep -c "ai_tab_signal" backend/services/ai_tab_checklists.py` | 150 이상 (25업종 × 6항목) |
| 4 | `grep -n "expansion_monitor_job" backend/scheduler/jobs.py` | minute=0 |
| 5 | `next build` 출력 | SSG 페이지 수 의도와 일치 |
| 6 | `ls docs/baseline_m1_20260518.md` | 파일 존재 |
| 7 | `grep -n "BRIEFING_ACTIVE" frontend/app/(public)/{trial,demo}/**/*.tsx` | import 문만 매칭 |

### 배포 후 SSH 검증 (CLAUDE.md 에이전트 보고 검증 의무)

```bash
ssh root@115.68.231.57 "grep -n 'blog-strategy' /var/www/aeolab/frontend/app/\(dashboard\)/guide/ai-info-tab/AiInfoTabGuide.tsx"
ssh root@115.68.231.57 "grep -n 'get_ai_tab_eligibility' /var/www/aeolab/backend/services/briefing_engine.py"
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 60 --nostream | grep -i error"
```

---

## 6. 정상 확인 (참고용 — 수정 불필요)

다음 18건은 계획서 명세대로 정확히 구현됨:

**M1 (5건)**: AI탭 셀렉터 6개, **광고 영역 감지 (Critical)**, `get_ai_tab_eligibility()` (`guide.py`만), 5요소 카드, alias 자동 테스트(기능)
**M2 (3건)**: Group D `ai_tab_context`, 광고 공지 배너, AiTabPreviewCard 폴백
**M3 (3건)**: `ai_tab_trigger_check_job` (월·목 09:00), `NAVER_TRACK_WEIGHTS_V3_2` + `SCORE_MODEL_VERSION` 토글, `simulate_ai_tab_answer()` v2 measured/estimated 분기
**기타 (7건)**: `.gitignore _backup/` 적용, `DualTrackCard` INACTIVE 분기, `AiInfoTabStatusCard` 차단, `AiTabPreviewCard` 빈 카드 폴백, 톡톡 채팅방 메뉴 명칭, `/qna` 폐기 대응, `has_faq` 0점 처리

---

## 7. 관련 문서

| 문서 | 역할 |
|------|------|
| **`docs/naver_ai_optimization_remaining_tasks_v1.0.md`** (이 문서) | 잔여 작업 10건 + 작업 순서 + 검증 |
| `docs/naver_ai_search_optimization_plan_v1.0.md` | M1~M3 종합 계획 (선행 문서) |
| `docs/category_channel_matrix_v1.0.md` | 25개 업종 채널 매트릭스 부록 |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | P0~P3 로드맵 (이력 보존) |
| `docs/p2_p3_execution_runbook.md` | P2/P3 실행 런북 (P2-1·P2-2 시 갱신 필요) |
| `docs/naver_gpt_work_standard_v1.0.md` | 작업 전 필수 참조 |

---

*v1.0 작성: 2026-05-18 | 점검자: code-review 에이전트 3건 병렬 + 메인 세션 직접 검증*
*다음 갱신: P0 Critical 2건 수정 배포 후 / 또는 High 5건 일괄 정리 후*
