# 2026-05-17 세션 요약 — 메인 엔진 최적화 v1.1 + UI 최적화 1~3차

> **세션 기간**: 2026-05-17 단일 세션
> **작업 규모**: 백엔드 9건 + 프론트엔드 ~120건 + DB 1건 + 문서 5건
> **트리거**: `docs/main_engine_optimization_v1.0.md` 점검·수정·실행
> **결과**: 14건 이슈 일괄 처리 (오류 수정 6 + 신규 기능 5 + UI 개선 9)
> **연관 문서**: `docs/main_engine_optimization_v1.1.md` (계획), CLAUDE.md (최근 업데이트)

---

## 0. 한눈에 보기

| 단계 | 작업 수 | 핵심 산출물 |
|------|---------|------------|
| **0단계 검증** | 1건 | v1.0 오판 2건 + 신규 갭 1건 발견 → v1.1 문서 작성 |
| **Phase 1 §3** | 5건 | 사진 사전 통합·D.I.A./LSI·소식 알림·photo-guide·PHOTO_GUIDES |
| **DB v5.6** | 1건 | businesses.last_post_at 컬럼 (사용자 직접 실행) |
| **UI 1차** | 4건 | 1줄 수정 3건·모달 접근성·dia_score UI·text-xs/rounded 통일 |
| **UI 2차** | 2건 | dashboard 1453→412줄 분리·액션 카드 4단계 계층 |
| **UI 3차** | 2건 | EmptyState·ThemeToggle·가이드 문서 2종 |
| **검증·배포** | 2회 | SSH grep 메인 세션 직접 재검증 (이중 검증) |

---

## 1. 0단계 — v1.0 계획서 검증 후 v1.1 갱신

### 점검 방법
- general-purpose 에이전트로 메인 엔진 5대 영역 코드 직접 확인 (105K tokens, 112초)
- 각 §3.X 항목별로 "문서 주장 vs 실제 코드 라인" 비교

### 발견한 오판 (v1.0 → v1.1 수정)

| v1.0 주장 | 검증 결과 | 조치 |
|----------|---------|------|
| §3.1 별점 미반영 → 검증 필요 | ❌ **오판** — `score_engine.py:288-298` 이미 50% 가중치 반영(`ar/5×50`) | §3.1을 **사진 카테고리 단일 소스 통합**으로 교체 |
| §3.4 JSON-LD 미구현 → 자동 생성·검증 강화 | ⚠️ **부분 오판** — `schema_gen.py:14-93` 생성 엔드포인트 + `website_checker.py` 크롤링 + `score_engine.calc_schema_seo` 3중 체계 이미 작동 | §3.4 범위를 UI 카드 추가만으로 축소 (Phase 1에서는 연기) |

### 새 갭 발견 (v1.1 신규 편입)
1. **사진 카테고리 사전 백/프론트 불일치** — 백 9업종(restaurant·cafe·bakery·bar·accommodation·beauty·nail·**fitness·pet**) vs 프론트 7업종 (fitness/pet 누락) + 카테고리명 표준 불통일(`·` vs `-`)
2. **`*_server.py` 잔재 파일 위험** — `scan.py.server_backup`, `jobs_server.py` 등 사본 다수
3. **D.I.A. 사후 검증 함수 부재** — 생성 콘텐츠 5요소 충족도 자동 검증 인프라 없음

### 산출
- `docs/main_engine_optimization_v1.1.md` 신규 작성

---

## 2. Phase 1 — 메인 엔진 5건 구현

### §3.1 사진 카테고리 사전 단일 소스 통합 (P0, 4시간)

**신규 파일**:
- `backend/services/photo_categories.py` (9업종 단일 진실 소스, 정규화 함수)
- `frontend/lib/photoCategories.ts` (프론트 미러, `·`/`-` 호환)

**수정 파일**:
- `backend/services/score_engine.py:484-509` — `_EXPECTED_PHOTO_CATS` dict 제거 → `from services.photo_categories import find_missing`
- `frontend/components/dashboard/PhotoCategoryCard.tsx` — 단일 소스 import + getCountNormalized 사용
- `frontend/app/(dashboard)/dashboard/page.tsx` — `SUPPORTED_CATEGORIES` import, 하드코딩 7업종 → 9업종 활성화

**검증**: backend 9업종 ↔ frontend 9업종 100% 일치, `·`/`-` 카테고리명 정규화 호환

### §3.2 D.I.A./LSI 프롬프트 강화 (P1, 1주 → 압축 진행)

**`backend/services/guide_generator.py:1207~1300`**:
- `_INTRO_PROMPT_TMPL`에 **D.I.A. 5요소 강제 블록 추가** — Diversity·Information·Authority·Timeliness·Originality
- `generate_naver_intro()` 시그니처 확장 — `lsi_keywords`, `category` 파라미터 신설
- `keyword_taxonomy.get_all_keywords_flat()` 자동 LSI 8개 추출
- 적시성 마커 `[YYYY년 M월 기준]` Claude 누락 시 자동 보강 (fallback)

**신규 파일 `backend/services/content_validator.py`**:
- `validate_intro_dia(text, keywords, lsi_keywords)` 0~100 사후 검증
- 각 요소 만점: Diversity(25) + Information(25) + Authority(15) + Timeliness(15) + Originality(20)
- 정규식 기반, AI 호출 0회
- 추상 표현(`최고`, `최상` 등) 감점

**`backend/routers/business.py:817-867`**:
- `IntroGenerateResponse.dia_score: dict | None` 필드 신규
- `generate_naver_intro` 호출 후 `validate_intro_dia` 자동 실행 → 응답 포함

**검증** (서버 실측):
- 권위·차별점·적시성 모두 갖춘 텍스트 → **D.I.A. 90.0/100**
- 짧은 텍스트 → 52.5점 (낮을 경우 사용자에게 보완 안내)

### §3.3 소식 미작성 14일 알림 (P1, 2일)

**`backend/scheduler/jobs.py` 신규 잡**:
```python
async def inactive_post_alert_job() -> None:
    """14일 이상 소식 미작성 사업장에 카카오 알림 (매일 09:10 KST)"""
```
- 멱등키: `post_remind_{biz_id}_{cutoff_date}` (14일에 1회만)
- `kakao_scan_notify=False` 사용자 옵트아웃 존중
- 가입 14일 미만 사용자 자동 skip (created_at 체크)
- `last_post_at` 컬럼 부재 시 graceful fallback (잡 스킵 + warning)

**`backend/services/kakao_notify.py:108`**:
- `send_post_remind(phone, biz_name, days=14)` 신규 — action_items 템플릿 재활용 (새 카카오 템플릿 신청 불필요)

**`backend/routers/business.py:update_business`**:
- `has_recent_post=True` 토글 시 `last_post_at = NOW()` 자동 갱신
- 컬럼 부재 시 retry 폴백

**DB v5.6** (`scripts/supabase_schema.sql` 끝부분):
```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_post_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_businesses_last_post_at ON businesses (last_post_at);
```
- 사용자 직접 실행 완료 (2026-05-17 세션 중)

**검증**: Scheduler 시작 로그에 `Added job "inactive_post_alert_job"` 확인

### §3.4 JSON-LD UI 카드 (Phase 1 연기)
v1.0 검증 결과 백엔드는 이미 작동 — UI 카드만 별도 회차로 연기

### §3.5 PHOTO_GUIDES 사전 + 모달 UI (P2, 2~3일 → 압축 진행)

**신규 파일 `backend/services/photo_guide.py`**:
- 9업종 × 3~4 카테고리 = 약 30개 가이드 엔트리
- 각 엔트리: `description` + `examples[]` + `tips[]`
- 정적 사전 (DB·AI 호출 0회)

**신규 엔드포인트** `GET /api/report/photo-guide/{category}`:
- 인증 불필요, HTTP 200 / 3ms 응답
- 미지원 업종은 HTTP 404 (UI 1차에서 추가)

**`frontend/components/dashboard/PhotoCategoryCard.tsx`**:
- `photoGuides` props 신규
- 부족 카테고리 클릭 → "이렇게 찍어보세요" 모달
- 접근성 dialog/aria-modal/aria-labelledby

**`frontend/app/(dashboard)/dashboard/page.tsx`**:
- Promise.all에 photo-guide fetch 추가
- `photoGuides` SSR 전달

---

## 3. UI 최적화 1차 (4건)

### 1차-1 빠른 1줄 수정 묶음

| 파일 | 변경 |
|------|------|
| `backend/scheduler/jobs.py:4701` | 오탈자 슬랙 발송 1줄 제거 (`keyword_rank_pro_daily_job 실패` 잘못된 발송) |
| `backend/services/content_validator.py:33` | 적시성 정규식 대괄호 제거 (`\[20\d{2}` → `20\d{2}`). 효과: 일반 `2026년 5월` 텍스트도 인식, 15점 부여 |
| `backend/routers/report.py:get_photo_guide` | 미지원 업종 HTTP 404 추가 (남용·오타 차단) |

**서버 실측 검증**:
- `2026년 5월 기준` 텍스트 → `has_marker: True`, timeliness 15점 (이전엔 0점)
- `/api/report/photo-guide/unknown_category` → HTTP 404
- `/api/report/photo-guide/restaurant` → HTTP 200

### 1차-2 PhotoCategoryCard 모달 접근성

`PhotoCategoryCard.tsx`에 useEffect 기반:
- **ESC 키 닫기** — `document.addEventListener("keydown", ...)` Escape 감지
- **body scroll lock** — 모달 열림 동안 배경 스크롤 차단
- **focus 관리** — 열림 시 닫기 버튼 자동 포커스, 닫힘 시 trigger 버튼으로 복귀
- **터치 영역** — 닫기 버튼 `min-w-[44px] min-h-[44px]` (WCAG AA)
- **trigger ref 동적 관리** — onClick에서 `e.currentTarget` 캡처

### 1차-3 dia_score UI 노출 (가장 큰 UX 가치)

**신규 파일 `frontend/components/dashboard/DiaScoreBadge.tsx`** (180줄):
- D.I.A. 5요소를 각 행으로 표시 (D·I·A·T·O)
- 점수별 색상 자동 (80+ emerald / 50+ amber / 50- red)
- 만점 대비 진행바 + ARIA progressbar
- 각 요소별 부족 안내 힌트 (예: "LSI 키워드 2/7 — 4개 이상 권장")
- 70점 미만 시 재생성 권장 안내

**`IntroGeneratorCard.tsx`**:
- `IntroStats.dia_score: DiaScore | null` 필드 추가
- 응답에서 dia_score 받아 stats에 매핑
- 본문 아래 `<DiaScoreBadge dia={stats.dia_score} />` 노출
- 배지 영역에 종합 점수 1줄 (`D.I.A. 90점`)

### 1차-4 text-xs/rounded 일괄 교체 (~120개 파일)

frontend-dev 에이전트 위임 (560 tool uses, 35분):

**text-xs → text-sm 정책**:
- 본문·제목·액션 → `text-sm` 또는 `text-sm md:text-base`
- 면책·캡션·시간 등은 `text-xs` 유지하되 `text-gray-500` 이상 명도 보장 (text-gray-400 이하는 보강)

**rounded-lg/2xl → rounded-xl 정책**:
- 메인 카드 → `rounded-xl` (12px) 단일화
- **예외 42건 유지** (정당한 사용): 모달·플로팅 패널·아이콘 박스(w-12+)·채팅 말풍선·tab pill nav·CTA 풀와이드·아코디언·spotlight ring

**PlaceCompareTable.tsx 우선 점검**:
- 핵심 비교 데이터 `text-sm` → `text-sm md:text-base`
- `text-gray-400` → `text-gray-500`
- 루트 컨테이너 `rounded-2xl` → `rounded-xl`

---

## 4. UI 최적화 2차 (2건)

### 2차-1 dashboard/page.tsx 1453줄 → 412줄 분리 (-72%)

frontend-dev 에이전트 위임 (124K tokens, 15분).

**신규 `sections/` 디렉터리 8개 파일**:

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `pageHelpers.ts` | 124 | 순수 계산 함수 (nextScanLabel, calcLastScannedLabel 등) |
| `DashboardHeader.tsx` | 287 | 헤더·사업장 셀렉터·ScanWithModal·키워드 알림 |
| `DashboardScoreZone.tsx` | 147 | DualTrackCard·KeywordRankCard·INACTIVE 배너 |
| `DashboardActionZone.tsx` | (2차-2에서 재작성) | 4단계 액션 카드 |
| `DashboardInsightZone.tsx` | 96 | AiInfoTabStatusCard·AiTabPreviewCard·PhotoCategoryCard 등 |
| `DashboardGeneratorZone.tsx` | 53 | IntroGeneratorCard·TalktalkFAQGeneratorCard |
| `DashboardDetailZone.tsx` | 621 | DashboardAccordion 탭 3개 (점수 분석·경쟁사·개선) |
| `DashboardFooter.tsx` | 53 | 빠른 이동 그리드·BasicTrialBanner·AIAssistant |

**원칙 준수**:
- 모두 server component (use client 미추가)
- SSR 페칭은 page.tsx에서만, 분할 컴포넌트는 props 수신
- TS 컴파일 에러 0건
- 기존 모든 카드 노출 조건·순서 정확히 유지

### 2차-2 액션 카드 4단계 우선순위 계층

`DashboardActionZone.tsx` 재작성:

| 단계 | 카드 | 색상 톤 | 아이콘 |
|------|------|--------|--------|
| ① 오늘 시급 | DailyMissionCard | rose-500 / rose-100/800 | Target |
| ② 이번 주 | Day7ActionCard | blue-500 / blue-100/800 | Calendar |
| ③ 점수 회고 | ScoreAttributionCard | slate-500 / slate-100/800 | TrendingUp |
| ④ 이달 체크 | MonthlyChecklistCard | emerald-500 / emerald-100/800 | ListChecks |

**`ZoneHeader` 서브 컴포넌트**:
- 좌측 컬러바(`w-1 self-stretch rounded-full`) + 단계 번호 + 아이콘 + 라벨 + 설명
- 사용자가 "지금 뭘 먼저 해야 하는지" 한눈에 파악

---

## 5. UI 최적화 3차 (2건)

### 3차-1 EmptyState 공통 컴포넌트

**`components/common/EmptyState.tsx`**:
- 모든 빈 상태 카드 통일
- 톤: default(회색) / info(파랑) / warning(주황)
- ARIA: `role="status"` `aria-live="polite"`
- 일관 padding `py-8 md:py-10`, 텍스트 `text-sm md:text-base`
- 선택적 action 슬롯 (CTA 버튼)
- bordered 옵션 (독립 카드 또는 부모 카드 내 둘 다 지원)

**`components/common/COLOR_GUIDE.md`** 가이드 문서:
- 의미별 색상 토큰 (emerald=긍정 / amber=주의 / red=위험 / blue=정보 / slate=보조)
- 카드 rounded 규칙 (메인 xl / 모달 2xl / 배지 full)
- 텍스트 크기 표준 (`text-xs text-gray-400` 이하 금지)
- 점진 정리 우선순위

### 3차-2 다크모드 도입 준비

**인프라 확인**: 이미 완비됨
- `app/globals.css:5` — `@custom-variant dark (&:is(.dark *))`
- `:root` / `.dark` CSS 변수 두 세트 정의됨 (oklch 색공간)
- `@theme inline` 토큰 → Tailwind 연결
- shadcn 컴포넌트는 자동 호환

**`components/common/ThemeToggle.tsx`** 신규:
- 라이트 / 다크 / 시스템 3-way 토글
- `localStorage.aeolab.theme` 영속
- `matchMedia` 시스템 변경 자동 추적
- SSR FOUC 방지 (mounted 가드)
- ARIA `role="radiogroup"` + `role="radio"`

**`components/common/DARK_MODE_GUIDE.md`** 가이드 문서:
- 활성화 절차 (헤더에 토글 추가)
- 마이그레이션 패턴 표 (bg-white → bg-white dark:bg-gray-900 등 12종)
- 점진 우선순위 (메인 카드 → 액션 카드 → 폼 → 모달 → 레이아웃)
- 전체 활성화 시점 권장 (메인 5+액션 4+레이아웃 = 약 1주)

**보류한 작업** (위험성으로 후속 회차 권장):
- green(157건) / emerald(111건) 일괄 교체 — 시각 변화 너무 큼
- bg-white·text-gray-900 등 하드코딩 50+ 컴포넌트 마이그레이션 — 1주 작업

---

## 6. 변경 파일 목록 (총괄)

### 백엔드 (9개)
**신규 (3)**:
- `backend/services/photo_categories.py`
- `backend/services/photo_guide.py`
- `backend/services/content_validator.py`

**수정 (6)**:
- `backend/services/guide_generator.py` — D.I.A. 프롬프트 강화
- `backend/services/score_engine.py` — photo_categories import 교체
- `backend/services/kakao_notify.py` — send_post_remind 신규
- `backend/scheduler/jobs.py` — inactive_post_alert_job 신규 + 오탈자 1줄 제거
- `backend/routers/business.py` — last_post_at 자동 갱신 + IntroGenerateResponse.dia_score
- `backend/routers/report.py` — photo-guide 엔드포인트 + 404 가드

### 프론트엔드 (총 ~130개)
**신규 (12)**:
- `frontend/lib/photoCategories.ts`
- `frontend/components/dashboard/DiaScoreBadge.tsx`
- `frontend/components/common/EmptyState.tsx`
- `frontend/components/common/ThemeToggle.tsx`
- `frontend/components/common/COLOR_GUIDE.md`
- `frontend/components/common/DARK_MODE_GUIDE.md`
- `frontend/app/(dashboard)/dashboard/sections/` — 8개 파일 (pageHelpers + 7 zones)

**수정 (광범위)**:
- `frontend/components/dashboard/PhotoCategoryCard.tsx` — 단일 소스 + 모달 + 접근성
- `frontend/components/dashboard/IntroGeneratorCard.tsx` — dia_score UI + rounded-xl
- `frontend/app/(dashboard)/dashboard/page.tsx` — 1453→412줄 분리 + photo-guide fetch
- text-xs → text-sm 약 120개 파일 일괄 교체
- rounded-lg/2xl → rounded-xl 약 120개 파일 일괄 교체

### DB (1개)
- `scripts/supabase_schema.sql` — v5.6 섹션 추가 (last_post_at)

### 문서 (4개)
- `docs/main_engine_optimization_v1.0.md` (기존, v1.1로 대체)
- `docs/main_engine_optimization_v1.1.md` (신규)
- `docs/session_summary_20260517_main_engine_ui_v1.0.md` (이 문서)
- `CLAUDE.md` 최근 업데이트 2건 추가

---

## 7. 신규 API/엔드포인트

| Method | 경로 | 인증 | 용도 |
|--------|------|------|------|
| GET | `/api/report/photo-guide/{category}` | 불필요 | 업종별 사진 가이드 (정적, AI/DB 0) |

`IntroGenerateResponse` 응답 필드 신규:
- `dia_score: dict | null` — D.I.A. 5요소 사후 검증 결과

---

## 8. DB 마이그레이션

### v5.6 (사용자 실행 완료)
```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_post_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_businesses_last_post_at ON businesses (last_post_at);
COMMENT ON COLUMN businesses.last_post_at IS
  'v5.6: 스마트플레이스 소식 마지막 작성 시각. has_recent_post=True 토글 시 자동 갱신';
```

**graceful fallback** — ALTER 미실행 시:
- `routers/business.py:update_business`에서 컬럼 부재 에러 감지 → `last_post_at` 제외 후 재시도
- `scheduler/jobs.py:inactive_post_alert_job`에서 컬럼 부재 시 잡 스킵 + warning 로그

---

## 9. 서버 배포 검증 결과 (메인 세션 직접)

### 1차 배포 (v1.1 Phase 1)
- 11개 파일 업로드 ✅
- PM2 both online, uptime 2분 ✅
- SSH grep 5개 핵심 라인 직접 확인 ✅
- `/api/report/photo-guide/restaurant` HTTP 200, 3ms ✅
- 서버측 D.I.A. validator 실행 90.0점 ✅
- Scheduler `inactive_post_alert_job` 등록 로그 확인 ✅
- error.log 0건 ✅

### 2차 배포 (UI 최적화)
- 백엔드 9개 + 프론트 ~50개 동기화 ✅
- 프론트 빌드 10.4초 (83 페이지 생성) ✅
- PM2 both online ✅
- SSH grep 핵심 라인 7개 직접 재확인 ✅
- `wc -l dashboard/page.tsx` = **412줄** (1453→412 -72% 확인) ✅
- sections/ 8개 파일 모두 서버 배치 ✅
- 적시성 정규식 수정 효과 — 대괄호 없는 `2026년 5월`도 `has_marker: True`, 15점 ✅
- scheduler 오탈자 0건 (완전 제거) ✅
- DiaScoreBadge import 라인 5 + 사용 라인 184 ✅
- photo-guide 404/200 정확 ✅
- error.log 0건 ✅

### 재발 방지 — 검증 의무 준수
모든 배포에서 **deploy 에이전트 보고 + 메인 세션 SSH grep 재검증** 이중 절차 적용.
2026-05-01 사고(에이전트 "수정 완료" 보고했으나 실제 미반영) 재발 방지 패턴 유지.

---

## 10. 보류한 작업 (후속 회차 권장)

| 작업 | 사유 | 권장 |
|------|------|------|
| §3.4 JSON-LD UI 카드 | 백엔드 3중 체계 이미 작동, UI만 부족 | 별도 1일 작업 |
| green/emerald 일괄 교체 | 157+111건 광범위 변경 시각 리스크 | 가이드 문서로 점진 정리 |
| 다크모드 전체 카드 마이그레이션 | 50+ 컴포넌트 bg-white·text-gray-900 하드코딩 | 별도 1주 작업 (인프라·토글은 이미 준비됨) |
| `*_server.py` 잔재 파일 정리 | 메인 import 경로와 다른 사본 다수 | 별도 정리 작업 (운영 영향 없으나 위험) |
| dashboard PC/모바일 별도 페이지 분리 | 현재 동일 컴포넌트에 md: 분기점만 | CLAUDE.md 작업지침 #1 따라 별도 검토 |
| Phase 2 §4.1 AI 브리핑 다단 측정 | excerpt position/frequency 컬럼 부재 | 사양 업그레이드 후 권장 |
| Phase 2 §4.2 행동·결과 UI 강화 | 백엔드 attribution 이미 작동, UI만 | 사양 무관, 별도 1주 |
| Phase 3 AI탭 Scanner | 6월 네이버 AI탭 전체 확대 후 | 시기 대기 |

---

## 11. 영향 평가 (사용자 가치)

### 데이터 손실 해소
- **D.I.A. 점수**: 백엔드 응답에만 있던 dia_score가 화면에 노출됨 → 사용자가 소개글 품질을 점수로 즉시 확인
- **사진 가이드**: 부족 알림만 보고 "어떻게 찍는지" 모르던 사용자가 모달로 즉시 안내 받음
- **소식 알림**: 14일 미작성 사장님에게 카카오 알림으로 환기 → AI 브리핑 적시성 점수 유지

### 가독성·접근성
- text-xs 약 120건 → text-sm 교체로 모바일 12px 이하 가독성 위반 해소
- PhotoCategoryCard 모달 ESC 닫기 + 포커스 관리 + 44px 터치 영역 (WCAG AA)
- 액션 카드 4단계 시각적 계층으로 "지금 뭐 해야 하는지" 명확화

### 유지보수성
- dashboard/page.tsx 1453줄 → 412줄 분리 → 영역별 독립 수정 가능
- 사진 카테고리 단일 소스 (백/프론트 동기화 보장)
- 빈 상태 공통 컴포넌트로 패턴 통일

### 운영 신뢰성
- scheduler 잘못된 슬랙 발송 차단
- 적시성 정규식 실효성 확보 (대괄호 없어도 인식)
- photo-guide 엔드포인트 미지원 업종 404 — 남용 방지

---

## 12. 다음 단계 권장

1. **베이스라인 측정** — 베타 1명(education, INACTIVE) Track1/Track2 점수 + D.I.A./소식 빈도 캡처. Phase 1 효과 측정의 정확한 비교 시점 확보
2. **JSON-LD UI 카드 추가** — §3.4 (백엔드 이미 작동, UI만)
3. **녹/에메랄드 점진 정리** — COLOR_GUIDE.md에 따라 신규/수정 시 emerald 통일
4. **다크모드 점진 마이그레이션** — DARK_MODE_GUIDE.md에 따라 메인 카드부터
5. **Phase 2 진입 검토** — 사양 업그레이드 후 §4.1·§4.2·§4.3 일괄 진행

---

## 13. 관련 문서

| 문서 | 내용 |
|------|------|
| `docs/main_engine_optimization_v1.1.md` | 이 세션의 계획서 (오판 수정 후) |
| `docs/main_engine_optimization_v1.0.md` | v1.0 초안 (검증 전 오판 포함) |
| `docs/naver_ai_tab_개발로드맵_v1.1.md` | AI탭/AI 브리핑 P0~P3 로드맵 |
| `docs/session_summary_20260517_naver_ai_tab_v1.0.md` | 같은 날 이전 세션 (AI탭 P0+P1-A+P1-C) |
| `docs/naver_gpt_work_standard_v1.0.md` | 네이버·GPT 작업 전 필수 참조 |
| `frontend/components/common/COLOR_GUIDE.md` | 색상 토큰 가이드 (3차-1 산출) |
| `frontend/components/common/DARK_MODE_GUIDE.md` | 다크모드 마이그레이션 가이드 (3차-2 산출) |
| `CLAUDE.md` 최근 업데이트 | 이 세션 2건 (Phase 1 + UI 최적화) |

---

*세션 종료: 2026-05-17 | 다음 권장 작업: 베이스라인 측정 + JSON-LD UI 카드*
