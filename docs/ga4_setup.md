# GA4 측정 인프라 설정 (Phase 3-1)

## 환경변수

`frontend/.env.local` 에 다음 줄 추가:

```bash
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
```

- 값이 없으면 `<GA4 />` 컴포넌트가 자동으로 아무것도 렌더링하지 않음 (개발/스테이징 안전)
- GA4 콘솔(analytics.google.com)에서 `측정 ID(G-)` 복사 → 위 값에 붙여넣기

## 이벤트 트래킹

`frontend/lib/analytics.ts` 의 헬퍼 사용:

| 함수 | 발동 위치 | 이벤트명 |
|------|-----------|----------|
| `trackEvent(name, params?)` | 임의 호출 | (사용자 지정) |
| `trackCTA(location, label)` | 메인 CTA 클릭 | `cta_click` |
| `trackTrialStart(industry?)` | 업종 타일 클릭 | `trial_start` |
| `trackPlanRecommend(plan)` | 플랜 추천 라디오 선택 | `plan_recommend_select` |

## 현재 트래킹 위치

- **랜딩 (`app/page.tsx`)**: 히어로/최종 CTA 4개 (`hero/trial_start`, `hero/sample_view`, `final/trial_start`, `final/sample_view`)
- **HeroIndustryTiles**: 업종 타일 클릭 → `trial_start` (industry 파라미터 포함)
- **PlanRecommender**: 라디오 선택 → `plan_recommend_select`

## 스크롤 뎁스·외부 링크 클릭

GA4 Enhanced Measurement(콘솔 → 데이터 스트림 → 측정값 향상) 기본 활성화에 포함됨.
별도 코드 작성 불필요.

## 검증

배포 후 GA4 실시간 보고서에서 `cta_click`, `trial_start` 이벤트 발송 여부 확인.
