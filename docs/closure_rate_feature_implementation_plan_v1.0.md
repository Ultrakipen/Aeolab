# 창업 시장 분석 — 폐업율 기능 구현 설계 (2026-09-01)

> 전제 문서: `docs/closure_rate_data_source_investigation_v1.0.md` (데이터 소스 조사·라이브 검증 완료, 이 문서의 매핑표·API 스펙이 단일 소스). 이 문서는 그 조사를 바탕으로 `next-feature` 에이전트가 낸 **구현 범위 설계**다. 코드는 아직 작성되지 않았음 — 다음 세션에서 이 설계대로 구현 시작.

## 목적

예비 창업자가 특정 지역·업종의 시장 위험도를 실측 데이터로 판단할 수 있게 한다. 현재 "창업 시장 분석" 페이지는 "시장 규모(SBIZ)"와 "경쟁 타이밍"만 제공하는데, 여기에 "역대 누적 폐업 비율 + 전국 평균 대비" 맥락을 추가해 진입 결정의 근거를 강화한다.

## 시작 전 사용자 조치 (필수, 구현 착수 전 확인)

- **서버 `.env`에 `LOCALDATA_API_KEY` 추가 필요** — 조사 과정에서 사용자가 이미 발급받아 테스트에 쓴 표준 키(data.go.kr 활용신청, `%2F` 포함 base64 형태) 그대로 넣으면 됨. 값은 이 문서에도, 조사 문서에도 기록하지 않음 — 필요 시 사용자에게 재확인.

## 설계 결정 6개

### 1. "폐업율" 지표 정의 — (A) 누적 폐업율 채택, (B) 기각

(B) "최근 N개월 폐업율"은 기각. 사유:
- `CLSBIZ_YMD`(폐업일자) 날짜 필터가 API에 없어 폐업 레코드 전체를 페이지네이션으로 받아야 함(서귀포시 일반음식점만 폐업 5,930건 → `numOfRows=100` 기준 60회 호출).
- `beauty_salons` 엔드포인트가 이미 단일 호출에 30초+ 타임아웃 실측됨 — 60회 연쇄 호출은 실서비스에서 허용 불가.

(A) 누적 폐업율을 **전국 평균 대비 상대 지표**로 재가공해 오해 소지를 차단:
- API 호출 2회로 계산: `cond[SALS_STTS_CD::EQ]=01`(영업)과 `=03`(폐업)의 `totalCount`만 비교(`numOfRows=1`)
- `폐업율 = 폐업건수 / (영업건수 + 폐업건수) × 100`
- 전국 평균 비교치를 상수로 관리 → "전국 평균 대비 낮음/비슷/높음" 3단계 텍스트 레이블이 주(主), 숫자는 보조
- UI에 "(역대 누적 기준 — 연간 폐업율 아님)" 캐비엇 항상 노출 필수
- 참고: CLAUDE.md의 "AI Visibility 점수 숫자 표시 금지" 원칙은 이 지표엔 적용 안 됨(그 원칙은 AI Visibility 수치 전용, 이건 시장 사실 데이터) — 숫자 자체는 표시하되 반드시 맥락 텍스트와 묶어서 제공
- 전국 평균 상수: 초기엔 조사 문서 실측값(일반음식점 70.5%)만 존재, 나머지 업종은 `national_avg: null` 처리 — 구독자 확보 후 전국 조회로 채우는 걸 후속 과제로 남김

### 2. 캐싱 전략 — 기존 인메모리 캐시 재사용, TTL 24시간

- `utils/cache.py`의 `_store` 딕셔너리 그대로 사용, 신규 인프라 불필요
- TTL 86,400초(24시간) — 행정 인허가 데이터는 일 단위 변동 미미, market report 30분 캐시보다 훨씬 길게 잡아도 무방
- 캐시 키: `closure_rate:{category}:{region_normalized}` (region은 `.strip().lower()` 정규화)
- 전체 리포트 캐시(`_TTL_FULL_REPORT`)와는 독립 관리 — 별도 엔드포인트로 분리해 테스트·디버깅 단순화

### 3. DB 스키마 변경 — 없음

- 24h 인메모리 캐시로 쿼터 보호·성능 충분
- 폐업율은 히스토리 적재가 필요한 데이터가 아님(오늘/내일 차이 무의미)
- `StartupReport` TypeScript 인터페이스에 `closure_rate` 옵션 필드만 추가
- `db-migrate` 에이전트 위임 범위 없음

### 4. API 비용/쿼터 — 전역 가드 불필요 (BEP 20명 기준)

- data.go.kr 무료 티어: 10,000회/일
- 폐업율 1회 조회 = API 2회, 24h 캐시 적용 시 동일 (category, region) 쌍은 하루 2회만 실호출
- BEP 20명 전원이 서로 다른 조합 조회해도 최악 40회/일 — 한도의 0.4%
- Playwright 전역 세마포어 같은 쿼터 가드 불필요. **구독자 500명 이상 되면 재검토 필요 — 서비스 파일 상단에 주석으로 남길 것**
- 월 추가 비용: **0원**

### 5. UI/UX 배치 — ⚠️ 2026-09-01 정정: `next-feature` 초안이 실제 페이지 구조와 어긋났음, 재설계

**최초 설계(next-feature 초안, 오류)**: "real_market 섹션 직후, timing 섹션 직전에 삽입" — **`StartupReportView.tsx` 직접 확인 결과 `timing` 섹션은 2026-08-31부터 화면에 렌더링되지 않음**(인터페이스엔 필드가 남아있지만 주석에 "창업 예정자에게 필요한 건 AEOlab 내부 고객 현황이 아니라 실제 지역 상권 분석"이라는 방향으로 재구성되며 비노출 처리됨). 즉 배치 기준으로 삼았던 섹션 자체가 이미 없음 — next-feature 에이전트가 코드 대신 요약 설명만으로 설계해 생긴 오류.

**현재 실제 페이지 구조**(2026-09-01 직접 확인, `StartupReportView.tsx`):
1. **시장 현황** — 실제 상권 규모(SBIZ/카카오, `real_market`) + 경쟁사 스마트플레이스 준비도(`competitor_readiness`) — 둘 다 "시장을 파악한다"는 하나의 내러티브로 이미 묶여 있음
2. **네이버 검색 수요 트렌드** (`search_trend`)
3. **AI 진입 전략** (`strategy`)
4. **다음 단계**

**→ "폐업" 관련 콘텐츠가 이 페이지에 전무함** — 4개 섹션 전부 "창업(진입)" 관점. 폐업율 기능은 이 페이지에서 처음 등장하는 "폐업/생존" 콘텐츠가 됨.

**재설계 — 신규 최상위 섹션 대신, "시장 현황" 섹션 안에 3번째 서브블록으로 삽입**:
- 순서: 실제 시장 규모(기존) → **폐업율/생존 현황(신규)** → 경쟁사 준비도(기존)
- 근거: 이미 "시장 현황" 섹션이 "규모"+"경쟁사 준비도"를 하나의 상권 파악 내러티브로 묶고 있음 — 여기에 "이 시장이 얼마나 안정적인가"를 추가하면 "몇 개 있고 → 얼마나 안정적이고 → 경쟁사는 얼마나 준비됐나"로 자연스럽게 이어짐. 신규 최상위 섹션을 만들면 페이지가 5개 섹션으로 늘어나며 "창업 관점 3개 + 폐업 관점 1개"로 어색하게 분절됨
- 섹션 서브타이틀도 자연스럽게 확장 가능: "국세청·카드사 등록 통계(또는 카카오맵 실측) 기준 실제 상권 규모입니다" → "...실제 상권 규모와 생존 현황입니다" 등(문구는 구현 시 frontend-dev가 다듬을 것)
- `real_market.available`과 별개로 `closure_rate.available`을 독립 체크 — 시장 규모는 있어도 폐업율이 `available:false`(커버 불가 업종)인 조합이 있을 수 있으므로 두 블록을 독립적으로 조건부 렌더링
- 전국 평균 대비 텍스트 레이블(낮음/비슷/높음)이 주인공, 숫자는 보조
- "(역대 누적 기준 — 연간 폐업율 아님)" 캐비엇 그레이 텍스트로 항상 노출
- `available: false`(커버 안 되는 업종)일 때는 이 서브블록만 렌더링 생략(섹션 자체는 시장 규모·경쟁사 준비도로 유지)

**⚠️ 재발 방지 — 이번 오류의 교훈**: 프론트엔드 UI 배치를 설계할 때는 컴포넌트 파일을 직접 Read하지 않고 "리포트 흐름은 이럴 것"이라는 추정만으로 설계하면 이미 바뀐 화면 구조와 어긋날 수 있음. 다음에 유사한 UI 배치 결정을 할 때는 반드시 대상 `.tsx` 파일을 먼저 열어 실제 렌더링되는 섹션 목록을 확인할 것.

### 6. 에러/데이터 없음 처리

- API 타임아웃: `aiohttp.ClientTimeout(total=70)` 적용(`beauty_salons` 실측 30~60초 타임아웃 확인됨 — 넉넉하게). 타임아웃 시 `{"available": False, "reason": "api_timeout"}`
- 영업+폐업 `totalCount` 합이 0: `{"available": False, "reason": "no_data"}`(신생 지자체 등)
- 업종 미매핑(yoga 등): `{"available": False, "reason": "uncovered_category"}`
- 예외 전체: `except Exception` → warning 로그 + graceful fallback, **절대 허위 수치 반환 안 함**
- API 키 미설정: `.env`에 `LOCALDATA_API_KEY` 없으면 서비스 초기화 시 warning 로그 + 모든 호출 `available: False`

## 변경 파일 목록

**신규**:
- `backend/services/localdata_api.py` — 행정안전부 지방행정 인허가 통합 API 클라이언트 + 폐업율 계산

**수정**:
- `backend/routers/startup.py` — `GET /api/startup/closure-rate/{category}/{region}` 엔드포인트 추가(startup 플랜+ 인증)
- `frontend/app/(dashboard)/startup/StartupReportView.tsx` — `StartupReport` 인터페이스에 `closure_rate` 옵션 필드 추가 + 기존 "시장 현황" `<section>`(71~177행) 안에 실제 시장 규모 블록과 경쟁사 준비도 블록 사이(177행 앞)로 폐업율 서브블록 삽입(신규 최상위 섹션 아님 — §5 참조)
- `frontend/app/(dashboard)/startup/StartupClient.tsx` — 리포트 생성 후 closure-rate 별도 fetch(Promise.all 병렬)
- `backend/.env`(서버) — `LOCALDATA_API_KEY=<값>` 추가(사용자 조치)

**DB**: 없음

## `localdata_api.py` 핵심 구조 (시그니처 수준, 코드는 미작성)

```python
ENDPOINT_MAP: dict[str, str]
  # category → endpoint path 매핑 — closure_rate_data_source_investigation_v1.0.md
  # "AEOlab 업종별 매핑" 표를 그대로 상수화
  # 미매핑 카테고리(yoga, study_cafe 등): 키 없음

BAR_FILTER: str = "호프"
  # bar 카테고리 전용 BZSTAT_SE_NM::LIKE 필터값
  # (조사 문서: "호프/통닭" 212,900건 + "감성주점" 2,210건)

NATIONAL_AVG: dict[str, float]
  # 업종별 전국 누적 폐업율 초기값 (restaurant: 70.5, 나머지: None)

async def _fetch_count(
    endpoint: str,
    region: str,
    status_cd: str,              # "01" or "03"
    bzstat_filter: str | None,   # bar 카테고리 전용
    session: aiohttp.ClientSession,
) -> int | None:
    # numOfRows=1, pageNo=1로 totalCount만 획득
    # cond[LOTNO_ADDR::LIKE]=<region> 사용 (조사 문서: 정답 대비 약 0.9% 언더카운트, 상대비교엔 문제 없음)
    # 타임아웃·에러 시 None 반환

async def get_closure_rate(category: str, region: str) -> dict:
    # 캐시 확인 → 미스 시 _fetch_count 2회 병렬 호출 (asyncio.gather)
    # 반환:
    # {
    #   "available": bool,
    #   "reason": str | None,           # uncovered_category / no_data / api_timeout
    #   "closure_rate": float | None,   # 누적 폐업율 %
    #   "active_count": int | None,
    #   "closed_count": int | None,
    #   "national_avg": float | None,
    #   "comparison": "lower" | "similar" | "higher" | None,
    #   "category": str,
    #   "region": str,
    # }
    # 결과를 24h 캐시에 저장 후 반환
```

### `startup.py` 추가 엔드포인트

```python
GET /api/startup/closure-rate/{category}/{region}
Depends(get_current_user)  # startup 플랜+ 확인
  → localdata_api.get_closure_rate(category, region) 호출
  → plan gate: PLAN_LIMITS[plan].get("startup_report") 재사용(신규 플랜 키 불필요)
  → 응답: get_closure_rate() 반환값 그대로 pass-through
```

### `StartupReport` 인터페이스 추가 필드 (TypeScript)

```typescript
closure_rate?: {
  available: boolean;
  reason?: string;
  closure_rate?: number;
  active_count?: number;
  closed_count?: number;
  national_avg?: number | null;
  comparison?: "lower" | "similar" | "higher";
}
```

### `StartupClient.tsx` 흐름

리포트 POST와 closure-rate GET을 `Promise.all`로 병렬 실행(리포트 생성은 수십 초 걸리지만 폐업율은 즉시 응답 가능하므로 병렬이 적합):

```
setLoading(true)
→ Promise.all([
    fetch("/api/startup/report"),
    fetch("/api/startup/closure-rate/{category}/{region}")
  ])
→ setReport({ ...reportData, closure_rate: closureData })
```

## 구현 순서

1. **서버 `.env` 추가** — `LOCALDATA_API_KEY=<값>` (사용자 직접, 구현 시작 전 확인 필요)
2. `backend/services/localdata_api.py` 신규 작성 — ENDPOINT_MAP 상수, `_fetch_count()` + `get_closure_rate()`, 24h 캐시 + graceful fallback 완비
3. `backend/routers/startup.py` — GET 엔드포인트 추가 + startup plan gate
4. `frontend/.../StartupReportView.tsx` — `closure_rate` 필드 타입 추가 + 기존 "시장 현황" 섹션 안(시장 규모 블록과 경쟁사 준비도 블록 사이)에 폐업율 서브블록 렌더링 추가(신규 섹션 아님)
5. `frontend/.../StartupClient.tsx` — Promise.all 병렬 fetch + `closure_rate` 상태 병합
6. 서버 배포 + 라이브 QA(startup 플랜 계정으로 restaurant/서울 강남구 실측)
7. CLAUDE.md 완료 이력 업데이트

## 비용 영향

| 항목 | 내용 |
|------|------|
| data.go.kr API | 무료, 10,000회/일 한도 |
| BEP 20명 기준 실소비 | 최악 40회/일(한도의 0.4%) |
| AI API 추가 호출 | 없음(Claude·Gemini·ChatGPT 비관여) |
| 서버 추가 부담 | 없음(aiohttp 비동기, 인메모리 캐시) |
| 월 추가 비용 | **0원** |

## 플랜 제한

`PLAN_LIMITS[plan].get("startup_report")` 조건 재사용. startup/biz/enterprise만 `True`. 별도 플랜 제한 항목 신설 불필요 — "창업 시장 분석" 기능 접근권을 이미 구분하는 기존 키를 공유.

## 주의사항 (구현 시 반드시 확인)

- **`bar` 카테고리**: `general_restaurants` 엔드포인트에 `cond[BZSTAT_SE_NM::LIKE]=호프` 추가 파라미터 필요. `_fetch_count()` 시그니처에 `bzstat_filter` 옵션 파라미터로 처리.
- **`beauty_salons` 타임아웃**: 조사 문서에서 실측 30초+ 타임아웃 확인됨. `aiohttp.ClientTimeout(total=70)` 적용 필수.
- **`LOTNO_ADDR::LIKE` 매칭**: `businesses.region`이 `"서울 강남구"` 같은 축약형이면 `"서울특별시 강남구"`와 불일치할 수 있음. SBIZ의 `_geocode_region()`(Kakao 정규화 주소) 재사용이 안전하나, 폐업율 API는 `businesses` 테이블과 직접 연관 없는 독립 조회라 region 원본 문자열을 그대로 씀 — 서비스 파일 상단에 "시도명까지 포함한 완전 문자열 필요" 주석 필수. 사용자 입력 region이 짧을 경우(예: "강남") 백엔드에서 Kakao geocoding으로 정규화하는 방안은 Phase 2 이후 검토.
- **커버 불가 업종**(요가/필라테스·스터디카페·클라이밍·방탈출): `available: false`로 조용히 반환, 프론트에서 섹션 자체를 숨김. "인허가 데이터 없음" 에러 메시지 띄우지 않음 — 없는 게 정상이고 다른 섹션(SBIZ·타이밍)으로 충분히 보완됨.
- **전국 평균 하드코딩**: 초기 구현 시 restaurant(70.5%) 외 업종은 `national_avg: null`. 구독자 확보 후 전국 조회로 실측 채우는 걸 후속 과제로 남김.

## 이번 세션에서 함께 발견·수정된 관련 사항 (참고용)

- **`naver_searchad.py` 배치 버그 수정·배포 완료(git `a348a4c`, `f5f7be7`)** — 네이버 SearchAd API `hintKeywords`가 5개 초과 시 조용히 빈 결과 반환하던 버그. 이 폐업율 기능과 직접 관련은 없으나 같은 세션에서 발견·수정됨. 재작업 불필요.
