# 네이버 개발자센터 API → NAVER API Hub(NCP) 이관 대응

> 2026-07-15 네이버 개발자센터 공지 메일 수신 확인. 지금은 수정 불필요, 2027-06-30 전까지만 마이그레이션 완료하면 됨.

## 1. 공지 원문 요약 (네이버 개발자센터, 수신일 2026-07-15)

이관 대상 3종 API:
- Search API (검색 API)
- Search Trend API (검색어트렌드)
- Shopping Insight API (쇼핑 인사이트)

일정:
1. **2026-06-25**: NCP NAVER API Hub 서비스 오픈
2. **2026-07-31**: 개발자센터 내 대상 API **신규 신청** 중단 (신규 신청자만 해당 — 7/25 이전 신규 발급 고객은 발급일로부터 1년간 기존 환경 사용 가능)
3. **2027-06-30**: 개발자센터 내 대상 API **전면 종료** — 기존 발급 키 호출 전면 차단, 이후 NAVER API Hub로만 이용 가능

인증체계 변경: (기존) 개발자센터 Client ID/Secret → (변경) NCP API Key 방식
요금제: API별 NCP 요금제 기준 (단, Search API는 기존 무료 정책 동일 적용)

## 2. AEOlab 적용 판단

AEOlab의 `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`는 기존에 이미 발급된 키 → 2단계(신규신청 중단)와 무관, **3단계(2027-06-30 전면 종료)가 실제 마감**.

**→ 결론: 지금(2026-07-15) 수정 불필요. 2027-06-30 이전에만 마이그레이션 완료하면 됨.**

## 3. AEOlab 사용 현황 (2026-07-15 코드 전수 grep 확인)

| API | 사용 여부 | 엔드포인트 | 사용 파일 |
|---|---|---|---|
| **Search API** | ✅ 사용 중 (핵심) | `openapi.naver.com/v1/search/{local,blog,cafearticle,kin}.json` | `backend/routers/business.py`, `backend/routers/business_search.py`, `backend/routers/competitor.py`, `backend/services/blog_analyzer.py`, `backend/services/competitor_place_crawler.py`, `backend/services/naver_visibility.py`, `backend/services/ai_scanner/naver_cafe_scanner.py`, `backend/services/ai_scanner/naver_jisik_scanner.py`, `backend/routers/scan.py` |
| **Search Trend API (DataLab)** | ✅ 사용 중 | `openapi.naver.com/v1/datalab/search` | `backend/services/naver_datalab.py` |
| **Shopping Insight API** | ❌ 미사용 | — | 코드 전체 검색 결과 없음 |

**무관 시스템**: `NAVER_SEARCHAD_*`(검색광고 키워드도구 API, `searchad.naver.com` 별도 발급) — 이번 이관 공지와 무관, 마이그레이션 대상 아님.

## 4. 마이그레이션 시 필요 작업 (2027-06-30 이전 완료)

1. NCP 계정 생성/확인 후 API Hub에서 Search API + DataLab API 신규 발급
2. 인증 방식 전환: Client ID/Secret → NCP API Key
   - 확인된 일반 패턴(NCP 공식 문서, `api.ncloud-docs.com/docs/common-naverapi-naverapi`): 헤더 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`
   - ⚠️ Search API·DataLab API 개별 엔드포인트 URL이 `openapi.naver.com`에서 그대로 유지되는지, 아니면 신규 도메인으로 바뀌는지는 **이관 실행 시점에 NAVER API Hub 페이지에서 직접 재확인 필요** (2026-07-15 조사 시점 공식 문서에서 API별 세부 스펙 미확인)
3. 위 9개 백엔드 파일(§3 표)의 인증 헤더/키 참조 부분 일괄 수정
4. `.env` 신규 키 반영 → 서버 배포 → PM2 재시작 → 실측 검증(각 스캐너·경쟁사 크롤러·블로그 분석 정상 동작 확인)

## 5. 트리거 문구 (새 대화창)

`docs/naver_api_hub_migration_v1.0.md 기준으로 네이버 API Hub 마이그레이션 진행` — 단, 2027-06-30 이전 아무 때나 진행 가능. 급하지 않음.
