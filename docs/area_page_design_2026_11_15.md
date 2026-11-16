# 우리 동네 상권 (`/area`) — 설계·검증·운영 (2026-11-15)

> 비로그인 공개 페이지. 지역(시군구 256곳)·업종(11개)별 **업소 수**와 **누적 폐업 현황**을 공공데이터로 보여 주고,
> 소상공인365 iFrame(승인 후)과 무료 체험(`/trial`)으로 잇는다. 목적: 불특정 다수 사장님·예비 창업자 유입.
> 상태: **로컬 구현·시험 완료, 서버 미반영, 수집 데이터 0건**(이 문서 §6 순서로 반영).

## 1. 구조 — 방문자 요청은 미리 계산한 값만 읽는다

```
[수집 스크립트 scripts/area_collect.py]  (서버, 야간/수동, 순차 호출)
   data.go.kr 상가정보(sbiz_api) + 인허가(localdata_api) + 카카오 주소검색
        ↓ 지역별 JSON 1개 (업종 전체 포함)
[backend/data/area_snapshots/<슬러그>.json]  (git 제외, 배포로 지워지지 않음)
        ↓ 파일만 읽음(mtime 캐시) — 외부 API·Supabase 호출 없음
[/api/area/*]  →  [Next 페이지 ISR 1시간]  →  방문자
소상공인365 iFrame은 방문자 브라우저가 직접 불러옴(우리 서버 트래픽 0)
```

- 병목 근거: 대시보드는 Supabase 쿼리 큐잉으로 동시 50명에서 붕괴(`dashboard_load_test_and_capacity_v1.0.md`), 백엔드 워커 1개, data.go.kr 초당 제한 실측 이력. 그래서 요청 경로에서 외부·DB 호출 0.
- 네이버(Playwright·검색)에는 접속하지 않는다(작업 지침 8번과 충돌 없음).

## 2. 파일

| 구분 | 파일 |
|---|---|
| 백엔드 | `services/area_data.py`(목록·라벨) · `services/area_regions.json`(공식 시군구) · `services/area_snapshot.py`(읽기/쓰기·응답 규칙) · `routers/area.py`(`/api/area/meta`·`/available`·`/{지역}/{업종}`) · `scripts/area_collect.py`(수집) · `tests/test_area_snapshot.py`(14건) |
| 프런트 | `app/(public)/area/page.tsx`(허브) · `[region]/[category]/page.tsx`(상세) · `AreaPicker.tsx`(시도→시군구→업종) · `SbizIframeTabs.tsx` · `AreaHeader.tsx` · `lib/area.ts` |
| 연결 | `main.py`(라우터 등록) · `app/sitemap.ts`(수집된 조합만) · `components/common/SiteFooter.tsx` · 랜딩 상단 메뉴(`app/page.tsx`, lg 이상) · `next.config.ts`(CSP frame-src) · `.gitignore` |

## 3. 실호출·코드로 확인한 사실 (2026-11-15)

- **지역**: 상가정보 API `baroApi`(resId=dong, catId=mega/cty)로 받은 공식 목록 256곳·16개 시도. 2026 개편 반영 — `전남광주통합특별시`(27), 인천 `검단구`, 대구 `군위군`. 손으로 적은 목록으로는 알 수 없던 부분.
- **업종 코드 이름(공식)**: I201~I207 한식·중식·일식·서양식·동남아·기타 외국·구내식당/뷔페 · I211 주점 · I212 비알코올(카페) · I21001 빵/도넛 · S20701 미용실 · S20702 피부 관리실 · S20703 네일숍 · G21501 약국 · G216 안경·정밀기기 소매 · R10310 당구장 · I1 숙박. 반려동물 `G22001`=애완동물·용품 **소매업**(폐업률 쪽은 동물병원 → 불일치, 제외 유지), 마사지 `S20802`·헬스장 `R10307`도 인허가 정의와 달라 제외.
- **폐업률은 "역대 누적"**이고 업종과 1:1이 아니다(네일·피부=미용업 전체, 제과점=휴게음식점 전체). 전국 평균은 음식점만 있다(70.5%). 화면에 범위 라벨·"연간 폐업률 아님" 안내를 넣었다.
- **DataLab은 지역을 반영하지 않는다**(`naver_datalab.py:59-66` 요청에 region 없음) → 지역 페이지에서 제외.
- **nginx IP 한도(`limit_req`)는 체험 경로에만 있다** → `/api/area`에는 없음. 그래서 `/available`은 5분 결과 캐시, 응답은 파일 읽기뿐, 지역·업종은 고정 목록만 허용(임의 문자열은 404).
- 서버 `crontab`에는 DB 백업(03:00 등)만 있다. 프런트 환경변수 파일은 `/var/www/aeolab/frontend/.env.local`(PM2 cwd `/var/www/aeolab/frontend`).
- 소상공인365 iFrame 명세(간단분석): `https://bigdata.sbiz.or.kr/#/openApi/simple?certKey=키` — 지역·업종 파라미터 없음(iFrame 안에서 재선택), 원천 데이터 비제공.

## 4. 정직 표기 규칙(화면)

0이 아니라 "집계 전" · 업소 수는 원형 범위 근사치+신뢰도(군 단위·일부 조회 실패 시 "적게 집계됐을 수 있음") · 기준월·수집일 · 출처 · 폐업률 "누적" 안내 · 개별 가게 이름 비공개 · 창업·투자 단독 근거 금지 문구 · 값 없는 조합은 `noindex`+사이트맵 제외.

## 5. 제외·보류와 이유

DataLab(지역 불가) · 반려동물·마사지·피트니스(정의 불일치) · 소상공인365 지역 연동(파라미터 없음) · 사전 생성(빌드 때 백엔드 의존·빈 페이지 대량 생성) · 시군구 자유 입력(외부 호출 남용).

## 6. 서버 반영 순서 (사용자 확인 후)

> **순서 주의(11-16 로컬 빌드 실패로 발견):** `/area` 허브는 **빌드 시점에** 백엔드 `GET /api/area/meta`를 호출해 사전 생성된다. 서버 백엔드가 아직 옛 코드(해당 엔드포인트 없음)이거나 내려가 있는 상태에서 프런트를 빌드하면 **빌드가 실패**한다("Error occurred prerendering page /area"). 그래서 이번 변경은 **백엔드를 먼저** 배포한다(`area` 시험은 프런트 소스를 읽지 않으므로 안전; 일반 규칙 "프런트 먼저"의 예외).

1. 백엔드 파일 업로드(`bash scripts/deploy_backend_files.sh` — 신규 파일 포함: `routers/area.py`, `services/area_data.py`·`area_snapshot.py`·`area_regions.json`, `scripts/area_collect.py`, `tests/test_area_snapshot.py`, `main.py`) → 서버 테스트 → 재시작 → `/health` → **`curl localhost:8000/api/area/meta` 200 확인**(빌드 선행 조건)
2. 프런트: **`bash scripts/deploy_area_tools_frontend.sh --env-lines <키 줄 파일>`** (11-16 신설 — 로컬 타입·계산 시험 → 서버 `/api/area/meta` 200 확인 → 수정 파일 서버 md5=HEAD 확인 → 백업 → 업로드(CR 제거) → `.env.local`에 소상공인365 줄 추가(없는 줄만, 값 비출력) → 서버 빌드 → pm2 재시작 → 주소별 응답·404 확인, 실패 시 백업 복원+재빌드). 먼저 `--dry-run`으로 올릴 30개 파일 목록과 env 줄 형식만 확인할 수 있다(서버 접속 없음). 키 줄 파일은 신청 결과 파일(`Desktop/소상공인api.txt`)에서 만들며 저장소 밖에 둔다.
3. 수집 시험·전체 수집·cron은 아래 3~5번.
3. 수집 시험: `cd /var/www/aeolab/backend && PYTHONPATH=. venv/bin/python scripts/area_collect.py --dry-run` → `--only 서울-강남구 --force` → 결과·`--status` 확인. **`전남광주-*`·`인천-검단구`·`대구-군위군`은 카카오·인허가 주소 표기가 새 명칭과 맞는지 미확인** — 건너뜀 보고와 "집계 전"을 보고 판단.
4. 전체 수집(추정 지역당 2~3분, 256곳 약 8~13시간·sbiz 약 4,350회·인허가 약 4,100회로 일일 한도 10,000회 이내 — **추정, 시험에서 보정**): `nohup … --max-regions 256 &` 또는 야간 cron.
5. 정기 갱신 cron(설치는 사용자 확인): `30 3 * * * cd /var/www/aeolab/backend && PYTHONPATH=. venv/bin/python scripts/area_collect.py --max-regions 40 >> /var/log/area_collect.log 2>&1` — 25일 이내 수집분은 건너뛰므로 멱등, 정상 상태에서는 하루 약 10곳.
6. 라이브 확인: PC+모바일에서 허브→선택→상세·`/sitemap.xml`의 `/area` 항목·`noindex` 조합·404.

### 11-16 서버 반영·수집 현황

- **서버 반영 완료(11-16):** 백엔드(`deploy_backend_files.sh`, 서버 테스트 통과·재시작·md5 일치) → 프런트(`deploy_area_tools_frontend.sh`) → 공개 주소 확인(`/area`·`/tools/*` 200, 지원 안 하는 업종 404, 사이트맵 8개 신규 항목, CSP `frame-src`에 소상공인365, 수집 전 상세는 `noindex`). 서버 `.env.local`에 소상공인365 변수 16줄(권한 600), 백업은 `/root/deploy_backups/frontend_20261116_113816`.
- **스크립트 결함 2건을 배포 중 발견·수정:** ①프런트 스크립트가 성공한 빌드를 "실패"로 판정해 자동 롤백(원인: 빌드 성공 문구를 출력 끝 12줄에서 찾음) → 종료 코드로 판정하도록 수정, 롤백 자체는 설계대로 동작해 서버는 원상 복구됐고 서비스 영향 없음 ②없음.
- **수집 시험(서울 강남구 1곳): 220초.** 업소 수 11개 업종 모두 성공, 폐업률은 카페·제과점·주점 실패(첫 실행). 진단: 카페는 재호출 시 성공(일시 장애, 빈 응답), `general_restaurants`(음식점·주점)는 대도시에서 HTTP 504(60초)가 **간헐적**. → 수집기에 **일시 실패 재시도**(폐업률 30초·60초 간격 2회, 업소 수 10초·30초)와 **불완전 지역 재수집**(값이 비어 있으면 20시간 뒤 다음 실행에서 다시, 25일 방치 방지)을 추가해 배포.
- **전체 수집 시작:** 서버에서 `flock -n /var/lock/area_collect.lock env PYTHONPATH=. ../venv/bin/python scripts/area_collect.py --max-regions 256 >> /var/log/area_collect.log` 를 백그라운드(nohup)로 실행. 소요는 지역당 약 2~4분(대도시는 더 김)으로 **수 시간~하루 이상(추정)**. 진행 확인: `cd /var/www/aeolab/backend && PYTHONPATH=. ../venv/bin/python scripts/area_collect.py --status`(수집된 지역 수). 로그는 파이썬 출력 버퍼링으로 종료 때까지 비어 보일 수 있다(정기 실행에는 `PYTHONUNBUFFERED=1`).
- **정기 갱신 cron은 설치하지 못함(서버 상시 작업 변경이 정책상 거부됨) — 사용자 실행 필요:** `crontab -l > /root/crontab_backup_$(date +%Y%m%d)` 로 백업한 뒤 `crontab -e` 로 다음 한 줄 추가 — `30 3 * * * flock -n /var/lock/area_collect.lock bash -c "cd /var/www/aeolab/backend && PYTHONUNBUFFERED=1 PYTHONPATH=. ../venv/bin/python scripts/area_collect.py --max-regions 40 >> /var/log/area_collect.log 2>&1"` (03:00 DB 백업과 겹치지 않음, 초기 전체 수집과도 `flock`으로 겹치지 않음, 정상 상태에서는 25일 지난 지역·값이 빠진 지역만 최대 40곳).
- **초기 수집 후 확인:** `--status` 256/256, 값이 빠진 지역은 다음 실행(또는 cron)이 20시간 뒤부터 다시 시도, 사이트맵·상세 페이지에 데이터 반영은 ISR 때문에 최대 1시간 지연.

### 11-16 후속 개선(로컬 구현·시험 완료)

- **수집 안전장치:** `run_batch`가 값이 하나도 없는 지역을 저장하지 않고 **연속 3곳이면 중단**(종료 코드 3) — 전체 수집이 수 시간이라 키·일일 한도·장애 시 상대 API를 계속 두드리지 않게. 지역 이름 확인 실패(카카오)는 '건너뜀'으로 따로 센다. 시험 16건(변이 검증).
- **iFrame 탭 정리:** 핵심 4개(간단·업종·창업기상도·경쟁분석)만 먼저 보이고 나머지 11개는 "다른 분석 N개 더 보기"로 접는다(전부 접근 가능, 누르기 전에는 iFrame 0개·외부 요청 없음).
- **진입 경로:** 랜딩 광고비 섹션 끝에 `/tools`·`/area` 링크 한 줄(모바일 포함, 섹션 추가 없음), 상단 메뉴 링크는 xl(1280px 이상)에서만(lg에 넣으면 1024px에서 가로 넘침).
- **계측·SEO:** 계산기 사용 이벤트 `calculator_used`(도구당 한 번, 입력값 미전송), 계산기 페이지 구조화 데이터(브레드크럼+웹 앱, `<` 이스케이프 확인).

## 7. 소상공인365 iFrame — 승인 결과(11-16)와 켜는 방법 (코드 수정 불필요)

**승인 결과(11-16 신청 결과 파일):** 15개 서비스 전부 승인, **서비스마다 다른 인증키**(고유 64자), 사용기간 **2026-11-16 ~ 2027-03-31**(약 4.5개월). 키는 이 문서·git·메모리에 적지 않는다(원본: 사용자 바탕화면 `소상공인api.txt`).

**주소 경로(키 제외, 신청 결과 파일 기준):** 간단분석 `simple` · 업종분석 `tpbizAnls` · 창업기상도 `weather` · 경쟁분석 `cmpetAnls` · 배달분석 `delivery` · 입지분석 `locAnls` · 상세분석 `detail` · 상권지도 `startupPublic` · 주요통계 `dashboardSttus` · 인구통계 `dashboardStats` · 업소통계 `dashboardStore` · 매출통계 `dashboardSelng` · 트렌드 분석 `hpReport` · SNS 분석 `snsAnaly` · 관광 축제 정보 `tour` — 형식 `https://bigdata.sbiz.or.kr/#/openApi/<경로>?certKey=<키>`. 코드가 경로를 추측하지 않고 **전체 URL을 환경변수로 받는다**(`SbizIframeTabs.tsx`).

**켜는 방법:**
1. 서버 `/var/www/aeolab/frontend/.env.local`을 백업한 뒤 `NEXT_PUBLIC_SBIZ365_URL_<슬롯>='<전체 URL>'`을 추가. 슬롯: `SIMPLE` `INDUSTRY` `STARTUP_WEATHER` `COMPETITION` `DELIVERY` `LOCATION` `DETAIL` `MAP` `MAIN_STATS` `POPULATION` `STORE_STATS` `SALES_STATS` `TREND` `SNS` `FESTIVAL` + 만료일 `NEXT_PUBLIC_SBIZ365_EXPIRES='2027-03-31'`. 값이 있는 서비스만 탭으로 나타난다(호스트가 `bigdata.sbiz.or.kr`가 아니면 무시). 변환 스크립트로 신청 결과 파일에서 줄을 생성·검증할 수 있다(15개·호스트·키 일치 확인, 키 비출력).
2. `npm run build` → `pm2 restart aeolab-frontend` (NEXT_PUBLIC은 빌드 시 치환).
3. **만료 대비:** 만료일(`NEXT_PUBLIC_SBIZ365_EXPIRES`, 한국 시간 당일 끝) 이후에는 iFrame 영역 전체가 자동으로 숨고 자체 데이터만 남는다. **2027-03-31 전에 소상공인365에서 사용기간을 연장하거나 재신청해 새 키를 받고, URL 값과 만료일을 함께 바꾼다**(일정 알림 필요).

**11-16 로컬 시험(실제 키, 프로덕션 빌드, 로컬 origin):** 간단분석이 우리 페이지 안에서 실제로 렌더링됨(서울 지도·"영역, 위치, 업종 선택" 시트), 우리 CSP 위반 0건(`frame-src` 허용 확인), 소상공인365 응답에 `X-Frame-Options`·`frame-ancestors` 없음, 15개 탭 모두 주소 경로 일치, 14개 탭에서 인증키 검증 호출(`/pub/api/apics/checkApiCertVl`) HTTP 200(업종분석 응답 본문 = 서비스 경로명 `tpbizAnls`). **한계·주의:**
- **15개 중 렌더링을 눈으로 확인한 것은 간단분석 1개뿐**이다. 나머지 14개는 경로·인증키 검증 200까지만 확인했고 화면 렌더링은 미확인.
- 시험 중 연속으로 탭을 여닫은 뒤 **소상공인365가 이 IP의 연결을 끊기 시작**했다(`/ce/sso/status.jsp`가 `ERR_CONNECTION_RESET`, 상대 앱이 실패를 즉시 반복 재시도해 수 초에 수백 건). 새 페이지에서도 같은 증상이어서 시험 중단. **상대 서버·이 PC IP에 대한 일시 제한으로 추정(미확인)** — 재시험은 충분히 쉰 뒤 한 번에 한 탭씩, 연속 시험 금지.
- 상대 앱이 실패 시 매우 빠르게 재시도하므로 방문자 기기에 부하가 갈 수 있다 → 탭을 눌렀을 때만 불러오고(지연 로딩) "화면 닫기" 버튼으로 iFrame을 내릴 수 있게 했다.
- 전체 페이지 캡처(fullPage)는 iFrame 내용을 비워 그린다 — 뷰포트 캡처로 확인할 것(오판 주의).
- 라이브(`aeolab.co.kr`)에서의 동작, 도메인 제한(타 도메인에서 같은 키 사용 가능 여부), 이용 조건(상업 사이트·광고·유료 서비스 병행 노출, 출처 표기 방식)은 미확인 — 소상공인365에 문의.

## 8. 되돌리기

프런트: 직전 빌드로 복원 또는 `/area` 폴더·푸터·랜딩 링크·sitemap 항목 제거 후 재빌드. 백엔드: `main.py`의 `area_router` 두 줄 제거 + 재시작. 데이터: `backend/data/area_snapshots/` 삭제(다른 기능과 무관). iFrame만 끄려면 `.env.local`의 URL 슬롯 삭제+재빌드.

## 9. 미확인·알려진 한계

- 시군구별 실제 수집 성공률(특히 `전남광주통합특별시` 계열 — 인허가 주소가 옛 표기일 수 있음)·카카오 주소검색 결과·일일 한도 잔량·서버 `.env` 키 유효성은 서버 시험 전 미확인.
- 소상공인365: 도메인 제한·접속 한도·이용 조건·프레임 내 이동 도메인·다른 서비스 주소 경로 미확인.
- 임의 가짜 주소 대량 요청 시 404 ISR 캐시 항목이 쌓일 수 있음(요청당 처리는 가볍고 Cloudflare 앞단, nginx 한도 없음) — 필요하면 nginx `limit_req` 추가.
- 업소 수는 반경 근사치(행정구역 경계 아님), 인허가는 지번주소 부분일치(약 0.9% 언더카운트 주석).
- 태블릿(md)은 랜딩 상단 메뉴에 진입 링크가 없고 푸터로만 들어옴(lg 이상에만 표시).
- 재수집 직후 페이지가 최대 1시간 이전 값을 보일 수 있음(ISR).

## 10. 다음 — 사장님 계산기

이 페이지 반영·시험 뒤 별도 문서로 조사(수요·경쟁·정확성 기준·기준값 출처)부터 시작한다. 이미 `/tools/ad-cost-calculator`·`/tools/keyword`가 있으므로 중복·허브 구조를 먼저 정한다.
