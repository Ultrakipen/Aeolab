# AEOlab — 네이버 AI 브리핑 광고화 영향 대응 전략 v1.0

> 작성 2026-05-18 | 트리거: docs/ai_exposure_continuation_plan_v1.0.md §3 P2-3
> 2026 Q2~Q3 광고 도입 이후의 사용자 가치 재정의

---

## §1 배경

### 1.1 광고화 일정 (출처: Daum 2026-04-30 / 네이트 2025-12-15)

| 시점 | 변화 | 영향 |
|------|------|------|
| 2025-08 | AI 브리핑 정식 출시 | 자연 노출만 |
| 2025-12 | 전체 검색 약 20% 침투 | 자연 노출 가치 정점 |
| 2026 Q2 | **광고 테스트 시작** (쇼핑·로컬 결합) | 자연 자리 일부 축소 가능 |
| 2026 Q3 | 본격 수익화 — ADVoost 광고 솔루션 + 답변형 광고 | 자연 vs 광고 혼재 |

### 1.2 핵심 위협

- **자연 노출 자리 축소** — 광고가 상단 우선 배치되면 자연 답변 박스 노출률 감소
- **인지도 혼란** — 사용자가 광고/자연을 구분 못 하면 AEOlab 가치(자연 노출 최적화) 신뢰도 하락
- **점수 변동성** — 광고 영역 매칭이 유기 점수로 잘못 집계되면 사용자 액션 가이드 왜곡

---

## §2 현재 AEOlab 코드 인프라 (이미 구현됨)

### 2.1 광고 영역 분리 측정 (자연 vs 광고)

| 위치 | 동작 |
|------|------|
| `services/ai_scanner/naver_scanner.py:165` | `_detect_ad_briefing(page)` — AI 브리핑 박스가 광고 영역인지 DOM 검사 |
| `services/ai_scanner/naver_scanner.py:203` | 결과 dict에 `ad_only: bool` 포함 |
| `services/score_engine.py:357~363` | `naver_briefing_visibility` 점수: `ad_only=True` 시 자동 0점 처리 |
| `services/keyword_taxonomy.py:get_category_flags()` (P2-1) | 카테고리 단위 `ad_only` 사전 분류 인프라 |

→ **점수 모델은 이미 광고/자연 분리 — Q2 광고 도입 시 점수 왜곡 0**.

### 2.2 자동 모니터링

- `scheduler/jobs.py:5002 ai_tab_trigger_check_job` (월·목 09:00 KST) — AI 탭 노출 트리거 자동 감지
- `scheduler/jobs.py:5069 briefing_category_expansion_monitor_job` (매월 1일) — 업종 확대 감지

→ Q2 광고 도입 자체는 **미감지** (수동 모니터링 항목으로 §0의 계획서 §6에 등록됨).

---

## §3 사용자 노출 UI 대응 방안

### 3.1 광고/자연 구분 배지 (UI)

- 대시보드 카드에서 "AI 브리핑 노출" 표시 시 **광고 매칭** vs **자연 매칭** 명시 배지
  - `<span>광고 영역</span>` (회색) — 점수 0점
  - `<span>자연 영역</span>` (초록) — 점수 100점
- `AiInfoTabStatusCard.tsx` / `NaverAiPathwayCard.tsx` 후속 작업

### 3.2 가이드 분기

- ACTIVE 업종 + 자연 노출 0건 → 기존 5단계 가이드 유지
- ACTIVE 업종 + 광고 노출만 → "광고 영역만 노출 — 자연 노출 강화 + 광고 ROI 분석 동시 가이드"
- 광고 영역 가이드는 신규 카드: 광고 키워드 매칭 정확도 + ROI 추정 + 광고 정책 변경 알림

### 3.3 시의성 카피 (이미 적용)

- 랜딩 §4-B 상단 (`frontend/app/page.tsx:521`): "2026 Q2 광고화 시작 — 자연 노출 자리 선점이 마지막 기회"

---

## §4 광고 정책 변경 시 대응 매뉴얼

| 변경 유형 | 영향 | 대응 |
|---------|------|------|
| 광고 박스 디자인 변경 | `_detect_ad_briefing` DOM 셀렉터 변경 필요 | `naver_scanner.py` 셀렉터 수정 + 검증 스크립트 |
| 광고/자연 혼합 답변 등장 | `ad_only=True/False` 이분법 부족 | `ad_partial: float` 등 새 메타 추가 |
| 광고 키워드 사전 제출 시스템 도입 | 사용자가 직접 광고 키워드 등록 가능 | DB `businesses.ad_keywords[]` 컬럼 + UI 입력 폼 |
| 답변형 광고 (ADVoost) 출시 | 광고가 자연 답변과 거의 동일 형식 | 광고 식별 알고리즘 강화 — 시각·텍스트 패턴 학습 |

### 4.1 변경 감지 명령 (주 1회)

```bash
# 본 문서 §0 계획서 §6.수동 모니터링 명령과 동일
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def t():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=[\"--no-sandbox\",\"--disable-dev-shm-usage\"])
        pg = await br.new_page()
        await pg.goto(\"https://search.naver.com/search.naver?query=강남역+맛집\", timeout=20000)
        await pg.wait_for_timeout(3000)
        html = await pg.content()
        if (\"AD\" in html or \"광고\" in html) and \"AI 브리핑\" in html:
            print(\"AI 브리핑 광고 후보 감지\")
        await br.close()
asyncio.run(t())
"'
```

---

## §5 사용자 가치 재정의 (Q2~Q3 이후)

### 5.1 광고 ROI 분석 도구 (신규 차별화)

- 광고 키워드별 노출/클릭 추정 → 광고비 대비 자연 노출 가치 비교
- Pro 플랜 전환 동기 강화

### 5.2 자연 노출 자리 선점 가이드 (현재 강화)

- C-rank·D.I.A. 5요소 + JSON-LD FAQ + 월 1회 업데이트 → 광고 도입 후에도 자연 자리 유지 가능 사업장 차별화
- 광고 매칭 0건 + 자연 매칭 100% 사업장은 "광고비 0원 사례" 마케팅 자산

### 5.3 광고화 영향 알림 (Phase 후속)

- 매월 1일 잡: 광고 매칭 비율 변동 사용자에게 카카오 알림
- "지난달 광고 매칭 12% → 이번 달 28% (광고 신규 도입). 자연 노출 강화 액션 3건 제안"

---

## §6 구현 우선순위 (재진단)

| 우선순위 | 항목 | 트리거 | 비용 |
|---------|------|--------|------|
| **P0** (이미 완료) | `ad_only` 분리 측정·점수 0점 처리 | 완료 | 0 |
| **P0** (이미 완료) | 카테고리 단위 `ad_only` 플래그 인프라 (P2-1) | 완료 | 0 |
| **P1** (Q2 광고 도입 감지 후) | UI 광고/자연 구분 배지 + 광고 가이드 카드 | 수동 모니터링 트리거 | 백·프 4시간 |
| **P2** (Q3 본격화 이후) | 광고 ROI 추정 도구 (Pro 차별화) | 본격화 + 구독자 30+ | 12시간 |
| **P3** (실제 영향 측정 후) | 광고화 영향 카카오 알림 잡 | 통계 확보 후 | 6시간 |

---

## §7 미정의 / 사용자 협의 필요

- **광고 영역만 노출되는 사업장에게 무엇을 제공할 것인가** — Pro 자동 권장 vs Basic 유지
- **광고 ROI 추정의 정확도 기준** — 네이버 광고 API 미공개 → 추정만 가능, 실측 배지 운용 필요
- **광고 매칭 비율 알림 발송 임계값** — 변화 폭 10%? 20%? 사용자 피드백으로 결정

---

## §8 변경 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| v1.0 | 2026-05-18 | 초안 — 코드 인프라 점검 + UI/가이드/알림 재정의 + 변경 매뉴얼 |
