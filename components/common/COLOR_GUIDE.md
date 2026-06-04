# 색상 시스템 가이드 (2026-05-17)

> 신규 컴포넌트·UI 수정 시 이 가이드 준수. 기존 green/emerald 혼재(157+111건)는 점진적 정리.

## 의미별 색상 토큰

| 의미 | 색상 | 사용처 |
|------|------|--------|
| **성공·긍정 점수** | `emerald-*` | 점수 80+ 배지, 완료 상태, 활성 배지, 1위 뱃지 |
| **경고·주의** | `amber-*` | 점수 50~79, 부족 항목 알림 |
| **위험·미흡** | `red-*` | 점수 50 미만, 누락 알림, 에러 |
| **정보·중립** | `blue-*` | 안내, 링크, 안전 액션 |
| **보조·약함** | `slate-*` | 회고, 데이터 분석 카드 |
| **기능적 체크** | `green-*` | 체크박스 체크, 단순 OK 표시 (점수와 무관) |

## 카드 모서리

| 요소 | 클래스 |
|------|--------|
| 메인 카드 | `rounded-xl` (12px) |
| 모달·플로팅 패널 | `rounded-2xl` (16px) |
| 아이콘 박스 (w-12+) | `rounded-2xl` |
| 채팅 말풍선 | `rounded-2xl rounded-tl-sm` 등 |
| 배지·태그 | `rounded-full` |
| 작은 버튼 | `rounded-lg` (10px, 한정 사용) |

## 텍스트 크기 (모바일 가독성 보장)

| 요소 | 클래스 |
|------|--------|
| 본문 | `text-sm md:text-base` (14→16px) |
| 카드 제목 | `text-base md:text-lg font-bold` |
| 큰 점수·수치 | `text-2xl md:text-3xl font-bold` |
| 배지 | `text-sm font-medium` (기본 14px) |
| 면책·캡션 | `text-xs text-gray-500` (12px 허용, 단 색상은 500 이상) |
| 메타데이터 (시간 등) | `text-sm text-gray-500` |

**금지**: `text-xs text-gray-400` 이하 — 모바일 가독성 위반

## 빈 상태

모든 빈 상태는 `components/common/EmptyState` 사용:
```tsx
<EmptyState
  description="다음 스캔 후 표시됩니다"
  tone="default"
/>
```

## 점진 정리 우선순위

1. **신규 컴포넌트**: 즉시 토큰 준수
2. **점수 카드** (DualTrackCard, ScoreBreakdownCard): green→emerald 통일
3. **배지 시스템**: 모든 plan/status 배지 동일 톤
4. **체크박스·체크 아이콘**: green-500 유지 (의미 다름)

---
*최종 갱신: 2026-05-17*
