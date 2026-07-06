# blog-analysis 개선 v2.0 — 검색량 연동 + 잔여 개선안 (2026-07-06)

> 새 대화창 트리거: `docs/blog_analysis_improvement_v2.0.md 기준으로 1순위(검색량 연동)부터 진행`
> v1.0(`docs/blog_analysis_improvement_v1.0.md`, 2026-07-04)에서 이미 완료된 4건은 §1 참조. 이 문서는 그 다음 단계.

---

## 0. 이 문서를 쓰게 된 계기

블로그 관리 페이지(`/blog-analysis`)를 "더 전문적인 수준"으로 만들려면 뭘 더 하면 되는지 점검한 결과. 오판 방지를 위해 각 항목은 실제 코드를 직접 읽고 확인한 근거만 남김(추정 없음).

---

## 1. 이미 완료된 개선 (v1.0, 전부 서버 반영 확인됨)

md5 비교 + SSH grep으로 서버 반영 재확인 완료(2026-07-06):

| 작업 | 커밋 | 핵심 내용 |
|---|---|---|
| 스니펫 오감점 버그 수정 | `04db98f` | API 전용 포스트(150자 캡)를 본문 전체처럼 300자 기준 검사하던 버그 → `full_text_len=-1`(측정 불가) 처리로 오감점 제거. RSS 경로에서 이미지/소제목/해시태그 긍정 배지 추가 |
| 소재 추천 강화 | `c9c0774`, `106b096` | 경쟁사 갭 + 미커버 키워드로 소재 3~5개 추천. 이후 "지금 당장 개선" 카드와 중복 노출되던 버그 발견·수정 |
| 블로그 점수 시계열 | `2d9423d` | `blog_score_history` 테이블 신설, 30일 추세 차트 |
| 네이버 검색 강화 현황 카드 | `9b8e170`, `a28faa8` | `/api/report/naver-seo-strength/{biz_id}`. 설계 당시 `blog_crank_score`도 쓰려 했으나 **실제 INSERT가 없어 100% NULL임을 실측 확인 후 폐기**, keyword_rank_avg + 블로그 발행 추이만 사용하도록 축소. 배포 직후 기존 `NaverSeoBaseCard`와 제목·체크리스트 중복 발견해 즉시 정리 |

**별건 완료 (이 세션)**: `backend/services/naver_searchad.py`(검색광고 API 클라이언트)의 `"< 10"` 저검색량 문자열 파싱 실패 → 배치 전체 붕괴 버그 수정, 서버 반영·실제 키워드(카페=월 104만회 등) 재검증 완료, git `acf9450` 커밋 완료. **이 수정이 아래 §2 1순위 작업의 전제 조건**이다 (이 버그가 있는 상태로 검색량을 연동했다면 실서비스에서 조용히 빈 값만 나왔을 것).

---

## 2. 신규 발견 — 오판 검증 통과분만 기재

각 항목: **근거(file:line 직접 확인)** + **반증 시도** 포함.

### 2-A. [1순위] 소재 추천에 실제 검색량 신호가 없음

**근거**: `backend/services/blog_analyzer.py:794` `_generate_topic_suggestions()` — docstring에도 "외부 API 호출 없음, 문자열 조합만 사용"이라 명시. `grep -n "monthly_volume|searchad|get_searchad_client|get_volumes_with_cache" backend/services/blog_analyzer.py backend/routers/blog.py` → 매치 0건.

**반증 시도**: "혹시 프론트에서 별도로 검색량을 붙이나?" → `BlogClient.tsx`의 `TopicSuggestionV2` 인터페이스(§1 작업2 설계)에도 `monthly_volume` 필드 없음. 반증 실패 → 확정.

**왜 문제인가**: 월 5회 검색되는 키워드와 월 10만회 검색되는 키워드를 구분 없이 똑같은 우선순위로 추천 중. `naver_searchad.py`는 이제 정상 동작하는데 블로그 소재 추천에는 연결이 안 돼 있어 이미 있는 인프라를 놀리는 상태.

**구현 스펙**:
- `backend/routers/blog.py:182-188` (`topic_suggestions_v2 = _generate_topic_suggestions(...)` 호출 직후, `analysis_json` 딕셔너리 구성(L193) 이전)에 삽입:
  ```python
  if topic_suggestions_v2:
      try:
          from services.naver_searchad import get_searchad_client
          topics_kw = [t["topic"] for t in topic_suggestions_v2 if t.get("topic")]
          ad_client = get_searchad_client()
          volumes = await ad_client.get_volumes_with_cache(topics_kw, biz_row.get("category", ""), supabase)
          for t in topic_suggestions_v2:
              vol = volumes.get(t["topic"])
              t["monthly_volume"] = vol.get("monthly_total") if vol else None
          # 검색량 내림차순 정렬(None은 맨 뒤), 단 competitor_gap(high) 우선순위는 유지
          topic_suggestions_v2.sort(
              key=lambda t: (t.get("priority") != "high", -(t.get("monthly_volume") or -1))
          )
      except Exception as e:
          _logger.warning(f"topic suggestions 검색량 병합 실패: {e}")
  ```
  - 주의: `_generate_topic_suggestions`가 만드는 `topic` 필드는 `"{city} {kw} {intent}"` 형태 복합 문구라 SearchAd 검색량 조회 정확도가 떨어질 수 있음 — 검색량 조회는 원본 키워드(`kw`)로 하고 표시만 `topic` 문구를 쓰는 방식이 더 정확할 수 있음. 착수 시 `_generate_topic_suggestions` 반환에 원본 키워드 필드(`base_keyword`)를 추가해서 그걸로 조회하는 방향 권장.
- 프론트 `frontend/app/(dashboard)/blog-analysis/BlogClient.tsx`: `TopicSuggestionV2` 인터페이스에 `monthly_volume: number | null` 추가, `TopicSuggestionsV2Card`에 `KeywordTrendChart.tsx`와 동일한 "· 월 XXX회" 배지 패턴 재사용(`frontend/components/dashboard/KeywordTrendChart.tsx:151-159` 참조).
- **점수 표시 원칙 확인**: `monthly_volume`은 AI Visibility 점수(`total/track1/track2/unified_score`)가 아니라 실측 검색량 숫자이므로 CLAUDE.md의 "점수 숫자 노출 금지" 규정 대상 아님 — `KeywordTrendChart.tsx`가 이미 같은 성격의 숫자를 노출 중인 것과 동일 취급.

**DB 변경**: 없음(`keyword_volumes` 테이블 재사용) | **난이도**: 낮음(2~3h) | **비용**: 캐시 히트 시 0원, 미스 시에도 배치 API 1회 | **리스크**: 낮음(실패 시 `monthly_volume: None`으로 graceful degradation, 기존 동작 그대로 유지)

---

### 2-B. [후순위] 경쟁사 비교가 "저장된 점수/키워드"만 재활용, 실시간 구조 비교 없음

**근거**: `_build_competitor_comparison()`(`blog_analyzer.py:727-767` 직접 확인) — `competitor_blogs`로 들어오는 건 `competitors` 테이블의 `blog_analysis_json` 컬럼(과거 저장된 분석 결과)뿐. 이미지 수·소제목 수 같은 구조 신호는 비교 항목에 없고 `score`, `post_count`, `freshness`, `keyword_coverage`만 비교.

**반증 시도**: "혹시 실시간 크롤링이 다른 곳에서 이뤄지나?" → `blog_search_analyzer.py:14,51`에 `async_playwright()` 직접 생성 코드 확인(경쟁사 블로그 검색순위용, 구조 비교용 아님). 이 파일은 `PLAYWRIGHT_SEMAPHORE` 미적용 상태(v1.0 문서에서도 동일 발견, 이번에 재확인) — 별개 이슈로 남겨둠.

**보류 사유**: 실시간 구조 비교를 하려면 경쟁사 블로그 크롤링이 추가로 필요한데, 이는 RAM 4GB 서버에서 신중해야 하는 영역(`blog_search_analyzer.py`의 세마포어 미적용 이슈와 얽힘). **서버 업그레이드 이후 착수 권장.**

---

### 2-C. [후순위] 콘텐츠 품질 채점이 전부 문자열 휴리스틱

**근거**: `_analyze_single_post()`(`blog_analyzer.py:131-233`, 이번 세션 §1 작업1에서 직접 재검토) — 판정 기준이 글자 수(`full_text_len`)·업종 키워드 매칭·의도어 포함 여부·이미지/소제목/해시태그 개수뿐. 실제 문장 품질·경험담 신뢰도(E-E-A-T) 판단 로직 없음.

**반증 시도**: "Claude가 이미 이 데이터를 채점하나?" → `guide_generator`가 blog_analysis_json을 프롬프트에 활용은 하지만(가이드 생성용), 포스트 개별 품질 점수를 Claude가 매기는 로직은 없음(`blog_analyzer.py`는 Claude API 호출 없이 순수 규칙 기반). 반증 실패 → 확정.

**보류 사유**: LLM 기반 포스트별 품질 채점을 추가하려면 분석마다 AI 호출이 늘어남. BEP(구독자 20명) 미달 상태에서 비용 구조상 우선순위 낮음 — **구독자 확보 후 검토**.

---

### 2-D. [참고, 착수 불필요] 포스트별 실제 성과(AI 인용·순위 변동) 연결 없음

**근거**: `grep -rn "blog_score_history\|blog_post_id\|source_post" backend/*.py` → `report.py`, `blog.py`에서만 매치, `blog_analyzer.py`엔 없음. `blog_score_history`는 집계 컬럼(`citation_score`, `keyword_coverage`, `post_count`, `freshness`)만 있고 포스트 단위 FK 없음(스키마 §작업4, v1.0 문서 참조).

**보류 사유**: 의미 있으려면 데이터가 충분히 쌓여야 함(현재 이제 막 적재 시작). **시기상조 — 데이터 축적 후 재검토.**

---

## 3. 권장 착수 순서 (새 대화창에서)

```
1. [사전 확인] 이 문서 §2-A 재검증 — naver_searchad.py 커밋(acf9450) 서버 반영 여부 SSH grep
   (2026-07-06 커밋 시점엔 로컬 git만 반영, 서버 파일은 이미 scp로 먼저 반영돼 있었음 — 
   git 커밋과 서버 배포 시점이 다르므로 혼동 주의)
2. [백엔드] blog.py에 검색량 병합 로직 추가 (§2-A 스펙)
   - _generate_topic_suggestions에 base_keyword 필드 추가 여부 먼저 결정
3. [배포] SSH grep으로 반영 확인 → pm2 restart aeolab-backend → error.log 0건 확인
4. [프론트] BlogClient.tsx TopicSuggestionV2에 monthly_volume 배지 추가
5. [빌드/배포] md5 선확인 → scp → npm run build → pm2 restart aeolab-frontend
6. [검증] 라이브 브라우저 테스트 — 소재 추천 카드에 실제 "월 XXX회" 숫자 노출 확인,
   검색량 낮은 순으로 안 뜨는지(내림차순 정렬) 확인
7. git 커밋 (scp 배포 후 필수, push는 선택)
```

§2-B/2-C/2-D는 이번 착수 대상 아님 — 트리거 조건(서버 업그레이드 / 구독자 확보 / 데이터 축적) 충족 시 재검토.
