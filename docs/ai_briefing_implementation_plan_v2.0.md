# 네이버 AI 브리핑 노출 조건 — 구현 계획 v2.0

> 작성일: 2026-04-30
> 기반: `ai_briefing_audit_plan_v1.0.md` 점검 결과 + 6개 PDF 분석 + 전체 코드 검토
> 목적: 현재 구현 상태를 정확히 파악하고, 누락·오류·보완 항목을 우선순위별로 정리

---

## 0. 핵심 결론 (새 대화창 1분 파악용)

### 0.1 PDF 분석으로 확인된 네이버 AI 브리핑 조건 (최신)

| 조건 | 우선순위 | 근거 |
|------|---------|------|
| 노출 가능 업종 (음식점·카페 등) | ★★★ 필수 gate | 네이버 공식 (`help.naver.com/service/30026/contents/24632`) |
| **프랜차이즈 업종 = 현재 제외** | ★★★ 필수 gate | 네이버 공식 (신규 확인, 코드 미반영) |
| AI 정보 탭 토글 ON | ★★★ 필수 gate | 네이버 공식 (위치: 업체정보 > AI 정보, 반영 1일 소요) |
| 리뷰수 기준 충족 | ★★★ 필수 gate | 네이버 공식 ("리뷰수가 기준에 맞지 않을 경우 서비스 제공 안됨", 임계값 비공개) |
| 소개글 충실도 (150~500자, 키워드 포함) | ★★ 핵심 25% | 검증됨 |
| 소식 최신성 (30일 내 1회 이상) | ★★ 핵심 25% | 검증됨 |
| 리뷰 풍부도 (10건 권장, 공식 임계값 비공개) | ★★ 핵심 20% | 검증됨 |
| 연계 블로그 (30일 내 발행, C-rank 높을수록 유리) | ★ 권장 15% | 블로그 분석 확인 |
| 메뉴·가격·사진 완성도 | ★ 권장 15% | 검증됨 |

**신규 확인 사항:**
- 2025년 AI 브리핑 노출 비율 20%까지 확대 (공식 발표)
- 2026-04-27 통합검색 내 별도 "AI 탭" 베타 공개됨 (네이버플러스 우선, 전 업종 확대 진행) → Track1 비중 더욱 중요해짐
- AI 브리핑 유형: 플레이스형(소상공인 대상)·공식형·숏텐츠형·쇼핑형·AI쇼핑가이드 5종으로 구분됨
- 소개글 수정 불가, 토글 OFF로 미노출만 가능 (잘못된 정보 있을 경우)

### 0.2 현재 구현 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| BRIEFING_ACTIVE/LIKELY/INACTIVE_CATEGORIES | ✅ 완료 | score_engine.py + dashboard/page.tsx 양쪽 |
| get_briefing_eligibility(), _briefing_explanation() | ✅ 완료 | score_engine.py:27-41, 289-299 |
| calc_smart_place_completeness() FAQ→소개글/소식 재배분 | ✅ 완료 | **단, 합계 최대 90점 버그 발견** |
| ai_info_tab_status 5개 값 처리 | ✅ 완료 | on/off/disabled/not_visible/unknown |
| IneligibleBusinessNotice.tsx | ✅ 완료 | |
| AiInfoTabStatusCard.tsx | ✅ 완료 | |
| IntroGeneratorCard.tsx | ✅ 완료 | |
| TalktalkFAQGeneratorCard.tsx | ✅ 완료 | |
| generate_naver_intro() / generate_talktalk_faq() | ✅ 완료 | guide_generator.py |
| /intro-generate, /talktalk-faq-generate 엔드포인트 | ✅ 완료 | |
| /place/{id} URL 마이그레이션 | ✅ 완료 | /restaurant/{id} 제거 완료 |
| businesses.ai_info_tab_status DB 컬럼 | ✅ 완료 | |
| intro_text 회귀 제거 | ✅ 완료 | dashboard에서 참조 0건 |
| **guide/ai-info-tab/page.tsx** | ❌ **미존재** | 계획서에 완료 표시됐으나 파일 없음 |
| **프랜차이즈 제외 게이팅** | ❌ **미구현** | 공식 확인됐으나 코드 없음 |
| **단일 소스 원칙** (BRIEFING_ACTIVE 중복) | ⚠️ **미해결** | backend/frontend 각각 하드코딩 |
| **생성 콘텐츠 DB 저장** | ⚠️ **미해결** | intro/FAQ 생성 후 저장 경로 없음 |
| **Trial 결과 INACTIVE 처리** | ⚠️ **미확인** | trial result에서 브리핑 CTA 숨김 여부 |
| **결제 페이지 면책 문구** | ⚠️ **미확인** | INACTIVE 업종 구독 시 면책 문구 |
| **calc_smart_place_completeness 100점 버그** | 🔴 **버그** | 25+30+25+10=90점 최대, 100점 달성 불가 |

---

## 1. 발견된 버그 및 오류 (즉시 수정)

### 1.1 🔴 calc_smart_place_completeness() 합계 90점 버그

**위치:** `backend/services/score_engine.py:239-244`

**현재 코드:**
```python
return min(100, (
    (25 if is_smart_place  else 0) +   # 25점
    rank_score +                        # 최대 30점
    (25 if has_recent_post else 0) +   # 25점
    (10 if has_intro       else 0)     # 10점
))
# 최대: 25 + 30 + 25 + 10 = 90점 (100점 불가능)
```

**문제:** 사용자가 모든 체크박스를 채우고 1위여도 90점이 최대. 사용자 신뢰에 영향.

**수정안 (3가지 중 택1):**

**[A안] 소개글 20점으로 상향** (가장 간단, 의미 일관):
```python
return min(100, (
    (25 if is_smart_place  else 0) +   # 25점
    rank_score +                        # 최대 30점
    (25 if has_recent_post else 0) +   # 25점
    (20 if has_intro       else 0)     # 10→20점
))
# 최대: 25 + 30 + 25 + 20 = 100점 ✅
```

**[B안] 카카오·구글 플레이스 연동 점수 추가** (추후 확장 고려, 10점):
```python
    (10 if biz.get("kakao_place_id") else 0)   # 카카오 등록 확인
```

**[C안] 사진 항목 추가** (실제 노출 조건, 10점):
```python
    (10 if biz.get("has_photos") else 0)   # 사진 5장 이상 여부
```

**권장: A안** — 소개글이 AI 브리핑 노출에 가장 직접적 영향(150~500자 기준), 의미 일관.

---

### 1.2 🔴 _detect_faq() / _detect_faq_stats() 오탐 잔존

**위치:** `backend/services/smart_place_auto_check.py:276`, `backend/services/naver_place_stats.py:369`

**문제:** FAQ 관련 감지 함수가 여전히 코드에 존재하나 `calc_smart_place_completeness()`에서 `has_faq` 점수는 이미 제거됨. 하지만:
- `has_faq=True`가 사업장 DB에 저장되면 UI에서 "FAQ 있음" 뱃지로 표시될 수 있음 (미확인)
- `ai_briefing_redesign_v2.0.md`에서 확인된 CSS pseudo-selector 오탐 위험 (Q:before 등)
- 사용자가 "FAQ 있다고 표시되는데 실제로 없음" 민원 가능성

**수정안:**
```python
# smart_place_auto_check.py + naver_place_stats.py
# _detect_faq() / _detect_faq_stats() 반환 결과에서 has_faq 관련 항목 제거
# 또는 주석으로 "deprecated — 점수 미반영, 제거 예정" 명시
# ScoreEvidenceCard.tsx에서 FAQ 행 표시 완전 제거 확인 필요
```

---

### 1.3 ⚠️ 단일 소스 원칙 위반 — BRIEFING_ACTIVE 중복 정의

**위치:**
- `backend/services/score_engine.py:~15` — `BRIEFING_ACTIVE_CATEGORIES = [...]`
- `frontend/app/(dashboard)/dashboard/page.tsx:97-99` — `const BRIEFING_ACTIVE = new Set([...])`

**문제:** 업종 목록 변경 시 양쪽 모두 수정해야 하며, 누락 시 frontend와 backend 판정 불일치.

**수정안 (2가지):**

**[A안] API 엔드포인트 노출** (권장, BEP 이후):
```python
# backend/routers/business.py 또는 공개 엔드포인트
@router.get("/api/public/briefing-categories")
async def get_briefing_categories():
    return {
        "active": BRIEFING_ACTIVE_CATEGORIES,
        "likely": BRIEFING_LIKELY_CATEGORIES,
        "inactive": BRIEFING_INACTIVE_CATEGORIES,
    }
```

**[B안] 하드코딩 유지 + 주석으로 동기화 책임 명시** (현재 단계 권장):
```typescript
// dashboard/page.tsx:97
// ⚠️ 변경 시 score_engine.py BRIEFING_ACTIVE_CATEGORIES와 동기화 필수
const BRIEFING_ACTIVE = new Set(["restaurant", "cafe", "bakery", "bar", "accommodation"]);
```

**현재 단계 권장: B안** — BEP 20명 이후 A안 전환.

---

## 2. 미구현 기능 (우선순위별)

### 2.1 🔴 [즉시] 프랜차이즈 제외 게이팅

**근거:** 네이버 공식 문서 확인: "프랜차이즈 업종의 경우 현재 제공되지 않으며 추후 확대 예정"

**영향:** ACTIVE 업종(음식점·카페)이라도 프랜차이즈면 AI 브리핑 노출 불가.
현재 코드는 업종만 보고 "노출 가능"으로 표시 → 허위 정보.

**구현 범위:**

1. **DB 컬럼 추가:**
```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT FALSE;
```

2. **score_engine.py:**
```python
def get_briefing_eligibility(category: str, is_franchise: bool = False) -> str:
    if is_franchise:
        return "inactive"  # 프랜차이즈 = ACTIVE 업종도 inactive 처리
    if category in BRIEFING_ACTIVE_CATEGORIES:
        return "active"
    ...
```

3. **RegisterBusinessForm.tsx:**
```typescript
// 사업장 등록/수정 폼에 프랜차이즈 여부 체크박스 추가
<Checkbox label="프랜차이즈 가맹점입니다" field="is_franchise" />
```

4. **IneligibleBusinessNotice.tsx:**
```typescript
// 프랜차이즈 이유로 INACTIVE인 경우 별도 안내
// "현재 프랜차이즈 업종은 AI 브리핑 서비스 대상이 아닙니다. 추후 확대 예정입니다."
```

---

### 2.2 🔴 [즉시] guide/ai-info-tab/page.tsx 미존재

**계획서(`0.3`)에 "배포 완료"로 표시됐으나 실제 파일 없음.**
현재 `/guide` 디렉터리: `GuideClient.tsx`, `page.tsx` 두 파일만 존재.

**내용 설계 (5단계 가이드):**

```
1단계: 네이버 스마트플레이스에서 AI 정보 탭 찾기
  → 관리 페이지 접속 → 업체정보 → AI 정보 탭
  → 스크린샷 기반 가이드 또는 텍스트 단계별 설명

2단계: AI 정보 탭 토글 활성화
  → 설정 후 1일 이내 반영 안내
  → ACTIVE 업종이 아닌 경우: "현재 이 업종은 제공 대상이 아닙니다" 안내

3단계: 소개글 작성
  → 150~500자, 키워드·서비스·USP 포함
  → IntroGeneratorCard 연결 (AI 소개글 자동 생성)

4단계: 소식 등록 (최신성)
  → 30일 내 1건 이상
  → 소식 초안 자동 생성 연결 (WeeklyPostDraftSection)

5단계: 리뷰 확보
  → 10건 이상 권장 (공식 임계값 비공개)
  → QR 카드 다운로드 연결 (/api/guide/{biz_id}/qr-card)
```

**구현 파일:**
- `frontend/app/(dashboard)/guide/ai-info-tab/page.tsx` (신규)
- `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx` (신규)

---

### 2.3 🟡 [1주 내] 생성 콘텐츠 DB 저장

**현황:** `generate_naver_intro()` / `generate_talktalk_faq()` 생성 결과가 DB에 저장 안됨.
사용자가 페이지 새로고침 시 이전 생성 결과 사라짐.

**구현 방안 (2가지):**

**[A안] guides 테이블 활용** (추가 컬럼 불필요):
```python
# guide_generator.py → generate_naver_intro() 완료 후
await supabase.table("guides").upsert({
    "business_id": biz_id,
    "context": "naver_intro",
    "next_month_goal": generated_intro,  # 임시 필드 활용
    "created_at": datetime.utcnow().isoformat(),
}).execute()
```

**[B안] businesses 컬럼 추가** (권장, 직관적):
```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_intro_draft TEXT,
  ADD COLUMN IF NOT EXISTS naver_intro_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS talktalk_faq_draft JSONB,
  ADD COLUMN IF NOT EXISTS talktalk_faq_generated_at TIMESTAMPTZ;
```

**권장: B안** — 사업장 단위로 1개 초안만 필요, 재생성 시 덮어씀.

---

### 2.4 🟡 [1주 내] Trial 결과 INACTIVE 업종 처리

**현황:** 미확인. 계획서 4절 체크리스트 미완료.

**확인 및 구현 필요:**
- `frontend/app/(public)/trial/` 결과 페이지에서 업종이 INACTIVE인 경우:
  - "AI 브리핑 노출 가이드" CTA 숨김
  - 대신 "ChatGPT·Google·카카오맵 최적화 방법 보기" CTA 표시
- `GET /api/scan/trial` 응답에 `briefing_eligibility` 필드 포함 여부 확인
- INACTIVE 사용자에게 "현재 노출 대상이 아닙니다. 대신 ①~⑤ 채널에서 가시성을 높입니다" 표시

---

### 2.5 🟡 [1주 내] 결제 페이지 INACTIVE 업종 면책 문구

**근거:** 계획서 4절 + 법적 리스크 방지 (환불 분쟁 예방)

**구현 위치:**
- `/pricing` 페이지 — 카테고리 선택 또는 로그인 후 업종 인식 시
- 결제 완료 페이지 — 영수증에 면책 문구 포함

**문구 안:**
```
※ 음악 스튜디오, 학원, 법률사무소 등 일부 업종은 현재 네이버 AI 브리핑 노출 대상이
아닙니다. AEOlab은 ChatGPT·Google·카카오맵·네이버 검색 최적화를 통해 전체 AI 가시성을
향상시킵니다. 업종별 서비스 범위는 공지사항을 참고해주세요.
```

---

### 2.6 🟢 [BEP 이후] Evidence Trail (신뢰도 강화)

**계획서 3.1 — 구독자 20명 이후 권장**

```python
# score_engine.py 각 항목에 evidence 부착
{
    "has_intro": True,
    "evidence": {
        "source": "user_input",
        "detected_at": "2026-04-30T10:00:00",
        "confidence": 0.9,
        "raw": "업체 소개글 150자 이상 입력됨"
    }
}
```

---

### 2.7 🟢 [BEP 이후] Drift Detection

**계획서 3.2 — 구독자 20명 이후 권장**

- Playwright 크롤러 DOM 셀렉터 성공/실패율 30분 모니터링
- 실패율 ≥ 20% 시 관리자 알림 (카카오 또는 이메일)
- `naver_place_stats.py`, `smart_place_auto_check.py` 양쪽 적용

---

## 3. 확인 필요 (수동 점검)

### 3.1 대시보드 로딩 회귀 (계획서 2.1)

**체크리스트:**
- [ ] INACTIVE 업종 계정(예: 홍뮤직스튜디오) → `/dashboard` 정상 로딩 확인
- [ ] ACTIVE 업종 테스트 계정 → `IneligibleBusinessNotice` null 확인
- [ ] LIKELY 업종(미용실) → 파란 "준비 가이드" 박스 표시 확인
- [ ] Network 탭 → `businesses` 쿼리 응답 200 + 데이터 정상

### 3.2 m.place.naver.com 경로 실측 (계획서 2.2)

**체크리스트:**
- [ ] `smart_place_auto_check.py` `/place/{id}` 경로 서버 로그 확인 (기존 `/restaurant/` 호출 없는지)
- [ ] 실제 사업장 ID 3종으로 `curl -I https://m.place.naver.com/place/{id}` 응답 확인

### 3.3 ScoreEvidenceCard FAQ 행 제거 확인 (계획서 2.1)

- [ ] `ScoreEvidenceCard.tsx`에서 FAQ 관련 행이 표시되지 않는지 UI 확인

---

## 4. 구현 우선순위 매트릭스

| 우선순위 | 항목 | 영향도 | 긴급도 | 예상 시간 |
|---------|------|--------|--------|----------|
| 🔴 즉시-1 | calc_smart_place_completeness 100점 버그 수정 | 高 | 高 | 30분 |
| 🔴 즉시-2 | guide/ai-info-tab/page.tsx 생성 (5단계 가이드) | 高 | 高 | 3~4h |
| 🔴 즉시-3 | 프랜차이즈 is_franchise 게이팅 추가 | 高 | 高 | 2~3h |
| 🟡 1주-1 | 생성 콘텐츠 DB 저장 (businesses 컬럼 추가) | 中 | 中 | 1~2h |
| 🟡 1주-2 | Trial 결과 INACTIVE 업종 CTA 분기 | 中 | 中 | 1h |
| 🟡 1주-3 | 결제 페이지 면책 문구 추가 | 中 | 中 | 1h |
| 🟡 1주-4 | _detect_faq() deprecated 명시 + UI 잔존 제거 확인 | 中 | 中 | 1h |
| 🟡 1주-5 | 단일 소스 원칙 — 동기화 주석 추가 (B안) | 低 | 低 | 15분 |
| 🟢 이후-1 | Evidence Trail 부착 | 中 | 低 | 8~12h |
| 🟢 이후-2 | Drift Detection 알람 | 中 | 低 | 4~6h |
| 🟢 이후-3 | 단일 소스 API 엔드포인트 (A안) | 低 | 低 | 2h |
| 🟢 이후-4 | 자동 회귀 테스트 Playwright/pytest | 低 | 低 | 8h |

---

## 5. DB 변경 사항 (Supabase SQL Editor 실행)

```sql
-- [즉시-3] 프랜차이즈 여부
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN businesses.is_franchise IS '프랜차이즈 가맹점 여부. TRUE면 AI 브리핑 대상에서 제외 (네이버 공식 2026-04-30 확인)';

-- [1주-1] 생성 콘텐츠 저장
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_intro_draft TEXT,
  ADD COLUMN IF NOT EXISTS naver_intro_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS talktalk_faq_draft JSONB,
  ADD COLUMN IF NOT EXISTS talktalk_faq_generated_at TIMESTAMPTZ;
```

---

## 6. 신규 발견 전략적 기회

PDF 분석에서 도출된 AEOlab 전략 반영 사항:

### 6.1 2026-04-27 AI 탭 베타 공개 대응
- 네이버가 2026-04-27 통합검색에 별도 "AI 탭" 베타 공개 (네이버플러스 우선)
- AEOlab Track1 점수 비중 강화 근거 → 영업/마케팅 메시지에 활용 가능
- CLAUDE.md `DUAL_TRACK_RATIO` 재검토 시점: 전 업종 정식 확대 후

### 6.2 C-rank 연계 블로그 가이드 강화
- AI 브리핑 선정 알고리즘 3단계 공개:
  1. AiRSearch → 정보형 검색 판단 → AI 브리핑 활성화
  2. 네이버 자체 서비스(블로그·카페) 우선 탐색
  3. HyperCLOVA X 핵심 정보 추출
- 소상공인 블로그 연계 가이드(`generate_naver_intro()` 반환 Q&A 5개)가 C-rank 향상에 직결됨 → 기능 가치 메시지 강화

### 6.3 FAQ 구조화 = 블로그/소개글 전략으로 재포지셔닝
- JSON-LD FAQ 스키마가 AI 브리핑 선정에 가장 효과적 (블로그 PDF 확인)
- 현재 `generate_talktalk_faq()` = 톡톡 챗봇 FAQ 생성
- 추가 기능 고려: **소개글 내 Q&A 구조** 자동 삽입 (generate_naver_intro()에 이미 Q&A 5개 포함됨 ✅)

### 6.4 Likely 업종 확대 모니터링
- 네이버가 비공식으로 beauty·nail·fitness·yoga·pet·pharmacy(LIKELY) 확대 중
- 모니터링 전략: 주 1회 "네이버 AI 브리핑 업종 확대" 키워드 검색 → Claude Haiku 요약 → 운영자 이메일 (계획서 3.3)

---

## 7. 미해결 질문 (판단 보류)

- **리뷰 임계값**: 공식 미공개. 10건 기준은 내부 추정. 사용자에게 "권장" 표현 유지.
- **Likely 업종 확대 시점**: 공식 공지 없이 감지하려면 Drift Detection(이후-2) 연동 필요.
- **AI 정보 탭 자동 감지**: Playwright로 SmartPlace 관리자 페이지 토글 상태 감지 가능성. 개인정보 동의 문제 → 자기 보고 방식(체크박스) 유지 권장.
- **소개글 길이 기준**: 150자/300자/500자 중 노출률 최고 기준 → 베타 사용자 10명 이상 데이터 후 분석.
- **환불 정책 적용 시점**: 면책 문구 적용 전 가입자는 별도 안내 메일 + 선택권 제공 필요.

---

## 8. 작업 재개 방법 (새 대화창)

```
"docs/ai_briefing_implementation_plan_v2.0.md를 읽고 [즉시-N] 부터 진행해주세요."
```

**에이전트 자동 라우팅:**
- 즉시-1 (score_engine.py 수정) → `backend-dev`
- 즉시-2 (guide/ai-info-tab 페이지) → `frontend-dev`
- 즉시-3 (프랜차이즈 게이팅) → `backend-dev` + `db-migrate` 병렬
- 1주-1 (DB 컬럼 추가) → `db-migrate`

---

## 9. 점검 결과 로그

```
### 2026-04-30 초기 점검 (v2.0 작성)
- 발견: calc_smart_place_completeness() 90점 버그 (즉시-1)
- 발견: guide/ai-info-tab/page.tsx 미존재 (즉시-2)
- 발견: 프랜차이즈 게이팅 미구현 (즉시-3, 네이버 공식 확인)
- 발견: 생성 콘텐츠 DB 저장 경로 없음 (1주-1)
- 확인: BRIEFING_ACTIVE_CATEGORIES backend/frontend 일치 ✅
- 확인: /place/{id} 마이그레이션 완료 ✅
- 확인: intro_text 회귀 제거 완료 ✅
- 확인: 4종 대시보드 카드 통합 완료 ✅
- 출처: PDF 6개 분석 (네이버 공식 + 리드젠랩 블로그 2025.09.26)
```

```
### 2026-04-30 즉시-1~3 + 1주-1~5 구현 완료 (v4.1)

#### 백엔드 (Python)
- score_engine.py
  · calc_smart_place_completeness(): 소개글 10→20점 → 합계 100점 ✅
  · get_briefing_eligibility(category, is_franchise=False): 프랜차이즈 게이팅 추가 ✅
  · 호출 2곳 모두 biz.get("is_franchise") 전달 ✅
  · briefing_meta 응답에 is_franchise 필드 포함 ✅
- routers/business.py
  · _BIZ_OPTIONAL_COLS에 is_franchise + naver_intro_draft + talktalk_faq_draft 추가 ✅
  · PATCH allowed에 is_franchise 추가 ✅
  · /intro-generate: businesses.naver_intro_draft 저장 (graceful fallback) ✅
  · /talktalk-faq-generate: businesses.talktalk_faq_draft 저장 (graceful fallback) ✅

#### 프론트엔드 (TypeScript) — TypeScript 컴파일 통과 ✅
- frontend/types/entities.ts: Business에 is_franchise + ai_info_tab_status + naver_intro_draft 등 옵셔널 필드 추가
- frontend/components/dashboard/RegisterBusinessForm.tsx
  · getBriefingEligibility(category, isFranchise) 시그니처 확장
  · isFranchise 상태 + 체크박스 추가 (모든 업종에 노출)
  · 프랜차이즈 안내 메시지 + 등록 시 is_franchise POST
- frontend/components/dashboard/IneligibleBusinessNotice.tsx: isFranchise prop 추가, 프랜차이즈 사유 분기
- frontend/components/dashboard/IntroGeneratorCard.tsx
  · currentIntro/generatedAt/planLabel/planMonthlyLimit prop 추가
  · 플랜 뱃지(Free/Basic/Pro/Biz · 월 N회) 표시
  · Free 플랜은 버튼 숨김 + /pricing 안내
- frontend/components/dashboard/TalktalkFAQGeneratorCard.tsx
  · initialDraft/generatedAt/planLabel/planMonthlyLimit prop 추가
  · 동일한 플랜 한도 안내 + 초안 자동 로드
- frontend/app/(dashboard)/dashboard/page.tsx
  · v4.1 신규 컬럼 graceful 페치 (try/catch + 별도 SELECT)
  · planLabel/planFaqLimit subscription 기반 계산
  · IneligibleBusinessNotice에 isFranchise 전달
  · IntroGeneratorCard/TalktalkFAQGeneratorCard에 초안 + 플랜 정보 전달
  · "AI 브리핑 5단계 가이드" 링크 카드 신규
- frontend/app/(dashboard)/guide/ai-info-tab/page.tsx (신규)
  · subscription·business 페치 후 AiInfoTabGuide에 전달
- frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx (신규)
  · 5단계 가이드 (탭 찾기·토글·소개글·소식·리뷰)
  · 요금제별 동작 분기(Free=업그레이드 CTA, Basic+=AI 자동 생성 안내)
  · 단계별 완료 체크 (✓ 표시) — has_intro/has_recent_post/review_count/ai_info_tab_status 기반
- frontend/app/(dashboard)/DashboardSidebar.tsx
  · "AI 브리핑 5단계" 메뉴 항목 추가 (Sparkles 아이콘)
- frontend/app/(public)/pricing/page.tsx
  · PlanRecommender 아래 "업종별 AI 브리핑 노출 범위 안내" 면책 박스 (프랜차이즈 제외 명시)
- frontend/app/(public)/trial/components/TrialResultStep.tsx
  · INACTIVE/LIKELY 업종 감지 시 안내 배너 + 대체 채널 강조 (ChatGPT·Gemini·Google·카카오맵)

#### DB 마이그레이션 (Supabase SQL Editor 실행 필요)
scripts/supabase_schema.sql 끝에 v4.1 섹션 추가 ✅
- ALTER TABLE businesses ADD COLUMN is_franchise BOOLEAN DEFAULT FALSE
- ALTER TABLE businesses ADD COLUMN naver_intro_draft TEXT
- ALTER TABLE businesses ADD COLUMN naver_intro_generated_at TIMESTAMPTZ
- ALTER TABLE businesses ADD COLUMN talktalk_faq_draft JSONB
- ALTER TABLE businesses ADD COLUMN talktalk_faq_generated_at TIMESTAMPTZ

#### 검증
- TypeScript 컴파일: tsc --noEmit EXIT=0 ✅
- Python 구문 검증: ast.parse OK ✅
- 미실행 항목: BEP 이후 (Evidence Trail, Drift Detection, 자동 회귀 테스트)
```

---

*최종 업데이트: 2026-04-30 — v1.0 점검 후 v2.0 재작성*
*선행 문서: `docs/ai_briefing_audit_plan_v1.0.md`, `docs/ai_briefing_redesign_v2.0.md`*
