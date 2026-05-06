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


def _mask_email(e: str) -> str:
    """이메일 주소 마스킹 — 로그 PII 보호용 (예: abc***@example.com)"""
    if not e or "@" not in e:
        return "***"
    head, _, dom = e.partition("@")
    return f"{head[:3]}***@{dom}"


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
      스마트플레이스 소개글 안 Q&A 섹션에 이 키워드를 추가하세요.<br>
      네이버 AI 브리핑은 소개글 Q&A를 인용 후보로 가장 자주 활용합니다.
    </p>
  </div>

  <div style="text-align:center; margin-top:28px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700;">
      유료 플랜으로 내 가게 키워드 분석하기
    </a>
    <p style="font-size:12px; color:#94a3b8; margin-top:8px;">Basic 7,900원/월부터 · 언제든 해지 가능</p>
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
    """무료 체험 팔로업 이메일 발송 (aiohttp 기반 — resend SDK blocking 호출 대체).

    Args:
        day: 1 | 3 | 7

    Returns:
        True if sent successfully
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY 미설정 — 이메일 발송 건너뜀")
        return False

    import aiohttp as _aiohttp

    try:
        avg_score = 42.0  # 업종 평균 기본값

        if day == 1:
            subject, html = _day1_html(business_name, category, score)
        elif day == 3:
            subject, html = _day3_html(business_name, category, score, avg_score)
        elif day == 7:
            subject, html = _day7_html(business_name, category)
        else:
            return False

        async with _aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"AEOlab <{FROM_EMAIL}>",
                    "to": [email],
                    "subject": subject,
                    "html": html,
                },
                timeout=_aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status in (200, 201):
                    logger.info(f"팔로업 이메일 발송 OK: {_mask_email(email)} day={day} score={score:.1f}")
                    return True
                body_text = await resp.text()
                logger.warning(f"팔로업 이메일 Resend 오류 status={resp.status}: {body_text[:200]}")
                return False

    except Exception as e:
        logger.error(f"팔로업 이메일 발송 실패 ({_mask_email(email)} day={day}): {e}")
        return False


# ─── aiohttp 기반 범용 이메일 발송 ────────────────────────────────────────────

import aiohttp as _aiohttp


async def send_email(to: str, subject: str, html: str) -> bool:
    """Resend API를 통한 HTML 이메일 발송 (async).

    Args:
        to: 수신자 이메일
        subject: 메일 제목
        html: HTML 본문

    Returns:
        True if 발송 성공, False otherwise
    """
    if not RESEND_API_KEY:
        logger.warning("send_email: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"AEOlab <{FROM_EMAIL}>",
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=_aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status in (200, 201):
                    logger.info(f"send_email OK: to={_mask_email(to)} subject='{subject[:30]}'")
                    return True
                body = await resp.text()
                logger.warning(f"send_email Resend 오류 status={resp.status}: {body[:200]}")
                return False
    except Exception as e:
        logger.warning(f"send_email 예외: {e}")
        return False


# ─── 웰컴 약속 이메일 + 첫 노출 축하 이메일 ────────────────────────────────────


async def send_welcome_promise_email(
    email: str,
    biz_name: str,
    category: str = "",
    unified_score: float | None = None,
    region: str = "",
) -> bool:
    """사업장 첫 등록 완료 시 → '7일 후 변화 확인' 약속 이메일"""
    if not RESEND_API_KEY:
        logger.warning("send_welcome_promise_email: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not email:
        logger.warning("send_welcome_promise_email: 이메일 주소 없음 — 발송 건너뜀")
        return False

    score_section = ""
    if unified_score is not None:
        grade = "A" if unified_score >= 80 else "B" if unified_score >= 60 else "C" if unified_score >= 40 else "D"
        score_section = f"""
  <div style="background:#eff6ff; border-radius:10px; padding:16px 20px; margin-bottom:20px; text-align:center;">
    <p style="font-size:13px; color:#3b82f6; margin:0 0 4px; font-weight:600;">오늘 AI 노출 점수</p>
    <p style="font-size:32px; font-weight:bold; color:#1d4ed8; margin:0;">{unified_score:.0f}점 ({grade}등급)</p>
  </div>"""
    else:
        score_section = """
  <div style="background:#fefce8; border:1px solid #fde047; border-radius:10px; padding:14px 18px; margin-bottom:20px;">
    <p style="font-size:14px; color:#854d0e; margin:0;">첫 AI 스캔이 곧 실행됩니다 — 새벽 2시 자동 스캔 후 점수를 확인하세요.</p>
  </div>"""

    subject = f"[AEOlab] {biz_name} AI 노출 분석 완료 — 7일 후 결과를 알려드립니다"
    html = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:20px 24px; margin-bottom:24px;">
    <p style="color:#bfdbfe; font-size:12px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0;">{biz_name} 등록 완료</h1>
  </div>

  {score_section}

  <p style="font-size:15px; line-height:1.8; margin:0 0 20px;">
    <strong>{biz_name}</strong>이(가) AEOlab에 등록되었습니다.<br>
    매주 AI 검색 노출 현황을 자동으로 분석해 드립니다.
  </p>

  <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:16px 20px; margin-bottom:20px;">
    <p style="font-size:13px; color:#166534; font-weight:700; margin:0 0 8px;">지금 당장 할 1가지</p>
    <p style="font-size:15px; color:#14532d; margin:0; line-height:1.7;">
      <strong>스마트플레이스 소개글에 Q&A 1개 추가</strong><br>
      <span style="font-size:13px; color:#166534;">소개글 안 Q&A 섹션은 AI 브리핑 인용 후보로 가장 자주 활용됩니다.<br>추가하면 7일 후 AI가 내 가게를 인식했는지 자동으로 확인해 드립니다.</span>
    </p>
  </div>

  <div style="text-align:center; margin:28px 0;">
    <a href="https://smartplace.naver.com" style="background:#03c75a; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">
      스마트플레이스 소개글 편집하러 가기
    </a>
  </div>

  <div style="border-top:1px solid #e2e8f0; padding-top:16px; margin-top:16px;">
    <p style="font-size:13px; color:#475569; margin:0;">
      AEOlab 대시보드에서 지금 바로 개선 가이드 확인<br>
      → <a href="https://aeolab.co.kr/guide" style="color:#1d4ed8;">https://aeolab.co.kr/guide</a>
    </p>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a> · 구독 해지는 대시보드 설정에서
  </p>
</div>
"""
    return await send_email(email, subject, html)


async def send_trial_claim_link(
    to_email: str,
    magic_link: str,
    trial_summary: dict,
) -> bool:
    """무료 체험 결과 보관/회원가입 매직 링크 메일 (v3.6 트라이얼 클레임 깔때기).

    Args:
        to_email:        수신 이메일
        magic_link:      Supabase Auth signup/magiclink action_link (또는 fallback /signup URL)
        trial_summary:   {"business_name", "category", "region", "score", "grade"}

    Returns:
        True if 발송 OK
    """
    if not RESEND_API_KEY:
        logger.warning("send_trial_claim_link: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not to_email or not magic_link:
        logger.warning("send_trial_claim_link: 인자 누락 — 발송 건너뜀")
        return False

    biz_name = trial_summary.get("business_name") or "내 가게"
    region = trial_summary.get("region") or ""
    category = trial_summary.get("category") or ""
    score = float(trial_summary.get("score") or 0)
    grade = trial_summary.get("grade") or (
        "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"
    )

    subject = f"AEOlab 진단 결과를 30일 보관하시려면 이 링크를 클릭하세요 — {biz_name}"
    region_label = f" · {region}" if region else ""
    cat_label = f" · {category}" if category else ""

    html = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px;">AI 검색 진단 결과</p>
    <h1 style="color:#ffffff; font-size:24px; margin:0 0 6px;">{biz_name}</h1>
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 12px;">{region_label}{cat_label}</p>
    <div style="background:rgba(255,255,255,0.15); border-radius:8px; display:inline-block; padding:10px 24px;">
      <span style="color:#ffffff; font-size:36px; font-weight:bold;">{score:.0f}점</span>
      <span style="color:#bfdbfe; font-size:18px; margin-left:6px;">(등급 {grade})</span>
    </div>
  </div>

  <p style="font-size:15px; line-height:1.7; margin:0 0 16px;">
    <strong>{biz_name}</strong>의 AI 검색 노출 진단이 완료됐습니다.<br>
    아래 버튼으로 회원가입하시면 진단 결과를 <strong>30일간 보관</strong>하고
    매주 자동 재진단으로 변화를 추적해 드립니다.
  </p>

  <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; margin:20px 0;">
    <p style="font-size:13px; color:#64748b; margin:0 0 6px; font-weight:600;">회원가입 시 추가 혜택</p>
    <ul style="font-size:14px; color:#1e293b; margin:0; padding-left:18px; line-height:1.7;">
      <li>이번 진단 결과 영구 보관 (스크린샷·점수 추세선)</li>
      <li>경쟁사 자동 비교 분석</li>
      <li>맞춤 개선 가이드 (FAQ·리뷰 답변 초안 포함)</li>
      <li>첫 달 50% 할인 — Basic 4,950원</li>
    </ul>
  </div>

  <div style="text-align:center; margin:28px 0;">
    <a href="{magic_link}" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; display:inline-block;">
      진단 결과 보관하고 시작하기
    </a>
    <p style="font-size:12px; color:#94a3b8; margin-top:10px;">
      링크는 24시간 동안 유효합니다.
    </p>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center; line-height:1.6;">
    이 메일은 회원님이 <a href="https://aeolab.co.kr/trial" style="color:#94a3b8;">aeolab.co.kr/trial</a>에서
    무료 진단을 신청하시면서 직접 입력하신 이메일로 발송됐습니다.<br>
    수신을 원치 않으시면 답장으로 알려주세요.
  </p>
</div>
"""
    return await send_email(to_email, subject, html)


# ─── 가입 후 미결제 사용자 전환 알림 시퀀스 (D+7/14/30) ─────────────────────


def _conversion_d7_html() -> tuple[str, str]:
    subject = "[AEOlab] 경쟁 가게는 지금 AI에 나오고 있어요"
    body = """
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0;">가입 후 7일이 지났습니다</h1>
  </div>

  <p style="font-size:15px; line-height:1.8; margin:0 0 20px;">
    안녕하세요,<br>
    AEOlab에 가입하신 지 일주일이 됐는데, 아직 AI 노출 점수를 확인하지 못하셨네요.
  </p>

  <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px 20px; margin-bottom:20px;">
    <p style="font-size:14px; color:#991b1b; font-weight:600; margin:0 0 8px;">지금 이 순간에도 경쟁 가게는:</p>
    <ul style="font-size:14px; color:#7f1d1d; margin:0; padding-left:18px; line-height:1.9;">
      <li>네이버 AI 브리핑에 노출되어 새 손님을 받고 있어요</li>
      <li>ChatGPT 검색에서 먼저 추천되고 있어요</li>
      <li>AI 검색 점수를 매주 자동으로 쌓고 있어요</li>
    </ul>
  </div>

  <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:16px 20px; margin-bottom:24px;">
    <p style="font-size:13px; color:#166534; font-weight:700; margin:0 0 6px;">Basic 플랜으로 할 수 있는 것</p>
    <ul style="font-size:14px; color:#14532d; margin:0; padding-left:18px; line-height:1.9;">
      <li>AI 검색 노출 점수 자동 측정 (매주)</li>
      <li>경쟁 가게와 내 가게 점수 비교</li>
      <li>맞춤 개선 가이드 (FAQ·리뷰 답변 초안)</li>
    </ul>
  </div>

  <div style="background:#eff6ff; border-radius:10px; padding:16px 20px; margin-bottom:28px; text-align:center;">
    <p style="font-size:13px; color:#1d4ed8; margin:0 0 4px; font-weight:600;">첫 달 50% 할인 중</p>
    <p style="font-size:28px; font-weight:bold; color:#1d4ed8; margin:0;">월 4,950원</p>
    <p style="font-size:12px; color:#64748b; margin:4px 0 0;">이후 9,900원/월 · 언제든 해지 가능</p>
  </div>

  <div style="text-align:center; margin-bottom:32px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:700; display:inline-block;">
      지금 시작하기 →
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center; line-height:1.6;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a><br>
    수신을 원치 않으시면 답장으로 알려주세요.
  </p>
</div>
"""
    return subject, body


def _conversion_d14_html() -> tuple[str, str]:
    subject = "[AEOlab] 2주가 지났어요 — 업종 평균 점수를 확인해 보세요"
    body = """
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0;">가입 2주 — 업종 평균이 궁금하지 않으세요?</h1>
  </div>

  <p style="font-size:15px; line-height:1.8; margin:0 0 20px;">
    같은 업종 사업장들의 평균 AI 노출 점수를 공개합니다.<br>
    내 가게는 지금 어느 위치에 있을까요?
  </p>

  <div style="background:#f8fafc; border-radius:10px; padding:20px; margin-bottom:20px;">
    <p style="font-size:13px; color:#64748b; margin:0 0 12px; font-weight:600; text-align:center;">업종별 평균 AI 노출 점수 (2026년 4월 기준)</p>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <div style="flex:1; min-width:120px; background:#eff6ff; border-radius:8px; padding:12px; text-align:center;">
        <p style="font-size:12px; color:#3b82f6; margin:0 0 4px;">음식점·카페</p>
        <p style="font-size:22px; font-weight:bold; color:#1d4ed8; margin:0;">38점</p>
      </div>
      <div style="flex:1; min-width:120px; background:#f0fdf4; border-radius:8px; padding:12px; text-align:center;">
        <p style="font-size:12px; color:#16a34a; margin:0 0 4px;">뷰티·헬스</p>
        <p style="font-size:22px; font-weight:bold; color:#15803d; margin:0;">42점</p>
      </div>
      <div style="flex:1; min-width:120px; background:#fefce8; border-radius:8px; padding:12px; text-align:center;">
        <p style="font-size:12px; color:#854d0e; margin:0 0 4px;">법률·부동산</p>
        <p style="font-size:22px; font-weight:bold; color:#713f12; margin:0;">51점</p>
      </div>
    </div>
    <p style="font-size:12px; color:#94a3b8; margin:12px 0 0; text-align:center;">상위 10%: 75점 이상 · 하위 30%: 25점 이하</p>
  </div>

  <div style="background:#fef2f2; border-radius:10px; padding:14px 18px; margin-bottom:20px;">
    <p style="font-size:14px; color:#991b1b; margin:0; line-height:1.7;">
      평균 38~51점 안에 들려면 <strong>스마트플레이스 소개글 안 Q&A 3개 이상</strong>과<br>
      <strong>리뷰 30개 이상</strong>이 기본 조건입니다.
    </p>
  </div>

  <div style="background:#eff6ff; border-radius:10px; padding:16px 20px; margin-bottom:28px;">
    <p style="font-size:13px; color:#1d4ed8; font-weight:600; margin:0 0 8px;">Basic 플랜 주요 혜택</p>
    <ul style="font-size:14px; color:#1e3a8a; margin:0; padding-left:18px; line-height:1.9;">
      <li>매주 AI 노출 점수 자동 측정 + 30일 추이 그래프</li>
      <li>경쟁사 3곳 점수 비교 분석</li>
      <li>내 업종 평균 대비 순위 확인</li>
    </ul>
    <p style="font-size:13px; color:#1d4ed8; margin:10px 0 0; font-weight:700;">첫 달 4,950원 (이후 9,900원/월)</p>
  </div>

  <div style="text-align:center; margin-bottom:32px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:700; display:inline-block;">
      내 순위 확인하러 가기 →
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center; line-height:1.6;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a><br>
    수신을 원치 않으시면 답장으로 알려주세요.
  </p>
</div>
"""
    return subject, body


def _conversion_d30_html() -> tuple[str, str]:
    subject = "[AEOlab] 마지막 안내 — 첫 달 50% 할인이 기다리고 있어요"
    body = """
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%); border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#e0e7ff; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0 0 8px;">마지막 안내드립니다</h1>
    <p style="color:#c7d2fe; font-size:14px; margin:0;">가입 후 30일 — 이 메일 이후 추가 안내 없어요</p>
  </div>

  <p style="font-size:15px; line-height:1.8; margin:0 0 20px;">
    한 달 동안 여러 번 안내드렸는데 불편하셨다면 죄송합니다.<br>
    마지막으로 딱 한 가지만 말씀드릴게요.
  </p>

  <div style="background:#fef2f2; border:2px solid #fca5a5; border-radius:10px; padding:18px 20px; margin-bottom:20px; text-align:center;">
    <p style="font-size:14px; color:#991b1b; margin:0 0 8px; font-weight:600;">첫 달 50% 할인은 지금만 해당돼요</p>
    <p style="font-size:36px; font-weight:bold; color:#dc2626; margin:0;">4,950원</p>
    <p style="font-size:14px; color:#991b1b; margin:4px 0 0;">/ 첫 달 · 이후 9,900원/월 · 언제든 해지 가능</p>
  </div>

  <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; margin-bottom:24px;">
    <p style="font-size:13px; color:#475569; margin:0 0 10px; font-weight:600;">AEOlab이 소상공인 사장님께 드리는 것</p>
    <ul style="font-size:14px; color:#1e293b; margin:0; padding-left:18px; line-height:2.0;">
      <li>네이버·ChatGPT에서 내 가게 노출 점수 (매주 자동)</li>
      <li>경쟁 가게와의 실시간 비교</li>
      <li>AI가 내 가게를 인식하도록 돕는 개선 가이드</li>
    </ul>
  </div>

  <div style="text-align:center; margin-bottom:32px;">
    <a href="https://aeolab.co.kr/pricing" style="background:#dc2626; color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:16px; font-weight:700; display:inline-block;">
      첫 달 4,950원으로 시작하기 →
    </a>
    <p style="font-size:12px; color:#94a3b8; margin-top:10px;">이 안내는 더 이상 발송되지 않습니다.</p>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center; line-height:1.6;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a><br>
    수신을 원치 않으시면 답장으로 알려주세요.
  </p>
</div>
"""
    return subject, body


async def send_conversion_followup(
    email: str,
    day: int,
) -> bool:
    """가입 후 미결제 사용자 전환 유도 이메일 (D+7/14/30).

    Args:
        email: 수신자 이메일
        day:   7 | 14 | 30

    Returns:
        True if 발송 성공
    """
    if day == 7:
        subject, html = _conversion_d7_html()
    elif day == 14:
        subject, html = _conversion_d14_html()
    elif day == 30:
        subject, html = _conversion_d30_html()
    else:
        logger.warning(f"send_conversion_followup: 지원하지 않는 day={day}")
        return False

    return await send_email(email, subject, html)


async def send_first_exposure_email(
    email: str,
    biz_name: str,
    platform: str = "네이버 AI 브리핑",
) -> bool:
    """처음으로 AI에 노출됐을 때 축하 이메일"""
    if not RESEND_API_KEY:
        logger.warning("send_first_exposure_email: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not email:
        logger.warning("send_first_exposure_email: 이메일 주소 없음 — 발송 건너뜀")
        return False

    subject = f"[AEOlab] {biz_name}이(가) 처음으로 AI 검색에 나타났습니다"
    html = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%); border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#e0e7ff; font-size:13px; margin:0 0 8px;">AI 검색 노출 달성</p>
    <h1 style="color:#ffffff; font-size:24px; margin:0 0 4px;">{biz_name}</h1>
    <p style="color:#c7d2fe; font-size:15px; margin:0;">처음으로 <strong style="color:#ffffff;">{platform}</strong>에 노출되었습니다!</p>
  </div>

  <div style="background:#f0fdf4; border:2px solid #86efac; border-radius:10px; padding:18px 20px; margin-bottom:20px;">
    <p style="font-size:15px; color:#14532d; margin:0; line-height:1.8;">
      스마트플레이스 최적화 작업이 효과를 내고 있습니다.<br>
      <strong>AI가 이제 {biz_name}을(를) 알아보기 시작했습니다.</strong>
    </p>
  </div>

  <p style="font-size:14px; color:#475569; line-height:1.8; margin:0 0 20px;">
    첫 노출은 시작에 불과합니다. 더 많은 AI 플랫폼에 지속적으로 노출되려면<br>
    FAQ 추가·리뷰 답변·소식 업데이트를 꾸준히 유지하세요.
  </p>

  <div style="text-align:center; margin:28px 0;">
    <a href="https://aeolab.co.kr/guide" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">
      더 많은 AI에 노출되는 방법 보기
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
    return await send_email(email, subject, html)


# ─── 구독자 주간 다이제스트 ──────────────────────────────────────────────────


def _weekly_digest_html(
    business_name: str,
    current_score: float,
    prev_score: float | None,
    ai_citations_count: int,
    top_keywords: list[str],
) -> tuple[str, str]:
    subject = f"[AEOlab] {business_name} 이번 주 AI 노출 현황"

    # 전주 대비 변화 표시
    if prev_score is not None:
        delta = current_score - prev_score
        if delta > 0:
            delta_html = (
                f'<span style="font-size:18px; color:#16a34a; font-weight:600; margin-left:10px;">▲ +{delta:.1f}점</span>'
            )
        elif delta < 0:
            delta_html = (
                f'<span style="font-size:18px; color:#dc2626; font-weight:600; margin-left:10px;">▼ {delta:.1f}점</span>'
            )
        else:
            delta_html = (
                '<span style="font-size:18px; color:#64748b; font-weight:600; margin-left:10px;">변화 없음</span>'
            )
    else:
        delta_html = '<span style="font-size:14px; color:#bfdbfe; margin-left:10px;">첫 주 측정</span>'

    # 키워드 섹션 (있을 때만)
    if top_keywords:
        kw_text = ", ".join(top_keywords[:5])
        keywords_section = f"""
  <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; margin:16px 0;">
    <p style="font-size:13px; color:#64748b; margin:0 0 6px; font-weight:600;">등록된 주요 키워드</p>
    <p style="font-size:15px; color:#1e293b; margin:0; line-height:1.7;">{kw_text}</p>
  </div>"""
    else:
        keywords_section = ""

    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">이번 주 AI 검색 노출 현황</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0 0 12px;">{business_name}</h1>
    <div style="background:rgba(255,255,255,0.15); border-radius:8px; display:inline-flex; align-items:center; padding:10px 24px;">
      <span style="color:#ffffff; font-size:40px; font-weight:bold;">{current_score:.0f}점</span>
      {delta_html}
    </div>
  </div>

  <div style="display:flex; gap:12px; margin-bottom:20px;">
    <div style="flex:1; background:#eff6ff; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#3b82f6; margin:0 0 4px; font-weight:600;">이번 주 AI 언급</p>
      <p style="font-size:28px; font-weight:bold; color:#1d4ed8; margin:0;">{ai_citations_count}건</p>
    </div>
    <div style="flex:1; background:#f0fdf4; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#16a34a; margin:0 0 4px; font-weight:600;">현재 AI 노출 점수</p>
      <p style="font-size:28px; font-weight:bold; color:#15803d; margin:0;">{current_score:.0f}점</p>
    </div>
  </div>

  {keywords_section}

  <div style="background:#fffbeb; border-left:3px solid #f59e0b; border-radius:6px; padding:14px 16px; margin:16px 0;">
    <p style="font-size:13px; color:#92400e; margin:0 0 4px; font-weight:700;">2026-05-04 점수 모델 v3.0.1 갱신 안내</p>
    <p style="font-size:13px; color:#78350f; margin:0; line-height:1.6;">
      한국 사용자 인지도가 높은 ChatGPT를 Gemini와 동등하게 측정하도록 자동 스캔을 50/50으로 갱신했습니다.
      절대 점수가 변동될 수 있으나, 동일 산식으로 비교되므로 추세 비교에는 영향 없습니다.
    </p>
  </div>

  <div style="text-align:center; margin:28px 0;">
    <a href="https://aeolab.co.kr/dashboard" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; display:inline-block;">
      대시보드에서 전체 보기
    </a>
  </div>

  <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center; line-height:1.6;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a><br>
    수신 거부는 대시보드 설정에서
  </p>
</div>
"""
    return subject, body


async def send_weekly_digest(
    to_email: str,
    business_name: str,
    current_score: float,
    prev_score: float | None,
    ai_citations_count: int,
    top_keywords: list[str],
    biz_id: str,
) -> bool:
    """구독자 주간 AI 노출 현황 다이제스트 이메일 발송.

    Args:
        to_email:           수신 이메일
        business_name:      사업장명
        current_score:      이번 주 unified_score
        prev_score:         전주 unified_score (없으면 None)
        ai_citations_count: 최근 7일 AI 언급 건수
        top_keywords:       사업장 등록 키워드 (최대 5개 표시)
        biz_id:             사업장 ID (로깅용)

    Returns:
        True if 발송 성공
    """
    if not RESEND_API_KEY:
        logger.warning("send_weekly_digest: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not to_email:
        logger.warning(f"send_weekly_digest: 이메일 없음 biz_id={biz_id} — 발송 건너뜀")
        return False

    try:
        subject, html = _weekly_digest_html(
            business_name=business_name,
            current_score=current_score,
            prev_score=prev_score,
            ai_citations_count=ai_citations_count,
            top_keywords=top_keywords,
        )
        ok = await send_email(to_email, subject, html)
        if ok:
            logger.info(
                f"send_weekly_digest OK: biz_id={biz_id} to={_mask_email(to_email)} "
                f"score={current_score:.1f} citations={ai_citations_count}"
            )
        return ok
    except Exception as e:
        logger.warning(f"send_weekly_digest 예외 biz_id={biz_id}: {e}")
        return False


async def send_v31_migration_email(profile_email: str, business_data: dict) -> bool:
    """v3.1 점수 모델 전환 안내 이메일 (SCORE_MODEL_VERSION=v3_1 토글 ON 시 1회 발송).

    Args:
        profile_email:  수신 이메일
        business_data:  {"name": str, "category": str}

    Returns:
        True if 발송 성공
    """
    if not RESEND_API_KEY:
        logger.warning("send_v31_migration_email: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not profile_email:
        logger.warning("send_v31_migration_email: 이메일 없음 — 발송 건너뜀")
        return False

    biz_name = business_data.get("name", "내 가게")
    subject = f"[AEOlab] 점수 모델 v3.1 업데이트 안내 — {biz_name}"
    html = f"""
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b;">
  <div style="background:#1d4ed8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
    <p style="color:#bfdbfe;font-size:13px;margin:0 0 4px;">점수 모델 업데이트</p>
    <h1 style="color:#fff;font-size:22px;margin:0;">AI 가시성 점수 v3.1 전환</h1>
  </div>

  <p style="font-size:15px;line-height:1.7;">
    안녕하세요, <strong>{biz_name}</strong> 사장님.<br>
    AEOlab의 AI 가시성 점수 모델이 <strong>v3.1</strong>로 업데이트되었습니다.
  </p>

  <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin:20px 0;">
    <p style="font-size:13px;color:#64748b;font-weight:600;margin:0 0 8px;">v3.1 주요 변화</p>
    <ul style="font-size:14px;color:#1e293b;margin:0;padding-left:20px;line-height:1.8;">
      <li>트랙1 점수 항목이 5개 → 6개로 세분화 (키워드 순위 항목 신규 추가)</li>
      <li>업종 활성도(ACTIVE/LIKELY/INACTIVE)별 가중치 최적화</li>
      <li>키워드 3개 이상 등록 사업장부터 순위 측정 자동 반영</li>
    </ul>
  </div>

  <div style="background:#eff6ff;border-radius:10px;padding:16px 20px;margin:20px 0;">
    <p style="font-size:13px;color:#1d4ed8;font-weight:600;margin:0 0 6px;">지금 바로 할 수 있는 1가지</p>
    <p style="font-size:14px;color:#1e3a8a;margin:0;">
      대시보드에서 키워드 3개를 등록하면 다음 측정 주기부터 순위가 자동 반영됩니다.<br>
      <a href="https://aeolab.co.kr/dashboard" style="color:#2563eb;">키워드 등록하러 가기 →</a>
    </p>
  </div>

  <p style="font-size:12px;color:#94a3b8;margin-top:32px;text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
    try:
        ok = await send_email(profile_email, subject, html)
        if ok:
            logger.info(f"send_v31_migration_email OK: to={_mask_email(profile_email)} biz={biz_name}")
        return ok
    except Exception as e:
        logger.warning(f"send_v31_migration_email 예외 ({_mask_email(profile_email)}): {e}")
        return False
