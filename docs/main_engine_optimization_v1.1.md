# 메인 엔진 최적화 작업 계획 v1.1 — 검증 후 갱신본

> **작성일: 2026-05-17 (v1.0 초안)**
> **갱신일: 2026-05-17 (v1.1 — 실제 코드 검증 후 오판 수정)**
> **목적**: AEOlab 메인 5대 엔진을 네이버 AI탭(2026-04-27 베타)·AI 브리핑(2025.08 확정 + 2026 확대) 최신 사양에 정합 + 실제 구현 갭만 추출
> **선행 작업**: `docs/naver_ai_tab_개발로드맵_v1.1.md` P0+P1-A+P1-C 완료 (2026-05-17)

---

## 0. v1.0 → v1.1 변경 요약 (검증 결과 반영)

| 항목 | v1.0 주장 | v1.1 검증 결과 | 조치 |
|------|---------|--------------|------|
| §3.1 별점 가중치 미반영 | "검증·반영 필요" | ❌ **오판** — `score_engine.py:288-298` 이미 50% 가중치 반영(`ar/5×50`). naver_place_stats.py:80-118 자동 파싱 + DB 갱신 완료 | §3.1을 **사진 카테고리 단일 소스 통합**으로 교체 |
| §3.4 JSON-LD 미구현 | "자동 생성·검증 강화" | ⚠️ **부분 오판** — `schema_gen.py:14-93` 생성 엔드포인트 + `website_checker.py` 크롤링 + `score_engine.calc_schema_seo` 3중 체계 이미 구현. UI 카드만 부족 | §3.4 범위 축소 — UI 카드 추가만 잔여 작업 |
| §3.2 D.I.A. 미적용 | "강화 필요" | ✅ **갭 확인** — `_INTRO_PROMPT_TMPL`(guide_generator.py:1207~)에 Q&A 5개·{target_length}자 강제는 있으나 D.I.A. 5요소·적시성 마커·LSI 명시 없음 | 그대로 진행 |
| §3.3 소식 미작성 알림 | "미구현" | ✅ **갭 확인** — `last_post_at` 컬럼 0건 + 전용 `inactive_post_alert_job` 잡 0건. 현재는 `has_recent_post` 수동 체크박스만 | 그대로 진행. **단, has_recent_post 사용자 체크박스 한계 인정 — last_post_at은 사용자 액션 기반(스마트플레이스 자동 크롤은 후순위)** |
| §3.5 사진 가이드 부족 | "업종별 구체 가이드 추가" | ✅ **갭 확인** — score_engine.py:488-498 missing 힌트 외 구체 가이드 사전 부재 | 그대로 진행 |
| **(신규)** 사진 카테고리 단일 소스 | v1.0 미언급 | ⚠️ **신규 갭** — 백엔드 9업종(fitness/pet 포함) vs 프론트 7업종 + 카테고리명 다름(`음식·음료/메뉴/풍경` vs `음식-음료/메뉴/풍경/매장/결과`). 향후 변경 시 양쪽 누락 위험 | **§3.1로 신규 편입** |

### 새 갭 발견 (코드 검증 중 추가)
1. **`*_server.py` 잔재 파일 위험** — `backend/routers/scan.py.server_backup`, `scheduler/jobs_server.py` 등 사본 다수 존재. 작업 시 정답 파일(main.py import 경로)만 수정 필요 — 2026-05-01 사고 패턴 재발 방지
2. **사진 카테고리 명칭 표준 불통일** — `·` 중점 vs `-` 하이픈 모두 사용. score_engine.py:502-503에서 양쪽 정규화 처리 중이지만, 단일 표준 필요
3. **D.I.A. 사후 검증 함수 부재** — 생성된 콘텐츠가 D.I.A. 5요소를 충족하는지 자동 검증 인프라 없음. 사용자가 직접 손볼 동기 없음

---

## 1. 사용 지침

### 새 대화창 트리거 명령
```
docs/main_engine_optimization_v1.1.md 읽고 Phase 1 §3.1부터 순차 진행
```

### 부분 작업 트리거
```
docs/main_engine_optimization_v1.1.md 읽고 §3.2만 진행 (D.I.A. 프롬프트 강화)
docs/main_engine_optimization_v1.1.md 읽고 §3.3 진행 (소식 14일 알림)
```

### 작업 원칙 (재발 방지)
1. **에이전트 위임 시 메인 세션 SSH grep 검증 필수** (2026-05-01 사고 사례)
2. **사용자 노출 데이터는 실측만, 추정·더미 금지** (CLAUDE.md 작업 지침 §7)
3. **점수 합계 100점 보존 — 가중치 변경 시 자동 검증 통과 확인**
4. **단일 진실 동기화**: backend `BRIEFING_ACTIVE_CATEGORIES` ↔ frontend `BRIEFING_ACTIVE` + **신규: `_EXPECTED_PHOTO_CATS` ↔ `EXPECTED_CATEGORIES`** 한쪽 변경 시 양쪽 동시 수정

---

## 2. 메인 엔진 5대 영역 진단 (2026-05-17 v1.1 검증 후)

### ① 측정 엔진 (Scan) — ⚠️ 격차 大 (v1.0 유지)
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| AI 브리핑 실측 | `naver_scanner.py:103-107` excerpt 추출 작동(첫 매칭 라인 120자) | position·frequency 미추적 |
| AI탭 실측 | ❌ 미구현 | 6월 전체 확대 후 가능 |
| `ai_citations` 컬럼 | scan_id·platform·query·mentioned·excerpt·sentiment·mention_type | **position·frequency 컬럼 부재** |
| Google AI Overview | iwinv IP CAPTCHA 사유 2026-05-14 제거 | DataForSEO 재도입(50명 후) |
| ChatGPT/Gemini | API 정상 (50/50) | 실시간 vs 학습 데이터 분리 미구현 |

### ② 점수 엔진 (Score) — ✅ 부분 정합 (v1.0보다 격차 작음)
| 항목 | 검증 결과 |
|------|---------|
| Track1 `calc_review_quality` | ✅ `rc/200×50 + ar/5×50 + receipt_bonus` — 별점 50% 반영됨 |
| Track1 `calc_smart_place_completeness` | ✅ 100점 보정(2026-04-30 v4.1) + has_intro 자동 보강 |
| Track2 `calc_schema_seo` | ✅ has_json_ld 40 + local_business 20 + og 20 + viewport 10 + place_id 10 |
| 별점 자동 파싱 | ✅ `naver_place_stats.py:80-118` 작동 |
| 사진 카테고리 missing | ✅ `score_engine.py:484-509` 9업종 missing 힌트 |
| **사진 사전 백/프론트 불일치** | ⚠️ **신규 갭** — 백 9업종 vs 프론트 7업종 |

### ③ 가이드 엔진 (Guide) — ⚠️ D.I.A. 명시 강제 부족 (v1.0 유지)
- `_INTRO_PROMPT_TMPL`: Q&A 5개·{target_length}자 강제 OK, **D.I.A. 5요소·적시성·LSI 명시 없음**
- C-rank 4축 체크리스트는 가이드 UI에만 있고 콘텐츠 생성에는 미적용

### ④ 콘텐츠 생성 엔진 (Generator) — ⚠️ 적시성·LSI·D.I.A. 사후 검증 부재
- 적시성 표기 `[YYYY년 M월 업데이트]` 자동 삽입 인프라 없음
- LSI 키워드 자연 배치 알고리즘 없음 (grep 0건)
- 생성 후 D.I.A. 충족도 검증 함수 없음

### ⑤ 행동·결과 피드백 루프 (Loop) — ✅ 부분 작동 (v1.0보다 양호)
- `business_action_log` + `services/score_attribution.py:149-199` `compute_attributions()` — ±7일 매칭 작동
- 6개 자동 잡(_auto_log_score_change 등) 작동
- 단, **소식 작성 시점 자동 추적(last_post_at)** + **A/B 효과 학습**은 부재

---

## 3. Phase 1 상세 작업 (검증 후 갱신 — 즉시 가능)

### 3.1 사진 카테고리 사전 단일 소스 통합 (4시간, P0) ⬅️ 신규
> **v1.0 §3.1 별점 작업은 오판으로 삭제. 신규로 사진 사전 통합 작업으로 교체.**

**근거**:
- 백엔드 `score_engine.py:488-498` 9업종 (`restaurant/cafe/bakery/bar/accommodation/beauty/nail/fitness/pet`)
- 프론트 `PhotoCategoryCard.tsx:5-13` 7업종 (fitness/pet 누락)
- 카테고리명 불일치: 백 `풍경/객실/전망/수영장/부대시설/시술/헤어/인테리어/네일/디자인/시설/운동/반려동물` vs 프론트 `음식-음료/메뉴/풍경/객실/전망/수영장/시술/매장/결과`

**작업 절차**:
1. `backend/services/photo_categories.py` 신규 — 단일 진실 소스 (Pydantic model + 정규화 함수)
2. `score_engine.py:488-498` `_EXPECTED_PHOTO_CATS` 제거 → photo_categories import
3. `PhotoCategoryCard.tsx`에서 백엔드 응답으로 카테고리 받기 (또는 frontend/lib/photoCategories.ts 미러)
4. fitness/pet 카테고리 카드 노출 활성화

**검증**: `grep -n "_EXPECTED_PHOTO_CATS\|EXPECTED_CATEGORIES" backend/ frontend/` 단일 출처 확인

**예상 효과**: 사진 카테고리 누락 검출 정확도 +20%, 향후 카테고리 추가 시 단일 파일만 수정

---

### 3.2 콘텐츠 생성 D.I.A.·LSI·적시성 강화 (1주, P1)

**파일 위치**:
- `backend/services/guide_generator.py:1207~1235` `_INTRO_PROMPT_TMPL`
- `backend/services/guide_generator.py:1237~1264` `_TALKTALK_FAQ_PROMPT_TMPL`
- `backend/services/keyword_taxonomy.py` (LSI 키워드 소스)

**작업 절차**:

1. **`_INTRO_PROMPT_TMPL` 강화** — D.I.A. 5요소 + 적시성 + LSI 명시:
   ```
   [D.I.A. 5요소 적용 - 필수]
   D(Diversity): 단순 키워드 나열 금지, {lsi_keywords}를 자연스럽게 본문에 포함
   I(Information richness): 가격·시간·위치·방법·결제 등 구체 수치 5개 이상
   A(Authority): 경력·자격·수상·인증 1개 이상 명시 (없으면 운영 햇수)
   적시성: 마지막 문단에 "[{current_year}년 {current_month}월 기준]" 자동 삽입
   독창성: 다른 가게 소개글과 차별점 1개 이상 명시
   ```

2. **`generate_naver_intro` 시그니처 확장**:
   ```python
   async def generate_naver_intro(
       biz_name: str, category_label: str, region: str,
       keywords: list, target_length: int = 400,
       lsi_keywords: list[str] | None = None,  # 신규
   ) -> str:
   ```

3. **호출부 `routers/business.py:817-829`에 LSI 주입**:
   ```python
   from services.keyword_taxonomy import get_all_keywords_flat
   lsi = get_all_keywords_flat(category)[:8]
   text = await generate_naver_intro(..., lsi_keywords=lsi)
   ```

4. **D.I.A. 사후 검증 함수** `backend/services/content_validator.py` 신규 (선택):
   ```python
   def validate_intro_dia(text: str, keywords: list, lsi: list) -> dict:
       return {
           "diversity": _check_lsi_coverage(text, lsi),
           "information": _count_specific_info(text),  # 숫자·시간·가격 추출
           "authority": _check_authority_phrases(text),
           "timeliness": bool(re.search(r"\[20\d{2}년 \d{1,2}월", text)),
           "originality": _check_template_uniqueness(text),
           "score": ...,  # 0~100
       }
   ```

**DB 영향**: 없음 (선택 컬럼 `naver_intro_dia_score JSONB` 추가 가능)

**검증**: 베타 1명 소개글 재생성 → 적시성 마커 자동 삽입 + LSI 8개 중 4개 이상 포함

**예상 효과**: AI 브리핑 인용 가능성 +30~50%

---

### 3.3 소식 미작성 14일 알림 (2일, P1)

**근거 확인**: `last_post_at` 코드 0건. `has_recent_post`는 사용자 체크박스만(`score_engine.py:322`, `action_tools.py:296`)

**파일 위치**:
- `backend/scheduler/jobs.py` — `inactive_post_alert_job()` 신규
- `backend/services/kakao_notify.py` — `send_post_remind()` 신규 함수
- `scripts/supabase_schema.sql` — `businesses.last_post_at TIMESTAMPTZ` ALTER

**작업 절차**:
1. DB 컬럼: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_post_at TIMESTAMPTZ`
2. `has_recent_post=true` 체크박스 토글 시 `last_post_at = NOW()` 자동 갱신 (routers/business.py에서 일관 처리)
3. 신규 잡 추가:
   ```python
   async def inactive_post_alert_job():
       """14일 이상 소식 미작성 사업장에 카카오 알림."""
       try:
           supabase = get_supabase()
           cutoff = datetime.now(timezone.utc) - timedelta(days=14)
           res = supabase.table("businesses").select(
               "id, user_id, name, last_post_at"
           ).or_(
               f"last_post_at.lt.{cutoff.isoformat()},last_post_at.is.null"
           ).execute()
           for biz in res.data or []:
               key = f"post_remind_{biz['id']}_{cutoff.date().isoformat()}"
               if await _is_already_sent(key):
                   continue
               await send_post_remind(biz["user_id"], biz["name"])
               _log_notification(key)
       except Exception as e:
           _logger.warning(f"inactive_post_alert_job failed: {e}")

   scheduler.add_job(inactive_post_alert_job, "cron", hour=9, minute=10)
   ```
4. 카카오 템플릿: 기존 `AEOLAB_ACTION_01` 재활용 (메시지 변수에 "소식 14일 미작성" 삽입)

**DB 영향**:
- `businesses.last_post_at TIMESTAMPTZ` 컬럼 추가
- `notifications` idempotency_key 활용 (기존 패턴 재사용)

**검증**:
1. ALTER 실행
2. 베타 1명 강제 `has_recent_post=true` 토글 → `last_post_at` 자동 갱신 확인
3. SSH SQL로 `last_post_at` NULL/15일전 행 가짜 생성 → 다음 09:10 KST 잡 실행 시 알림 발송 로그

**예상 효과**: 소식 작성 빈도 +20~40%

---

### 3.4 JSON-LD UI 카드 추가 (1일, P2) — 범위 축소

**v1.0 작업 대비 변경**: 자동 생성·점수·크롤링 검증은 이미 작동. UI 카드만 부족.

**기존 구현 위치 (확인 완료)**:
- 생성: `routers/schema_gen.py:14-93` `POST /api/schema/generate`
- 크롤링: `services/website_checker.py` (8초 timeout)
- 점수: `score_engine.py:608-622` `calc_schema_seo()`

**잔여 작업**:
- `frontend/components/dashboard/SchemaCheckCard.tsx` 신규
- 대시보드에서 schema_seo 점수 + 부족 항목 + "JSON-LD 자동 생성" CTA 버튼
- 클릭 시 `POST /api/schema/generate` 호출 → 결과 모달 + 복사 버튼

**DB 영향**: 없음 (캐시 불필요 — 스캔 결과 활용)

**검증**: 베타 1명 schema_seo 점수 < 80인 경우 카드 노출

**예상 효과**: schema 설정 행동 전환율 +10~20%

---

### 3.5 사진 카테고리 업종별 구체 가이드 (2~3일, P2)

**파일 위치**:
- `backend/services/photo_guide.py` 신규
- `backend/routers/report.py` — `GET /api/report/photo-guide/{category}` 추가
- `frontend/components/dashboard/PhotoCategoryCard.tsx` — 모달 추가

**작업 절차**:
1. `photo_guide.py` 사전:
   ```python
   PHOTO_GUIDES: dict[str, dict[str, dict]] = {
       "restaurant": {
           "음식·음료": {
               "description": "대표 메뉴 3개를 정면 위에서 자연광으로 촬영",
               "examples": ["메인 요리 단품", "반찬 세팅", "음료 잔"],
               "tips": ["접시 가장자리 잘리지 않도록", "조명 그림자 피하기"],
           },
           "메뉴": {...},
           "풍경": {...},
       },
       ...
   }
   ```
2. 정적 데이터 — DB 없음, AI 호출 없음
3. `PhotoCategoryCard.tsx`에서 카테고리 클릭 시 모달 오픈 → API 호출 → 가이드 표시

**DB 영향**: 없음

**검증**: 베타 1명 부족 카테고리 클릭 → 가이드 모달 노출

**예상 효과**: 사진 추가 행동 전환율 +30~50%

---

## 4. Phase 2 상세 작업 (사양 업그레이드 직후) — v1.0 유지

### 4.1 AI 브리핑 노출 신호 다단 측정 (1~2주)
- `naver_scanner.py:103-107` excerpt 추출 확장 — position(상단/중단/하단) + frequency(반복 인용)
- `ai_citations` 테이블에 `position TEXT`, `frequency INT` 컬럼 추가
- 프론트 `AICitationDetailCard.tsx` 신규

### 4.2 행동·결과 피드백 루프 강화 (1주)
**v1.0 대비 변경**: `services/score_attribution.py:compute_attributions()` 이미 ±7일 매칭 작동. UI/알림 강화로 좁힘
- `frontend/components/dashboard/ActionImpactCard.tsx` 신규 — "지난주 ○○ 행동 후 점수 +5점"
- 카카오 알림 시퀀스: 점수 변화 + 다음 권장 액션 1개

### 4.3 P1-B 스마트플레이스 예약·사진 자동 감지 (1~2주)
- 사용자가 서버 Playwright codegen으로 셀렉터 실측 선행
- `smart_place_auto_check.py:_check_reservation()`, `_check_photo_count()` 추가
- `last_post_at` 자동 갱신 후보로도 활용 가능

### 4.4 측정 주기 단축 (1주)
- `BACKEND_MAX_CONCURRENCY=3~4` env 갱신
- 주간 → 일간 옵션 (사용자별 토글)
- `score_history(business_id, recorded_at DESC)` 인덱스 검토

---

## 5. Phase 3 상세 작업 (6월 AI탭 전체 확대 후) — v1.0 유지

### 5.1 점수 변수 분리·재명명 + AI탭 Scanner 통합 (1주)
- `naver_exposure_confirmed` → `naver_briefing_confirmed` + `naver_ai_tab_visible` 분리
- `NaverAITabScanner` 구현
- `scan_results.naver_ai_tab_visible BOOLEAN`, `naver_ai_tab_rank SMALLINT` 추가
- Track1 가중치 INACTIVE 업종 AI탭 가중 상향
- 22개 참조 위치 일괄 교체

**상세**: `docs/naver_ai_tab_개발로드맵_v1.1.md` §3 P2 참조

---

## 6. 의존 관계·작업 순서 (v1.1 갱신)

```
[즉시 시작 - 사양 무관]
§3.1 (사진 사전 통합)──┐    ※ v1.0 별점 작업은 오판 — 삭제
§3.2 (D.I.A./LSI)      ├─→ Phase 1 완료 (1~2주)
§3.3 (소식 알림)        │    ※ DB 컬럼 1건 ALTER 필요
§3.4 (JSON-LD UI)      │    ※ 범위 축소 — 기존 구현 활용
§3.5 (사진 가이드)──────┘

[사양 업그레이드 직후]
§4.4 (측정 주기 단축) ──┐
§4.1 (다단 측정)        ├─→ Phase 2 완료 (1~2주)
§4.2 (피드백 UI)        │    ※ 백엔드 attribution 이미 작동
§4.3 (P1-B)─────────────┘    ※ last_post_at 자동 갱신 연계

[6월 AI탭 전체 확대 후]
§5.1 (변수 분리 + Scanner)─→ Phase 3 완료 (1주)
```

---

## 7. 작업별 SSH 검증 패턴 (v1.0 유지)

```bash
# 백엔드 수정 후
ssh root@115.68.231.57 "grep -n '<핵심 패턴>' /var/www/aeolab/backend/<경로>"
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 60 --nostream | grep -i error"

# 프론트 수정 후
ssh root@115.68.231.57 "grep -n '<핵심 패턴>' /var/www/aeolab/frontend/<경로>"
ssh root@115.68.231.57 "pm2 logs aeolab-frontend --lines 60 --nostream | grep -i error"
```

**v1.0 사고 패턴 재방지**: 잔재 파일(`*.server_backup`, `*_server.py`) 다수 존재. **반드시 `main.py`의 `from routers import ...` 정답 경로 먼저 확인** 후 수정.

---

## 8. 베이스라인 측정 (Phase 1 작업 전 캡처)

베타 1명(education, INACTIVE) 기준:

| 항목 | 현재 값 (기준선) | Phase 1 목표 |
|------|---------------|------------|
| `calc_review_quality` (별점 50% 반영) | 실측 후 기재 | 변동 없음 (이미 반영) |
| `calc_smart_place_completeness` | 실측 후 기재 | +5~10점 (소식 알림 → 작성 빈도 ↑) |
| `calc_schema_seo` | 실측 후 기재 | +10~15점 (UI 카드로 행동 유도) |
| D.I.A. 점수 (신규 함수) | N/A | 70+ |
| 사진 카테고리 충족 (단일 사전 후) | 실측 후 기재 | 80%+ |
| 소식 작성 빈도 (last_post_at) | 신규 측정 | 월 1회 이상 |

---

## 9. 관련 문서 목록

| 문서 | 내용 |
|------|------|
| `docs/main_engine_optimization_v1.1.md` | **이 문서** — 검증 후 갱신본 |
| `docs/main_engine_optimization_v1.0.md` | v1.0 초안 — 검증 전 작성, 별점/JSON-LD 오판 포함 |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | AI탭/AI 브리핑 P0~P3 로드맵 |
| `docs/session_summary_20260517_naver_ai_tab_v1.0.md` | 2026-05-17 P0+P1-A+P1-C 완료 세션 요약 |
| `docs/naver_gpt_work_standard_v1.0.md` | 네이버·GPT 관련 작업 전 필수 참조 |
| `docs/naver_ai_briefing_compliance_v1.0.md` | 네이버 공식 PDF 기반 컴플라이언스 |
| `docs/model_engine_v3.0.md` | 듀얼트랙 점수 모델 |
| `memory/reference_naver_ai_briefing_criteria.md` | C-rank/D.I.A. 알고리즘 메모 |
| `memory/reference_global_ai_criteria.md` | ChatGPT/Gemini/Google AI 노출 원리 |

---

## 10. 향후 추가 검토 (v1.0 유지)

- **네이버 DataLab API 연동** (100명 후)
- **A/B 가이드 효과 학습** (30명+ 누적 후)
- **DataForSEO Screenshot API** (50명 후 Google 재도입)
- **모바일 UI 가독성 점검** — 5단계 가이드·콘텐츠 생성 결과
- **`*_server.py` 잔재 파일 정리** — 메인 import 경로와 동일한 파일만 유지 (위험: 동일 이름 다른 경로 수정 시 미반영)

---

*v1.1 갱신: 2026-05-17 | v1.0 별점/JSON-LD 오판 수정 + 사진 사전 단일 소스 갭 추가 | 다음 리뷰: Phase 1 완료 후*
