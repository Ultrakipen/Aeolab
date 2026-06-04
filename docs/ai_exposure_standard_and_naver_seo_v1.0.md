# AI 노출 기준 표준 + 네이버 일반 검색 개선 계획 v1.0

> AEOlab 작업 기준 문서 — 5개 AI 채널 노출 판정 기준 + 네이버 일반 검색 개선 안내 설계
> 작성: 2026-05-26 | 최종 갱신: 2026-05-30 v1.4 | 근거: score_engine.py · naver_scanner.py · chatgpt_scanner.py · gemini_scanner.py · google_scanner.py · gap_analyzer.py · keyword_taxonomy.py + 딥리서치 8개 소스

---

## 목차

- [§0 이 문서의 목적과 사용법](#§0-이-문서의-목적과-사용법)
- [§1 네이버 AI 브리핑 — 노출 기준](#§1-네이버-ai-브리핑--노출-기준)
- [§2 네이버 AI탭 — 노출 기준](#§2-네이버-ai탭--노출-기준)
- [§3 ChatGPT — 노출 기준](#§3-chatgpt--노출-기준)
- [§4 Gemini — 노출 기준](#§4-gemini--노출-기준)
- [§5 Google AI Overview — 노출 기준](#§5-google-ai-overview--노출-기준)
- [§6 네이버 일반 검색 — 개선 기준 및 안내 설계](#§6-네이버-일반-검색--개선-기준-및-안내-설계)
- [§7 채널 간 연결 구조 (AI 브리핑의 기반은 일반 검색 최적화)](#§7-채널-간-연결-구조)
- [§8 사용자 안내 문구 표준 (면책·배지)](#§8-사용자-안내-문구-표준)
- [§9 구현 우선순위 로드맵](#§9-구현-우선순위-로드맵)

---

## §0 이 문서의 목적과 사용법

### 왜 필요한가

AEOlab은 5개 채널(네이버 AI 브리핑·AI탭·ChatGPT·Gemini·Google AI)의 노출을 측정·개선하는 서비스다.
그러나 각 채널의 "노출 가능 여부 판정 기준"과 "개선 가이드의 근거"가 코드에만 분산돼 있어,
신규 기능 구현 시 기준이 불명확하거나 채널 간 모순이 발생했다.

이 문서는 **채널별 노출 판정 기준의 단일 소스**다.

### 이 문서를 먼저 읽어야 하는 작업

- 스캔 엔진(score_engine, multi_scanner) 수정
- 갭 분석·가이드 생성(gap_analyzer, guide_generator) 수정
- 사용자 노출 화면(대시보드·가이드·트라이얼) UI 변경
- 업종별 가이드 콘텐츠 작성
- **신규**: 네이버 일반 검색 노출 안내 기능 구현 시

### 단일 소스 연결 파일

| 기준 항목 | 코드 단일 소스 |
|----------|-------------|
| AI 브리핑 업종 분류 | `backend/services/score_engine.py:30-87` |
| AI탭 자격 | `backend/services/score_engine.py:91-107` |
| 스캔 쿼리 생성 | `backend/services/keyword_taxonomy.py:build_ai_scan_queries()` |
| 갭 분석 문구 | `backend/services/gap_analyzer.py:_GAP_REASONS` |
| 점수 가중치 | `backend/services/score_engine.py:NAVER_TRACK_WEIGHTS, GLOBAL_TRACK_WEIGHTS` |

---

## §1 네이버 AI 브리핑 — 노출 기준

### 1.1 서비스 개요

네이버 AI 브리핑(플레이스형)은 통합검색 결과 상단에 AI가 정리한 사업장 정보를 노출하는 기능이다.
특정 업종·특정 사업장만 노출 대상이며, 모든 업종에 적용되지 않는다.

### 1.2 업종별 노출 자격 (단일 소스: score_engine.py:30-87)

#### ACTIVE — 노출 대상 (5개 업종)
```
restaurant, cafe, bakery, bar, accommodation
```
- 네이버 공식 발표 기준 (2025.08 음식점·카페·숙박 확대 확정)
- 스마트플레이스 AI 브리핑 플레이스형 노출 대상
- **프랜차이즈는 ACTIVE 업종이라도 제외** (네이버 공식 정책)

#### LIKELY — 확대 예정 (12개 코드 등록, 실효 6개)
```
beauty, nail, skincare, massage, spa, pet, fitness, yoga, pharmacy,
dance, ballet, semi_permanent
```
- 2026-04-27 AI탭 베타 공개(네이버플러스 우선) 이후 확대 동향 추적 중
- **⭐ 2026년 내 ACTIVE 전환 공식 예고**: 네이버 최수연 대표 컨퍼런스콜(2026.02.06, 뉴시스·뉴스핌) — "연내 AI 브리핑 2배 확대, **미용(beauty) 업종 포함**"  
  `briefing_category_expansion_monitor_job`(매월 1일 자동 체크)이 정상 작동 중이면 ACTIVE 승급 자동 감지 가능. beauty 업종 사용자에게 "곧 AI 브리핑 대상이 될 예정" 안내 권장.
- 사용자 안내 톤: "확대 가능성 높음, 현재 베타"
- 점수 계산: ACTIVE보다 낮은 가중치 적용 (ai_briefing_score × 0.5)
- **⚠️ 주의**: businesses.category 화이트리스트(25개)에 등록된 LIKELY 업종은 `beauty, nail, pet, fitness, yoga, pharmacy` 6개뿐. `skincare, massage, spa, dance, ballet, semi_permanent` 6개는 코드에는 있으나 사용자 등록 경로 없음 → 실질적 dead code. 화이트리스트 확장 전까지 UI 안내에 12개를 전부 열거하지 말 것.

#### INACTIVE — 현재 비대상
```
medical, legal, accounting, education, tutoring, photo, video, design,
realestate, interior, auto, cleaning, shopping, fashion, 기타 모든 업종
```
- Track1 `ai_briefing_score = 0점` 고정
- 사용자 안내: 네이버 AI 브리핑 대신 AI탭·ChatGPT·Gemini 개선 집중 유도

### 1.3 프랜차이즈 게이팅 (단일 소스: score_engine.get_briefing_eligibility())

```python
if is_franchise:
    return "inactive"   # ACTIVE 업종이라도 제외
```

사용자 노출 화면에서 프랜차이즈 판정 시 "본사 계정으로만 AI 브리핑 노출 가능" 안내 필수.

### 1.4 AI 브리핑 노출을 결정하는 실측 요인 (우선순위 순)

| 순위 | 요인 | 개선 방법 | 측정 여부 |
|------|------|----------|---------|
| 1 | **소개글 Q&A 포함** (방문 정보·주차·예약·메뉴) | 스마트플레이스 소개글 500자+ | ✅ `has_intro` |
| 2 | **리뷰 수·품질** (영수증 리뷰 포함) | 리뷰 응답·영수증 리뷰 요청 | ✅ `review_count` |
| 3 | **사진 업로드** (메뉴·매장·음식 카테고리별) | 업종별 카테고리 사진 10장+ | ✅ `photo_count` |
| 4 | **최근 소식 업데이트** (14일 이내) | 주 1회 소식 게시 | ✅ `has_recent_post` |
| 5 | **예약 연동** (네이버 예약·캐치테이블) | 예약 플랫폼 등록 | ✅ `has_reservation` |
| 6 | **키워드 커버리지** (리뷰·소개글 내 핵심 키워드) | 키워드 갭 분석 후 콘텐츠 보완 | ✅ `keyword_gap_score` |

### 1.5 측정 방법 (naver_scanner.py)

- Playwright로 `https://search.naver.com/search.naver?query=[짧은쿼리]` 렌더링
- `BRIEFING_SELECTORS` 16개 우선순위 DOM 파싱
- 업체명 부분매칭 (`_name_in_text()` — 공백·특수문자 무시)
- 광고 영역(`AD_BRIEFING_SELECTORS`) 별도 감지 → `ad_only=True` 시 0점
- 결과: `in_briefing=True/False`, `excerpt`, `ad_only`

### 1.6 점수 반영 (score_engine.py)

```
Track1 naver_exposure_confirmed 가중치: 0.15 (15점 만점)
ACTIVE: in_briefing=True → 100점 × 0.15
LIKELY: in_briefing=True → 50점 × 0.15
INACTIVE: 0점 고정
프랜차이즈: 0점 고정
```

---

## §2 네이버 AI탭 — 노출 기준

### 2.1 서비스 개요

AI탭은 네이버 통합검색 결과 내 별도 탭으로, 검색어에 대한 AI 답변을 제공한다.
**AI 브리핑과 달리 업종 제한 없음** — 모든 업종이 노출 대상이다.

### 2.2 현재 상태 및 전망

| 시기 | 상태 |
|------|------|
| 2026-04-27 | 네이버플러스 구독자 대상 베타 출시 |
| 2026-05-20 | **`system_status.ai_tab_enabled='true'`** — 수동 활성화. 스캔 이미 실행 중 |
| 2026-06 (예정) | 전체 사용자 확대 → 비로그인 노출 확인 후 DOM 셀렉터 실측 검증 권장 |

**활성화 우선순위 (코드 로직)**:
```
1순위: system_status.ai_tab_enabled (DB, 1분 캐시)
2순위: 환경변수 NAVER_AI_TAB_ENABLED (DB 조회 실패 시 fallback)
```
> **현재 DB 값이 `'true'`이므로 env var 설정과 무관하게 AI탭 스캔이 활성화된 상태.**  
> 6월 전체 확대 후 비로그인 브라우저에서 AI탭 노출 확인 → `_AI_TAB_SELECTORS` 실측 검증 권장.

### 2.3 업종 자격 (단일 소스: score_engine.get_ai_tab_eligibility())

```python
def get_ai_tab_eligibility(category: str) -> str:
    return os.getenv("AI_TAB_STATUS", "beta")   # 업종 제한 없음
```

- **모든 업종**: "beta" (현재) → "available" (6월 전체 확대 후)
- INACTIVE 업종도 AI탭은 가능 → 사용자에게 AI탭 개선을 우선 안내

### 2.4 AI탭 노출을 결정하는 요인 (업종 공통)

| 요인 | 개선 방법 |
|------|----------|
| 소개글 자연어 문장 (질문형 포함) | "~는 어떻게 하나요?" 형식 Q&A 포함 |
| 사진 수·카테고리 다양성 | 업종별 카테고리 사진 10~25장 |
| 예약 연동 | 네이버 예약 등록 |
| 리뷰 품질 (상세 리뷰) | 경험 위주 상세 리뷰 유도 |
| 블로그 UGC | 외부 블로그 후기 3개+ |
| 운영 정보 최신화 | 영업시간·휴무일 정확 업데이트 |

### 2.5 AI탭 vs AI 브리핑 명확 구분 (사용자 안내 필수)

| 구분 | AI 브리핑 (플레이스형) | AI탭 |
|------|-------------------|------|
| 노출 위치 | 통합검색 상단 박스 | 검색결과 내 별도 탭 |
| 대상 업종 | ACTIVE 5개 업종만 | **모든 업종** |
| 프랜차이즈 | 제외 | 제외 없음 |
| 진입점 | 스마트플레이스 AI 정보 탭 | 스마트플레이스 전체 정보 |
| 현재 상태 | 정식 서비스 중 | 베타 (네이버플러스 우선) |

**용어 표준**: "AI탭"(검색결과 탭) ≠ "AI 정보 탭"(스마트플레이스 내 토글) — 혼용 금지

### 2.6 점수 반영

```
Track1 ai_tab_readiness 가중치: 0.05 (5점 만점)
ai_tab_enabled='true' (현재 DB 상태): in_ai_tab=True → +20 보너스 반영 중
6월 전체 확대 후: DOM 셀렉터 실측 검증 → 필요시 _AI_TAB_SELECTORS 추가 보완
```

---

## §3 ChatGPT — 노출 기준

### 3.1 서비스 개요 — 스캐너 측정 vs 실사용자 경험 구분 필수

**AEOlab 스캐너가 측정하는 것 (chatgpt_scanner.py)**:
- `gpt-4.1-mini` API 호출, `tools` 없음 → **학습 데이터(컷오프 2024.06) 기반**
- 실시간 웹 검색 없음 → 훈련 데이터에 포함된 정도를 50~100회 샘플링으로 측정
- 개선 효과 반영까지 **수개월~1년** (모델 재학습 주기)

**실사용자가 ChatGPT.com에서 경험하는 것**:
- ChatGPT Plus/Free 사용자: **Bing 웹 검색 기본 활성화** (SearchGPT 통합)
- "강남 맛집 추천" 검색 시 → Bing이 크롤링한 최신 웹 콘텐츠 기반 답변
- **네이버 스마트플레이스·블로그는 Bing 인덱싱 대상 아님** → ChatGPT 웹 검색에서 직접 참조 안 됨
- 구글 비즈니스 프로필은 Bing도 인덱싱 → 가장 빠른 경로

> **대시보드 안내 원칙**: 스캐너 점수 = "AI 학습 데이터 인식 현황" 표시. 개선 방법은 Bing 웹 검색 기준으로 안내.

### 3.2 노출 자격

- **업종 제한 없음** — 모든 업종 대상
- **지역 제한 없음** — 전 세계 대상 (단, 한국어 쿼리는 한국 데이터 우선)
- **프랜차이즈 가능** — 개별 점포도 언급 가능 (브랜드 인지도 의존)

### 3.3 노출 가능성을 높이는 요인 (실사용 기준 — Bing 웹 검색 우선)

| 요인 | 효과 | 측정 여부 |
|------|------|---------|
| **구글 비즈니스 프로필** | Bing도 구글 데이터를 참조 — 가장 빠른 경로 | ✅ schema_seo |
| **자체 웹사이트 + JSON-LD** | Bing·OAI-SearchBot 직접 크롤링 대상 | ✅ schema_seo |
| **트립어드바이저·망고플레이트 등 외부 플랫폼** | Bing 인덱싱 우수한 영어권·글로벌 플랫폼 | 부분 측정 |
| **언론·뉴스 기사** | 권위 신호, Bing 인덱싱 양호 | ✅ blog_mention_score |
| 네이버 블로그 후기 | Bing 인덱싱 거의 안 됨 → ChatGPT에 직접 효과 없음 | ✅ blog_analysis_json (네이버 AI 브리핑·AI탭 전용) |

### 3.4 측정 방법 (chatgpt_scanner.py)

```
모델: gpt-4.1-mini (비용 최적화, tools 없음 — web search 미사용)
샘플링: 50회(Basic) / 100회(Full) / 5회(Trial)
쿼리: build_ai_scan_queries()로 생성한 5개 쿼리 균등 분산
점수 산식: (언급 횟수 / 총 샘플) × 45 → 100점 재배분
신뢰구간: Wilson 95% CI
측정 의미: 훈련 데이터 인식도 (실시간 웹 검색 결과 아님)
```

### 3.5 개선 방향 (사용자 안내)

```
즉시 (1~4주, 실사용자 ChatGPT 기준):
  1. 구글 비즈니스 프로필 등록·완성 (business.google.com) — Bing 인덱싱 가장 빠름
  2. 자체 웹사이트에 사업장명·주소·운영시간·Q&A 구조화 (JSON-LD 추가)
  3. 모든 플랫폼 사업장명 통일

장기 (스캐너 점수 반영 기준 — 수개월~1년):
  4. 트립어드바이저·망고플레이트 등 Bing 인덱싱 플랫폼 등록
  5. 언론 보도·블로그 협업 기사 확보
  ※ 네이버 블로그는 네이버 AI 브리핑·AI탭에 효과적. ChatGPT 점수 직접 개선 안 됨.
```

### 3.6 면책 문구 (모든 UI에 필수)

> "ChatGPT 측정은 AI 학습 데이터(컷오프 2024.06) 기반입니다. 실제 ChatGPT.com에서의 검색 결과와 다를 수 있으며, 단기 콘텐츠 변경으로 점수가 즉시 변동되지 않습니다."

**구현 완료 (2026-05-26)**:
- `ChatGPTDiffCard.tsx` — "ChatGPT 인식은 학습 데이터(컷오프 2024.06) 기반" 경고 배너 추가
- `GlobalAIBanner.tsx` — "ChatGPT는 학습 데이터 기반 장기 전략, Gemini는 구글 비즈니스 프로필로 수주 내 개선 가능" 분리 안내
- `chatgpt-search/page.tsx` — "Bing 검색 기반" 개편, 네이버 블로그 효과 없음 명시
- `gap_analyzer.py` — "ChatGPT는 Bing 검색 기반이라 네이버 블로그는 직접 도움 안 됨" 안내 반영
- `AIProblemDiagnosis.tsx` — 소개글 Q&A → 네이버 AI탭 효과, ChatGPT·Gemini에 구글 비즈니스 프로필 유도로 분리

---

## §4 Gemini — 노출 기준

### 4.1 서비스 개요 — 스캐너 측정 vs 실사용자 경험 구분 필수

**AEOlab 스캐너가 측정하는 것 (gemini_scanner.py)**:
- `gemini-2.0-flash-001` API 호출, `tools=["google_search"]` 없음 → **학습 데이터 기반**
- Google Search 그라운딩 미사용 → 훈련 데이터에 포함된 정도를 측정
- ChatGPT와 달리 학습 데이터에 구글 생태계 가중이 더 높음

**실사용자가 gemini.google.com에서 경험하는 것**:
- **Gemini 모델 학습 컷오프: 2025년 1월** — 그라운딩 없이는 이후 정보 부재
- **Google Search 그라운딩 기본 활성화** → 구글 인덱스 최신 정보 실시간 참조 가능
- 구글 비즈니스 프로필 변경 → **2~4주 내 Gemini 반영** (그라운딩 경로)
- 안정적 AI 인용 권위 확보까지: **3~6개월** (교차검증 소스 누적 필요)
- ChatGPT보다 **즉각적인 개선 효과** 가능

> **대시보드 안내 원칙**: "Gemini는 구글 비즈니스 프로필·웹사이트 등록 후 2~4주 내 개선 시작, 3~6개월 안정화"로 안내.

### 4.2 노출 자격

- **업종 제한 없음**
- **구글 생태계 연동 여부**가 핵심 변수

### 4.3 노출 가능성을 높이는 요인

| 요인 | ChatGPT 대비 차이점 |
|------|------------------|
| **구글 비즈니스 프로필 완성도** | Gemini 전용 — 수주 내 반영 (ChatGPT보다 훨씬 빠름) |
| **구글 지도 리뷰** | Gemini가 구글 리뷰를 직접 참조 |
| **자체 웹사이트 (구글 색인)** | 구글 검색 색인 콘텐츠 → Gemini 그라운딩에 즉시 반영 |
| **유튜브 영상 언급** | 구글 계열 콘텐츠 가중 높음 |
| JSON-LD 구조화 데이터 | ChatGPT와 공통 (구글 색인 속도가 더 빠름) |
| 네이버 블로그 언급 | **네이버 AI 브리핑·AI탭에 효과적. Gemini 직접 효과 낮음** |

### 4.4 측정 방법 (gemini_scanner.py)

```
모델: gemini-2.5-flash (tools 없음 — Google Search 그라운딩 미사용, 학습 컷오프 2025.01)
샘플링: 50회(Basic) / 100회(Full) / 10회(Quick)
쿼리: build_ai_scan_queries() 5개 쿼리 균등 분산 (ChatGPT와 동일)
점수 산식: (언급 횟수 / 총 샘플) × 45 → 100점 재배분
측정 의미: 훈련 데이터 인식도 (실사용 Gemini의 그라운딩 결과와 다를 수 있음)
※ 2026-05-31: gemini-2.0-flash-001(컷오프 2024.06) → gemini-2.5-flash 마이그레이션 (6월 1일 deprecated 대응)
```

**ChatGPT·Gemini 합산 점수 산식**:
```
(gemini_score × 45) + (chatgpt_score × 45) = 90점 → × (100/90) = 100점 재배분
```

### 4.5 개선 방향 (ChatGPT와 명확 분리)

```
[반영 대기 기간(2~4주) 중 지금 할 수 있는 것 — Gemini 조기 노출 가능성 높이는 방법]

즉시 착수 (크롤 신호 가속):
  1. 구글 비즈니스 프로필 완성 — 운영시간·사진(10장+)·메뉴·Q&A 100% 채우기
     ※ 사진·포스트 업데이트 = 구글에 "활성 사업장" 신호 → 재크롤 주기 단축
  2. Google Search Console 등록 → URL 검사 → "색인 요청"으로 크롤 대기 단축
  3. 모든 플랫폼(네이버·카카오·배달앱·자체 웹사이트) 사업장명·주소·전화 일치
     ※ NAP 불일치 시 Gemini 교차검증 실패 → AI 노출 지연 또는 차단
  4. 구글 비즈니스 프로필 포스트 주 1회 발행
     ※ 30일 이상 미발행 시 GBP 가시성 급락 실측됨 (AgencyJet 2026)

단기 2~4주 (크롤 이후 AI 처리 가속):
  5. 자체 웹사이트 JSON-LD (LocalBusiness 스키마) 적용
  6. 구글 지도 리뷰 응답 활성화 (리뷰 신선도 = freshness 신호)
  7. 웹사이트 블로그에 업장 관련 글 1개+ 발행 (최근 30일 콘텐츠 = AI 인용 3.2배 높음)

장기 3~6개월 (안정적 인용 권위 구축):
  8. 외부 언론·디렉토리·리뷰 플랫폼에서 업장 언급 축적
  9. 유튜브에 업장 관련 영상 1개+ (구글 생태계 가중)
 10. JSON-LD 구조화 데이터 지속 최신화

ChatGPT·Gemini 공통:
  ※ 네이버 블로그는 네이버 AI 브리핑·AI탭에 효과적. Gemini 직접 개선 경로 아님.
```

### 4.6 면책 문구

> "Gemini 스캐너 측정은 AI 학습 데이터(컷오프 2025.01) 기반입니다. 실제 Gemini 앱은 Google Search 그라운딩을 사용하므로, 구글 비즈니스 프로필·웹사이트 개선 후 **2~4주 내 반영 시작, 안정적 인용까지 3~6개월** 소요될 수 있습니다. (SEO 실무 측정 기준, Google 공식 기간 미발표)"

**구현 완료 (2026-05-26)**:
- `GlobalAIBanner.tsx` — "Gemini는 구글 비즈니스 프로필로 수주 내 개선 가능" 명시
- `TrialDetailAccordion.tsx` — "Gemini·ChatGPT 인식 현황" 헤더 + "Gemini는 콘텐츠로 개선 가능·ChatGPT는 장기 전략" 부제 분리

---

## §5 Google AI Overview — 노출 기준

### 5.1 서비스 개요 및 데이터 구조

Google AI Overview(SGE)는 구글 검색 결과 상단에 AI 요약을 표시한다.
**2026-05-30 Serper.dev API 측정 활성화** — CAPTCHA 없이 정상 측정 중 (`GOOGLE_SCANNER_BACKEND=serper`).

**핵심 구조 — AI Overview는 실시간 색인 기반 (학습 컷오프와 무관)**:
- RAG(검색 증강 생성) 방식 — 쿼리 시점의 구글 검색 인덱스를 직접 참조
- Gemini 앱의 학습 컷오프(2025.01)와 **별개** — 색인만 되면 즉시 인용 가능
- 2025년 초 Deindex/수동조치 페이지의 AI Overview 지연(수 일) → **현재 표준 색인 파이프라인과 동기화 완료** (Search Engine Roundtable 확인)

**반영 기간 (SEO 실무 측정 기준, Google 공식 미발표)**:

| 단계 | 소요 시간 | 조건 |
|------|---------|------|
| GBP/웹사이트 변경 → 구글 재크롤 | **수 시간 ~ 수 일** | 권위 도메인은 24~48시간 내 |
| 색인 완료 → AI Overview 첫 반영 | **2~4주** | 일반 소상공인 기준 |
| 안정적 AI 인용 권위 확보 | **3~6개월** | 교차 소스 검증 누적 후 |
| GBP 30일 미업데이트 | **가시성 급락** | 실측 확인됨 (AgencyJet 2026) |

**콘텐츠 신선도 vs AI 인용 가능성 (AuthorityTech 2026 측정)**:
```
0~30일:   기준 대비 3.2배 높음 (피크 구간)
30~90일:  여전히 강함
3~6개월:  감소 시작
12개월+:  AI 인용 가능성 50% 이상 감소
전체 AI 인용의 약 50%가 최근 13주(3개월) 이내 콘텐츠에서 발생
```

### 5.2 현재 측정 상태 (2026-05-30 업데이트)

| 구분 | 내용 |
|------|------|
| 측정 방식 | **Serper.dev API** (`https://google.serper.dev/search`) |
| 현재 상태 | ✅ **정상 측정 중** — CAPTCHA 없음, `captcha_detected=false` 확인 |
| 비용 | $0.001/건 (가입 시 2,500회 무료 포함) |
| 환경변수 | `GOOGLE_SCANNER_BACKEND=serper`, `SERPER_API_KEY` 설정 완료 |
| 시각 증거(스크린샷) | Playwright 캡처는 여전히 CAPTCHA 차단 → 구독자 50명 이후 DataForSEO Screenshot API 재도입 예정 |

**탐지 우선순위 (google_scanner.py `_scan_via_serper`)**:
```
1. aiOverview 필드 (Serper 베타) → in_ai_overview=True
2. answerBox (featured snippet)
3. knowledgeGraph
4. 유기 검색 결과 순위 (rank 필드)
```

**CAPTCHA 재배분 산식 (captcha_detected=True 시, 현재 미적용)**:
```
score = (ai_exp × 0.40 + schema × 0.30 + mentions × 0.20) / 0.90
```

### 5.3 노출 가능성을 높이는 요인 + 반영 대기 중 할 수 있는 것

**[반영 대기 기간(2~4주) 동안 AI Overview 노출 가능성을 높이는 방법]**

| 요인 | 효과 | 즉시 가능 여부 |
|------|------|-------------|
| **구글 비즈니스 프로필 완성** | 가장 빠른 AI Overview 진입 경로 | ✅ 즉시 |
| **GBP 포스트 주 1회 발행** | 활성 사업장 신호 → 재크롤 주기 단축 | ✅ 즉시 |
| **Search Console 색인 요청** | 크롤 대기 기간 단축 | ✅ 즉시 |
| **NAP 일치** (모든 플랫폼 동일) | 교차검증 통과 → AI 인용 차단 해제 | ✅ 즉시 |
| **JSON-LD 구조화 데이터** | `LocalBusiness`·`Restaurant` 스키마 | ✅ 즉시 |
| **최근 콘텐츠 발행** (30일 이내) | AI 인용 가능성 3.2배 (AuthorityTech) | ✅ 즉시 |
| **구글 지도 리뷰 응답** | freshness 신호, AI 신뢰도 ↑ | ✅ 즉시 |
| **E-E-A-T 신호** | 리뷰·자격증·언론 보도 | ⏳ 장기 |
| **Core Web Vitals** | 페이지 로딩 속도·안정성 | ⏳ 기술 적용 후 |
| **HTTPS + 모바일 최적화** | 기본 기술 요건 | ✅ 즉시 |

**5단계 반영 지연(Update Lag) 모델 — 소상공인이 "왜 아직 안 바뀌지?" 느끼는 이유 (Risosa/AI100)**:
```
① 발행 지연     — 웹사이트/GBP 변경 실제 공개까지
② 발견 지연     — Googlebot 재방문까지 (Search Console 색인 요청으로 단축 가능)
③ 색인 지연     — 크롤된 내용이 색인 처리까지
④ 답변 조립 지연 — AI Overview 응답 생성 파이프라인
⑤ 교차검증 지연  — 타 사이트 인용·NAP 일치 확인 후 안정적 노출
```
→ ②번 단축(Search Console) + ⑤번 단축(NAP 일치, 외부 언급 축적)이 소상공인이 할 수 있는 핵심.

### 5.4 사용자 안내 (Serper.dev 측정 활성 이후)

```
"Google AI Overview에서의 노출 여부를 측정했습니다.
 구글 비즈니스 프로필·웹사이트·JSON-LD를 개선하면 2~4주 내 반영이 시작되며,
 안정적인 AI 인용까지는 3~6개월이 소요됩니다.
 (SEO 실무 측정 기준 — Google 공식 발표 기간은 없습니다.)"
```

**스코어 처리**: Serper 정상 시 `google_presence` 10% 정상 반영. CAPTCHA 발생 시(예비) `google_captcha_blocked=True` + 재배분 로직 유지.

---

## §6 네이버 일반 검색 — 개선 기준 및 안내 설계

### 6.1 왜 일반 검색 최적화가 AI 노출의 기반인가

```
[일반 검색 최적화]
      │
      ├─→ 스마트플레이스 정보 완성도 향상
      │         └─→ 네이버 AI 브리핑 노출 가능성 ↑
      │
      ├─→ 블로그 언급·후기 증가
      │         ├─→ ChatGPT 학습 데이터 반영 (장기)
      │         └─→ Gemini 학습 데이터 반영 (장기)
      │
      ├─→ 키워드 노출 순위 향상
      │         └─→ 스마트플레이스 클릭 → 리뷰 증가 → AI 브리핑 노출 ↑
      │
      └─→ VIEW탭(블로그·카페) 상위노출
                └─→ AI탭 답변 소스 데이터 축적
```

**포지셔닝**: 일반 검색 최적화는 독립 기능이 아니라 **AI 노출의 토대**임을 사용자에게 명확히 안내.

### 6.2 네이버 일반 검색 노출 채널 3종

#### 채널 A: 플레이스 탭 (스마트플레이스 상위노출)

**노출 결정 요인 (중요도 순)**:
| 요인 | 구체적 기준 | AEOlab 측정 여부 |
|------|-----------|---------------|
| 영업 정보 완성도 | 영업시간·전화·주소·카테고리 정확 | ✅ smart_place_completeness |
| 리뷰 수·최신성 | 최근 30일 리뷰 5개+ | ✅ review_count |
| 영수증 리뷰 비율 | 전체 리뷰 중 영수증 리뷰 30%+ | ✅ receipt_review_count |
| 사진 수·최신성 | 최근 90일 내 사진 업로드 | ✅ photo_count |
| 예약·주문 연동 | 네이버 예약·스마트오더 사용 | ✅ has_reservation |
| 소식 게시 빈도 | 14일 이내 소식 1개+ | ✅ has_recent_post |
| 키워드 일치도 | 사업장명·소개글 내 검색 키워드 포함 | ✅ keyword_gap_score |
| 저장 수 (찜) | 스마트플레이스 저장 수 | ❌ 미측정 |
| 클릭률 (CTR) | 검색 결과 내 클릭 | ❌ 미측정 (DataLab 필요) |

**개선 우선순위 (점수 기여도 기준)**:
```
1순위: 리뷰 수 증가 (영수증 리뷰 요청 QR 설치)
2순위: 소개글 키워드 포함 + Q&A 형식
3순위: 사진 업로드 (카테고리별 10장+)
4순위: 14일 이내 소식 게시 습관화
5순위: 예약 연동 (네이버 예약)
```

#### 채널 B: VIEW탭 (블로그 상위노출 — C-rank·D.I.A.)

**C-rank 알고리즘 핵심 요소**:
| 요인 | 기준 | 개선 방법 |
|------|------|---------|
| 주제 적합성 | 블로그 카테고리와 게시글 일관성 | 업장 전용 블로그 운영 |
| 발행 주기 | 주 1회+ 정기 발행 | 14일 단위 소식 + 블로그 연동 |
| 체류시간 | 평균 2분+ | 3000자+ 실사 이미지 포함 게시글 |
| 공감·댓글 | 자연 발생 인터랙션 | 후기 작성 유도 |
| 인플루언서 지수 | 이웃 수·활동량 | 장기 블로그 운영 |

**D.I.A. 5요소 (AEOlab에서 이미 측정·가이드 중)**:
- Directness (직접성): 핵심 정보 첫 단락
- Informativeness (정보성): 실측 데이터·사진 포함
- Accuracy (정확성): 최신 정보·사실 근거
- Comprehensiveness (종합성): 관련 키워드 자연 포함
- **별도 없음** — guide_generator.py에 D.I.A. 5요소 강제 적용 이미 구현 (content_validator.py)

**블로그 언급 점수 산식 (naver_visibility.py)**:
```
0건   →  5점
1~5건 → 20점
6~20건 → 40점
21~50건 → 60점
51~100건 → 80점
100+건 → 100점
```

#### 채널 C: 통합검색 상단 (업체명 직접 검색)

- 스마트플레이스 정보 완성도 + 리뷰 신뢰도가 핵심
- 채널 A 최적화와 동일한 요인

### 6.3 사용자에게 제공할 네이버 일반 검색 개선 정보 설계

#### 현재 제공 중 (기존 기능으로 커버됨)
- ✅ 스마트플레이스 완성도 점수 + 개선 체크리스트
- ✅ 키워드 커버리지 갭 분석
- ✅ 리뷰 수·영수증 리뷰 현황
- ✅ 최근 소식 게시 여부 (14일 기준)
- ✅ 블로그 언급 수 측정 (naver_visibility.py)
- ✅ D.I.A. 기반 블로그 글 가이드 (guide_generator.py)

#### 신규 추가 필요 (구현 대상)

**A. 대시보드 "네이버 검색 기반" 섹션 신규 카드**
```
카드명: 네이버 검색 기반 강화 현황
표시 항목:
  - 플레이스 탭 예상 순위 (1~5위 / 6~10위 / 10위 밖)
  - VIEW탭 블로그 언급 수 + 최근 30일 추이
  - 스마트플레이스 완성도 요약 (5개 항목 체크)
  - "이것을 개선하면 AI 브리핑 노출 가능성 ↑" 연결 안내
포지셔닝 문구: "네이버 검색 기반이 강할수록 AI 브리핑·AI탭 노출도 함께 올라갑니다"
```

**B. /guide 페이지 "네이버 일반 검색 최적화" 섹션 추가**
```
§1 플레이스 탭 상위노출 7가지 체크리스트
§2 블로그 후기 유도 방법 (QR·영수증·직접 요청)
§3 소식 게시 습관화 캘린더 (14일 주기 알림)
§4 키워드별 검색 순위 확인 방법
§5 "이 개선이 AI 검색에도 연결되는 이유" 설명
```

**C. 면책 문구 (모든 순위 관련 UI)**
```
"네이버 검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있으며,
 본 서비스의 측정은 참고용입니다."
```

### 6.4 키워드 순위 측정 현황 (naver_keyword_rank.py)

**현재 측정 채널**:
```
PC 통합검색:   search.naver.com
모바일 검색:   m.search.naver.com
플레이스 탭:   search.naver.com?where=place  ← 가장 정확
```

**측정 빈도**: 일일 자동 스캔(Basic+) — `_enrich_competitor_excerpts` 잡 이미 구현

**표시 방식**:
```
키워드별:  "강남 맛집" → 플레이스 탭 3위 (어제 대비 ±0)
           "강남 삼겹살 맛집" → 플레이스 탭 1위 (▲2)
트렌드:   30일 순위 추이 그래프
```

---

## §7 채널 간 연결 구조

### 7.1 개선 행동 → 채널별 효과 매트릭스

> **ChatGPT 열 해석 주의**: "ChatGPT"는 스캐너(학습 데이터) 기준. 실사용자 ChatGPT.com(Bing 검색)은 구글 비즈니스 프로필이 훨씬 빠름.
> **Gemini 열 해석**: 스캐너(학습 데이터) 기준이나, 실사용 Gemini 앱은 구글 그라운딩으로 수주 내 반영.

| 개선 행동 | 플레이스탭 | AI 브리핑 | AI탭 | ChatGPT (스캐너) | Gemini (스캐너) | Google AI |
|----------|---------|---------|------|---------|--------|-----------|
| 소개글 Q&A 완성 (500자+) | ✅ 즉시 | ✅ 2~4주 | ✅ 즉시 | — | — | — |
| 리뷰 10개+ | ✅ 즉시 | ✅ 2~4주 | ✅ 즉시 | — | — | — |
| 사진 10장+ (카테고리별) | ✅ 즉시 | ✅ 2~4주 | ✅ 즉시 | — | — | — |
| 네이버 블로그 후기 5개+ | ✅ 2~4주 | — | ✅ 2~4주 | — (Bing 영향 제한적) | — | — |
| 14일 이내 소식 게시 | ✅ 즉시 | ✅ 2~4주 | ✅ 즉시 | — | — | — |
| 예약 연동 | ✅ 즉시 | ✅ 2~4주 | ✅ 즉시 | — | — | — |
| JSON-LD 구조화 데이터 | — | — | — | ✅ 3~12개월 | ✅ 3~6개월 | ✅ 2~4주 |
| 구글 비즈니스 프로필 완성 | — | — | — | ✅ 수주 (Bing 경로) | ✅ **2~4주** (그라운딩) | ✅ **2~4주** |
| GBP 포스트 주 1회 | — | — | — | — | ✅ 재크롤 단축 | ✅ 재크롤 단축 |
| Search Console 색인 요청 | — | — | — | — | ✅ 크롤 대기 단축 | ✅ 크롤 대기 단축 |
| NAP 전 플랫폼 일치 | — | — | — | ✅ 신뢰도 ↑ | ✅ 교차검증 통과 | ✅ 교차검증 통과 |
| 구글 지도 리뷰 응답 | — | — | — | — | ✅ freshness 신호 | ✅ freshness 신호 |

### 7.2 우선순위 결정 원칙

```
ACTIVE 업종    → 스마트플레이스 최적화 우선 (AI 브리핑 직결)
LIKELY 업종    → 스마트플레이스 + 구글 비즈니스 프로필 병행 (AI탭·Gemini 대비)
INACTIVE 업종  → 구글 비즈니스 프로필 최우선 (Gemini 수주 효과) + ChatGPT는 장기 전략
```

---

## §8 사용자 안내 문구 표준

### 8.1 채널별 면책 문구 (UI 표시 필수)

```
AI 브리핑:
"네이버 AI 브리핑 노출 여부는 네이버 정책에 따라 변경될 수 있으며,
 측정 시점·기기에 따라 달라질 수 있습니다."

AI탭:
"네이버 AI탭은 현재 베타 서비스 중이며, 전체 확대 시 기준이 변경될 수 있습니다."

ChatGPT:
"ChatGPT 측정은 AI 학습 데이터(컷오프 2024.06) 기반입니다. 실제 ChatGPT.com은
 Bing 웹 검색을 사용하므로 측정 결과와 다를 수 있으며, 단기 개선이 점수에 즉시 반영되지 않습니다."

Gemini:
"Gemini 스캐너 측정은 AI 학습 데이터(컷오프 2025.01) 기반입니다. 실제 Gemini 앱은 Google
 Search 그라운딩을 사용하므로, 구글 비즈니스 프로필·웹사이트 개선 후 2~4주 내 반영이 시작되며
 안정적 인용까지 3~6개월 소요됩니다. (SEO 실무 측정 기준, Google 공식 기간 미발표)"

Google AI Overview:
"Google AI Overview는 현재 서버 환경상 직접 측정이 어렵습니다.
 구글 비즈니스 프로필·JSON-LD·최신 콘텐츠 개선 후 2~4주 내 반영이 시작되며,
 안정적 AI 인용까지 3~6개월이 소요됩니다. (SEO 실무 측정 기준, Google 공식 기간 미발표)"

네이버 일반 검색:
"검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있으며, 본 서비스의 측정은 참고용입니다."
```

### 8.2 LIKELY/INACTIVE 업종 안내 톤

```
LIKELY 업종 사용자:
"현재 AI 브리핑은 음식점·카페 등 일부 업종에서 먼저 제공됩니다.
 고객님 업종은 AI탭(전 업종 대상)을 먼저 최적화하시면 효과적입니다."

INACTIVE 업종 사용자:
"현재 AI 브리핑은 음식점·카페 업종에 집중 제공됩니다.
 Gemini는 구글 비즈니스 프로필 등록으로 수주 내 개선이 가능합니다.
 AI탭(전 업종 대상) 준비와 구글 비즈니스 프로필을 중심으로 최적화를 진행하세요."
```

### 8.3 "measured" vs "estimated" 배지 기준 (scan_result_screens_inspection_v1.0.md 기준)

```
measured: 실제 스캔으로 확인된 값 (in_briefing=True, in_ai_tab=True 등)
estimated: 프롬프트 시뮬레이션 결과 (ChatGPT sample_n, Gemini sample_n)
N/A:       측정 불가 (Google CAPTCHA, 데이터 없음)
```

---

## §9 구현 우선순위 로드맵

### ✅ 완료 (P0) — 2026-05-26, commit c416899

| 작업 | 파일 | 결과 |
|------|------|------|
| Google CAPTCHA 감지 | `google_scanner.py:42–62` | CAPTCHA URL/제목/본문 감지 → `captcha_detected=True, error="captcha_blocked"` 반환 |
| Google 점수 재배분 | `score_engine.py:757–792` | `_is_google_captcha()` 헬퍼 + CAPTCHA 시 나머지 3개 항목(0.90)으로 재배분. `google_captcha_blocked` 플래그 breakdown 추가 |

### ✅ 완료 (P1-A) — 2026-05-26, commit c416899

| 작업 | 파일 | 결과 |
|------|------|------|
| 키워드 순위 카드 AI 연결 문구 | `KeywordRankCard.tsx` | "플레이스 탭 순위 ↑ → AI 브리핑·AI탭 노출 가능성 ↑" 1줄 추가 |
| /guide 네이버 검색 기반 섹션 | `GuideClient.tsx` | `NaverSearchBaseSection` 신규: 6개 체크리스트 + 채널별 효과 배지 |

**검증된 오판 (설계 의도로 확인됨)**:
- "네이버 일반 검색 안내 카드 신규 필요" → 카드 이미 존재, 연결 문구만 없었음 (수정 완료)
- "롱테일 쿼리 네이버 미전달 버그" → `scan.py:2625` 의도된 설계. 짧은 쿼리[0]만 네이버에 전달이 정책

### ✅ 완료 (P1-B) — 2026-05-26, commit 4ae6990

| 작업 | 파일 | 결과 |
|------|------|------|
| ChatGPT Bing 검색 기반 재작성 | `chatgpt-search/page.tsx` | "Bing 검색 기반" + 구글 비즈니스 프로필 최우선 + 네이버 블로그 직접 효과 없음 명시 |
| ChatGPT 학습 데이터 배너 | `ChatGPTDiffCard.tsx` | "학습 데이터 컷오프 2024.06 기반, 단기 변동 없음" 경고 배너 |
| Gemini·ChatGPT 분리 안내 | `GlobalAIBanner.tsx` | Gemini(수주 내 개선 가능) vs ChatGPT(장기 전략) 명확 분리 |
| 소개글 Q&A → AI탭 분리 | `AIProblemDiagnosis.tsx` | INACTIVE 업종 소개글 Q&A 힌트를 "AI탭 효과"로 수정, ChatGPT·Gemini는 구글 비즈니스 프로필 유도 |
| 소개글 → AI탭 효과 수정 | `guide_generator.py:62` | `_intro_missing_msg()` INACTIVE 분기 수정 |
| gap 안내 수정 | `gap_analyzer.py:55–63` | `multi_ai_exposure` 갭 문구: "ChatGPT는 Bing 검색 기반, 네이버 블로그 직접 도움 안 됨" |
| 키워드 제외어 정규화 | `keyword_taxonomy.py` | `_norm_kw()` 유틸 + 전체 excluded 비교에 띄어쓰기 차이 흡수 적용 |
| INACTIVE 업종 AI 카운트 수정 | `AIDiagnosisCard.tsx:127–156` | INACTIVE 업종에서 naver를 AI 노출 카운트·CTA 대상에서 제외 |
| Trial 헤더 분리 | `TrialDetailAccordion.tsx` | "Gemini·ChatGPT 인식 현황" + "Gemini는 콘텐츠로 개선 가능·ChatGPT는 장기 전략" 부제 |

### ✅ 완료 (P2 인프라) — 2026-05-26, commit 902327d

| 작업 | 파일 | 결과 |
|------|------|------|
| AI탭 DOM 셀렉터 강화 | `naver_ai_tab_scanner.py` | 6 → 15개 (5패턴 그룹) + `page.inner_text("body")` 전체 텍스트 폴백 |
| `_name_in_text()` 헬퍼 추가 | `naver_ai_tab_scanner.py` | 공백·특수문자 무시 업체명 매칭 |
| `AiTabPreviewCard.tsx` 3-state 배지 | `AiTabPreviewCard.tsx` | measured·estimated·측정 대기 3상태 분기 완성 |
| `system_status` DB 테이블 | `scripts/supabase_schema.sql` | v6.1 — key/value 런타임 플래그 (ai_tab_enabled 등) |
| `system_status` 마이그레이션 | Supabase SQL Editor | ✅ 2026-05-26 실행 완료. `ai_tab_enabled='true'` (2026-05-20 수동 활성화 유지) |

> **현재 상태**: AI탭 스캔 **이미 활성 중** (`ai_tab_enabled='true'`, DB 기준). 6월 전체 확대 후 비로그인 환경에서 DOM 셀렉터 실측 검증만 남음.

### ✅ 완료 (P3 인프라) — 2026-05-26, commit 902327d

| 작업 | 파일 | 결과 |
|------|------|------|
| Google DataForSEO 게이트 | `google_scanner.py` | `GOOGLE_SCANNER_BACKEND=dataforseo` env var + `_scan_via_dataforseo()` 구현 완료 |
| Gemini 그라운딩 게이트 | `gemini_scanner.py` | `GEMINI_GROUNDING_ENABLED=true` env var + lazy import Tool 구현 완료 |
| `KeywordRankCard.tsx` 30일 트렌드 | `KeywordRankCard.tsx` | Recharts LineChart + 접기/펼치기 토글, PC 160px / 모바일 120px |

**P3 활성화 절차 (구독자 목표 달성 시)**:
```
Google DataForSEO (구독자 50명 이후):
  1. DataForSEO 계정 생성 + 크레덴셜 확보
  2. 서버 .env: DATAFORSEO_LOGIN=xxx DATAFORSEO_PASSWORD=xxx GOOGLE_SCANNER_BACKEND=dataforseo
  3. pm2 restart aeolab-backend

Gemini 그라운딩 (비용 검토 후):
  1. Gemini API 단가 상승분 확인 (그라운딩 활성화 시 과금 증가 가능)
  2. 서버 .env: GEMINI_GROUNDING_ENABLED=true
  3. pm2 restart aeolab-backend
```

### 장기 (잔여 — 구현 미착수)

| 작업 | 파일 | 내용 |
|------|------|------|
| LIKELY 화이트리스트 확장 | `CLAUDE.md` + businesses 등록 UI | skincare·massage·spa·dance·ballet·semi_permanent 6개 추가 시 LIKELY 실효 12개 |
| 네이버 키워드 순위 대시보드 자동화 | `naver_keyword_rank.py` | 일일 순위 추이 차트 (기본 인프라 완성, 스케줄러 잡 이미 존재) |

---

---

## §10 조사 출처 (반영 기간·개선 효과 수치 근거)

> §4 Gemini·§5 Google AI Overview 반영 기간 및 개선 효과 수치는 아래 출처 기반.
> **Google 공식 문서는 "수 일~수 개월 소요 가능"만 명시 — 구체적 AI 반영 기간은 공식 미발표.**

### 공식 문서 (1차 소스)

| 출처 | URL | 확인 내용 |
|------|-----|---------|
| Google Search Central | `developers.google.com/search/docs/appearance/ai-features` | "AI Overviews에 추가 최적화 불필요. 크롤은 수 일~수 개월 소요" |
| Gemini API 공식 문서 | `ai.google.dev/gemini-api/docs/interactions/google-search` | Grounding with Google Search — 학습 컷오프 넘어 실시간 색인 참조 메커니즘 |
| Google I/O 2026 공식 블로그 | `blog.google/products-and-platforms/products/search/search-io-2026/` | AI 에이전트 블로그·뉴스·SNS·실시간 데이터 스캔 방향 확인 |

### SEO 실무자 측정 보고서 (2차 소스)

| 출처 | URL | 확인 내용 | 발행일 |
|------|-----|---------|------|
| **Stackmatix** | `stackmatix.com/blog/google-ai-overview-update-frequency` | **2~4주 반영 핵심 수치** + 24~48시간(권위 도메인) + 60~90일 미니 리프레시 권장 | 2026 |
| **MapRanks** | `mapranks.com/2026/05/25/our-google-business-profile-for-ai-overview` | GBP 개선 후 30~60일 내 초기 가시성 + 3~6개월 안정 인용 | 2026-05-25 |
| **AgencyJet** | `agencyjet.com/blog/google-business-profile-optimization-guide` | **30일 미업데이트 시 AI Overview 가시성 급락 실측** + 콘텐츠 3개월 이내 3배 인용 | 2026 |
| **AuthorityTech** | `authoritytech.io/blog/content-freshness-seo-ai-2026` | **최근 30일 콘텐츠 3.2배 인용** + 전체 인용의 50%가 최근 13주 이내 | 2026-05-27 |
| **LocalFalcon** | `localfalcon.com/blog/whitepaper-studies-the-impact-of-google-ai-overviews-on-local-business-search-visibility` | GBP+리뷰+JSON-LD 교차검증 필요. 30일+ 활동 공백 시 측정 가능 가시성 감소 | 2025 |
| **Risosa/AI100** | `risosa.com/knowledge-base/update-lag` | **5단계 Update Lag 모델** (발행→발견→색인→조립→교차검증) | 2025 |
| **Search Engine Roundtable** | `seroundtable.com/google-ai-overview-lag-gone-41368.html` | 표준 색인 파이프라인과 AI Overview 동기화 확인 (구 지연 해소) | 2025 |
| **LocalDataExchange** | `localdataexchange.com/google-ai-vs-gemini/` | AI Overview(실시간 색인 RAG) vs Gemini 앱(컷오프+선택적 그라운딩) 구조 비교 | 2025 |

### 조사 한계 및 주의사항

```
1. "2~4주", "3~6개월" 수치는 Google 공식 발표가 아닌 SEO 실무자 실측 기반.
   개별 사업장의 도메인 권위·업종·경쟁도에 따라 실제 소요 기간 크게 다를 수 있음.
2. AI Overview 반영률은 쿼리 유형에 따라 큰 차이:
   정보성 쿼리 58% vs 상업적 쿼리 17% (LocalFalcon, 2025-05-21, 60,000쿼리 기준)
3. Gemini 학습 컷오프(2025년 1월)는 공식 확인. 이후 정보는 Search Grounding 의존.
4. 이 수치는 2026-05-30 기준이며, Google의 AI Overview 정책 변경에 따라 갱신 필요.
```

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-05-26 | v1.0 | 최초 작성 — 5채널 노출 기준 + 네이버 일반 검색 개선 계획 통합 |
| 2026-05-26 | v1.1 | 구현 결과 반영 + 오판 정정<br>**P0 완료 확인**: google_scanner.py CAPTCHA 감지, score_engine.py 재배분<br>**P1 완료 확인**: KeywordRankCard 연결 문구, GuideClient NaverSearchBaseSection<br>**§3 ChatGPT 전면 수정**: "학습 데이터 기반" → "스캐너=학습 데이터(컷오프 2024.06) / 실사용=Bing 검색" 이분법 도입<br>**§4 Gemini 전면 수정**: "스캐너=학습 데이터 / 실사용=Google Search 그라운딩(수주 내 반영)" 분리<br>**§7 매트릭스 수정**: 네이버 블로그→ChatGPT 효과 "—"로 정정<br>**§1 LIKELY 주석 추가**: 12개 중 실효 6개 (6개 화이트리스트 미등록)<br>**P1-B 미커밋 항목 9개 문서화** |
| 2026-05-26 | v1.3 | 교차검증 수정 — beauty 업종 ACTIVE 전환 공식 예고(2026.02 컨콜) 추가. 네이버 블로그→Bing 영향 표현 "인덱싱 안 됨→영향 제한적"으로 완화(7개 파일). AIDiagnosisCard "AI 2~4주" 채널별 분리. GlobalAiActionCard "네이버·구글 리뷰" → "구글 리뷰" 분리. FAQSection "2~4주 점수 변화" 채널별 분리. pdf_generator Google AI 노출 보장 표현 제거. |
| 2026-05-30 | v1.4 | **Gemini·Google AI Overview 반영 기간 인터넷 최신 자료 기반 수정** (딥리서치, 8개 소스 교차검증)<br>**§4.1**: Gemini 학습 컷오프 2025.01 명시. "수주 내" → "2~4주 반영 시작, 3~6개월 안정화" 수치화<br>**§4.5**: 반영 대기 기간(2~4주) 중 할 수 있는 조기 노출 방법 단계별 추가 (크롤 신호 가속·NAP 일치·GBP 포스트·Search Console 색인 요청)<br>**§4.6**: 면책 문구 수치화 + "Google 공식 기간 미발표" 명시<br>**§5.1**: Google AI Overview 데이터 구조(RAG, 실시간 색인 기반) + 반영 기간 단계표 + 콘텐츠 신선도 vs AI 인용 가능성 데이터 추가<br>**§5.3**: 반영 대기 중 할 수 있는 행동 매트릭스 + 5단계 Update Lag 모델 추가<br>**§5.4**: 사용자 안내 문구 수치화<br>**§7 매트릭스**: Gemini/Google AI 열에 구체적 기간 + GBP 포스트·Search Console·NAP·리뷰 응답 행 신규 추가<br>**§8.1**: Gemini·Google AI Overview 면책 문구 수치화<br>**§10 신규**: 조사 출처 섹션 (공식 문서 3개 + SEO 실무 보고서 8개 + 조사 한계 명시) |
| 2026-05-26 | v1.2 | P1-B·P2·P3 구현 완료 반영<br>**P1-B 커밋 확정**: commit 4ae6990 (ChatGPT·Gemini 노출 기준 정정 + 전사 UI 일관화)<br>**P2 인프라 완료**: commit 902327d — AI탭 셀렉터 6→15, body 폴백, AiTabPreviewCard 3-state, system_status DB v6.1<br>**P3 인프라 완료**: commit 902327d — DataForSEO 게이트, Gemini 그라운딩 게이트, KeywordRankCard Recharts 30일 트렌드<br>**§2.2 현황 수정**: `ai_tab_enabled='true'` (2026-05-20 이후 이미 활성 중) → env var 우선순위 문서화<br>**§9 재구성**: P1-B/P2/P3 인프라 완료 섹션 분리 + 잔여 장기 작업 정리 |

---

*이 문서가 기준과 다른 구현을 발견하면 코드를 수정하거나 이 문서를 갱신할 것.*
*코드와 문서 간 충돌 시 코드(score_engine.py 단일 소스)가 우선이며, 문서를 코드에 맞게 갱신한다.*
