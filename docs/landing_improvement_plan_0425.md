# AEOlab 랜딩 페이지 개선 계획 (2026-04-25)

> 작성 배경: 히어로 섹션 v2 개선(6개 이슈) 완료 후 잔여 개선 항목 정리
> 상태: 구현 대기
> 관련 이력: `docs/homepage_changelog.md`

---

## 현재 랜딩 페이지 상태

- 헤드라인: "네이버·ChatGPT가 우리 동네에서 먼저 추천하는 가게, 누구일까요?" ✅
- 섹션 구조: 히어로 → 문제공감 → 왜AI안나오나 → 검색방식변화 → 3단계 → ChatGPT비교 → 결과미리보기 → 진단폼 → 가격앵커 → 사례 → 후기(숨김) → FAQ → 최종CTA ✅
- 히어로 이슈 6개 수정 완료 (에러폴백·헤드라인·범례·타일·폰트·도트) ✅
- Testimonials: placeholder 전체 → 자동 숨김 상태 (실데이터 없음) ⚠️

---

## 개선 항목 (우선순위 순)

---

### P1 — 전환율 직접 영향

#### 1. SEO vs AEO 비교 카드 섹션 (`AEOvsTraditionalSection`)

**목적:** "블로그 관리·네이버 플레이스 관리랑 뭐가 다른지" 첫 방문자 의문 해소

**위치:** `SearchChangeSection` 바로 다음 (섹션 순서: 왜AI안나오나 → 검색방식변화 → **AEO비교** → 3단계)

**구현 내용:**
```
3컬럼 비교 카드
┌─────────────────┬────────────────┬─────────────────┐
│   기존 SEO      │  네이버 플레이스│    AEOlab (AEO) │
│ 검색 순위 올리기 │ 방문자 후기 관리│ AI 답변에 추천됨│
│ 키워드 반복      │ 사진·메뉴 등록 │ 질문-답변 구조화│
│ 변화: 수개월     │ 변화: 수주     │ 변화: 수일~2주  │
└─────────────────┴────────────────┴─────────────────┘
```
- 카드별 체크리스트 형식 (✓/✗)
- AEOlab 컬럼에 `ring-2 ring-blue-500` 강조
- 하단 CTA: "AEO가 뭔지 더 알아보기" → `/how-ai-works` (향후 구현) or FAQ 앵커

**파일:**
- 신규: `frontend/components/landing/AEOvsTraditionalSection.tsx`
- 수정: `frontend/app/page.tsx` (섹션 삽입)

---

#### 2. WhyNotShownSection → QuickDiagnosisForm 앵커 버튼

**목적:** "왜 AI에 안 나오나" 교육 후 행동 유도 → 이탈 없이 진단 폼으로 연결

**구현 내용:**
- `WhyNotShownSection` 하단에 `<a href="#quick-diagnosis">` 스크롤 버튼 추가
- `QuickDiagnosisForm` 래퍼에 `id="quick-diagnosis"` 부여

**파일:**
- 수정: `frontend/components/landing/WhyNotShownSection.tsx`
- 수정: `frontend/app/page.tsx` (QuickDiagnosisForm 섹션 id 추가)

---

### P2 — SEO / 검색 노출

#### 3. sitemap.ts 생성

**목적:** 구글·네이버 크롤러에 사이트 구조 명시 → 색인 속도·정확도 향상

**구현 내용:**
```typescript
// frontend/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://aeolab.co.kr', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://aeolab.co.kr/pricing', changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://aeolab.co.kr/faq', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://aeolab.co.kr/demo', changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://aeolab.co.kr/trial', changeFrequency: 'weekly', priority: 0.9 },
  ]
}
```

**파일:**
- 신규: `frontend/app/sitemap.ts`

---

#### 4. `/faq` 독립 페이지 (JSON-LD FAQPage)

**목적:** 구글 FAQ 리치 스니펫 → 검색 결과에서 Q&A 직접 노출 가능

**구현 내용:**
- FAQSection 컴포넌트의 8개 Q&A 데이터 재활용
- `<script type="application/ld+json">` FAQPage 스키마 삽입
- 경로: `/faq`
- 홈 FAQSection에 "전체 FAQ 보기" 링크 추가

**파일:**
- 신규: `frontend/app/(public)/faq/page.tsx`
- 수정: `frontend/components/landing/FAQSection.tsx` (링크 추가)

---

### P3 — 소규모 UX 개선

#### 5. 샘플 카드 자동순환 3.5s → 5s

**목적:** 사용자가 내용을 읽기 전에 슬라이드 전환되는 문제 해소

**파일:** `frontend/components/landing/HeroSampleCard.tsx:183`
```typescript
// 변경 전
}, 3500);
// 변경 후
}, 5000);
```

---

#### 6. 점수 바 업종 평균선 레이블

**목적:** 경쟁사 점수 바의 수직선이 무엇인지 시각적으로 설명

**구현 내용:**
- `CompetitorRow` 컴포넌트에서 점수 바 위 또는 아래에 "평균" 텍스트 레이블 추가
- 레이블 위치: 수직선 바로 위 `text-[10px] text-gray-400`

**파일:** `frontend/components/landing/HeroSampleCard.tsx`

---

### P4 — 사용자 직접 작업 (코드 외)

#### 7. 베타 후기 실제 데이터 교체

**목적:** Testimonials 섹션 현재 통째로 숨김 → 실데이터 1개라도 추가 시 자동 노출

**방법:**
1. `frontend/lib/testimonials.ts` 열기
2. 항목 중 `isPlaceholder: true` → `isPlaceholder: false` 변경
3. `quote`, `author`, `business` 실제 데이터로 교체
4. 배포 후 홈페이지 하단 후기 섹션 자동 표시

---

## 구현 순서 (권장)

```
1회차: P3 소규모 (순환속도·평균선) + P1-② 앵커 버튼  — 30분
2회차: P1-① AEO vs 전통 비교 섹션                   — 1~2시간
3회차: P2 sitemap.ts + /faq 독립 페이지              — 2~3시간
4회차: P4 후기 데이터 (사용자 작업)                   — 수시
```

---

## 완료 기준

- [ ] AEOvsTraditionalSection 추가 및 배포
- [ ] WhyNotShownSection 앵커 버튼 연결
- [ ] sitemap.ts 생성 및 배포
- [ ] /faq 독립 페이지 + JSON-LD 배포
- [ ] 샘플 카드 순환 5초 조정
- [ ] 점수 바 평균선 레이블 추가
- [ ] 후기 실데이터 1개 이상 교체 (사용자)

---

*작성: 2026-04-25 | 관련 메모리: `project_hero_improvement_v2.md`*
