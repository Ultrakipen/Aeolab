"""경쟁사 AI 노출을 비유도 표본으로 판정한다 (2026-10-30).

과거에는 경쟁사 이름을 질문에 넣어 "이 가게가 추천되나?"를 따로 물었다(유도형 — 가게명을 넣으면 환각으로 "추천됨"이 부풀 수 있다).
이제는 사업장 스캔이 이미 한 비유도 추천 표본(`sample_recommend`)의 추천 목록 전체(`place_counts`)에서 경쟁사 이름을 대조한다.
내 가게와 같은 질문·같은 표본·같은 이름 대조 규칙이라 공정 비교가 되고, 추가 AI 호출이 없다.

판정 규칙:
- 근거 플랫폼: Gemini 표본이 측정됐으면(sample_size>0) Gemini, 아니면 ChatGPT. 둘 다 없으면 `_measured=False`(호출자는 갱신을 건너뛴다 — 0으로 저장하지 않는다).
- `place_counts` 키가 없는 과거 스캔 결과는 대조할 수 없으므로 `_measured=False`.
- 목록이 상한으로 잘렸고(`place_counts_truncated`) 경쟁사가 목록에 없으면 "없음"을 확인한 것이 아니므로 `_measured=False`.
- 등장 횟수는 같은 이름이 여러 줄로 매칭되면 가장 큰 값 하나를 쓴다(표본 수를 넘지 않게 합산하지 않는다).
"""
from __future__ import annotations

from services.ai_scanner.chatgpt_scanner import ChatGPTScanner, names_match

# compute_competitor_score의 freq_bonus(= min(20, freq*2))가 0~20을 쓰도록 등장 비율을 0~10 척도로 환산한다.
FREQ_SCALE = 10.0


def _usable(result: dict | None) -> bool:
    return bool(
        isinstance(result, dict)
        and result.get("probe") == "recommend_v1"
        and (result.get("sample_size") or 0) > 0
        and isinstance(result.get("place_counts"), list)
    )


def competitor_exposure(comp_name: str, gemini_result: dict | None, chatgpt_result: dict | None) -> dict:
    """반환: {"_measured", "mentioned", "count", "sample_size", "exposure_freq", "source", "error"}."""
    src_name, src = None, None
    for name, res in (("gemini", gemini_result), ("chatgpt", chatgpt_result)):
        if _usable(res):
            src_name, src = name, res
            break
    if src is None:
        return {"_measured": False, "mentioned": False, "count": 0, "sample_size": 0,
                "exposure_freq": 0.0, "source": None, "error": "no_recommend_sample"}

    target = ChatGPTScanner._norm_name(comp_name)
    best = 0
    for item in src.get("place_counts") or []:
        if not isinstance(item, dict):
            continue
        if names_match(target, ChatGPTScanner._norm_name(item.get("name") or "")):
            best = max(best, int(item.get("count") or 0))
    n = int(src.get("sample_size") or 0)
    best = min(best, n)
    if best == 0 and src.get("place_counts_truncated"):
        return {"_measured": False, "mentioned": False, "count": 0, "sample_size": n,
                "exposure_freq": 0.0, "source": src_name, "error": "place_counts_truncated"}
    return {
        "_measured": True,
        "mentioned": best > 0,
        "count": best,
        "sample_size": n,
        "exposure_freq": round(best / n * FREQ_SCALE, 2),
        "source": src_name,
        "error": None,
    }


STORED_PLACE_COUNTS = 40   # DB·응답에 남기는 추천 이름 수(상위). 전체 목록은 스캔 직후 메모리에서만 경쟁사 대조에 쓴다.


def compact_for_storage(res: dict | None, keep: int = STORED_PLACE_COUNTS) -> dict | None:
    """저장·응답용으로 place_counts를 상위 keep개로 줄인 사본을 돌려준다(원본은 그대로 — 호출자가 이어서 경쟁사 대조에 쓴다).

    줄어들었으면 place_counts_truncated=True로 표시해, 나중에 이 기록으로 경쟁사를 대조할 때 "목록에 없음"을 "노출 0"으로 확정하지 않는다.
    """
    if not isinstance(res, dict) or not isinstance(res.get("place_counts"), list):
        return res
    pcs = res["place_counts"]
    if len(pcs) <= keep:
        return res
    return {**res, "place_counts": pcs[:keep], "place_counts_truncated": True}


def basis_changed(curr: dict | None, prev: dict | None) -> bool:
    """두 경쟁사 점수 항목의 AI 측정 방식이 다른가(과거: 이름을 직접 물은 단일 측정 / 새 방식: 표본 목록 대조).

    방식이 다르면 점수 차이는 경쟁사의 실제 변화가 아니라 측정 방식 변경의 결과라 변화·급등 알림에서 제외한다.
    """
    return bool((curr or {}).get("ai_basis")) != bool((prev or {}).get("ai_basis"))


def score_fields(exp: dict) -> dict:
    """competitor_scores 항목에 더하는 표시용 필드(과거 항목에는 없다 — 화면이 키 유무로 새 방식을 구분한다)."""
    return {
        "ai_count": exp["count"],
        "ai_sample_size": exp["sample_size"],
        "ai_source": exp["source"],
        "ai_basis": "recommend_v1",
    }
