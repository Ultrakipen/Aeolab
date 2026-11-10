"""공개 FAQ(DB `faqs`) id 7 '구독을 취소하면 어떻게 되나요?'의 환불 안내를 실제 규칙과 맞춘다 — 기본은 드라이런 (2026-11-10).

실제 규칙(routers/settings.py `_check_refund_eligibility`): 구독 시작 7일 이내 + 구독 이후 결과가 저장된 측정·가이드 생성 기록이 없을 때만 자동 전액 환불이며
**정기 자동 측정도 이용으로 센다**. 기존 답변은 "측정·가이드 생성 등 서비스를 이용하지 않은 경우"라고만 해 자동 측정이 포함된다는 점이 보이지 않았다.
문구는 가격 페이지 FAQ·랜딩과 같은 정의를 쓴다(tests/test_refund_copy_consistency.py). 환불 규칙·약관은 바꾸지 않는다. 멱등: 이미 반영돼 있으면 아무것도 하지 않는다.

사용(서버): cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/update_faq_refund_wording.py            # 드라이런
            ... update_faq_refund_wording.py --apply                                                                      # 실제 반영
"""
import argparse
import os
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

FAQ_ID = 7
OLD = "구독 시작일로부터 7일 이내이고 측정·가이드 생성 등 서비스를 이용하지 않은 경우, 청약철회로 전액 자동 환불됩니다."
NEW = ("구독 시작일(결제일)로부터 7일 이내이고 측정·가이드 생성 등 서비스를 이용하지 않은 경우, 청약철회로 전액 자동 환불됩니다. "
       "직접 누른 측정뿐 아니라 요금제에 따라 자동으로 실행되는 정기 측정이 한 번이라도 실행되면 이용한 것으로 봅니다.")


def main() -> int:
    ap = argparse.ArgumentParser(description="FAQ 환불 문구 정렬(기본 드라이런)")
    ap.add_argument("--apply", action="store_true", help="실제로 반영")
    args = ap.parse_args()

    from dotenv import load_dotenv

    load_dotenv(os.path.join(_BACKEND, ".env"))
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    row = sb.table("faqs").select("id, question, answer").eq("id", FAQ_ID).single().execute().data
    answer = row["answer"]
    if NEW in answer:
        print("이미 반영돼 있습니다 — 변경 없음.")
        return 0
    if answer.count(OLD) != 1:
        print("기대한 문장을 한 번 찾지 못했습니다 — 변경하지 않습니다(사람이 확인 필요).")
        return 2
    new_answer = answer.replace(OLD, NEW, 1)
    print(f"FAQ id={FAQ_ID} '{row['question']}' — 문장 1개를 교체합니다(답변 {len(answer)}자 → {len(new_answer)}자).")
    if not args.apply:
        print("드라이런 — 변경하지 않았습니다. 반영하려면 --apply")
        return 0
    sb.table("faqs").update({"answer": new_answer}).eq("id", FAQ_ID).execute()
    print("반영 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
