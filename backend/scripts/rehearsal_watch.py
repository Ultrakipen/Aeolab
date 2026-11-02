"""첫 고객 리허설 관찰 스크립트 (읽기 전용, 2026-11-01).

참가자 이메일을 받아 가입 → 사업장 → 구독 → 스캔 → 알림 진행 상태를 한 화면에 출력한다. DB 쓰기·외부 호출 없음.
전화번호는 마스킹해 출력하고, 어떤 값도 파일로 저장하지 않는다(개인정보를 문서·메모리에 남기지 않는다).

사용(서버): cd /var/www/aeolab/backend && PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/rehearsal_watch.py <참가자 이메일>  (.env는 스크립트가 직접 읽는다 — source 금지)
"""
import sys

from db.supabase_client import get_client


def mask_phone(p):
    d = "".join(ch for ch in str(p or "") if ch.isdigit())
    return f"{d[:3]}****{d[-2:]}" if len(d) >= 7 else ("없음" if not d else "형식오류")


def main(email: str):
    c = get_client()
    user = None
    page = 1
    while True:
        users = c.auth.admin.list_users(page=page, per_page=200)
        if not users:
            break
        user = next((u for u in users if (u.email or "").lower() == email.lower()), None)
        if user or len(users) < 200:
            break
        page += 1
    if not user:
        print("계정 없음:", email)
        return
    uid = user.id
    print(f"[가입] created={str(user.created_at)[:19]}  이메일 인증={'완료 ' + str(user.email_confirmed_at)[:19] if user.email_confirmed_at else '미완료'}  마지막 로그인={str(user.last_sign_in_at)[:19]}")

    prof = (c.table("profiles").select("phone,kakao_scan_notify,kakao_competitor_notify,onboarding_done,basic_trial_used").eq("user_id", uid).execute().data or [{}])[0]
    print(f"[프로필] 전화={mask_phone(prof.get('phone'))}  스캔알림={prof.get('kakao_scan_notify')}  경쟁사알림={prof.get('kakao_competitor_notify')}  온보딩={prof.get('onboarding_done')}  체험사용={prof.get('basic_trial_used')}")

    bizs = c.table("businesses").select("id,name,category,region,keywords,naver_place_id,kakao_registered,is_active,created_at").eq("user_id", uid).execute().data or []
    print(f"[사업장] {len(bizs)}곳")
    for b in bizs:
        print(f"   - {b['name'][:14]} | {b.get('category')} | {b.get('region')} | 키워드 {len(b.get('keywords') or [])}개 | 플레이스ID={'있음' if b.get('naver_place_id') else '없음'} | 카카오={b.get('kakao_registered')} | 활성={b.get('is_active')}")

    subs = c.table("subscriptions").select("plan,status,start_at,end_at,first_payment_amount,first_month_discount_until,created_at").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    print(f"[구독] {len(subs)}건")
    for s in subs:
        print(f"   - {s['plan']} / {s['status']} / 시작 {str(s.get('start_at'))[:16]} / 종료 {str(s.get('end_at'))[:16]} / 첫결제 {s.get('first_payment_amount')}")

    for b in bizs:
        scans = c.table("scan_results").select("scanned_at,query_used,gemini_result,chatgpt_result,naver_result,total_score").eq("business_id", b["id"]).order("scanned_at", desc=True).limit(4).execute().data or []
        print(f"[스캔] {b['name'][:10]} 최근 {len(scans)}건")
        for s in scans:
            g, ch, nv = s.get("gemini_result") or {}, s.get("chatgpt_result") or {}, s.get("naver_result") or {}
            nflag = "오류:" + str(nv.get("error"))[:20] if nv.get("error") else ("차단/캡차" if nv.get("captcha_detected") else "정상")
            print(f"   - {str(s['scanned_at'])[:16]} | Gemini 표본 {g.get('sample_size')}/{g.get('requested_size')} | ChatGPT 표본 {ch.get('sample_size')}/{ch.get('requested_size')} | 네이버 {nflag}")
        al = c.table("business_action_log").select("action_type,action_label,created_at").eq("business_id", b["id"]).order("created_at", desc=True).limit(2).execute().data or []
        print(f"   행동기록 {len(al)}건: " + "; ".join(f"{a['action_type']}" for a in al))

    # 알림 기록은 user_id가 비어 있고 payload에 마스킹된 번호만 있어 끝 2자리로만 대조한다(대략적 표시)
    tail = "".join(ch for ch in str(prof.get("phone") or "") if ch.isdigit())[-2:]
    if tail:
        # 발송 기록은 content 컬럼에 {"phone": "010****46", ...}로 저장된다(kakao_notify._log_notification)
        notes = c.table("notifications").select("type,status,sent_at,content").order("sent_at", desc=True).limit(120).execute().data or []
        mine = [n for n in notes if str((n.get("content") or {}).get("phone", "")).endswith(tail)]
        print(f"[알림] 최근 120건 중 번호 끝 {tail} 일치 {len(mine)}건 (끝 2자리 대조라 다른 번호와 섞일 수 있음, 번호 없이 기록된 건너뜀 행은 대조 불가)")
        for n in mine[:8]:
            print(f"   - {str(n['sent_at'])[:16]} {n['type']} {n['status']}")
    else:
        print("[알림] 전화번호가 없어 알림 대조를 건너뜀")
    sys.stdout.flush()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("사용법: rehearsal_watch.py <참가자 이메일>")
    try:  # .env를 source하지 않고 읽는다(값에 특수문자가 있으면 source가 깨진다 — 프로젝트 규칙)
        import os
        from dotenv import load_dotenv

        load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
    except ImportError:
        pass
    main(sys.argv[1])
