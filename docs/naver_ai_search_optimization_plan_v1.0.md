# 네이버 AI 검색(AI탭·AI 브리핑) 노출 최적화 종합 계획 v1.0

> **작성일: 2026-05-18 | 기준: 6개 선행 문서 재검토 + 2026-05 최신 네이버 서비스 실측 + 코드 직접 검증**
>
> 선행 문서 6건의 누락·오판을 정정하고, **25개 업종별 노출 채널 최적화 + 정보 제공 서비스화** 계획을 단일 문서로 통합한다.
>
> **새 대화창 트리거**: `docs/naver_ai_search_optimization_plan_v1.0.md` 기준으로 [M1 / M2 / M3] 진행

---

## 0. 선행 문서 6건의 관계

| 문서 | 본 계획과의 관계 |
|------|-----------------|
| `p2_p3_execution_runbook.md` | 본 계획 §M3-1로 흡수, 트리거 URL·셀렉터 갱신 필요 |
| `naver_ai_tab_개발로드맵_v1.1.md` | P0+P1-A+P1-C 완료 상태 유지. **본 계획이 v1.2 역할** (오판 정정 + 신규 발견 통합) |
| `session_summary_20260517_main_engine_ui_v1.0.md` | 이력 보존 (변경 없음) |
| `main_engine_optimization_v1.1.md` | Phase 1 완료 — 변경 없음. Phase 2/3은 본 계획 M3과 연계 |
| `naver_ai_tab_대응_개발계획_v1.0.md` | **archived 권장** — v1.1·v1.2(본 문서)에 흡수 |
| `AEOlab_GPT보완_개발계획.md` | "사장님 레이어" 원칙은 본 계획 §M2-3에 통합 |

---

## 1. 6개 문서 재검토 결과 — 정정·강화·신규 누락

### 1-1. 정정 (선행 문서 오판)

| # | 오판 위치 | 실측 확인 결과 | 정정 |
|---|----------|---------------|------|
| C1 | `p2_p3_execution_runbook.md` Step 1: `where=AI` URL 가정 | `naver_scanner.py:74`는 이미 `search.naver.com/search.naver?query=...` 통합검색 페이지를 본다. AI탭은 이 페이지 내 섹션 (이데일리·플래텀·Korea Herald 확인) | **별도 URL 불필요** — 기존 `naver_scanner.py`에 AI탭 셀렉터 6개만 추가하면 비용 0으로 측정 가능 |
| C2 | `naver_ai_tab_개발로드맵_v1.1.md` §1-1 "잔여 ~20개 INACTIVE" | 실측 결과 `ai_tab_context` 그룹은 17개+ 섹션에 존재 (restaurant/cafe·디저트/병원/학원/법률/숙박/부동산/인테리어/패션 등) | "잔여 ~20개" 수치는 과대평가 — 실제는 ~10개 (`Group D` 참조) |
| C3 | `naver_ai_tab_대응_개발계획_v1.0.md` "프랜차이즈도 AI탭 제외 가능성" | `score_engine.py:68` `get_briefing_eligibility(is_franchise=True) → "inactive"` 만, `get_ai_tab_eligibility()`는 `is_franchise` 파라미터조차 없음 (=프랜차이즈도 AI탭 가능) | 올바른 상태. UI에 **"프랜차이즈도 AI탭 노출 가능"** 명시 강화 필요 |
| C4 | `main_engine_optimization_v1.1.md` "Track1 5항목" | 실측 `BRIEFING_LIKELY_CATEGORIES` 12개 업종, INACTIVE 27개 업종 (v5.7 14개 신규 포함) | 사용자 UI에 "확대 예상 12업종" 정확 명시 |

### 1-2. 강화 (선행 문서보다 더 중대한 사실)

| # | 강화 사항 | 영향 |
|---|----------|------|
| S1 | AI탭 = 통합검색 결과 내 섹션 (별도 URL·페이지 X) | `naver_scanner.py` 확장만으로 P2의 70% 즉시 구현 가능 |
| S2 | AI탭 노출 = 플레이스 리뷰 + 블로그·카페·쇼핑 UGC + 메뉴/시설 메타데이터 입체 분석 | 단일 신호(스마트플레이스 완성도)로 부족. `blog_analyzer.py` 결과 노출 필수 |
| S3 | AI 브리핑 광고 2026 Q2 테스트 시작 → 하반기 본격 출시 (이데일리·ZDNet·뉴스1 확인) | 광고 영역과 유기 영역 미구분 시 점수 거짓 상승. **Critical, D-30 내 처리** |
| S4 | 롱테일 검색 +2.5배, 후속 질문 클릭 +10배 (2026 Q1 네이버 공식) | 사용자 동기 부여 데이터로 활용 가능 |

### 1-3. 신규 발견 누락 (5건)

| # | 누락 | 영향 | 우선순위 |
|---|------|------|---------|
| N1 | `get_ai_tab_eligibility()`는 정의만 됐고 `report.py`에서만 호출 — `guide.py`·`briefing_engine.py`·`AiInfoTabStatusCard.tsx`에서는 `briefing_eligibility`로만 분기 | INACTIVE 업종 사용자가 AI탭 정보를 받지 못하는 사각지대 | **High** |
| N2 | `naver_scanner.py`는 captcha 감지만 있고 **AI 브리핑 광고 영역 감지 0건** | Q2 광고 출시 후 광고를 유기 노출로 오인 → Track1 점수 거짓 상승 | **Critical (D-30)** |
| N3 | `keyword_taxonomy.py` `ai_tab_context` 가중치 일률 0.05 — 의료·법무·숙박은 AI탭 의존도 더 높음 | P2 가중치 추가 시 그룹별 차별화 필요 | Medium (P2 직전) |
| N4 | `blog_analyzer.py` 결과가 `AiTabPreviewCard`·`AiInfoTabGuide`에서 미사용 | 사용자가 "왜 AI탭 노출이 안 되는지" 못 알게 됨 | **High** |
| N5 | 25개 업종 화이트리스트 ↔ taxonomy 키 alias 매핑 정합성 자동 테스트 부재 | 신규 등록 사용자가 콘텐츠 못 받는 사일런트 버그 가능 | Medium |

---

## 2. 25개 업종 노출 채널 매트릭스 (5그룹)

상세 매트릭스: `docs/category_channel_matrix_v1.0.md` 별도 문서.

### Group A — 양면 ACTIVE (5개)
`restaurant, cafe, bakery(→cafe alias), bar(→restaurant alias), accommodation`
- AI 브리핑: ACTIVE + AI탭: 우선 노출 대상
- 듀얼트랙: naver 65~70 / global 30~35
- 콘텐츠 매핑: 완비 (`ai_tab_context` + photo_categories + photo_guide)

### Group B — AI탭 우선, 브리핑 확대 대기 (12개)
`beauty, nail, skincare, massage, spa, pet, fitness, yoga, pharmacy, dance, ballet, semi_permanent`
- AI 브리핑: LIKELY + AI탭: 베타 대상, 예약 버튼 효과 큼
- 듀얼트랙: naver 55~65 / global 35~45
- 콘텐츠 매핑: 부분 완비 (일부 업종 `ai_tab_context` 누락)

### Group C — AI탭 중심, 콘텐츠 매핑 완료 (10개)
`medical(→clinic), dental, oriental_medicine, legal, accounting, education(→academy), tutoring(→academy), realestate, interior, fashion`
- AI 브리핑: INACTIVE + AI탭: 가능
- 듀얼트랙: naver 35~55 / global 45~65
- **금융·헬스케어 특화 AI 브리핑 도입 시 즉시 LIKELY 승급 후보** (의료·세무·법무)

### Group D — AI탭 가능, 콘텐츠 매핑 미완성 (~10개)
`optics, martial_arts, climbing, art_class, childcare, car_wash, electronics_repair, footwear, stationery, norebang, billiards, photo, video, design, auto, cleaning, laundry, shopping, clothing, flower, kids, study, workshop, music_class, music_lesson, cooking, experience`
- AI 브리핑: INACTIVE + AI탭: 이론상 가능
- 듀얼트랙: naver 10~35 / global 65~90
- 현재 `AiTabPreviewCard` 폴백 카드만 표시 → M2-1에서 일괄 보강

### Group E — 노출 가능성 자체 낮음 (1개)
`other`
- 글로벌 AI 중심 (ChatGPT·Gemini·Google AI)

---

## 3. M1~M3 단계별 작업 계획

### M1 (D+14, 사양 무관)

| 작업 ID | 작업 | 산출물 | 변경 파일 |
|---------|------|--------|----------|
| M1-1 | AI탭 셀렉터 추가 + `in_ai_tab` 필드 | 비용 0 데이터 수집 시작 | `naver_scanner.py` |
| M1-2 | **광고 영역 감지 마커** ⭐ Critical | Q2 광고 출시 전 점수 왜곡 차단 | `naver_scanner.py`, `score_engine.py` |
| M1-3 | `get_ai_tab_eligibility()` 전역 적용 | INACTIVE 사각지대 해소 | `routers/guide.py`, `briefing_engine.py`, `AiInfoTabStatusCard.tsx` |
| M1-4 | AiTabPreviewCard 5요소 확장 (+블로그 UGC) | 노출 원리 명시 | `AiTabPreviewCard.tsx`, `dashboard/page.tsx` |
| M1-5 | 25개 업종 alias 정합 자동 테스트 | 사일런트 버그 차단 | `tests/test_category_alias.py` 신규 |

### M2 (D+30~60, 사용자 가치 강화)

| 작업 ID | 작업 | 산출물 |
|---------|------|--------|
| M2-1 | Group D ai_tab_context 일괄 추가 | 폴백 카드 → 실제 시뮬레이션 |
| M2-2 | 업종별 AI탭 체크리스트 차별화 | `ai_tab_checklists.py` 사전 + 단일 UI |
| M2-3 | 블로그 UGC 강화 가이드 (`AiInfoTabGuide` 통합) | 노출 원인 추적 가능 |
| M2-4 | `/guide/channels/[category]` 25개 동적 페이지 | SEO + 전환율 |
| M2-5 | 광고 도입 영향 사전 공지 | 사용자 신뢰 유지 |

### M3 (D+60~90, 6월 AI탭 전체 확대 직후)

| 작업 ID | 작업 | 산출물 |
|---------|------|--------|
| M3-1 | P2 트리거 자동 감지 잡 (주 2회) | 수동 모니터링 제거 |
| M3-2 | `naver_ai_tab_visible` Track1 가중치 — 그룹별 차별화 | A: 0.05 / B: 0.10 / C·D: 0.15 |
| M3-3 | AI탭 시뮬레이션 v2 (실측 패턴 학습) | 추정 → 실측 전환 |
| M3-4 | 금융·헬스케어 특화 AI 브리핑 모니터링 잡 | 의료·세무·법무 LIKELY 승급 자동 감지 |

---

## 4. 작업 전 백업 절차 (필수)

### 4-1. 백업 원칙
**금지**: `*.bak.YYYYMMDD` 또는 `*_backup.py` 등 인접 파일 생성 (CLAUDE.md "Root flat 잔재 파일 위험성" 메모리 위반 — 2026-05-03 사고 재발 방지)
**권장**: git branch + 외부 디렉터리 이중 백업

### 4-2. 백업 실행 절차 (작업 시작 직전 1회)

```bash
# 로컬 (Windows PowerShell)
cd C:\app_build\aeolab

# 1. 현재 작업 중인 modified 파일 확인
git status

# 2. 백업 브랜치 생성 (현재 main 상태 보존)
git checkout -b backup/naver-ai-optimization-20260518
git checkout main

# 3. 외부 디렉터리에 변경 예정 파일 백업 (선택, 추가 안전망)
mkdir C:\app_build\aeolab\_backup\20260518
copy backend\services\ai_scanner\naver_scanner.py C:\app_build\aeolab\_backup\20260518\
copy backend\services\score_engine.py C:\app_build\aeolab\_backup\20260518\
copy backend\services\keyword_taxonomy.py C:\app_build\aeolab\_backup\20260518\
copy backend\services\briefing_engine.py C:\app_build\aeolab\_backup\20260518\
copy backend\routers\report.py C:\app_build\aeolab\_backup\20260518\
copy backend\routers\guide.py C:\app_build\aeolab\_backup\20260518\
copy frontend\components\dashboard\AiTabPreviewCard.tsx C:\app_build\aeolab\_backup\20260518\
copy frontend\components\dashboard\AiInfoTabStatusCard.tsx C:\app_build\aeolab\_backup\20260518\
copy frontend\app\(dashboard)\guide\ai-info-tab\AiInfoTabGuide.tsx C:\app_build\aeolab\_backup\20260518\

# 4. 서버 백업 (작업 직전 SSH)
ssh root@115.68.231.57 "mkdir -p /var/www/aeolab/_backup/20260518 && cp /var/www/aeolab/backend/services/ai_scanner/naver_scanner.py /var/www/aeolab/_backup/20260518/ && cp /var/www/aeolab/backend/services/score_engine.py /var/www/aeolab/_backup/20260518/"
```

### 4-3. 복원 절차 (사고 시)

```bash
# git 복원 (가장 빠름)
git checkout backup/naver-ai-optimization-20260518 -- backend/services/naver_scanner.py

# 또는 외부 디렉터리 복원
copy C:\app_build\aeolab\_backup\20260518\naver_scanner.py backend\services\ai_scanner\

# 서버 복원
ssh root@115.68.231.57 "cp /var/www/aeolab/_backup/20260518/naver_scanner.py /var/www/aeolab/backend/services/ai_scanner/ && pm2 restart aeolab-backend"
```

### 4-4. 백업 대상 파일 목록 (총 9개)

| 영역 | 파일 |
|------|------|
| 백엔드 (6) | `backend/services/ai_scanner/naver_scanner.py`, `backend/services/score_engine.py`, `backend/services/keyword_taxonomy.py`, `backend/services/briefing_engine.py`, `backend/routers/report.py`, `backend/routers/guide.py` |
| 프론트엔드 (3) | `frontend/components/dashboard/AiTabPreviewCard.tsx`, `frontend/components/dashboard/AiInfoTabStatusCard.tsx`, `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx` |

`.gitignore`에 `_backup/` 추가 (외부 백업 디렉터리가 git 추적되지 않도록).

---

## 5. M1 상세 구현 사양

### M1-1. AI탭 셀렉터 추가

**파일**: `backend/services/ai_scanner/naver_scanner.py`

```python
# BRIEFING_SELECTORS 아래에 추가
AI_TAB_SELECTORS = [
    "[data-tab='ai']",
    "[data-section='ai_tab']",
    "div[class*='AiTab']",
    "div[class*='ai_tab']",
    ".ai_tab_section",
    "#ai_tab",
]

# _check_single_page() 반환값에 추가
{
    "platform": "naver",
    "mentioned": mentioned or in_briefing,
    "in_briefing": in_briefing,
    "in_ai_tab": False,         # 신규
    "ai_tab_excerpt": "",       # 신규
    "rank": rank,
    "excerpt": excerpt,
    "_query_used": query,
}

# 본문에 셀렉터 루프 추가
for sel in AI_TAB_SELECTORS:
    try:
        el = await page.query_selector(sel)
        if el:
            text = await el.inner_text()
            if _name_in_text(target, text):
                in_ai_tab = True
                lines = [l for l in text.split("\n") if _name_in_text(target, l)]
                ai_tab_excerpt = lines[0][:120] if lines else ""
            break
    except Exception:
        continue
```

**검증**: 베타 1명 사업장 (education, INACTIVE)으로 quick 스캔 1회 → `in_ai_tab` 필드 응답 확인. False여도 정상 (현재 INACTIVE는 노출 안 됨).

### M1-2. 광고 영역 감지 마커 ⭐ Critical

**파일**: `backend/services/ai_scanner/naver_scanner.py`

```python
# 광고 영역 셀렉터 (실측 후 셀렉터 확정 필요)
AD_BRIEFING_SELECTORS = [
    "[data-ad='ai_brief']",
    "[data-section='ad']",
    "span.ad_marker",
    "div[class*='AdBrief']",
    "div[class*='ad_brief']",
    ".ai_answer_area[data-ad='true']",
]

async def _detect_ad_briefing(page) -> bool:
    """AI 브리핑이 광고 영역에 노출됐는지 감지."""
    for sel in AD_BRIEFING_SELECTORS:
        try:
            el = await page.query_selector(sel)
            if el:
                return True
        except Exception:
            continue
    return False

# _check_single_page() 반환값에 ad_only 추가
ad_only = await _detect_ad_briefing(page) if in_briefing else False

return {
    ...,
    "ad_only": ad_only,  # True면 광고 영역에서만 노출 = 유기 노출 아님
}
```

**파일**: `backend/services/score_engine.py`

```python
def calc_naver_exposure(scan_result: dict) -> float:
    # 광고 영역만 노출 시 점수 가중 0
    if scan_result.get("ad_only"):
        return 0.0
    # 기존 로직 유지
    ...
```

**검증**: 광고 영역 셀렉터는 Q2 광고 출시 후 실측 필요 — Q2 직전(2026-06) Playwright codegen으로 실제 광고 영역 DOM 구조 캡처.

### M1-3. `get_ai_tab_eligibility()` 전역 적용

**호출 누락 위치 (점검 후 수정)**:
- `backend/routers/guide.py` — 가이드 생성 시 AI탭 분기 추가
- `backend/services/briefing_engine.py` — 시뮬레이션 함수 시그니처에 `category` 추가
- `frontend/components/dashboard/AiInfoTabStatusCard.tsx` — `eligibility !== "inactive"` 조건을 `briefingEligibility !== "inactive" || aiTabEligibility === "beta"`로 변경

### M1-4. AiTabPreviewCard 5요소 확장

**파일**: `frontend/components/dashboard/AiTabPreviewCard.tsx`

기존 4요소 → 5요소 추가:
1. 스마트플레이스 완성도
2. 소개글 Q&A 구조
3. 예약 연동 (예약 버튼 표시 효과)
4. 리뷰 키워드 분포
5. **외부 블로그 UGC 발견 수** (신규) — `blog_analyzer.py` 결과 활용

**파일**: `dashboard/page.tsx`
- `Promise.all`에 `blog_analyzer` fetch 추가 (이미 있다면 props 전달만)

### M1-5. 25개 업종 alias 정합 자동 테스트

**파일**: `backend/tests/test_category_alias.py` 신규

> **2026-05-18 갱신**: 실제 구현 시 화이트리스트를 25 → 59로 확장(`WHITELIST_59`).
> 25개 표준 + alias·확장 34개 = 59개 모든 업종에 대해 정합성 보장.
> 함수명도 명세에서 `_whitelist_` 접두사 제거 (`test_all_have_eligibility` 등).
> 기능은 명세 그대로 동작.

```python
import pytest
from services.score_engine import (
    get_briefing_eligibility, get_ai_tab_eligibility,
    BRIEFING_ACTIVE_CATEGORIES, BRIEFING_LIKELY_CATEGORIES, BRIEFING_INACTIVE_CATEGORIES,
)
from services.keyword_taxonomy import normalize_category, get_all_keywords_flat

# 59개 확장 화이트리스트 (25개 표준 + alias·세분화)
WHITELIST_59 = [
    # 25개 표준
    "restaurant", "cafe", "bakery", "bar",
    "beauty", "nail", "medical", "pharmacy", "fitness", "yoga",
    "pet", "education", "tutoring", "legal", "realestate", "interior",
    "auto", "cleaning", "shopping", "fashion",
    "photo", "video", "design", "accommodation", "other",
    # 34개 alias·세분화 (skincare, massage, clinic, dental, academy 등)
    # 실제 목록은 frontend/lib/channelGuideData.ts CHANNEL_GUIDE 참조
]

def test_all_have_eligibility():
    for cat in WHITELIST_59:
        result = get_briefing_eligibility(cat)
        assert result in ("active", "likely", "inactive"), f"{cat} → {result}"

def test_all_have_taxonomy():
    for cat in WHITELIST_59:
        if cat == "other":
            continue
        keywords = get_all_keywords_flat(cat)
        assert keywords, f"{cat} taxonomy missing"

def test_all_have_ai_tab_eligibility():
    for cat in WHITELIST_59:
        assert get_ai_tab_eligibility(cat) == "beta"
```

---

## 6. M2 상세 구현 사양 (요약)

### M2-1. Group D ai_tab_context 일괄 추가
- 각 INACTIVE 업종에 weight 0.05의 `ai_tab_context` 그룹 추가
- 범용 5요소: 영업시간·위치·결제·예약·주차
- 업종별 특화 5요소: photo→촬영분야·video→영상유형·shopping→상품 등

### M2-2. 업종별 AI탭 체크리스트 사전
**파일**: `backend/services/ai_tab_checklists.py` 신규

```python
AI_TAB_CHECKLISTS: dict[str, list[dict]] = {
    "restaurant": [
        {"item": "메뉴 사진 10장+", "weight": 0.2, "ai_tab_signal": "메뉴 다양성"},
        {"item": "룸 사진·정보", "weight": 0.15, "ai_tab_signal": "동반자 조건"},
        {"item": "주차 정보", "weight": 0.15, "ai_tab_signal": "접근 편의"},
        {"item": "예약 연동", "weight": 0.25, "ai_tab_signal": "예약 버튼 노출"},
        {"item": "운영시간·휴무", "weight": 0.10, "ai_tab_signal": "운영 정보"},
        {"item": "외부 블로그 5개+", "weight": 0.15, "ai_tab_signal": "UGC 풍부도"},
    ],
    "medical": [
        {"item": "진료시간·휴진일", "weight": 0.20, "ai_tab_signal": "운영 정보"},
        {"item": "전문분야 명시", "weight": 0.25, "ai_tab_signal": "전문성"},
        {"item": "예약 시스템", "weight": 0.20, "ai_tab_signal": "예약 버튼 노출"},
        {"item": "환자 후기 30개+", "weight": 0.20, "ai_tab_signal": "신뢰성"},
        {"item": "의사 경력·자격", "weight": 0.15, "ai_tab_signal": "권위성"},
    ],
    "legal": [...],
    "realestate": [...],
    "fashion": [...],
    # 25개 업종 모두 정의
}
```

### M2-3. 블로그 UGC 강화 가이드
- `AiInfoTabGuide.tsx`에 블로그 발견 수 카드 추가
- 0개일 경우 "블로그 후기 유도 가이드" CTA → `/guide/blog-strategy`

### M2-4. `/guide/channels/[category]` 25개 동적 페이지
- Next.js 16 dynamic route + `generateStaticParams` (25개 SSG)
- 각 페이지: 업종별 AI 브리핑/AI탭/글로벌 AI 노출 채널 안내 + 면책

### M2-5. 광고 도입 영향 사전 공지
- `/how-it-works` 페이지에 "2026 Q2 AI 브리핑 광고 도입 — 측정 영향" 섹션 추가

---

## 7. M3 상세 구현 사양 (요약)

### M3-1. P2 트리거 자동 감지
**파일**: `backend/scheduler/jobs.py`

```python
async def ai_tab_trigger_check_job():
    """주 2회(월·목 09:00) AI탭 비로그인 노출률 측정."""
    queries = ["강남역 맛집", "홍대 카페", "신사동 미용실", "분당 학원"]
    hit_count = 0
    for q in queries:
        result = await NaverAIBriefingScanner()._check_single_page(page, q, "")
        if result.get("in_ai_tab"):
            hit_count += 1
    rate = hit_count / len(queries)
    if rate >= 0.8:
        await send_slack(f"[P2-READY] AI탭 노출률 {rate*100:.0f}% — 전체 확대 감지")
```

### M3-2. Track1 가중치 그룹별 차별화
**파일**: `backend/services/score_engine.py`

```python
NAVER_TRACK_WEIGHTS_V3_2 = {
    "active": {
        "smart_place_completeness": 0.25,
        "review_quality": 0.15,
        "keyword_gap": 0.30,
        "naver_briefing_confirmed": 0.10,
        "naver_ai_tab_visible": 0.05,  # 신규
        "has_intro": 0.10,
        "has_post": 0.05,
    },
    "likely": {..., "naver_ai_tab_visible": 0.10},
    "inactive": {..., "naver_ai_tab_visible": 0.15, "naver_briefing_confirmed": 0},
}
```

### M3-3. AI탭 시뮬레이션 v2 (실측 패턴 학습)
- 베타 1주차 실측 AI탭 인용 패턴을 `briefing_engine.simulate_ai_tab_answer()` v2에 반영
- 추정 → 실측 배지 분리

### M3-4. 금융·헬스케어 모니터링 잡
**파일**: `backend/scheduler/jobs.py`

```python
async def briefing_category_expansion_monitor_job():
    """월 1회 — 네이버 공식 발표에서 신규 ACTIVE/LIKELY 업종 감지."""
    # help.naver.com / 네이버 블로그 크롤링 → 키워드 매칭 → 알림
```

---

## 8. 측정·검증 체계

### 베이스라인 (M1 시작 전 캡처 필수)
베타 1명(education, INACTIVE) 기준:
- Track1 점수: 실측 후 기재
- AI 브리핑 노출 횟수 (지난 30일): 실측 후 기재
- AI탭 노출 횟수: 0 (현재 측정 0건)
- 블로그 발견 수: 실측 후 기재

### M1 완료 시 검증 항목
- [ ] `in_ai_tab` 필드 응답 (False여도 정상)
- [ ] 광고 영역 감지 함수 작동 (광고 출시 전이라 False)
- [ ] `get_ai_tab_eligibility()` 호출 위치 3곳 (guide/briefing/dashboard)
- [ ] 5요소 카드 노출 (Free 잠금, Basic+ 노출)
- [ ] 25개 alias 테스트 통과

### M2 완료 시 검증 항목
- [ ] Group D 10개 업종 시뮬레이션 카드 채워짐
- [ ] 업종별 체크리스트 25개 다름
- [ ] 블로그 UGC 카드 노출
- [ ] `/guide/channels/restaurant` 등 25개 페이지 200 OK
- [ ] `/how-it-works` 광고 섹션 추가

### M3 완료 시 검증 항목
- [ ] P2 트리거 잡 주 2회 실행 로그
- [ ] v3.2 가중치 토글 작동 + 점수 급락 없음
- [ ] AI탭 v2 시뮬레이션 실측 배지 분기
- [ ] 금융·헬스케어 모니터링 잡 실행 로그

---

## 9. 의사결정 잔여 항목

| 항목 | 옵션 | 권장 |
|------|------|------|
| M1 착수 순서 | M1-1+M1-2 동시 / M1-4+M2-3 / M2-4 / M1 전체 | **M1 전체 1주 일괄** (Critical N2 광고 해소 포함) |
| 광고 처리 정책 | 점수 0 + 광고 배지 분리 / 광고도 점수 포함 / 결정 보류 | **점수 0 + 배지 분리** (정직한 측정) |
| Group D 처리 | 일괄 추가 / 폴백 유지 + 안내 강화 / 가입 패턴 보고 결정 | **일괄 추가** (M2-1, ~4시간) |

---

## 10. 관련 문서

| 문서 | 역할 |
|------|------|
| **`docs/naver_ai_search_optimization_plan_v1.0.md`** (이 문서) | 종합 계획·M1~M3 구현 사양·백업 절차 |
| `docs/category_channel_matrix_v1.0.md` | 25개 업종별 노출 채널 매트릭스 부록 |
| `docs/p2_p3_execution_runbook.md` | M3 트리거 자동화 갱신 필요 |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | 이력 보존 (변경 없음) |
| `docs/main_engine_optimization_v1.1.md` | Phase 1 완료, M3과 연계 |
| `docs/naver_gpt_work_standard_v1.0.md` | 작업 전 필수 참조 |

---

*v1.0 작성: 2026-05-18 | 다음 리뷰: M1 완료 후 또는 6월 AI탭 전체 확대 감지 시*
