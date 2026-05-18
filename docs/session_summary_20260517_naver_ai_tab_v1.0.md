# 세션 작업 요약 — 네이버 AI탭 대응 v1.0

> **세션 날짜: 2026-05-16 ~ 2026-05-17**
> **작업 범위: 네이버 AI탭/AI 브리핑 구분 대응 + 업종별 안내 개선**
> **배포 상태: 전체 배포 완료 (`aeolab.co.kr`)**
> **최종 갱신: 2026-05-17 (정합성 점검 후 추가 정보 반영)**

---

## 1. 세션 배경

네이버 AI탭(2026-04-27 베타 출시)이 AI 브리핑과 다른 별개 서비스임에도 불구하고,
기존 AEOlab 코드가 AI 브리핑 업종 제한(음식점·카페·숙박만)을 AI탭에도 동일하게 적용하는 근본 오류가 있었음.

**핵심 차이**:
- AI 브리핑: 음식점·카페·숙박 등 ACTIVE 업종만 / 프랜차이즈 제외 (네이버 공식 정책)
- AI탭: **업종 제한 없음** (모든 업종 노출 가능, 현재 네이버플러스 구독자 대상 베타)

이로 인해 의원·법무·교육 등 INACTIVE 업종 사용자(전체 사용자의 상당수)가
AI탭 기회를 안내받지 못하고 서비스 이탈할 위험이 있었음.

---

## 2. 완료된 작업 목록

### P0 — 즉시 수정 (2026-05-16 배포)

| 수정 내용 | 파일 | 줄 |
|---------|------|---|
| `get_ai_tab_eligibility()` 함수 추가 (모든 업종 "beta" 반환) | `score_engine.py` | 82 |
| AI탭 Track1 docstring 수정 — "AI 검색 준비도 (AI브리핑+AI탭)" | `score_engine.py` | 7 |
| `briefingEligibility` + `aiTabEligibility` 변수 분리 | `dashboard/page.tsx` | 342 |
| INACTIVE 배너 — "AI탭은 모든 업종 가능" 안내 추가 | `dashboard/page.tsx` | 714 |
| DualTrackCard Track1 레이블 수정 | `DualTrackCard.tsx` | 8 |
| PreviewClient Track1 레이블 수정 | `PreviewClient.tsx` | 445, 509 |
| 5단계 가이드 텍스트 → "AI 검색 노출 5단계 가이드" | `dashboard/page.tsx` | 903 |

### P0 버그 수정 (코드리뷰 후, 2026-05-17 배포)

| 수정 내용 | 파일 | 줄 |
|---------|------|---|
| INACTIVE early return 제거 (`available: True` 모든 업종) | `report.py` | 1310~1324 |
| `eligibility` → `briefing_eligibility` 변수명 수정 | `report.py` | 1314, 1335 |

### P1-A — AI탭 콘텐츠 공백 해소 (2026-05-17 배포)

> **2026-05-17 정합성 점검 추가 정보**:
> 사용자 카테고리 표기(medical·legal·education·interior·realestate) ≠ taxonomy 키.
> 실제 코드에는 `_CATEGORY_ALIASES` (`keyword_taxonomy.py:20~106`)를 통해 매핑된 다음 키에 추가됨.

**사용자 카테고리 → taxonomy 키 매핑:**

| 사용자 카테고리 | taxonomy 키 (실제 추가 위치) | 라인 |
|----------------|---------------------------|------|
| medical / hospital / 병원 / 의원 | `clinic` | `keyword_taxonomy.py:345` |
| education / tutoring / 학원 / 교육 / 과외 | `academy` | `keyword_taxonomy.py:394` |
| legal / 법률 / 세무 | `legal` | `keyword_taxonomy.py:482` |
| interior / 인테리어 / 리모델링 / 시공 | `interior` | `keyword_taxonomy.py:929` |
| realestate / 부동산 / 공인중개사 / 매매 / 임대 | `realestate` | `keyword_taxonomy.py:890` |

| 수정 내용 | 파일 |
|---------|------|
| INACTIVE 5개 업종에 `ai_tab_context` 키워드 추가 (위 매핑 참조) | `keyword_taxonomy.py` |
| 각 업종별 키워드 10개, weight 0.05, 기존 합계 1.0 유지 | `keyword_taxonomy.py` |
| `AiInfoTabStatusCard` 제목 "AI 브리핑 노출 설정" → "AI 정보 탭 상태 확인" | `AiInfoTabStatusCard.tsx:71` |
| LIKELY 업종 "비대상 업종" 오안내 → 정확한 설명으로 수정 | `AiInfoTabStatusCard.tsx` |
| INACTIVE 업종 배너 텍스트 — AI탭 기회 명시 | `AiInfoTabGuide.tsx:115` |
| INACTIVE/프랜차이즈 단계 1 — "🆕 AI탭 준비" 섹션 추가 | `AiInfoTabGuide.tsx:135~187` |
| INACTIVE 단계 2 alternative — AI탭+글로벌AI 통합 안내로 개선 | `AiInfoTabGuide.tsx:216~228` |

> **⚠️ 잔여 위험 (P1-C-1로 해결 예정)**:
> P1-A는 5개 INACTIVE 업종만 커버. 다음 INACTIVE 업종은 여전히 `ai_tab_context` 없음 → AiTabPreviewCard 빈 카드 가능성 존재:
> - 잔여 ~20개: shopping, fashion, photo, video, design, auto, cleaning, accommodation(일부), kids, study, workshop, music_class, cooking, experience, other
> - v5.7 신규 13개: dental, oriental_medicine, optics, martial_arts, climbing, art_class, childcare, car_wash, electronics_repair, footwear, stationery, norebang, billiards
>
> → **P1-C-1 빈 카드 폴백 처리의 우선순위가 P1-B와 동등하게 상향됨**

---

## 3. 수정된 파일 목록 (이번 세션)

```
backend/
  services/
    score_engine.py          ← get_ai_tab_eligibility() 추가, docstring 수정
    keyword_taxonomy.py      ← INACTIVE 5업종 ai_tab_context 추가
  routers/
    report.py                ← INACTIVE early return 제거, briefing_eligibility 분리

frontend/
  app/(dashboard)/
    dashboard/
      page.tsx               ← briefingEligibility/aiTabEligibility 분리, INACTIVE 배너, 5단계 텍스트
      DualTrackCard.tsx      ← Track1 레이블 수정
    preview/
      PreviewClient.tsx      ← Track1 레이블 수정
    guide/ai-info-tab/
      AiInfoTabGuide.tsx     ← INACTIVE 배너·AI탭 준비 섹션·단계 2 alternative 개선
  components/dashboard/
    AiInfoTabStatusCard.tsx  ← 제목·LIKELY 안내 수정
```

---

## 4. 백업 위치

**백업 디렉토리**: `docs/backups/2026-05-17/`

백업 파일 11개:
```
backend/services/score_engine.py          ← 수정 직후 현재 상태
backend/services/keyword_taxonomy.py      ← 수정 직후 현재 상태
backend/routers/report.py                 ← 수정 직후 현재 상태
backend/services/smart_place_auto_check.py  ← P1-B 수정 전 원본
backend/services/briefing_engine.py        ← P1-B 수정 전 원본
frontend/app/(dashboard)/dashboard/page.tsx
frontend/app/(dashboard)/dashboard/DualTrackCard.tsx
frontend/app/(dashboard)/preview/PreviewClient.tsx
frontend/components/dashboard/AiInfoTabStatusCard.tsx
frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx
frontend/components/dashboard/AiTabPreviewCard.tsx  ← P1-C 수정 전 원본
```

---

## 5. 남은 작업 (다음 세션)

### P1-B — 스마트플레이스 진단 확장 (1~2주)

#### P1-B-1. `smart_place_auto_check.py` — 예약 연동 감지 추가

**목적**: 스마트플레이스 예약 연동 여부 자동 감지
**주의**: 셀렉터를 서버에서 Playwright로 직접 확인 후 구현해야 함. 임의 셀렉터 사용 금지.

**사전 확인 방법** (서버에서):
```bash
# 실제 스마트플레이스 페이지에서 예약 버튼 DOM 구조 확인
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch(headless=True)
    pg = br.new_page()
    pg.goto('https://m.place.naver.com/restaurant/PLACE_ID/home')
    pg.wait_for_load_state('networkidle')
    html = pg.content()
    # '예약' 관련 DOM 출력
    import re
    matches = re.findall(r'<[^>]*예약[^>]*>', html[:50000])
    for m in matches[:20]: print(m)
    br.close()
"
```

**추가 위치**: `smart_place_auto_check.py` 내 `_run_checks()` 함수 (기존 3개 체크 아래)

**반환값 변경**:
```python
# 현재 반환
return {
    "is_smart_place": bool,
    "has_recent_post": bool,
    "has_intro": bool,
    "has_faq": False,  # deprecated
    "score_loss": int,
    "action_links": dict,
}

# P1-B 이후 추가
return {
    ...(기존)...,
    "has_reservation": bool,   # 신규 — 예약 연동 여부
    "photo_count": int,        # 신규 — 등록 사진 수
}
```

**점수 반영 방침**: 예약 연동은 점수 감점 없음. 가이드 행동 안내에만 사용.
(Track1 `smart_place_completeness` 100점 구조 유지 — 합계 변경 금지)

---

#### P1-B-2. `smart_place_auto_check.py` — 사진 수 감지 추가

```python
async def _check_photo_count(page, place_url: str) -> int:
    """사진 탭에서 등록 사진 수 파악."""
    try:
        await page.goto(f"{place_url}/photo", wait_until="domcontentloaded", timeout=10000)
        photos = await page.query_selector_all("img.place_photo_item")  # 셀렉터 실측 후 확정
        return len(photos)
    except Exception:
        _logger.warning("smart_place: photo_count check failed → 0")
        return 0
```

**기준**: 10장 미만 → 가이드에서 "사진 추가 권장" 안내

---

#### P1-B-3. `briefing_engine.py` — `reservation_setup` 액션 스텝 추가

**추가 위치**: `_ACTION_STEPS` 딕셔너리 (현재 5개: review_response, intro_qa, talktalk_menu, post, intro)

```python
"reservation_setup": {
    "label": "예약 연동 설정",
    "description": "네이버 예약 또는 셀렉트스퀘어 연동으로 AI탭 결과에 예약 버튼 표시",
    "url": "https://partner.naver.com/",
    "priority": "medium",
    "ai_tab_impact": True,
    "briefing_impact": False,
},
```

**호출 위치**: `get_improvement_path()` 함수 내 `has_reservation == False` 조건에서 반환

---

### ✅ P1-C — UI 개선 (2026-05-17 점검 완료)

**점검 결과**:
- P1-C-1 (AiTabPreviewCard 빈 카드 폴백): 신규 적용 완료
- P1-C-2 (DualTrackCard INACTIVE 분기): 이미 적용된 상태였음 (`DualTrackCard.tsx:210~228`)
- P1-C-3 (AiInfoTabStatusCard 차단): 이미 적용된 상태였음 (`dashboard/page.tsx:858`)

#### ✅ P1-C-1. `AiTabPreviewCard.tsx` — 빈 카드 폴백 처리 (2026-05-17 적용 완료)

`AiTabPreviewCard.tsx:284~302` — matched/missing 모두 빈 경우 안내 박스 + 가이드 링크 추가.
잔여 ~20개 INACTIVE 업종(shopping, fashion, photo, video, design 등 + v5.7 신규 13개)에서 빈 카드 대신 폴백 표시.

```tsx
// AiTabPreviewCard.tsx 추가 위치: matched/missing 렌더링 전
{matchedContexts.length === 0 && missingContexts.length === 0 && !loading && (
  <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
    <p className="text-sm text-gray-600">
      이 업종의 AI탭 노출 패턴 분석을 준비 중입니다.
      소개글·사진·예약 정보를 충실히 등록하면 노출 가능성이 높아집니다.
    </p>
    <a href="/guide/ai-info-tab" className="mt-2 inline-block text-xs text-indigo-600 underline">
      AI탭 최적화 가이드 →
    </a>
  </div>
)}
```

#### ✅ P1-C-2. `DualTrackCard.tsx` — INACTIVE 업종 Track1 설명 분기 (이미 적용됨)

`DualTrackCard.tsx:210~228` 코드 확인 결과 이미 적용 완료:
- `track1Label`: isActive/isLikely/isInactive 3분기 ("📍 네이버 SEO 검색 점수" 등)
- `track1Sublabel`: 동일 3분기
- `track1Tip`: isInactive일 때 `INACTIVE_NAVER_SEO_TIPS` 사용

추가 작업 불필요.

#### ✅ P1-C-3. `AiInfoTabStatusCard.tsx` — INACTIVE 업종 차단 (이미 적용됨)

`dashboard/page.tsx:858` 코드 확인 결과 이미 적용 완료:
```tsx
{business.id && accessToken && briefingMeta && briefingMeta.eligibility !== "inactive" && (
  <AiInfoTabStatusCard ... />
)}
```

백엔드 `briefing_meta.eligibility` (`score_engine.py:446`)는 동일한 `get_briefing_eligibility()` 함수에서 생성되므로 프론트 `briefingEligibility`와 동일 결과. 추가 작업 불필요.

---

### P2 — AI탭 전체 확대 후 (2026년 6월 이후)

**조건**: 네이버 AI탭 전체 이용자 확대 공식 확인 후 진행

#### P2-1. `naver_ai_tab_scanner.py` 신규 생성

```
backend/services/ai_scanner/naver_ai_tab_scanner.py
```

- URL 파라미터 확인 (비로그인 접근 가능 여부 실측)
- `NaverAITabScanner` 클래스 — `scan(query, place_name, place_id)` 메서드
- Semaphore(2) RAM 보호 (기존 `naver_scanner.py`와 동일 패턴)

#### P2-2. DB 컬럼 추가 (Supabase SQL Editor)

```sql
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_ai_tab_visible    BOOLEAN  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_rank        SMALLINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_ai_tab_excerpt     TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS naver_reservation_linked BOOLEAN  DEFAULT NULL;
```

#### P2-3. `score_engine.py` Track1 가중치 재조정

- 현재 `naver_exposure_confirmed` (AI 브리핑만 측정)
- 변경: `naver_briefing_confirmed` + `naver_ai_tab_visible` 별도 항목 또는 통합 가중치 재설계
- INACTIVE 업종: `naver_briefing_confirmed = 0`, `naver_ai_tab_visible` 가중 상향

#### P2-4. 스케줄러 스크린샷 로직 수정

```python
# scheduler/jobs.py _needs_naver_ai_shot() 함수
# 현재: INACTIVE 업종 스크린샷 제외
# P2: AI 브리핑 스크린샷(ACTIVE/LIKELY만) vs AI탭 스크린샷(모든 업종) 분리
```

---

### P3 — 점수 모델 v3.1 활성화 (베타 사용자 5명+ 후)

```bash
# 서버 .env 수정
SCORE_MODEL_VERSION=v3_1
pm2 restart aeolab-backend
```

**활성화 전 체크리스트**:
- [ ] 베타 사용자 5명 이상 스캔 데이터 존재
- [ ] Track1 v3.1 6항목 전체 실측값 확인
- [ ] INACTIVE 업종 점수 급락 없는지 시뮬레이션 (v3.0 → v3.1 diff 확인)

---

## 6. 모니터링 — 네이버 변화 감지

| 체크 항목 | 확인 방법 | 주기 |
|---------|---------|------|
| AI탭 전체 이용자 확대 | 비로그인 네이버 검색 → AI탭 탭 표시 여부 | 주 1회 |
| AI탭 업종 게이팅 발표 | 네이버 공식 블로그·help.naver.com | 월 1회 |
| AI 브리핑 LIKELY 업종 ACTIVE 승급 | 공식 발표 모니터링 | 월 1회 |
| 스마트플레이스 예약 DOM 변경 | Playwright 셀렉터 테스트 | 분기 1회 |

---

## 7. 관련 문서 목록

| 문서 | 내용 |
|------|------|
| `docs/naver_ai_tab_대응_개발계획_v1.0.md` | P0 개발 계획 (기획서 기준 아님 선언) |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | P1~P3 전체 로드맵 (전수 조사 기반) |
| `docs/session_summary_20260517_naver_ai_tab_v1.0.md` | 이 문서 |
| `docs/backups/2026-05-17/` | 백업 파일 11개 |

---

## 8. 다음 세션 시작 명령

```
docs/session_summary_20260517_naver_ai_tab_v1.0.md 읽고
P1-B 작업 시작: smart_place_auto_check.py 예약 연동 감지 추가
(셀렉터 실측 먼저)
```

---

*작성: 2026-05-17 | 세션 완료 시점 현재 배포 상태: 정상*
