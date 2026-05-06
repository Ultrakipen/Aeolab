# AEOlab 세션 인계 문서
> 작성일: 2026-04-18 | 이전 대화창 작업 내용 요약 + 다음 작업 목록

---

## 1. 이번 세션에서 완료된 작업

### 1-1. 코드 버그 수정 (서버 배포 완료)

| 파일 | 수정 내용 |
|------|----------|
| `backend/routers/guide.py:113` | `except Exception: pass` → `except Exception as e2: _logger.warning(...)` (silent 에러 삼킴 제거) |
| `backend/routers/startup.py:30~46` | 플랜 체크를 직접 DB 조회 → `get_user_plan()` 함수 사용으로 변경 (admin bypass 누락 버그 수정) |
| `frontend/app/(public)/pricing/page.tsx:66` | Basic 자동스캔 문구 "매일 (월요일 전체)" → "매일 핵심 2개 + 월요일 7개"로 정확히 수정 |
| `frontend/app/(dashboard)/dashboard/ScanTrigger.tsx:149,153` | `text-xs` → `text-sm` (40~60대 소상공인 가독성) |
| `frontend/app/(dashboard)/ad-defense/AdDefenseClient.tsx:59~62` | 403 에러 시 `setLoading(false)` 누락 + 에러 문구 개선 |

### 1-2. 카카오 알림톡 활성화 완료

- 서버 `.env`에 `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY` 이미 설정되어 있음 확인
- `pm2 restart aeolab-backend` 실행 완료
- APScheduler 28개 잡 정상 등록 확인 (`weekly_kakao_notify`, `daily_kakao_notify` 포함)
- **카카오 알림톡 5종 템플릿 완전 활성화됨**

---

## 2. 전략적 점검 결과

### 2-1. 유사 서비스 가격 조사 결과

| 서비스 | 가격 | 결제 방식 |
|--------|------|----------|
| Semrush AI Visibility | $99~549/월 | 구독 |
| Ahrefs Brand Radar | $129~699/월 | 구독 |
| Otterly AI | $29~989/월 | 구독 |
| AccuRanker AccuLLM | $224~764/월 | 구독 |
| SE Ranking | $52~207/월 | 구독 |
| Metricus | $99~499 (건당) | **1회성** |
| 한국 (넥스트티, 리드젠랩) | 상담 견적 | 대행·컨설팅 |

**결론:** 전 세계 AI 가시성 도구는 거의 모두 구독제.  
AEOlab Basic(9,900원)은 최저가 경쟁 서비스(Otterly $29 = 약 40,000원) 대비 **4배 저렴**.  
한국 내 동급 SaaS 경쟁자 없음.

### 2-2. "검색으로 비슷한 답 찾을 수 있지 않나?" 에 대한 분석

**검색/ChatGPT로 대체 가능한 것 (약점):**
- "FAQ 등록하면 AI에 나온다" 등 일반 팁 → 무료 블로그로 획득 가능

**검색/ChatGPT가 절대 못 주는 것 (핵심 가치):**

| 질문 | ChatGPT/검색 | AEOlab |
|------|-------------|--------|
| 내 가게가 지금 AI에 나오는가? | 불가 (직접 매번 확인 필요) | 자동 측정 |
| 경쟁 가게보다 몇 점 뒤처졌나? | 불가 | 수치 비교 |
| 반경 1km에 새 경쟁 가게가 생겼나? | 불가 | 자동 감지 |
| FAQ 올린 후 점수가 올랐나? | 불가 | 7일 후 검증 |
| 지난달보다 노출이 늘었나? | 불가 | 추세선 표시 |

**핵심: 지식(knowledge) vs. 측정(measurement)**  
ChatGPT는 "어떻게 해야 한다"는 일반 지식.  
AEOlab은 "내 가게가 지금 어떤 상태인지"를 측정.

### 2-3. 포지셔닝 문제

```
❌ 현재: "AI 검색 노출 최적화 도구" → 소상공인: "블로그 검색하면 되잖아"
✅ 바꿔야 함: "내 가게가 지금 AI에 나오는지 자동으로 감시해주는 서비스"
              = 모니터링 CCTV 개념
```

---

## 3. 다음 세션에서 구현해야 할 기능 (우선순위순)

### 3-1. [1순위] 경쟁 가게 신규 진입 자동 탐지 + 카카오 알림

**목적:** 소상공인이 직접 모니터링 불가능한 정보를 자동 제공 → 구독 해지 방어  
**알림 내용:**
```
"이번 주 반경 500m에 새 카페 2곳이 네이버에 등록됐습니다.
두 곳 모두 FAQ가 있어 AI 브리핑 노출 경쟁이 생겼습니다."
```

**구현 범위:**
- `backend/scheduler/jobs.py` — 주 1회 경쟁사 지역 내 신규 사업장 탐지 잡 추가
- `backend/services/kakao_notify.py` — 신규 경쟁 가게 진입 알림 템플릿 추가
- `backend/services/keyword_taxonomy.py` — 계절별·월별 키워드 추천 갱신 로직

**주의:** 카카오 알림 추가 시 새 템플릿 심사 필요 (3~5 영업일)

---

### 3-2. [2순위] "내 행동 → 실제 점수 변화" 증명 화면 강화

**목적:** "FAQ 등록 후 7일만에 실제로 점수가 올랐다"는 증거 → 서비스 신뢰도 핵심  
**현재 상태:** `business_action_log` 테이블 + `_fill_action_score_after()` 스케줄러 구현됨  
**미완성:** 프론트 TrendLine에 행동 오버레이 표시 미흡

**구현 범위:**
- `frontend/components/dashboard/TrendLine.tsx` — 행동 날짜 ReferenceLine 오버레이 완성
- `frontend/app/(dashboard)/guide/GuideClient.tsx` — 체크박스 완료 → 행동 로그 자동 저장 확인

---

### 3-3. [3순위] "실제 AI 검색 화면 스크린샷" 증거 제공

**목적:** 소상공인이 "아, 내 가게가 진짜 AI에 안 나오는구나" 직관적 체감  
**구현 내용:**
```
[실제 ChatGPT·네이버 화면 캡처 이미지]
"강남 24시간 카페 추천해줘" 결과
✓ 스타벅스 강남점 언급됨
✗ 내 카페 미언급
```
- 기존 `services/screenshot.py` Playwright 인프라 활용
- Before/After 버킷에 "AI 검색 결과 스크린샷" 저장
- 대시보드에서 최신 스크린샷 표시

---

### 3-4. [4순위] 첫 화면 포지셔닝 개선

**목적:** "측정 도구"의 가치를 소상공인이 첫 화면에서 즉시 이해  
**구현 범위:**
- `frontend/app/(public)/page.tsx` — 히어로 섹션 문구 변경
- `frontend/app/(public)/trial/page.tsx` — 체험 결과 화면에서 경쟁사와 직접 비교 강조

**변경 방향:**
```
❌ "AI Visibility Score: 67점"
✅ "지금 이 순간, '강남 카페 추천' 검색 시
   → 내 가게: 미언급 / 바로 옆 스타벅스: 언급됨"
```

---

## 4. 현재 서버 상태 (참고)

| 항목 | 상태 |
|------|------|
| 서버 IP | 115.68.231.57 |
| 서버 경로 | /var/www/aeolab/ |
| Frontend | pm2: aeolab-frontend (Next.js 포트 3000) |
| Backend | pm2: aeolab-backend (FastAPI 포트 8000) |
| 카카오 알림톡 | 활성화 완료 (5종 템플릿 승인) |
| APScheduler | 28개 잡 정상 실행 중 |
| Supabase | business_action_log 테이블 생성 필요 (SQL Editor 실행) |

### Supabase 미실행 SQL (다음 세션에서 반드시 실행)
```sql
-- Supabase SQL Editor에서 실행
-- https://supabase.com/dashboard/project/[프로젝트ID]/editor

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;

CREATE TABLE IF NOT EXISTS business_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score_before FLOAT,
  score_after FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_action_log_biz_date
  ON business_action_log(business_id, action_date DESC);
```

---

## 5. 요금제 최종 확인 (모든 파일 일치)

| 플랜 | 가격 | 주요 차별점 |
|------|------|------------|
| Basic | 9,900원/월 | 매일 핵심 2개 AI + 월요일 7개 AI 자동 스캔 |
| 창업패키지 | 16,900원/월 | 창업 시장 분석 리포트 전용 |
| Pro | 22,900원/월 | 주 3회 7개 AI 전체 스캔, PDF 리포트 |
| Biz | 49,900원/월 | 팀 5계정, 다중 사업장 통합 관리 |

---

## 6. 다음 세션 시작 시 확인사항

1. `CLAUDE.md` 참조 (작업 기준 문서)
2. `docs/model_engine_v3.0.md` 참조 (스캔 엔진 설계)
3. `docs/next_features_v1.0.md` 참조 (기능 구현 체크리스트)
4. 위 Supabase SQL 실행 여부 확인
5. 구현 시작: **[1순위] 경쟁 가게 신규 진입 자동 탐지 기능**부터

---

*문서 생성: 2026-04-18 | AEOlab 세션 인계용*
