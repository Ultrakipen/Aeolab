# AEOlab 구현 계획 — 2026-04-18
> 목표: 소상공인이 "이 서비스가 나한테 필요하다"를 5분 안에 체감하게 만들기
> 기준: 기능 추가보다 가치 체감 흐름 개선 우선
> 최종 업데이트: 2026-04-18 v3 — **전 12순위 구현 완료 + 서버 배포 완료**

## 구현 현황 요약 (2026-04-18 최종)

| 순위 | 기능 | 상태 |
|------|------|------|
| 1순위 | 랜딩·체험 포지셔닝 수정 (히어로 문구, 105% 수치) | ✅ 완료 |
| 1-보완 | 소셜 증거 + ROI 프레이밍 교체 | ✅ 완료 |
| 2순위 | 회원가입 없는 30초 라이브 데모 (HeroInlineForm) | ✅ 완료 |
| 3순위 | "최초 1승" 온보딩 플로우 | ✅ 완료 |
| 4순위 | AI 검색 화면 실제 스크린샷 증거 | ✅ 완료 |
| 5순위 | 행동→점수 변화 TrendLine 오버레이 | ✅ 완료 |
| 6순위 | "ChatGPT 대체 불가" 차별화 카드 | ✅ 완료 |
| 7순위 | 구독 해지 시 데이터 손실 경고 | ✅ 완료 |
| 8순위 | 경쟁 가게 신규 진입 탐지 강화 + 계절별 키워드 갱신 | ✅ 완료 |
| 9순위 | 경쟁사 점수 급등 FOMO 알림 | ✅ 완료 |
| 10순위 | 30일 자동 성과 리포트 이메일 | ✅ 완료 |
| 11순위 | 리뷰 인박스 주간 재방문 알림 | ✅ 완료 |
| 12순위 | 소상공인 AI 어시스턴트 채팅 | ✅ 완료 |

---

## 전제 확인

| 항목 | 상태 |
|------|------|
| 기능 구현 수준 | 충분함 — 추가보다 기존 기능의 노출·흐름 개선이 우선 |
| 핵심 문제 | 소상공인이 첫 5분 안에 "아, 내 가게가 안 나오는구나" 체감 부재 |
| 가격 문제 | 해당 없음 — 9,900원은 네이버 광고비 하루치 수준 |
| 구현 방향 | 포지셔닝 → 시각 증거 → ROI 증명 → 이탈 방어 순서 |

---

## 검증 완료 사항 (2026-04-18 추가)

| 항목 | 결과 | 출처 |
|------|------|------|
| "네이버 AI 브리핑 소규모 식당 신규 예약 105% 증가" | **공식 확인됨** — 월 예약 5건 이하 소규모 식당 전년 대비 105% 증가, 약 18만 개 식당 대상 | iNews24, 이코노믹데일리 (네이버 공식 발표 인용) |
| 소상공인 경영안정 바우처 SaaS 적용 가능 여부 | **불가** — 2026년 25만원 바우처는 공과금·보험료 전용. SaaS 구독료 사용 불가 | 중소벤처기업부 공고 |
| SaaS 공급기관 등록 가능 경로 | **클라우드 서비스 지원포털(cloudsup.or.kr)** — AEOlab 형태의 SaaS가 등록 가능한 별도 사업 | 과학기술정보통신부 클라우드 지원사업 |

---

## 구현 목록 (우선순위순)

---

### [1순위] 랜딩·체험 포지셔닝 전면 수정 ✅ 완료

**목적:** 가입 전 단계에서 안 팔리면 뒷 기능 모두 무의미. 가장 먼저 해결해야 함.

**핵심 방향 변경:**
```
❌ 현재: "AI Visibility Score 67점"
         → 소상공인: "그게 뭔데?"

✅ 변경: "지금 '내 업종 추천' 검색하면 — 내 가게 나오나요?"
         → 소상공인: "진짜? 어디서 확인해?"

✅✅ 최강: "지금 이 순간 경쟁 가게가 AI에 더 잘 나오고 있습니다"
           → 소상공인: "뭐? 바로 확인해야겠다"
```

#### 수정 파일 1: `frontend/app/(public)/page.tsx`

**히어로 섹션 헤드라인 교체:**
```
현재: "AI 검색 최적화로 사업장을 성장시키세요"
변경: "지금 '내 가게 추천' 검색하면 — 내 가게 나오나요?"
서브: "7개 AI가 내 가게를 언급하는지, 경쟁 가게보다 앞서는지 자동으로 확인합니다"
```

**히어로 섹션 서브카피 — 105% 수치 전면 배치:**
```
현재: "7개 AI가 내 가게를 언급하는지, 경쟁 가게보다 앞서는지 자동으로 확인합니다"
변경: "네이버 공식 — AI 브리핑에 나온 소규모 식당, 신규 예약 105% 증가"
       (두 번째 줄) "지금 내 가게는 AI에 나오고 있나요?"
```

> **변경 사유:** 소상공인에게 가장 강한 메시지는 "예약 105% 증가"임. 점수·노출 빈도보다 직접적인 매출 언어가 우선. 공식 확인된 수치이므로 히어로에 배치해도 무방.

**히어로 섹션 CTA 버튼 문구:**
```
현재: "무료로 시작하기"
변경: "지금 무료로 내 가게 확인하기 →"
```

**3-B 섹션 (왜 필요한가) 수정:**
- ChatGPT·네이버로 대체 불가한 이유를 비교표로 명시
- 아래 표 구조 사용:

```
| 이런 걸 알고 싶을 때 | ChatGPT·검색 | AEOlab |
|-------------------|-------------|--------|
| 내 가게가 지금 AI에 나오는가? | 직접 매번 확인해야 함 | 자동 측정 |
| 경쟁 가게보다 몇 점 뒤처졌나? | 불가 | 수치 비교 |
| 반경 1km에 새 경쟁 가게 생겼나? | 불가 | 자동 감지 |
| FAQ 올린 후 실제 효과 있었나? | 불가 | 7일 후 검증 |
```

---

#### 수정 파일 2: `frontend/app/(public)/trial/page.tsx`

**STEP 1 상단 설명 문구 교체:**
```
현재: "AI가 내 가게를 알고 있는지 무료로 확인해 드립니다"
변경: "지금 이 순간 AI가 내 가게를 언급하는지 — 경쟁 가게와 비교해서 확인합니다"
```

**체험 결과 화면 첫 줄 (감정 문장 추가):**
- 기존 점수 숫자 위에 감정 문장 1줄 추가
- 점수가 30 미만이면:
  ```
  "지금 이 순간, 내 가게는 AI 검색에 잘 나오지 않고 있습니다."
  ```
- 경쟁사 대비 낮으면:
  ```
  "[경쟁 업종] 평균보다 낮은 상태입니다. 경쟁 가게가 앞서고 있을 수 있습니다."
  ```

**sticky 하단 CTA 문구 교체:**
```
현재: "이 결과를 기반으로 매주 자동 진단받고"
변경: "경쟁 가게가 앞서기 전에 — 지금 바로 모니터링 시작하기"
```

---

### [2순위] 회원가입 없는 30초 라이브 데모 ✅ 완료

**목적:** 랜딩 히어로에서 이메일 없이 즉시 결과 체감 → 무료체험 진입 장벽 제거.
현재 trial 페이지는 이메일 수집 후 진행 → 이탈 구간 발생.

> **격상 사유:** 포지셔닝 수정(1순위)과 함께 진행해야 시너지가 남. "내 가게 이름만 치면 바로 확인" 방식으로 진입 장벽 제거 시 무료체험 진입률 자체가 달라짐. 이메일 수집은 결과 화면 이후로 이동.

**구현 방식:**
- 기존 `/api/scan/trial` 재사용, `email` 필드 optional 처리
- 결과는 Track1 점수 + "100회 중 N회 노출" + 상태 감정 문장만 표시
- 전체 분석(경쟁사 비교·키워드·가이드)은 가입 후 공개 → 전환 유도

**구현 범위:**
- `backend/routers/scan.py` — `email` 필드 optional 변경, ip_hash 제한 재사용
- `frontend/app/(public)/page.tsx` — 히어로 섹션 하단에 인라인 입력폼 추가 (업종 + 가게명)
- `frontend/app/(public)/page.tsx` — 결과 미리보기 모달 (점수 + 감정 문장 + 가입 CTA)

```
히어로 인라인 폼:
[업종 선택 ▼] [가게 이름 입력] [무료로 확인하기 →]
↓ (이메일 입력 없이 바로 결과)
┌───────────────────────────────────────┐
│ 강남 ○○카페 AI 노출 현황              │
│ Track1 (네이버): 23점 ⚠️ 경쟁 가게 평균보다 낮음│
│ "지금 이 순간 AI에 잘 나오지 않고 있습니다"  │
│                                       │
│ [전체 분석 보기 — 무료 가입]           │
└───────────────────────────────────────┘
```

---

### [3순위] "최초 1승" 온보딩 플로우 ✅ 완료

**목적:** 가입 직후 10분 안에 구체적 행동 1개를 완료하게 만들기. 현재 가입 후 대시보드만 표시되어 첫 방문 이탈률이 높음.

**구현 범위:**
- `frontend/app/(dashboard)/onboarding/page.tsx` — 온보딩 체크리스트 3단계 추가

```
가입 완료 → 온보딩 체크리스트 (3단계)
  ① AI 스캔 1회 실행 (자동 실행 → "결과 나왔어요!")
  ② 없는 키워드 3개 확인 → 클릭 시 가이드 페이지로 이동
  ③ FAQ 초안 1개 복사 버튼 클릭
→ "첫 번째 개선 행동 완료!" 배지 표시
→ "7일 후 점수 변화를 알려드릴게요" 안내
```

- `backend/routers/scan.py` — 온보딩 첫 스캔 자동 트리거 엔드포인트
- localStorage에 완료 상태 저장 → 완료 후 재방문 시 대시보드로 리다이렉트

**구현 공수:** 2~3시간

---

### [4순위] AI 검색 화면 실제 스크린샷 증거 ✅ 완료

**목적:** 소상공인에게 숫자보다 사진 1장이 강함. "내 가게가 진짜 AI에 안 나오는구나" 직관적 체감.

**구현 방식:** 기존 `services/screenshot.py` Playwright 인프라 그대로 활용. 신규 인프라 없음.

#### 신규 파일: `backend/services/ai_search_screenshot.py`

```python
# 역할: ChatGPT·네이버 AI 브리핑 실제 검색 결과 화면 캡처
# 기존 screenshot.py의 Playwright 브라우저 재사용
# 저장: Supabase Storage "before-after/ai-search/{biz_id}/{date}_{platform}.png"

async def capture_ai_search_result(
    query: str,           # "강남 24시간 카페 추천"
    platform: str,        # "naver" | "chatgpt"
    business_name: str,   # 내 가게 이름 (하이라이트용)
    biz_id: str,
) -> dict:
    # 1. Playwright로 검색 결과 페이지 이동
    # 2. 스크린샷 캡처
    # 3. Pillow로 내 가게 언급 여부에 따라 오버레이 추가
    #    - 언급됨: 초록 박스 + "✓ 언급됨"
    #    - 미언급: 빨간 배너 + "✗ 내 가게 미언급"
    # 4. Supabase Storage 업로드
    # 5. {"url": "...", "is_mentioned": bool, "platform": str} 반환
```

#### 수정 파일: `backend/routers/scan.py`

- `_run_full_scan()` 안에 AI 검색 스크린샷 캡처 병렬 추가
- naver + chatgpt 각 1개씩, 업종+지역 기반 쿼리 자동 생성
- 기존 `before-after` 버킷의 `ai-search/` 서브폴더에 저장

#### 수정 파일: `backend/routers/report.py`

```python
# GET /api/report/ai-search-screenshots/{biz_id}
# 최근 3개 스크린샷 URL + is_mentioned + platform 반환
# Basic+ 플랜 전용
```

#### 신규 파일: `frontend/components/dashboard/AISearchScreenshotCard.tsx`

```
표시 내용:
┌─────────────────────────────────────┐
│ 실제 AI 검색 화면                    │
│ "강남 카페 추천" 검색 시              │
├──────────────┬──────────────────────┤
│ 네이버 AI    │ ChatGPT              │
│ [스크린샷]   │ [스크린샷]            │
│ ✗ 내 가게   │ ✗ 내 가게            │
│   미언급     │   미언급             │
└──────────────┴──────────────────────┘
마지막 확인: 2026-04-18
```

#### 수정 파일: `frontend/app/(dashboard)/dashboard/page.tsx`

- `AISearchScreenshotCard` 컴포넌트 통합 (Basic+ 플랜 조건부 렌더링)

---

### [5순위] 행동→점수 변화 TrendLine 오버레이 ✅ 완료

**목적:** "FAQ 등록 후 7일 만에 점수가 올랐다" 증거 → 서비스 효과 신뢰도 핵심.
**현재 상태:** `business_action_log` 테이블 + `_fill_action_score_after()` 스케줄러 구현됨. 프론트 미완성.

#### 수정 파일: `frontend/components/dashboard/TrendLine.tsx`

Recharts `ReferenceLine` 추가:

```typescript
// GET /api/report/action-log/{biz_id} 데이터를 받아
// 행동 날짜에 수직선 오버레이 표시

<ReferenceLine
  x={log.action_date}
  stroke={ACTION_COLORS[log.action_type]}  // FAQ=파랑, 소개글=초록, 리뷰답변=보라
  strokeDasharray="3 3"
  label={{
    value: log.action_label,  // "FAQ 등록"
    position: "insideTopRight",
    fontSize: 11,
  }}
/>
```

**action_type별 색상 맵:**
```typescript
const ACTION_COLORS = {
  faq: "#3B82F6",           // 파랑
  intro_update: "#10B981",  // 초록
  review_reply: "#8B5CF6",  // 보라
  post: "#F59E0B",          // 주황
  other: "#6B7280",         // 회색
}
```

**score_after 표시:**
- 행동 7일 후 `score_after`가 채워지면 변화량 배지 표시
- `+5.2점` (초록) / `-1.1점` (빨강) / `측정 중...` (회색)

#### 수정 파일: `frontend/app/(dashboard)/guide/GuideClient.tsx`

- 체크박스 ON 클릭 시 `POST /api/report/action-log/{biz_id}` 호출 확인
- 저장 후 "7일 후 효과를 알려드립니다" toast 메시지 추가 (기존에 없으면 추가)

---

### [6순위] "ChatGPT 대체 불가" 차별화 카드 ✅ 완료

**목적:** 앱 안에서 ChatGPT와의 차이를 명확히 보여줌. 소상공인의 "ChatGPT한테 물어봐도 되는데?" 반론 해소.

#### 수정 파일: `frontend/app/(dashboard)/dashboard/page.tsx`

최초 스캔 완료 직후 1회만 표시되는 인포 카드 추가 (localStorage로 "표시됨" 기록):

```
┌─────────────────────────────────────────────────────┐
│ 💡 ChatGPT가 못 알려주는 것                      [X] │
│                                                     │
│ ChatGPT: "FAQ를 등록하면 AI 브리핑에 나올 수 있어요"  │
│           (모든 가게에게 같은 말)                    │
│                                                     │
│ AEOlab:  "지금 이 순간 내 가게는 100번 중 3번 언급"  │
│           (내 가게만의 실제 측정값)                  │
│                                                     │
│ 경쟁 가게는 지금 몇 번 언급되는지 → [경쟁사 비교 보기]│
└─────────────────────────────────────────────────────┘
```

- 최초 1회 표시 후 X 클릭 시 localStorage에 기록, 다시는 표시 안 함
- 별도 컴포넌트 불필요 — `dashboard/page.tsx` 인라인 처리

---

### [7순위] 구독 해지 시 데이터 손실 경고 ✅ 완료

**목적:** "끊으면 손해다"는 느낌 → 장기 구독 유지. 데이터 누적이 잠금 효과(lock-in).
**구현 공수:** 백엔드 추가 없음. 모달 텍스트만 수정.

#### 수정 파일: `frontend/app/(dashboard)/settings/SettingsClient.tsx`

구독 해지 확인 모달에 텍스트 추가:

```
현재:
"구독을 해지하시겠습니까?" [확인] [취소]

변경:
"구독을 해지하면 다음 데이터에 접근할 수 없게 됩니다."

• AI 노출 이력 {days}일 기록
• 경쟁사 비교 데이터 {competitor_count}개 사업장
• 행동→점수 변화 기록 {action_count}건

"데이터는 30일간 보관 후 삭제됩니다."
[그래도 해지] [유지하기]
```

- `days`, `competitor_count`, `action_count`는 기존 API 데이터에서 계산 가능
- 버튼 순서: 해지(보조) / 유지(주 버튼, 강조색)

---

### [8순위] 경쟁 가게 신규 진입 탐지 강화 + 계절별 키워드 갱신 ✅ 완료

**출처:** session_handoff_20260418.md 3-1 (구현 계획에서 누락됐던 항목)

**현재 상태:**
- `detect_new_competitors()` — 이미 구현됨 (신규 사업장 감지 + 기본 카카오 알림)
- **미완성:** 경쟁사의 FAQ 유무 확인 로직 없음 → 알림 내용이 너무 단순함
- **미구현:** 계절별·월별 키워드 추천 갱신 로직

#### 수정 파일 1: `backend/scheduler/jobs.py`

`detect_new_competitors()` 함수 내 알림 메시지 강화:

```python
# 기존: 단순 "새 경쟁 가게 N곳 발견" 알림
# 변경: 경쟁사 FAQ 유무 확인 후 위협 수준 포함

# 신규 경쟁사 카카오 검색 결과에서 FAQ 탭 존재 여부 체크
# (naver_place_stats.py의 Playwright 활용)
has_faq_count = 0
for new_comp in new_competitors:
    place_data = await check_smart_place_completeness(new_comp["naver_place_url"])
    if place_data.get("has_faq"):
        has_faq_count += 1

# 알림 내용 조건 분기
if has_faq_count > 0:
    msg = (
        f"이번 주 반경 500m에 새 {category} {len(new_competitors)}곳이 "
        f"네이버에 등록됐습니다.\n"
        f"{has_faq_count}곳이 FAQ를 등록해 AI 브리핑 노출 경쟁이 생겼습니다.\n"
        f"→ 내 FAQ 확인하기: https://aeolab.co.kr/guide"
    )
else:
    msg = (
        f"이번 주 반경 500m에 새 {category} {len(new_competitors)}곳이 "
        f"네이버에 등록됐습니다.\n"
        f"→ 경쟁사 현황: https://aeolab.co.kr/competitors"
    )
```

**주의:** 카카오 알림 템플릿 변경 시 새 심사 필요 (3~5 영업일).
현재 승인된 `AEOLAB_COMP_01` 템플릿 형식 범위 내에서 가능하면 심사 없이 처리.
불가 시 이메일 발송(`email_sender.py`)으로 대체 후 템플릿 심사 병렬 진행.

---

#### 수정 파일 2: `backend/services/keyword_taxonomy.py`

계절별·월별 키워드 추천 갱신 로직 추가:

```python
# 업종별 계절/월 키워드 매핑
SEASONAL_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "restaurant": {
        "spring": ["봄나물", "꽃구경", "소풍 도시락", "벚꽃 맛집"],
        "summer": ["냉면", "빙수", "여름 보양식", "야외 테라스"],
        "autumn": ["추석 음식", "단풍 맛집", "제철 버섯"],
        "winter": ["뜨끈한 국물", "크리스마스", "연말 회식"],
        "01": ["신년 특선", "설날 음식"],
        "02": ["발렌타인", "설 연휴"],
        # ...월별 12개
    },
    "cafe": { ... },
    "beauty": { ... },
    # 전체 9개 업종
}

def get_seasonal_keywords(category: str, month: int) -> list[str]:
    """현재 월 기준 상위 5개 계절 키워드 반환"""
    season = _month_to_season(month)
    month_str = f"{month:02d}"
    base = SEASONAL_KEYWORDS.get(category, SEASONAL_KEYWORDS["restaurant"])
    return (base.get(month_str, []) + base.get(season, []))[:5]
```

`scheduler/jobs.py`의 `_enrich_competitor_excerpts` 잡에서 월초 1회 호출:
- 업종별 계절 키워드를 `keyword_taxonomy`에서 가져와
- `guide_generator.py`의 Claude 프롬프트에 "이번 달 주목 키워드"로 삽입
- 가이드 생성 시 자동 반영됨

---

### [9순위] 경쟁사 점수 급등 FOMO 알림 ✅ 완료

**목적:** 기존 경쟁사가 점수를 올렸을 때 즉시 알림 → "옆집이 나보다 잘 나온다"는 메시지가 소상공인에게 가장 강력한 구독 유지 동기.
현재 6순위(신규 가게 진입 감지)와 별개 — 기존 경쟁사의 **점수 급등** 감지.

#### 수정 파일: `backend/scheduler/jobs.py`

기존 `daily_scan_all` 잡 완료 후 추가:

```python
async def _detect_competitor_score_spike():
    """경쟁사 unified_score 전주 대비 15점 이상 상승 시 사용자 알림"""
    threshold = 15.0
    # score_history에서 이번 주 vs 지난 주 경쟁사 점수 비교
    # 상승한 경쟁사가 있는 사업장 소유자에게 알림 발송
    for biz_owner in affected_users:
        message = (
            f"[경쟁사명]이 이번 주 AI 노출 점수가 {delta:.0f}점 올랐습니다.\n"
            f"내 가게 현황 확인: https://aeolab.co.kr/competitors"
        )
        # 기존 AEOLAB_COMP_01 템플릿 재사용 (새 심사 불필요)
        await send_kakao_notify(phone, message)
```

- `weekly_kakao_notify` 잡과 합산 (별도 잡 불필요)
- 임계값 15점: 일반적 노이즈(±5점) 이상, 실질적 변화 기준
- 동일 경쟁사 반복 알림 방지: 마지막 알림 후 7일 쿨다운

---

### [10순위] 30일 자동 성과 리포트 이메일 ✅ 완료

**목적:** 구독 갱신 결정 시점(29~31일차)에 "지난 1달 성과"를 자동 발송 → 갱신율 핵심 터치포인트.
소상공인이 서비스를 체감하고 ROI를 확인하는 가장 중요한 순간.

#### 수정 파일: `backend/scheduler/jobs.py`

월 1회 자동 발송 잡 추가:

```python
async def send_monthly_performance_report():
    """구독 후 30일, 60일, 90일 차에 성과 이메일 발송"""
    for sub in active_subscriptions:
        days_since = (today - sub.start_date).days
        if days_since % 30 != 0:
            continue

        # score_history에서 30일 전 vs 현재 점수
        score_before = get_score_at(biz_id, 30_days_ago)
        score_now = get_latest_score(biz_id)
        delta = score_now - score_before

        # business_action_log에서 완료한 행동
        actions = get_action_logs(biz_id, days=30)

        # 이메일 발송 (Resend API)
        send_email(
            to=user.email,
            subject=f"[{biz_name}] 1달 동안 이렇게 달라졌습니다",
            body=render_monthly_report(score_before, score_now, delta, actions)
        )
```

**이메일 내용 구성:**
```
제목: [강남 ○○카페] 1달 동안 이렇게 달라졌습니다

AI 노출 점수: 23점 → 41점 (+18점)
이번 달 완료한 행동: FAQ 등록, 소개글 수정
경쟁사 대비 현재 위치: 상위 40%

다음 달 우선 행동 1가지:
"리뷰 답변에 '아이스 아메리카노 추천' 키워드 포함하기"
→ [지금 바로 가이드 확인]
```

- `backend/services/email_sender.py` 신규 (Resend API 활용, 월 100건 무료 티어)
- 점수 증가 시: 성취감 강조 → 갱신 유도
- 점수 변화 없음: "아직 개선 가능성 많습니다" + 행동 1개 제안 → 이탈 방지

**구현 공수:** 4~6시간

---

### [검토 후 제외] 네이버 지식인 Q&A 모니터링

**제외 사유:**
- 네이버 AI 브리핑이 지식IN을 사업장 노출 경로로 활용한다는 공식 데이터 없음
- 사장님이 자기 가게를 직접 추천하는 답변은 네이버 홍보성 콘텐츠 정책 위반 대상
- 구현 공수(1~2일) 대비 효과 불확실 — FAQ·블로그·리뷰 답변이 검증된 경로로 이미 구현됨

---

### [11순위] 리뷰 인박스 주간 재방문 알림 ✅ 완료

**목적:** 리뷰 인박스는 이미 구현됐지만 사용자가 자발적으로 찾아가야 함. 서비스가 먼저 찾아와야 주간 습관 형성.

#### 수정 파일: `backend/scheduler/jobs.py`

기존 `weekly_kakao_notify` 잡 안에 조건 추가 (별도 잡 불필요):

```python
# 기존 weekly_kakao_notify 잡 내부에 추가
# scan_results에서 이번 주 새 리뷰 발췌문 수 확인
# new_review_count > 0 이면 알림 발송

message = (
    f"이번 주 {biz_name}에 리뷰 {new_review_count}개가 달렸습니다.\n"
    f"AI 최적화 답변 초안을 생성해드릴까요?\n"
    f"→ 답변 생성하기: https://aeolab.co.kr/review-inbox"
)
```

- 새 카카오 템플릿 심사 불필요 — 기존 `AEOLAB_ACTION_01` 템플릿 재사용 가능 여부 확인
- 만약 템플릿 제약 있으면: 이메일 발송(Resend API)으로 대체 (`email_sender.py` 활용)

### [12순위] 소상공인 AI 어시스턴트 채팅 ✅ 완료

**목적:** 40~60대 소상공인의 "이 숫자가 뭔가요?", "FAQ를 어디에 올려요?" 질문에 즉시 답변.
복잡한 UI를 읽게 하는 것보다 자연어 채팅이 이해도 낮은 사용자에게 적합.

**구현 방식:**
- Claude Haiku 사용 (저비용), 시스템 프롬프트에 사업장 컨텍스트 주입 (점수/갭/성장단계)
- 미리 정의된 빠른 질문 3개 버튼 ("내 점수가 왜 낮아요?" / "FAQ를 어디에 올리나요?" / "경쟁 가게보다 뒤처진 이유?")

**구현 범위:**
- `backend/routers/assistant.py` 신규 — `POST /api/assistant/chat` (컨텍스트 포함 Claude Haiku 호출)
- `frontend/components/common/AIAssistant.tsx` 신규 — 대시보드 우측 하단 플로팅 버튼 + 채팅창
- **플랜 제한:** Basic+ (월 20회), Pro+ 무제한

---

### [검토 후 차후 계획] 연간 구독 할인 / 추천인 프로그램

**사유:** 구독자 기반 확보 후 적용. 현 단계에서는 가입 전환·기능 체감이 우선.

---

### [검토 후 보완] 랜딩 소셜 증거 + ROI 프레이밍 교체

**소셜 증거 (현재 누락):**
- 랜딩 페이지 전 구간에 다른 소상공인 후기가 없음
- 초기: 베타 테스터 3명 모집(무료 제공) → 후기 수집 후 게재
- `frontend/app/(public)/page.tsx` 3-B 섹션에 후기 카드 3개 추가

**ROI 프레이밍 교체:**
```
현재: "네이버 광고비 하루치 = 9,900원"
교체: "네이버 공식 발표 — AI 브리핑 도입 후 소규모 식당 신규 예약 105% 증가.
       지금 내 가게는 그 흐름에 타고 있나요?"
```
- 히어로 서브카피, pricing 비교 배너에 반영
- `pricing/page.tsx` 비교 배너: "블로그 마케팅 대행사 월 30~50만원 vs AEOlab 월 9,900원"

**정부 지원 연계 안내 (수정):**

> ⚠️ **바우처 표현 수정 필요** — 2026년 소상공인 경영안정 바우처(25만원)는 공과금·보험료 전용으로 SaaS 구독료 사용 불가. 기존 "디지털 바우처" 표현은 오해 유발 → 아래로 교체.

**정확한 지원 경로:**
- **클라우드 서비스 지원포털(cloudsup.or.kr)** — AEOlab 형태의 SaaS가 공급기관 등록 가능한 과기정통부 사업
  - 최종점수 70점 이상 시 비경쟁 자격심사로 등록 가능
  - 등록 완료 시: 소상공인이 정부 지원금으로 AEOlab 구독료 지원 가능
- `pricing/page.tsx` 하단 문구: "클라우드 서비스 정부 지원 대상 서비스 등록 추진 중 — cloudsup.or.kr"
- 차후 Action: cloudsup.or.kr 공급기관 등록 신청 (구독자 확보 후 ROI 증빙 가능 시점에)

---

## 구현 순서 및 예상 공수

| 순위 | 기능 | 상태 | 구현 파일 |
|------|------|------|---------|
| 1 | 랜딩·체험 포지셔닝 수정 + 105% 수치 히어로 배치 | ✅ 완료 | page.tsx, trial/page.tsx |
| 1-보완 | 소셜 증거 + ROI 프레이밍 교체 | ✅ 완료 | page.tsx |
| 2 | 회원가입 없는 라이브 데모 | ✅ 완료 | HeroInlineForm.tsx, scan.py |
| 3 | "최초 1승" 온보딩 플로우 | ✅ 완료 | onboarding/page.tsx |
| 4 | AI 검색 화면 스크린샷 증거 | ✅ 완료 | ai_search_screenshot.py, AISearchScreenshotCard.tsx, report.py |
| 5 | TrendLine 행동 오버레이 | ✅ 완료 | TrendLine.tsx (ReferenceLine), jobs.py |
| 6 | ChatGPT 차별화 카드 | ✅ 완료 | ChatGPTDiffCard.tsx |
| 7 | 해지 데이터 손실 경고 | ✅ 완료 | SettingsClient.tsx |
| 8 | 경쟁 가게 알림 강화 + 계절 키워드 | ✅ 완료 | jobs.py, keyword_taxonomy.py |
| 9 | 경쟁사 점수 급등 FOMO 알림 | ✅ 완료 | jobs.py (_detect_competitor_score_spike) |
| 10 | 30일 자동 성과 리포트 이메일 | ✅ 완료 | email_sender.py, jobs.py |
| 11 | 리뷰 인박스 주간 재방문 알림 | ✅ 완료 | jobs.py (weekly_kakao_notify) |
| 12 | AI 어시스턴트 채팅 | ✅ 완료 | assistant.py, AIAssistant.tsx |

**묶음 실행 권장:**
- **Day 1 (반나절)**: 1순위 + 1-보완 + 6순위 + 7순위 → 포지셔닝·차별화·잠금 한 번에
- **Day 1~2**: 2순위 + 3순위 → 진입 장벽 제거 + 온보딩 강화
- **Day 3~5**: 4순위 (Playwright 작업 — RAM 주의)
- **병렬 진행**: 8순위 착수 + 카카오 템플릿 심사 요청 동시에
- **월말 기준**: 10순위(30일 리포트) → 첫 구독 갱신 사이클 전에 완료 필수

---

## Supabase 실행 필요 SQL (미실행 항목)

```sql
-- 세션 인계 문서에서 이월된 미실행 항목
-- https://supabase.com/dashboard/project/[프로젝트ID]/editor

-- 1. blog_analysis_json 컬럼
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;

-- 2. business_action_log 테이블 (이미 실행했으면 skip)
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

-- 3. [4순위] AI 검색 스크린샷 저장용 컬럼
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS ai_search_screenshots JSONB;
  -- 구조: [{"platform": "naver", "url": "...", "is_mentioned": false, "query": "..."}]

-- 4. [12순위] AI 어시스턴트 대화 이력 (월별 사용 횟수 추적용)
CREATE TABLE IF NOT EXISTS assistant_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assistant_logs_user_month
  ON assistant_logs(user_id, created_at DESC);
```

---

## 서버 배포 체크리스트

```bash
# 각 순위 구현 완료 후 실행

# 프론트엔드 변경 시
cd /var/www/aeolab/frontend
npm run build
pm2 restart aeolab-frontend

# 백엔드 변경 시
pm2 restart aeolab-backend

# 검증 URL
# 1순위: https://aeolab.co.kr (히어로 문구 + 105% 수치 확인)
# 1순위: https://aeolab.co.kr/trial (체험 결과 감정 문장 확인)
# 2순위: https://aeolab.co.kr (히어로 라이브 데모 인라인 폼 확인)
# 3순위: https://aeolab.co.kr/onboarding (온보딩 3단계 체크리스트 확인)
# 4순위: https://aeolab.co.kr/dashboard (AI 스크린샷 카드 확인)
# 5순위: https://aeolab.co.kr/dashboard (TrendLine 오버레이 확인)
# 6순위: https://aeolab.co.kr/dashboard (최초 1회 차별화 카드 확인)
# 7순위: https://aeolab.co.kr/settings (해지 모달 텍스트 확인)
# 12순위: https://aeolab.co.kr/dashboard (우측 하단 AI 어시스턴트 버튼 확인)
```

---

## 구현 후 측정할 지표

| 지표 | 측정 방법 | 목표 |
|------|---------|------|
| 히어로 → 라이브 데모 진입률 | 히어로 폼 제출 수 / 페이지뷰 | 15% 이상 |
| 라이브 데모 → 가입 전환율 | 데모 결과 표시 후 가입 클릭률 | 20% 이상 |
| 무료체험 → 유료 전환율 | trial_scans vs subscriptions | +30% 개선 |
| 온보딩 완료율 | 3단계 모두 완료한 신규 가입자 비율 | 60% 이상 |
| 첫 달 구독 유지율 | 1개월 후 active 구독자 비율 | 70% 이상 |
| 30일 리포트 → 갱신율 | 리포트 이메일 발송 후 갱신 비율 | 80% 이상 |
| 해지 시도 후 유지율 | 해지 모달 → 취소 버튼 클릭률 | 30% 이상 |
| FOMO 알림 → 로그인율 | 경쟁사 급등 알림 후 24시간 내 로그인 | 50% 이상 |
| AI 어시스턴트 주간 사용률 | 채팅 1회 이상 사용 구독자 비율 | 40% 이상 |

---

## 제외·차후 계획 항목

| 기능 | 사유 |
|------|------|
| 네이버 지식인 Q&A 모니터링 | AI 브리핑 인용 경로 미검증 + 네이버 홍보 정책 위반 리스크 |
| 소상공인 경영안정 바우처 연계 | 2026년 바우처는 공과금·보험료 전용 — SaaS 사용 불가. cloudsup.or.kr 공급기관 등록으로 대체 |
| 연간 구독 할인 | 구독자 기반 확보 후 적용 |
| 추천인 프로그램 | 구독자 기반 확보 후 적용 |
| 네이버 DataLab API 연동 | 구독자 100명 이후 (CLAUDE.md 미래 과제) |

---

*작성: 2026-04-18 | 이전 세션 분석 + 기능 현황 검토 기반*
*업데이트 v1: 2026-04-18 | 검토 의견 반영 — 신규 8·9순위 추가, 소셜 증거·ROI 프레이밍·바우처 보완, 지식인 제외*
*업데이트 v2: 2026-04-18 | 2차 검토 반영 — 우선순위 재조정(2순위→라이브데모), 3개 신규 항목 추가(온보딩·FOMO알림·30일리포트), 바우처 표현 수정(경영안정→cloudsup), 105% 수치 히어로 배치*
*업데이트 v3: 2026-04-18 | **전 12순위 구현 완료 + 서버 배포 완료** — 4순위(AI스크린샷), 11순위(리뷰인박스알림), 12순위(AI어시스턴트) 추가 구현. Supabase SQL 실행 완료.*
*참조: session_handoff_20260418.md, next_features_v1.0.md, CLAUDE.md*
