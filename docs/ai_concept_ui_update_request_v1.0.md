# AI 채널 개념 UI 전면 업데이트 작업 요청서 v1.0

> 새 대화창 트리거 문서  
> 작성: 2026-05-28  
> 근거: `docs/naver_ai_concept_standard_v1.0.md` (이 문서를 먼저 읽을 것)  
> 목적: 랜딩·대시보드·가이드·트라이얼 등 전 페이지에서 AI 채널 개념 오류 및 부정확한 표현을 `naver_ai_concept_standard_v1.0.md` 기준으로 일괄 수정

---

## 작업 시작 전 필수 읽기

1. `docs/naver_ai_concept_standard_v1.0.md` — **이 문서가 모든 기준**
2. `docs/ai_channel_exposure_criteria_v1.0.md` — 채널별 노출 기준 상세
3. `backend/services/score_engine.py:BRIEFING_ACTIVE_CATEGORIES` — 업종 분류 단일 소스

---

## 수정 원칙

1. **마이크로리뷰** 용어 → 전체 제거 (네이버 공식 용어 아님)
2. **"AI탭 업종 확대 예정"** → 제거 또는 "AI 브리핑 연내 확대 예정"으로 교체
3. **"음식점·카페·쇼핑 업종 우선 지원"** (AI탭에 대해) → "플레이스·쇼핑 에이전트 통합 (업종 공식 제한 없음)"으로 교체
4. **AI탭 시뮬레이션** → "실측 아님 / 스마트플레이스 데이터 기반 추정" 명시
5. **AI 브리핑 성과 수치** → "예약·주문 약 8% 증가 (네이버 2025.08 공식 발표)" 추가 가능
6. **LIKELY 업종 배지** → "연내 확대 예정 (미용·명소 포함, 네이버 공식)"으로 구체화

---

## 수정 대상 파일 목록

> grep 결과 15개 파일에서 오류 표현 발견. 우선순위 순 정렬.

### 🔴 P0 — 핵심 UI, 즉시 수정

#### 1. `frontend/components/dashboard/AiTabPreviewCard.tsx`
**문제**: 카드 헤더에 "네이버 AI탭 답변 미리보기"라고 표시하지만 실측 데이터가 아닌 시뮬레이션
**수정**:
- 헤더 부제목 추가: "스마트플레이스 정보 기반 시뮬레이션 — AI탭 직접 측정 아님"
- 본문 설명 변경: "음식점·카페·쇼핑 업종 우선 지원 중이며 업종 확대 예정입니다" → "플레이스 에이전트(장소 기반 모든 업종)·쇼핑 에이전트 통합 검색 서비스 (2026-04-27 베타)"
- `readinessLabel` 항목명: "AI탭 노출 가능성" → "AI탭 준비도 (추정)"

#### 2. `frontend/components/dashboard/ChannelScoreCards.tsx`
**문제**: line 67 `"네이버 AI탭 노출 (Beta · 순차 확대 중)"` — "순차 확대 중" 금지 표현
**수정**:
- `"Beta · 순차 확대 중"` → `"Beta · 2026-04-27 출시"`
- AI 브리핑/AI탭 점수 표시 시 명칭 혼동 없도록 확인

#### 3. `frontend/components/dashboard/AIDiagnosisCard.tsx`
**문제**: AI 채널 진단에서 표현 혼용 가능성
**수정**: 3개 레이어(AI 브리핑·AI탭·AI 정보 탭) 명칭 일관성 확인 및 수정

---

### 🟠 P1 — 가이드·공개 페이지, 1순위 수정

#### 4. `frontend/app/(dashboard)/guide/ai-info-tab/page.tsx`
**문제**: AI 정보 탭(스마트플레이스 설정)과 AI탭(통합검색)을 혼용할 수 있는 표현
**수정**:
- 페이지 상단에 "이 가이드는 스마트플레이스 AI 정보 탭(설정 메뉴) + 네이버 AI 브리핑 노출 설정에 관한 내용입니다. 통합검색 AI탭과 다릅니다." 안내 박스 추가
- 업종 확대: "확대 예정" → "미용·명소 등 연내 두 자릿수 업종 확대 예정 (네이버 공식)"

#### 5. `frontend/app/(dashboard)/guide/page.tsx`
**문제**: AI 브리핑·AI탭 가이드 진입점 카드에서 개념 혼용 가능성
**수정**:
- AI 브리핑 카드: "플레이스 AI 브리핑 — 검색결과 플레이스 카드 상단 AI 요약"
- AI탭 카드: "AI탭 — 통합검색 대화형 AI 탭 (쇼핑·장소 예약 통합)"
- 두 서비스가 별개임을 명확히 표시

#### 6. `frontend/app/(public)/how-it-works/page.tsx`
**문제**: AEOlab 동작 원리 설명에서 AI탭 관련 표현
**수정**:
- 5채널 설명 중 AI탭: "업종 확대 예정" 제거, 시뮬레이션 측정임 명시
- AI 브리핑: 성과 수치("예약·주문 약 8% 증가") 추가 검토

#### 7. `frontend/app/(public)/trial/components/TrialResultStep.tsx`
**문제**: 트라이얼 결과 화면에서 AI 채널 안내
**수정**:
- INACTIVE 업종 결과: "AI탭도 노출 가능 (공식 업종 제한 없음)" 명시
- AI탭 결과: "추정 시뮬레이션" 배지 확인

#### 8. `frontend/app/(public)/trial/components/TrialInputStep.tsx`
**문제**: 트라이얼 입력 단계의 AI 채널 설명
**수정**: 채널 설명에서 오류 표현 확인 및 수정

---

### 🟡 P2 — 대시보드 컴포넌트

#### 9. `frontend/components/dashboard/ScoreEvidenceCard.tsx`
**수정**: AI탭 점수 근거 표시 시 "추정" 배지 확인

#### 9. `frontend/components/dashboard/IneligibleBusinessNotice.tsx` *(P2→P1 격상)*
**문제**: 4곳에 명시적 오류 표현 하드코딩
- line ~16: `"네이버 AI탭(음식점·쇼핑 우선)"` → `"AI탭(업종 공식 제한 없음)"`
- line ~18: `"네이버 AI탭 확대 대비"` → `"AI탭(모든 업종 가능) + ChatGPT·Gemini 장기 최적화"`
- line ~22: `"네이버 AI탭(음식점·쇼핑 업종 우선 베타)"` → `"AI탭은 업종 제한 없이 가능(2026-04-27 베타)"`
- line ~24: `"음식점·쇼핑 업종 우선 지원 대상 업종 확대"` → `"AI탭을 통한 노출은 가능 (업종 공식 제한 없음)"`

#### 11. `frontend/components/dashboard/PlatformDistributionChart.tsx`
**수정**: 채널 레이블·설명에서 표현 일관성 확인

---

### 🟢 P3 — 랜딩·공개 마케팅 페이지

#### 12. `frontend/app/page.tsx` (랜딩 메인)
**수정 항목**:
- 5채널 설명 섹션: AI탭 설명에서 "업종 확대 예정" 제거
- AI 브리핑: "연내 두 자릿수 업종 확대 예정" 구체적 표현 추가
- AI탭: "플레이스·쇼핑 에이전트 통합 (업종 공식 제한 없음)" 표현으로 업데이트
- AI 브리핑 성과: "예약·주문 약 8% 증가" 신뢰 수치 추가 (선택)

---

## 수정 후 확인 체크리스트

```
[ ] "마이크로리뷰" 전체 코드베이스 grep → 0건 확인
[ ] "AI탭 업종 확대 예정" grep → AI탭 문맥에서 0건 (AI 브리핑 문맥은 유지)
[ ] "순차 확대 중" AI탭 섹션 → 제거 확인
[ ] AiTabPreviewCard 헤더 → "시뮬레이션" 명시 확인
[ ] ACTIVE/LIKELY/INACTIVE 업종 분류 → score_engine.py 기준과 일치 확인
[ ] AI 브리핑 설정 반영 기간 → "약 1일 소요 (네이버 공식)" 안내 확인
[ ] 3개 레이어 명칭 혼용 → "AI 브리핑 ≠ AI탭 ≠ AI 정보 탭" 각 페이지 확인
```

---

## 참고: 오늘(2026-05-28) 이미 수정된 항목

다음 항목은 서버 배포 완료 — 재작업 불필요:

| 파일 | 수정 내용 |
|------|---------|
| `NaverAiPathwayCard.tsx` | AI탭 배지 "순차 확대 중" → "2026-04-27 출시" |
| `NaverAiPathwayCard.tsx` | AI탭 설명 "음식점·카페·쇼핑 우선" → "통합검색 별도 AI 검색 페이지 / 플레이스 AI 브리핑과 별개 서비스" |
| `NaverAiPathwayCard.tsx` | AI 브리핑 "확대 중" → "연내 미용·명소 등 두 자릿수 업종 목표 (네이버 공식)" |
| `NaverAiPathwayCard.tsx` | LIKELY 배지 → "연내 확대 예정 (미용·명소 포함)" |
| `NaverAiPathwayCard.tsx` | 업종별 추천 채널 — INACTIVE → "AI탭 + ChatGPT + Gemini" (AI탭 포함) |
| `NaverAiPathwayCard.tsx` | `:137` 마이크로리뷰 → 리뷰 AI 요약 기능 표현으로 교체 *(2026-05-28 2차 수정)* |
| `NaverAiPathwayCard.tsx` | `:179` "순차 확대 예정" → "상반기 전체 확대 예정 (네이버 공식)" *(2026-05-28 2차 수정)* |
| `AiInfoTabStatusCard.tsx` | INACTIVE 안내 → "AI 브리핑 비대상이지만 AI탭은 업종 제한 없이 노출 가능" |
| `AiInfoTabStatusCard.tsx` | 설정 반영 "약 1일 소요 (네이버 공식)" 추가 |
| `AiTabPreviewCard.tsx` | "완료했어요" → "완료 표시하기 ✓" |
| `AiTabPreviewCard.tsx` | "아직 시작 전" 박스에 사용법 안내 추가 |
| `AiTabPreviewCard.tsx` | "음식점·카페·쇼핑 업종 우선 지원" → "플레이스·쇼핑 에이전트 통합 (업종 공식 제한 없음)" *(2026-05-28 2차 수정)* |
| `ChannelScoreCards.tsx` | "순차 확대 중" → "2026-04-27 출시" *(2026-05-28 2차 수정)* |
| `IneligibleBusinessNotice.tsx` | "음식점·쇼핑 우선" 4곳 → "업종 공식 제한 없음" *(2026-05-28 2차 수정)* |

---

## 작업 범위 추정

| 구분 | 파일 수 | 예상 시간 |
|------|--------|---------|
| P0 핵심 UI (즉시) | 3개 | 1~2시간 |
| P1 가이드·공개 페이지 | 5개 | 2~3시간 |
| P2 대시보드 컴포넌트 | 3개 | 1시간 |
| P3 랜딩 페이지 | 1개 | 1시간 |
| 서버 배포·검증 | — | 30분 |
| **합계** | **12개** | **약 5~7시간** |

---

## 새 대화창 시작 명령

```
docs/ai_concept_ui_update_request_v1.0.md 기준으로 
docs/naver_ai_concept_standard_v1.0.md를 참조하여 
P0 → P1 → P2 → P3 순서로 전체 페이지 AI 채널 개념 표현을 업데이트할 것.
오늘(2026-05-28) 이미 수정된 항목은 재작업 불필요.
```
