"""재가입 방어 키 해제(오탐 구제) — 기본은 드라이런 (2026-11-10).

사업 양도·인수, 대행사 등록 등으로 정당한 신규 고객이 "이미 첫 달 할인(또는 무료 체험)을 이용한 사업장·이메일"로 판정됐을 때,
관리자가 그 값의 키를 해제한다. 값(원문)을 받아 서버 비밀값으로 같은 해시를 만들어 찾으므로 DB에는 원문이 남지 않는다.
해제된 키는 일치로 보지 않으며, 그 값으로 다시 이용하면 기록이 되살아난다(services/discount_guard.record_use).

사용(서버):
  cd /var/www/aeolab/backend
  PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/discount_key_release.py --purpose discount --type naver_place --value 1234567890
  (확인 후) ... --apply
--type: naver_place | kakao_place | brn | email | phone     --purpose: discount | trial
출력에는 값 원문을 쓰지 않는다(종류·일치 행 수만).
"""
import argparse
import asyncio
import os
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_BACKEND, ".env"))
    except ImportError:
        pass


async def _main(args) -> int:
    from services import discount_guard as dg
    from db.supabase_client import execute, get_client

    if args.type == dg.KEY_EMAIL:
        norm = dg.normalize_email(args.value)
    elif args.type == dg.KEY_PHONE:
        norm = dg.normalize_phone(args.value)
    elif args.type in (dg.KEY_NAVER, dg.KEY_KAKAO):
        norm = dg.normalize_digits(args.value, 5, 20)
    elif args.type == dg.KEY_BRN:
        norm = dg.normalize_digits(args.value, 10, 10)
    else:
        print("알 수 없는 --type")
        return 2
    if not norm:
        print("값 형식이 맞지 않아 키를 만들 수 없습니다(정규화 실패).")
        return 2
    h = dg.key_hash(args.purpose, args.type, norm)
    if not h:
        print("DISCOUNT_KEY_PEPPER가 설정돼 있지 않습니다 — 해시를 만들 수 없습니다.")
        return 2

    res = await execute(
        get_client().table("discount_used_keys")
        .select("id, used_at, expires_at, released_at")
        .eq("purpose", args.purpose)
        .eq("key_type", args.type)
        .eq("key_hash", h)
    )
    rows = (res.data if res else None) or []
    print(f"일치하는 키 {len(rows)}건 (종류={args.type}, 목적={args.purpose})")
    for r in rows:
        print(f"  used_at={r.get('used_at')} expires_at={r.get('expires_at')} released_at={r.get('released_at')}")
    if not rows:
        return 0
    if not args.apply:
        print("드라이런 — 아무것도 바꾸지 않았습니다. 해제하려면 --apply")
        return 0
    n = await dg.release(args.purpose, args.type, args.value, released_by=args.by)
    print(f"해제 {n}건 (처리자={args.by})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="재가입 방어 키 해제(오탐 구제)")
    ap.add_argument("--purpose", choices=("discount", "trial"), required=True)
    ap.add_argument("--type", required=True, choices=("naver_place", "kakao_place", "brn", "email", "phone"))
    ap.add_argument("--value", required=True, help="해제할 값(원문). 출력·로그에는 쓰지 않는다")
    ap.add_argument("--by", default="admin", help="처리자 표시")
    ap.add_argument("--apply", action="store_true", help="실제로 해제(기본은 드라이런)")
    args = ap.parse_args()
    _load_env()
    return asyncio.run(_main(args))


if __name__ == "__main__":
    sys.exit(main())
