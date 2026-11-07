"""네이버 통합검색 '플레이스 목록'(상단 가게 카드 리스트)에서 가게 이름을 읽고 내 가게의 순위를 판정한다.

배경(2026-11-07 실측): `naver_scanner.PLACE_SELECTORS` 10개가 PC 검색 화면에서 전부 0개였고, 운영 DB의 최근 측정 성공 행에서
`rank`가 채워진 것은 3건뿐이었다. 실제 목록은 난독화 클래스(`li.UEzoS`, 이름 `span.TYaxT`)에 링크가 `map.naver.com/p/search`다.
클래스 이름은 네이버가 바꿀 수 있으므로 여기서는 **구조**로 읽는다: 목록 항목(`li`) 안의 첫 번째 가게 링크(`a[role=button]`,
href에 `map.naver.com/p/search` 또는 `place.naver.com`) 안의 첫 텍스트가 이름이다.

이 모듈은 아직 스캐너·점수에 연결되지 않았다(점수 의미 변경은 사용자 결정 후). 설계 원칙:
- 목록을 하나도 못 읽으면 '미노출'이 아니라 `list_found=False`(측정 불가) — error ≠ false (지침 8번).
- 이름 일치는 보수적이다: 공백·특수문자 제거 후 같거나, '본점·본사·(주)'만 떼고 같을 때만. 지점명이 다르면 불일치,
  '홍스튜디오'가 '더홍스튜디오'에 맞는 부분 일치 오탐을 만들지 않는다.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

_PLACE_HREF = ("map.naver.com/p/search", "place.naver.com", "m.place.naver.com")
_VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr", "area", "base", "col", "embed", "param", "track"}


def normalize_name(text: str) -> str:
    return re.sub(r"[\s\-_·&·()（）]", "", text or "").lower()


def core_name(text: str) -> str:
    """등록명에만 붙기 쉬운 '본점·본사·(주)'만 뗀 이름. 지점 이름(…마산점)은 떼지 않는다."""
    t = re.sub(r"\(주\)|㈜|주식회사", "", text or "")
    t = re.sub(r"(본점|본사)", "", t)
    return normalize_name(t)


class _PlaceListParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.names: list[str] = []
        self._li_depth = 0
        self._tag_stack: list[str] = []
        self._item_done = False
        self._in_anchor = False
        self._anchor_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in _VOID:
            return
        self._tag_stack.append(tag)
        a = dict(attrs)
        if tag == "li":
            self._li_depth += 1
            if self._li_depth == 1:
                self._item_done = False
        elif tag == "a" and self._li_depth >= 1 and not self._item_done and not self._in_anchor:
            href = a.get("href") or ""
            if a.get("role") == "button" and any(h in href for h in _PLACE_HREF):
                self._in_anchor = True
                self._anchor_depth = len(self._tag_stack)
                self._chunks = []

    def handle_endtag(self, tag):
        if tag in _VOID:
            return
        # 닫는 태그가 안 맞아도 깨지지 않게 스택에서 가장 가까운 같은 태그까지 되감는다
        if tag in self._tag_stack:
            while self._tag_stack:
                top = self._tag_stack.pop()
                if top == "li":
                    self._li_depth = max(0, self._li_depth - 1)
                if self._in_anchor and len(self._tag_stack) < self._anchor_depth:
                    self._finish_anchor()
                if top == tag:
                    break

    def _finish_anchor(self):
        self._in_anchor = False
        for c in self._chunks:
            c = c.strip()
            if c:
                self.names.append(c)
                self._item_done = True
                break
        self._chunks = []

    def handle_data(self, data):
        if self._in_anchor:
            self._chunks.append(data)


def extract_place_names(html: str) -> list[str]:
    """목록 항목 순서대로 가게 이름을 돌려준다. 하나도 못 읽으면 빈 리스트."""
    if not html:
        return []
    p = _PlaceListParser()
    try:
        p.feed(html)
        p.close()
    except Exception:
        return []
    return p.names


def names_match(target: str, shown: str) -> bool:
    """등록명(target)과 네이버 표시명(shown)이 같은 가게인지 — 보수적 규칙."""
    a, b = normalize_name(target), normalize_name(shown)
    if not a or not b:
        return False
    if a == b:
        return True
    ca, cb = core_name(target), core_name(shown)
    return bool(ca) and ca == cb


# 이미 열려 있는 페이지의 DOM만 읽는다(추가 네이버 요청 없음). 스크립트·이미지·불필요 속성은 제거해 크기를 줄인다.
PLACE_LIST_HTML_JS = """() => {
  const ok = h => /map\\.naver\\.com\\/p\\/search|place\\.naver\\.com/.test(h || '');
  const a = [...document.querySelectorAll('li a[role="button"]')].find(x => ok(x.href));
  if (!a) return '';
  const li = a.closest('li');
  const list = li && li.parentElement;
  if (!list) return '';
  const c = list.cloneNode(true);
  c.querySelectorAll('script,style,img,svg,source,picture').forEach(e => e.remove());
  c.querySelectorAll('*').forEach(e => { [...e.attributes].forEach(t => { if (t.name !== 'href' && t.name !== 'role') e.removeAttribute(t.name); }); });
  return c.outerHTML;
}"""

SHADOW_MAX_HTML = 1_500_000
SHADOW_MAX_NAMES = 10


async def shadow_place_list(page, target: str) -> dict:
    """플레이스 목록 판정을 '섀도'로만 기록한다 — 점수·mentioned·rank 어디에도 쓰지 않는 추가 필드.

    절대 예외를 내지 않는다(측정 본 경로를 막지 않기 위해). 반환 필드:
      place_list_found  True=목록을 읽음 / False=페이지에 목록이 없거나 못 읽음 / None=읽는 중 오류
      place_list_rank   목록 안 순위(없으면 None) — found가 True일 때만 '목록 밖'의 의미
      place_list_names  읽은 이름 앞 10개(대조·디버그용)
    """
    try:
        html = await page.evaluate(PLACE_LIST_HTML_JS)
        if not isinstance(html, str):
            return {"place_list_found": None, "place_list_rank": None, "place_list_names": []}
        if len(html) > SHADOW_MAX_HTML:
            html = ""
        j = judge_place_list(html, target)
        return {
            "place_list_found": bool(j["list_found"]),
            "place_list_rank": j["rank"],
            "place_list_names": j["names"][:SHADOW_MAX_NAMES],
        }
    except Exception:
        return {"place_list_found": None, "place_list_rank": None, "place_list_names": []}


def judge_place_list(html: str, target: str, limit: int = 15) -> dict:
    """{"list_found": 목록을 읽었는가, "rank": 1부터의 순위 또는 None, "names": 읽은 이름 앞 limit개}.

    list_found=False 이면 rank=None 은 '목록 밖'이 아니라 '확인하지 못함'이다.
    """
    names = extract_place_names(html)[:limit]
    if not names:
        return {"list_found": False, "rank": None, "names": []}
    for i, n in enumerate(names):
        if names_match(target, n):
            return {"list_found": True, "rank": i + 1, "names": names}
    return {"list_found": True, "rank": None, "names": names}
