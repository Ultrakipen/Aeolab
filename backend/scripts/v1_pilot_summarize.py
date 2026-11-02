"""V-1 파일럿 원자료(v1_search_on_pilot.py의 --out JSON)를 가게별로 집계하고 프로토콜 §5 기준으로 괴리를 판정한다 (2026-11-02).

입력: 원자료 JSON.  출력: 표준 출력(마크다운 표) — 결과 문서에 그대로 붙인다.
판정 기준(docs/v1_measurement_validity_protocol_2026_10_30.md §5, 표본이 작아 방향성만):
- 기억 모드 0인 가게가 검색 켬에서 '3회 중 1회 이상' 등장 → 과소 반영(under)
- 기억 모드로 노출되던 가게가 검색 켬에서 전혀 안 나옴 → 과대 반영(over)
- 그 외 → 일치(consistent)
같은 모델·같은 질문의 '검색 끔' 암을 함께 보여, 차이가 검색 때문인지 모델의 표본 변동 때문인지 구분한다.
"""
import json
import sys
from collections import Counter

# 수기 ChatGPT 화면(검색 켬) 결과 — docs/v1_validity_result_partial_2026_11_01.md §2-4, 모두 예비(1~3회, 개인화 미확인)
UI_MANUAL = {
    "onion": (1, 2), "hara": (2, 3), "daeho": (0, 1), "healing": (2, 2), "hong": (2, 3),
}
MEMORY_RATE = {"onion": 25 / 50, "hara": 0.0, "daeho": 0.0, "healing": 0.0, "hong": 0.0}


def rate(rows: list[dict]) -> tuple[int, int]:
    ok = [r for r in rows if not r.get("error")]
    return sum(1 for r in ok if r.get("mentioned")), len(ok)


def verdict(shop_id: str, search_hits: int, search_n: int) -> str:
    """프로토콜 §5. 표본이 0이면 판정하지 않는다."""
    if search_n == 0:
        return "판정 불가(유효 표본 0)"
    base = MEMORY_RATE.get(shop_id, 0.0)
    if base == 0.0:
        return "과소 반영(기억 모드 0 → 검색 켬 등장)" if search_hits >= 1 else "일치(둘 다 0)"
    return "과대 반영(기억 모드 노출 → 검색 켬 미등장)" if search_hits == 0 else "일치(둘 다 등장)"


def summarize(data: dict) -> dict:
    rows = data.get("rows") or []
    by_shop: dict[str, list[dict]] = {}
    for r in rows:
        by_shop.setdefault(r["shop"], []).append(r)
    out = {}
    for sid, rs in by_shop.items():
        on = [r for r in rs if r["arm"] == "search"]
        off = [r for r in rs if r["arm"] == "nosearch"]
        sh, sn = rate(on)
        oh, on_n = rate(off)
        used = [r for r in on if not r.get("error") and (r.get("search_calls") or 0) > 0]
        doms = Counter(d for r in on if not r.get("error") for d in (r.get("domains") or []))
        ranks = [r["rank"] for r in on if r.get("rank")]
        out[sid] = {
            "shop_name": rs[0].get("shop_name"), "memory": rs[0].get("memory_baseline"),
            "nosearch": (oh, on_n), "search": (sh, sn), "search_used": (len(used), len([r for r in on if not r.get("error")])),
            "ranks": ranks, "top_domains": doms.most_common(6),
            "errors": sum(1 for r in rs if r.get("error")), "verdict": verdict(sid, sh, sn),
            "by_query": {q: rate([r for r in on if r["q"] == q]) for q in sorted({r["q"] for r in on})},
        }
    return out


def render(data: dict) -> str:
    s = summarize(data)
    lines = [f"모델 {data.get('model')}, 호출 {data.get('calls')}회, 실제 비용 ${data.get('spent_usd')}", "",
             "| 가게 | 기억 모드(스캔) | 같은 모델 검색 끔 | **검색 켬(API)** | 질문별(검색 켬) | 검색 실제 사용 | 순위 | 수기 화면(예비) | 판정 |",
             "|---|---|---|---|---|---|---|---|---|"]
    for sid, v in s.items():
        ui = UI_MANUAL.get(sid)
        q = ", ".join(f"{k.upper()} {h}/{n}" for k, (h, n) in v["by_query"].items())
        lines.append(f"| {v['shop_name']} | {v['memory']} | {v['nosearch'][0]}/{v['nosearch'][1]} | **{v['search'][0]}/{v['search'][1]}** | {q} | "
                     f"{v['search_used'][0]}/{v['search_used'][1]} | {v['ranks'] or '-'} | {f'{ui[0]}/{ui[1]}' if ui else '-'} | {v['verdict']} |")
    lines += ["", "**인용 도메인 상위(검색 켬, 가게별)**"]
    for sid, v in s.items():
        lines.append(f"- {v['shop_name']}: " + (", ".join(f"{d}({c})" for d, c in v["top_domains"]) or "-"))
    errs = sum(v["errors"] for v in s.values())
    if errs:
        lines.append(f"\n오류 {errs}건 — 위 표에서 제외")
    return "\n".join(lines)


if __name__ == "__main__":
    print(render(json.load(open(sys.argv[1], encoding="utf-8"))))
