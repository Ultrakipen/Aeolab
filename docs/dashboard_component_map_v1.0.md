# 대시보드 스캔 결과 항목 — 파일 편집 지도 v1.0

> 작성일: 2026-05-30  
> 목적: 대시보드에 표시되는 각 항목의 소스 파일 위치를 한눈에 파악해 직접 편집하기 위한 참조 문서  
> 파일 경로 기준: `frontend/` 폴더 기준

---

## 최상위 구조 (섹션 조합 파일)

| 파일 | 역할 |
|------|------|
| `app/(dashboard)/dashboard/page.tsx` | SSR 데이터 페칭 + 아래 6개 Zone 조합 |
| `app/(dashboard)/dashboard/sections/DashboardHeader.tsx` | 최상단 헤더 |
| `app/(dashboard)/dashboard/sections/DashboardScoreZone.tsx` | 점수 히어로 존 |
| `app/(dashboard)/dashboard/sections/DashboardActionZone.tsx` | 액션 가이드 존 |
| `app/(dashboard)/dashboard/sections/DashboardInsightZone.tsx` | 인사이트 분석 존 |
| `app/(dashboard)/dashboard/sections/DashboardGeneratorZone.tsx` | AI 자동 생성 존 |
| `app/(dashboard)/dashboard/sections/DashboardDetailZone.tsx` | 탭 상세 데이터 존 |
| `app/(dashboard)/dashboard/sections/DashboardFooter.tsx` | 하단 빠른 이동 + AI 도우미 |

---

## Zone 1 — 헤더 (`DashboardHeader.tsx`)

| 항목 | 컴포넌트 파일 |
|------|-------------|
| Trial → 가입 GA4 연결 트래커 | `components/dashboard/TrialAttachTracker.tsx` |
| 온보딩 투어 (신규 사용자) | `components/dashboard/OnboardingTour.tsx` |
| 사업장 탭 (다중 사업장) | 헤더 내 인라인 |
| 재스캔 완료 배너 | `app/(dashboard)/dashboard/RescanBanner.tsx` |
| 재방문 변화 요약 배너 | `components/dashboard/VisitDeltaBanner.tsx` |
| 가게명 + 플랜 배지 + AI 브리핑 배지 | 헤더 내 인라인 |
| 스캔 버튼 모달 | `app/(dashboard)/dashboard/ScanWithModal.tsx` |
| 사업장 빠른 편집 버튼 | `app/(dashboard)/dashboard/BusinessQuickEditButton.tsx` |
| 온보딩 진행 바 | `components/dashboard/OnboardingProgressBar.tsx` |
| 경쟁사 신규 등록 알림 | `components/dashboard/NewCompetitorAlert.tsx` |

---

## Zone 2 — 점수 히어로 (`DashboardScoreZone.tsx`)

| 항목 | 컴포넌트 파일 |
|------|-------------|
| 기대치 안내 배너 (최초 1회) | `components/dashboard/ExpectationBanner.tsx` |
| **통합 점수 히어로 카드** (AI 노출 지수 숫자, 스캔 시에만 표시) | `components/dashboard/DashboardHeroCard.tsx` |
| **키워드 검색 노출 카드** (네이버 검색 키워드별 순위) | `components/dashboard/KeywordRankCard.tsx` |
| AI 브리핑 비대상 업종 안내 (LIKELY/INACTIVE) | `components/dashboard/IneligibleBusinessNotice.tsx` |

---

## Zone 3 — 액션 가이드 (`DashboardActionZone.tsx`)

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| 무료 플랜 업그레이드 유도 | `components/dashboard/UpgradeNudgeCard.tsx` | 항상 |
| 경쟁사 추정값 기반 안내 배너 | 인라인 | 경쟁사 없을 때 |
| 시즌 키워드 배너 | `components/dashboard/SeasonalKeywordBanner.tsx` | 계절/시즌 |
| ① **오늘 할 일** (가장 시급한 미션) | `components/dashboard/DailyMissionCard.tsx` | 스캔 후 |
| ② **이번 주 액션** (7일 권장) | `components/dashboard/Day7ActionCard.tsx` | 항상 |
| ③ **이달의 체크리스트** (5개 항목) | `components/dashboard/MonthlyChecklistCard.tsx` | Basic+ |
| ④ **내 행동의 효과** (점수 변화 회고) | `components/dashboard/ScoreAttributionCard.tsx` | Basic+ |
| 대행 서비스 추천 카드 | `components/dashboard/DeliveryRecommendCard.tsx` | 스캔 후 |

---

## Zone 4 — 인사이트 분석 (`DashboardInsightZone.tsx`)

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| INACTIVE 업종 첫 7일 안내 배너 | `components/dashboard/InactiveUserBanner.tsx` | INACTIVE + 7일 이내 |
| **AI 브리핑 vs AI탭 경로 비교** | `components/dashboard/NaverAiPathwayCard.tsx` | 항상 |
| **글로벌 AI 주전장 안내** (ChatGPT·Gemini 위주 업종) | `components/dashboard/GlobalAiFocusCard.tsx` | globalWeight ≥ 0.65 |
| **AI 브리핑 노출 설정 상태** (스마트플레이스 AI 정보 탭) | `components/dashboard/AiInfoTabStatusCard.tsx` | 항상 |
| **AI탭 답변 미리보기** | `components/dashboard/AiTabPreviewCard.tsx` | Basic+ |
| **네이버 검색 기반 강화 현황** (리뷰·소개글·소식·사진·블로그) | `components/dashboard/NaverSeoBaseCard.tsx` | 항상 |
| 네이버 카페·지식인 언급 현황 | `components/dashboard/NaverMultiChannelCard.tsx` | MULTICH 활성 시 |
| 스마트플레이스 사진 카테고리 현황 | `components/dashboard/PhotoCategoryCard.tsx` | 지원 업종 |
| **리뷰 키워드 분포** (경쟁사 비교) | `components/dashboard/ReviewKeywordGapCard.tsx` | 항상 |
| **JSON-LD 점수 카드** (웹사이트·스키마·SEO) | `components/dashboard/SchemaCheckCard.tsx` | 항상 |
| 채널별 맞춤 가이드 링크 박스 | 인라인 | 항상 |

---

## Zone 5 — AI 자동 생성 (`DashboardGeneratorZone.tsx`)

| 항목 | 컴포넌트 파일 |
|------|-------------|
| **네이버 소개글 AI 생성** | `components/dashboard/IntroGeneratorCard.tsx` |
| **톡톡 채팅방 메뉴 초안 생성** | `components/dashboard/TalktalkFAQGeneratorCard.tsx` |

---

## Zone 6 — 탭 상세 데이터 (`DashboardDetailZone.tsx`)

### 탭1 — AI 스캔 결과

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| 7일 행동 기록 차트 | `components/dashboard/Action7DayChart.tsx` | 항상 |
| **듀얼트랙 점수 카드** (Track1/Track2/통합 점수) | `components/dashboard/DualTrackCard.tsx` | 항상 |
| 점수 변동 폭 안내 텍스트 | 인라인 | 히스토리 7일+ |
| **플랫폼별 스캔 결과 테이블** (네이버·ChatGPT·Gemini·Google) | `components/scan/ResultTable.tsx` | 스캔 후 |
| **플랫폼 분포 차트** | `components/dashboard/PlatformDistributionChart.tsx` | 스캔 후 |
| **5채널 점수 카드** (채널별 현황 카드 묶음) | `components/dashboard/ChannelScoreCards.tsx` | 항상 |
| 글로벌 AI 배너 | `components/dashboard/GlobalAIBanner.tsx` | 항상 |
| 글로벌 AI 체크리스트 | `components/dashboard/GlobalAIChecklist.tsx` | INACTIVE 업종 |
| **키워드 30일 트렌드 차트** | `components/dashboard/KeywordTrendChart.tsx` | Basic+ |
| **AI 인용 실증 카드** | `components/dashboard/AICitationCard.tsx` | Basic+ |
| **ChatGPT·Gemini 노출 비교** | `components/dashboard/ChatGPTDiffCard.tsx` | 항상 |
| 점수 변화 타임라인 | `components/dashboard/BriefingTimeline.tsx` | 히스토리 2건+ |
| **리뷰 감정 분석** | `components/dashboard/SentimentDashboard.tsx` | Basic+ |
| AI 인용 문맥 | `app/(dashboard)/dashboard/MentionContextSection.tsx` | Basic+ |
| 조건 검색 카드 | `components/dashboard/ConditionSearchCard.tsx` | Pro+ |
| AI 검색 스크린샷 카드 | `components/dashboard/AISearchScreenshotCard.tsx` | Basic+ |

### 탭2 — 경쟁사 비교

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| 내 순위 박스 (N곳 중 X위) | 인라인 | 경쟁사 1개 이상 |
| 순위 바 | `components/dashboard/RankingBar.tsx` | 경쟁사 1개 이상 |
| 점수 변화 추이 그래프 | `components/dashboard/TrendLine.tsx` | 히스토리 1건+ |
| 경쟁사 키워드 비교 | `components/dashboard/CompetitorKeywordCompare.tsx` | 항상 |
| 경쟁사 FAQ 비교 | `components/dashboard/CompetitorFAQCard.tsx` | Basic+ |

### 탭3 — 상세 진단

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| **AI 종합 진단 카드** | `components/dashboard/AIDiagnosisCard.tsx` | 항상 |
| **점수 근거 카드** (항목별 점수 상세) | `app/(dashboard)/dashboard/ScoreEvidenceCard.tsx` | 스캔 후 |
| **스마트플레이스 자동 점검** | `components/dashboard/SmartplaceAutoCheck.tsx` | 네이버 URL 있을 때 |
| **카카오맵 체크리스트** | `components/dashboard/KakaoChecklistCard.tsx` | 항상 |
| **웹사이트 점검** (속도·SSL·메타태그) | `components/dashboard/WebsiteCheckCard.tsx` | 항상 |
| 키워드별 블로그 노출 비교 바 차트 | 인라인 | 블로그 데이터 있을 때 |
| 최근 블로그 언급 목록 | 인라인 | 블로그 데이터 있을 때 |
| Pro 업그레이드 미리보기 | `components/dashboard/ProUpgradePreview.tsx` | Basic만 |
| 멀티 사업장 테이블 | `components/dashboard/MultiBizTable.tsx` | Biz+ |
| 전환 가이드 섹션 | `components/dashboard/ConversionGuideSection.tsx` | 항상 |

---

## Zone 7 — 푸터 (`DashboardFooter.tsx`)

| 항목 | 컴포넌트 파일 | 표시 조건 |
|------|-------------|---------|
| 빠른 이동 그리드 (가이드·스키마·경�T사·히스토리·자료실) | 인라인 | 항상 |
| Basic 체험 배너 (업셀) | `components/dashboard/BasicTrialBanner.tsx` | 항상 |
| AI 도우미 플로팅 채팅 | `components/common/AIAssistant.tsx` | Basic+ |

---

## 편집 가이드

- **항목 텍스트·UI 수정** → 해당 컴포넌트 파일 직접 편집
- **항목 표시 조건 변경** (플랜 분기, 스캔 여부 등) → 해당 Zone 파일 (`sections/*.tsx`) 편집
- **항목 순서 변경** → Zone 파일에서 컴포넌트 순서 조정
- **항목 추가/제거** → Zone 파일에서 import + JSX 추가/삭제
- **"인라인" 항목** → Zone 파일 안에 직접 JSX로 작성된 것 (별도 컴포넌트 파일 없음)

*최종 업데이트: 2026-05-30*
