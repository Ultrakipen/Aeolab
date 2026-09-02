# 네이버 개발자센터 API → NAVER API Hub(NCP) 이관 대응

> 2026-07-15 1차 공지 메일 수신 → 2026-08-13 더 상세한 공지로 갱신 → **2026-09-02 마이그레이션 완료(라이브 전환 완료, git `41f3c01`+`aa38a1f`)**. 재작업 불필요.

## 0. 완료 요약 (2026-09-02)

**완료**: 10개 파일(11개 호출처)의 `openapi.naver.com` 직접 호출을 `backend/services/naver_api_hub.py` 공용 헬퍼로 전부 배선. NCP 콘솔에서 발급받은 키(`NAVER_APIHUB_CLIENT_ID`/`SECRET`)를 서버 `.env`에 반영하고 `NAVER_API_HUB_ENABLED=true`로 전환 완료 — 프로덕션이 현재 NAVER API Hub 경유로 동작 중.

**공식 문서 실측 확인** (api.ncloud-docs.com):
- 도메인: `naverapihub.apigw.ntruss.com`, 경로: `/search/v1/{local,blog,cafearticle,kin,news}` (GET, `.json` 없음) + `/search-trend/v1/search` (POST)
- 헤더: `X-NCP-APIGW-API-KEY-ID`/`X-NCP-APIGW-API-KEY`
- 응답 스키마(items 필드명)는 레거시와 동일, mapx/mapy도 WGS84×1e7 그대로 — **라이브 실측으로 확정**(서울 강남 좌표 `127.0274938, 37.4996548` 정상 변환 확인)

**전환 중 발견·수정한 실전 이슈 2건 (문서만으론 알 수 없었던 것)**:
1. **Content-Type 불일치** — Hub가 200 OK인데도 `Content-Type: text/plain;charset=utf-8`로 응답해 `aiohttp`의 `.json()`이 `ContentTypeError`로 실패 → 모든 네이버 호출이 조용히 fallback 처리되는 회귀가 실제 라이브에서 발생. 16개 NAVER 관련 `.json()` 호출에 `content_type=None` 추가로 수정(Kakao/Google/국세청 등 무관 API는 미터치). **최초 플립 직후 잠깐 실운영에 영향 있었음 — 즉시 플래그 OFF로 롤백 후 수정·재검증·재플립**(영향 시간 약 5분 이내)
2. **"뉴스" 카드 미승인** — 발급된 키가 원 이관대상 5개 카드(블로그·지역·지식iN·카페·검색어트렌드)만 커버, `naver_visibility.py`가 쓰는 `news` 엔드포인트는 401. `news`는 플래그 상태와 무관하게 레거시(`openapi.naver.com`) 경로를 강제하도록 예외 처리 — 뉴스 카드가 NCP 콘솔에서 추가 활성화되면 `naver_api_hub.py`의 `_HUB_UNSUPPORTED_KINDS`에서 제거하면 됨(현재는 굳이 안 해도 무방, 레거시가 2027-06-30까지 유효)

**잔여**: 없음. 뉴스 카드 활성화는 선택사항(레거시로도 마감 전까지 문제없이 동작).

## 1. 공지 원문 요약 (네이버 개발자센터, 2026-08-13 재확인)

이관 대상 3종 API:
- Search API (검색 API)
- Search Trend API (검색어트렌드)
- Shopping Insight API (쇼핑 인사이트)

**이관 제외 API (별도 하드 마감, 유예 없음):**
- 검색 API 중 **'쇼핑·책·전문자료' 검색**은 NAVER API Hub 이관 대상에서 **제외**되며 **2026-07-31 전면 종료** (공지: https://developers.naver.com/notice/article/32564)
- 유예 기간 적용 안 됨 — 2026-07-31 이후 기존 발급 키 포함 호출 전면 불가, 대체 API 제공 없음

일정 (3단계):
1. **2026-06-25**: NAVER API Hub 정식 출시 (NCP)
2. **2026-07-31**: 개발자센터 내 대상 3종 API **신규 신청** 차단
3. **2027-06-30**: 개발자센터 내 대상 3종 API **지원 종료(Fade-out)** — 이후 NAVER API Hub에서만 이용 가능

유예 기간: 2026-07-31 이전에 신청한 3개 API는 2027-06-30까지 개발자센터에서 계속 사용 가능. **서비스 종료일(2027-06-30) 이후에는 기존 발급 키도 차단**됨. 네이버 아이디 로그인·네아로(로그인 연동) API는 이번 이관과 무관, 차단되지 않음.

NAVER API Hub 특장점(향후 마이그레이션 시 참고): 종량제 기반 확장 요금제(현재는 한시적 무료 요금제만 지원, 유료 요금제는 추후 도입) / 여러 API의 사용량·권한·비용 통합 콘솔 관리 / 발급 키 1개로 멀티 API 연동(향후 추가되는 API도 별도 절차 없이 즉시 이용 가능).

## 2. AEOlab 적용 판단

AEOlab의 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`는 기존에 이미 발급된 키 → 2단계(신규신청 차단)와 무관, **3단계(2027-06-30 지원 종료)가 실제 마감**.

**이관 제외 API(쇼핑·책·전문자료 검색, 2026-07-31 하드 종료)는 AEOlab 미사용 확인** — §3 재확인 결과 local/blog/cafearticle/kin/datalab 외 엔드포인트(`shop.json`, `book.json`, `doc.json` 등) 호출 0건. 이 하드 마감은 우리와 무관.

**→ 결론: 지금(2026-08-13) 수정 불필요. 2027-06-30 이전에만 마이그레이션 완료하면 됨. 2026-07-31 신규신청 차단·쇼핑/책/전문자료 하드종료 둘 다 AEOlab에 영향 없음.**

## 3. AEOlab 사용 현황 (2026-07-15 코드 전수 grep 확인, 2026-08-13 재확인)

| API | 사용 여부 | 엔드포인트 | 사용 파일 |
|---|---|---|---|
| **Search API** | ✅ 사용 중 (핵심) | `openapi.naver.com/v1/search/{local,blog,cafearticle,kin}.json` | `backend/routers/business.py`, `backend/routers/business_search.py`, `backend/routers/competitor.py`, `backend/services/blog_analyzer.py`, `backend/services/competitor_place_crawler.py`, `backend/services/naver_visibility.py`, `backend/services/ai_scanner/naver_cafe_scanner.py`, `backend/services/ai_scanner/naver_jisik_scanner.py`, `backend/routers/scan.py` |
| **Search Trend API (DataLab)** | ✅ 사용 중 | `openapi.naver.com/v1/datalab/search` | `backend/services/naver_datalab.py` |
| **Shopping Insight API** | ❌ 미사용 | — | 코드 전체 검색 결과 없음 |

**무관 시스템**: `NAVER_SEARCHAD_*`(검색광고 키워드도구 API, `searchad.naver.com` 별도 발급) — 이번 이관 공지와 무관, 마이그레이션 대상 아님.

## 3-1. NAVER API Hub 카탈로그 실제 화면 (사용자 제공 스크린샷, 2026-08-13 확인)

공지 문구는 "Search API" 1종처럼 표현하지만, 실제 API Hub 카탈로그는 **검색 하위 기능별로 개별 API 카드**로 나뉘어 있고 각각 별도 요금안내·개발가이드 링크가 붙어 있음:

- **NAVER 검색** 카테고리: 뉴스 / **블로그**(NAVER Search Blog API) / **지역**(NAVER Search Local API) / **지식iN**(NAVER Search Kin API) / **카페**(NAVER Search Cafe API) / 백과사전 / 이미지 / 성인 검색어 판별 / 오타변환 / 웹문서 — 개별 카드
- **Data Lab** 카테고리: 쇼핑인사이트(Data Lab Shopping Insight API) / **검색어트렌드**(Data Lab Search Trend API) — 개별 카드

→ AEOlab이 실제 마이그레이션할 대상은 이 중 **블로그·지역·지식iN·카페·검색어트렌드 5개 카드**(§3 표와 1:1 대응). "하나의 발급 키로 멀티 API" 안내(§1)상 키 발급 자체는 1회로 될 가능성이 높으나, **개별 API마다 콘솔에서 별도로 사용 신청/활성화가 필요할 수 있음** — 마이그레이션 실행 시점에 이 5개 카드 각각의 "요금 안내"·"개발 가이드"를 직접 열어 신청 절차 확인 필요.

## 3-2. API Hub 키 발급 현황 (2026-08-13)

사용자가 NAVER API Hub(NCP 콘솔)에서 신규 Client ID/Secret 1쌍을 **이미 발급받음**. 실제 값은 이 문서(git 추적)에 기록하지 않음 — 로컬 `backend/.env`에 `NAVER_APIHUB_CLIENT_ID`/`NAVER_APIHUB_CLIENT_SECRET`로 별도 보관(기존 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`는 미변경, 현재도 계속 사용 중). 서버 `.env`에는 아직 미반영 — 코드가 이 값을 쓰지 않으므로 실제 마이그레이션 착수 시점에 반영하면 됨.

- ⚠️ 이 발급이 §3-1의 5개 카드(블로그·지역·지식iN·카페·검색어트렌드) 전부를 커버하는지, 아니면 그중 일부만 활성화된 상태인지는 **NCP 콘솔에서 직접 재확인 필요** — 마이그레이션 착수 시 1순위 확인 사항으로 §4-1에 반영.

## 4. 마이그레이션 시 필요 작업 (2027-06-30 이전 완료)

0. **(2026-08-13 완료)** ~~NCP 계정 생성/확인 후 API Hub에서 5개 카드 개별 신청/발급~~ → Client ID/Secret 1쌍 이미 발급됨(§3-2). 착수 시 §3-1 5개 카드 전부 커버 여부만 재확인
1. NCP 계정 생성/확인 후 API Hub에서 **위 5개 카드(블로그·지역·지식iN·카페·검색어트렌드)** 개별 신청/발급
2. 인증 방식 전환: Client ID/Secret → NCP API Key
   - 확인된 일반 패턴(NCP 공식 문서, `api.ncloud-docs.com/docs/common-naverapi-naverapi`): 헤더 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`
   - ⚠️ Search API·DataLab API 개별 엔드포인트 URL이 `openapi.naver.com`에서 그대로 유지되는지, 아니면 신규 도메인으로 바뀌는지는 **이관 실행 시점에 NAVER API Hub 페이지에서 직접 재확인 필요** (2026-07-15 조사 시점 공식 문서에서 API별 세부 스펙 미확인)
3. 위 9개 백엔드 파일(§3 표)의 인증 헤더/키 참조 부분 일괄 수정
4. `.env` 신규 키 반영 → 서버 배포 → PM2 재시작 → 실측 검증(각 스캐너·경쟁사 크롤러·블로그 분석 정상 동작 확인)

## 5. 트리거 문구 (새 대화창)

`docs/naver_api_hub_migration_v1.0.md 기준으로 네이버 API Hub 마이그레이션 진행` — 단, 2027-06-30 이전 아무 때나 진행 가능. 급하지 않음.
