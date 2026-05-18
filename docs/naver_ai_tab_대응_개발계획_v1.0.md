# 네이버 AI탭 대응 개발계획 v1.0

> **작성일: 2026-05-16 | 작성 기준: 기획서·전략문서 아님**
>
> ⚠️ **이 문서의 개발 결정 기준**:
> **"2026년 5월 현재 실제 네이버 서비스 동작 방식"**이 유일한 기준이다.
> 기획서·전략문서(`AEOlab_시장조사_서비스개선_v1.0.md`, `AEOlab_개발대응전략_v1.0.md`)와
> 이 문서가 충돌할 경우 **이 문서가 우선**한다.
> 기획서는 네이버 서비스 변화 이전 기준으로 작성됐으므로 구현 근거로 사용하지 않는다.

---

## 1. 현재 AEOlab 서비스 구현 현황 (이미 완료된 것)

> 기획·전략 문서는 이미 구현된 기능을 "앞으로 만들어야 할 것"처럼 기술한 오류가 있다.
> 아래는 **실제 운영 중인 기능** 목록이다. 중복 개발하지 말 것.

### 이미 구현·배포 완료된 기능 (재개발 금지)

| 기능 | 위치 | 비고 |
|------|------|------|
| AI 스캔 4종 (Gemini·ChatGPT·Naver·Google) | `backend/services/ai_scanner/` | Gemini/ChatGPT 각 50/100회, Naver Playwright |
| 스마트플레이스 자동 점검 | `backend/services/smart_place_auto_check.py` | is_smart_place, has_recent_post, has_intro |
| 소개글 자동 생성 | `backend/routers/business.py:761` | Claude Sonnet 연동 완료 |
| 톡톡 채팅방 메뉴 초안 생성 | `backend/routers/guide.py` | 2024.02.14 개편 사양 반영 완료 |
| 듀얼트랙 점수 모델 v3.0 | `backend/services/score_engine.py` | Track1(Naver) + Track2(Global) |
| 주간 자동 스캔·알림 | `backend/scheduler/jobs.py` | 카카오 알림톡 5종 승인 완료 |
| 토스 결제·구독 | `backend/routers/webhook.py` | 첫 달 50% 할인 서버 재검증 포함 |
| 키워드 순위 측정 | `backend/services/naver_keyword_rank.py` | Playwright PC/모바일/플레이스 |
| 경쟁사 분석·비교 | `backend/routers/report.py` | gap 분석, benchmark, TOP10 |
| Trial → 회원 전환 깔때기 | `backend/services/trial_conversion.py` | Magic Link 방식 |

---

## 2. 핵심 문제: AI 브리핑 ≠ AI탭 (현재 코드의 근본 오류)

### 실제 네이버 서비스 구분 (2026-05-16 기준)

| 구분 | 네이버 AI 브리핑 | 네이버 AI탭 |
|------|-----------------|------------|
| 출시일 | 2025년 3월 | 2026년 4월 27일 (베타) |
| 위치 | 통합 검색 결과 내 텍스트 요약 카드 | 검색 결과의 별도 탭 ("AI탭") |
| 접근 | 모든 사용자 (업종 조건 있음) | 네이버플러스 구독자 우선, 전체 확대 예정 |
| **업종 제한** | **있음** (음식점·카페·숙박 등 ACTIVE만) | **없음** (모든 업종 노출 가능) |
| 프랜차이즈 제한 | 있음 (네이버 공식 정책) | 공식 발표 없음 (제한 없는 것으로 추정) |
| 예약 버튼 | 없음 | 있음 (예약 연동 시 버튼 표시, 전제 조건은 아님) |
| 성격 | 정보 요약 카드 | 대화형·에이전틱 검색 |

### 현재 코드의 오류가 사용자에게 미치는 영향

```
[현재 잘못된 동작]
의원·법무·교육·인테리어 등 INACTIVE 업종 사용자
  → "이 업종은 네이버 AI 브리핑 대상이 아닙니다"
  → AI탭 기회를 안내받지 못함
  → 서비스 이탈 위험

[올바른 동작]
모든 업종 사용자
  → "AI 브리핑: 이 업종은 대상 아님"
  → "AI탭: 모든 업종 노출 가능 — 스마트플레이스·소개글·예약 연동으로 준비 가능"
  → 서비스 유지·전환율 향상
```

---

## 3. 개발 우선순위별 작업 목록

### P0 — 즉시 수정 (사용자 오안내 수정, 당일 배포)

#### P0-1. `backend/services/score_engine.py` — AI탭 전용 함수 추가

**문제**: `get_briefing_eligibility()`만 있고 AI탭용 함수 없음. INACTIVE 업종도 AI탭은 가능한데 전달 안 됨.

**추가할 함수** (기존 `get_briefing_eligibility()` 아래에 추가):

```python
def get_ai_tab_eligibility(category: str) -> str:
    """네이버 AI탭 노출 가능성 분류.

    AI탭은 AI 브리핑과 달리 업종 제한 없음 (2026-04-27 베타 출시 기준).
    단, 스마트플레이스 등록·소개글·예약 연동 여부에 따라 노출 품질 차이.
    출처: 다수 언론 보도 — 업종 게이팅 공식 발표 없음 확인.

    Returns:
        "beta"    — 현재 네이버플러스 구독자 대상 베타 서비스 중 (모든 업종)
        향후 전체 확대 후: "available" 로 변경 예정
    """
    return "beta"  # 2026-04-27 기준: 업종 무관, 네이버플러스 우선
```

**수정할 기존 주석** (score_engine.py 7번 줄):
```python
# 변경 전:
#   Track 1 (네이버 AI 브리핑 준비도): keyword_gap 35% 반영
# 변경 후:
#   Track 1 (네이버 AI 검색 준비도 — AI브리핑+AI탭 통합): keyword_gap 35% 반영
#   AI 브리핑: ACTIVE 업종만 (음식점·카페·숙박 등)
#   AI탭: 모든 업종 대상 (2026-04-27 베타, 상반기 전체 확대 예정)
```

---

#### P0-2. `frontend/app/(dashboard)/dashboard/page.tsx:342` — eligibility 변수 분리

**문제**: 단일 `eligibility` 변수가 AI 브리핑과 AI탭 양쪽에 모두 사용됨.

```typescript
// 현재 (잘못됨):
const eligibility: "active" | "likely" | "inactive" =
  getBriefingEligibility(business?.category ?? "", !!v41Extra?.is_franchise);

// 수정 후:
const briefingEligibility: "active" | "likely" | "inactive" =
  getBriefingEligibility(business?.category ?? "", !!v41Extra?.is_franchise);

// AI탭은 모든 업종 대상 (업종 제한 없음)
const aiTabEligibility: "beta" | "available" = "beta"; // 2026년 상반기 전체 확대 전까지 "beta"
```

그 이후 코드에서 `eligibility` → `briefingEligibility` 로 변수명 일괄 교체.

---

#### P0-3. `frontend/app/(dashboard)/dashboard/page.tsx:712-733` — INACTIVE 배너 수정

**문제**: INACTIVE 업종에 "AI 브리핑 대상 아님"만 표시. AI탭 기회 안내 없음.

```tsx
// 현재 (잘못됨):
{eligibility === "inactive" && (
  <div ...>
    <p>이 업종은 네이버 AI 브리핑(음식점·카페 전용) 대상이 아닙니다.</p>
    ...
  </div>
)}

// 수정 후:
{briefingEligibility === "inactive" && (
  <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 text-indigo-600">
        <svg ...인포 아이콘... />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-800">
          이 업종 · 네이버 AI 검색 노출 안내
        </p>
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 flex-shrink-0">AI 브리핑</span>
            <p className="text-sm text-indigo-700">음식점·카페·숙박 전용 — 이 업종은 대상 외</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white flex-shrink-0">AI탭 (신규)</span>
            <p className="text-sm text-indigo-700">
              <strong>모든 업종 노출 가능</strong> — 스마트플레이스 완성도·소개글·예약 연동이 핵심.
              현재 네이버플러스 구독자 대상 베타 서비스 중, 상반기 전체 확대 예정.
            </p>
          </div>
        </div>
        <a href="/guide/ai-info-tab" className="mt-2 inline-block text-xs text-indigo-600 underline hover:text-indigo-800">
          AI탭 대응 5단계 가이드 →
        </a>
      </div>
    </div>
  </div>
)}
```

---

#### P0-4. `frontend/app/(dashboard)/dashboard/DualTrackCard.tsx:6-10` — 레이블 수정

**문제**: "Track 1: 네이버 AI 브리핑 준비도"는 틀림. AI탭도 포함해야 함.

```tsx
// 현재 (잘못됨):
/**
 * Track 1: 네이버 AI 브리핑 준비도 (업종별 비중: 40~70%)
 * Track 2: 글로벌 AI 가시성       (업종별 비중: 30~90%)
 */

// 수정 후:
/**
 * Track 1: 네이버 AI 검색 준비도 (AI브리핑·AI탭 통합) — 업종별 비중: 40~70%
 *   AI 브리핑: 음식점·카페·숙박 등 ACTIVE 업종만
 *   AI탭: 모든 업종 (2026-04-27 베타, 상반기 전체 확대 예정)
 * Track 2: 글로벌 AI 가시성 (ChatGPT·Gemini·Google AI) — 업종별 비중: 30~90%
 */
```

UI 내 표시 텍스트도 동일하게 "네이버 AI 검색 준비도 (AI브리핑·AI탭)" 로 변경.

---

#### P0-5. `frontend/app/(dashboard)/preview/PreviewClient.tsx:445,509` — 레이블 수정

```tsx
// 445번 줄
// 변경 전: title="네이버 AI 브리핑 준비도"
// 변경 후: title="네이버 AI 검색 준비도 (AI브리핑·AI탭)"

// 509번 줄
// 변경 전: label="네이버 AI 브리핑 준비도 점수"
// 변경 후: label="네이버 AI 검색 준비도 점수 (AI브리핑·AI탭)"
```

---

### P1 — 1~2주 내 (AI탭 최적화 요소 추가)

#### P1-1. `backend/services/smart_place_auto_check.py` — 예약 연동 체크 추가

**근거**: AI탭에서 예약 연동 시 예약 버튼이 결과에 표시됨. 노출 품질 향상 요소.
**주의**: 예약 연동은 AI탭 노출의 **전제 조건이 아님** — 없어도 노출됨. 품질 향상 요소임.

추가할 체크:
- `has_reservation`: 스마트플레이스 예약 기능 활성화 여부 (셀렉트스퀘어·네이버 예약 연동)
- `photo_count`: 등록 사진 수 (AI탭 이미지 카드 표시에 영향)

```python
# smart_place_auto_check.py 내 _check_place_profile() 함수에 추가
# Playwright로 /reservation 탭 또는 예약 버튼 존재 여부 감지

async def _check_reservation(page) -> bool:
    """스마트플레이스 예약 연동 여부 확인."""
    try:
        # 예약 버튼 또는 예약 탭 DOM 확인
        reservation_btn = await page.query_selector("a[href*='/reservation'], button[data-section='reservation']")
        return reservation_btn is not None
    except Exception:
        _logger.warning("smart_place: reservation check failed, defaulting False")
        return False
```

점수 영향: `score_engine.py`에서 Track1 `smart_place_completeness`의 하위 항목으로 가중 (최대 +5점 범위, 현행 합계 100점 보존).

---

#### P1-2. `backend/services/score_engine.py` — Track1 항목명 명확화

**현재**: `naver_exposure_confirmed` (AI 브리핑 노출만 측정)
**문제**: AI탭 노출은 현재 측정 불가이므로 혼동 발생

```python
# 변경 전:
# naver_exposure_confirmed: 네이버 AI 브리핑 노출 확인

# 변경 후:
# naver_briefing_confirmed: 네이버 AI 브리핑 노출 확인 (ACTIVE 업종만)
# naver_ai_tab_visible: AI탭 노출 확인 — P2 구현 예정 (현재 None → 점수 기여 없음)

# INACTIVE 업종 score_engine 처리:
# - naver_briefing_confirmed: 항상 0 (업종 제한)
# - naver_ai_tab_visible: None → 0 (측정 미구현)
# → AI탭 Scanner 구현 후 이 항목이 의미 있어짐
```

---

#### P1-3. `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx` — INACTIVE 업종 AI탭 가이드 추가

**현재**: `isInactive = eligibility === "inactive"` → INACTIVE는 가이드 최소화

**수정 방향**: INACTIVE 업종에 AI탭 전용 가이드 섹션 추가

```tsx
// AiInfoTabGuide 내 INACTIVE 업종용 AI탭 섹션 신규 추가
{briefingEligibility === "inactive" && (
  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
    <h3 className="font-semibold text-indigo-800">
      네이버 AI탭 — 이 업종도 노출 가능 (2026년 상반기 전체 확대 예정)
    </h3>
    <ol className="mt-3 space-y-3 text-sm text-indigo-700">
      <li>
        <strong>① 스마트플레이스 완성도</strong>
        — 사진 10장 이상, 소개글 200자 이상, 영업시간·가격 정보 등록
      </li>
      <li>
        <strong>② 소개글 Q&A 구조화</strong>
        — "자주 묻는 질문 + 답변" 형식으로 소개글 하단 작성
        (AI탭은 Q&A 형식 콘텐츠를 우선 인용)
      </li>
      <li>
        <strong>③ 예약 연동 (선택)</strong>
        — 네이버 예약 또는 셀렉트스퀘어 연동 시 AI탭 결과에 예약 버튼 추가 표시
        (노출 전제 조건 아님, 품질 향상 요소)
      </li>
      <li>
        <strong>④ 리뷰 키워드 관리</strong>
        — 업종 관련 키워드가 포함된 리뷰가 많을수록 AI탭 인용 가능성 높아짐
      </li>
      <li>
        <strong>⑤ 블로그 외부 언급</strong>
        — 외부 블로그·뉴스에 사업장명·서비스 키워드 언급될수록 AI탭 인지 향상
      </li>
    </ol>
    <p className="mt-3 text-xs text-indigo-500">
      * AI탭은 2026-04-27 네이버플러스 구독자 대상 베타 서비스 중.
        전체 이용자 확대 시 노출 기회 더 확대됨. 측정·추적 기능은 전체 확대 후 추가됩니다.
    </p>
  </div>
)}
```

---

#### P1-4. `backend/services/briefing_engine.py` — `reservation_setup` 액션 추가

```python
# _ACTION_STEPS 딕셔너리에 추가 (intro_qa, talktalk_menu 등과 동렬)
"reservation_setup": {
    "label": "예약 연동 설정",
    "description": "네이버 예약 또는 셀렉트스퀘어 연동으로 AI탭 예약 버튼 추가",
    "priority": "medium",
    "url": "https://partner.naver.com/",
    "ai_tab_impact": True,        # AI탭 결과 품질 향상
    "briefing_impact": False,     # AI 브리핑에는 직접 영향 없음
},
```

---

### P2 — 6월 이후 (AI탭 전체 확대 후 Scanner 구현)

#### P2 구현 조건

> ⚠️ **AI탭 Scanner는 6월 전체 확대 전 구현 불가.**
> 현재 Playwright로 AI탭 URL 접근 시 로그인(네이버플러스 구독) 세션 필요.
> **6월 전체 이용자 확대 확인 후** 구현 시작.

**확인 방법**: MT News 2026-05-11 보도 "오는 6월엔 전체 이용자로 확대할 예정" — "예정"이므로 실제 확대 시점을 모니터링할 것.

#### P2-1. `backend/services/ai_scanner/naver_ai_tab_scanner.py` 신규 생성

```python
"""
네이버 AI탭 스캐너 — P2 구현 (6월 전체 확대 후)
URL: https://search.naver.com/search.naver?query={query}
    → "AI탭" 탭 클릭 또는 직접 파라미터로 접근 (확대 후 확인 필요)

현재(2026-05-16) 상태:
  - 로그인 없이 접근 불가 (네이버플러스 전용)
  - 전체 이용자 확대 후 Playwright로 구현 예정
"""

class NaverAITabScanner:
    """네이버 AI탭 노출 측정 — P2 구현 예정."""

    async def scan(self, query: str, place_name: str) -> dict:
        raise NotImplementedError(
            "NaverAITabScanner: 전체 이용자 확대(2026년 6월 예정) 후 구현."
        )
```

#### P2-2. DB 컬럼 추가

```sql
-- 6월 확대 후 실행
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_ai_tab_visible    BOOLEAN     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_rank       SMALLINT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_excerpt    TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_reservation_linked BOOLEAN    DEFAULT NULL;
```

#### P2-3. `score_engine.py` Track1 가중치 재조정

```
[현재]
Track 1 항목: smart_place_completeness, review_quality, keyword_gap, naver_briefing_confirmed, kakao_completeness

[P2 이후 — AI탭 측정 가능 시]
naver_briefing_confirmed + naver_ai_tab_visible → "naver_ai_search_confirmed" 통합
또는 2개 항목으로 병존 (ACTIVE/LIKELY 업종: 브리핑 가중, INACTIVE 업종: AI탭 가중)
```

---

## 4. AI탭 vs AI 브리핑 UI 분기 설계 (전체 적용 기준)

> 코드 전반에서 "AI 브리핑"과 "AI탭"을 혼용하지 않도록 아래 기준 준수.

```
사용자 UI 표시 기준:

[ACTIVE 업종 (restaurant, cafe, bakery, bar, accommodation) + 비프랜차이즈]
  → "네이버 AI 브리핑 + AI탭" 양쪽 모두 준비 안내
  → Track 1 레이블: "네이버 AI 검색 준비도 (AI브리핑·AI탭)"

[LIKELY 업종 (beauty, nail, fitness, yoga 등)]
  → "AI 브리핑 확대 예정 + AI탭 모든 업종 가능" 안내
  → Track 1 레이블: "네이버 AI 검색 준비도 (AI탭 포함)"

[INACTIVE 업종 (medical, legal, education 등)]
  → "AI 브리핑 대상 아님 + AI탭은 가능" 명시 안내
  → Track 1 레이블: "네이버 AI 검색 준비도 (AI탭 중심)"
  → 가이드: AI탭 최적화 5단계 집중 안내

[프랜차이즈]
  → "AI 브리핑 대상 아님 (네이버 공식 정책) + AI탭은 가능" 안내
  → 기존 is_franchise 처리 유지
```

---

## 5. 현재 측정 불가 항목 (솔직한 고지)

| 항목 | 이유 | 예상 해결 시점 |
|------|------|---------------|
| AI탭 노출 여부 | 네이버플러스 로그인 필요 | 2026년 6월+ (전체 확대 후) |
| AI탭 순위/위치 | 동일 | 동일 |
| 스마트플레이스 예약 연동 자동 감지 | Playwright DOM 구조 확인 필요 | P1 (1-2주) |
| 사진 수 자동 집계 | Playwright 사진 탭 파싱 필요 | P1 (1-2주) |

> **사용자 노출 원칙**: 측정 불가 항목은 "측정 준비 중" 배지로 표시. 임의 추정치 절대 금지.

---

## 6. 향후 네이버 서비스 변화 모니터링 체크리스트

> AI탭 전체 확대·업종 조건 변경 등 주요 변화 발생 시 즉시 대응.

- [ ] **AI탭 전체 이용자 확대 확인** (목표: 2026년 6월, 예정이므로 모니터링 필요)
  - 확인 방법: 로그인 없이 네이버 검색 → "AI탭" 탭 표시 여부
  - 확인 즉시: P2 Scanner 구현 시작 + DB 컬럼 추가

- [ ] **AI탭 업종 게이팅 공식 발표** (현재: 없음 → 모든 업종 가능)
  - 변경 시: `get_ai_tab_eligibility()` 로직 즉시 수정 + CLAUDE.md 갱신

- [ ] **AI 브리핑 업종 확대 발표** (현재: LIKELY 업종 확대 "예정")
  - 변경 시: `BRIEFING_ACTIVE_CATEGORIES` 업데이트 + 단일 소스 동기화

- [ ] **스마트플레이스 예약 UI 변경** (2024.02.14 톡톡 FAQ 개편 같은 사례)
  - `smart_place_auto_check.py` DOM 셀렉터 즉시 업데이트

---

## 7. 작업 실행 순서 (추천)

```
Day 1:
  P0-1 score_engine.py — get_ai_tab_eligibility() 추가 (10분)
  P0-2 dashboard/page.tsx — eligibility 변수 분리 (15분)
  P0-3 dashboard/page.tsx — INACTIVE 배너 수정 (20분)
  P0-4 DualTrackCard.tsx — 레이블 수정 (10분)
  P0-5 PreviewClient.tsx — 레이블 수정 (5분)
  → 배포 → SSH grep 검증 → PM2 재시작

Week 1-2:
  P1-1 smart_place_auto_check.py — 예약 연동 체크 (2-3시간)
  P1-2 score_engine.py — Track1 항목명 명확화 (30분)
  P1-3 AiInfoTabGuide.tsx — INACTIVE AI탭 가이드 추가 (2시간)
  P1-4 briefing_engine.py — reservation_setup 액션 추가 (30분)
  → 배포 → 사용자 피드백 수집

After June:
  P2-1 NaverAITabScanner 구현
  P2-2 DB 컬럼 추가 (Supabase SQL Editor)
  P2-3 score_engine.py Track1 가중치 재조정
```

---

## 8. 기획서·전략문서 오류 요약 (재발 방지)

> 이 섹션은 기획서를 비판하는 것이 아니라, 문서와 실제 코드·서비스 간 Gap을 기록하여
> 향후 기획서 기반 개발 지시가 오면 즉시 검증하도록 하기 위함이다.

| 기획서 기술 | 실제 상태 | 판단 |
|------------|----------|------|
| "Phase 1: 스캔·플레이스 진단·가이드 생성 구현" | **이미 구현 완료 및 운영 중** | ❌ 중복 개발 금지 |
| "Phase 2: 주간 자동 스캔·카카오 알림·결제 구현" | **이미 구현 완료 및 운영 중** | ❌ 중복 개발 금지 |
| "소개글 자동 생성 (신규)" | `business.py:761` 구현 완료 | ❌ 이미 있음 |
| "Track A = 노출 결과, Track B = 준비 조건" | 실제 코드: Track 1 = 준비, Track 2 = 노출 **(반전됨)** | ⚠️ 문서 기준 코드 수정 금지 |
| "네이버 AI탭 Phase 3 (미래)" | 2026-04-27 이미 베타 출시 | ⚠️ 즉시 대응 필요 |
| "Next.js 14" | **실제: Next.js 16.2.1** | ❌ 기획서 버전 기준 금지 |
| "플레이스 행동 데이터 자동 연동" | 네이버 통계 API 비공개 → **자동화 불가** | ❌ 구현 불가 항목 |
| "6월 전체 확대 확정" | "확대할 예정" (확정 아님) | ⚠️ "예정"으로 표기 |

---

*이 문서는 2026-05-16 실제 서비스 동작 기준으로 작성됨.*
*네이버 서비스 변경 발견 시 즉시 갱신. 최신 업데이트는 CLAUDE.md에도 반영.*
