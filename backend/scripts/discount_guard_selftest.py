"""재가입 방어(discount_guard) 자체 검증 — 실제 `discount_used_keys` 테이블로 기록→일치→해제→만료를 확인한다 (2026-11-10).

플래그(`DISCOUNT_KEY_GUARD_ENABLED`)를 켜기 **전에** 돌려도 된다 — 이 스크립트는 자기 프로세스에서만 플래그를 켠다(서버 `.env`는 건드리지 않음).
테이블·비밀값(`DISCOUNT_KEY_PEPPER`)이 실제로 동작하는지, 같은 사업장·이메일 별칭이 일치하는지, 해제·만료가 먹는지를 사람 계정 없이 본다.

안전 장치
- 기본은 드라이런(테이블 읽기·비밀값 확인만). 쓰기는 `--apply`가 있을 때만.
- 시험 값은 무작위(예: 11자리 가짜 플레이스 번호, `selftest+<무작위>@example.invalid`)라 실제 사용자 키와 충돌하지 않는다.
- 사업장 조회(`_user_businesses`)만 가짜로 바꾸고 기록·조회·해제 코드는 실제 경로를 탄다.
- 끝나면(실패해도) **이 스크립트가 만든 해시만** 정확히 삭제한다. 전체 만료 삭제(purge_expired)는 부르지 않는다. 값 원문·해시는 출력하지 않는다.

사용(서버): cd /var/www/aeolab/backend && PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/discount_guard_selftest.py          # 드라이런
            ... discount_guard_selftest.py --apply                                                                              # 실제 검증
"""
import argparse
import asyncio
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_BACKEND, ".env"))
    except ImportError:
        pass


async def run_selftest(dg) -> list[tuple[str, bool]]:
    """dg(services.discount_guard 모듈)의 실제 함수로 시나리오를 돌려 (검사 이름, 통과 여부) 목록을 돌려준다. 만든 행은 항상 지운다."""
    results: list[tuple[str, bool]] = []

    def check(name: str, ok: bool) -> None:
        results.append((name, bool(ok)))

    pid = "9" + "".join(secrets.choice("0123456789") for _ in range(10))        # 가짜 플레이스 번호(11자리)
    tag = secrets.token_hex(6)
    email_a = f"st{tag}+a@example.invalid"          # 정규화하면 st<무작위>@example.invalid — 실행마다 달라 서로 충돌하지 않는다
    email_other = f"other-{tag}@example.invalid"
    businesses = {
        "selftest-A": [{"naver_place_id": pid}],
        "selftest-B": [{"naver_place_id": pid}],      # 탈퇴 후 재가입: 다른 계정, 같은 사업장
        "selftest-C": [],                             # 무관한 신규 고객
    }

    async def fake_businesses(user_id: str) -> list[dict]:
        return list(businesses.get(user_id, []))

    original = dg._user_businesses
    dg._user_businesses = fake_businesses
    mine = [dg.key_hash(p, kind, val) for p in dg.PURPOSES for kind, val in dg.compute_keys(email_a, businesses["selftest-A"])]
    try:
        n = await dg.record_use(dg.PURPOSE_DISCOUNT, "selftest-A", email_a)
        check("기록: 사업장 키와 이메일 키 2개 이상 기록", n >= 2)
        check("재가입(같은 사업장·다른 이메일) 일치", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-B", email_other) == dg.KEY_NAVER)
        check("+별칭 이메일(같은 사람의 다른 주소) 일치", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-C", f"st{tag}+b@example.invalid") == dg.KEY_EMAIL)
        check("무관한 신규 고객은 일치하지 않음", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-C", email_other) is None)
        check("목적 분리: 체험 판정에는 영향 없음", await dg.prior_use_conflict(dg.PURPOSE_TRIAL, "selftest-B", email_other) is None)

        rows = (await dg.execute(
            dg.get_client().table("discount_used_keys").select("key_hash, purpose, key_type, expires_at, released_at").in_("key_hash", [h for h in mine if h])
        )).data or []
        check("원문 미저장: 해시(64자)만 있고 만료일이 있다", bool(rows) and all(len(r["key_hash"]) == 64 and r.get("expires_at") for r in rows))

        check("해제(사업장 키) 1건", await dg.release(dg.PURPOSE_DISCOUNT, dg.KEY_NAVER, pid, released_by="selftest") == 1)
        check("해제 후 같은 사업장 재가입은 일치하지 않음", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-B", email_other) is None)

        await dg.record_use(dg.PURPOSE_DISCOUNT, "selftest-A", email_a)           # 다시 이용 → 기록이 되살아남
        check("다시 이용하면 일치가 되살아남", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-B", email_other) == dg.KEY_NAVER)

        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        await dg.execute(dg.get_client().table("discount_used_keys").update({"expires_at": past}).in_("key_hash", [h for h in mine if h]))
        check("만료된 키는 일치하지 않음", await dg.prior_use_conflict(dg.PURPOSE_DISCOUNT, "selftest-B", email_other) is None)
    finally:
        dg._user_businesses = original
        hashes = [h for h in mine if h]
        if hashes:
            await dg.execute(dg.get_client().table("discount_used_keys").delete().in_("key_hash", hashes))
        left = (await dg.execute(dg.get_client().table("discount_used_keys").select("key_hash").in_("key_hash", hashes))).data if hashes else []
        check("정리: 시험 행을 모두 지웠다", not left)
    return results


async def _main(apply: bool) -> int:
    from services import discount_guard as dg

    if not os.getenv("DISCOUNT_KEY_PEPPER", "").strip():
        print("DISCOUNT_KEY_PEPPER가 없습니다 — 해시를 만들 수 없어 검증할 수 없습니다.")
        return 2
    res = await dg.execute(dg.get_client().table("discount_used_keys").select("id", count="exact").limit(1))
    print(f"테이블 읽기 가능 (현재 {res.count}행). 비밀값 설정됨. 서버 플래그: {'켜짐' if dg.guard_enabled() else '꺼짐'}")
    if not apply:
        print("드라이런 — 쓰기 없이 끝냈습니다. 실제 검증은 --apply")
        return 0
    os.environ["DISCOUNT_KEY_GUARD_ENABLED"] = "true"        # 이 프로세스에서만
    results = await run_selftest(dg)
    bad = [name for name, ok in results if not ok]
    for name, ok in results:
        print(("PASS " if ok else "FAIL ") + name)
    print(f"결과: {len(results) - len(bad)}/{len(results)} 통과")
    return 0 if not bad else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="재가입 방어 자체 검증(기본 드라이런)")
    ap.add_argument("--apply", action="store_true", help="실제 테이블에 시험 행을 쓰고 검증한 뒤 지운다")
    args = ap.parse_args()
    _load_env()
    return asyncio.run(_main(args.apply))


if __name__ == "__main__":
    sys.exit(main())
