# 네이버 AI 브리핑 노출 기준 점검 및 보강 작업 — v1.0

> **작성일**: 2026-05-01
> **출처**: 리드젠랩 「네이버 AI 브리핑 C-rank·AEO 최적화 가이드」 + 네이버 공식 (2026-04-06 별점 도입, 2025 숙박 확대)
> **상태**: P0 진행 중 / P1~P3 대기
> **목적**: 새 대화창에서 이어서 작업할 수 있도록 컨텍스트 보존

---

## 0. 한 줄 요약
리드젠랩 「C-rank·AEO 최적화 가이드」를 기준으로 AEOlab 코드베이스를 대조한 결과, **사장님 백오피스 URL 버그 1건(P0)** + **AI 브리핑 노출 신호 강화 4건(P1)** + **매뉴얼 보강 4건(P2~P3)**, 총 9개 항목을 발견. P0는 즉시 수정, P1은 본 작업, P2~P3는 본 문서로 이관.

---

## 1. 조사 핵심 결과

### AI 브리핑 노출 알고리즘 (3단계)
1. **적합성 평가** — 정보형 검색일 때만 활성화
2. **콘텐츠 발굴** — 네이버 자체 서비스(블로그·카페·플레이스) 우선
3. **핵심 정보 추출** — HyperCLOVA X 기반

### 평가 레이어
- **C-rank 4축**: Context(주제 집중도) / Content(품질) / Chain(상호작용) / Creator(신뢰도)
- **D.I.A.(Deep Intent Analysis) 5요소**: 주제 적합도 / 경험 정보 / 정보 충실성 / **독창성** / **적시성**

### AI 브리핑 5유형
공식형 멀티출처 / 숏텐츠형 / **플레이스형(소상공인)** / 쇼핑형 / AI 쇼핑가이드

### 적용 업종 (2026-05 기준)
- ACTIVE: 음식점·카페·베이커리·바·**숙박(2025 확대 1.5만 업체)**
- LIKELY: 미용·네일·반려동물·헬스·요가·약국 (확대 예상)
- INACTIVE: 그 외 — 글로벌 AI(ChatGPT·Gemini·Google) 채널 활용 권장

### 사업주 노출 ON/OFF
- **스마트플레이스 → 업체정보 → AI 정보 → 노출 설정**
- 변경 1일 반영, 미노출 선택 가능, 리뷰 조작 시 차단

### 2026년 변경
- 2026-04-06 **별점(5점 척도) 도입** — 사업주 공개 여부 선택
- 2026 연내 **통합검색 별도 'AI 탭'** 도입 — 연속 대화형
- **인용 콘텐츠 배지** — 인용된 블로거에게 검색 결과 배지

### 효과 지표 (네이버 공식)
체류 +10.4%, 클릭률 +27.4%, 더보기 +137%, 메뉴 +30%, 예약·주문 +8%

---

## 2. 코드베이스 점검 결과

### ✅ 잘 구현된 부분
| 항목 | 위치 |
|---|---|
| ACTIVE에 숙박 포함 | `backend/services/score_engine.py:25` |
| 프랜차이즈 게이팅 | `score_engine.py:33 get_briefing_eligibility()` |
| AI 정보 탭 노출 ON 안내 | `score_engine.py:408` |
| 사장님 Q&A 직접 인용 인지 | `briefing_engine.py:46` |
| 4경로(답변·FAQ·소식·소개) | `briefing_engine.py` |
| FAQPage JSON-LD 스키마 | `schema_generator.py:272` |
| 영수증 리뷰 신호 | `businesses.receipt_review_count` |
| Q&A 자동 진단 (`/qna` 탭) | `smart_place_auto_check.py:189` |
| 자연 구어체 FAQ 질문 | `briefing_engine.py:_FAQ_QUESTIONS` |
| 업종별 LSI 키워드 그룹 | `keyword_taxonomy.py` |

---

## 3. 작업 우선순위 — 9개 항목

### 🔴 P0 — 즉시 수정 (실제 동작 버그)
**1. 사장님 백오피스 URL 동적화**
- 위치: `backend/services/briefing_engine.py:27-32`
- 현황: 옛 URL `smartplace.naver.com/business/faq` 등 사용 → 클릭 시 작동 안 함
- 정답: `smartplace.naver.com/bizes/{naver_place_id}/{qna|posts|profile|reviews}` (기존 `smart_place_auto_check.py:42-47`이 정답 패턴)
- 수정 방향: `_SMARTPLACE_URLS` dict → `smartplace_url(path_key, naver_place_id)` 함수로 변경. `naver_place_id` 없으면 `https://smartplace.naver.com/`(대시보드) 폴백.

### 🟡 P1 — AI 브리핑 노출 신호 강화 (4건)
**2. FAQ 답변 첫 문장 즉답형(30~60자) 강제**
- 위치: `briefing_engine.py:_FAQ_TEMPLATES`
- 근거: 리드젠랩 "검색 쿼리에 대한 명확한 답변을 첫 번째 문단에 배치"
- 수정 방향: 템플릿 `a` 필드의 첫 문장을 30~60자 간결한 즉답형으로 일괄 점검. 예: "네, 가능합니다. ..." → "네, 무료 주차 가능합니다(전용 [위치], 식사 시간 무료)."

**3. 블로그 초안에 동적 "[YYYY년 M월 업데이트]" 표기**
- 위치: `briefing_engine.py:1020 _make_list_content_draft()` 1050~1062줄
- 근거: D.I.A. **적시성** 신호 + "2025년 최신·2025년 업데이트 표기 권장"
- 수정 방향: `from datetime import datetime` → blog_title·blog_draft 도입부에 동적 연/월 추가

**4. LSI(연관 키워드 묶음) 자연 배치**
- 위치: `briefing_engine.py:836-862 _make_intro_content()`, `_make_faq_content()`
- 근거: D.I.A. **주제 적합도** + LSI "주제의 깊이와 전문성"
- 수정 방향: `keyword_taxonomy`에서 핵심 키워드의 연관 묶음 2~3개를 자연 문장으로 추가 (단순 나열 X)

**5. `/guide/ai-info-tab` 0단계 — 노출 설정 ON 자가 확인**
- 위치: `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx`
- 근거: 사업주가 `업체정보 → AI 정보 → 노출 설정 = 노출` 안 하면 모든 작업 무효
- 수정 방향: 기존 5단계 가이드 앞에 0단계 체크박스 + "노출 설정 ON 확인하셨나요?" 인터랙션 추가. ACTIVE/LIKELY 업종 한정.

### 🟢 P2 — 매뉴얼 보강 (3건)
**6. `/how-it-works`에 D.I.A. 5요소 섹션 신설**
- 위치: `frontend/app/(public)/how-it-works/page.tsx`
- 근거: 사용자가 "AI가 무엇을 보는지" 명시 누락
- 수정 방향: C-rank 섹션 다음에 "D.I.A. 5요소 — 주제 적합도·경험 정보·정보 충실성·독창성·적시성" 카드 5개

**7. `/how-it-works`에 2026 AI 탭 + 인용 배지 대비 안내**
- 위치: 동상
- 근거: 2026년 통합검색 별도 AI 탭 도입 + 인용 콘텐츠 배지
- 수정 방향: 마지막 섹션에 "2026년 AI 탭 시대 — 사업주 블로그가 인용 배지를 받는 법" 추가

**8. 별점 도입(2026-04-06) 안내 1줄**
- 위치: `frontend/app/(dashboard)/dashboard/page.tsx` 또는 `how-it-works/page.tsx`
- 근거: 2026-04-06부터 5점 척도 별점 도입, 사업주 공개 여부 선택
- 수정 방향: 면책 영역에 "2026-04-06부터 별점 표시. 공개 여부는 스마트플레이스에서 직접 선택" 1줄

### 🟢 P3 — 베타 데이터 후속 (1건)
**9. `scan_results.avg_rating` 컬럼 + 향후 가중치 검토**
- 위치: DB ALTER + `naver_place_stats.py`
- 근거: 별점 평균이 향후 검색·AI 브리핑 신호로 사용될 가능성
- 수정 방향: 베타 5명+ 데이터 모인 후 Track1 `review_count` 옆에 추가 검토

---

## 4. 작업 진행 로그

| 일시 | 항목 | 상태 | 비고 |
|---|---|---|---|
| 2026-05-01 | **P0 #1 URL 동적화** | ✅ 완료 | `briefing_engine.py:26-46` `_build_smartplace_url()` 함수화 + 호출부 수정 |
| 2026-05-01 | **P1 #2 FAQ fallback 즉답형 가이드** | ✅ 완료 | `_make_faq_pair()` fallback 답변에 "30~60자 즉답형" 가이드 명시 |
| 2026-05-01 | **P1 #3 블로그 발행일 표기** | ✅ 완료 | `_make_list_content_draft()` `[YYYY년 M월 업데이트]`·정보 기준일·`#YYYY년최신` 태그 추가 |
| 2026-05-01 | **P1 #4 LSI 묶음 자연 배치** | ✅ 완료 | `_find_lsi_cluster()` 신규 + `_make_intro_content()` 연관 키워드 2개 자연 문장 추가 |
| 2026-05-01 | **P1 #5 노출 설정 0단계** | ✅ 기충족 | `AiInfoTabGuide.tsx` 단계 1·2가 이미 "AI 정보 탭 + 토글 ON" 안내 → 추가 작업 불필요 |
| 2026-05-01 | **P2 #6 D.I.A. 5요소 섹션** | ✅ 완료 | `how-it-works/page.tsx` `#dia` 신규 섹션, TOC 항목 추가 |
| 2026-05-01 | **P2 #7 2026 AI 탭·인용 배지 안내** | ✅ 완료 | `#dia` 섹션 내 "2026년 변화" 하위 블록 |
| 2026-05-01 | **P2 #8 별점 도입 안내** | ✅ 완료 | `#limits` 면책 박스 아래 별점 안내 박스 추가 |
| 대기 | **P3 #9 `avg_rating` 컬럼** | ⏳ 대기 | 베타 5명+ 데이터 모인 후 검토 (DB ALTER + `naver_place_stats.py`) |
| 대기 | (선택) FAQ 템플릿 첫 문장 일괄 점검 | ⏳ 대기 | 60+ 답변의 첫 문장 30~60자 즉답형 검증 (현재는 fallback만 강제) |
| 대기 | (선택) 홈페이지 없는 사용자에 블로그 H3 FAQ 가이드 | ⏳ 대기 | 80% 사용자 적용 |

---

## 4-1. 2026-05-01 세션 변경 파일

```
backend/services/briefing_engine.py
  - import datetime 추가
  - _SMARTPLACE_URLS dict → _SMARTPLACE_PATHS + _build_smartplace_url() 함수 (L:26-46)
  - smartplace_url() 호출부 함수화 (L:920-921)
  - _make_faq_pair() fallback 답변 즉답형 가이드 (L:716-728)
  - _find_lsi_cluster() 신규 함수 (L:851-887)
  - _make_intro_content() LSI 문장 추가 (L:903-910)
  - _make_list_content_draft() 발행일 표기 + #YYYY년최신 태그 (L:1078-1095)

frontend/app/(public)/how-it-works/page.tsx
  - TOC에 #dia 항목 추가
  - #dia 신규 섹션 (D.I.A. 5요소 카드 5개 + 2026 변화 블록)
  - #limits 면책 박스 아래 별점 도입 안내 박스 추가

docs/naver_ai_briefing_compliance_v1.0.md (이 문서)
```

---

## 5. 새 대화창에서 이어서 작업하는 법

```
이 문서를 먼저 읽고 시작:
docs/naver_ai_briefing_compliance_v1.0.md

진행 상태는 § 4. 작업 진행 로그 참조.
다음 작업은 "대기" 항목 중 우선순위 P1부터.
```

### 핵심 파일 빠른 참조
- 점수 모델: `backend/services/score_engine.py` (BRIEFING_*, get_briefing_eligibility)
- AI 브리핑 경로: `backend/services/briefing_engine.py` (_SMARTPLACE_URLS, _FAQ_TEMPLATES)
- 자동 진단: `backend/services/smart_place_auto_check.py` (정답 URL 패턴)
- JSON-LD: `backend/services/schema_generator.py` (generate_faq_schema)
- 5단계 가이드 페이지: `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx`
- 매뉴얼 페이지: `frontend/app/(public)/how-it-works/page.tsx`

### CLAUDE.md 단일 소스 동기화 주의
- `BRIEFING_ACTIVE_CATEGORIES` (backend) ↔ `BRIEFING_ACTIVE` (frontend) 양쪽 동시 수정 필수
- DB ALTER 시 `scripts/supabase_schema.sql`에 반드시 기록

---

## 6. 출처
- [리드젠랩 — 네이버 AI 브리핑 C-rank·AEO 최적화 가이드](https://blog.lead-gen.team/naver-ai-briefing-seo-optimal-strategy)
- [굿씽크 — 플레이스 AI 브리핑 노출 설정 위치](https://goodthinq.com/entry/이젠-리뷰도-AI가-요약해준다-네이버-플레이스-AI-브리핑-전격-해부)
- [아주경제 2026-03-18 — 별점 도입 발표](https://www.ajunews.com/view/20260318093445140)
- [아이보스 — 2026 플레이스 검색노출 알고리즘](https://www.i-boss.co.kr/ab-2987-518921)
- [플래텀 — 플레이스 AI 브리핑 효과 지표](https://platum.kr/archives/269072)
- [아이보스 — 숙박업 확대](https://www.i-boss.co.kr/ab-2877-17016)

*최종 업데이트: 2026-05-01 v1.0*
