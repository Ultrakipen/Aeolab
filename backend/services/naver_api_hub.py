"""
네이버 검색/DataLab API → NAVER API Hub(NCP) 전환 공용 헬퍼.

배경: docs/naver_api_hub_migration_v1.0.md — 개발자센터 기존 API(openapi.naver.com)는
2027-06-30 지원 종료 예정, NAVER API Hub(NCP)로 이관 필요. 이 모듈이 URL·인증 헤더
생성을 단일화해 NAVER_API_HUB_ENABLED 플래그 하나로 전체 호출처(10개 파일)가 동시에
전환되도록 함.

기본값(NAVER_API_HUB_ENABLED 미설정)은 기존 openapi.naver.com 방식 그대로 — 회귀 없음.
전환 절차: NCP 콘솔에서 블로그·지역·지식iN·카페·검색어트렌드 5개 API 카드 활성화 확인 →
NAVER_APIHUB_CLIENT_ID/NAVER_APIHUB_CLIENT_SECRET 발급·설정 → 플래그 ON 전 반드시
실제 API 호출로 응답 스키마(특히 local의 mapx/mapy 좌표 스케일 — 공식 문서 예시가
플레이스홀더뿐이라 WGS84×1e7 유지 여부 미확정) 라이브 검증 → 플래그 ON.

각 호출처의 "키 미설정 시 조기 반환" 가드는 기존 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET를
그대로 확인한다 — 전환 후에도 두 키를 함께 유지하는 것을 전제로 최소 변경만 적용.
"""
import os

_SEARCH_KINDS = {"local", "blog", "cafearticle", "kin", "news"}


def hub_enabled() -> bool:
    return os.getenv("NAVER_API_HUB_ENABLED", "").strip().lower() in ("1", "true", "yes")


def search_request(kind: str) -> tuple[str, dict]:
    """kind: 'local' | 'blog' | 'cafearticle' | 'kin' | 'news' → (url, headers)"""
    assert kind in _SEARCH_KINDS, f"unknown naver search kind: {kind}"
    if hub_enabled():
        cid = os.getenv("NAVER_APIHUB_CLIENT_ID", "")
        csec = os.getenv("NAVER_APIHUB_CLIENT_SECRET", "")
        return (
            f"https://naverapihub.apigw.ntruss.com/search/v1/{kind}",
            {"X-NCP-APIGW-API-KEY-ID": cid, "X-NCP-APIGW-API-KEY": csec},
        )
    cid = os.getenv("NAVER_CLIENT_ID", "")
    csec = os.getenv("NAVER_CLIENT_SECRET", "")
    return (
        f"https://openapi.naver.com/v1/search/{kind}.json",
        {"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": csec},
    )


def datalab_request() -> tuple[str, dict]:
    """검색어트렌드(DataLab Search Trend) API — (url, headers). 요청 바디 형식은 불변."""
    if hub_enabled():
        cid = os.getenv("NAVER_APIHUB_CLIENT_ID", "")
        csec = os.getenv("NAVER_APIHUB_CLIENT_SECRET", "")
        return (
            "https://naverapihub.apigw.ntruss.com/search-trend/v1/search",
            {
                "X-NCP-APIGW-API-KEY-ID": cid,
                "X-NCP-APIGW-API-KEY": csec,
                "Content-Type": "application/json",
            },
        )
    cid = os.getenv("NAVER_CLIENT_ID", "")
    csec = os.getenv("NAVER_CLIENT_SECRET", "")
    return (
        "https://openapi.naver.com/v1/datalab/search",
        {
            "X-Naver-Client-Id": cid,
            "X-Naver-Client-Secret": csec,
            "Content-Type": "application/json",
        },
    )
