# Basic vs 창업패키지 요금제 차별화 설계 v1.0

> 작성일: 2026-07-15 | next-feature 에이전트 산출물
> **상태**: ✅ **구현·배포 완료** (2026-07-15, 후보 A 채택 — Basic 주 2회 자동 스캔)
> 가격 변경 없음 (Basic 11,900원 / 창업패키지 12,900원 유지)
> 이 문서는 `docs/plan_limits_v1.0.md`를 계승하되 대체하지 않음 — `plan_limits_v1.0.md`도 v1.2로 함께 갱신됨
>
> **구현 시 추가 발견**: §5 구현 파일 목록에 없던 곳에서도 "Basic 주 1회" 명시적 문구를 8곳 추가 발견(`onboarding/page.tsx`, `how-it-works/page.tsx` 2곳, `demo/page.tsx` 2곳, `plans-preview/page.tsx`, `pricing/PlanRecommender.tsx`, `faq_seed.py`) — 전부 동일하게 "주 2회(월·목)"로 수정. 키워드 순위 측정(`keyword_rank_basic_weekly_job`)과 카카오 주간 알림(`weekly_kakao_notify`)은 별도 크론으로 확인되어 의도적으로 미변경(주 1회 유지가 맞음).

---

## 1. 문제 정의

`frontend/app/(public)/pricing/page.tsx:226-251` 비교표 기준, 창업패키지(12,900원)가 Basic(11,900원)보다 **모든 항목에서 같거나 우위**인 "strictly dominated" 상태.

| 항목 | 창업패키지 | Basic | 우위 |
|---|---|---|---|
| 자동 스캔 | 주 1회 | 주 1회 | 동률 |
| 수동 스캔 | 하루 3회 | 하루 2회 | 창업패키지 |
| 경쟁사 비교 | 5개 | 3개 | 창업패키지 |
| AI 개선 가이드 | 월 5회 | 월 3회 | 창업패키지 |
| 블로그 AI 진단 | 월 5회 | 월 3회 | 창업패키지 |
| 리뷰 답변 | 무제한 | 월 50회 | 창업패키지 |
| 위기관리 가이드 | 무제한 | 20회 | 창업패키지 |
| 히스토리 보관 | 90일 | 60일 | 창업패키지 |
| AI 콘텐츠 생성 | 월 20건 | 10건 | 창업패키지 |
| 키워드 추천 | 월 10회 | 5회 | 창업패키지 |
| 창업 시장 분석 | ✓ | — | 창업패키지 |
| **Basic 우위 항목** | | | **0개** |

단 1,000원 차이로 Basic이 이기는 항목이 단 하나도 없음.
`backend/routers/webhook.py:99-103` 확인 결과 창업패키지 가입 자격 검증 없음 — 운영 중인 사장님도 비교표만 보면 창업패키지 선택이 합리적.

**의도된 타깃 차이** (`docs/plan_limits_v1.0.md` "플랜별 포지셔닝"):
- Basic: 이미 운영 중인 단일 사업장 소상공인
- 창업패키지: 아직 오픈 전, 창업 시장 분석이 핵심

---

## 2. 설계 원칙 (이번 작업 제약)

1. **가격 불변**: Basic 11,900원 / 창업패키지 12,900원 유지
2. **기존 창업패키지 한도 하향 금지**: 현 구독자(있을 경우) 불이익 방지
3. **Pro(23,900원) 자기잠식 방지**: 추가 후에도 Pro가 Basic보다 명백히 우월해야 함
4. **"실측·사실적 정보만" 원칙**: 새 기능에도 더미 데이터·근거 없는 추정 금지
5. **1인 개발 / 서버 iwinv vCPU2**: 복잡한 신규 인프라 최소화

---

## 3. 후보 3개

### [후보 A] Basic → 주 2회 자동 스캔 (월·목), 창업패키지 주 1회 유지 — 1순위 추천

**근거 논리:**
- "운영 중인 가게는 내가 소개글·소식·리뷰를 수정한 뒤 AI에 반영됐는지 더 자주 확인해야 한다"
- "예비 창업자는 시장 조사 중이라 주 1회로 충분하다 — 오픈 전엔 수정할 실제 콘텐츠가 없다"
- 이 논리는 코드 게이팅 없이도 자연스럽게 설명 가능

**현재 코드 상태 (`scheduler/jobs.py:448`):**
```python
if plan in ("basic", "startup") and not is_monday:
    logger.debug("[daily_scan_all] basic/startup 비월요일 스킵")
    continue
```
basic과 startup이 같은 분기 처리 — 이 줄 1개 수정으로 차별화 완성.

**변경 후:**
```python
is_thursday = today.weekday() == 3
is_basic_scan_day = is_monday or is_thursday  # 주 2회: 월·목

if plan == "startup" and not is_monday:
    continue  # startup: 월요일만
elif plan == "basic" and not is_basic_scan_day:
    continue  # basic: 월·목 (주 2회)
```
(`plan_gate.py`의 `auto_scan_mode` 값은 문자열 의미만이므로 `"basic_2x"` 등으로 별도 상수 추가는 선택사항 — 없어도 동작함)

**비교표 변경 결과:**

| 항목 | 창업패키지 | Basic (변경 후) | Pro | Biz |
|---|---|---|---|---|
| 자동 스캔 | 주 1회 | **주 2회 (월·목)** | 주 3회 | 매일 |
| 수동 스캔 | 하루 3회 | 하루 2회 | 하루 5회 | 하루 10회 |
| ... | ... | ... | ... | ... |

이제 `자동 스캔` 행에서 Basic이 창업패키지를 앞선다.
자동 스캔 주기 ladder: **창업 1회/주 → Basic 2회/주 → Pro 3회/주 → Biz 매일** — 완벽한 단조 증가.

**Pro 잠식 여부:** 없음. Pro는 여전히 주 3회(월·수·금) + 경량 일별 스캔 + 가이드 10회 + 광고 대응 + PDF + 사업장 2개. Basic 주 2회는 Pro의 명확한 하위 티어.

**비용 영향:**
- 현재 Basic 자동 스캔: 1회/주 × ~50원 = ~200원/월/user
- 변경 후: 2회/주 × ~50원 = ~400원/월/user
- 추가 비용: +200원/user/월
- BEP 20명 기준: +4,000원/월 (약 $3, 전체 API 비용 대비 미미)

**예상 개발 시간:** 2~3시간 (코드 변경 최소, 주로 UI 카피 수정)

---

### [후보 B] AI 광고 대응 가이드 Basic에 월 1회 개방 (창업패키지 없음 유지) — 2순위 대안

**근거 논리:**
- "광고를 이미 집행 중이거나 검토 중인 운영 사장님에게 필요한 기능"
- "예비 창업자는 아직 광고를 집행하지 않으므로 당장 필요 없음"
- Pro 업그레이드 욕구 자극 효과: "이게 도움됐는데 한 번 더 쓰고 싶다 → Pro(5회/월)로"

**현재 코드 상태 (`backend/routers/guide.py:582`):**
```python
if plan not in ("pro", "biz", "enterprise"):
    raise HTTPException(status_code=403, ...)
```
이 한 줄에 `"basic"` 추가 + `plan_gate.py` 수치 변경으로 완성.

**변경 내용:**
- `plan_gate.py`: `basic.ad_defense = True`, `basic.ad_defense_monthly = 1`
- `guide.py:582`: `if plan not in ("basic", "pro", "biz", "enterprise"):`
- UI: 광고 대응 가이드 항목 "—/—/✓/✓" → "—/월 1회/월 5회/월 10회"

**비교표 변경 결과:**

| 항목 | 창업패키지 | Basic (변경 후) | Pro | Biz |
|---|---|---|---|---|
| 광고 대응 가이드 | — | **월 1회** | 월 5회 | 월 10회 |

**Pro 잠식 여부:** 없음. 1회 vs 5회 (5배 차이). Pro는 여전히 월 5회 + 경쟁사 5개 + 가이드 10회 + PDF + 사업장 2개 + 주 3회 스캔.

**비용 영향:**
- Claude Sonnet 광고 대응 1회 ≈ ~72원 (guide_generate와 동일 수준)
- BEP 20명, 평균 50% 사용 시: 10 × 72원 = 720원/월 추가
- 매우 낮음

**주의:** 프론트엔드 `/ad-defense` UI 페이지가 현재 Pro+ 전용으로 렌더링되는 경우 잠금 해제 로직 추가 필요. 구현 전 관련 컴포넌트 grep 필요.

**예상 개발 시간:** 3~4시간 (backend 2파일 + UI 광고 대응 섹션 잠금 해제 확인 포함)

---

### [후보 C] 점수 변화 주간 이메일 알림 (Basic 전용) — 3순위 보류 권고

**근거:**
- 운영 중인 사장님은 "내가 소개글을 바꿨는데 점수가 올랐나?" 확인 욕구가 강함
- 창업패키지는 오픈 전 / 오픈 초기라 점수 변화가 거의 없음

**문제:**
- 이메일 발송 잡 신규 구현 필요 (기존 weekly digest와 중복 가능성 검토 필요)
- startup 사용자도 오픈 후에는 이 알림을 원할 수 있어 "Basic 전용" 명분이 약함
- 기존 카카오 알림과의 중복 정리 필요

**결론:** 현 단계에서 보류. 구독자 50명 이후 Pro 전환율 데이터 보고 결정.

---

## 4. 1순위 추천 요약 — 후보 A 채택 시

### 포지셔닝 재정의

| 플랜 | 핵심 타깃 | 차별 포인트 | 비교 |
|---|---|---|---|
| **Basic (11,900원)** | 이미 운영 중인 가게 | **주 2회 자동 감시 (월·목)** — 개선 후 빠른 반영 확인 | 더 자주 모니터링 |
| **창업패키지 (12,900원)** | 예비 창업자 | 더 많은 AI 도구 세트 + 창업 분석 | 더 풍부한 콘텐츠 |

이제 두 플랜 간에 진짜 트레이드오프가 생긴다:
- "모니터링 빈도 > 콘텐츠 도구 양" → Basic
- "창업 분석 + 더 많은 AI 도구" → 창업패키지

### Pro 잠식 완전 검증

| 항목 | Basic (변경 후) | Pro | Pro 우위 |
|---|---|---|---|
| 자동 스캔 | **주 2회 (월·목)** | 주 3회 (월·수·금) + 경량 일별 | +1회/주 + 경량 스캔 |
| 수동 스캔 | 하루 2회 | 하루 5회 | +3회 |
| 경쟁사 | 3개 | 5개 | +2개 |
| AI 가이드 | 월 3회 | 월 10회 | +7회 |
| 광고 대응 | — | ✓ (월 5회) | 독점 |
| PDF 리포트 | — | ✓ | 독점 |
| 히스토리 | 60일 | 90일 | +30일 |
| 사업장 수 | 1개 | 2개 | +1개 |

Pro는 여전히 모든 핵심 지표에서 Basic 대비 명백히 우월. 자기잠식 없음. ✓

---

## 5. 구현 파일 목록 (후보 A 채택 시)

### 수정 파일

| 파일 | 변경 내용 | 비고 |
|---|---|---|
| `backend/scheduler/jobs.py:448` | `if plan in ("basic", "startup") and not is_monday:` → basic/startup 분기 분리 | **핵심 변경 1줄** |
| `backend/middleware/plan_gate.py` | `"basic".auto_scan_mode = "basic_2x"` (선택적 상수 이름 변경, 동작엔 무관) | 주석 업데이트 |
| `frontend/lib/plans.ts` | Basic `description`, `killerFeature`, `features[0]` "주 1회 → 주 2회 (매주 월·목)" | 카피 업데이트 |
| `frontend/app/(public)/pricing/page.tsx` | 비교표 `자동 스캔` 행: `"주 1회"(Basic) → "주 2회 (월·목)"` | 1셀 변경 |
| `frontend/app/(dashboard)/settings/page.tsx` | 비교표 `자동 스캔` 행 Basic 셀: `"주 1회" → "주 2회"` | 1셀 변경 |
| `docs/plan_limits_v1.0.md` | 전면 갱신 (아래 §6 참조) | 가격 drift 수정 포함 |

### 신규 파일

없음.

### DB 마이그레이션

없음. 스케줄러 로직 변경만으로 완결.

---

## 6. `docs/plan_limits_v1.0.md` Drift 수정 필요 사항

현재 문서에 다음 오류가 있음 (`plan_limits_v1.0.md` 직접 확인 — 2026-06-17 작성, 이후 가격 인상 미반영):

| 항목 | 문서 현재값 (오류) | 실제 라이브 값 | 확인 위치 |
|---|---|---|---|
| Basic 월 요금 | 9,900원 | **11,900원** | `backend/config/prices.py:5` |
| Pro 월 요금 | 18,900원 | **23,900원** | `backend/config/prices.py:7` |
| Basic 마진율 | ~81% | **76.3%** | `docs/business_viability_audit_v1.0.md §2` |
| Pro 마진율 | ~83% | **78.6%** | 동일 |
| Biz 마진율 | ~92% | **87.1%** | 동일 |
| Basic API 비용 합계 | 1,876원 | — | 재산정 필요 (Gemini thinking 토큰 미실측) |
| 자동 스캔 Basic | 주 1회 | 후보 A 채택 시 **주 2회** | 이번 변경 |

이 문서는 구현 완료 후 함께 갱신할 것. 수치 기재 시 반드시 `plan_gate.py`·`prices.py` 직접 확인 후.

---

## 7. 구현 순서 (후보 A 채택 확정 후)

```
1. backend/scheduler/jobs.py — 스케줄러 분기 수정 (핵심)
2. backend/middleware/plan_gate.py — 상수 주석 업데이트 (선택)
3. frontend/lib/plans.ts — Basic 카피 "주 2회 (월·목)"
4. frontend/app/(public)/pricing/page.tsx — 비교표 1셀
5. frontend/app/(dashboard)/settings/page.tsx — 비교표 1셀
6. 서버 배포 (backend는 pm2 restart, frontend는 빌드+재시작)
7. 라이브 검증 (목요일 오전 02:xx KST에 basic 사용자 스캔 실행 확인)
8. docs/plan_limits_v1.0.md 갱신 (가격 drift + 변경 이력 추가)
9. CLAUDE.md 완료 이력 업데이트
```

---

## 8. 비용 영향 요약

| 항목 | 현재 | 후보 A 변경 후 | 차이 |
|---|---|---|---|
| Basic 자동 스캔 비용/user/월 | ~200원 | **~400원** | +200원 |
| BEP 20명 기준 월 추가 비용 | — | **+4,000원** | ~$3/월 |
| 전체 API 비용 대비 | — | 약 5% 증가 | 무시 가능 |
| Pro/Biz 비용 변화 | — | 없음 | — |

---

## 9. 주의 사항

- **라이브 검증 타이밍**: 스케줄러는 새벽 02:00 KST 실행 — 배포 후 다음 목요일(basic 첫 2회차)까지 기다려야 정상 작동 확인 가능. **라이브 검증 전에 jobs.py 로직을 로컬 단위테스트로 먼저 확인 권장** (`today.weekday() in (0, 3)` 조건 assert)
- **기존 startup 구독자 영향 없음**: startup은 기존과 동일하게 월요일 1회만 스캔
- **auto_scan_mode 상수**: 현재 jobs.py는 `plan_gate.py`의 `auto_scan_mode` 문자열을 직접 사용하지 않고, `plan` 문자열(`"basic"`, `"startup"`)을 직접 비교 (`jobs.py:448` 확인). 따라서 `plan_gate.py`의 `auto_scan_mode` 값 변경은 UI/문서 목적이며 실행 로직에는 무관함. 혼동 방지를 위해 주석에 "주 2회 (월·목)" 명시 권장.
- **Basic 첫 달 50% 할인 연계**: 창업패키지에는 첫 달 할인 없음 (`prices.py` 확인). Basic의 5,950원 첫 달 할인은 유지 — 이번 변경 무관.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-07-15 | v1.0 최초 작성 — Basic vs 창업패키지 차별화 설계 (next-feature 에이전트) |
