# 대시보드 상단 임팩트 개선 — 세션 핸드오프 (2026-06-11)

> 다음 세션 트리거: `"docs/dashboard_top_redesign_handoff_v1.0.md 기준으로 C(상단 디자인) 이어서 진행"`

## 0. 이 세션에서 한 일 (전부 scp 배포 완료, git 커밋 안 함)

| # | 변경 | 파일 | 상태 |
|---|------|------|------|
| 1 | **place_id 자동 추출 + 리뷰 동기화 트리거** (P1 버그) | `backend/routers/business.py` (`_extract_naver_place_id` :33, update_business :322·:346) | ✅ 라이브·검증 (리뷰 0→4,562) |
| 2 | 리뷰 카피 정직화 ("재스캔하면 반영"→"URL 저장 시 자동 수집·30초 후 새로고침") | `frontend/components/dashboard/AIDiagnosisCard.tsx` :565·:574 | ✅ 라이브 |
| 3 | AI탭 카피 ("스캔 후 자동 확인"→"정식 공개 후 측정/측정 준비 중") | `DashboardHeroCard.tsx` :75, `DashboardInsightZone.tsx` :116·:123 | ✅ 라이브 |
| 4 | 안내문 압축 (반영기간 1줄로) | `DashboardHeader.tsx` :264-266 | ✅ 라이브 (효과 미미, 아래 참조) |

## 1. ⚠️ git push 금지 — 먼저 읽을 것

`.github/workflows/deploy.yml`이 main push 시 서버에서 **`git reset --hard origin/main`** 실행.
- 발견 당시 **서버 미커밋 46개 / 로컬 75개**, 셋(로컬·서버·HEAD) divergence
- **아무거나 push하면 서버의 미커밋 라이브 작업 46개가 전부 wipe됨**
- 이번 수정들도 그래서 **git 커밋 없이 scp로만 배포**함
- push 전 반드시: `ssh root@115.68.231.57 'cd /var/www/aeolab && git status --short | wc -l'` → 0 아니면 push 금지
- 메모리: `project_deploy_reset_hard_risk.md`

## 2. C(상단 디자인) 재판정 결론 — 데이터 찬 화면 기준

검증 계정: **하라식당 본점** `biz_id=c316f483-8a3f-4187-9462-ad6730273af6` (restaurant/ACTIVE, 리뷰 4,562·평점 4.6·Gemini 90%)

- **"임팩트 없음"의 56%는 데이터 상태였음** — URL 미등록·리뷰 미수집으로 빈 화면처럼 보였던 것. #1 수정으로 stage "시작 전"→"미흡"으로 상승, 채널·근거 정상 표시
- **3채널 부정 인상(`!`/`–`/`✗`)은 정당한 실측 진단** — 디자인 결함 아님 (이 식당이 실제로 브리핑 미노출·키워드 부족)
- **남은 진짜 레이아웃 문제 = hero가 묻힘**: 진단 카드가 첫 화면 **45%(heroTop≈409px/900)** 지점. 위 45%는 5겹 chrome(사업장탭→제목→키워드선택+스캔버튼→검색어→안내문)
- **안내문 압축(#4)은 ~4px만 개선** — 텍스트 줄여도 한 줄은 한 줄. **안전한 텍스트 수정으론 hero 못 끌어올림이 입증됨**

## ✅ C 본작업 완료 (2026-06-11 후속 세션) — PC 2단 배치

**확정 방향**: 사용자 선택 = **PC 2단 배치** (좌 진단 hero · 우 스캔 트리거). 모바일은 세로 적층(제목→스캔→hero) 유지.

**구현 (scp 배포·서버 빌드·pm2 재시작·검증 완료, git 커밋 안 함):**
- `page.tsx:367` — hero(`DashboardScoreZone`)와 스캔(`ScanWithModal`)을 한 반응형 컨테이너로 통합. PC: `md:flex-row` 좌 hero(`md:flex-1`)·우 스캔(`md:w-[340px]`), `order` 유틸로 모바일은 스캔(order-1)→hero(order-2). 스캔 전(`!latestScan`)엔 좌측에 "아직 스캔 데이터 없음" 안내(더미 수치 없음).
- `DashboardHeader.tsx:244` — 스캔 섹션+반영 안내문 제거(2단 우측 컬럼으로 이동). `ScanWithModal` import·`scanUsed/scanLimit/lastQueryUsed` 미사용 props 정리.
- `ScanTrigger.tsx` / `ScanWithModal.tsx` — `stacked` prop 추가. 좁은 우측 컬럼(340px)에서 키워드·버튼이 가로로 안 깨지고 세로로 쌓이도록.
- `data-onboarding-tour="scan-button"` 보존(우측 컬럼으로 이동) — 온보딩 투어 정상.

**제약 준수 확인:** 점수 숫자 추가 없음 / 스캔 트리거 '제거' 아닌 '우측 이동'으로 워크플로 유지 / git push 안 함(scp만).

**검증:** tsc `--noEmit` EXIT=0 · 새 lint 에러 0 · 서버 grep 반영 확인 · `npm run build` 성공 · pm2 재시작 에러 0.

**라이브 실측 (browse, 홍스튜디오 계정, 1280x900):** heroTop **45%→36%** (324/900). PC=좌 hero(left 280·width 600)·우 스캔 패널 세로 적층 정상. 모바일(390x844)=제목→스캔(344)→hero(648) 순서 정상, 깨짐 없음.

## ✅ 후보 #3 + #1 추가 완료 (2026-06-11, 사용자 승인 후) — heroTop 36%→27%

**#1 제목 압축** (`DashboardHeader.tsx:191`): 메타 3줄→2줄. 위치·업종 + 브리핑 자격 배지 + 자동스캔 정보(`scanInfo`)를 한 행 `flex-wrap`으로 통합. scanInfo는 `hidden sm:inline-flex`(모바일 숨김 유지).

**#3 stale 배너 흡수** (`DashboardHeader.tsx:134` + `DashboardHeroCard.tsx:108`): RescanBanner는 **방금 스캔 요청(2~3분 소요) 안내만** 전체폭 유지(`showRescanNotice && !rescanIsStale`). **7일 경과(stale) 권유는 hero 카드 안 amber "⟳ 재스캔 권장" 배지로 이동**. 신호 배선: `page.tsx` `showStaleRescan={showRescanIsStale}` → `DashboardScoreZone` → `DashboardHeroCard staleRescan`. `lucide-react RefreshCw` import 추가.

**라이브 실측 (browse, 홍스튜디오 stale 계정):** heroTop **27%** (242/900). 전체폭 stale 배너 사라짐 확인, hero 안 "재스캔 권장" 배지 표시 확인. PC 2단·모바일 제목→스캔→hero 순서 정상, 깨짐 없음. **전체 진행: 45%→36%(2단)→27%(#3+#1), 목표 25-30% 진입.** tsc EXIT=0·새 lint 에러 0·서버 빌드 성공·pm2 클린.

## ✅ 반응형 브레이크포인트 수정 (2026-06-11, 자체 오판 점검 중 발견) — md→lg

**문제:** 2단 분기를 `md:`(768px)로 걸었는데, lg 미만 작은 노트북에서 hero 컬럼이 좁아질 위험. **단, 자체 점검 중 사이드바가 `md`가 아니라 `lg`(1024px, `DashboardSidebar.tsx:329` 실측)에서 표시됨을 발견 → 원래 md:2단도 768~1023엔 사이드바 없어 hero ~344px+로 심각하진 않았음(심각성 과대평가 정정).**

**수정 (`page.tsx:369-392`):** `md:flex-row`→`lg:flex-row`, order/width 유틸 `md:`→`lg:`. lg 미만은 단일 컬럼 full-width(스캔→hero), lg 이상만 2단.

**실측 검증 (browse):** 850px=단일컬럼 full-width(786px)·콘솔 에러0 / 1024px=사이드바+2단, hero 360px(3채널 120px씩 정상)·스캔 340px / 1280px=hero 600px / 390px=세로. 전 구간 깨짐 없음.

## ✅ heroTop 추가 절감 (2026-06-11) — 사업장탭 간격 27%→24%

**실측 원인 규명:** 페이지 컨테이너는 `display:block` + Tailwind v4 `space-y-10`(= 마지막 아닌 자식에 `margin-bottom:40px`). 사업장탭 div는 자체 `mb`가 없어 40px를 그대로 먹음(제목은 `mb-3`가 덮어써 12px). → **사업장탭 div에 `mb-3` 추가**(`DashboardHeader.tsx:105`)로 40px→12px(−28px), 제목↔hero 간격과 리듬 일치. 전역 space-y 미변경(하단 섹션 리듬 보존). 실측 heroTop **214px(24%)**, 시각 정상.

**Item 2(온보딩·무스캔) ✅ 라이브 검증 완료:**
- 온보딩 투어: `OnboardingTour.tsx:84-109` `querySelector([data-onboarding-tour])`+`scrollIntoView` → scan-button 속성 우측 컬럼 보존으로 위치 무관 정상(코드 검증).
- 무스캔 화면: **사용자 승인 후 임시 사업장(name·category만, trial_scan_id/blog_url 없이) API 생성 → 무스캔 상태 라이브 캡처 → API 삭제.** 좌측 placeholder("아직 스캔 데이터 없음")·우측 스캔패널("최근 스캔" 줄 없음)·`lg:items-start` 상단정렬 정상. 삭제 후 사용자 실제 사업장 2개(홍스튜디오·하라식당) 온전 확인.

## (이전) 후보 방향 — 아래는 히스토리

## 3. (참고) C 후보 방향 — 위에서 2단 배치로 확정됨

목표: 진단 카드(hero)를 첫 화면 상단으로. 단 아래 제약 준수.

**제약 (위반 금지):**
- ❌ **점수 게이지/세그먼트/숫자 추가 금지** — `feedback_score_display_text_only` 메모리 + CLAUDE.md. "점수 시각화=개선"으로 오판 말 것. 현 텍스트 단계(getStage 4단계: 시작전/미흡/개선중/양호)가 의도된 설계
- ❌ **스캔 트리거를 진단 아래로 무조건 이동 금지** — 이 페이지 주 동작은 "키워드 선택 + AI 스캔 시작". 재스캔 워크플로 해칠 수 있음. 검증 없이 reorder 말 것
- ❌ git push (§1)

**검토할 후보 방향 (택일/조합, 구현 전 사용자 확인):**
1. **사업장 탭 + 제목 영역 압축** — 현재 제목 블록이 큼. `자동 스캔 없음(관리자)` 등 메타 1줄로 통합
2. **키워드 선택 + 스캔 버튼을 진단 카드 우측/하단으로 재배치** — 진단을 먼저 보이게 하되 스캔 동작 유지 (PC 2단 레이아웃 검토)
3. **재스캔 배너(파란 "7일 지남")를 진단 카드 안 배지로 흡수** — 별도 줄 제거
4. **모바일 별도 검토** — 모바일은 chrome이 더 길어 hero가 훨씬 아래. PC/모바일 분리 레이아웃 원칙(CLAUDE.md)

**관련 파일:**
- 상단 헤더/제목: `frontend/app/(dashboard)/dashboard/sections/DashboardHeader.tsx`
- 키워드/스캔 트리거: `frontend/app/(dashboard)/dashboard/ScanTrigger.tsx`
- 점수 영역 래퍼: `frontend/app/(dashboard)/dashboard/sections/DashboardScoreZone.tsx`
- 진단 hero 카드: `frontend/components/dashboard/DashboardHeroCard.tsx`
- 재스캔 배너: `frontend/app/(dashboard)/dashboard/RescanBanner.tsx`

## 4. 측정 기준 (개선 검증용)

- heroTop %: `[...document.querySelectorAll('div')].filter(e=>/AI 검색 노출/.test(e.textContent)&&e.className.includes('border-2'))[0].getBoundingClientRect().top` / viewportH
- 현재값: **PC 45% (409/900)** · 목표 예: 25~30% 이하
- 배포: scp → `cd /var/www/aeolab/frontend && npm run build` → `pm2 restart aeolab-frontend` (빌드 필수)
- 로그인: hoozdev@gmail.com (browse 스킬로 직접 접속 가능)
