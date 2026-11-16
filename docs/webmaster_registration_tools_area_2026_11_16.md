# 사장님 계산기·우리 동네 상권 — 구글 서치콘솔·네이버 서치어드바이저 등록 자료 (2026-11-16)

> 이 문서는 두 신규 기능(`/tools`, `/area`)을 검색에 노출시키기 위해 **웹마스터 도구에 입력·제출할 값**을 모은 것이다.
> 값은 모두 2026-11-16 공개 사이트(`https://aeolab.co.kr`)에서 직접 확인했다(아래 "확인 방법" 참고). 색인 시점·순위는 검색엔진이 정하며 보장할 수 없다.

## 0. 먼저 알아둘 현황

| 항목 | 상태 | 근거 |
|------|------|------|
| 네이버 서치어드바이저 사이트 등록·사이트맵 제출 | **완료**(2026-08-07, 사용자) | CLAUDE.md "남은 작업" · `frontend/public/naver90ab854379ebb072c6795b390f874ac8.html` |
| 구글 서치콘솔 소유권 확인 파일 | 배포되어 있음: `frontend/public/googlee6dcefbd686e7216.html` | **서치콘솔에 실제 등록돼 있는지는 미확인(사용자 확인 필요)** |
| 사이트맵 | `https://aeolab.co.kr/sitemap.xml` — 사이트맵에 `/tools` 7개 + `/area` 허브 + 수집이 끝난 지역·업종 상세가 들어 있음 | 2026-11-16 16:50 기준 전체 420개 URL, 그중 `/area/…` 상세 308개 |
| robots.txt | `/tools`, `/area` 모두 허용(차단 규칙 없음), `Sitemap:` 줄 있음 | `https://aeolab.co.kr/robots.txt` |

→ **새로 사이트를 등록할 필요는 없다.** 이미 등록된 사이트에서 "사이트맵 다시 읽기"와 "핵심 URL 수집(색인) 요청"만 하면 된다.

## 1. 제출 주소

- 사이트맵: `https://aeolab.co.kr/sitemap.xml` (서치콘솔은 `sitemap.xml`, 서치어드바이저는 전체 주소)
- `/area` 상세 URL은 **공공데이터 수집이 끝난 조합만** 사이트맵에 자동 추가된다(수집이 진행 중이라 계속 늘어남. 사이트맵은 최대 하루 뒤 반영). 수집 안 된 조합은 `noindex`이고 사이트맵에도 없다 — 이것은 의도된 동작이다.

## 2. 수집(색인) 요청 우선순위 URL

사이트맵에 의존하되, 아래 핵심 URL은 직접 요청한다(구글: URL 검사 → 색인 생성 요청 / 네이버: 웹 페이지 수집 요청). 일일 요청 한도는 각 도구 화면의 안내를 따른다(수치는 미확인).

**1순위 (허브·계산기, 매일 한도 안에서 모두)**

1. `https://aeolab.co.kr/tools`
2. `https://aeolab.co.kr/tools/break-even`
3. `https://aeolab.co.kr/tools/delivery-settlement`
4. `https://aeolab.co.kr/tools/labor-cost`
5. `https://aeolab.co.kr/tools/vat`
6. `https://aeolab.co.kr/area`
7. `https://aeolab.co.kr/tools/ad-cost-calculator`
8. `https://aeolab.co.kr/tools/keyword`

**2순위 (상권 상세 — 수집이 끝난 대표 지역, 일부만)**

- `https://aeolab.co.kr/area/서울-강남구/cafe` (주소창에 입력하면 인코딩되어 `%EC%84%9C…`로 바뀜. 도구에는 그대로 붙여 넣어도 됨)
- `https://aeolab.co.kr/area/서울-강남구/restaurant`
- `https://aeolab.co.kr/area/서울-강남구/pharmacy`
- 이후 수집이 끝난 서울·경기 지역의 음식점·카페 페이지(수집 현황은 서버 `--status`로 확인).

> 4·7·8번처럼 `ad-cost-calculator`, `keyword`는 기존 페이지다. **오늘(11-16) 대표 주소(canonical)가 홈으로 잘못 지정된 것을 고쳤으므로 반드시 다시 수집 요청**해야 한다(§4 참고).

## 3. 페이지별 입력값(제목·설명·대표 주소) — 공개 사이트에서 확인한 값

| URL | 제목(title) | 대표 주소(canonical) | 색인 |
|-----|-------------|----------------------|------|
| `/tools` | 사장님 계산기 — 손익분기점·배달 실수령·인건비·부가세 \| AEOlab | `/tools` | index |
| `/tools/break-even` | 손익분기점·마진율 계산기 \| AEOlab 사장님 계산기 | `/tools/break-even` | index |
| `/tools/delivery-settlement` | 배달앱 실수령액 계산기 \| AEOlab 사장님 계산기 | `/tools/delivery-settlement` | index |
| `/tools/labor-cost` | 직원 인건비 계산기(주휴수당·4대보험) \| AEOlab 사장님 계산기 | `/tools/labor-cost` | index |
| `/tools/vat` | 부가세 계산기(일반·간이과세) \| AEOlab 사장님 계산기 | `/tools/vat` | index |
| `/tools/ad-cost-calculator` | 광고비 vs 구독료 비교 \| AEOlab | `/tools/ad-cost-calculator` | index |
| `/tools/keyword` | 무료 키워드 생성기 \| AEOlab | `/tools/keyword` | index |
| `/area` | 우리 동네 상권 — 지역·업종별 업소 수와 폐업 현황 \| AEOlab | `/area` | index |
| `/area/<지역>/<업종>` | `<지역> <업종> 상권 현황 \| AEOlab` (예: 서울 강남구 카페 상권 현황) | 자기 주소 | **값이 있으면 index, 없으면 noindex** |

- 설명(description)과 공유 미리보기(OG: 제목·설명·주소·이미지)도 페이지마다 따로 지정됨. 이미지는 `https://aeolab.co.kr/opengraph-image`(1200×630) 공통.
- 구조화 데이터(JSON-LD): 계산기 4종에 `WebApplication`(무료 `Offer`)·`BreadcrumbList`, 상권 상세에 `BreadcrumbList`. 사이트 공통으로 `Organization`·`WebSite`도 들어 있음.
- 상권 지원 업종 11개: 음식점·카페·제과점·주점·숙박·미용실·네일·피부관리·약국·안경점·당구장. 지원하지 않는 업종 주소는 404.

## 4. 오늘 고친 검색 노출 문제(등록 전에 반드시 알아둘 것)

1. **대표 주소 오류**: `/tools/ad-cost-calculator`, `/tools/keyword`의 `canonical`이 홈(`https://aeolab.co.kr`)으로 지정돼 있어 검색엔진이 두 페이지를 "홈의 복사본"으로 보고 독립 색인을 하지 않을 수 있었다 → 각자 주소로 수정·서버 반영.
2. **공유 미리보기 오류**: 계산기·상권 페이지를 공유하면 제목·주소가 모두 홈 정보(`og:url=홈`)로 나오고, 상권 상세는 이미지가 없었다 → 페이지별 제목·주소·이미지 지정(`frontend/lib/seoMeta.ts`).
3. **사이트맵 날짜**: 상권·계산기 URL의 `lastmod`가 실제 공개일(2026-11-16)보다 이른 날짜였다 → 공개일로 수정.
→ 위 수정은 2026-11-16 16:49 서버 반영, 공개 주소에서 모든 값 확인.

## 5. 등록 절차(요약)

**구글 서치콘솔** (`https://search.google.com/search-console`)
1. 속성(사이트)이 `https://aeolab.co.kr`(또는 도메인 속성)으로 등록돼 있는지 확인 — 없으면 URL 접두어 속성으로 추가하고 HTML 파일 방식(`googlee6dcefbd686e7216.html`)으로 소유권 확인.
2. 좌측 "Sitemaps"에서 `sitemap.xml`이 "성공"인지 확인(없으면 추가). 새 URL은 자동 반영되므로 매번 다시 제출할 필요는 없음.
3. 상단 검색창에 §2의 URL을 하나씩 붙여 넣어 "URL 검사" → 결과가 "URL이 Google에 등록되어 있지 않음"이면 "색인 생성 요청". 대표 URL(canonical)이 자기 주소로 표시되는지 확인.
4. 1~2주 뒤 "페이지" 보고서에서 `/tools/…`, `/area/…`의 상태("색인 생성됨"/"크롤링됨 - 현재 색인이 생성되지 않음" 등)를 확인.

**네이버 서치어드바이저** (`https://searchadvisor.naver.com`)
1. 이미 등록된 사이트(`https://aeolab.co.kr`) 선택.
2. "요청 > 사이트맵 제출"에서 `https://aeolab.co.kr/sitemap.xml` 상태 확인(이미 제출돼 있으면 "다시 제출"로 갱신).
3. "요청 > 웹 페이지 수집"에서 §2의 URL을 하나씩 수집 요청.
4. "검증 > robots.txt"에서 `/tools`, `/area`가 허용인지 확인하고, "분석 > 사이트 최적화"에서 오류가 없는지 확인.

## 6. 검색 유입이 기대되는 키워드(콘텐츠 점검용 — 순위를 보장하지 않음)

- 계산기: "손익분기점 계산기", "마진율 계산", "배달앱 수수료 계산", "배달앱 실수령액", "직원 인건비 계산기", "주휴수당 계산", "간이과세 부가세 계산", "부가세 계산기"
- 상권: "OO구 카페 폐업률", "OO구 음식점 몇 개", "우리 동네 상권 분석"
- 검색 노출이 시작되면 서치콘솔 "실적"·서치어드바이저 "검색 분석"에서 위 검색어의 노출·클릭을 확인해 제목·설명을 다듬는다.

## 7. 주의·미확인

- **상권 상세 페이지는 지역·업종만 바꾼 비슷한 구조**다. 데이터(업소 수·폐업률)가 지역마다 달라 독립 콘텐츠이지만, 검색엔진이 "품질이 낮다"고 보고 "크롤링됨 - 색인 안 됨"으로 둘 수 있다. 1~2개월 뒤 색인 비율을 보고 설명 문구·내부 링크를 보강할지 판단한다(현재 이런 판단 자료는 없음).
- **수집이 끝나기 전**에는 상권 URL이 점차 늘어나는 구조라 서치콘솔에서 "발견됨"과 "색인됨" 수가 한동안 어긋나는 것이 정상이다.
- 구글 서치콘솔 등록 여부, 서치어드바이저의 현재 수집 요청 한도·사이트맵 처리 상태는 **직접 로그인해야 알 수 있어 미확인**이다.
- 계산기 결과는 참고용 추정이며(세무·노무 상담 대체 아님), 기준값 출처·확인일이 페이지에 표시된다. 2026년 12월 말에 2027 보험료율 갱신 필요(`docs/owner_calculators_2026_11_16.md`).

## 8. 확인 방법(재현)

- 헤드 값: `curl -s https://aeolab.co.kr/<경로>`에서 `<title>`, `<link rel="canonical">`, `<meta name="robots">`, `og:*` 확인.
- 사이트맵: `curl -s https://aeolab.co.kr/sitemap.xml | grep -c "<loc>"`.
- 수집된 지역 수: 서버 `backend/`에서 `PYTHONPATH=. ../venv/bin/python scripts/area_collect.py --status`.
