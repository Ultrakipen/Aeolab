"""
/api/bizinfo — 기업마당 지원사업 공고·행사 (비로그인 공개)

기업마당(중기부) 공개 API를 수집 스크립트가 하루 한 번 스냅샷 파일로 만들어 두고, 방문자 요청은 그 파일만 읽는다.
외부 API와 Supabase를 부르지 않는다. (기존 /api/support 는 문의 게시판 — 이름이 겹치지 않게 bizinfo 로 둔다)
"""
from fastapi import APIRouter

from services.bizinfo import public_view

router = APIRouter()


# public — 비로그인 공개 엔드포인트 (의도적, 공공 지원사업 공고 목록 — 개인정보 없음)
@router.get("")
async def bizinfo_list():
    return public_view()
