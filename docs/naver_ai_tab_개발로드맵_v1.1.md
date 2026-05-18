# 네이버 AI탭·AI 브리핑 대응 개발 로드맵 v1.1

> **작성일: 2026-05-17 | 최종 갱신: 2026-05-17 (P1-A 완료·정합성 점검 후)**
> **기준: 실제 코드 전수 조사 + 실제 네이버 서비스 현황**
>
> v1.0(`naver_ai_tab_대응_개발계획_v1.0.md`) P0 완료 후 전체 재검토 버전.
> 잘못 판단된 항목 수정 + 미발견 이슈 추가 + 우선순위 재편.
>
> **2026-05-17 정합성 점검 결과**: P0(2026-05-16), P0 버그 수정·P1-A(2026-05-17) 배포 완료.
> §1-1·§1-2의 "오판"은 P1-A로 부분 해결됨(아래 갱신 표 참조).
> 잔여 미해결: P1-A에 미포함된 ~20개 INACTIVE 업종의 빈 카드 폴백(P1-C로 우선순위 상향).

---

## 0. P0·P1-A 완료 검증 (2026-05-16~17)

### P0 (2026-05-16 배포)

| 수정 항목 | 파일 | 상태 |
|---------|------|------|
| AI탭 업종 제한 없음 — INACTIVE early return 제거 | `report.py:1310~1324` | ✅ 배포 완료 |
| `get_ai_tab_eligibility()` 함수 추가 | `score_engine.py:82` | ✅ 배포 완료 |
| `briefingEligibility` / `aiTabEligibility` 분리 | `dashboard/page.tsx:342` | ✅ 배포 완료 |
| INACTIVE 배너 — AI탭 가능 안내 추가 | `dashboard/page.tsx:714` | ✅ 배포 완료 |
| Track 1 레이블 → "AI 검색 준비도 (AI브리핑·AI탭)" | `DualTrackCard.tsx`, `PreviewClient.tsx` | ✅ 배포 완료 |
| 5단계 가이드 텍스트 → "AI 검색 노출 5단계 가이드" | `dashboard/page.tsx:903` | ✅ 배포 완료 |

### P0 버그 수정 (코드리뷰 후, 2026-05-17 배포)

| 수정 항목 | 파일 | 상태 |
|---------|------|------|
| INACTIVE early return 제거 (`available: True` 모든 업종) | `report.py:1310~1324` | ✅ 배포 완료 |
| `eligibility` → `briefing_eligibility` 변수명 수정 | `report.py:1314, 1335` | ✅ 배포 완료 |

### P1-A (2026-05-17 배포) — AI탭 콘텐츠 공백 해소

| 수정 항목 | 파일 | 상태 |
|---------|------|------|
| INACTIVE 5개 업종 `ai_tab_context` 추가 (사용자 카테고리: medical·legal·education·interior·realestate) | `keyword_taxonomy.py:240~929` | ✅ 배포 완료 |
| └─ 실제 taxonomy 키: `clinic`/`academy`/`legal`/`interior`/`realestate` (alias 자동 매핑) | `keyword_taxonomy.py:39~106` | ✅ 적용 확인 |
| `AiInfoTabStatusCard` 제목 → "AI 정보 탭 상태 확인" | `AiInfoTabStatusCard.tsx:71` | ✅ 배포 완료 |
| LIKELY 업종 "비대상 업종" 오안내 → 정확한 설명 | `AiInfoTabStatusCard.tsx` | ✅ 배포 완료 |
| INACTIVE 업종 배너 텍스트 — AI탭 기회 명시 | `AiInfoTabGuide.tsx:115` | ✅ 배포 완료 |
| INACTIVE/프랜차이즈 단계 1 — "🆕 AI탭 준비" 섹션 추가 | `AiInfoTabGuide.tsx:135~187` | ✅ 배포 완료 |
| INACTIVE 단계 2 alternative — AI탭+글로벌AI 통합 안내 | `AiInfoTabGuide.tsx:216~228` | ✅ 배포 완료 |

---

## 1. 재검토 — 잘못 판단된 항목 수정

### 1-1. ❌ 오판: "AiTabPreviewCard는 INACTIVE에서 이미 숨겨진다"

**P0 계획서(v1.0)의 판단**: INACTIVE 업종 → 카드 숨김 → backend 수정으로 해결.

**실제 코드 조사 결과**:
- `AiTabPreviewCard.tsx:107`: `if (!loading && unavailable) return null;`
- `unavailable = !data.available`
- **backend `available: True` 반환 후** → `unavailable = false` → 카드가 표시됨 ✅

그런데 **카드는 표시되지만 내용이 비어 있었다**:
- `simulate_ai_tab_answer()` 함수는 `keyword_taxonomy.py`의 `ai_tab_context` 키워드 교집합으로 preview 생성
- INACTIVE 업종(medical, legal, education 등)에는 `ai_tab_context` 그룹 자체가 없었음
- 결과: `matched_contexts = []`, `missing_contexts = []`, `simulated_answer = 빈 문장`

**해결 (P1-A, 2026-05-17 배포)**:
- ✅ INACTIVE 5업종(`clinic`/`academy`/`legal`/`interior`/`realestate`)에 `ai_tab_context` 키워드 추가 완료
- ⚠️ **잔여 위험**: 다음 INACTIVE 업종은 여전히 `ai_tab_context` 없음 → 빈 카드 가능성
  - `shopping`, `fashion`, `photo`, `video`, `design`, `auto`, `cleaning`, `accommodation`(일부)
  - v5.7 신규 13개: `dental`, `oriental_medicine`, `optics`, `martial_arts`, `climbing`, `art_class`, `childcare`, `car_wash`, `electronics_repair`, `footwear`, `stationery`, `norebang`, `billiards`
  - 기타: `kids`, `study`, `workshop`, `music_class`, `cooking`, `experience`, `other` 등
- → **P1-C-1 빈 카드 폴백 처리의 우선순위가 상향됨** (P1-A로 5개만 해결됐기 때문)

---

### 1-2. ⚠️ 부분 오판: "INACTIVE 업종 AiInfoTabGuide 가이드가 없다"

**P0 계획서의 판단**: AiInfoTabGuide.tsx에 INACTIVE용 AI탭 가이드가 없어서 P1-3으로 추가 필요.

**실제 코드 조사 결과**:
- `AiInfoTabGuide.tsx:135-173` — `isInactive` 업종은 단계 1, 2(`StepSkipped`)가 스킵됨
- 단계 3(소개글), 4(소식), 5(리뷰)는 INACTIVE도 표시됨
- 5종 사진 체크리스트, C-rank 4요소 체크리스트 → INACTIVE도 표시됨

즉, AI 브리핑 전용 단계는 스킵되지만 **모든 업종 공통 개선 행동은 이미 표시 중**.
단, 가이드 제목이 분기되어 INACTIVE에는 "AI 검색 노출 개선"으로 표시 — 이미 처리됨.

**해결 (P1-A, 2026-05-17 배포)**: ✅ INACTIVE/프랜차이즈 단계 1에 "🆕 네이버 AI탭 준비 — 이 업종도 노출 가능" 섹션 추가 완료 (`AiInfoTabGuide.tsx:149~187`).
구성: AI탭 준비 5항목(소개글 Q&A·사진·예약 연동·리뷰·영업정보) + 베타 면책 문구.

---

### 1-3. ✅ 올바른 판단 재확인: "예약 연동은 노출 전제 조건 아님"

코드 내 `_ACTION_STEPS`, `briefing_engine.py`, `score_engine.py` 전수 확인.
현재 어디에도 "예약 없으면 AI탭 안 나옴" 로직 없음. 올바른 판단 유지.

---

### 1-4. ✅ 올바른 판단 재확인: "6월 전체 확대는 확정이 아닌 예정"

MT News 2026-05-11 보도 원문 "오는 6월엔 전체 이용자로 확대할 예정" — 예정 표현 유지.

---

### 1-5. ❌ 신규 발견: 스케줄러 스크린샷 잡에 INACTIVE 제외 로직 존재

`scheduler/jobs.py` 내 `_needs_naver_ai_shot()` 함수가 INACTIVE 업종을 스크린샷 제외 처리.
이는 AI 브리핑 스크린샷에만 적용해야 하며 AI탭 대응과 무관하지만,
**향후 AI탭 스크린샷 캡처 기능 추가 시** 이 로직이 INACTIVE 업종을 잘못 제외할 위험 존재.

---

## 2. 현재 코드 상태 요약 (전수 조사 기준)

### 구현 완료 ✅

| 기능 | 파일 | 비고 |
|------|------|------|
| AI 브리핑 업종 분류 (active/likely/inactive) | `score_engine.py:52-91` | 프랜차이즈 제외 포함 |
| 스마트플레이스 자동 진단 3항목 | `smart_place_auto_check.py` | is_smart_place / has_recent_post / has_intro |
| AI탭 답변 시뮬레이션 | `briefing_engine.py:1359` | AI 호출 0회, ACTIVE 업종만 실질 내용 |
| 소개글 자동 생성 | `business.py:761` | Claude Sonnet, 플랜별 한도 |
| 톡톡 채팅방 메뉴 초안 | `guide.py` | 2024.02.14 개편 사양 |
| Track 1 점수 5항목 | `score_engine.py:178` | keyword_gap 35% 중심 |
| AI탭 미리보기 카드 (Basic+) | `AiTabPreviewCard.tsx` | ACTIVE만 실질 내용, INACTIVE는 빈 카드 |
| 5단계 가이드 + 체크리스트 | `AiInfoTabGuide.tsx` | 사진 5종 + C-rank 4요소 포함 |
| INACTIVE 업종 — AI탭 가능 배너 | `dashboard/page.tsx:714` | P0 완료 |
| AI탭 모든 업종 available=True | `report.py:1332` | P0 완료 |
| 브리핑 경로 4개 액션 | `briefing_engine.py:60-91` | 리뷰/소개글/소식/톡톡 |
| 주간·월간 자동화 스캔 | `scheduler/jobs.py` | 카카오 알림 연계 |

### 미구현 ❌

| 기능 | 이유 | 긴급도 |
|------|------|------|
| INACTIVE 업종 ai_tab_context 키워드 | taxonomy에 해당 그룹 없음 | P1 최우선 |
| INACTIVE 업종 AI탭 특화 가이드 | AiInfoTabGuide에 섹션 없음 | P1 |
| 예약 연동 자동 체크 | smart_place_auto_check 미구현 | P1 |
| 예약 설정 액션 스텝 | briefing_engine._ACTION_STEPS 미포함 | P1 |
| 사진 수 자동 감지 | Playwright 파싱 미구현 | P1 |
| AI탭 실제 Scanner | 네이버플러스 로그인 필요 | P2 (6월 후) |
| reservation_linked Track1 가중치 | 측정값 없어서 불가 | P2 (예약 체크 후) |
| v3.1 점수 모델 활성화 | 베타 5명+ 데이터 필요 | P3 |

---

## 3. 개발 로드맵 (우선순위 재편)

### ✅ P1-A (2026-05-17 배포 완료) — AI탭 콘텐츠 공백 해소

> 아래 두 항목은 모두 배포 완료. 이력 보존을 위해 상세 내용 유지.

#### ✅ P1-A-1. `keyword_taxonomy.py` — INACTIVE 업종 ai_tab_context 추가 (완료)

**적용된 업종** (사용자 카테고리 → taxonomy 키 매핑):
| 사용자 카테고리 | taxonomy 키 | 라인 |
|----------------|-------------|------|
| medical / hospital / 병원 / 의원 | `clinic` | `keyword_taxonomy.py:345` |
| education / tutoring / 학원 / 교육 | `academy` | `keyword_taxonomy.py:394` |
| legal / 법률 / 세무 | `legal` | `keyword_taxonomy.py:482` |
| interior / 인테리어 / 리모델링 | `interior` | `keyword_taxonomy.py:929` |
| realestate / 부동산 / 공인중개사 | `realestate` | `keyword_taxonomy.py:890` |

각 업종에 `ai_tab_context` 그룹 (weight 0.05, 키워드 10개) 추가. 기존 가중치 합 1.0 보존.

**⚠️ 잔여 미커버 INACTIVE 업종** (P1-C-1 폴백 처리로 해결 예정):
shopping, fashion, photo, video, design, auto, cleaning, accommodation(일부), kids, study, workshop, music_class, cooking, experience, other, dental, oriental_medicine, optics, martial_arts, climbing, art_class, childcare, car_wash, electronics_repair, footwear, stationery, norebang, billiards (총 ~20개+)

---

#### ✅ P1-A-2. `AiInfoTabGuide.tsx` — INACTIVE 업종 AI탭 전용 섹션 추가 (완료)

`AiInfoTabGuide.tsx:135~187` 적용 — INACTIVE/프랜차이즈 사업장 단계 1 위치에
"🆕 네이버 AI탭 준비 — 이 업종도 노출 가능합니다" 섹션 표시.

구성:
- AI 브리핑 vs AI탭 차이 명시 ("업종·프랜차이즈 제한 없이 모든 사업장 노출 가능")
- AI탭 준비 5항목 (소개글 Q&A 구조·사진·예약 연동·리뷰·영업정보)
- 베타 면책 문구 ("실제 노출 여부 확인 어려움, 전체 확대 후 측정 추가")

---

### P1-B (1~2주) — 스마트플레이스 진단 확장

#### P1-B-1. `smart_place_auto_check.py` — 예약 연동 감지 추가

```python
# _check_reservation() 추가
# Playwright로 스마트플레이스 /home 탭에서 예약 버튼 DOM 확인

async def _check_reservation(page) -> bool:
    try:
        # 예약 버튼 셀렉터 (실측 후 확인 필요)
        selectors = [
            "a[href*='/booking']",
            "button[aria-label*='예약']",
            ".booking_btn",
            "a[data-type='reservation']",
        ]
        for sel in selectors:
            el = await page.query_selector(sel)
            if el:
                return True
        return False
    except Exception:
        _logger.warning("smart_place: reservation check failed → False")
        return False
```

**주의**: 셀렉터는 실제 스마트플레이스 페이지에서 Playwright로 직접 확인 후 확정.
서버에서 `playwright codegen m.place.naver.com/...` 로 DOM 구조 파악 권장.

점수 반영: `_calc_score_loss()`에 예약 미연동 시 안내 메시지 추가 (점수 감점 아님, 개선 행동 안내).

#### P1-B-2. `smart_place_auto_check.py` — 사진 수 감지 추가

```python
async def _check_photo_count(page) -> int:
    """사진 탭 방문 후 등록 사진 수 파악 (추정)."""
    try:
        await page.goto(f"{place_url}/photo", wait_until="domcontentloaded", timeout=10000)
        # 사진 썸네일 수 카운트
        photos = await page.query_selector_all("img.place_photo_item, .photo_wrap img")
        return len(photos)
    except Exception:
        _logger.warning("smart_place: photo count check failed → 0")
        return 0
```

목표: 사진 10장 미만 시 가이드 경고 표시 (점수 감점 없음, AI탭 품질 향상 안내).
반환값은 `smart_place_check_result.photo_count` 필드로 추가.

---

#### P1-B-3. `briefing_engine.py` — `reservation_setup` 액션 스텝 추가

```python
# _ACTION_STEPS 딕셔너리에 추가
"reservation_setup": {
    "label": "예약 연동 설정",
    "description": "네이버 예약 또는 셀렉트스퀘어 연동으로 AI탭 결과에 예약 버튼 표시",
    "url": "https://partner.naver.com/",
    "priority": "medium",
    "ai_tab_impact": True,
    "briefing_impact": False,
},
```

이 액션은 `has_reservation = False`인 사업장에 대해 `get_improvement_path()` 함수에서 반환.

---

### ✅ P1-C (2026-05-17 추가 점검 — 대부분 이미 적용됨) — 점수 UI 개선

> **2026-05-17 점검 결과**:
> - P1-C-1 (AiTabPreviewCard 빈 카드 폴백): **신규 적용 완료** (2026-05-17)
> - P1-C-2 (DualTrackCard INACTIVE 분기): **이미 적용된 상태** — `DualTrackCard.tsx:210~228` `track1Label`/`track1Sublabel`/`track1Tip` 모두 isInactive 분기 처리됨
> - P1-C-3 (AiInfoTabStatusCard INACTIVE 차단): **이미 적용된 상태** — `dashboard/page.tsx:858` `briefingMeta.eligibility !== "inactive"` 조건으로 차단됨

#### ✅ P1-C-1. `AiTabPreviewCard.tsx` — 빈 카드 폴백 (2026-05-17 적용 완료)

P1-A로 의원/법무/교육/인테리어/부동산은 해결됐으나, 잔여 ~20개 INACTIVE 업종(`shopping`, `fashion`, `photo`, `video`, `design`, `auto`, `cleaning`, `accommodation`(일부), `dental`, `oriental_medicine`, `optics`, `martial_arts`, `climbing`, `art_class`, `childcare`, `car_wash`, `electronics_repair`, `footwear`, `stationery`, `norebang`, `billiards`, `kids`, `study`, `workshop`, `music_class`, `cooking`, `experience`, `other` 등)은 여전히 `matched_contexts === []` && `missing_contexts === []` 상태가 됨.

**적용 코드** (`AiTabPreviewCard.tsx:284~302`):
```tsx
{data.matched_contexts.length === 0 && data.missing_contexts.length === 0 && (
  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
    <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
      <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
      이 업종의 AI탭 패턴 분석 준비 중
    </p>
    <p className="text-sm text-gray-600 mt-1 leading-snug break-keep">
      소개글·사진·예약 정보를 충실히 등록하면 AI탭 노출 가능성이 높아집니다.
    </p>
    <Link href="/guide/ai-info-tab" className="mt-2 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
      AI탭 최적화 가이드 →
    </Link>
  </div>
)}
```

P1-A 추가 작업 대안(권장 X): taxonomy에 잔여 20개 업종 ai_tab_context를 모두 추가 — 가중치 조정 부담 큼.
폴백 처리가 더 가볍고 유지보수 부담 적음.

#### ✅ P1-C-2. `DualTrackCard.tsx` — INACTIVE 업종 Track1 설명 분기 (이미 적용됨)

`DualTrackCard.tsx:210~228` 코드 확인 결과 이미 적용 완료:
```tsx
const track1Label = isActive ? "📍 네이버 AI 브리핑 점수"
  : isLikely ? "📍 네이버 검색 점수 (AI 브리핑 확대 예정)"
  : isInactive ? "📍 네이버 SEO 검색 점수"
  : "📍 네이버 AI 브리핑 점수";
```
`track1Sublabel`, `track1Tip`도 isInactive 분기 처리됨. 추가 작업 불필요.

#### ✅ P1-C-3. `AiInfoTabStatusCard.tsx` — INACTIVE 업종 차단 (이미 적용됨)

`dashboard/page.tsx:858` 코드 확인 결과 이미 적용 완료:
```tsx
{business.id && accessToken && briefingMeta && briefingMeta.eligibility !== "inactive" && (
  <AiInfoTabStatusCard ... />
)}
```
백엔드 `score_engine.py:446`의 `briefing_meta.eligibility`는 동일 `get_briefing_eligibility()` 함수에서 생성되므로 프론트와 동일 결과. 추가 작업 불필요.

---

### P2 (6월 AI탭 전체 확대 후)

#### P2-1. AI탭 실제 Scanner 구현

**조건**: 네이버 로그인 없이 AI탭 접근 가능해진 후 구현.

**확인 방법**:
```bash
# 서버에서 비로그인 상태로 AI탭 접근 가능한지 테스트
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    pg = br.new_page()
    pg.goto('https://search.naver.com/search.naver?query=강남맛집&sm=tab_etc&where=AI')
    print('title:', pg.title())
    print('url:', pg.url)
    br.close()
"
```

AI탭 URL 파라미터 `where=AI` 또는 `sm=tab_etc` 조합은 전체 확대 후 실측 필요.

**구현 파일**: `backend/services/ai_scanner/naver_ai_tab_scanner.py`

```python
class NaverAITabScanner:
    """네이버 AI탭 노출 측정 — P2 (6월 전체 확대 후)."""
    
    SELECTORS = {
        "ai_tab_result": [".ai_tab_result", "[data-tab='ai']"],
        "place_mention": [".place_link", ".ai_place_card"],
        "reservation_btn": ["a[href*='/booking']"],
    }
    
    async def scan(self, query: str, place_name: str, place_id: str) -> dict:
        """AI탭에서 place_name 사업장 노출 여부 확인."""
        ...
```

#### P2-2. DB 컬럼 추가

```sql
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_ai_tab_visible    BOOLEAN   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_rank        SMALLINT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_excerpt     TEXT      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_reservation_linked BOOLEAN   DEFAULT NULL;
```

#### P2-3. 스케줄러 INACTIVE 제외 로직 수정

```python
# scheduler/jobs.py _needs_naver_ai_shot() 함수
# 현재: INACTIVE 업종 스크린샷 제외
# P2: AI탭 스크린샷은 모든 업종 포함하도록 분기

def _needs_naver_ai_shot(category: str, eligibility: str) -> tuple[bool, bool]:
    """(briefing_shot_needed, ai_tab_shot_needed)"""
    briefing_needed = eligibility in ("active", "likely")
    ai_tab_needed = True  # AI탭은 모든 업종
    return briefing_needed, ai_tab_needed
```

---

### P3 (베타 사용자 5명+ 확보 후) — 점수 모델 v3.1 활성화

```bash
# 서버 .env에 추가
SCORE_MODEL_VERSION=v3_1
pm2 restart aeolab-backend
```

v3.1 활성화 전 체크리스트:
- [ ] 베타 사용자 5명 이상 스캔 데이터 존재
- [ ] Track1 6항목 전체에 실측값 있는지 확인
- [ ] INACTIVE 업종 점수 급락 없는지 시뮬레이션

---

## 4. 재검토 — 잘못 판단 가능성이 있는 항목

### 4-1. "AI탭 업종 제한 없음" — 향후 변경 가능성

현재 판단의 근거: 공식 네이버 발표에서 업종 게이팅 언급 없음.
**리스크**: 전체 확대 시 AI 브리핑처럼 업종 제한이 생길 수 있음.

대응 원칙:
- `get_ai_tab_eligibility()` 함수를 이미 별도로 분리해 두었음
- 업종 제한 공식 발표 시 이 함수만 수정하면 전체 적용됨
- 모니터링: 6월 전체 확대 발표 시 업종 조건 공지 여부 반드시 확인

### 4-2. "reservation_linked를 Track1 가중치에 추가" — 시기상조 판단

현재 `has_reservation` 측정도 미구현인 상태에서 점수 가중치 추가는 의미 없음.
**수정된 계획**: 먼저 `smart_place_auto_check.py`에 감지 추가 → 데이터 수집 → 가중치 추가 결정.
가중치 추가 시 주의: Track1 합계 100점 보존 필수 (기존 항목 비율 재조정).

### 4-3. "photo_count 측정이 Playwright로 가능하다" — 실측 필요

조사 보고에서 "Playwright 범위 초과"로 기재됐으나,
실제로는 `/photo` 탭이 Playwright 접근 가능 — 단 DOM 구조 사전 확인 필요.
서버에서 실제 스마트플레이스 사진 탭 DOM 확인 후 셀렉터 확정.

### 4-4. "소개글 내 Q&A 섹션은 자동 감지 불가" — 사실

스마트플레이스 소개글은 단순 텍스트 필드이며 별도 Q&A 구조 DOM 없음.
자동 감지 대신: 소개글 텍스트 내 "Q:" / "A:" 또는 "자주 묻는" 패턴 포함 여부로 간접 추정 가능.
단, 이 방법도 정확도가 낮아 UI 안내(사용자 직접 입력)가 현실적.

---

## 5. 작업 실행 순서 (2026-05-17 갱신)

```
✅ Day 1~3 (P1-A) — 2026-05-17 배포 완료:
  keyword_taxonomy.py — INACTIVE 5개 업종 ai_tab_context 추가
    (사용자 카테고리 medical/legal/education/interior/realestate
     → taxonomy 키 clinic/academy/legal/interior/realestate)
  AiInfoTabGuide.tsx — isInactive AI탭 전용 섹션 추가
  AiInfoTabStatusCard.tsx — 제목·LIKELY 안내 수정

✅ Week 1 (P1-C-1·P1-C-2·P1-C-3) — 2026-05-17 완료:
  AiTabPreviewCard.tsx — 빈 카드 폴백 처리 (잔여 ~20개 INACTIVE 업종 보호) ✅ 신규
  DualTrackCard.tsx — INACTIVE 업종 Track1 설명 분기 ✅ 이미 적용된 상태였음
  AiInfoTabStatusCard.tsx — INACTIVE 업종 차단 ✅ 이미 적용된 상태였음

⏳ Week 1~2 (P1-B — 사전 작업 필요):
  ⚠️ 서버에서 Playwright codegen으로 셀렉터 실측 선행 (작업자 직접)
  smart_place_auto_check.py — 예약 연동 감지
  smart_place_auto_check.py — 사진 수 감지 추가
  briefing_engine.py — reservation_setup 액션 추가
  → 배포

⏳ After June (P2):
  AI탭 전체 확대 확인 → NaverAITabScanner 구현
  DB 컬럼 추가 (Supabase SQL Editor)
  스케줄러 스크린샷 로직 수정
  + score_engine.py 변수명 통합 (naver_exposure_confirmed
    → naver_briefing_confirmed + naver_ai_tab_visible 분리)
    ※ v1.0 P1-2는 P2와 함께 진행하는 것으로 보류 (전체 시그니처 통합 변경이 안전)

⏳ After 5+ beta users (P3):
  SCORE_MODEL_VERSION=v3_1 활성화
```

---

## 6. 모니터링 — 향후 네이버 변화 감지 체크리스트

| 체크 항목 | 방법 | 주기 |
|---------|------|------|
| AI탭 전체 이용자 확대 여부 | 비로그인 네이버 검색 → AI탭 탭 표시 여부 | 주 1회 |
| AI탭 업종 게이팅 발표 여부 | 네이버 공식 블로그·help.naver.com | 월 1회 |
| AI 브리핑 LIKELY 업종 ACTIVE 승급 | 공식 발표 모니터링 | 월 1회 |
| 스마트플레이스 UI 변경 | Playwright 셀렉터 동작 여부 | 스캔 실패 시 |
| 예약 연동 DOM 구조 변경 | 서버 grep 또는 Playwright 테스트 | 분기 1회 |

---

## 7. 현재 서비스 한계 솔직 고지 (사용자 노출 원칙)

사용자에게 이미 안내하거나 안내해야 할 한계:

| 한계 | 현재 안내 여부 | 위치 |
|------|-------------|------|
| AI탭 실제 노출 여부 측정 불가 | ✅ "베타, 측정 준비 중" | AiTabPreviewCard |
| AI탭 전체 확대 시점 불확실 | ✅ "상반기 확대 예정" | dashboard 배너 |
| 예약 연동 감지 자동화 미구현 | ✅ 안내 추가 완료 (2026-05-17) | AiTabPreviewCard footer + AiInfoTabGuide P1-B-3 스텝 |
| INACTIVE 업종 AI탭 시뮬레이션은 추정값 | ✅ "(추정)" 배지 + 면책 문구 추가 완료 (2026-05-17) | AiTabPreviewCard footer |
| 소개글 Q&A 구조 자동 감지 불가 | ✅ 안내 추가 완료 (2026-05-17) | AiInfoTabGuide 소개글 섹션 주석 |

---

## 8. 추가 개선 사항 (2026-05-17 코드 검토에서 발견)

### 8-1. §3.4 JSON-LD UI 카드 (1일, P2) ✅ 구현 완료 (2026-05-17)

백엔드 `POST /api/schema/generate` + `score_engine.calc_schema_seo` + `website_checker` 3중 체계가 이미 작동 중이었으나 UI 카드가 없어 사용자가 진입점을 몰랐음.

**신규 파일**: `frontend/components/dashboard/SchemaCheckCard.tsx`
- `score_breakdown.schema_seo` 점수 (0~100) 진행바
- `website_check_result` 기반 4항목 체크 (JSON-LD / LocalBusiness / OG / Viewport)
- 홈페이지 없는 경우 → 카카오맵 대안 안내
- 점수 60점 미만 + 홈페이지 있음 → "AI 검색 등록 코드 자동 생성" CTA (`/schema`)
- Basic+ 플랜 게이팅 (Free는 잠금 UI)
- DashboardInsightZone에 통합

### 8-2. P1-B-3 reservation_setup 액션 스텝 ✅ 추가 완료 (2026-05-17)

`briefing_engine.py:_ACTION_STEPS["reservation_setup"]` 추가. 향후 `has_reservation=False` 조건에서 자동 안내 가능한 기반 마련.

### 8-3. `_needs_naver_ai_shot()` P2 진입 전 수정 필요 (미완, P2와 함께 처리)

`scheduler/jobs.py` 내 INACTIVE 업종 스크린샷 제외 로직 — AI탭 스크린샷 추가 시 충돌 발생. P2와 함께 분기 처리.

---

*v1.1 작성: 2026-05-17 | 전수 조사 기반 | 최종 갱신: 2026-05-17 (§7 한계 3건 해소 + §8 신규 추가)*
*다음 리뷰: P1-B 셀렉터 실측 후 예약·사진 수 감지 구현 / P2 진입 시 §8-3 함께 처리*
