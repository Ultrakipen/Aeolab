"""네이버 플레이스 "서비스 이용이 제한되었습니다" 차단 화면 감지 (공용).

2026-10-27: 기존 감지는 `"플레이스 서비스 이용이 제한" in text` 한 줄 문자열 비교였는데, 실제 차단 화면은
    플레이스
    서비스 이용이 제한되었습니다.
    과도한 접근 요청으로 서비스 이용이 제한되었습니다.
    잠시 후 다시 시도해주세요.
    IP: x.x.x.x(...)
처럼 "플레이스"와 "서비스 이용이…"가 줄바꿈으로 나뉘어 매칭되지 않았다. 그 결과 차단 화면이 정상 내용으로 읽혀
차단된 동안의 측정값(소개글 없음 등)이 "측정됨"으로 기록될 수 있었다.

가게 소개글 같은 정상 본문에 "서비스 이용이 제한"이 들어 있어도 차단으로 오인하지 않도록, 짧은 화면이거나
"과도한 접근/잠시 후 다시 시도" 안내가 함께 있을 때만 차단으로 본다.
"""
from __future__ import annotations

import re
from typing import Optional

_BLOCK_RE = re.compile(r"서비스\s*이용이\s*제한")
_COMPANION_RE = re.compile(r"과도한\s*접근|잠시\s*후\s*다시\s*시도")
_SHORT_PAGE_LEN = 1500


def is_naver_block_page(text: Optional[str]) -> bool:
    if not text or not _BLOCK_RE.search(text):
        return False
    return len(text) < _SHORT_PAGE_LEN or bool(_COMPANION_RE.search(text))


_SEARCH_BLOCK_TEXT_RE = re.compile(r"로봇이 아님|자동화된 요청|비정상적인 접근|보안 문자")


def is_naver_search_block(url: Optional[str], title: Optional[str], text: Optional[str]) -> bool:
    """네이버 검색 화면의 CAPTCHA·로그인 리다이렉트·비정상 접근 안내 감지 (2026-10-28 공용화).

    services/ai_scanner/naver_scanner._check_single_page 의 감지 규칙과 같다 — URL(captcha·nid·login), 제목(로봇 등),
    본문 앞 500자(안내 문구). 정상 검색 결과 본문 깊은 곳의 우연한 문구는 보지 않는다.
    """
    url, title, text = url or "", title or "", text or ""
    return (
        any(k in url for k in ("captcha", "nid.naver.com", "login.naver.com"))
        or any(k in title for k in ("로봇", "자동화", "captcha", "CAPTCHA", "보안문자"))
        or bool(_SEARCH_BLOCK_TEXT_RE.search(text[:500]))
    )
