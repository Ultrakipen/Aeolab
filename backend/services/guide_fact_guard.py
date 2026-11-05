"""가이드 AI 출력의 사실 모순을 결정적으로 걸러낸다 (2026-11-05).

프롬프트 규칙(예시 문장에 확인 안 된 사실 쓰지 말 것 등)만으로는 AI가 지키는 것이 확률적이었다. 같은 가게(어니언 성수)로 가이드를 4번 만들었을 때
"스마트플레이스 등록 (가장 먼저)"(이미 등록된 가게), "첫 리뷰 확보", "소개글 Q&A는 현재 0개"(감지 중단으로 개수를 모르는 값), "소식 첫 게시물"(소식 미측정)이
번갈아 나왔다. 이 모듈은 **확인된 사실과 정면으로 어긋나는 문구만** 고친다:
  - 이미 등록된 가게(naver_place_id·is_smart_place)에 "스마트플레이스 등록" 처방 → 그 처방을 뺀다
  - 소식을 읽지 못했는데 "첫 게시물/첫 소식" → "게시물/소식"으로(첫이라는 단정만 지운다)
  - 리뷰가 실제로 있는데 "첫 리뷰"·"리뷰가 없다" → 고치거나 그 문장을 뺀다
  - 소개글 Q&A 개수("현재 0개/비어 있다") → 그 문장을 뺀다(Q&A 개수는 자동으로 알 수 없다)
확인되지 않았을 때(등록 여부 모름 등)는 아무것도 바꾸지 않는다 — 실제로 미등록인 가게의 "등록하기"는 올바른 처방이다.
순수 함수라 AI 호출 없이 테스트한다. 이 규칙에 없는 새 유형의 단정은 못 잡는다(프롬프트 규칙이 1차, 이 모듈이 알려진 유형의 2차 방어).
"""
from __future__ import annotations

import json
import re

_NOT_REGISTERED_TITLE = re.compile(r"^\s*(?:네이버\s*)?스마트\s*플레이스\s*(?:에\s*)?(?:신규\s*)?등록")
_FIRST_POST = re.compile(r"첫\s*(?:번째\s*)?(게시물|소식|포스팅|공지)")
_FIRST_REVIEW = re.compile(r"첫\s*(?:번째\s*)?리뷰")
_QA_COUNT = re.compile(r"Q\s*&\s*A\s*(?:[은는이가]\s*)?(?:현재\s*)?(?:0\s*개|비어)|Q\s*&\s*A\s*[은는이가]\s*(?:현재\s*)?없")
_NO_REVIEW = re.compile(r"리뷰\s*(?:[가는]\s*(?:아직\s*)?|아직\s*)(?:없|0\s*건|0\s*개)")
# 시설·서비스형 키워드("단체석 있음"·"주차 가능")를 리뷰로 유도하라는 처방 — 그 시설이 없는 가게에는 맞지 않는다(음식점 가이드 6회 중 6회 관측, 2026-11-05).
# 제목에 조건을 붙여 사장님이 실제로 있을 때만 하게 한다. 이미 "실제"·"해당"이 있으면 건드리지 않고, 제목에 "리뷰"가 없으면(예: 안내 추가) 대상이 아니다.
_FACILITY_KW_TITLE = re.compile(r"['‘’\"“”][^'‘’\"“”]{1,14}(?:있음|가능)['‘’\"“”]")
_FACILITY_NOTE = " (실제로 있다면)"

_SENT_SPLIT = re.compile(r"(?<=[.!?。])\s+")
# 측정 결과를 절대 표현으로 쓰지 않는다(2026-11-01 방침: 0은 "이번 측정에서는 확인되지 않았다") — "전혀 등장하지 않고 있습니다" → "이번 측정에서는 등장하지 않았습니다"
_ABSOLUTE_NEG = re.compile(r"전혀\s*(등장하|노출되|언급되|인용되|나오)지\s*않(?:고\s*있습니다|았습니다|습니다|아요|고 있어요)")

_QA_FALLBACK = "소개글 Q&A는 방문 전 손님이 자주 묻는 내용을 미리 알려 주는 항목입니다."


_SMARTPLACE_HOSTS = {"smartplace.naver.com", "new.smartplace.naver.com"}
_OTHER_LINK_HOSTS = {"business.google.com", "map.kakao.com", "map.naver.com"}


def sanitize_deep_link(url):
    """AI가 쓴 deep_link를 열 수 있는 주소로만 남긴다 (2026-11-05).

    프롬프트는 "https://smartplace.naver.com/places/{place_id}/해당탭" 형태를 요구하지만 AI가 자리표시자를 한글 단어로 채워
    "https://smartplace.naver.com/places/업체정보"·".../places/" 같은 깨진 주소를 냈고(관측 2/2), 화면은 이 값을 그대로 href에 넣는다.
    스마트플레이스 경로 구조는 로그인 없이 검증할 수 없어 어떤 하위 경로도 확인된 적이 없으므로 루트로 돌린다(화면의 다른 안내 링크도 루트).
    허용 목록 밖 주소·http·빈 값은 None(버튼 없음).
    """
    if not isinstance(url, str) or not url.strip():
        return None
    from urllib.parse import urlparse

    try:
        u = urlparse(url.strip())
    except ValueError:
        return None
    host = (u.hostname or "").lower()
    if u.scheme != "https":
        return None
    if host in _SMARTPLACE_HOSTS:
        return "https://smartplace.naver.com/"
    if host in _OTHER_LINK_HOSTS:
        path = u.path or ""
        if not path.isascii() or "{" in url or "}" in url:
            path = ""
        return f"https://{host}{path}"
    return None


def build_facts(biz: dict) -> dict:
    """사업장 행에서 '확인된 사실'만 뽑는다. 모르면 False(= 아무것도 고치지 않음)."""
    biz = biz or {}
    sp = biz.get("sp_completeness_json")
    if isinstance(sp, str):
        try:
            sp = json.loads(sp)
        except (ValueError, TypeError):
            sp = None
    sp = sp if isinstance(sp, dict) and not sp.get("error") else None

    def _pos(v) -> bool:
        return isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0

    registered = bool(str(biz.get("naver_place_id") or "").strip()) or biz.get("is_smart_place") is True
    reviews_known = _pos(biz.get("review_count")) or _pos(biz.get("visitor_review_count"))
    post_known = bool(sp) and sp.get("recent_post_measured") is not False and sp.get("recent_post_state") != "unmeasured"
    return {"registered": registered, "reviews_known": reviews_known, "post_known": post_known}


def _map_strings(obj, fn):
    if isinstance(obj, str):
        return fn(obj)
    if isinstance(obj, list):
        return [_map_strings(x, fn) for x in obj]
    if isinstance(obj, dict):
        return {k: _map_strings(v, fn) for k, v in obj.items()}
    return obj


def _drop_sentences(text: str, patterns, fallback: str = "") -> str:
    parts = _SENT_SPLIT.split(text)
    kept = [p for p in parts if not any(pt.search(p) for pt in patterns)]
    if len(kept) == len(parts):
        return text
    cleaned = " ".join(kept).strip()
    return cleaned or fallback


def guard_guide(guide: dict, facts: dict) -> tuple[dict, list[str]]:
    """AI 가이드(dict)에서 확인된 사실과 어긋나는 문구를 고친다. (고친 가이드, 고친 내용 메모) 반환 — 원본은 바꾸지 않는다."""
    if not isinstance(guide, dict):
        return guide, []
    notes: list[str] = []
    g = json.loads(json.dumps(guide, ensure_ascii=False, default=str))   # 깊은 복사

    # 1) 이미 등록된 가게에 "스마트플레이스 등록" 처방
    if facts.get("registered"):
        items = g.get("priority_items")
        if isinstance(items, list):
            kept = [it for it in items if not (isinstance(it, dict) and _NOT_REGISTERED_TITLE.search(str(it.get("title") or "")))]
            if kept and len(kept) < len(items):
                notes.append(f"등록 처방 {len(items) - len(kept)}개 제외(이미 등록된 가게)")
                for i, it in enumerate(kept, 1):
                    if isinstance(it, dict) and "rank" in it:
                        it["rank"] = i
                g["priority_items"] = kept
        qw = g.get("quick_wins")
        if isinstance(qw, list):
            kept_qw = [q for q in qw if not (isinstance(q, str) and _NOT_REGISTERED_TITLE.search(q))]
            if len(kept_qw) < len(qw):
                notes.append(f"빠른 실행 {len(qw) - len(kept_qw)}개 제외(이미 등록된 가게)")
                g["quick_wins"] = kept_qw

    # 시설·서비스형 키워드 리뷰 유도 처방에 조건 붙이기
    cond = 0

    def _add_cond(title):
        t = str(title or "")
        if "리뷰" in t and _FACILITY_KW_TITLE.search(t) and "실제" not in t and "해당" not in t:
            return t + _FACILITY_NOTE
        return title

    for it in (g.get("priority_items") or []):
        if isinstance(it, dict) and "title" in it:
            new_t = _add_cond(it.get("title"))
            if new_t != it.get("title"):
                it["title"] = new_t
                cond += 1
    m = g.get("this_week_mission")
    if isinstance(m, dict) and "title" in m:
        new_t = _add_cond(m.get("title"))
        if new_t != m.get("title"):
            m["title"] = new_t
            cond += 1
    if cond:
        notes.append(f"시설형 키워드 리뷰 처방 {cond}개에 '(실제로 있다면)' 조건 추가")

    # deep_link: 깨진·미확인 주소 정리
    fixed_links = 0
    for holder in [it for it in (g.get("priority_items") or []) if isinstance(it, dict)] + [g.get("this_week_mission")]:
        if isinstance(holder, dict) and "deep_link" in holder:
            clean = sanitize_deep_link(holder.get("deep_link"))
            if clean != holder.get("deep_link"):
                holder["deep_link"] = clean
                fixed_links += 1
    if fixed_links:
        notes.append(f"깨진·미확인 deep_link {fixed_links}개 정리(스마트플레이스는 루트로)")

    changed = {"post": 0, "review": 0, "qa": 0, "abs": 0}

    def _fix(s: str) -> str:
        out = s
        if not facts.get("post_known") and _FIRST_POST.search(out):
            out = _FIRST_POST.sub(lambda m: m.group(1), out)
            changed["post"] += 1
        if facts.get("reviews_known"):
            if _FIRST_REVIEW.search(out):
                out = _FIRST_REVIEW.sub("리뷰", out)
                changed["review"] += 1
            if _NO_REVIEW.search(out):
                out = _drop_sentences(out, [_NO_REVIEW], "")
                changed["review"] += 1
        if _ABSOLUTE_NEG.search(out):
            out = _ABSOLUTE_NEG.sub(lambda m: f"이번 측정에서는 {m.group(1)}지 않았습니다", out)
            changed["abs"] += 1
        if _QA_COUNT.search(out):
            out = _drop_sentences(out, [_QA_COUNT], _QA_FALLBACK)
            changed["qa"] += 1
        return out

    g = _map_strings(g, _fix)
    if changed["post"]:
        notes.append(f"'첫 게시물' 단정 {changed['post']}곳 수정(소식 미측정)")
    if changed["review"]:
        notes.append(f"리뷰 없음 단정 {changed['review']}곳 수정(리뷰 확인됨)")
    if changed["abs"]:
        notes.append(f"절대 표현 '전혀 … 않고 있습니다' {changed['abs']}곳 완화(측정 결과는 이번 측정 기준)")
    if changed["qa"]:
        notes.append(f"Q&A 개수 단정 {changed['qa']}곳 제거(개수는 자동 확인 불가)")
    return g, notes
