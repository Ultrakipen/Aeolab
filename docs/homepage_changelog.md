# AEOlab 홈페이지 개선 이력

> 실제 배포된 변경 사항만 기록. 계획·검토 문서는 `landing_improvement_plan_0424.md` 참조.
> 최종 갱신: 2026-04-25

---

## v2.1 — 2026-04-25 (구조 재배치 + 자체 점검 개선)

### 변경 파일
- `frontend/app/page.tsx`
- `frontend/components/landing/HeroHeadline.tsx`
- `frontend/components/landing/ProblemSection.tsx`
- `frontend/components/landing/FAQSection.tsx`

### 섹션 순서 재배치 (전환 흐름 최적화)

| 이전 위치 | 컴포넌트 | 변경 후 위치 | 이유 |
|----------|---------|------------|------|
| WhyNotShownSection 직후 | `QuickDiagnosisForm` | TrialResultPreview 뒤 | 교육 중간 흐름 단절 제거 |
| FAQ 다음 (13번째) | `ChatGPTCompareSection` | 3단계 바로 다음 | 차별화 핵심 섹션 조기 노출 |
| QuickDiagnosisForm 다음 | `SearchChangeSection` | WhyNotShownSection 직후 | 교육 흐름 연속성 유지 |

**새 순서:** 히어로 → 문제공감 → 왜AI안나오나 → 검색방식변화 → 3단계 → ChatGPT비교 → 결과미리보기 → 진단폼 → 가격앵커 → 사례 → 후기 → FAQ → 최종CTA

### HeroHeadline 폰트 확대
| 브레이크포인트 | 이전 | 이후 |
|-------------|------|------|
| 기본 | `text-2xl` | `text-3xl` |
| sm | `text-3xl` | `text-4xl` |
| lg | `text-3xl` | `text-4xl` |
| xl | `text-4xl` | `text-5xl` |

### ProblemSection 이모지 → Lucide 아이콘
| 항목 | 이전 | 이후 |
|-----|------|------|
| 검색 안됨 | `🔍` | `SearchX` (red-50 배경) |
| 광고비 낭비 | `💸` | `TrendingDown` (orange-50 배경) |
| 경쟁사 추천 | `😓` | `Award` (yellow-50 배경) |

### FAQSection 4개 → 8개
추가된 FAQ:
- "스마트플레이스랑 다른 서비스인가요?" (서비스 포지셔닝 설명)
- "무료 진단과 유료 구독의 차이가 뭔가요?" (전환 장벽 제거)
- "어떤 업종이 가장 효과적인가요?" (업종별 적합성)
- "구독을 취소하면 기존 데이터는?" (해지 불안 해소)

### 가격 앵커 단위 추가
- 이전: `"광고 끄면 즉시 사라짐"`
- 이후: `"월 90만원+ · 광고 끄면 즉시 사라짐"` (월 환산 단위 추가로 비교 명확화)

### 최종 CTA 텍스트 차별화
- 히어로 CTA: "내 가게 AI 노출 확인하기" (유지)
- 최종 CTA: "무료로 내 가게 진단받기" (변경) — 맥락별 설득 문구 분리

### 3단계 모바일 연결선
- 모바일에서 STEP 01→02→03 사이에 `ArrowDown` 아이콘 추가 (md:hidden)
- `Fragment` 기반 렌더링으로 변경

---

---

## v2.0 — 2026-04-25 (샘플 카드 압축 + Lucide 아이콘 시스템 통일)

### 변경 파일
- `frontend/components/landing/HeroSampleCard.tsx`
- `frontend/components/landing/HeroIndustryTiles.tsx`
- `frontend/app/page.tsx`

---

### HeroSampleCard 전면 개선

#### 크기 압축
| 항목 | 이전 | 이후 |
|------|------|------|
| 경쟁사 행 여백 | `py-2` | `py-1.5` |
| 행 간격 | `space-y-2` | `space-y-1.5` |
| 점수바 높이 | `h-1.5` | `h-1` |
| 섹션 간격 | `mb-3` | `mb-2` |
| CTA 버튼 여백 | `py-2.5` | `py-2` |
| 카드 패딩 (PC) | `p-6` | `p-5` |
| 하단 주석 | 전체 기재 | 단축 (날짜 포함) |

#### Lucide 아이콘 추가
| 위치 | 아이콘 | 역할 |
|------|--------|------|
| AI 노출 표시 | `Bot` (11px) | "AI X종" / "미노출" 앞 시각 표시 |
| 점수 격차 배너 | `TrendingDown` (13px) | "1위와 X점 차이" 시각화 |
| 내 가게 진단 | `AlertCircle` (11px) | 진단 섹션 헤더 |
| 개선 조언 | `Lightbulb` (13px) | 조언 섹션 헤더 |

#### 인터랙션 개선 (이전 세션 적용 사항)
| 항목 | 이전 | 이후 |
|------|------|------|
| 업종 선택 | `Math.random()` 랜덤 | 클릭 가능 탭 6개 (카페·한식당·미용실·피부과·헬스장·영어학원) |
| AI 노출 표시 | 배지 3개 × 4행 = 12개 | 압축 요약 1개 ("AI X종" / "미노출") |
| 점수 격차 | 없음 | "1위와 X점 차이 = AI 노출 X% 격차" 배너 |
| 조언 문구 | 길고 처방적 | 짧고 호기심 유발 |

---

### HeroIndustryTiles 아이콘 개선
| 업종 | 이전 아이콘 | 이후 아이콘 | 이유 |
|------|------------|------------|------|
| 병원 | `Activity` (심전도) | `Stethoscope` (청진기) | 의료 아이콘으로 더 명확 |
| 쇼핑몰 | `ShoppingCart` | `ShoppingBag` | 더 현대적 |

---

### page.tsx inline SVG → Lucide 교체
| 위치 | 이전 | 이후 |
|------|------|------|
| 3단계 Step 01 아이콘 | inline SVG (돋보기) | `Search` |
| 3단계 Step 02 아이콘 | inline SVG (스캔) | `Bot` |
| 3단계 Step 03 아이콘 | inline SVG (체크) | `BarChart3` |
| 단계 간 화살표 (×2) | inline SVG | `ArrowRight` |
| 가격 앵커 체크 배지 (×2) | inline SVG | `Check` |

---

## v1.1 — 2026-04-24 (전환율 개선 + 마케팅 문구 정제)

### "30초" 문구 전면 제거
**배경**: 실제 스캔 소요 시간이 일정하지 않아 과장 논란 우려.

| 파일 | 제거/교체 인스턴스 |
|------|------------------|
| `frontend/app/page.tsx` | 6개 |
| `frontend/components/landing/HeroIndustryTiles.tsx` | 1개 |
| `frontend/components/landing/WhyNotShownSection.tsx` | 1개 |
| `frontend/components/landing/TrialResultPreview.tsx` | 1개 |
| `frontend/components/landing/QuickDiagnosisForm.tsx` | 2개 |
| **합계** | **11개** |

**교체 패턴**:
- `업종만 선택하면 30초 안에 확인됩니다` → `업종만 선택하면 바로 확인됩니다`
- `30초 스캔` → `AI 스캔`
- `가입 없이, 카드 없이, 30초` → `가입 없이, 카드 없이`
- `30초면 확인됩니다` → `지금 확인됩니다`

**예외 (유지)**: `/faq/page.tsx` — 실제 처리 시간 안내 문맥이므로 유지.

---

### 모바일 전환 깔때기 (v5.0 적용)
- `MobileFloatingCTA.tsx` — 모바일 하단 고정 64px (홈·/demo·/pricing 노출)
- `KakaoShareButton.tsx` — /trial 결과 카카오톡 공유 (Feed 템플릿)
- `ReferralTracker.tsx` — `?ref=kakao_share` → GA4 `referral_visit`

---

### GA4 이벤트 (v1.1 신규)
| 이벤트 | 트리거 |
|--------|--------|
| `mobile_floating_cta_shown` | 하단 CTA 표시 (1회/세션) |
| `mobile_floating_cta_click` | 하단 CTA 클릭 |
| `kakao_share_click` | 카카오 공유 버튼 클릭 |
| `referral_visit` | `?ref=kakao_share` 랜딩 |

---

## v1.0 — 2026-04-23 (홈페이지 전면 개편)

### 구조 변경
| 항목 | 이전 | 이후 |
|------|------|------|
| `page.tsx` 줄 수 | 1,021줄 | 264줄 (-74%) |
| 헤드라인 | 여러 후보 혼재 | "네이버·ChatGPT가 우리 동네에서 먼저 추천하는 가게, 누구일까요?" 확정 |
| 구조 | 비정형 | 5블록 (Why→Problem→How→Proof→CTA) |

### 신규 컴포넌트
| 컴포넌트 | 역할 |
|----------|------|
| `HeroIndustryTiles` | 업종 6개 + 기타 타일 (홈·최종 CTA 공용) |
| `HeroSampleCard` | 실제 스캔 샘플 카드 (pc/mobile/fullwidth variant) |
| `TodayOneActionBox` | /demo 최상단 오늘 할 일 복사 박스 |
| `PlanRecommender` | /pricing 상황 질문 → 추천 플랜 → PayButton |
| `Testimonials` | 베타 후기 (placeholder 자동 숨김) |
| `GA4` + `TrackedCTA` | GA4 gtag 로드 + CTA 클릭 추적 |
| `lib/analytics.ts` | `trackTrialStart()`, `trackCTA()` 헬퍼 |

### 보조 개선
- Alert 배지 텍스트: `"네이버 검색의 40%가 AI 브리핑으로 바뀝니다"` → `"네이버 검색 40%가 AI 브리핑으로 전환 중"`
- 업종 타일 grid: `grid-cols-3 md:grid-cols-4` → `grid-cols-4` (모바일 CTA 폴드 진입)
- 모바일 샘플 카드: Hero 왼쪽 컬럼 → SearchChangeSection 다음 독립 섹션으로 이동
- WCAG AA: `text-gray-400` → `text-gray-500` 대비 개선 (-115회), `aria-label` 추가
- 가격 앵커: 네이버 광고 하루 30,000원 vs AEOlab 한 달 9,900원 1행 비교 카드

### GA4 측정 시작
- 측정 ID: `G-KCZTWYK7QV`
- Enhanced Measurement(스크롤 자동) ON
- 이벤트: `trial_start`, `cta_click`, `trial_industry_select`

---

## 남은 작업 (계획)

> 상세 내용은 `landing_improvement_plan_0424.md` 참조

| 작업 | 임팩트 | 파일 |
|------|--------|------|
| `/faq` 독립 페이지 신설 (JSON-LD FAQPage 포함) | ★★★★ | 신규 `app/(public)/faq/page.tsx` |
| `sitemap.ts` 생성 | ★★★ | 신규 `app/sitemap.ts` |
| `/how-ai-works` AI 원리 교육 페이지 | ★★★★ | 신규 |
| `WhyNotShownSection` → `QuickDiagnosisForm` 앵커 버튼 | ★★★ | `WhyNotShownSection.tsx` |
| FAQSection 8개로 확장 (현재 4개) | ★★★ | `FAQSection.tsx` |
| 베타 후기 실제 데이터 교체 | ★★★ | `lib/testimonials.ts` |

---

*참조 문서: `landing_improvement_plan_0424.md` (계획), `changelog_archive.md` (전체 이력)*
