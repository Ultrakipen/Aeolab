# 네이버 AI / GPT 노출 기준 작업 표준 v1.0

> **모든 네이버·GPT 관련 기능 작업 전 반드시 읽을 것.**
> 스캔·점수·콘텐츠 생성·UI·갭 분석·가이드 생성·키워드 분류 전 영역에 적용.
> 최종 업데이트: 2026-05-04

---

## 1. 업종 분류 — 단일 진실 (code: score_engine.py:25)

| 분류 | 업종 | 네이버 AI 브리핑 | 비고 |
|------|------|----------------|------|
| **ACTIVE** | restaurant, cafe, bakery, bar, accommodation | 플레이스형 노출 대상 ✅ | |
| **LIKELY** | beauty, nail, pet, fitness, yoga, pharmacy | 2026 AI탭 베타 (네이버플러스 우선) | 확대 예정 |
| **INACTIVE** | 그 외 (medical, legal, education 등) | 비대상 → 글로벌 AI 집중 | |

**프랜차이즈 제외**: ACTIVE 업종이라도 `is_franchise=True`면 INACTIVE 처리 (네이버 공식 정책).
사용 함수: `get_briefing_eligibility(category, is_franchise)` — `briefing_engine.py`

**단일 소스 동기화 의무**:
- Backend: `briefing_engine.BRIEFING_ACTIVE_CATEGORIES`
- Frontend: `BRIEFING_ACTIVE` (RegisterBusinessForm.tsx, dashboard/page.tsx)
- 어느 한 쪽 변경 시 **반드시 양쪽 동시 수정**

---

## 2. 네이버 AI 브리핑 노출 알고리즘

```
정보형 검색 → 콘텐츠 발굴(네이버 자체 서비스 우선) → HyperCLOVA X 추출
```

### C-rank 4축 (랭킹 결정)
| 축 | 내용 | 코드 연결 |
|----|------|----------|
| **Context** | 업종 핵심 키워드 주제 집중도 | `keyword_taxonomy.py` 그룹별 weight |
| **Content** | 정보 충실성·독창성 | `briefing_engine.simulate_ai_tab_answer()` |
| **Chain** | 리뷰 답변·예약·전화·길찾기 상호작용 | `calc_review_quality()` |
| **Creator** | 운영 기간·일관성·스마트플레이스 완성도 | `calc_smart_place_completeness()` |

### D.I.A. 5요소 (콘텐츠 평가)
1. **주제 적합도** — 검색어-콘텐츠 연관성
2. **경험 정보** — 실제 방문·사용 경험 서술
3. **정보 충실성** — 영업시간·메뉴·가격 구체적 기재
4. **독창성** — 템플릿 복붙 금지, LSI 연관키워드 자연 배치
5. **적시성** — `[YYYY년 M월 업데이트]` 날짜 표기 필수

---

## 3. 사장님 직접 관리 4경로 (2026-05 기준)

| 경로 | 스마트플레이스 위치 | Playwright 경로 | AI 브리핑 영향 |
|------|-------------------|-----------------|----------------|
| **A. 리뷰 답변** | 스마트플레이스 → 리뷰 관리 | 리뷰 탭 | 키워드 포함 답변 → 인용 후보 신호 |
| **B. 소개글 Q&A** | 업체정보 → 소개글 하단 | `/profile` | 사장님 직접 인용 후보 |
| **C. 소식(공지)** | 소식 탭 | 소식 탭 | 최신성 점수 + 키워드 커버리지 |
| **D. 소개글 본문** | 업체정보 → 소개글 | `/profile` | 영구적 키워드 기반 데이터 |

> **폐기 확인 (2026-05-01)**: 스마트플레이스 Q&A 탭(`/qna`) 완전 폐기.
> `/qna` URL 사용 금지 → `/profile` 대체. `_detect_faq()` 호출 금지.

---

## 4. 최적 콘텐츠 구조 (경로별)

### 소개글 구조 (D.I.A. 최적화)
```
[도입 1-2문장]
{업종 핵심 키워드}를 찾으신다면, {지역명} {사업장명}을 추천드립니다.
{대표 서비스/특징} + {LSI 연관키워드 1-2개 자연 포함}

[본문 2-3문단]
- 구체적 서비스 정보 (메뉴, 가격, 시간)
- 경험 정보 (분위기, 특징, 차별점)
- 위치/접근성 정보

[자주 묻는 질문]  ← AI 브리핑 인용 핵심 섹션
Q. {고객이 자주 묻는 질문}?
A. {30~60자 즉답형}. 추가 상세 정보.
(최소 3개, 최대 5개)
```

### 소식(공지) 구조 (적시성 최적화)
```
[YYYY년 M월 업데이트]
{업종 핵심 키워드}를 찾으시는 분들께 안내드립니다.
{최근 변경사항 또는 이벤트}
#{지역}{업종} #{핵심키워드}
```

### 리뷰 답변 구조 (C-rank Chain 신호)
```
감사합니다! {키워드 포함 자연스러운 감사 표현}.
{사업장명}의 {핵심 서비스}를 이용해 주셔서 감사합니다.
다음에도 {지역명} {업종}으로 찾아오세요.
```

### 금지 표현 (사용자 노출 UI)
- "직접 인용" 단정 표현 금지
- `[자주 묻는 질문]` → 소개글 내 섹션 이름이며 UI 체크박스로 표시 금지 (DB 컬럼 `has_faq`는 보존)

---

## 5. 점수 모델 — 코드별 역할

### Track1 가중치 v3.0 기본 (NAVER_TRACK_WEIGHTS, score_engine.py:99)
| 항목 | 가중치 | 담당 함수 |
|------|--------|---------|
| keyword_gap_score | 35% | `calc_keyword_gap_score()` |
| review_quality | 25% | `calc_review_quality()` |
| smart_place_completeness | 15% | `calc_smart_place_completeness()` |
| naver_exposure_confirmed | 15% | naver_scanner 결과 |
| kakao_completeness | 10% | 사용자 체크리스트 |

### Track1 가중치 v3.1 그룹별 (NAVER_TRACK_WEIGHTS_V3_1, score_engine.py:799)
| 항목 | ACTIVE | LIKELY | INACTIVE |
|------|--------|--------|---------|
| keyword_search_rank | 25% | 30% | 35% |
| review_quality | 15% | 17% | 20% |
| smart_place_completeness | 15% | 18% | 20% |
| blog_crank | 10% | 10% | 10% |
| local_map_score | 10% | 10% | 15% |
| ai_briefing_score | **25%** | **15%** | **0%** |

> INACTIVE 업종: `ai_briefing_score = 0`. `has_faq` 가중치도 0 (`has_faq` 25점 → 소식 25점 + 소개글 20점으로 재배분). 합계 100점 보존.

### Track2 가중치 (GLOBAL_TRACK_WEIGHTS, score_engine.py:111)
| 항목 | 가중치 | 측정 방법 |
|------|--------|---------|
| multi_ai_exposure | 40% | Gemini(최대 60pt) + ChatGPT(최대 30pt) 재배분 |
| schema_seo | 30% | JSON-LD + Open Graph + 뷰포트 + Google Place |
| online_mentions | 20% | 네이버 블로그 언급 수 |
| google_presence | 10% | Google AI Overview 이진 |

### 듀얼트랙 비율 (DUAL_TRACK_RATIO, score_engine.py:63)
| 업종 | 네이버 | 글로벌 AI |
|------|--------|-----------|
| restaurant, pharmacy | 70% | 30% |
| cafe, beauty, pet | 65% | 35% |
| fitness | 60% | 40% |
| legal | 20% | 80% |
| shopping | 10% | 90% |
| 미분류 fallback | 60% | 40% |

> GrowthStage 기준: **`track1_score`** (unified 아님 — 업종 비율 차이로 오판 방지).

---

## 6. AI 스캐너 운영 기준

### 4종 스캐너 역할 (multi_scanner.py) — 2026-05-04 A안 50/50 적용
| 스캐너 | 파일 | 쿼리 처리 방식 | 비고 |
|--------|------|--------------|------|
| Gemini 2.0 Flash | `gemini_scanner.py` | sample_n: Basic 자동 50회 / Full 100회 | Trial: 10회 |
| ChatGPT GPT-4o-mini | `chatgpt_scanner.py` | sample_n: Basic 자동 50회 / Full 100회 | Quick·Trial 1회 |
| 네이버 AI 브리핑 | `naver_scanner.py` | Playwright DOM 파싱 (이진) | |
| Google AI Overview | `google_scanner.py` | Playwright DOM 파싱 (이진) | |

**Basic 자동 스캔 A안 50/50 분할 (2026-05-04)**: Gemini 50회 + ChatGPT 50회. 한국 사용자 인지도가 높은 ChatGPT를 동등 측정하기 위함. 점수 산식: Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분 (`calc_multi_ai_exposure`).

**제거됨**: Claude 스캐너, Grok 스캐너, Perplexity (비용·ROI 이유)

### 쿼리 3변형 분산 (scan.py `_scan_queries`)
```python
# 지역 있는 경우
["{지역} {키워드} 추천", "{지역} {키워드}", "{키워드} 잘하는 {지역}"]
# 지역 없는 경우
["{키워드} 추천", "{키워드}", "{키워드} 잘하는 곳"]
```
- Playwright(네이버·Google): `_scan_queries[0]` (첫 번째 쿼리만 사용)
- API 스캐너(Gemini·ChatGPT): 전체 리스트 전달 → 내부에서 `divmod(100, n)` 균등 분산

### 스캔 모드별 스캐너 조합
| 모드 | 스캐너 | 대상 요금제 |
|------|--------|-----------|
| Trial | Gemini 10회 | 비로그인 |
| Quick | ChatGPT + Naver | — |
| Basic 자동 | Gemini + Naver | Basic |
| Full | 4개 전체 | Pro·Biz |

---

## 7. Gemini·ChatGPT 노출 원칙

### Gemini (gemini-2.0-flash-001)
- **측정 방식**: 3개 변형 쿼리 × 균등 분산 100회 샘플링 → 노출 빈도(exposure_freq/100)
- **신뢰도**: Wilson 95% 신뢰구간 제공 (`confidence.lower/upper`)
- **`queries_used`**: 결과 dict에 포함 — 어떤 쿼리들로 측정했는지 추적 가능

### ChatGPT (gpt-4o-mini)
- **측정 방식**: 학습 데이터(웹 크롤링 아카이브) 기반 — **실시간 검색 아님**
- **핵심 한계**: 소상공인 대부분 ChatGPT 학습 데이터에 없음 → `mentioned=False` 과다
- **UI 면책 문구 필수**: "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- 이 문구를 ChannelScoreCards.tsx `globalItems` 섹션 하단에 반드시 표시

### 공통 면책 문구 (모든 변동 데이터)
> "측정 시점·기기·로그인 상태에 따라 달라질 수 있음"

---

## 8. 글로벌 AI 노출 향상 콘텐츠 기준

### JSON-LD (schema_seo 40점 직결)
```html
<script type="application/ld+json">
{
  "@type": "LocalBusiness",
  "name": "{사업장명}",
  "description": "{핵심 키워드 포함 200자 이내 설명}",
  "address": {...},
  "openingHours": [...],
  "telephone": "..."
}
</script>
```
- 자동 생성: `POST /api/schema/generate` (`schema_generator.py`)

### 블로그 콘텐츠 구조 (ChatGPT·Gemini 학습 데이터 유입)
```
[제목] {지역} {핵심키워드} — {사업장명} 소개·후기
[도입] 검색 의도 명확화: "{지역}에서 {키워드}를 찾는다면..."
[본문] 구체적 정보(위치/가격/시간) + 실제 경험 + LSI 연관키워드
[마무리] 결론 요약 1-2문장(AI 발췌용) + 날짜 명시
```

### FAQ 구조 (모든 AI 공통 인용 최적화)
```
Q: {사용자가 AI에게 물을 법한 질문}?
A: {30~80자 즉답형}. 추가 상세 정보.
```

---

## 9. INACTIVE 업종 UI·안내 분기 규칙

INACTIVE 업종 감지 시 (`get_briefing_eligibility` 반환 `eligible=False`):

**백엔드 (`briefing_engine.py`)**:
- `build_briefing_paths()` → 글로벌 AI 경로만 반환
- `has_faq` 점수 항목: 가중치 0 (단, DB 컬럼 보존)
- `ai_briefing_score` 가중치: 0 (NAVER_TRACK_WEIGHTS_V3_1["INACTIVE"])

**프론트엔드**:
- 대시보드: 상단 안내 배너 + "네이버 AI 브리핑 비대상이나 ChatGPT·Gemini·Google AI 노출 개선은 동일하게 효과적" 메시지
- Trial 결과: INACTIVE 분기 → 대체 채널(ChatGPT·Gemini·Google·카카오맵) 강조
- AiTabPreviewCard: `available: false` → 숨김 처리 (잠금 UI도 금지 — 비대상 업종에 노출하지 않음)

---

## 10. 키워드 분류 (`keyword_taxonomy.py`)

- 업종별 키워드 그룹: 각 그룹에 `weight` 합계 1.0 유지 필수
- `ai_tab_context` 그룹: restaurant/cafe/accommodation 3개 업종에만 존재 (weight 0.05, 시뮬레이션 전용 — 점수 무영향)
- 숙박(accommodation): facility / room / dining / activity / value / ai_tab_context 6그룹

---

## 11. 코드 파일 역할 지도

| 파일 | 역할 | 네이버/GPT 관련 주요 함수 |
|------|------|----------------------|
| `score_engine.py` | 점수 계산 전체 | `calc_track1_score()`, `calc_track2_score()`, `calc_multi_ai_exposure()` |
| `briefing_engine.py` | 네이버 콘텐츠 생성 | `build_briefing_paths()`, `simulate_ai_tab_answer()`, `build_briefing_summary()` |
| `naver_scanner.py` | 네이버 AI 브리핑 실노출 | Playwright DOM 파싱 (이진) |
| `naver_place_stats.py` | 스마트플레이스 완성도 | `_detect_recent_post_stats()`, `_parse_photo_categories()` |
| `chatgpt_scanner.py` | ChatGPT 노출 확인 | `sample_100(queries, target)` |
| `gemini_scanner.py` | Gemini 노출 확인 | `sample_100(queries, target)` |
| `multi_scanner.py` | 스캐너 조율 | `scan_all()`, `scan_basic()`, `scan_with_progress()` |
| `gap_analyzer.py` | 갭 분석 | `analyze_review_keyword_distribution()` |
| `guide_generator.py` | 개선 가이드 생성 | Claude Sonnet 가이드 |
| `keyword_taxonomy.py` | 키워드 그룹 정의 | 업종별 keyword groups + weights |
| `schema_generator.py` | JSON-LD 생성 | `POST /api/schema/generate` |

---

## 12. 작업 시 체크리스트

**네이버 AI 브리핑 관련 작업 전**:
- [ ] 업종 분류(ACTIVE/LIKELY/INACTIVE) 확인 → `score_engine.py:25`
- [ ] 프랜차이즈 여부 처리 → `get_briefing_eligibility()` 사용
- [ ] Q&A 탭(`/qna`) 경로 사용 여부 확인 → 사용 시 `/profile`로 교체
- [ ] `has_faq` 가중치가 0인지 확인 (점수 계산 로직)
- [ ] backend ↔ frontend 단일 소스 동기화 여부 확인

**GPT·Gemini 스캔 관련 작업 전**:
- [ ] `_scan_queries` 3변형 리스트 생성 로직 (scan.py)
- [ ] API 스캐너에 리스트 전달, Playwright엔 첫 번째 쿼리만 전달
- [ ] ChatGPT UI 면책 문구 표시 여부 확인 (ChannelScoreCards.tsx)
- [ ] `queries_used` 결과 dict에 포함 여부 확인

**점수 모델 변경 시**:
- [ ] `NAVER_TRACK_WEIGHTS_V3_1` 합계 1.0 자동 검증 (`_validate_v3_1_weights()`)
- [ ] Track1/Track2 가중치 합계 100% 확인
- [ ] `calc_smart_place_completeness()` 내부 항목 합계 100점 확인

---

*단일 진실 소스: 코드 `score_engine.py`, `briefing_engine.py`, `multi_scanner.py` — 이 문서와 충돌 시 코드가 우선.*
