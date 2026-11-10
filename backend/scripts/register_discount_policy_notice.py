"""방침·약관 변경 공지 등록(첫 달 할인·무료 체험 1회 제공, 비식별 해시 보관) — 기본은 드라이런 (2026-11-10).

개인정보처리방침 9조("시행 최소 7일 전 서비스 공지사항을 통해 고지")에 따라 시행일(2026-11-17) 7일 전인 2026-11-10에 공지한다.
문안은 방침(privacy)·약관(terms)·탈퇴 화면과 같은 날짜·같은 보관 기간(12개월)을 말해야 한다 — tests/test_discount_policy_text.py가 방침·약관·탈퇴 화면을 지킨다.
같은 제목의 공지가 이미 있으면 다시 등록하지 않는다(멱등).

사용(서버): cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/register_discount_policy_notice.py            # 드라이런
            ... register_discount_policy_notice.py --apply                                                                     # 실제 등록
"""
import argparse
import os
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

TITLE = "개인정보처리방침·이용약관 변경 안내 (2026년 11월 17일 시행)"
CONTENT = """안녕하세요, AEOlab입니다.

개인정보처리방침과 이용약관이 아래와 같이 변경됩니다. 시행일은 2026년 11월 17일이며, 이 공지로부터 7일 뒤 모든 이용자에게 적용됩니다.

1. 첫 달 할인·무료 체험은 사업장(또는 이메일)당 1회입니다 (이용약관 제5조 제1항)
- 첫 달 할인과 가입 후 1회 무료 체험은 사업장(또는 이메일)당 1회만 제공됩니다.
- 탈퇴 후 재가입하시더라도 이미 이용하신 사업장·이메일에는 다시 제공되지 않으며, 정상가로 이용하실 수 있습니다.

2. 중복 이용을 막기 위한 비식별 값 보관 (개인정보처리방침 제2항·제3항)
- 첫 달 할인 또는 무료 체험을 이용하신 경우, 이용 사업장 식별번호(네이버·카카오 플레이스 번호, 사업자등록번호)와 이메일 주소를 원문으로 복원할 수 없는 값(해시)으로 바꿔 이용일로부터 12개월간 보관합니다.
- 회원 탈퇴 후에도 위 기간 동안 보관되며, 기간이 지나면 지체 없이 파기합니다.
- 원문은 보관하지 않으며, 첫 달 할인·무료 체험의 중복 이용을 막는 용도 외에는 사용하지 않습니다.

3. 문의
- 변경 내용에 대해 궁금한 점은 support@aeolab.co.kr 로 문의해 주세요. 사업 양도·인수 등으로 정당하게 새로 이용하시는 경우에도 문의해 주시면 확인해 드립니다."""
CATEGORY = "update"
CTA_LABEL = "개인정보처리방침 보기"
CTA_URL = "/privacy"


def main() -> int:
    ap = argparse.ArgumentParser(description="방침·약관 변경 공지 등록(기본 드라이런)")
    ap.add_argument("--apply", action="store_true", help="실제로 등록")
    args = ap.parse_args()

    from dotenv import load_dotenv

    load_dotenv(os.path.join(_BACKEND, ".env"))
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    exists = sb.table("notices").select("id").eq("title", TITLE).limit(1).execute().data or []
    if exists:
        print(f"이미 등록된 공지가 있습니다(id={exists[0]['id']}) — 다시 등록하지 않습니다.")
        return 0
    print(f"제목: {TITLE}")
    print(f"본문 {len(CONTENT)}자, 분류={CATEGORY}, 고정=True, 링크={CTA_URL}")
    if not args.apply:
        print("드라이런 — 등록하지 않았습니다. 등록하려면 --apply")
        return 0
    row = sb.table("notices").insert({
        "title": TITLE, "content": CONTENT, "category": CATEGORY, "is_pinned": True,
        "severity": "info", "cta_label": CTA_LABEL, "cta_url": CTA_URL,
    }).execute().data
    print(f"등록 완료 id={row[0]['id'] if row else '?'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
