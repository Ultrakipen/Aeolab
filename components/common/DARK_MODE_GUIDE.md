# 다크모드 도입 가이드 (2026-05-17)

## 인프라 (이미 완비됨)
- `app/globals.css:5` — `@custom-variant dark (&:is(.dark *))`
- `app/globals.css:51,89` — `:root` / `.dark` CSS 변수 두 세트
- `app/globals.css:7-49` — `@theme inline`로 토큰 → Tailwind 연결
- shadcn 컴포넌트는 이미 다크모드 호환

## 추가 완료
- `components/common/ThemeToggle.tsx` — 라이트/다크/시스템 토글
  - localStorage 영속 (`aeolab.theme` 키)
  - 시스템 변경 자동 추적
  - SSR FOUC 방지

## 다음 단계 (별도 회차)

### 1. 헤더에 토글 추가
```tsx
// app/(dashboard)/layout.tsx 또는 components/dashboard/DashboardSidebar.tsx
import ThemeToggle from "@/components/common/ThemeToggle";
// ...
<ThemeToggle />
```

### 2. 카드 컴포넌트 점진 마이그레이션
**현재 하드코딩 다수** — 57+ 위치 `bg-white`, 100+ 위치 `text-gray-900` 등.

**마이그레이션 패턴**:
| 라이트 | 다크 대응 |
|--------|---------|
| `bg-white` | `bg-white dark:bg-gray-900` |
| `bg-gray-50` | `bg-gray-50 dark:bg-gray-800` |
| `bg-gray-100` | `bg-gray-100 dark:bg-gray-800` |
| `text-gray-900` | `text-gray-900 dark:text-gray-100` |
| `text-gray-700` | `text-gray-700 dark:text-gray-300` |
| `text-gray-500` | `text-gray-500 dark:text-gray-400` |
| `border-gray-200` | `border-gray-200 dark:border-gray-700` |
| `border-gray-100` | `border-gray-100 dark:border-gray-800` |
| `divide-gray-100` | `divide-gray-100 dark:divide-gray-800` |
| `shadow-sm` | `shadow-sm dark:shadow-none dark:ring-1 dark:ring-gray-800` |

**상태 색상** (변경 거의 없음, 대비만 보강):
- `bg-emerald-50` → `bg-emerald-50 dark:bg-emerald-900/30`
- `text-emerald-700` → `text-emerald-700 dark:text-emerald-300`
- `border-emerald-200` → `border-emerald-200 dark:border-emerald-800`
- `bg-red-50` / `bg-amber-50` / `bg-blue-50` 동일 패턴

### 3. 우선순위 (점진)
1. 메인 카드 (DualTrackCard, ScoreBreakdownCard, KeywordRankCard) - 가시 영향 큼
2. 액션 카드 (DailyMissionCard, Day7ActionCard, MonthlyChecklistCard)
3. 입력 폼 (RegisterBusinessForm, IntroGeneratorCard)
4. 모달·플로팅 (PhotoCategoryCard 모달, OnboardingTour)
5. 페이지 레이아웃 (layout.tsx, DashboardSidebar)

### 4. 자동화 (선택)
codemod 또는 정규식 일괄 치환으로 80% 처리 가능 — 단 시각 확인 필수.

## 활성화 결정
**현재**: 토글 추가만, 기본 라이트 유지. 사용자가 다크 선택 시 일부 영역만 다크 적용 (점진 마이그레이션 동안).

**전체 활성화 시점**: 메인 카드 5개 + 액션 카드 4개 + 페이지 레이아웃 마이그레이션 완료 후 (예상 1주 작업).

---
*최종 갱신: 2026-05-17*
