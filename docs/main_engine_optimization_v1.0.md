# 메인 엔진 최적화 작업 계획 v1.0 — 네이버 AI탭·AI 브리핑 최신 대응

> **작성일: 2026-05-17**
> **목적**: AEOlab의 메인 5대 엔진(측정·점수·가이드·콘텐츠·피드백)을 네이버 AI탭(2026-04-27 베타)·AI 브리핑(2025.08 확정 + 2026 확대) 최신 사양에 정합하도록 최적화
> **전제**: 홈페이지 개발 완성 후 서버 사양 1단계 업그레이드 예정 (현재 vCPU2/RAM4GB → 상위 사양, Semaphore(2)→(3~4) 동시성 증가)
> **선행 작업**: `docs/naver_ai_tab_개발로드맵_v1.1.md` P0+P1-A+P1-C 완료 (2026-05-17)

---

## 0. 사용 지침

### 새 대화창 트리거 명령 (전체 작업)
```
docs/main_engine_optimization_v1.0.md 읽고 Phase 1 §3.1부터 순차 진행
```

### 부분 작업 트리거
```
docs/main_engine_optimization_v1.0.md 읽고 §3.1만 진행 (별점 가중치 검증)
docs/main_engine_optimization_v1.0.md 읽고 §3.3 진행 (소식 14일 알림)
```

### 작업 원칙 (재발 방지)
1. **에이전트 위임 시 메인 세션 SSH grep 검증 필수** (2026-05-01 사고 사례)
2. **사용자 노출 데이터는 실측만, 추정·더미 금지** (CLAUDE.md 작업 지침 §7)
3. **점수 합계 100점 보존 — 가중치 변경 시 자동 검증 통과 확인** (`backend_venv/Scripts/python.exe`로 weight sum 1.0 검증)
4. **단일 진실 동기화**: backend `BRIEFING_ACTIVE_CATEGORIES` ↔ frontend `BRIEFING_ACTIVE` 한쪽 변경 시 양쪽 동시 수정

---

## 1. 메인 엔진 5대 영역 진단 (2026-05-17 점검 결과)

### ① 측정 엔진 (Scan) — ⚠️ 격차 大
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| AI 브리핑 실측 | `naver_scanner.py` Playwright DOM 파싱 정상 작동 | 이진(노출/미노출)만 추적 — 인용 문장·위치·빈도 부재 |
| AI탭 실측 | ❌ 미구현 | 네이버플러스 로그인 필요 — 6월 전체 확대 후 가능 |
| Google AI Overview | Playwright 파싱 작동 (단, iwinv IP CAPTCHA로 2026-05-14 제거) | DataForSEO Screenshot API 재도입 (구독자 50명 후) |
| ChatGPT/Gemini | API 정상 (50/50 분할) | 실시간 검색 vs 학습 데이터 분리 측정 미구현 |
| 변경 감지 자동화 | ❌ 없음 — 수동 확인 | 네이버 사양 변경 시 자동 감지·알림 인프라 없음 |

### ② 점수 엔진 (Score) — ⚠️ 명칭·구조 비정합
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| Track1 `naver_exposure_confirmed` (15%) | AI 브리핑만 측정 | AI탭 노출 점수 미반영 |
| Track1 `ai_briefing_score` (확장 25%, v3.1) | 도입됨 | 명칭이 "AI 브리핑"으로 한정 — AI탭 통합 못함 |
| 별점(avg_rating, 2026-04-06 도입) | DB 컬럼만 존재? | **점수 가중치 반영 여부 미확인** ← §3.1에서 검증 |
| 사용자 카테고리 ↔ taxonomy 키 매핑 | `_CATEGORY_ALIASES`에 53개 정의 | 단일 진실 문서 없음 — 작업자 혼동 위험 |

### ③ 가이드 엔진 (Guide) — ⚠️ 통합 흐름 부족
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| AI 브리핑 4경로 | ✅ 잘 정리 (리뷰답변·소개글Q&A·소식·소개글본문) | 우선순위 자동 추천 약함 |
| C-rank 4축 체크리스트 | ✅ AiInfoTabGuide에 노출 | 점수 가중치 자동 매칭 없음 — 사용자가 "내가 뭐 부족한지" 점수 단위로 모름 |
| D.I.A. 5요소 | 가이드 텍스트에만 언급 | 자동 생성 콘텐츠에 강제력 없음 (독창성·적시성) |
| AI탭 신규 단계 | P1-A로 추가됨 (5업종) | 5단계 가이드와 통합 흐름 부족 |
| 업종별 맞춤 깊이 | ACTIVE/LIKELY/INACTIVE 3분기 | 업종별 D.I.A. 우선순위 특화 약함 |

### ④ 콘텐츠 생성 엔진 (Generator) — ⚠️ 인용 최적화 부족
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| 소개글 자동 생성 (Claude Sonnet) | 작동 중 | AI 브리핑 최적 구조([도입]+[본문]+[자주 묻는 질문] Q&A 5개) 강제력 약함 |
| 톡톡 채팅방 메뉴 생성 | 작동 중 | 단순 메뉴명 → 클릭 동작 매핑 — D.I.A. 무관 |
| 적시성 표기 | ❌ 자동 삽입 없음 | `[YYYY년 M월 업데이트]` 자동 추가 인프라 없음 |
| LSI 연관키워드 자연 배치 | ❌ 단순 키워드 나열 | 알고리즘 없음 — 사장님이 직접 손봐야 함 |
| JSON-LD LocalBusiness | `/api/schema/generate` 엔드포인트 있음 | 자동 생성 외 검증·점검 인프라 약함 |

### ⑤ 행동·결과 피드백 루프 (Loop) — ⚠️ 측정·학습 약함
| 항목 | 현재 상태 | 격차 |
|------|---------|------|
| `business_action_log` 행동 기록 | 작동 중 | 점수 변화 자동 매칭 부분만 |
| `score_history` 시계열 30일 | 작동 중 | 액션별 효과 비교 약함 |
| 카카오 알림 (점수 변화) | `AEOLAB_SCORE_01` 승인 완료 | "이 액션이 점수 ↑를 일으켰다" 인과 매칭 자동화 부족 |
| A/B 가이드 효과 학습 | ❌ 없음 | 어떤 액션 우선순위가 효과 컸는지 학습·갱신 없음 |
| 사용자 동기 유지 | 14일 미작성·미스캔 알림 일부만 | 행동-결과 시각화로 동기 부여 강도 부족 |

---

## 2. 작업 우선순위 종합 (사양 업그레이드 고려)

```
Phase 1 (즉시, 사양 무관) — 1~2주
  §3.1 별점 가중치 검증·반영 (1일)
  §3.2 콘텐츠 생성 D.I.A.·C-rank 최적화 (1주)
  §3.3 소식 미작성 14일 알림 (2일)
  §3.4 JSON-LD 자동 생성·검증 강화 (3~4일)
  §3.5 사진 카테고리 부족 시 업종별 구체 가이드 (2~3일)

Phase 2 (사양 업그레이드 직후) — 1~2주
  §4.1 AI 브리핑 노출 신호 다단 측정 (인용 문장·위치·빈도) — Playwright 동시성 활용
  §4.2 행동·결과 피드백 루프 강화 (점수 변화 자동 매칭 + 알림)
  §4.3 P1-B 스마트플레이스 예약·사진 자동 감지 (셀렉터 실측 선행)
  §4.4 측정 주기 단축 (주간 → 일간, env 활용)

Phase 3 (6월 AI탭 전체 확대 후) — 1주
  §5.1 점수 변수 분리·재명명 + AI탭 Scanner 통합
```

---

## 3. Phase 1 상세 작업 (즉시, 사양 무관)

### 3.1 별점 가중치 검증·반영 (1일, P0)

**목적**: 2026-04-06 도입된 별점(avg_rating, 5점 척도)이 score_engine.py 점수 산식에 반영되는지 검증. 미반영 시 review_quality 가중치 내 25% 중 별점 비중 정의.

**파일 위치**:
- `backend/services/score_engine.py:calc_review_quality()`
- `backend/services/naver_place_stats.py` (별점 파싱)

**작업 절차**:
1. `grep -n "avg_rating" backend/services/score_engine.py` — 반영 여부 확인
2. 반영 안 됐으면: `calc_review_quality()`에 별점 점수 추가
   ```python
   def calc_review_quality(biz: dict) -> float:
       review_count = biz.get("review_count", 0) or 0
       avg_rating = biz.get("avg_rating", 0) or 0
       # 리뷰 수 점수 (60점)
       count_score = min(60, review_count * 0.6)
       # 별점 점수 (40점) — 4.0+ 만점, 3.0 미만 0점
       rating_score = max(0, min(40, (avg_rating - 3.0) * 40))
       return count_score + rating_score
   ```
3. SCORE_MODEL_VERSION="v3_0" / "v3_1" 양쪽 호환 확인

**DB 영향**: 없음 (컬럼 이미 존재)

**검증 방법**:
- 베타 1명 사업장(`avg_rating=4.5` 가정) → review_quality 점수 비교
- 별점 NULL인 경우 0점 처리 확인

**예상 효과**: review_quality 정확도 +10~20% 상승 (별점 미반영 시 리뷰 많은 곳만 유리)

---

### 3.2 콘텐츠 생성 D.I.A.·C-rank 최적화 (1주, P1)

**목적**: 소개글·톡톡 채팅방 메뉴 자동 생성 결과에 D.I.A. 5요소(독창성·적시성·정보 충실성)와 C-rank 4축(Context·Content·Chain·Creator)을 강제 적용.

**파일 위치**:
- `backend/services/guide_generator.py` 또는 신규 `backend/services/content_optimizer.py`
- `backend/routers/business.py:761` (소개글 생성 엔드포인트)
- `backend/routers/guide.py` (톡톡 메뉴 생성)

**작업 절차**:

1. **소개글 생성 프롬프트 강화** (Claude Sonnet 호출 시):
   - `[도입부 1-2문장]` + `[본문 2-3문단]` + `[자주 묻는 질문 Q&A 5개]` 구조 강제
   - 적시성: `[YYYY년 M월 업데이트]` 자동 삽입
   - LSI 키워드: `keyword_taxonomy.py` `get_all_keywords_flat()` 상위 5개 자연 배치 요구

2. **생성 후 검증 함수**:
   ```python
   def validate_intro_dia(intro_text: str, keywords: list[str]) -> dict:
       """D.I.A. 5요소 충족도 점수 (0~100)."""
       return {
           "topic_relevance": _check_keyword_coverage(intro_text, keywords),
           "experience_info": _check_experience_phrases(intro_text),
           "information_richness": _check_specific_info(intro_text),  # 시간·가격·위치
           "originality": _check_template_uniqueness(intro_text),     # 템플릿 복사 감지
           "timeliness": _check_date_marker(intro_text),              # [YYYY년 M월] 여부
       }
   ```

3. **톡톡 채팅방 메뉴 개선**: AI 브리핑 인용 직접 영향 없으나, 자주 묻는 질문 Q&A 5개와 동기화하여 일관성 확보

**DB 영향**:
- `businesses.naver_intro_draft` 컬럼 활용 (이미 v4.1로 존재)
- 신규 컬럼: `naver_intro_dia_score JSONB` (D.I.A. 점수 저장, 선택)

**검증 방법**:
- 베타 1명 소개글 생성 → D.I.A. 점수 70+ 확인
- 적시성 표기 자동 삽입 확인

**예상 효과**: AI 브리핑 인용 가능성 +30~50% 향상 (특히 Q&A 섹션 인용)

---

### 3.3 소식 미작성 14일 알림 (2일, P1)

**목적**: 사장님이 가장 까먹는 "소식(공지)" 작성을 14일 미작성 시 카카오 알림으로 환기. AI 브리핑 적시성 점수 유지.

**파일 위치**:
- `backend/scheduler/jobs.py` — 신규 `inactive_post_alert_job()` 추가
- `backend/services/kakao_notify.py` — 알림톡 발송 함수
- 카카오 알림톡 템플릿: 기존 `AEOLAB_ACTION_01` 재활용 또는 `AEOLAB_POST_REMIND_01` 신규 신청

**작업 절차**:
1. 매일 09:00 KST 스케줄러 잡 추가:
   ```python
   async def inactive_post_alert_job():
       """14일 이상 소식 미작성 사업장에 카카오 알림."""
       cutoff = datetime.now(KST) - timedelta(days=14)
       res = await execute(
           supabase.table("businesses")
           .select("id, user_id, name")
           .or_(f"last_post_at.lt.{cutoff.isoformat()},last_post_at.is.null")
       )
       for biz in res.data or []:
           # 멱등키 — 14일에 1회만
           key = f"post_remind_{biz['id']}_{cutoff.date()}"
           if not await _already_sent(key):
               await send_kakao_post_remind(biz["user_id"], biz["name"])
   ```
2. 멱등키로 중복 발송 방지

**DB 영향**:
- `businesses.last_post_at TIMESTAMPTZ` 컬럼 추가 필요 (소식 작성 시 갱신)
- `notifications.idempotency_key` 활용

**검증 방법**:
- 베타 1명 강제 `last_post_at = 15일전` 설정 → 다음 09:00 KST 알림 발송 확인

**예상 효과**: 소식 작성 빈도 +20~40% (행동 환기로 사용자 유지율 ↑)

---

### 3.4 JSON-LD 자동 생성·검증 강화 (3~4일, P2)

**목적**: Track2 schema_seo 30% 점수 직결 항목. Google AI Overview 노출 핵심 경로. 현재 `/api/schema/generate` 엔드포인트는 있으나 사용자가 직접 실행해야 함 → 자동 생성·웹사이트 적용 가이드 강화.

**파일 위치**:
- `backend/routers/schema.py` 또는 기존 schema 엔드포인트
- `backend/services/schema_validator.py` 신규
- `frontend/components/dashboard/SchemaCheckCard.tsx` 신규

**작업 절차**:
1. JSON-LD 자동 생성: 사업장 정보 → LocalBusiness 스키마 완성형
2. 검증 함수: 사용자 웹사이트 URL 크롤링 → JSON-LD 존재 여부 + 필수 필드 확인
3. 부족 항목 UI: "이 필드가 빠져 있습니다" + 자동 생성된 JSON-LD 복사 버튼

**DB 영향**:
- `businesses.json_ld_status JSONB` 컬럼 추가 (검증 결과 캐시)
- `scan_results.schema_seo_detail JSONB` (부족 항목 저장)

**검증 방법**:
- 베타 1명 웹사이트 URL 등록 → JSON-LD 자동 생성 → 검증 결과 표시

**예상 효과**: Track2 schema_seo 점수 평균 +10~15점 (현재 미설정 사업장 다수)

---

### 3.5 사진 카테고리 부족 시 업종별 구체 가이드 (2~3일, P2)

**목적**: 현재 `score_engine.py:486~509`에서 "사진_{카테고리}_없음" missing 항목만 표시. 사용자가 "어떤 사진을 어떻게 찍어야 하는지" 모름 → 업종별 구체 가이드 추가.

**파일 위치**:
- `backend/services/photo_guide.py` 신규
- `frontend/components/dashboard/PhotoCategoryCard.tsx` (이미 존재) 확장

**작업 절차**:
1. 업종별 사진 가이드 사전:
   ```python
   PHOTO_GUIDES = {
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
2. `PhotoCategoryCard.tsx`에 "이런 사진을 찍어보세요" 모달 + 예시 이미지 라이브러리

**DB 영향**: 없음 (정적 데이터)

**검증 방법**:
- 베타 1명 사진 부족 카테고리 → 구체 가이드 노출 확인

**예상 효과**: 사진 추가 행동 전환율 +30~50% (현재 "사진 부족" 알림만 보고 까먹음)

---

## 4. Phase 2 상세 작업 (사양 업그레이드 직후)

### 4.1 AI 브리핑 노출 신호 다단 측정 (1~2주, P1)

**목적**: 현재 이진(노출/미노출)만 측정 → 인용 문장·위치·빈도까지 확장. 사용자가 "내 어떤 콘텐츠가 인용됐는지" 시각화.

**파일 위치**:
- `backend/services/ai_scanner/naver_scanner.py` — DOM 파싱 확장
- `backend/services/ai_citations` 테이블 활용 확장

**작업 절차**:
1. naver_scanner.py에 인용 문장 추출 추가:
   - DOM 파싱 시 `quote/excerpt` 요소 식별
   - 인용 위치(상단·중단·하단) 분류
   - 인용 빈도(같은 페이지 내 여러 위치 인용 여부)
2. `ai_citations` 테이블 INSERT 시 `excerpt`, `position`, `frequency` 필드 채움
3. 프론트 신규 카드 `AICitationDetailCard.tsx`: "내 가게가 이렇게 인용됐어요" 시각화

**DB 영향**:
- `ai_citations` 테이블에 `position TEXT`, `frequency INT` 컬럼 추가

**사양 의존**: Playwright 단일 페이지 처리 시간 ↑, but 동시성 ↑로 보완

**검증 방법**: 베타 1명 ACTIVE 업종 스캔 → 인용 문장 추출 확인

---

### 4.2 행동·결과 피드백 루프 강화 (1주, P1)

**목적**: 가이드 실행 → 점수 변화 자동 매칭 → 카카오 알림. 사용자 동기 부여 강화.

**파일 위치**:
- `backend/services/action_score_matcher.py` 신규
- `backend/scheduler/jobs.py` — 매일 점수 변화 감지
- `frontend/components/dashboard/ActionImpactCard.tsx` 신규

**작업 절차**:
1. `business_action_log` + `score_history` 자동 매칭:
   - 행동 후 N일 내 점수 변화 → 효과 추정
   - 단순 상관관계 (인과 단정 금지)
2. 효과 큰 액션 우선순위 학습 (베타 5명+ 데이터 누적 후)
3. 카카오 알림: "지난주 ○○ 행동 후 점수 +5점 상승 — 이번주는 △△ 권장"

**사양 의존**: 일간 측정과 결합 시 효과 극대화 (§4.4)

---

### 4.3 P1-B 스마트플레이스 예약·사진 자동 감지 (1~2주, P2)

**선행 작업**: 사용자가 서버에서 Playwright codegen으로 셀렉터 실측 (CLAUDE.md `docs/naver_ai_tab_개발로드맵_v1.1.md` §3 P1-B 참조)

**파일 위치**:
- `backend/services/smart_place_auto_check.py` — `_check_reservation()`, `_check_photo_count()` 추가
- `backend/services/briefing_engine.py` — `reservation_setup` 액션 스텝 추가

**검증 방법**: SSH grep + 베타 1명 사업장 실행

---

### 4.4 측정 주기 단축 (1주, P2)

**목적**: 현재 주간 자동 스캔 → 사양 업그레이드 후 일간 측정 가능. score_history 시계열 정밀도 ↑.

**파일 위치**:
- `backend/scheduler/jobs.py` — 잡 주기 변경
- `.env` — `BACKEND_MAX_CONCURRENCY=3` 또는 `4` 갱신

**작업 절차**:
1. 사양 업그레이드 확인 후 `BACKEND_MAX_CONCURRENCY` env 변경
2. 주간 잡을 일간으로 변경 (선택적, 사용자별 옵션)
3. score_history 데이터 폭증 대비 — `score_history` 인덱스·파티셔닝 검토

**DB 영향**: 인덱스 추가 가능성 (`score_history(business_id, recorded_at DESC)`)

---

## 5. Phase 3 상세 작업 (6월 AI탭 전체 확대 후)

### 5.1 점수 변수 분리·재명명 + AI탭 Scanner 통합 (1주)

**조건**: 네이버 AI탭 전체 이용자 확대 공식 확인 후 진행

**파일 위치**:
- `backend/services/ai_scanner/naver_ai_tab_scanner.py` 신규
- `backend/services/score_engine.py` — 변수 분리

**작업 절차** (전체 일괄):
1. `naver_exposure_confirmed` → `naver_briefing_confirmed` + `naver_ai_tab_visible` 분리
2. `NaverAITabScanner` 구현
3. DB 컬럼 추가: `scan_results.naver_ai_tab_visible BOOLEAN`, `naver_ai_tab_rank SMALLINT` 등
4. Track1 가중치 재조정 (INACTIVE 업종 AI탭 가중 상향 등)
5. `naver_exposure_confirmed` 참조 22개 위치 일괄 교체

**상세**: `docs/naver_ai_tab_개발로드맵_v1.1.md` §3 P2 참조

---

## 6. 의존 관계·작업 순서

```
[즉시 시작 가능 - 사양 무관]
§3.1 (별점) ──┐
§3.2 (D.I.A.) ├─→ Phase 1 완료 (1~2주)
§3.3 (소식 알림) │
§3.4 (JSON-LD) │
§3.5 (사진 가이드)┘

[사양 업그레이드 직후 - 묶음]
§4.4 (측정 주기 단축) ──┐
§4.1 (다단 측정)        ├─→ Phase 2 완료 (1~2주, 시너지)
§4.2 (피드백 루프)      │
§4.3 (P1-B 예약·사진)──┘   ※ 사용자 셀렉터 실측 선행

[6월 AI탭 전체 확대 확인 후]
§5.1 (변수 분리 + Scanner) ─→ Phase 3 완료 (1주, 한 번에 통합)
```

---

## 7. 작업별 SSH 검증 패턴 (재발 방지)

모든 백엔드 수정 후:
```bash
ssh root@115.68.231.57 "grep -n '<핵심 패턴>' /var/www/aeolab/backend/<경로>"
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 60 --nostream | grep -i error"
```

모든 프론트 수정 후:
```bash
ssh root@115.68.231.57 "grep -n '<핵심 패턴>' /var/www/aeolab/frontend/<경로>"
ssh root@115.68.231.57 "pm2 logs aeolab-frontend --lines 60 --nostream | grep -i error"
```

---

## 8. 측정·검증용 베이스라인 (작업 전 캡처)

작업 시작 전 베타 사용자(현재 1명 — education, INACTIVE) 베이스라인:

| 항목 | 현재 값 | Phase 1 완료 후 목표 |
|------|--------|--------------------|
| Track1 score | (실측 후 기재) | +5~10점 |
| Track2 score | (실측 후 기재) | +10~15점 (JSON-LD 효과) |
| D.I.A. 점수 (신규) | N/A | 70+ |
| 소식 작성 빈도 | (실측 후 기재) | 월 1회 이상 |
| 사진 카테고리 충족 | (실측 후 기재) | 80%+ |

**측정 명령** (베이스라인 수집):
```bash
ssh root@115.68.231.57 "cd /var/www/aeolab && source venv/bin/activate && python3 -c '
import asyncio, json
from db.supabase_client import get_supabase
sb = get_supabase()
res = sb.table(\"scan_results\").select(\"track1_score, track2_score, unified_score\").order(\"scanned_at\", desc=True).limit(5).execute()
print(json.dumps(res.data, indent=2, ensure_ascii=False))
'"
```

---

## 9. 관련 문서 목록

| 문서 | 내용 |
|------|------|
| `docs/main_engine_optimization_v1.0.md` | 이 문서 — 메인 엔진 5대 영역 종합 최적화 계획 |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | AI탭/AI 브리핑 P0~P3 로드맵 |
| `docs/session_summary_20260517_naver_ai_tab_v1.0.md` | 2026-05-17 P0+P1-A+P1-C 완료 세션 요약 |
| `docs/naver_gpt_work_standard_v1.0.md` | 네이버·GPT 관련 작업 전 필수 참조 |
| `docs/naver_ai_briefing_compliance_v1.0.md` | 네이버 공식 PDF 기반 컴플라이언스 |
| `docs/model_engine_v3.0.md` | 듀얼트랙 점수 모델 |
| `memory/reference_naver_ai_briefing_criteria.md` | C-rank/D.I.A. 알고리즘 메모 |
| `memory/reference_global_ai_criteria.md` | ChatGPT/Gemini/Google AI 노출 원리 |

---

## 10. 향후 추가 검토 항목 (이번 계획에 미포함)

- **네이버 DataLab API 연동** — 키워드 인기·계절성 (구독자 100명 후, CLAUDE.md 미래 과제)
- **A/B 가이드 효과 학습 모델** — 베타 30명+ 누적 후 권장
- **DataForSEO Screenshot API 도입** (Google 스크린샷 재도입, 구독자 50명 후)
- **모바일 UI 가독성 점검** — 5단계 가이드 페이지·콘텐츠 생성 결과 모바일 화면 검증

---

*v1.0 작성: 2026-05-17 | 사양 업그레이드 전제 반영 | 다음 리뷰: Phase 1 완료 후*
