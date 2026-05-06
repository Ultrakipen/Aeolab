# AI 브리핑 노출 조건 재설계 + 신 FAQ 적용 계획

> 작성일: 2026-04-30 | 버전: v1.1 (2026-04-30 실측 검증 반영)
> 기반 파일: score_engine.py, naver_place_stats.py, naver_scanner.py, multi_scanner.py, model_engine_v3.0.md
> 전제: BEP 20명 미달, 1인 개발, iwinv RAM 4GB

---

## § 0. 실측 검증 결과 (2026-04-30)

### 검증 대상

- place_id: `1752528839` (홍스튜디오, 창원 사진/영상 스튜디오)
- 검증 방법: curl + Googlebot User-Agent (Playwright 없이 가능한 범위)
- 검증 시각: 2026-04-30 UTC

### URL 6개 응답 결과

| URL | HTTP 상태 | Final URL | 비고 |
|-----|-----------|-----------|------|
| `m.place.naver.com/place/1752528839/home` | **200** | 동일 | 정상. 사업장명 포함 확인 |
| `m.place.naver.com/place/1752528839/information` | **200** | 동일 | 정상. 소개·영업시간 포함 |
| `m.place.naver.com/place/1752528839/feed` | **200** | 동일 | 정상 |
| `m.place.naver.com/restaurant/1752528839/home` | **200** | 동일 | 정상 (리다이렉트 없음, 동일 SPA 쉘 반환) |
| `map.naver.com/p/entry/place/1752528839` | **200** | `m.map.naver.com/appLink.naver?...` | 앱 딥링크로 우회 — curl 기준 사업장 데이터 미포함 |
| `pcmap.place.naver.com/place/1752528839/home` | **429** | 동일 | Rate limit (Googlebot도 차단) |
| `m.place.naver.com/place/1752528839/qna` | **200** (Googlebot) | 동일 | 정상. FAQ 데이터 일부 확인 |

### 핵심 발견

**발견 1 — `/restaurant/` 경로는 404가 아니라 200 정상 반환**

기존 코드 주석 "restaurant prefix는 업종 무관하게 라우팅 정상 작동 (실측)"이 2026-04-30 기준 여전히 사실이다.
`m.place.naver.com/restaurant/1752528839/home`은 HTTP 200을 반환하며, 내용은 `m.place.naver.com/place/1752528839/home`과 동일한 SPA 쉘(Next.js 번들)이다.
Playwright가 JS를 렌더링하면 양쪽 모두 동일한 콘텐츠를 보여줄 가능성이 높다.

단, 사용자가 제공한 신 URL 구조(`/place/{id}`)가 공식 표준이므로 코드를 `/place/`로 통일하는 것이 안전하다.
이유: 네이버가 향후 `/restaurant/` 경로를 deprecated하거나 리다이렉트로 전환할 경우 Playwright는 리다이렉트 후 최종 URL을 사용하는데, 그 시점에 `/place/`만 살아있으면 fallback이 실패한다.

**발견 2 — `m.place.naver.com/place/{id}/qna` 탭은 200 정상이나 실제 Q&A 콘텐츠가 없음**

홍스튜디오의 `/qna` 탭은 HTTP 200이나, 응답에서 실제 Q&A 항목(`"qna":"문의"` 1건만 존재)을 확인했다.
이 1건은 "문의" 버튼 레이블로, 실제 FAQ 질문/답변이 아니다.
현행 `_detect_faq()` 정규식 `(Q\.|Q:|문의\s*질문)`은 이 "문의" 레이블과 CSS의 `Q:` pseudo-selector에 오매칭될 수 있다.

**발견 3 — 톡톡 버튼은 존재하나 DOM 위치가 JavaScript 렌더링 후에만 노출**

`/qna` 탭 응답에서 `talk.naver.com/w461jw` URL이 포함된 것을 확인했다. 이는 홍스튜디오의 네이버 톡톡 채널이 실제로 연결되어 있음을 의미한다. 그러나 이 데이터는 SPA 번들의 JSON 내 이스케이프 문자열로 포함되어 있어, `inner_text("body")` 방식의 Playwright 텍스트 파싱으로는 접근 가능하지만 단순 curl로는 `w461jw` 형태로만 나타난다.

### DOM 구조 변경 정리

| 항목 | 현행 감지 방식 | 실측 결과 | 매칭 여부 |
|------|--------------|----------|----------|
| `is_smart_place` | 홈 텍스트에 "존재하지 않" 없으면 True | `/place/{id}/home` 200 + OG 사업장명 포함 | 정상 작동 예상 |
| `has_intro` | `업체\s*소개|소개` 헤더 + 50자 이상 | `/information` 탭에 `"소개"` 섹션 헤더 존재 확인 | 정상 작동 예상 |
| `has_recent_post` | `N일 전|N시간 전|방금` 패턴 | `/feed` 탭 200 정상 | 패턴 의존, JS 렌더링 후 실제 날짜 표시 여부는 Playwright 필요 |
| `has_faq` | `Q&A|자주\s*묻는\s*질문|FAQ` + `Q\.|Q:` | CSS `Q:` pseudo-selector가 오매칭 위험. 실제 Q&A 내용 없는 홍스튜디오에서 has_faq=True 오탐 가능 | **오탐 위험** |
| `has_talktalk` | `톡톡\s*문의|채팅\s*상담` (미구현) | `talk.naver.com/w461jw` JSON 내 포함 확인 | 구현 가능 |

### 신 FAQ(톡톡 메뉴) 실측 결과

홍스튜디오의 `/qna` 탭에는 `"qna":"문의"` 1건만 존재하며, 이는 Q&A 탭 진입 버튼 레이블이다.
톡톡 채널(`talk.naver.com/w461jw`)은 연결되어 있으나, 톡톡 채팅창 내 FAQ 메뉴 등록 여부는
curl/WebFetch로 확인 불가 (Playwright 채팅창 진입 필요).

---

---

## 1. 현 상태 진단

### 1.1 코드 기반 구조 진단

**score_engine.py 현황 (Track 1 가중치)**
```
keyword_gap_score        0.35  — 업종별 키워드 커버리지
review_quality           0.25  — 리뷰 수·평점·영수증 리뷰
smart_place_completeness 0.15  — FAQ·소식·소개글 (사용자 체크박스)
naver_exposure_confirmed 0.15  — 실제 네이버 AI 브리핑 노출 여부
kakao_completeness       0.10  — 카카오맵 완성도
```

**문제 1: 가중치가 추정 기반임**

`smart_place_completeness` 항목의 `has_faq` 점수(25점)는 실측 근거 없이 "FAQ가 AI 브리핑에 영향을 줄 것"이라는 가정에 기반한다.
현재 AI 브리핑에 노출된 사업장과 미노출 사업장 간 FAQ 보유 비율을 비교한 데이터가 전혀 없다.

**문제 2: naver_place_stats.py 수집 데이터 미반영**

`check_smart_place_completeness()`는 photo_count, has_menu, has_hours를 수집하지만,
score_engine.py의 `calc_smart_place_completeness()`는 이 데이터를 전혀 사용하지 않는다.
4개 항목(사진수·메뉴·영업시간·완성도 점수)이 수집만 되고 점수에 미반영 상태다.

**문제 3: 신 FAQ 미감지**

`naver_place_stats.py:_detect_faq_stats()`는 `/information` 탭과 `/qna` 탭의 텍스트를 파싱한다.
2024-02-15 개편으로 신 스마트플레이스 FAQ는 "톡톡파트너센터 → 채팅방 메뉴관리 → 톡톡 메뉴 관리"로
위치가 이동했다. 이 새 FAQ는 플레이스 페이지의 톡톡 버튼 → 채팅창 내부에 노출되므로
`/qna` 탭을 확인하는 현행 로직으로는 감지 불가능하다.

**문제 4: naver_scanner.py의 노출 조건 단순화**

`NaverAIBriefingScanner._check_single_page()`는 "사업장명이 AI 브리핑 텍스트에 있는가"만 확인한다.
어떤 조건(FAQ 등록 여부, 리뷰 키워드, 정보 완성도, 사진 수)이 노출에 기여했는지 추출하지 않으므로
인과관계 분석에 사용할 수 없다.

### 1.2 데이터 부재 현황

| 분석 항목 | 현재 데이터 | 필요 데이터 |
|-----------|------------|------------|
| FAQ 보유 vs AI 브리핑 노출 상관관계 | 없음 | scan_results × businesses 조인 분석 필요 |
| 사진 수 vs 노출 | naver_place_stats 수집 있으나 미저장 | scan_results.smart_place_completeness_result JSONB 저장 필요 |
| 리뷰 수 임계값 | 없음 | 업종별 노출 최소 리뷰 수 |
| 신 FAQ(톡톡) vs 구 FAQ(Q&A) 노출 기여 비교 | 없음 | 별도 플래그 필요 |

### 1.3 외부 공개 가이드 기반 기준점 정리

네이버 공식 발표(2025.08)와 업계 사례에서 확인된 AI 브리핑 노출 조건:

| 조건 | 출처 | 추정 중요도 |
|------|------|------------|
| 리뷰 수 (핵심 랭킹 요소) | 네이버 공식 2025-05 | 매우 높음 |
| 전화·예약·길찾기 실제 행동 데이터 | 네이버 공식 2025-05 | 높음 |
| 정보 완성도(영업시간·메뉴·사진) | 네이버 공식 2025-05 | 높음 |
| 키워드 풍부도(리뷰+소개글+FAQ) | 네이버 공식 2025-05 | 높음 |
| 소식 최신성(업데이트 빈도) | 업계 사례 다수 | 중간 |
| FAQ(Q&A) 등록 | 업계 사례 | 중간 — 직접 인용 경로 |
| 예약 시스템 연동 | 네이버 공식 | 높음(음식점·미용 업종) |

---

## 2. 실측 조사 시스템 (Part A)

### 2.1 데이터 수집 구조

**목표**: 스캔 1회 실행 시마다 "노출 여부 + 노출 조건 후보 속성"을 함께 기록하여 누적 후 상관관계 분석 가능하게 만든다.

#### 2.1.1 scan_results 테이블 컬럼 확장 (신규)

```sql
-- 미수집 항목 저장 (naver_place_stats 결과를 scan_results에 연결)
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_briefing_attributes JSONB;
  -- 저장 형태:
  -- {
  --   "photo_count": 12,
  --   "has_menu": true,
  --   "has_hours": true,
  --   "has_faq_legacy": true,     -- 구 Q&A 탭 (현행 감지)
  --   "has_faq_talktalk": null,   -- 신 톡톡 FAQ (감지 시 true/false, 미시도 시 null)
  --   "has_recent_post": true,
  --   "has_intro": true,
  --   "intro_char_count": 143,
  --   "faq_count": 3,
  --   "has_reservation": null,    -- 예약 시스템 연동 여부 (미구현, null)
  --   "review_count": 45,
  --   "avg_rating": 4.3,
  --   "naver_rank": 2,
  --   "in_briefing": true         -- 해당 스캔에서 AI 브리핑 실제 노출 여부
  -- }
```

**설계 원칙**: `naver_briefing_attributes`는 AI 브리핑 노출 상관관계 분석에 필요한 원시 속성 값이다.
기존 `smart_place_completeness_result`가 이미 JSONB 형태로 있지만 분석용 키 구조가 없으므로
새 컬럼으로 분리한다. 상관관계 분석 시 `in_briefing=true`인 행과 `false`인 행을 비교해
어느 속성이 노출 여부와 연관되는지 집계한다.

#### 2.1.2 ai_briefing_signals 테이블 (신규 — 선택적)

초기에는 `scan_results.naver_briefing_attributes` JSONB로 충분하다.
구독자 50명 이후, 업종별 충분한 샘플(업종당 30건+)이 쌓이면 전용 테이블로 이관한다.

```sql
-- Phase 3 이후 생성 (지금은 건너뜀)
CREATE TABLE IF NOT EXISTS ai_briefing_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES scan_results(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  category VARCHAR(50),
  in_briefing BOOLEAN NOT NULL,
  photo_count INT,
  has_menu BOOLEAN,
  has_hours BOOLEAN,
  has_faq_legacy BOOLEAN,
  has_faq_talktalk BOOLEAN,
  has_recent_post BOOLEAN,
  has_intro BOOLEAN,
  intro_char_count INT,
  faq_count INT,
  review_count INT,
  avg_rating FLOAT,
  naver_rank INT,
  scanned_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefing_signals_category ON ai_briefing_signals(category, in_briefing);
```

#### 2.1.3 스캔 실행 시 데이터 수집 연동 수정

`backend/routers/scan.py`의 `_run_full_scan()` 함수에서:

1. `naver_place_stats.check_smart_place_completeness(naver_place_url)` 결과를
2. `naver_scanner.py`의 `in_briefing` 결과와 함께
3. `naver_briefing_attributes` JSONB로 조합하여 scan_results에 저장

```python
# scan.py _run_full_scan() 내 추가 (의사 코드)
sp_check = {}
if biz.get("naver_place_url"):
    sp_check = await check_smart_place_completeness(biz["naver_place_url"])

naver_briefing_attributes = {
    "photo_count":       sp_check.get("photo_count"),
    "has_menu":          sp_check.get("has_menu"),
    "has_hours":         sp_check.get("has_hours"),
    "has_faq_legacy":    sp_check.get("has_faq"),
    "has_faq_talktalk":  sp_check.get("has_faq_talktalk"),  # 신규
    "has_recent_post":   sp_check.get("has_recent_post"),
    "has_intro":         sp_check.get("has_intro"),
    "intro_char_count":  sp_check.get("intro_char_count"),
    "faq_count":         sp_check.get("faq_count"),
    "review_count":      biz.get("review_count"),
    "avg_rating":        biz.get("avg_rating"),
    "naver_rank":        naver_data.get("my_rank"),
    "in_briefing":       naver_result.get("in_briefing", False),
}
```

### 2.2 샘플링 전략

**현황**: 스캔 이력이 극히 부족(구독자 0명 상태). 분석 가능한 N 확보가 선결 과제.

#### 전략 1 — 트라이얼 데이터 활용 (즉시)

`trial_scans` 테이블에는 비로그인 사용자의 스캔 결과가 누적된다.
트라이얼은 `naver_place_url`을 받지 않아 `check_smart_place_completeness()`를 실행하지 못하지만,
`naver_place_id`가 있는 경우 `NaverPlaceStatsService.fetch_stats()`로 기본 속성(리뷰수·평점)은 수집 가능하다.
트라이얼 스캔에도 `naver_scanner`의 `in_briefing` 여부가 반환되므로,
`review_count + avg_rating + in_briefing` 3개 항목의 상관관계는 트라이얼 N=30+ 이후 즉시 분석 가능하다.

**트라이얼 시 추가 수집 (즉시 구현 가능, Playwright 비용 0)**:
```python
# trial_scans 저장 시 추가
"briefing_signals": {
    "review_count": place_data.get("review_count"),
    "avg_rating": place_data.get("avg_rating"),
    "is_smart_place": place_data.get("is_smart_place"),
    "in_briefing": naver_result.get("in_briefing", False),
    "category": req.category,
}
```

#### 전략 2 — 경쟁사 스캔 데이터 활용 (1~3개월)

`detect_new_competitors()` 잡이 매주 경쟁사를 스캔한다.
경쟁사 스캔 결과에도 `in_briefing` 여부가 있으므로,
"AI 브리핑에 노출된 경쟁사"와 "미노출 경쟁사"를 비교하는 데이터가 자동 누적된다.

경쟁사는 `naver_place_url`이 없는 경우가 많지만, 카카오맵 API에서 수집한 `place_id`로
`NaverPlaceStatsService.fetch_stats()`를 실행해 리뷰수·평점을 수집할 수 있다.
이 방식으로 구독자 없이도 업종별 N=30+ 확보가 가능하다.

#### 전략 3 — 관리자 대시보드 수동 샘플 입력 (보조)

운영자가 직접 알려진 "AI 브리핑 잘 되는 가게"와 "안 되는 가게"를 trial_scans에 수동 입력하여
초기 ground truth 데이터셋을 만든다. 업종당 10건만 있어도 방향성 확인 가능.

### 2.3 분석 자동화

**분석 잡 조건**: `scan_results.naver_briefing_attributes` 행이 업종당 N=30 이상 쌓이면 실행.

```python
# backend/scheduler/jobs.py 추가
async def briefing_signal_analysis_job():
    """업종별 AI 브리핑 노출 상관관계 분석 — 매주 월요일 05:00 KST
    
    조건: 업종당 scan_results.naver_briefing_attributes 데이터 30건 이상
    출력: admin 대시보드 + logs
    """
    from db.supabase_client import get_client
    supabase = get_client()
    
    # 분석 쿼리 예시 (의사 코드)
    # SELECT category,
    #        avg(CASE WHEN in_briefing THEN review_count END) as briefing_avg_reviews,
    #        avg(CASE WHEN NOT in_briefing THEN review_count END) as no_briefing_avg_reviews,
    #        avg(CASE WHEN in_briefing THEN photo_count END) as briefing_avg_photos,
    # FROM scan_results
    # WHERE naver_briefing_attributes IS NOT NULL
    # GROUP BY category
    # HAVING COUNT(*) >= 30
    
    # 결과를 admin_stats 테이블 또는 로그에 저장
    # CLAUDE.md 및 model_engine_v3.0.md 업데이트 권고 알림 발송 (개발자 이메일)
```

**가중치 재조정 정책**: 자동으로 가중치를 바꾸지 않는다. 분석 결과를 이메일로 개발자에게 전달하고,
개발자가 검토 후 `score_engine.py`의 `NAVER_TRACK_WEIGHTS`를 수동 업데이트한다.
자동 가중치 변경은 사용자가 이해 불가능한 점수 급변을 유발한다.

### 2.4 Cold Start 대응

**0~3개월 (지금)**: 외부 공개 가이드(§1.3)와 네이버 공식 발표 기반 임시 가중치 사용.
현행 `score_engine.py`의 가중치를 §4.1에서 조정하는 방향으로 개선하되,
점수 급변을 막기 위해 한 번에 10% 이상 변경하지 않는다.

**3~6개월 (트라이얼 N=30+ 확보 후)**: 리뷰 수와 AI 브리핑 노출 상관관계 분석 → review_quality 가중치 조정.

**6개월+ (구독자 확보 후)**: 업종별 full scan 데이터 30건+ → 업종별 세부 가중치 조정.

---

## 3. 신 FAQ 적용 (Part B)

### 3.1 구 FAQ vs 신 FAQ 비교

| 항목 | 구 FAQ (Q&A 탭) | 신 FAQ (톡톡 메뉴관리) |
|------|----------------|----------------------|
| 위치 | 스마트플레이스 → Q&A 탭 | 톡톡파트너센터 → 채팅방 메뉴관리 |
| 노출 위치 | 플레이스 페이지 Q&A 섹션 | 플레이스 → 톡톡 버튼 → 채팅창 내 메뉴 |
| 개편일 | — | 2024-02-15 |
| AI 브리핑 인용 가능성 | 있음 (텍스트 직접 노출) | 추정 있음 (네이버 HyperCLOVA가 톡톡 대화 데이터 학습 가능) |
| 현행 감지 여부 | 감지됨 (`_detect_faq_stats`) | 감지 불가 |

**중요 불확실성**: 신 FAQ(톡톡 메뉴관리)가 AI 브리핑에 실제로 인용되는지 현재 공식 확인 불가.
구 Q&A의 경우 플레이스 페이지에 텍스트로 직접 노출되므로 HyperCLOVA가 크롤링·인용하기 쉽다.
신 FAQ는 채팅창 내부에만 노출되어 크롤링 경로가 불명확하다.
따라서 신 FAQ는 "사용자 경험 개선 + 톡톡 전환율"에 기여 가능성 위주로 안내한다.

### 3.2 감지 로직 재작성 안 (v1.1 실측 반영)

#### URL 핫픽스 (Phase 0 — 즉시)

`/restaurant/` 경로가 현재 200으로 동작하더라도, 공식 표준인 `/place/`로 통일한다.
네이버가 향후 `/restaurant/` 경로를 deprecated할 경우를 대비한 선제적 수정이다.

**`smart_place_auto_check.py:115`**
```diff
- base_url = f"https://m.place.naver.com/restaurant/{naver_place_id}"
- # 음식점 외 업종도 동일 도메인 — restaurant prefix는 라우팅에 영향 없음 (실측)
+ base_url = f"https://m.place.naver.com/place/{naver_place_id}"
+ # 2026-04-30 실측: /place/ 경로가 공식 표준. /restaurant/도 현재 200이나 deprecated 위험.
```

**`naver_place_stats.py:173, 177`**
```diff
  m = re.search(r"map\.naver\.com/p/entry/place/(\d+)", url)
  if m:
-     return f"https://m.place.naver.com/restaurant/{m.group(1)}"
+     return f"https://m.place.naver.com/place/{m.group(1)}"
  m = re.search(r"place\.naver\.com/[^/]+/(\d+)", url)
  if m:
-     return f"https://m.place.naver.com/restaurant/{m.group(1)}"
+     return f"https://m.place.naver.com/place/{m.group(1)}"
```

**Fallback 전략**: `/place/` 경로 홈 탭 로드 실패 시 `/restaurant/`로 재시도하는 fallback을 추가한다.
향후 어느 쪽이 살아있든 동작하도록 보장한다.

```python
# smart_place_auto_check.py _run_check() 내 홈 탭 로드 부분
PRIMARY_URL = f"https://m.place.naver.com/place/{naver_place_id}"
FALLBACK_URL = f"https://m.place.naver.com/restaurant/{naver_place_id}"

for base_url in (PRIMARY_URL, FALLBACK_URL):
    try:
        await page.goto(f"{base_url}/home", timeout=_PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        home_text = (await page.inner_text("body"))[:5000] or ""
        if home_text and not re.search(r"(존재하지 않|삭제|찾을 수 없|페이지를 찾을 수 없)", home_text):
            results["is_smart_place"] = True
            break  # 성공 시 base_url 확정, fallback 불필요
    except Exception:
        if base_url == FALLBACK_URL:
            raise  # 두 경로 모두 실패 시 상위로 raise
        _logger.info(f"smart_place /place/ failed, trying /restaurant/ fallback [{naver_place_id}]")
        continue
```

#### `_detect_faq()` 정규식 재작성 (오탐 방지)

실측 결과: CSS `Q:` pseudo-selector (`Q:before`, `Q:hover` 등)가 현행 `has_question` 정규식 `Q\.|Q:`와 오매칭된다.
홍스튜디오처럼 실제 Q&A가 없는 가게에서 `has_faq=True` 오탐이 발생할 수 있다.

**현행 정규식 문제:**
```python
has_question = bool(re.search(r"(Q\.|Q:|문의\s*질문)", info_body))
# 오탐: "Q:before", "Q:hover", "Q:last-child" 등 CSS 패턴과 매칭
```

**재작성 안:**
```python
def _detect_faq(info_body: str) -> bool:
    """정보 탭/Q&A 탭 본문에서 FAQ 항목 1개 이상 존재 여부.
    
    변경 이력:
    - v1.1 (2026-04-30): CSS Q: pseudo-selector 오탐 방지
      inner_text() 기반이므로 CSS는 포함되지 않으나, 번들 JS 내 CSS 문자열이
      inner_text에 포함될 수 있음. 더 엄격한 패턴으로 교체.
    """
    if not info_body:
        return False
    if re.search(r"(등록된 (Q&A|질문|문의)가 없|아직 등록된 (Q&A|질문)이 없)", info_body):
        return False
    
    # FAQ 섹션 헤더 존재 여부
    has_section = bool(re.search(r"(자주\s*묻는\s*질문|FAQ)", info_body, re.I))
    # Q&A 실제 질문 표식 — CSS pseudo-selector 오탐 방지를 위해 공백/줄바꿈 앞 Q. 만 허용
    # "Q. 예약은 어떻게..." 형태만 인정
    has_question = bool(re.search(r"Q\.\s+\S", info_body))
    
    # 구 Q&A 탭 기준: "Q&A" 텍스트 + 실제 질문(Q. 형식)
    if has_section and has_question:
        return True
    
    # 추가 패턴: "Q&A" 탭 내 질문 수 표시 (예: "Q&A 3")
    has_qna_count = bool(re.search(r"Q\s*&\s*A\s+[1-9]", info_body))
    return has_qna_count
```

#### 원인 미지정 오탐 확인 방법 (Playwright 실행 시)

```python
# _run_check() 내 디버그 로그 추가 (개발 기간만)
qna_text_sample = qna_text[:500].replace('\n', ' ')
_logger.info(f"smart_place qna_sample [{naver_place_id}]: {qna_text_sample!r}")
_logger.info(f"smart_place has_faq={results['has_faq']} detect_result [{naver_place_id}]")
```

### 3.2 (구) 감지 방식 비교 및 권장안 (이하 기존 내용 유지)

#### 옵션 A — 간접 감지 (톡톡 연결 여부로 대리 확인)

플레이스 홈 탭에서 "톡톡 문의" 버튼 존재 여부를 확인한다.
버튼이 있으면 `has_talktalk=True`로 기록하고, 메뉴 등록 여부는 사용자 체크박스로 확인한다.

```python
# naver_place_stats.py _check_completeness() 내 추가
has_talktalk = bool(
    re.search(r"톡톡\s*문의|채팅\s*상담|톡톡\s*하기|네이버\s*톡톡", body)
)
```

장점: 구현 즉시 가능, Playwright 추가 비용 없음.
단점: 톡톡 버튼 있다고 FAQ 메뉴가 등록된 것은 아님.

#### 옵션 B — 직접 상호작용 (채팅창 진입 후 메뉴 감지)

Playwright로 플레이스 페이지의 톡톡 버튼을 클릭 → 채팅창 팝업 → 메뉴 존재 여부 파싱.

장점: 정확한 신 FAQ 감지 가능.
단점: 클릭 인터랙션 → 팝업 감지가 불안정함. 네이버 봇 감지 위험 증가. RAM 추가 사용.
iwinv RAM 4GB 서버에서 현재도 Playwright Semaphore(1)로 제한 중인 상태에서 추가 부하 우려.

**권장안: 옵션 A (즉시) + 옵션 B는 Phase 3 이후 판단**

1단계로 톡톡 연결 여부를 `has_talktalk` 플래그로 수집하고,
실제로 신 FAQ가 등록되었는지는 사용자 체크박스로 확인한다.
구독자 50명 이후 RAM 여유가 생기면 옵션 B 직접 감지를 검토한다.

#### 권장 구현 코드 추가 (naver_place_stats.py)

```python
# _check_completeness() 홈 탭 파싱 섹션에 추가
has_talktalk = bool(
    re.search(r"톡톡\s*(문의|하기|상담)|네이버\s*톡톡|채팅\s*상담", body)
)
has_faq_talktalk = None  # 직접 감지 미구현 — 사용자 체크박스로 대체

# 반환값에 추가
return {
    ...기존 항목...,
    "has_talktalk": has_talktalk,
    "has_faq_talktalk": has_faq_talktalk,
}
```

### 3.3 점수 반영 설계

**원칙**: 구 FAQ와 신 FAQ는 서로 다른 노출 채널이므로 둘 다 있으면 가산.
단, 신 FAQ의 AI 브리핑 기여가 검증되지 않았으므로 초기에는 보수적으로 설정.

```python
# score_engine.py calc_smart_place_completeness() 수정

def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float:
    """
    스마트플레이스 완성도 점수 (0~100).
    
    FAQ 점수 구조 개정:
    - has_faq_legacy (구 Q&A): 20점 (기존 25→20, AI 브리핑 직접 인용 경로)
    - has_faq_talktalk (신 톡톡): 10점 (불확실, 보수적 설정)
    - 둘 다 있음: 30점 (기존 25점 유지, 상한 동일)
    - has_talktalk만 있음 (메뉴 미등록): 3점 (톡톡 연결 확인만)
    
    나머지 항목 조정:
    - has_recent_post: 15점 (유지)
    - has_intro: 5점 (유지)
    - rank_score: 최대 30점 (유지)
    - is_smart_place: 20점 (25→20, FAQ 재배분에 따른 조정)
    """
    is_smart_place  = bool(...)
    has_faq_legacy  = bool(biz.get("has_faq"))        # 구 Q&A 탭
    has_faq_talktalk = biz.get("has_faq_talktalk")    # 신 톡톡 FAQ (None/True/False)
    has_talktalk    = bool(biz.get("has_talktalk"))    # 톡톡 연결 여부만
    has_recent_post = bool(biz.get("has_recent_post"))
    has_intro       = bool(biz.get("has_intro"))
    
    # FAQ 점수: 구/신 FAQ 중복 허용, 최대 30점
    faq_score = 0
    if has_faq_legacy:
        faq_score += 20
    if has_faq_talktalk:
        faq_score += 10
    elif has_talktalk and not has_faq_legacy:
        faq_score += 3  # 톡톡 연결만 확인된 경우 최소 가산
    faq_score = min(faq_score, 30)
    
    return min(100, (
        (20 if is_smart_place else 0) +
        rank_score +
        faq_score +
        (15 if has_recent_post else 0) +
        (5 if has_intro else 0)
    ))
```

**플랜별 체크박스 노출**:
- 기존: `has_faq` 1개 체크박스
- 변경: `has_faq (구 Q&A)` + `has_faq_talktalk (신 톡톡 FAQ)` 2개 분리

### 3.4 사용자 안내 UX

**스캔 등록 폼 (RegisterBusinessForm.tsx) 체크박스 변경**:

```
현행:
  [ ] Q&A(FAQ) 탭에 질문을 3개 이상 등록했어요 (+25점)

변경 후:
  [ ] 스마트플레이스 Q&A 탭에 질문 3개 이상 등록 (+20점)
       ↳ 스마트플레이스 관리 → 비즈니스 정보 → Q&A 탭
       
  [ ] 네이버 톡톡 채팅 메뉴에 FAQ 등록 (+10점)  [신규]
       ↳ 톡톡파트너센터(talk.naver.com) → 채팅방 메뉴관리 → 메뉴 등록
       ↳ "2024년 2월 개편된 새 FAQ입니다. 등록 방법 안내 →"
       
  [ ] 네이버 톡톡 버튼 플레이스에 연결됨 (+3점)  [간접 확인]
```

**가이드 생성 (guide_generator.py) 신 FAQ 등록 절차 안내 추가**:

```
신 스마트플레이스 FAQ 등록 방법 (2024-02-15 기준):
1. talk.naver.com 접속 (네이버 톡톡파트너센터)
2. 좌측 메뉴 "채팅방 메뉴관리" 클릭
3. "톡톡 메뉴 관리" → "메뉴 추가"
4. 자주 묻는 질문 유형으로 메뉴 구성:
   - 영업시간 안내
   - 예약 방법
   - 주차 안내
   - 주요 서비스/메뉴
5. 저장 후 플레이스 톡톡 버튼으로 확인

주의: 이 FAQ는 플레이스 페이지 → 채팅창에서 노출됩니다.
      기존 스마트플레이스 Q&A 탭(브리핑 직접 인용)과 별도 관리가 필요합니다.
```

### 3.5 기존 데이터 마이그레이션 처리

**문제**: 기존 사용자의 `has_faq=True`는 구 Q&A 기준이다. 신 FAQ 기준으로는 상태 불명.

**처리 방안**:

1. 기존 `has_faq` 컬럼을 `has_faq_legacy`로 의미 변경 (alias, 컬럼명 변경 없이 코드에서만 처리)
2. `has_faq_talktalk` BOOLEAN 컬럼을 businesses 테이블에 추가 (기본값 NULL = 미확인)
3. 기존 사용자에게 "신 FAQ 등록 여부" 체크박스를 대시보드 팝업으로 1회 안내

```sql
-- Supabase SQL Editor
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS has_faq_talktalk BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_talktalk BOOLEAN DEFAULT NULL;
```

**점수 영향**: 기존 `has_faq=True` 사용자는 `has_faq_legacy=True`가 되어 20점 유지(기존 25점 → 20점 감소 5점).
신 FAQ 추가 등록 시 +10점 회복 가능. 감점 5점에 대한 안내 문구 필요.

```
안내 문구 (대시보드 1회 팝업):
"2024년 네이버 스마트플레이스 FAQ가 개편되었습니다.
 기존 Q&A 탭 FAQ 점수가 25→20점으로 조정되었으나,
 새 톡톡 채팅 FAQ를 추가 등록하면 최대 30점으로 오히려 올라갑니다.
 [신 FAQ 등록 방법 보기]  [등록 완료 체크]"
```

---

## 4. 통합 모델 (Part C)

### 4.1 새 가중치 구조 (초기 임시값)

#### Track 1 가중치 조정 내역

| 항목 | 현행 | 변경 후 | 변경 이유 |
|------|------|---------|----------|
| keyword_gap_score | 0.35 | **0.30** | 네이버 공식: 정보 완성도·예약 행동이 리뷰보다 중요 반영 |
| review_quality | 0.25 | **0.30** | 네이버 공식 2025-05: 리뷰 수 핵심 랭킹 요소 확인 |
| smart_place_completeness | 0.15 | **0.20** | 미반영 항목(사진·메뉴·영업시간) 포함 확대 |
| naver_exposure_confirmed | 0.15 | **0.15** | 유지 |
| kakao_completeness | 0.10 | **0.05** | 카카오맵은 AI 브리핑과 직접 무관, 보조 지표로 축소 |

```python
# score_engine.py 수정
NAVER_TRACK_WEIGHTS: dict[str, float] = {
    "keyword_gap_score":        0.30,  # 0.35→0.30
    "review_quality":           0.30,  # 0.25→0.30 (네이버 공식 리뷰 수 핵심 반영)
    "smart_place_completeness": 0.20,  # 0.15→0.20 (사진·메뉴·영업시간 포함)
    "naver_exposure_confirmed": 0.15,  # 유지
    "kakao_completeness":       0.05,  # 0.10→0.05
}
```

#### smart_place_completeness 내부 점수 재설계

```python
# 현행 합산 가능 최대점 (초과 방지 min(100))
# 20(is_sp) + 30(rank) + 25(faq) + 15(post) + 5(intro) = 95
# 신규 최대점
# 20(is_sp) + 30(rank) + 30(faq: legacy20 + talktalk10) + 15(post) + 5(intro) + 10(photo) = 110 → min(100)

def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float:
    # ...기존 is_smart_place, rank_score 계산 동일...
    
    # FAQ (신/구 분리)
    has_faq_legacy   = bool(biz.get("has_faq"))
    has_faq_talktalk = biz.get("has_faq_talktalk")  # None = 미확인
    has_talktalk     = bool(biz.get("has_talktalk"))
    faq_score = 0
    if has_faq_legacy:    faq_score += 20
    if has_faq_talktalk:  faq_score += 10
    elif has_talktalk:    faq_score += 3
    
    # 사진 수 반영 (naver_place_stats 수집값 → 기존에 버려지던 데이터 활용)
    sp_check = biz.get("smart_place_check_result") or {}
    photo_count = sp_check.get("photo_count") or naver_data.get("photo_count") or 0
    photo_score = min(10, photo_count // 3)  # 3장당 1점, 최대 10점
    
    # 영업시간 반영 (미반영이었던 has_hours 추가)
    has_hours = bool(sp_check.get("has_hours") or biz.get("has_hours"))
    has_menu  = bool(sp_check.get("has_menu")  or biz.get("has_menu"))
    
    return min(100, (
        (20 if is_smart_place else 0) +
        rank_score +
        min(faq_score, 30) +
        (15 if has_recent_post else 0) +
        (5  if has_intro else 0) +
        (5  if has_hours else 0) +   # 신규: 영업시간 등록
        (5  if has_menu else 0) +    # 신규: 메뉴/서비스 등록
        photo_score                  # 신규: 사진 수
    ))
```

**요약**: 기존에 수집하고 버려지던 `photo_count`, `has_menu`, `has_hours` 3개 항목을 점수에 연결.
추가 Playwright 비용 없이 기존 `check_smart_place_completeness()` 결과를 재활용.

#### Track 2 가중치 — 현행 유지 (변경 없음)

Track 2는 현행 구조(multi_ai_exposure 40%, schema_seo 30%, online_mentions 20%, google_presence 10%)를 유지한다.
AI 브리핑 노출 조건 재설계의 핵심은 Track 1이므로 Track 2는 별도 이슈.

### 4.2 자동 재조정 메커니즘

**단계별 조정 정책**:

| 단계 | 조건 | 조정 방법 |
|------|------|----------|
| Cold Start (지금) | 데이터 없음 | 외부 가이드 기반 초기값 사용 (§4.1) |
| 분석 가능 | 트라이얼 포함 N=30/업종 | `briefing_signal_analysis_job` 결과 → 개발자 이메일 → 수동 조정 |
| 검증 단계 | 구독자 50명 이후 | 조정 전/후 track1_score 분포 비교 |
| 자동화 | 구독자 100명 이후 | admin 대시보드에 "가중치 재조정 추천" 패널 (수동 승인 방식) |

**자동 가중치 변경 금지 이유**: 구독 서비스에서 점수가 이유 없이 변동되면 사용자 신뢰 손실.
가중치 변경은 반드시 변경 이유를 사용자에게 공지하고 전환 기간을 두어야 한다.

### 4.3 DB 변경 범위

```sql
-- 1. scan_results 테이블
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS naver_briefing_attributes JSONB;

-- 2. businesses 테이블
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS has_faq_talktalk BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_talktalk BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_hours BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS has_menu BOOLEAN DEFAULT NULL;

-- 3. 인덱스 (분석 쿼리용)
CREATE INDEX IF NOT EXISTS idx_scan_results_briefing_category
  ON scan_results USING GIN(naver_briefing_attributes)
  WHERE naver_briefing_attributes IS NOT NULL;
```

### 4.4 프론트엔드 영향 범위

**수정 파일**:
- `frontend/components/dashboard/RegisterBusinessForm.tsx` — FAQ 체크박스 2개로 분리
- `frontend/app/(dashboard)/dashboard/page.tsx` — smart_place_completeness 점수 항목 표시 업데이트
- `frontend/types/index.ts` — `has_faq_talktalk`, `has_talktalk`, `has_hours`, `has_menu` 타입 추가

**신규 파일**:
- `frontend/components/dashboard/FaqMigrationBanner.tsx` — 기존 FAQ 사용자 대상 1회 안내 팝업

**영향 없는 파일**:
- `DualTrackCard.tsx`, `UnifiedScoreHero.tsx` — track 점수 숫자만 표시, 내부 계산 변경 무관
- `guide/GuideClient.tsx` — 가이드 텍스트만 변경 (code 변경 없음)

---

## 5. 구현 로드맵 (Part D) — v1.1 재정렬

### Phase 0 — 오늘 (핫픽스, 약 30분)

URL 버그 핫픽스. 기능 변경 없음. 위험도 매우 낮음.

| # | 작업 | 파일 | 라인 |
|---|------|------|------|
| 1 | `/restaurant/` → `/place/` 교체 | `smart_place_auto_check.py` | L115 |
| 2 | `/restaurant/` → `/place/` 교체 (2곳) | `naver_place_stats.py` | L173, L177 |
| 3 | `/place/` 실패 시 `/restaurant/` fallback 추가 | `smart_place_auto_check.py` | L139 근방 |
| 4 | `_detect_faq()` CSS 오탐 방지 정규식 교체 | `smart_place_auto_check.py` | L276 |

배포 후 `/health` 200 확인. Playwright 스캔 1회 수동 실행으로 `is_smart_place=True`, `has_faq` 정상 여부 확인.

### Phase 1 — 즉시 (1주일, 약 8~12시간)

**목표**: 데이터 수집 파이프라인 구축 + 신 FAQ 감지 추가

| # | 작업 | 파일 | 공수 |
|---|------|------|------|
| 1 | `naver_briefing_attributes` 컬럼 추가 | Supabase SQL | 30분 |
| 2 | `has_faq_talktalk`, `has_talktalk`, `has_hours`, `has_menu` 컬럼 추가 | Supabase SQL | 30분 |
| 3 | `_check_completeness()`에 `has_talktalk` 감지 추가 | `naver_place_stats.py` | 1시간 |
| 4 | `_run_full_scan()`에서 `naver_briefing_attributes` 저장 | `routers/scan.py` | 1.5시간 |
| 5 | `calc_smart_place_completeness()`에 photo/menu/hours 반영 | `score_engine.py` | 1시간 |
| 6 | FAQ 점수 구조 신/구 분리 (20+10 구조) | `score_engine.py` | 1시간 |
| 7 | Track 1 가중치 조정 (0.35→0.30 외) | `score_engine.py` | 30분 |
| 8 | RegisterBusinessForm FAQ 체크박스 2개 분리 | `RegisterBusinessForm.tsx` | 2시간 |
| 9 | businesses 테이블 신 컬럼 타입 추가 | `frontend/types/index.ts` | 30분 |
| 10 | 트라이얼 스캔에 briefing_signals 추가 수집 | `routers/scan.py` | 1시간 |

**의존성**: 1→4→6→7 순서 필수. 나머지는 병렬 가능.

**Phase 1 비용 영향**:
- Playwright 추가 호출 없음 (기존 `_check_completeness()` 내에 정규식 추가만)
- API 추가 비용 없음
- 월 추가 비용: 0원

### Phase 2 — 1개월 내 (약 10~15시간)

**목표**: 분석 자동화 기초 + 사용자 안내 UX

| # | 작업 | 파일 | 공수 |
|---|------|------|------|
| 1 | `briefing_signal_analysis_job` 스케줄러 추가 | `scheduler/jobs.py` | 3시간 |
| 2 | 분석 결과 개발자 이메일 발송 | `email_sender.py` | 1시간 |
| 3 | `FaqMigrationBanner.tsx` — 기존 사용자 안내 팝업 | 신규 컴포넌트 | 2시간 |
| 4 | 가이드 생성 시 신 FAQ 등록 방법 포함 | `guide_generator.py` | 1시간 |
| 5 | 경쟁사 스캔 시 `naver_briefing_attributes` 수집 | `scheduler/jobs.py` | 2시간 |
| 6 | smart_place_completeness 점수 breakdown UI 상세화 | `dashboard/page.tsx` | 2시간 |
| 7 | 신 FAQ 설정 외부 링크 연결 | `RegisterBusinessForm.tsx` | 30분 |

**Phase 2 비용 영향**:
- 경쟁사 스캔 시 `NaverPlaceStatsService.fetch_stats()` 추가 → Playwright 호출 증가
- 경쟁사 1개당 약 30초, 1인당 평균 경쟁사 3개 × 구독자 20명 = 주당 60분 추가 Playwright 실행
- iwinv RAM 4GB에서 Semaphore(1) 유지 시 큐잉 방식으로 처리 가능, OOM 위험 없음
- 월 추가 비용: ~0원 (iwinv 고정 비용, API 추가 없음)

### Phase 3 — 3~6개월 (데이터 누적 후)

**조건**: 트라이얼 포함 업종당 N=30+ 스캔 데이터 확보 후 실행

| # | 작업 | 공수 |
|---|------|------|
| 1 | `briefing_signal_analysis_job` 결과 기반 가중치 1차 수동 조정 | 4시간 |
| 2 | 업종별 AI 브리핑 노출 조건 차이 문서화 (model_engine_v3.0.md 업데이트) | 2시간 |
| 3 | 신 FAQ 직접 감지 (Playwright 채팅창 진입) — RAM 여유 확인 후 결정 | 6시간 |
| 4 | admin 대시보드에 "가중치 재조정 추천" 패널 | 8시간 |
| 5 | 업종별 AI 브리핑 노출 평균 리뷰 수 임계값 → trial UI에 "이 업종은 리뷰 N개부터 노출" 표시 | 4시간 |

**Phase 3 비용 영향**:
- 신 FAQ 직접 감지: Playwright 1회 추가 → 스캔당 ~30초, RAM 300~500MB 추가
- 구독자 50명 기준 월 스캔 횟수 × 30초 → 서버 처리 큐 증가 주의
- 옵션 B 직접 감지 채택 전 RAM 여유분 확인 필수

---

## 6. 위험 요소 및 대응

### 6.1 네이버 DOM 변경 (위험도: 높음)

**위험**: 네이버 AI 브리핑 셀렉터가 업데이트되면 `naver_scanner.py`의 `BRIEFING_SELECTORS`가 무효화된다.
현재도 15개 셀렉터를 우선순위순으로 나열하고 있으나, 네이버 대규모 UI 개편 시 전부 무효화 가능.

**대응**:
- `in_briefing=False`가 급증하면 Alert → 셀렉터 즉시 업데이트
- `naver_scanner.py`에 `captcha_detected` 감지 이미 구현됨
- 분석 잡에서 `in_briefing` 비율이 이전 주 대비 20%+ 하락 시 개발자 알림

### 6.2 신 FAQ(톡톡 메뉴관리) 효과 불확실성 (위험도: 중간)

**위험**: 신 FAQ가 AI 브리핑에 실제로 기여하지 않을 수 있다.
소상공인에게 "신 FAQ 등록하면 AI 브리핑에 더 잘 나온다"고 안내했다가 효과가 없으면 신뢰 손실.

**대응**:
- 안내 문구를 "AI 브리핑 노출 가능성 향상"이 아닌 "고객 채팅 응대 편의성 향상"으로 우선 포지셔닝
- 톡톡 FAQ 보유 사업장의 `in_briefing` 비율을 수집 후 3개월 내 효과 검증
- 검증 전까지 톡톡 FAQ 점수(10점)를 Q&A 점수(20점)보다 낮게 유지

### 6.3 가중치 변경 시 기존 사용자 점수 급변 (위험도: 중간)

**위험**: Track 1 가중치를 `review_quality 0.25→0.30`으로 올리면 리뷰가 적은 사용자 점수 하락.
신규 가입자가 "점수가 내렸다"며 이탈할 수 있음.

**대응**:
- 가중치 변경 시 기존 사용자에게 "모델 업데이트 공지" 이메일/알림 발송
- 변경 후 30일간 구/신 점수 동시 표시 (기존 점수 기준선 유지)
- BEP 20명 달성 전까지 가중치 변경은 Phase 1의 소폭 조정(±5%)에 그침

### 6.4 Playwright RAM 부족 (위험도: 중간)

**위험**: Phase 2에서 경쟁사 스캔에 `fetch_stats()` 추가 시 Playwright 동시 실행 횟수 증가.
iwinv RAM 4GB에서 Playwright 2개 동시 실행(300~500MB × 2)은 이미 한계.

**대응**:
- 경쟁사 `fetch_stats()` 호출에 기존 `PLAYWRIGHT_SEMAPHORE(1)` 적용 의무화
- 스케줄러 잡에서 경쟁사 처리 시 1개씩 순차 실행
- RAM 사용량 모니터링: `pm2 list` + `/proc/meminfo` 주기적 확인

### 6.5 Cold Start 기간 오진단 (위험도: 낮음)

**위험**: 데이터 없는 기간에 임시 가중치로 "FAQ가 30% 중요하다"고 보여줬지만
실측 후 "리뷰 수가 훨씬 더 중요했다"로 나오면 기존 안내가 오진단이 됨.

**대응**:
- Cold Start 기간 점수에 `(추정값)` 배지 표시 (기존 `is_keyword_estimated` 패턴 확장)
- "현재 가중치는 네이버 공식 가이드 기반 추정값으로, 실사용 데이터 누적 후 자동 개선됩니다" 안내
- 정기 업데이트 로그를 CLAUDE.md와 사용자 공지에 반영

---

## 7. 검증 데이터 부록 (신규 — v1.1)

### 7.1 URL 응답 결과 표

| URL (place_id=1752528839) | HTTP | 비고 |
|--------------------------|------|------|
| `/place/{id}/home` | 200 | 정상. OG 태그에 홍스튜디오 사업장명 포함 |
| `/place/{id}/information` | 200 | 정상. 소개·영업시간 i18n 키 확인 |
| `/place/{id}/feed` | 200 | 정상 |
| `/place/{id}/qna` | 200 (Googlebot) | FAQ 없음. `"qna":"문의"` 레이블 1건만 존재 |
| `/restaurant/{id}/home` | 200 | 동일 SPA 쉘. 리다이렉트 없음 |
| `map.naver.com/p/entry/place/{id}` | 200 | 앱 딥링크로 우회. 사업장 HTML 미포함 |
| `pcmap.place.naver.com/place/{id}/home` | 429 | Rate limit |

### 7.2 매칭된/매칭 안 된 정규식 목록

**매칭 안 됨 (오탐 가능):**

| 정규식 | 문제 원인 | 수정 방향 |
|--------|---------|----------|
| `Q\.|Q:` (has_question) | CSS `Q:before`, `Q:hover`, `Q:last-child` 등 pseudo-selector 문자열 오매칭 | `Q\.\s+\S` 로 엄격화 (Q. 뒤에 공백+비공백 필수) |
| `Q\s*&\s*A` (has_section) | SPA 번들에 UI 레이블로 내장됨. 실제 Q&A 없어도 매칭될 수 있음 | 단독으로 사용 금지, `Q\s*&\s*A\s+[1-9]` 형태로 개수 포함 시만 허용 |

**정상 매칭:**

| 정규식 | 대상 텍스트 | 결과 |
|--------|-----------|------|
| `업체\s*소개\|소개` | `place_section_header_title` 클래스 내 "소개" 텍스트 | 정상 감지 예상 |
| `존재하지 않\|삭제\|찾을 수 없` | 유효한 place_id이므로 미노출 | 정상 (미매칭 = is_smart_place=True) |
| `톡톡\s*문의\|채팅\s*상담\|네이버\s*톡톡` | JSON 내 `talk.naver.com/w461jw` 포함 확인 | inner_text 후 "톡톡" 텍스트 추출 가능 예상 |

### 7.3 새 DOM 패턴 후보

**톡톡 버튼 감지 (실측 기반):**
- `/qna` 탭 응답 JSON에 `talk.naver.com/{채널ID}` URL 포함 확인
- Playwright `inner_text()` 후 "톡톡 문의" 또는 "채팅" 텍스트가 버튼 레이블로 포함될 가능성 높음
- 권장 패턴: `re.search(r"톡톡\s*(문의|하기|상담)|채팅\s*상담", body)` — 기존 § 3.2 옵션 A와 동일, 실측으로 유효성 확인

**소개글 50자 기준 재확인:**
- `place_section_header` → `place_section_content` 구조 유지 확인
- `inner_text("body")` 파싱 시 CSS 클래스명은 제거되고 텍스트만 남으므로, 현행 `_detect_intro()` 로직은 정상 동작 예상

**영업시간 감지 (미구현, 추가 권장):**
- `/information` 탭에 `"opening_hours"` i18n 키와 `"운영시간"` 키 모두 존재 확인
- Playwright inner_text 후 `영업시간|운영시간` 패턴으로 `has_hours` 감지 가능

---

## 부록 A: 구현 체크리스트

### Phase 1 완료 기준
- [ ] `naver_briefing_attributes` 컬럼 Supabase 생성 확인
- [ ] `has_faq_talktalk`, `has_talktalk`, `has_hours`, `has_menu` 컬럼 생성 확인
- [ ] `_check_completeness()` 반환값에 `has_talktalk` 포함 확인
- [ ] `_run_full_scan()` 저장 시 `naver_briefing_attributes` JSONB 포함 확인
- [ ] `calc_smart_place_completeness()` photo/menu/hours 반영 확인
- [ ] FAQ 점수 legacy(20) + talktalk(10) 분리 확인
- [ ] Track 1 가중치 합계 = 1.0 확인 (0.30+0.30+0.20+0.15+0.05)
- [ ] RegisterBusinessForm FAQ 체크박스 2개 노출 확인
- [ ] 트라이얼 스캔 결과에 `briefing_signals` 저장 확인
- [ ] pm2 restart 후 /health 200 확인

### 월별 검토 항목
- [ ] `naver_briefing_attributes`에 데이터가 주당 N건 쌓이고 있는가?
- [ ] `in_briefing=True` 비율이 전주 대비 이상 변동 없는가?
- [ ] 신 FAQ 체크박스 선택률은 얼마인가? (사용자가 실제로 등록하고 있는가?)

---

*문서 버전: v1.0 | 작성: 2026-04-30*
*다음 업데이트 기준: Phase 1 구현 완료 후 + 트라이얼 N=30 달성 후*
*참조: docs/model_engine_v3.0.md | backend/services/score_engine.py | backend/services/naver_place_stats.py*
