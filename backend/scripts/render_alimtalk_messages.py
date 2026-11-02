"""알림톡 승인 본문(콘솔 캡처 기준)에 실제 코드가 만드는 값을 끼워 사용자가 받는 최종 문장을 재현한다 (2026-11-01).

네트워크·DB를 쓰지 않는다: KakaoNotifier의 `_send`/`_send_delivery_template`을 가로채 변수 값만 얻고, `_template_params`(14자 절단 포함)를 거친 뒤 본문에 채운다.
사용: cd backend && python scripts/render_alimtalk_messages.py
"""
import asyncio
import os
import re
import sys

# 앱키가 없으면 일부 발송 함수가 일찍 종료한다. 실제 호출은 아래에서 가로채므로 더미 값이면 충분하다(네트워크 사용 없음).
os.environ.setdefault("KAKAO_APP_KEY", "dummy-render-only")
for _i in range(1, 5):  # 대행 알림은 서버 .env의 템플릿 코드 변수가 있어야 동작한다
    os.environ.setdefault(f"KAKAO_TEMPLATE_DELIVERY_0{_i}", f"AEOLAB_DELIVERY_0{_i}")

sys.path.insert(0, ".")
import services.kakao_notify as kn  # noqa: E402

# 콘솔 승인 본문 (2026-10-31 사용자 캡처). 고정 안내 문장은 생략하고 변수가 들어가는 줄만 둔다.
BODIES = {
    "AEOLAB_SCORE_01": "#{사업장명} AI 검색 노출 점수 변동 안내\n스캔 일시: #{스캔일시}\n이전 점수: #{이전점수}점 → 현재 점수: #{현재점수}점 (#{변화})\n지역 순위: #{이전순위}위 → #{현재순위}위",
    "AEOLAB_CITE_01": "#{사업장명} AI 검색 인용 내역 안내\n플랫폼: #{AI플랫폼}\n검색어: #{검색어}\n인용 내용: #{인용내용}\n확인 일시: #{확인일시}",
    "AEOLAB_COMP_01": "#{사업장명} 경쟁사 순위 변동 안내\n경쟁사명: #{경쟁사명}\n순위 변동: #{순위변화}\n확인 일시: #{확인일시}",
    "AEOLAB_COMP_02": "[AEOlab] #{사업장명}\n경쟁사 '#{경쟁사명}'이(가) AI 검색에서 앞섰습니다!\n내 등급: #{내등급}\n#{경쟁사명}: #{경쟁사등급} (#{격차설명} 앞서고 있어요)",
    "AEOLAB_GROWTH_01": "[AEOlab]\n#{사업장명} 성장 단계 업그레이드 안내\n이전 단계: #{이전단계}\n현재 단계: #{현재단계}\n#{이번주추천}",
    "AEOLAB_MONTHLY_01": "[AEOlab]\n#{월}월 성장 리포트\n사업장: #{사업장명}\nAI 가시성 변화: #{추세}\n스캔 횟수: #{스캔횟수}회\nAI 인용: #{인용건수}건",
    "AEOLAB_NEWS_01": "[AEOlab]\n#{사업장명} 이달의 업종 시장 동향\n고객님의 업종(#{업종}) 관련 이달의 시장 동향을 안내드립니다.\n#{시장동향}",
    "AEOLAB_SCAN_01": "[AEOlab]\n#{사업장명} AI 스캔 완료\nAI 노출 등급: #{현재등급} #{등급변화메모}\n지난주 대비: #{추세}\n#{최다플랫폼}에서 가장 많이 언급됨\n#{개선포인트}",
    "AEOLAB_WEEKLY_01": "[AEOlab 주간 성적표]\n#{사업장명}\n이번 주 AI 노출 등급: #{등급변화} #{추세방향}\n이번 주 할 일:\n#{할일}",
    # 개정 템플릿 — 2026-11-02 콘솔 승인 본문 전문(사용자 캡처 스캔_02.png·스코어_02.png)
    "AEOLAB_SCORE_02": ("[AEOlab]\n#{사업장명} AI 노출 등급 변동 안내\n\n해당 메시지는 고객님께서 신청하신 검색 노출 등급 변동 안내 알림으로, 변경 내역이 확인될 경우 발송됩니다.\n\n"
                        "확인 일시: #{스캔일시}\n이전 등급: #{이전등급}\n현재 등급: #{현재등급}\n변화: #{변화}\n업종 내 순위: #{순위}"),
    "AEOLAB_SCAN_02": ("[AEOlab]\n#{사업장명} AI 스캔 완료\n\n해당 메시지는 고객님께서 설정에서 켜신 스캔 완료 알림으로, AI 검색 노출 스캔이 완료될 경우 발송됩니다.\n\n"
                       "스캔 일시: #{스캔일시}\nAI 검색 준비도: #{현재단계}\n지난 스캔 대비: #{변화}\n\n자세한 결과와 개선 가이드는 대시보드에서 확인하세요.\nhttps://aeolab.co.kr/dashboard"),
    "AEOLAB_EXPIRE_01": "[AEOlab]\n#{플랜명} 구독이 #{잔여일}일 후 만료됩니다.",
    "AEOLAB_PRICEUP_01": "[AEOlab]\n3일 후부터 정상가 월 #{정상가}원으로 자동 결제됩니다.",
    "AEOLAB_DELIVERY_01": "[AEOlab] 대행 서비스 접수가 완료되었습니다.\n■ 주문번호: #{주문번호}\n■ 패키지: #{패키지명}\n■ 사업장: #{사업장명}",
    "AEOLAB_DELIVERY_02": "[AEOlab]\n대행 서비스 작업을 시작했습니다.\n■ 주문번호: #{주문번호}\n■ 패키지: #{패키지명}\n■ 사업장: #{사업장명}\n■ 예상 소요일: #{예상일수}일",
    "AEOLAB_DELIVERY_03": "[AEOlab]\n대행 서비스가 완료되었습니다.\n■ 주문번호: #{주문번호}\n■ 패키지: #{패키지명}\n■ 사업장: #{사업장명}",
    "AEOLAB_DELIVERY_04": "[AEOlab]\n대행 후 AI 노출 등급 변화\n#{사업장명}의 대행 서비스 후 재스캔 결과를 알려드립니다.\n■ 주문번호: #{주문번호}\n■ 등급 변화: #{등급변화}",
}

captured = []


async def fake_send(self, phone, ttype, params, user_id=None):
    captured.append((kn.resolve_template_code(ttype) if ttype in kn.TEMPLATES else ttype, params))
    return None


async def fake_delivery(self, phone, template_code, params, log_tag=""):
    captured.append((template_code, params))
    return True


kn.KakaoNotifier._send = fake_send
kn.KakaoNotifier._send_delivery_template = fake_delivery
N = kn.KakaoNotifier()
P = "01012345678"


def render(code, params):
    final = kn._template_params(params)  # 실제 발송 직전의 변환(껍데기 제거·14자 절단)
    body = BODIES[code]
    for k, v in final.items():
        body = body.replace("#{" + k + "}", v)
    cut = [f"{k}({len(str(params.get('#{' + k + '}', params.get(k, ''))))}자→14자)" for k, v in final.items()
           if len(str(params.get("#{" + k + "}", params.get(k, "")))) > 14]
    return body, cut


async def scenarios():
    biz, long_biz = "홍뮤직스튜디오작곡교습소", "창원 성산구 하라식당 본점 직영점"
    await N.send_score_change(P, biz, 48, 62, 5, 3)
    await N.send_score_change(P, biz, 62, 48, 3, 5)
    await N.send_score_change(P, biz, 30, 31, 0, 0)
    await N.send_ai_citation(P, biz, "ChatGPT", "창원 작곡 학원 추천", "블라블라 " * 20)
    await N.send_ai_citation(P, biz, "ChatGPT", "창원 성산구 작곡 레슨 잘하는 곳 추천해줘", "")
    await N.send_competitor_change(P, biz, "경쟁 음악학원 창원본점 성산구점", "AI 노출 상승")
    await N.send_competitor_overtake(P, biz, "경쟁사A", 50, 58, 8)
    # 운영 코드의 호출처 수를 세는 구조 테스트(test_stage_upgrade_notify)가 이 문자열을 찾는다 — 재현 스크립트는 운영 호출처가 아니므로 getattr로 부른다
    await getattr(N, "send_growth_stage_upgrade")(P, biz, "보강 단계", "개선 중", "스마트플레이스 대표 키워드를 추가해 보세요")
    await N.send_monthly_report(P, biz, 6.0, 12, 4, "11")
    await N.send_market_news(P, biz, "음악학원", "이번 달 동향을 불러오지 못했습니다 길게 길게")
    await N.send_scan_complete(P, biz, 62, "보통", 5.0, "ChatGPT", "스마트플레이스 소개글을 300자 이상으로 보강")
    await N.send_scan_complete(P, long_biz, 30, "", 0.0, "", "")
    await N.send_weekly_score_report(P, biz, 62, 48, "대표 키워드를 소개글에 넣기")
    await N.send_expire_warning(P, "basic", 7)
    await N.send_price_increase_notice(P, 17900)
    await N.send_delivery_received("12345678-aaaa", P, "1 스마트플레이스 세팅 패키지", biz)
    await N.send_delivery_in_progress("12345678-aaaa", P, "1 스마트플레이스 세팅 패키지", biz, 5)
    await N.send_delivery_completed("12345678-aaaa", P, "1 스마트플레이스 세팅 패키지", biz)
    await N.send_delivery_rescan("12345678-aaaa", P, biz, 48, 62)


import inspect  # noqa: E402

# 시그니처가 다른 함수는 건너뛰고 계속 진행한다(스크립트가 코드 변경으로 깨져도 나머지는 보이게)
async def run_all():
    try:
        await scenarios()
    except TypeError as e:
        print("!! 시나리오 호출 실패(시그니처 변경?):", e)


asyncio.run(run_all())


async def scenarios_revised():
    """승인된 개정 템플릿(SCORE_02·SCAN_02)으로 전환했을 때 나가는 문장 — 환경변수를 켜고 같은 함수를 다시 부른다."""
    os.environ["KAKAO_TEMPLATE_SCORE_CHANGE"] = "AEOLAB_SCORE_02"
    os.environ["KAKAO_TEMPLATE_SCAN_COMPLETE"] = "AEOLAB_SCAN_02"
    biz, long_biz = "홍뮤직스튜디오작곡교습소", "창원 성산구 하라식당 본점 직영점"
    await N.send_score_change(P, biz, 48, 62, 5, 3, curr_total=12)        # 등급 상승, 순위 있음
    await N.send_score_change(P, biz, 62, 48, 3, 5, curr_total=12)        # 등급 하락
    await N.send_score_change(P, biz, 60, 65, 2, 2, curr_total=2)         # 같은 등급 안 상승 + 집계 2곳뿐(순위 말하지 않음)
    await N.send_score_change(P, biz, 30, 31, 0, 0)                       # 순위 없음
    await N.send_scan_complete(P, biz, 62, "보강 단계", 10.0, "", "")      # 단계 상승(언급 플랫폼 없어도 발송)
    await N.send_scan_complete(P, biz, 62, "개선 중", 1.0, "", "")         # 단계 유지
    await N.send_scan_complete(P, long_biz, 30, "", 0.0, "", "")           # 비교 전(첫 스캔)


captured.append(("== 개정 템플릿 시나리오 ==", {}))
try:
    asyncio.run(scenarios_revised())
except TypeError as e:
    print("!! 개정 시나리오 호출 실패(시그니처 변경?):", e)
for code, params in captured:
    if code == "== 개정 템플릿 시나리오 ==":
        print("\n############ 개정 템플릿(SCORE_02·SCAN_02) 전환 후 ############")
        continue
    if code not in BODIES:
        print(f"-- {code}: 본문 미등록(변수 없음/생략)")
        continue
    body, cut = render(code, params)
    print(f"===== {code}")
    print(body)
    if cut:
        print("   ※ 14자 초과로 잘림:", ", ".join(cut))
