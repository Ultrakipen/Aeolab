"""V-1 파일럿 — ChatGPT '기억 모드'(검색 없음)와 '웹 검색을 켠 답'의 가게 노출 차이를 OpenAI 공식 API로 측정한다 (2026-11-02).

목적: 우리 점수의 ChatGPT 측정(기억 모드)이 소비자가 보는 검색 켠 답과 얼마나 다른지 확인한다.
설계 문서: docs/v1_search_on_pilot_design_2026_11_02.md  /  수기 프로토콜: docs/v1_measurement_validity_protocol_2026_10_30.md

안전 원칙
- 기본은 계획만 출력한다(API 호출 없음). 실제 호출은 `--run`을 줘야 한다.
- 호출 수 상한(--max-calls)과 금액 상한(--max-usd)을 둔다. 금액은 실제 usage 토큰과 검색 도구 호출 수로 누적 계산하고, 상한에 닿으면 즉시 멈춘다.
- 네이버에 접속하지 않는다. DB에 쓰지 않는다. 결과는 --out JSON 파일로만 저장한다(운영 점수·알림에 반영되지 않음).
- 가게 이름을 질문에 넣지 않는다(우리 스캔과 같은 비유도형).
- SDK의 Responses API 지원 여부(서버 openai 1.50.2는 미지원)에 의존하지 않고 httpx로 직접 호출한다.

단가(2026-11-02 공식 가격 페이지 확인): web_search $10/1,000회 + 검색 내용 토큰은 모델 단가로 과금, gpt-6-luna $0.10/$0.50 (1M 토큰).
커뮤니티에 '검색 1회가 내부 하위 검색 여러 번으로 과금된다'는 보고가 있어(공식 미확인) 호출 수는 응답의 web_search_call 항목 수로 센다.
"""
import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta

PRICE_IN_PER_M = 0.10        # gpt-6-luna 입력 $/1M 토큰
PRICE_OUT_PER_M = 0.50       # 출력 $/1M 토큰
PRICE_SEARCH_CALL = 0.01     # web_search 도구 호출 1회 $10/1,000

SHOPS = [
    {"id": "onion", "name": "어니언 성수", "keys": ["어니언"], "city": "Seoul", "region": "Seoul", "memory": "25/50",
     "q1": "서울 성동구 성수동 성수 카페 추천", "q4": "서울 성동구 성수동에서 성수 카페 잘하는 곳 추천해줘"},
    {"id": "hara", "name": "하라식당 본점", "keys": ["하라식당"], "city": "Changwon", "region": "Gyeongsangnam-do", "memory": "0/50",
     "q1": "창원 일본가정식 추천", "q4": "창원에서 일본가정식 잘하는 곳 추천해줘"},
    {"id": "daeho", "name": "대호흑돼지", "keys": ["대호흑돼지"], "city": "Changwon", "region": "Gyeongsangnam-do", "memory": "0/50",
     "q1": "창원 동태탕 추천", "q4": "창원에서 동태탕 잘하는 곳 추천해줘"},
    {"id": "healing", "name": "힐링하우스마사지 창원점", "keys": ["힐링하우스"], "city": "Changwon", "region": "Gyeongsangnam-do", "memory": "0/100",
     "q1": "창원 상남동마사지 추천", "q4": "창원에서 상남동마사지 잘하는 곳 추천해줘"},
    {"id": "hong", "name": "홍뮤직스튜디오작곡교습소", "keys": ["홍뮤직"], "city": "Changwon", "region": "Gyeongsangnam-do", "memory": "0/50",
     "q1": "창원 편곡 추천", "q4": "창원에서 편곡 잘하는 곳 추천해줘"},
]
KST = timezone(timedelta(hours=9))


# ── 순수 함수 (tests/test_v1_search_on_pilot.py가 검증) ────────────────────────────
def norm(s: str) -> str:
    """비교용 정규화: 마크다운·공백·특수문자 제거 + 소문자."""
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s or "")        # [텍스트](링크) → 텍스트
    return "".join(ch for ch in s.lower() if ch.isalnum())


_LIST_ITEM = re.compile(r"^\s*(?:#{1,6}\s*)?(?:\d{1,2}[.)]|[-*•])\s+(.*\S)")


def list_items(answer: str) -> list[str]:
    """답변에서 번호/글머리 항목의 첫 줄을 순서대로 뽑는다(가게 이름이 들어 있는 줄)."""
    out = []
    for line in (answer or "").splitlines():
        m = _LIST_ITEM.match(line)
        if m:
            out.append(m.group(1))
    return out


def find_shop(answer: str, keys: list[str]) -> dict:
    """우리 가게가 답변에 있는지(mentioned)와 목록 순위(rank, 목록으로 나열됐을 때만)."""
    nkeys = [norm(k) for k in keys if norm(k)]
    nans = norm(answer)
    mentioned = any(k in nans for k in nkeys)
    rank = None
    items = list_items(answer)
    for i, it in enumerate(items, 1):
        if any(k in norm(it) for k in nkeys):
            rank = i
            break
    return {"mentioned": mentioned, "rank": rank, "n_items": len(items)}


def parse_response(body: dict) -> dict:
    """Responses API 응답에서 답변 텍스트·인용·검색 호출 수·토큰을 꺼낸다."""
    text_parts, cites, searches, queries = [], [], 0, []
    for item in body.get("output") or []:
        t = item.get("type")
        if t == "web_search_call":
            searches += 1
            for q in (item.get("action") or {}).get("queries") or []:
                if q and q not in queries:
                    queries.append(q)                    # 모델이 내부적으로 쓴 검색어(어디서 근거를 찾았는지 해석에 쓴다)
        elif t == "message":
            for c in item.get("content") or []:
                if c.get("type") == "output_text":
                    text_parts.append(c.get("text") or "")
                    for a in c.get("annotations") or []:
                        if a.get("type") == "url_citation" and a.get("url"):
                            cites.append({"url": a["url"], "title": (a.get("title") or "")[:120]})
    usage = body.get("usage") or {}
    # 과금 근거는 응답의 tool_usage.web_search.num_requests(실측 2026-11-02: web_search_call 항목 수와 같았다) — 있으면 그것을 쓴다
    billed = ((body.get("tool_usage") or {}).get("web_search") or {}).get("num_requests")
    return {
        "answer": "\n".join(text_parts),
        "citations": cites,
        "search_queries": queries,
        "search_calls": int(billed) if isinstance(billed, int) else searches,
        "tokens_in": int(usage.get("input_tokens") or 0),
        "tokens_out": int(usage.get("output_tokens") or 0),
    }


def cost_usd(tokens_in: int, tokens_out: int, search_calls: int) -> float:
    return tokens_in / 1e6 * PRICE_IN_PER_M + tokens_out / 1e6 * PRICE_OUT_PER_M + search_calls * PRICE_SEARCH_CALL


def citation_domains(cites: list[dict]) -> list[str]:
    out = []
    for c in cites:
        m = re.match(r"https?://([^/]+)", c.get("url") or "")
        if m:
            out.append(re.sub(r"^www\.", "", m.group(1).lower()))
    return out


def build_request(model: str, question: str, search: bool, shop: dict | None, max_out: int = 1500) -> dict:
    body = {"model": model, "input": question, "max_output_tokens": max_out, "reasoning": {"effort": "none"}}
    if search:
        loc = {"type": "approximate", "country": "KR"}
        if shop:
            loc.update({"city": shop["city"], "region": shop["region"]})
        body["tools"] = [{"type": "web_search", "user_location": loc}]
    return body


def plan_jobs(shop_ids: list[str], queries: list[str], reps: int, arms: list[str]) -> list[dict]:
    jobs = []
    for s in SHOPS:
        if shop_ids and s["id"] not in shop_ids:
            continue
        for q in queries:
            for arm in arms:
                for r in range(1, reps + 1):
                    jobs.append({"shop": s["id"], "q": q, "arm": arm, "rep": r, "question": s[q.lower()]})
    return jobs


def estimate_upper_bound(jobs: list[dict]) -> float:
    """사전 상한 추정(보수): 검색 암은 호출당 검색 6회·입력 55k·출력 1.2k 토큰(스모크 실측: 검색 5회·입력 45k·출력 0.7k → $0.055),
    비검색 암은 입력 0.1k·출력 1k 토큰."""
    total = 0.0
    for j in jobs:
        total += cost_usd(55000, 1200, 6) if j["arm"] == "search" else cost_usd(100, 1000, 0)
    return total


# ── 실행 ──────────────────────────────────────────────────────────────────────
async def call_api(client, key: str, body: dict) -> dict:
    r = await client.post("https://api.openai.com/v1/responses", json=body,
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, timeout=120)
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


async def run(args) -> int:
    import httpx
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        print("OPENAI_API_KEY 없음 — 중단")
        return 2
    shops_by_id = {s["id"]: s for s in SHOPS}
    jobs = plan_jobs(args.shops, args.queries, args.reps, args.arms)
    spent, calls, errors, rows, raws = 0.0, 0, 0, [], []
    started = datetime.now(KST).isoformat(timespec="seconds")
    async with httpx.AsyncClient() as client:
        for j in jobs:
            if calls >= args.max_calls:
                print(f"호출 수 상한({args.max_calls}) 도달 — 중단")
                break
            if spent >= args.max_usd:
                print(f"금액 상한(${args.max_usd}) 도달 — 중단")
                break
            shop = shops_by_id[j["shop"]]
            body = build_request(args.model, j["question"], j["arm"] == "search", shop)
            row = {**j, "shop_name": shop["name"], "memory_baseline": shop["memory"], "model": args.model,
                   "at_kst": datetime.now(KST).isoformat(timespec="seconds")}
            try:
                resp = await call_api(client, key, body)
                if args.keep_raw > len(raws):
                    raws.append({"request": body, "response": resp})      # 파서 테스트 픽스처용 실제 응답 원문
                p = parse_response(resp)
                f = find_shop(p["answer"], shop["keys"])
                c = cost_usd(p["tokens_in"], p["tokens_out"], p["search_calls"])
                spent += c
                row.update({**f, "search_calls": p["search_calls"], "tokens_in": p["tokens_in"], "tokens_out": p["tokens_out"],
                            "cost_usd": round(c, 5), "domains": citation_domains(p["citations"]), "search_queries": p["search_queries"],
                            "citations": p["citations"][:12], "answer": p["answer"][:2500], "error": None})
                errors = 0
            except Exception as e:
                errors += 1
                row.update({"error": str(e)[:300]})
                print(f"오류({errors}): {str(e)[:160]}")
            calls += 1
            rows.append(row)
            print(f"[{calls}/{len(jobs)}] {shop['name'][:8]:8s} {j['q']} {j['arm']:8s} rep{j['rep']} "
                  f"mentioned={row.get('mentioned')} rank={row.get('rank')} searches={row.get('search_calls')} ${spent:.3f}")
            if errors >= 3:
                print("연속 오류 3회 — 중단")
                break
            await asyncio.sleep(args.pause)
    out = {"started_kst": started, "model": args.model, "calls": calls, "spent_usd": round(spent, 4), "rows": rows}
    if raws:
        out["raw_samples"] = raws
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f"저장: {args.out}  호출 {calls}회  누적 ${spent:.3f}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--run", action="store_true", help="실제 API 호출(없으면 계획만 출력)")
    ap.add_argument("--shops", nargs="*", default=[], help="가게 id (기본 전체): " + ",".join(s["id"] for s in SHOPS))
    ap.add_argument("--queries", nargs="*", default=["q1", "q4"])
    ap.add_argument("--arms", nargs="*", default=["search", "nosearch"])
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--model", default=os.getenv("CHATGPT_MODEL", "gpt-6-luna"))
    ap.add_argument("--max-calls", type=int, default=80)
    ap.add_argument("--max-usd", type=float, default=3.0)
    ap.add_argument("--pause", type=float, default=1.0)
    ap.add_argument("--keep-raw", type=int, default=0, help="응답 원문을 앞에서 N개 저장(테스트 픽스처용)")
    ap.add_argument("--out", default="v1_pilot_raw.json")
    args = ap.parse_args()
    jobs = plan_jobs(args.shops, args.queries, args.reps, args.arms)
    ub = estimate_upper_bound(jobs)
    print(f"계획: {len(jobs)}회 (검색 {sum(1 for j in jobs if j['arm']=='search')} / 비검색 {sum(1 for j in jobs if j['arm']!='search')}), "
          f"사전 상한 추정 ${ub:.2f}, 실행 상한 호출 {args.max_calls}회·${args.max_usd}")
    if not args.run:
        print("계획만 출력했다(API 호출 없음). 실행하려면 --run")
        return 0
    if len(jobs) > args.max_calls or ub > args.max_usd * 2:
        print("계획이 상한을 크게 넘는다 — --max-calls/--max-usd를 의도적으로 올리거나 계획을 줄여라")
        return 3
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
