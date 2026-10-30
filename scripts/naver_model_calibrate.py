"""네이버 용량 모델의 가정을 실측으로 바꿔 다시 계산한다 (2026-10-30).

사용(서버, 읽기 전용): cd /var/www/aeolab/backend && set -a && . ./.env && set +a && PYTHONPATH=. \
    /var/www/aeolab/venv/bin/python ../scripts/naver_model_calibrate.py [--n 300]

언제: 활성 사업장이 용량 알림 90%(약 45곳)에 닿았을 때(docs/naver_capacity_300_playbook_2026_10_29.md §3). 그 전에는 표본이 적어 결과를 믿지 않는다.
무엇을: DB의 실제 값으로 모델 가정 3가지를 교체한다 — ① 요금제 비율 ② 사업장당 키워드 수 ③ 사업장당 경쟁사 수 (+ 사용자 수동 스캔 빈도는 계측 이력 요약을 그대로 보여 준다).
결과는 '가정 그대로'와 '실측 반영'을 나란히 출력한다. 네이버에는 접속하지 않는다(DB 읽기 전용). 모델 자체가 코드 기준이라는 한계(네이버의 실제 기준 미확인)는 그대로다.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
import uuid
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))


def _load_model():
    spec = importlib.util.spec_from_file_location("naver_load_model", os.path.join(HERE, "naver_load_model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def measured_inputs(sb) -> dict:
    """활성 구독 사업장의 요금제 구성·키워드 수·경쟁사 수(읽기 전용)."""
    from services.scan_scheduling import entitled_sub_rows
    subs = entitled_sub_rows(sb.table("subscriptions").select("user_id,plan,status,end_at").in_("status", ["active", "grace_period"]).execute().data or [])
    plan_by_user = {s["user_id"]: s["plan"] for s in subs}
    if not plan_by_user:
        return {"n": 0}
    bizs = sb.table("businesses").select("id,user_id,keywords").eq("is_active", True).in_("user_id", list(plan_by_user)).execute().data or []
    comps = sb.table("competitors").select("business_id").eq("is_active", True).execute().data or []
    comp_by_biz = Counter(c["business_id"] for c in comps)
    plans = [plan_by_user[b["user_id"]] for b in bizs]
    kws = [len([k for k in (b.get("keywords") or []) if k]) for b in bizs]
    cps = [comp_by_biz.get(b["id"], 0) for b in bizs]
    n = len(bizs)
    return {
        "n": n,
        "plan_mix": {p: round(c / n, 3) for p, c in Counter(plans).items()} if n else {},
        "avg_keywords": round(sum(kws) / n, 2) if n else None,
        "avg_competitors": round(sum(cps) / n, 2) if n else None,
    }


def population_from_mix(mix: dict, n: int) -> list[tuple[str, str]]:
    """측정한 요금제 비율을 n곳으로 늘린 결정적 구성(모델의 mix_population과 같은 형식)."""
    order = sorted(mix.items(), key=lambda kv: -kv[1])
    plans: list[str] = []
    for plan, share in order:
        plans += [plan] * max(1, round(share * 20))
    out = []
    for i in range(n):
        out.append((str(uuid.UUID(int=(i + 1) * 104729)), plans[i % len(plans)]))
    return out


def peaks(m, n: int, *, keywords: int, competitors: int, population=None) -> tuple[float, float]:
    saved = m.mix_population
    if population is not None:
        m.mix_population = lambda k: population_from_mix(population, k)
    try:
        # 현재 서버 상태: 슬롯 분산 켬 + 사전 스캔 재사용, AI탭 질의 수는 환경변수 값(미설정 4)
        d = m.daily_loads(n, keywords=keywords, competitors=competitors, spread=True, dedupe=0.0, prescan_reuse=True,
                          comp_cache=True, comp_spread=True)
        return max(x["batch"] for x in d), max(x["total"] for x in d)
    finally:
        m.mix_population = saved


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=300, help="외삽할 사업장 수(기본 300)")
    a = ap.parse_args()
    m = _load_model()
    from db.supabase_client import get_client
    sb = get_client()
    got = measured_inputs(sb)
    print(f"실측 표본: 활성 구독 사업장 {got['n']}곳")
    if got["n"] < 10:
        print("※ 10곳 미만이라 모델 가정을 바꿀 근거가 못 된다(이 출력은 참고용). 90%(약 45곳) 이후에 다시 실행할 것.")
    if not got["n"]:
        return
    kw = max(1, round(got["avg_keywords"] or 4))
    cp = max(0, round(got["avg_competitors"] or 3))
    base_b, base_t = peaks(m, a.n, keywords=4, competitors=3)
    cal_b, cal_t = peaks(m, a.n, keywords=kw, competitors=cp, population=got["plan_mix"] or None)
    print(f"요금제 구성(실측): {got['plan_mix']} | 사업장당 키워드 {got['avg_keywords']} · 경쟁사 {got['avg_competitors']}")
    print(f"{a.n}곳 하루 최대 — 가정(키워드 4·경쟁사 3·70/10/15/5%): 정기잡 {base_b:.0f} / 전체 {base_t:.0f}")
    print(f"{a.n}곳 하루 최대 — 실측 반영(키워드 {kw}·경쟁사 {cp}):        정기잡 {cal_b:.0f} / 전체 {cal_t:.0f}  (몫 420 · 상한 600)")
    try:
        from services import naver_usage_meter as um
        from services.ai_scanner import naver_quota_history
        print("사용자 수동 스캔 계측 요약:", um.summarize(naver_quota_history(30), um.history(30), got["n"]))
    except Exception as e:  # noqa: BLE001
        print("수동 스캔 계측 요약을 읽지 못했다:", e)


if __name__ == "__main__":
    main()
