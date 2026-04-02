"""
팔로업 이메일 발송 서비스 (Resend API)
무료 체험 후 수집된 이메일로 유료 전환 시퀀스 발송
"""
import os
import logging
from datetime import date, timedelta

logger = logging.getLogger("aeolab")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@aeolab.co.kr")


def _get_resend():
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY 미설정")
    import resend as _resend
    _resend.api_key = RESEND_API_KEY
    return _resend


def _day1_html(business_name: str, category: str, score: float) -> tuple[str, str]:
    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"
    subject = f"[{business_name}] AI 검색 분석 결과 요약"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px;">AI 검색 분석 결과</p>
    <h1 style="color:#ffffff; font-size:28px; margin:0 0 8px;">{business_name}</h1>
    <div style="background:rgba(255,255,255,0.15); border-radius:8px; display:inline-block; padding:8px 20px;">
      <span style="color:#ffffff; font-size:40px; font-weight:bold;">{score:.0f}점</span>
      <span style="color:#bfdbfe; font-size:20px; margin-left:6px;">(등급 {grade})</span>
    </div>
  </div>

  <p style="font-size:15px; line-height:1.7;">안녕하세요,<br>
  <strong>{business_name}</strong>의 AI 검색 노출 분석이 완료됐습니다.</p>

  <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; margin:20px 0;">
    <p style="font-size:13px; color:#64748b; margin:0 0 8px; font-weight:600;">지금 당장 할 수 있는 1가지 행동</p>
    <p style="font-size:15px; color:#1e293b; margin:0; font-weight:500;">
      네이버 스마트플레이스에서 FAQ를 1개 이상 등록하세요.<br>
      <span style="color:#2563eb; font-size:13px;">AI 브리핑이 FAQ를 가장 직접적으로 인용합니다.</span>
    </p>
  </div>

  <div style="text-align:center; margin-top:28px;">
    <a href="https://aeolab.co.kr/trial" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600;">
      내 가게 점수 다시 확인하기
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:32px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
    return subject, body


def _day3_html(business_name: str, category: str, score: float, avg_score: float) -> tuple[str, str]:
    subject = f"같은 업종 평균 점수와 {business_name}을(를) 비교해봤습니다"
    diff = score - avg_score
    diff_text = f"+{diff:.0f}점 높음" if diff > 0 else f"{diff:.0f}점 낮음"
    diff_color = "#16a34a" if diff > 0 else "#dc2626"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <h2 style="font-size:20px; margin:0 0 16px;">같은 업종 평균과 비교</h2>

  <div style="display:flex; gap:12px; margin-bottom:24px;">
    <div style="flex:1; background:#eff6ff; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#3b82f6; margin:0 0 4px; font-weight:600;">{business_name}</p>
      <p style="font-size:28px; font-weight:bold; color:#1d4ed8; margin:0;">{score:.0f}점</p>
    </div>
    <div style="flex:1; background:#f8fafc; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#64748b; margin:0 0 4px; font-weight:600;">업종 평균</p>
      <p style="font-size:28px; font-weight:bold; color:#475569; margin:0;">{avg_score:.0f}점</p>
    </div>
  </div>

  <p style="font-size:15px;">
    현재 업종 평균 대비 <strong style="color:{diff_color};">{diff_text}</strong>입니다.
  </p>

  <div style="background:#fefce8; border:1px solid #fde047; border-radius:10px; padding:16px 20px; margin:20px 0;">
    <p style="font-size:13px; color:#854d0e; font-weight:600; margin:0 0 6px;">상위 10% 기준</p>
    <p style="font-size:15px; color:#713f12; margin:0;">
      경쟁 상위 10% 가게의 평균 점수는 <strong>75점 이상</strong>입니다.<br>
      FAQ 3개 + 리뷰 50개 이상이 공통 조건입니다.
    </p>
  </div>

  <div style="text-align:center; margin-top:28px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600;">
      유료 플랜으로 경쟁사 비교 시작하기
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:32px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
    return subject, body


def _day7_html(business_name: str, category: str) -> tuple[str, str]:
    _CATEGORY_KEYWORDS: dict[str, list[str]] = {
        "restaurant": ["맛집 추천", "점심 메뉴", "혼밥 가능한 곳"],
        "cafe": ["카페 추천", "공부하기 좋은 카페", "조용한 카페"],
        "beauty": ["미용실 추천", "헤어 스타일", "염색 잘하는 곳"],
        "clinic": ["병원 추천", "진료 시간", "주차 가능한 병원"],
        "academy": ["학원 추천", "과외 선생님", "소규모 학원"],
        "fitness": ["헬스장 추천", "PT 추천", "24시 헬스"],
        "pet": ["반려동물 용품", "동물병원 추천", "애완동물 미용"],
    }
    keywords = _CATEGORY_KEYWORDS.get(category, ["추천", "후기", "가격"])
    subject = f"이번 주 손님들이 AI에 검색한 키워드 TOP3 — {business_name}"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <h2 style="font-size:20px; margin:0 0 16px;">이번 주 AI 검색 키워드 TOP 3</h2>
  <p style="font-size:14px; color:#64748b; margin:0 0 20px;">
    같은 업종 소상공인 고객들이 AI에 가장 많이 검색하는 키워드입니다.
  </p>

  <div style="space-y:8px;">
    {"".join(f'''
    <div style="background:#f8fafc; border-left:3px solid #1d4ed8; border-radius:0 8px 8px 0; padding:12px 16px; margin-bottom:8px;">
      <span style="font-size:16px; font-weight:600; color:#1e293b;">{i+1}. &ldquo;{kw}&rdquo;</span>
    </div>''' for i, kw in enumerate(keywords[:3]))}
  </div>

  <div style="background:#eff6ff; border-radius:10px; padding:16px 20px; margin:24px 0;">
    <p style="font-size:13px; color:#1d4ed8; font-weight:600; margin:0 0 6px;">
      이 키워드로 노출되려면?
    </p>
    <p style="font-size:14px; color:#1e3a8a; margin:0;">
      스마트플레이스 FAQ에 이 키워드가 들어간 Q&A를 등록하세요.<br>
      네이버 AI 브리핑은 FAQ를 가장 자주 인용합니다.
    </p>
  </div>

  <div style="text-align:center; margin-top:28px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700;">
      유료 플랜으로 내 가게 키워드 분석하기
    </a>
    <p style="font-size:12px; color:#94a3b8; margin-top:8px;">Basic 9,900원/월부터 · 언제든 해지 가능</p>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:32px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
    return subject, body


async def send_trial_followup(
    email: str,
    business_name: str,
    category: str,
    region: str,
    score: float,
    day: int,
) -> bool:
    """무료 체험 팔로업 이메일 발송.

    Args:
        day: 1 | 3 | 7

    Returns:
        True if sent successfully
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY 미설정 — 이메일 발송 건너뜀")
        return False

    try:
        _resend = _get_resend()
        avg_score = 42.0  # 업종 평균 기본값 (실제로는 DB에서 조회)

        if day == 1:
            subject, html = _day1_html(business_name, category, score)
        elif day == 3:
            subject, html = _day3_html(business_name, category, score, avg_score)
        elif day == 7:
            subject, html = _day7_html(business_name, category)
        else:
            return False

        params = {
            "from": f"AEOlab <{FROM_EMAIL}>",
            "to": [email],
            "subject": subject,
            "html": html,
        }
        _resend.Emails.send(params)
        logger.info(f"팔로업 이메일 발송: {email} day={day} score={score}")
        return True

    except Exception as e:
        logger.error(f"팔로업 이메일 발송 실패 ({email} day={day}): {e}")
        return False
