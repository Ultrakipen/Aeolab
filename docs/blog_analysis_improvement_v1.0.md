# blog-analysis 개선 4건 + 스니펫 버그 수정 (v1.0, 2026-07-04)

> 새 대화창 트리거: `docs/blog_analysis_improvement_v1.0.md 기준으로 작업 진행`
> 부분 진행: `docs/blog_analysis_improvement_v1.0.md 기준으로 작업 1(버그 수정)만 먼저 진행`

---

## 0. 배경 — 확인된 버그 (오판 검증 완료, P1)

`backend/services/blog_analyzer.py`의 데이터 수집은 RSS(`rss.blog.naver.com/{id}`, aiohttp) + 네이버 검색 API(`openapi.naver.com/v1/search/blog.json`)만 사용 (직접 크롤링 금지 — `blog_analyzer.py:4,1131` 주석). 이 중 **검색 API 경로는 제목+150자 캡 스니펫만 반환**하는데(`blog_analyzer.py:1126` 코드 자체 주석), 코드가 이걸 본문 전체인 것처럼 300/500자 기준으로 검사한다.

**근거 (직접 확인 완료)**:
- `blog_analyzer.py:149` — `text_len = len(desc.strip())` (API 경로는 desc가 ~150자 캡)
- `blog_analyzer.py:174-176` — `if text_len < 300:` → API 전용 포스트는 100% 걸림, -15점 고정 감점
- `blog_analyzer.py:1092` — RSS 경로는 `[:300]`로 잘림(캡 아니라 상한 — 실제 300자 미만 글만 정당하게 걸림, API 경로와 달리 오탐 아님)
- `blog_analyzer.py:942-950` — AI 브리핑 준비도 체크리스트 8개 중 "500자 이상 비율" 항목도 같은 `posts_texts`(title+desc, 최대 350자) 사용 → 상시 0건, citation_score의 12.5%가 구조적으로 항상 깎임

**반증 시도**: RSS는 원본 HTML을 담고 있어 태그 제거 전 구조 신호(이미지/소제목/해시태그) 추출이 가능함을 확인. 단 **네이버 블로그 ID 미등록 사업장은 RSS 자체가 없어 API 전용 경로만 남고, 이 경우 개선 효과가 0**임을 인지할 것.

**사용자 피해**: 실제로 800자 넘게 정성껏 쓴 글도 "본문을 300자 이상으로 보강하세요"(`blog_analyzer.py:215-216, 606-607`)라는 오조언이 뜸.

---

## 1. 네이버 차단 대응 관련 — 이번 작업은 무관 (검증 완료)

- 작업 1(RSS 구조 신호 확장)은 **aiohttp로 공개 RSS 피드를 단순 HTTP GET** (`blog_analyzer.py:1058-1060`) — Playwright/브라우저 렌더링이 아니므로 AI 브리핑·AI탭이 겪은 CAPTCHA 차단과 무관. 차단 대응 로직 불필요.
- 나머지 3개 작업(소재 추천/대시보드 카드/점수 시계열)도 전부 기존 DB 재조합이라 네이버 접근 없음.
- **별건 발견 (이번 4건과 무관, 참고용)**: `blog_search_analyzer.py`(네이버 블로그 검색순위 크롤러, Playwright 사용)는 CAPTCHA 감지 로직은 이미 있음(`:17,78-90`, `naver_scanner.py`와 동일 패턴) — 하지만 `PLAYWRIGHT_SEMAPHORE` 미적용(`:14,51` 직접 `async_playwright()` 생성). 이건 "네이버 차단" 문제가 아니라 **동시성/RAM 문제**(메인 스캔과 겹치면 RAM 4GB 서버 위험). NID 쿠키 주입은 불필요해 보임 — 이 파일이 접근하는 `search.naver.com/search.naver?where=blog`는 비로그인 공개 검색 페이지라 AI 브리핑(로그인 세션 필요)과 다른 유형.
  - 핫픽스 필요 시: `blog_search_analyzer.py:51`에 `PLAYWRIGHT_SEMAPHORE` 획득 로직 추가 (별도 작업, 이번 4건과 분리 진행 권장)

---

## 2. 작업 목록 (우선순위 순)

### 작업 1 — 스니펫 버그 수정 + 포스트 구조 신호 확장 (통합)

**목적**: RSS HTML에서 태그 제거 전에 이미지 수/소제목(`<h2-4>`)/해시태그/실제 텍스트 길이를 추출. API 전용 포스트는 "측정 불가" 처리로 오감점 제거.

**백엔드 (`backend/services/blog_analyzer.py`)**:
- `_fetch_naver_rss` (L1054-1112): 태그 제거 전 `img_count`, `heading_count`, `hashtag_count`, `full_text_len` 정규식 추출. 잘림 300→1000으로 확대. 반환에 `source: "rss"` 추가
- `_search_naver_blog_once` (L992-1051): 반환에 `img_count/heading_count/hashtag_count/full_text_len = -1`(측정 불가), `source: "api"` 추가
- `_analyze_single_post` (L131-233): L149 `text_len = item.get("full_text_len", -1)`로 교체, L174-176 `if text_len >= 0 and text_len < 300:`로 조건 변경(측정 가능할 때만 감점). 이미지/소제목/해시태그 긍정 피드백 추가. API 전용 포스트 조언 문구 교체("본문 길이를 직접 확인할 수 없어...")
- `_calc_blog_ai_readiness` (L863-973): 파라미터에 `posts_structs` 추가. 항목4(L912-917)·항목7(L942-950)을 `full_text_len` 기반으로 교체하고 측정 불가 항목 제외. 신규 항목9 "이미지 포함 비율" 추가
- `_analyze_naver_blog` (L1259): `_calc_blog_ai_readiness` 호출에 `all_items[:len(posts_texts)]` 전달

**프론트엔드 (`frontend/app/(dashboard)/blog-analysis/BlogClient.tsx`)**:
- `PostDetail`에 `img_count/heading_count/full_text_len` 추가
- 포스트 카드에 긍정 배지("이미지 n장", "소제목 있음", "해시태그 n개") + "측정 불가" 회색 라벨
- `ai_readiness_items`의 `unavailable: true` 항목 별도 시각 처리

**DB 변경**: 없음 | **난이도**: 중 (3-4h) | **리스크**: 낮음 (fallback -1로 기존 동작 유지) | **비용**: 0원

---

### 작업 2 — 소재 추천 강화

**목적**: 경쟁사 keyword_gap + 미커버 키워드로 "이번 달 블로그 주제" 3-5개 추천. 신규 API 비용 없음.

**백엔드**:
- `blog_analyzer.py` 신규 함수 `_generate_topic_suggestions(missing_keywords, competitor_keyword_gaps, region, category, covered_keywords)` — 경쟁사 갭 우선 → 미커버 키워드 → 의도어("추천"/"가격"/"후기") 조합 → 중복 제외 → 최대 5개. 반환 `{topic, reason, priority, source}`
- `_analyze_naver_blog` 마지막에 호출, `topic_suggestions_v2` 키로 추가
- `blog.py` `analyze_blog_endpoint`(L50): 중간 변수로 `competitor_keyword_gaps` 보존해 전달

**프론트엔드**:
- `TopicSuggestionV2` 인터페이스 추가, `BlogAnalysisResult.topic_suggestions_v2` 추가
- 신규 컴포넌트 `TopicSuggestionsV2Card` — 복사 버튼 + 출처 배지, PC 3열/모바일 1열

**DB 변경**: 없음 | **난이도**: 낮음 (2h) | **리스크**: 없음 | **비용**: 0원

---

### 작업 3 — 문서화된 미구현 2건

> 원 설계: `docs/ai_exposure_standard_and_naver_seo_v1.0.md:540-559`

**3-A. 대시보드 "네이버 검색 기반 강화 현황" 카드**
- 신규 엔드포인트 `GET /api/report/naver-seo-strength/{biz_id}` (`backend/routers/report.py`) — `blog_post_count/keyword_coverage`, `smart_place_completeness_result`, `score_history`의 `blog_crank_score`/`keyword_rank_avg` 30일 시계열 집계, 30분 캐시, `@require_plan("basic")`
- 신규 컴포넌트 `frontend/components/dashboard/NaverSearchStrengthCard.tsx` — 순위는 텍스트 레이블(숫자 노출 금지), 블로그 언급 추이 LineChart, 스마트플레이스 체크 요약, PC 2열/모바일 1열
- `dashboard/page.tsx`에 InsightZone 하단 추가
- ⚠️ **사전 확인 필요**: 서버 `score_history.blog_crank_score`가 실제로 값이 채워져 있는지 SSH로 `SELECT COUNT(*) FROM score_history WHERE blog_crank_score IS NOT NULL` 실측 후, 비어있으면 "데이터 수집 중" fallback

**3-B. `/guide` 페이지 "네이버 일반 검색 최적화" 섹션**
- `GuideClient.tsx`에 `NaverSearchOptimizationSection` 추가 — §1 플레이스탭 체크리스트(업종 분기) §2 리뷰 유도 QR(기존 API 재활용) §3 14일 포스팅 캘린더 §4 키워드 순위 참조 §5 AI검색 연결 설명
- INACTIVE 업종은 §1 대신 "정보형 콘텐츠 전략" 안내로 분기
- 면책 문구 필수: "네이버 검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있으며..."

**DB 변경**: 없음 | **난이도**: 3-A 중-상(4-5h), 3-B 낮음-중(2-3h) | **리스크**: 3-A 중간(데이터 공백 가능성) | **비용**: 0원

---

### 작업 4 — 블로그 점수 추이 시계열

**목적**: 블로그 진단 점수(citation_score, keyword_coverage) 30일 추세. 기존 `score_history`는 메인 스캔 주기용이라 블로그 분석(24h 쿨다운, 별도 트리거) 주기와 안 맞음 → 별도 테이블 필요.

**DB (`scripts/supabase_schema.sql`에 추가, Supabase SQL Editor 실행)**:
```sql
CREATE TABLE IF NOT EXISTS blog_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  analyzed_date DATE NOT NULL,
  citation_score FLOAT NOT NULL,
  keyword_coverage FLOAT,
  post_count INT,
  freshness VARCHAR(10),
  UNIQUE(business_id, analyzed_date)
);
CREATE INDEX IF NOT EXISTS idx_blog_score_history_biz_date
  ON blog_score_history(business_id, analyzed_date DESC);
ALTER TABLE blog_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_blog_score_history" ON blog_score_history
  USING (EXISTS (SELECT 1 FROM businesses b WHERE b.id = blog_score_history.business_id AND b.user_id = auth.uid()));
CREATE POLICY "own_blog_score_history_insert" ON blog_score_history
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM businesses b WHERE b.id = blog_score_history.business_id AND b.user_id = auth.uid()));
```

**백엔드 (`backend/routers/blog.py`)**:
- `analyze_blog_endpoint` 성공 저장 블록에 `blog_score_history` upsert (`on_conflict="business_id,analyzed_date"`, 실패 시 `_logger.warning`, silent pass 금지)
- 신규 엔드포인트 `GET /api/blog/score-history/{business_id}` — 30일 조회, `@require_plan("basic")`

**프론트엔드 (`BlogClient.tsx`)**:
- `BlogScoreHistoryPoint` 인터페이스, `score_history` 추가
- 신규 컴포넌트 `BlogScoreTrendChart` — Recharts LineChart 2선(citation_score, keyword_coverage). **주의**: citation_score는 AI Visibility 금지 대상(`total/track1/track2/unified_score`) 밖이지만 일관성 위해 Y축 숫자 대신 구간 배경(낮음/보통/양호) 권장. 데이터 2건 미만 시 "분석 2회 이상 시 추세 차트 표시" 안내

**난이도**: 4-5h | **리스크**: 낮음 (독립 테이블) | **비용**: 0원

---

## 3. 플랜 제한

| 기능 | 레벨 |
|---|---|
| 작업 1 (버그 수정) | 기존 blog_monthly 한도 그대로 |
| 작업 2 (소재 추천) | Basic+ (blog 분석 응답 포함, 별도 한도 불필요) |
| 작업 3-A/3-B | Basic+ (`@require_plan("basic")`) |
| 작업 4 | Basic+ |

## 4. 권장 구현 순서

```
1. [DB] blog_score_history 테이블 Supabase SQL Editor 실행
2. [백엔드] 작업 1 — blog_analyzer.py 버그 수정 (기반 작업)
3. [백엔드] 작업 2 — _generate_topic_suggestions (작업 1과 같은 파일, 순차)
4. [백엔드] 작업 4 — blog.py upsert + GET 엔드포인트 (1번 완료 후)
5. [백엔드] 작업 3-A — report.py naver-seo-strength 엔드포인트 (4와 병렬 가능)
   ※ 착수 전 SSH로 score_history.blog_crank_score 데이터 존재 여부 실측
6. [배포] 백엔드 pm2 restart (2~5 묶어서 1회, SSH grep으로 반영 확인 필수)
7. [프론트엔드] 작업 1 UI (배지) → 2 UI(TopicSuggestionsV2Card) → 4 UI(BlogScoreTrendChart) →
   3-A UI(NaverSearchStrengthCard) → 3-B UI(GuideClient 섹션) — 서로 병렬 가능
8. [빌드/배포] npm run build + pm2 restart aeolab-frontend (md5 선확인 → scp → 빌드 → 재시작)
9. [검증] 라이브 실측 — posts_detail 배지 표시, "본문 300자 미만" 오감점 제거 확인,
   blog_score_history 테이블 행 삽입 확인 (Supabase Table Editor)
10. git 커밋 (scp 배포 후 필수, push는 선택)
```

## 5. 별도 핫픽스 후보 (이번 4건과 분리, 판단 필요)

`blog_search_analyzer.py:51` — `PLAYWRIGHT_SEMAPHORE` 미적용. 메인 스캔과 블로그 검색순위 분석이 동시 실행되면 RAM 4GB 서버에서 스파이크 위험. 이번 작업과 무관하게 별도 세션에서 처리 권장.
