"""검색 켠 ChatGPT(API 웹 검색 도구) vs 기억 모드 격차 시험 — 자연스러운 질문 + 별도 이름 추출 (2026-10-30).

JSON 전용 지시와 웹 검색을 섞으면 일반 이름·자리표시자를 돌려줘 무효였다(첫 시도). 이 판은 질의를 그대로 묻고, 답변에서 상호를 별도 호출로 추출한다.
실행: ssh root@115.68.231.57 "cd /var/www/aeolab/backend && set -a && . ./.env && set +a && PYTHONPATH=. /var/www/aeolab/venv/bin/python ../scripts/pilot_search_vs_memory.py"
환경변수: PILOT_RUNS(기본 2)·PILOT_QUERIES(기본 2)·PILOT_SHOPS·SHOW_RAW=1. 비용: 가게 5곳 기본값에서 웹 검색 20회 + 추출 40회(약 1달러 미만 추정).
한계: 표본이 아주 작고(가게·모드당 4회), API 웹 검색 도구는 실제 ChatGPT 앱과 같은 경험이 아니다 — 방향만 보고 V1 수기 비교를 대체하지 않는다.
2026-10-30 결과: 어니언 성수 기억 1/4·검색 0/4, 하라식당·대호흑돼지·힐링하우스·홍뮤직 기억·검색 모두 0/4.
"""
import asyncio, json, os, re, sys
import aiohttp
from services.ai_scanner.chatgpt_scanner import ChatGPTScanner, names_match

KEY = os.getenv("OPENAI_API_KEY", "")
H = {"Authorization": "Bearer " + KEY}
MODEL = "gpt-4.1-mini"
RUNS = int(os.getenv("PILOT_RUNS", "2"))
Q_PER = int(os.getenv("PILOT_QUERIES", "2"))
SHOPS = os.getenv("PILOT_SHOPS", "어니언 성수,하라식당,대호흑돼지,힐링하우스,홍뮤직스튜디오작곡").split(",")
SHOW_RAW = os.getenv("SHOW_RAW", "0") == "1"


async def ask(session, query, search):
    body = {"model": MODEL, "input": query}
    if search:
        body["tools"] = [{"type": "web_search_preview"}]
    async with session.post("https://api.openai.com/v1/responses", json=body, headers=H,
                            timeout=aiohttp.ClientTimeout(total=120)) as r:
        d = await r.json()
        if r.status != 200:
            return None, None
    text, cites = "", []
    for it in d.get("output") or []:
        if it.get("type") == "message":
            for c in it.get("content") or []:
                text += c.get("text") or ""
                for a in c.get("annotations") or []:
                    if a.get("type") == "url_citation":
                        cites.append((a.get("title") or "")[:40])
    return text, cites


async def extract(session, answer):
    prompt = ('다음 답변에서 추천·소개된 가게(상호명)만 순서대로 최대 8개 JSON으로 추출하세요. 일반 명칭이나 카테고리 이름은 제외하고 '
              '고유한 상호만 넣으세요. 없으면 빈 배열.\n{"places": []}\n\n답변:\n' + answer[:3000])
    body = {"model": MODEL, "input": prompt}
    async with session.post("https://api.openai.com/v1/responses", json=body, headers=H,
                            timeout=aiohttp.ClientTimeout(total=60)) as r:
        d = await r.json()
    text = ""
    for it in d.get("output") or []:
        if it.get("type") == "message":
            for c in it.get("content") or []:
                text += c.get("text") or ""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    try:
        return [str(p).strip() for p in (json.loads(m.group()).get("places") or []) if str(p).strip()] if m else []
    except Exception:
        return []


async def main():
    from db.supabase_client import get_client
    sb = get_client()
    bizs = sb.table("businesses").select("id,name,region,category,keywords").execute().data or []
    async with aiohttp.ClientSession() as session:
        for s in SHOPS:
            b = next((x for x in bizs if s in x["name"]), None)
            if not b:
                continue
            kws = (b.get("keywords") or [])[:Q_PER] or [b["category"]]
            queries = [b["region"] + " " + k + " 추천" for k in kws]
            tgt = ChatGPTScanner._norm_name(b["name"])
            res = {"memory": [0, 0], "search": [0, 0]}
            cites_total = 0
            sample = None
            for q in queries:
                for _ in range(RUNS):
                    for mode in ("memory", "search"):
                        text, cites = await ask(session, q, mode == "search")
                        if text is None:
                            continue
                        names = await extract(session, text)
                        res[mode][1] += 1
                        res[mode][0] += any(names_match(tgt, ChatGPTScanner._norm_name(n)) for n in names)
                        if mode == "search":
                            cites_total += len(cites)
                            sample = sample or (q, names[:5], text[:160].replace("\n", " "))
            print("==", b["name"], "| 기억", "%d/%d" % tuple(res["memory"]), "| 검색", "%d/%d" % tuple(res["search"]),
                  "| 검색 인용 합계", cites_total)
            if SHOW_RAW and sample:
                print("   예(검색):", sample)

asyncio.run(main())
