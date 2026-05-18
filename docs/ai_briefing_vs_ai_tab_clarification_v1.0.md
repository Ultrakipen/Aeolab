# 네이버 AI 브리핑 vs 네이버 AI탭 — 사용자 노출 화면 명확 구분 기준 v1.0

> 작성일: 2026-05-18
> 트리거: 사용자 지적 "이 서비스에서 네이버AI 탭 노출과 네이버 AI 브리핑 노출이 어떤 경우에 이루워 지는지 명확하게 구분해서 안내할 필요가 있음."
> 적용 범위: 랜딩, 대시보드, 가이드, 트라이얼 결과 화면 전체

## 0. 배경 및 문제

백엔드(`score_engine.py:54,82`)는 두 함수로 분리되어 있다:
- `get_briefing_eligibility(category, is_franchise)` → active/likely/inactive
- `get_ai_tab_eligibility(category)` → beta (모든 업종)

그러나 **사용자 노출 화면에서는 두 개념이 혼재**되어 있어 다음과 같은 오해가 발생한다:
- 랜딩 §4 "AI 브리핑" 강조 → 비대상 업종 방문자 "내 업종은 안 됨" 오해 후 이탈
- `AiInfoTabStatusCard` 제목 "AI 정보 탭 상태 확인" → "AI탭"과 "AI 정보 탭"이 같은 의미로 혼동
- `AiTabPreviewCard` 헤더 "AI탭 답변 미리보기" → 부제 없어 어떤 화면을 의미하는지 불명확

## 1. 두 경로 공식 정의 (단일 소스)

| 구분 | 네이버 **AI 브리핑** | 네이버 **AI탭** |
|------|---------------------|----------------|
| **노출 위치** | 검색 결과 **상단** AI 자동 추천 박스 | 검색 결과 **상단 탭 메뉴** 중 하나 ("AI" 탭) |
| **출시 시점** | 2025.08 정식 출시 | 2026-04-27 베타 (네이버플러스 우선) |
| **업종 제한** | **있음** — restaurant·cafe·bakery·bar·accommodation (ACTIVE 5종) + 확대 예정 (LIKELY 다수) | **없음** — 모든 업종 가능 |
| **프랜차이즈** | **제외** (네이버 공식 정책) | 명시 제한 없음 |
| **핵심 노출 조건** | C-rank·D.I.A. 알고리즘, 스마트플레이스 완성도, 리뷰 10건+, 소식·소개글 | 소개글 200자+, 사진 10장+, 예약 연동, 블로그 UGC, 키워드 매칭 |
| **점수 가중치** | Track1 ACTIVE 25점 등 (`NAVER_TRACK_WEIGHTS_V3_1`) | Track1 일부 + `simulate_ai_tab_answer` 시뮬레이션 |
| **AEOlab 함수** | `get_briefing_eligibility()` | `get_ai_tab_eligibility()` — 항상 "beta" |
| **출처** | help.naver.com/service/30026/contents/24632 | 네이버 공식 발표 2026-04-27 |

## 2. 용어 표준 (사용자 노출 화면 전체 통일)

| 용어 | 의미 | 사용 화면 |
|------|------|----------|
| **네이버 AI 브리핑** | 검색 결과 상단 AI 자동 추천 박스 | 랜딩, 대시보드, 가이드 |
| **네이버 AI탭** | 검색 결과 상단 "AI" 탭 메뉴 | 랜딩, 대시보드, 가이드 |
| **AI 정보 탭** | 스마트플레이스(`smartplace.naver.com`) 내 **사장님이 ON/OFF 설정하는 메뉴 이름** — AI 브리핑 노출 토글이 들어 있는 곳 | 설정 카드 부제, 5단계 가이드 |

→ **핵심**: "AI탭"(검색결과 화면) ≠ "AI 정보 탭"(스마트플레이스 내부 메뉴). 두 용어를 명확히 구분.

## 3. 화면별 적용 기준

### 3.1 랜딩 페이지 (`frontend/app/page.tsx`)

| 위치 | 변경 |
|------|------|
| §4 (현재 "네이버 AI 브리핑 3단계") | 그대로 유지 — ACTIVE 업종 임팩트 보존 |
| **§4-B 신규 (§4 직후)** | "네이버 AI탭은 모든 업종 가능 (2026-04-27 베타)" 섹션 추가. 3-카드: ①업종 제한 없음 ②네이버플러스 우선 베타 ③소개글·사진·블로그 UGC가 핵심 |

### 3.2 대시보드 (`frontend/app/(dashboard)/dashboard/page.tsx` 및 sections)

| 위치 | 변경 |
|------|------|
| **상단 영역 신규** | `NaverAiPathwayCard.tsx` — 두 경로 비교 미니카드 (위 §1 표 압축본). DashboardInsightZone 상단에 배치 |
| `AiInfoTabStatusCard` 헤더 | "AI 정보 탭 상태 확인" → **"네이버 AI 브리핑 노출 설정"** + 부제: "스마트플레이스 AI 정보 탭 토글" |
| `AiTabPreviewCard` 헤더 | "AI탭 답변 미리보기" + 부제: **"네이버 검색결과 AI탭 (2026-04-27 베타 · 모든 업종)"** |

### 3.3 가이드 페이지 (`/guide`)

| URL | 변경 |
|-----|------|
| `/guide/ai-info-tab` (기존) | URL 유지. 페이지 제목 "네이버 AI 브리핑 — 5단계 설정 가이드"(이미 그렇게 되어 있음). 페이지 상단에 "AI탭 가이드 보기 →" 링크 추가 |
| **`/guide/ai-tab` (신규)** | AI탭 전용 가이드. 모든 업종 대상. 5개 핵심 항목: 소개글 200자·사진 10장·예약 연동·블로그 UGC·키워드 매칭. 상단에 "AI 브리핑 가이드 보기 →" 링크 |
| `/guide` 허브 (`GuideClient.tsx`) | "AI 브리핑 가이드" 카드 + "AI탭 가이드" 카드 명확 분리, 자기 업종에 맞는 가이드 추천 배지 |

## 4. 면책 문구 표준 (변동성 안내)

모든 화면에 일관 적용:

> "AI 브리핑·AI탭 노출은 네이버 알고리즘 기준이며 보장되지 않습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다."

## 5. 작업 순서 및 검증

1. 명세 문서 (본 문서) 완료
2. P0-1: 랜딩 §4-B 신규 섹션 → `page.tsx` 직접 수정
3. P0-2: `NaverAiPathwayCard.tsx` 신규 → DashboardInsightZone 추가
4. P0-3: `AiInfoTabStatusCard.tsx` 제목 변경
5. P0-4: `AiTabPreviewCard.tsx` 헤더 부제 추가
6. P1: `/guide/ai-tab/page.tsx` 신규 + `/guide/ai-info-tab/page.tsx` 헤더 정리 + `GuideClient.tsx` 허브 정리
7. 서버 빌드 (`npm run build`) → PM2 restart frontend → error.log 60줄 0건 확인
8. SSH grep 6개 핵심 라인 메인 세션 직접 검증

## 6. 영향 범위 (No DB · No Backend)

- 백엔드 변경 없음 (이미 분리됨)
- DB 변경 없음
- 프론트엔드 컴포넌트·페이지만 수정 (약 7개 파일 + 1개 신규 컴포넌트 + 1개 신규 페이지)
- 빌드 크기 영향 미미 (Tailwind 클래스만 추가)

## 7. 비고

- v3.1 점수 모델은 그대로 (백엔드 변경 없음)
- `BRIEFING_ACTIVE_CATEGORIES` 단일 소스 유지 (`score_engine.py:30`)
- 추후 네이버 AI탭이 정식 출시되면 `get_ai_tab_eligibility()` 반환값 "beta" → "active" 전환 (구현 완료, 환경변수 토글로 가능)
