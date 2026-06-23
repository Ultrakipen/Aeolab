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

_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "주점",
    "beauty": "미용실", "nail": "네일샵", "medical": "의원", "pharmacy": "약국",
    "fitness": "헬스장", "yoga": "요가원", "pet": "반려동물", "education": "학원",
    "tutoring": "과외", "legal": "법률사무소", "realestate": "부동산",
    "interior": "인테리어", "auto": "자동차", "cleaning": "청소",
    "shopping": "쇼핑", "fashion": "패션", "photo": "사진스튜디오",
    "video": "영상제작", "design": "디자인", "accommodation": "숙박",
    "other": "사업장",
}

_GROWTH_STAGE_KO: dict[str, str] = {
    "survival": "생존기", "stability": "안정기",
    "growth": "성장기", "dominance": "지배기",
}

_TRIAL_CHATGPT_SAMPLE_N = 5  # Trial scan ChatGPT sample size


def _score_label(score: float) -> str:
    if score >= 70:
        return "양호"
    elif score >= 45:
        return "보통"
    elif score >= 25:
        return "주의 필요"
    else:
        return "미흡"


def _score_color(score: float) -> str:
    if score >= 70:
        return "#16a34a"
    elif score >= 45:
        return "#d97706"
    elif score >= 25:
        return "#dc2626"
    else:
        return "#991b1b"


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


def _day1_html(
    business_name: str,
    category: str,
    region: str = "",
    score: float = 0,
    naver_rank: int | None = None,
    ai_mentioned: bool | None = None,
    top_missing_keywords: list | None = None,
    has_recent_post: bool | None = None,
    has_intro: bool | None = None,
    growth_stage: str | None = None,
    blog_mentions: int | None = None,
    top_competitor_name: str | None = None,
) -> tuple[str, str]:
    cat_ko = _CATEGORY_KO.get(category or "", "사업장")
    kw0 = (top_missing_keywords or [""])[0]

    # 우선순위 기반 1가지 행동 결정
    if has_intro is False:
        action_title = "소개글 작성 (200자 이상)"
        action_desc = f"소개글이 없으면 AI가 '{business_name}'을 설명할 수 없습니다. 업종명·지역·대표 서비스를 포함해 작성하세요."
        subject = f"[{business_name}] 소개글이 없어 AI가 내 가게를 설명하지 못합니다"
        btn_text = "스마트플레이스 소개글 작성하기 →"
    elif has_recent_post is False:
        action_title = "소식 탭에 글 1개 게시"
        action_desc = "오늘 찍은 사진 1장 + 한 줄 글이면 됩니다. 최근 소식이 있어야 AI가 가게를 현재 운영 중으로 인식합니다."
        subject = f"[{business_name}] 소식 1개만 올리면 AI 인식이 달라집니다"
        btn_text = "스마트플레이스 소식 작성하기 →"
    elif kw0:
        action_title = f"소개글에 '{kw0}' 추가"
        action_desc = f"경쟁 가게는 '{kw0}' 키워드를 쓰는데 내 가게 소개글에 없습니다. 자연스럽게 한 문장에 포함하세요."
        subject = f"[{business_name}] 경쟁 가게가 쓰는 키워드 — 내 가게엔 없습니다"
        btn_text = "소개글에 키워드 추가하기 →"
    else:
        action_title = "최근 리뷰에 답글 달기"
        action_desc = "가게 특징이 담긴 답글은 AI가 내 가게를 인식하는 데 도움이 됩니다."
        subject = f"[{business_name}] 스캔 다음 날 — 오늘 5분으로 할 수 있는 것"
        btn_text = "스마트플레이스 리뷰 관리하기 →"

    # 경쟁사 블로그 비교 (데이터 있을 때만)
    comp_block = ""
    if top_competitor_name and blog_mentions is not None:
        comp_block = f"""
  <div style="border-left:3px solid #fbbf24; padding:10px 14px; margin:0 0 20px; background:#fffbeb; border-radius:0 8px 8px 0;">
    <p style="font-size:12px; color:#92400e; font-weight:700; margin:0 0 3px;">참고 — 지역 경쟁 현황</p>
    <p style="font-size:13px; color:#78350f; margin:0; line-height:1.6;">
      1위 경쟁 가게 <strong>{top_competitor_name}</strong>의 블로그 언급과 비교해 내 가게가 얼마나 노출되는지 구독 후 매주 확인할 수 있습니다.
    </p>
  </div>"""

    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:520px; margin:0 auto; padding:28px 20px; color:#1e293b;">
  <p style="font-size:12px; color:#94a3b8; margin:0 0 16px;">AEOlab · {business_name} · {cat_ko}</p>

  <h1 style="font-size:18px; color:#1e293b; margin:0 0 20px; line-height:1.4; font-weight:700;">어제 스캔에서 발견한 것 — 오늘 5분이면 됩니다</h1>

  <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:18px 20px; margin:0 0 20px;">
    <p style="font-size:12px; color:#166534; font-weight:700; margin:0 0 8px;">지금 가장 임팩트 큰 1가지</p>
    <p style="font-size:15px; color:#14532d; font-weight:700; margin:0 0 8px; line-height:1.4;">{action_title}</p>
    <p style="font-size:13px; color:#166534; margin:0; line-height:1.6;">{action_desc}</p>
  </div>

  {comp_block}

  <div style="text-align:center; margin:0 0 24px;">
    <a href="https://smartplace.naver.com/" style="background:#03c75a; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">{btn_text}</a>
    <p style="font-size:12px; color:#94a3b8; margin:8px 0 0;">네이버 스마트플레이스 사장님 페이지로 이동합니다</p>
  </div>

  <div style="border-top:1px solid #f1f5f9; padding-top:14px;">
    <p style="font-size:12px; color:#94a3b8; margin:0 0 6px;">개선 후 2~4주 뒤 네이버 반영 기대 · ChatGPT·Gemini는 수개월 소요</p>
    <a href="https://aeolab.co.kr/pricing" style="font-size:12px; color:#64748b;">매주 자동 변화 추적 → Basic 첫 달 4,950원</a>
  </div>

  <p style="font-size:11px; color:#cbd5e1; margin-top:20px; text-align:center; line-height:1.6;">
    ChatGPT·Gemini 측정은 AI 학습 데이터 기반이며 실시간 검색 결과와 다를 수 있습니다.<br>
    AEOlab · <a href="https://aeolab.co.kr" style="color:#cbd5e1;">aeolab.co.kr</a>
  </p>
</div>
"""
    return subject, body


def _day3_html(
    business_name: str,
    category: str,
    score: float = 0,
    track1_score: float | None = None,
    track2_score: float | None = None,
    has_intro: bool | None = None,
    has_recent_post: bool | None = None,
    smart_place_completeness: float | None = None,
    ai_mentioned: bool | None = None,
    blog_mentions: int | None = None,
    top_competitor_name: str | None = None,
    top_missing_keywords: list | None = None,
) -> tuple[str, str]:
    cat_ko = _CATEGORY_KO.get(category or "", "사업장")
    missing_kws = (top_missing_keywords or [])
    kw0 = missing_kws[0] if missing_kws else ""

    # 제목: 키워드가 있으면 키워드 중심, 없으면 블로그 비교
    if kw0:
        subject = f"[{business_name}] 경쟁 가게가 쓰는 키워드 — 소개글에 붙여넣기 문장"
    elif blog_mentions is not None:
        subject = f"[{business_name}] 블로그 언급 {int(blog_mentions)}건 — 경쟁 가게와 얼마나 차이 나나요?"
    else:
        subject = f"[{business_name}] 스캔 3일째 — 오늘 소개글에 추가할 1가지"

    # 블로그 언급 수 블록
    blog_block = ""
    if blog_mentions is not None:
        bm = int(blog_mentions)
        bm_color = "#16a34a" if bm >= 10 else "#d97706" if bm >= 3 else "#dc2626"
        comp_note = f" · 1위 경쟁 가게 {top_competitor_name}과 비교해 보세요" if top_competitor_name else ""
        blog_block = f"""
  <div style="background:#f8fafc; border-radius:8px; padding:14px 16px; margin:0 0 20px;">
    <p style="font-size:11px; color:#94a3b8; font-weight:700; margin:0 0 8px; letter-spacing:0.08em;">블로그 언급 수 (네이버 검색 기준 · 스캔 시점)</p>
    <p style="font-size:22px; font-weight:800; color:{bm_color}; margin:0 0 4px;">{bm:,}건</p>
    <p style="font-size:12px; color:#64748b; margin:0;">블로그 언급이 많을수록 ChatGPT 학습 데이터에 포함될 가능성이 높습니다{comp_note}</p>
  </div>"""

    # 핵심: 키워드 + 붙여넣기 문장
    if kw0:
        example_sentence = f"저희 {cat_ko}는 {kw0} 서비스를 제공하고 있습니다. 방문 전 미리 문의해 주세요."
        keyword_block = f"""
  <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:16px 18px; margin:0 0 20px;">
    <p style="font-size:12px; color:#92400e; font-weight:700; margin:0 0 8px;">경쟁 가게가 쓰는데 내 가게 소개글엔 없는 키워드</p>
    <p style="font-size:16px; color:#78350f; font-weight:800; margin:0 0 12px;">'{kw0}'</p>
    <p style="font-size:12px; color:#92400e; font-weight:600; margin:0 0 6px;">소개글에 바로 붙여넣기</p>
    <div style="background:#ffffff; border:1px solid #fde68a; border-radius:6px; padding:12px 14px;">
      <p style="font-size:13px; color:#44403c; margin:0; line-height:1.6; font-style:italic;">"{example_sentence}"</p>
    </div>
    <p style="font-size:12px; color:#92400e; margin:8px 0 0;">위 문장을 소개글 마지막에 추가하세요. 업종·지역에 맞게 수정하면 더 좋습니다.</p>
  </div>"""
    else:
        action = "소식 탭에 이번 달 이벤트나 메뉴 변경 소식을 게시하세요" if has_recent_post is False else "소개글에 대표 서비스 특징을 한 문장 추가하세요"
        keyword_block = f"""
  <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px 18px; margin:0 0 20px;">
    <p style="font-size:13px; color:#0c4a6e; font-weight:700; margin:0 0 6px;">오늘 할 1가지</p>
    <p style="font-size:13px; color:#075985; margin:0; line-height:1.6;">{action}</p>
  </div>"""

    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:520px; margin:0 auto; padding:28px 20px; color:#1e293b;">
  <p style="font-size:12px; color:#94a3b8; margin:0 0 16px;">AEOlab · {business_name} · {cat_ko} · 스캔 D+3</p>

  <h1 style="font-size:17px; color:#1e293b; margin:0 0 20px; line-height:1.4; font-weight:700;">경쟁 가게가 쓰는 키워드 — 소개글에 붙여넣기</h1>

  {blog_block}
  {keyword_block}

  <div style="text-align:center; margin:0 0 24px;">
    <a href="https://smartplace.naver.com/" style="background:#03c75a; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">
      스마트플레이스 소개글 수정하기 →
    </a>
    <p style="font-size:12px; color:#94a3b8; margin:8px 0 0;">네이버 스마트플레이스 사장님 페이지로 이동합니다</p>
  </div>

  <div style="border-top:1px solid #f1f5f9; padding-top:14px;">
    <p style="font-size:12px; color:#64748b; margin:0 0 4px;">4일 뒤(D+7) 이메일에서 다시 스캔 결과를 비교해 드립니다.</p>
    <a href="https://aeolab.co.kr/pricing" style="font-size:12px; color:#64748b;">매주 자동 변화 추적 → Basic 첫 달 4,950원</a>
  </div>

  <p style="font-size:11px; color:#cbd5e1; margin-top:20px; text-align:center; line-height:1.6;">
    ChatGPT·Gemini 측정은 AI 학습 데이터 기반이며 실시간 검색 결과와 다를 수 있습니다.<br>
    AEOlab · <a href="https://aeolab.co.kr" style="color:#cbd5e1;">aeolab.co.kr</a>
  </p>
</div>
"""
    return subject, body


def _day7_html(
    business_name: str,
    category: str,
    ai_mentioned: bool | None = None,
    has_intro: bool | None = None,
    has_recent_post: bool | None = None,
) -> tuple[str, str]:
    subject = f"[{business_name}] 7일 전 스캔 — 지금 다시 확인해 보세요"

    # 1가지 기억할 사실 (조건 기반)
    if ai_mentioned is False:
        recall_bg = "#fef2f2"
        recall_border = "#fecaca"
        recall_color = "#991b1b"
        recall_text = f"7일 전 스캔: ChatGPT 5회 질의에서 '{business_name}' 0번 등장"
        recall_note = "소개글을 업데이트했다면 수개월 후 ChatGPT 학습 데이터에 반영될 수 있습니다."
    elif has_intro is False:
        recall_bg = "#fef2f2"
        recall_border = "#fecaca"
        recall_color = "#991b1b"
        recall_text = f"7일 전 스캔: 소개글 미작성 상태였습니다"
        recall_note = "그 사이 소개글을 작성했다면, 다시 스캔해서 변화를 확인하세요."
    elif has_recent_post is False:
        recall_bg = "#fffbeb"
        recall_border = "#fde68a"
        recall_color = "#92400e"
        recall_text = f"7일 전 스캔: 스마트플레이스 최근 소식 없음"
        recall_note = "소식을 1개 게시했다면, 다시 스캔해서 변화를 확인하세요."
    else:
        recall_bg = "#f0f9ff"
        recall_border = "#bae6fd"
        recall_color = "#0c4a6e"
        recall_text = f"7일 전 스캔 기록이 있습니다"
        recall_note = "그 사이 소개글·소식·리뷰를 수정했다면, 지금 다시 스캔해서 변화를 확인하세요."

    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:520px; margin:0 auto; padding:28px 20px; color:#1e293b;">
  <p style="font-size:12px; color:#94a3b8; margin:0 0 16px;">AEOlab · {business_name} · 스캔 D+7</p>

  <h1 style="font-size:18px; color:#1e293b; margin:0 0 20px; line-height:1.4; font-weight:700;">7일이 지났습니다 — 변화가 있었나요?</h1>

  <div style="background:{recall_bg}; border:1px solid {recall_border}; border-radius:10px; padding:16px 18px; margin:0 0 20px;">
    <p style="font-size:13px; color:{recall_color}; font-weight:700; margin:0 0 6px;">{recall_text}</p>
    <p style="font-size:13px; color:{recall_color}; margin:0; line-height:1.6;">{recall_note}</p>
  </div>

  <div style="text-align:center; margin:0 0 20px;">
    <a href="https://aeolab.co.kr/trial" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; display:inline-block;">
      지금 다시 스캔하기 →
    </a>
    <p style="font-size:12px; color:#94a3b8; margin:8px 0 0;">무료 · 결과 즉시 확인 · 로그인 불필요</p>
  </div>

  <div style="border-top:1px solid #f1f5f9; padding-top:14px; text-align:center;">
    <p style="font-size:12px; color:#64748b; margin:0 0 6px;">변화를 매주 자동으로 추적하려면</p>
    <a href="https://aeolab.co.kr/pricing" style="font-size:13px; color:#1d4ed8; font-weight:600; text-decoration:none;">Basic 첫 달 4,950원으로 시작 →</a>
    <p style="font-size:11px; color:#94a3b8; margin:4px 0 0;">이후 9,900원/월 · 언제든 해지</p>
  </div>

  <p style="font-size:11px; color:#cbd5e1; margin-top:20px; text-align:center; line-height:1.6;">
    ChatGPT·Gemini 측정은 AI 학습 데이터 기반이며 실시간 검색 결과와 다를 수 있습니다.<br>
    AEOlab · <a href="https://aeolab.co.kr" style="color:#cbd5e1;">aeolab.co.kr</a>
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
    naver_rank: int | None = None,
    blog_mentions: int | None = None,
    top_competitor_name: str | None = None,
    ai_mentioned: bool | None = None,
    top_missing_keywords: list | None = None,
    has_recent_post: bool | None = None,
    has_intro: bool | None = None,
    track1_score: float | None = None,
    track2_score: float | None = None,
    growth_stage: str | None = None,
    smart_place_completeness: float | None = None,
) -> bool:
    """무료 체험 팔로업 이메일 발송 (aiohttp 기반 — resend SDK blocking 호출 대체).

    Args:
        day: 1 | 3 | 7
        나머지 파라미터: trial_scans 데이터에서 추출한 진단 정보 (기본값 None = 해당 섹션 숨김)

    Returns:
        True if sent successfully
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY 미설정 — 이메일 발송 건너뜀")
        return False

    import aiohttp as _aiohttp

    try:
        if day == 1:
            subject, html = _day1_html(
                business_name=business_name,
                category=category,
                region=region,
                score=score,
                naver_rank=naver_rank,
                ai_mentioned=ai_mentioned,
                top_missing_keywords=top_missing_keywords,
                has_recent_post=has_recent_post,
                has_intro=has_intro,
                growth_stage=growth_stage,
                blog_mentions=blog_mentions,
                top_competitor_name=top_competitor_name,
            )
        elif day == 3:
            subject, html = _day3_html(
                business_name=business_name,
                category=category,
                score=score,
                track1_score=track1_score,
                track2_score=track2_score,
                has_intro=has_intro,
                has_recent_post=has_recent_post,
                smart_place_completeness=smart_place_completeness,
                ai_mentioned=ai_mentioned,
                blog_mentions=blog_mentions,
                top_competitor_name=top_competitor_name,
                top_missing_keywords=top_missing_keywords,
            )
        elif day == 7:
            subject, html = _day7_html(
                business_name=business_name,
                category=category,
                ai_mentioned=ai_mentioned,
                has_intro=has_intro,
                has_recent_post=has_recent_post,
            )
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
                    "headers": {
                        "List-Unsubscribe": "<mailto:unsubscribe@aeolab.co.kr?subject=unsubscribe>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
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
                    "headers": {
                        "List-Unsubscribe": "<mailto:unsubscribe@aeolab.co.kr?subject=unsubscribe>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
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
    <p style="font-size:28px; font-weight:bold; color:{_score_color(unified_score)}; margin:0;">{_score_label(unified_score)}</p>
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
      <strong>스마트플레이스 소개글에 사업장 특징과 서비스를 300자 이상 작성</strong><br>
      <span style="font-size:13px; color:#166534;">업종명·지역·대표 서비스를 구체적으로 작성하면 AI가 사업장을 인식하는 데 도움이 됩니다.<br>작성 후 7일 뒤 AI가 내 가게를 인식했는지 자동으로 확인해 드립니다.</span>
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
    """무료 체험 종합 보고서 이메일 (v4.1 — 성장단계·경쟁사·카카오맵 추가).

    trial_summary 키:
        business_name, category, region, score, grade,
        naver_rank, ai_mentioned, top_missing_keywords,
        track1_score, track2_score, has_intro, has_recent_post,
        smart_place_completeness, blog_mentions,
        top_competitor_name, top_competitor_blog_count,
        growth_stage, kakao_rank, is_on_kakao
    """
    if not RESEND_API_KEY:
        logger.warning("send_trial_claim_link: RESEND_API_KEY 미설정 — 발송 건너뜀")
        return False
    if not to_email or not magic_link:
        logger.warning("send_trial_claim_link: 인자 누락 — 발송 건너뜀")
        return False

    from datetime import date as _date

    biz_name   = trial_summary.get("business_name") or "내 가게"
    region     = trial_summary.get("region") or ""
    category   = trial_summary.get("category") or ""
    score      = float(trial_summary.get("score") or 0)
    grade      = trial_summary.get("grade") or (
        "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"
    )
    track1_score             = trial_summary.get("track1_score")
    track2_score             = trial_summary.get("track2_score")
    naver_rank               = trial_summary.get("naver_rank")
    ai_mentioned             = trial_summary.get("ai_mentioned")
    has_intro                = trial_summary.get("has_intro")
    has_recent_post          = trial_summary.get("has_recent_post")
    smart_place_completeness = trial_summary.get("smart_place_completeness")
    blog_mentions            = trial_summary.get("blog_mentions")
    missing_kws              = (trial_summary.get("top_missing_keywords") or [])[:3]
    top_competitor_name      = trial_summary.get("top_competitor_name")
    top_competitor_blog      = trial_summary.get("top_competitor_blog_count")
    growth_stage             = trial_summary.get("growth_stage")
    kakao_rank               = trial_summary.get("kakao_rank")
    is_on_kakao              = trial_summary.get("is_on_kakao")

    cat_ko    = _CATEGORY_KO.get(category, "사업장")
    today_str = _date.today().strftime("%Y년 %m월 %d일")

    # ── 업종 특성 분기 ────────────────────────────────────────────────────────
    _ACTIVE = {"restaurant", "cafe", "bakery", "bar", "accommodation"}
    _LIKELY = {"beauty", "nail", "pet", "fitness", "yoga", "pharmacy"}
    cat_lower = (category or "").lower()
    if cat_lower in _ACTIVE:
        cat_bg, cat_bd, cat_color = "#eff6ff", "#bfdbfe", "#1e3a8a"
        cat_msg = f"<strong>{cat_ko}</strong> 업종은 <strong>네이버 AI 브리핑 노출 가능 업종</strong>입니다. 스마트플레이스 소개글·소식·리뷰를 먼저 개선하세요."
    elif cat_lower in _LIKELY:
        cat_bg, cat_bd, cat_color = "#f0fdf4", "#86efac", "#14532d"
        cat_msg = f"<strong>{cat_ko}</strong> 업종은 네이버 AI탭 확대 예상 업종입니다. 네이버 스마트플레이스 최적화 + ChatGPT·Gemini 노출 양쪽 개선이 중요합니다."
    else:
        cat_bg, cat_bd, cat_color = "#fefce8", "#fde047", "#713f12"
        cat_msg = f"<strong>{cat_ko}</strong> 업종은 네이버 AI 브리핑 대상이 아닙니다. <strong>ChatGPT · Gemini · Google AI</strong> 노출 개선에 집중하세요."

    # ── 섹션 1: 트랙별 점수 진행바 ───────────────────────────────────────────
    track_section = ""
    if track1_score is not None and track2_score is not None:
        t1, t2 = float(track1_score), float(track2_score)
        t1_pct, t2_pct = min(int(t1), 100), min(int(t2), 100)
        track_section = f"""
    <div style="margin-bottom:20px; padding-bottom:18px; border-bottom:1px solid #f1f5f9;">
      <p style="font-size:12px; color:#94a3b8; font-weight:700; margin:0 0 12px; letter-spacing:0.08em; text-transform:uppercase;">AI 노출 점수</p>
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <span style="font-size:13px; color:#334155;">네이버 검색 노출도</span>
          <span style="font-size:13px; font-weight:700; color:#1d4ed8;">{_score_label(t1)}</span>
        </div>
        <div style="background:#e2e8f0; border-radius:4px; height:8px;"><div style="background:#1d4ed8; border-radius:4px; height:8px; width:{t1_pct}%;"></div></div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <span style="font-size:13px; color:#334155;">ChatGPT·Gemini 노출도</span>
          <span style="font-size:13px; font-weight:700; color:#7c3aed;">{_score_label(t2)}</span>
        </div>
        <div style="background:#e2e8f0; border-radius:4px; height:8px;"><div style="background:#7c3aed; border-radius:4px; height:8px; width:{t2_pct}%;"></div></div>
      </div>
    </div>"""

    # ── 섹션 2: 항목별 현황 체크리스트 ──────────────────────────────────────
    is_smart_place = trial_summary.get("is_smart_place")
    check_rows = []
    if is_smart_place is not None:
        icon  = "✓" if is_smart_place is True else "✗"
        color = "#16a34a" if is_smart_place is True else "#dc2626"
        label = "스마트플레이스 등록됨" if is_smart_place is True else "스마트플레이스 미등록 (필수)"
        check_rows.append((icon, color, label))
    if has_intro is not None:
        icon  = "✓" if has_intro is True else "✗"
        color = "#16a34a" if has_intro is True else "#dc2626"
        label = "소개글 작성 완료" if has_intro is True else "소개글 미작성"
        check_rows.append((icon, color, label))
    if has_recent_post is not None:
        icon  = "✓" if has_recent_post is True else "✗"
        color = "#16a34a" if has_recent_post is True else "#dc2626"
        label = "최근 소식 게시됨" if has_recent_post is True else "최근 소식 없음"
        check_rows.append((icon, color, label))
    if smart_place_completeness is not None:
        sp = float(smart_place_completeness)
        sp_color = "#16a34a" if sp >= 70 else "#d97706" if sp >= 45 else "#dc2626"
        check_rows.append(("·", sp_color, f"스마트플레이스 완성도  {_score_label(sp)}"))
    if ai_mentioned is not None:
        icon  = "✓" if ai_mentioned is True else "✗"
        color = "#16a34a" if ai_mentioned is True else "#dc2626"
        label = "ChatGPT 노출 확인" if ai_mentioned is True else "ChatGPT 미노출"
        check_rows.append((icon, color, label))
    if blog_mentions is not None:
        bm = int(blog_mentions)
        bm_color = "#16a34a" if bm >= 10 else "#d97706" if bm >= 3 else "#dc2626"
        check_rows.append(("·", bm_color, f"블로그 언급  {bm}건"))
    if naver_rank is not None:
        rank_text  = f"{naver_rank}위" if naver_rank > 0 else "순위 외"
        rank_color = "#16a34a" if naver_rank <= 3 else "#d97706" if naver_rank <= 10 else "#dc2626"
        check_rows.append(("·", rank_color, f"네이버 검색 순위  {rank_text}"))
    if is_on_kakao is not None:
        icon  = "✓" if is_on_kakao is True else "✗"
        color = "#16a34a" if is_on_kakao is True else "#dc2626"
        kakao_label = "카카오맵 등록됨" if is_on_kakao is True else "카카오맵 미등록"
        if is_on_kakao and kakao_rank:
            kakao_label += f"  ({kakao_rank}위)"
        check_rows.append((icon, color, kakao_label))

    checklist_section = ""
    if check_rows:
        rows_html = "".join(
            f'<tr><td style="width:22px; color:{c}; font-size:14px; font-weight:700; padding:4px 0; vertical-align:top; line-height:1.5;">{ic}</td>'
            f'<td style="font-size:13px; color:#334155; padding:4px 0; line-height:1.5;">{lb}</td></tr>'
            for ic, c, lb in check_rows
        )
        checklist_section = f"""
    <div style="margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid #f1f5f9;">
      <p style="font-size:12px; color:#94a3b8; font-weight:700; margin:0 0 10px; letter-spacing:0.08em; text-transform:uppercase;">항목별 현황</p>
      <table style="width:100%; border-collapse:collapse;">{rows_html}</table>
    </div>"""

    # ── 섹션 3: 업종 특성 안내 ───────────────────────────────────────────────
    category_notice = f"""
    <div style="background:{cat_bg}; border:1px solid {cat_bd}; border-radius:8px; padding:12px 16px; margin-bottom:18px;">
      <p style="font-size:13px; color:{cat_color}; margin:0; line-height:1.7;">{cat_msg}</p>
    </div>"""

    # ── 섹션 4: 부족한 키워드 ────────────────────────────────────────────────
    keywords_section = ""
    if missing_kws:
        chips = "".join(
            f'<span style="display:inline-block; background:#eff6ff; color:#1d4ed8; font-size:13px; font-weight:600; padding:4px 12px; border-radius:20px; margin:0 6px 6px 0;">{kw}</span>'
            for kw in missing_kws
        )
        keywords_section = f"""
    <div style="margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid #f1f5f9;">
      <p style="font-size:12px; color:#94a3b8; font-weight:700; margin:0 0 10px; letter-spacing:0.08em; text-transform:uppercase;">부족한 키워드</p>
      <div>{chips}</div>
    </div>"""

    # ── 섹션 5A: 성장 단계 뱃지 ─────────────────────────────────────────────
    # score_engine 저장값: "survival"(track1<30) / "stability"(30~55) /
    #                       "growth"(55~75) / "dominance"(75+)
    _STAGE_META = {
        "survival":  ("#fef2f2", "#fecaca", "#991b1b", "생존기",  "0~30점", "사진 5장·영업시간·전화번호를 스마트플레이스에서 완성하기"),
        "stability": ("#fefce8", "#fde047", "#713f12", "안정기",  "30~55점", "소개글에 업종명·지역·서비스 특징 300자 이상 작성"),
        "growth":    ("#eff6ff", "#bfdbfe", "#1e3a8a", "성장기",  "55~75점", "소식 탭에 최근 사진 1~2장 + 짧은 글 올리기"),
        "dominance": ("#f0fdf4", "#86efac", "#14532d", "지배기",  "75~100점", "신규 리뷰에 키워드 포함 답글 달기"),
    }
    growth_section = ""
    if growth_stage and growth_stage in _STAGE_META:
        sg_bg, sg_bd, sg_color, sg_label, sg_range, sg_default_action = _STAGE_META[growth_stage]
        # 실제 데이터 기반 this_week_action 생성 (trial page의 gap_analyzer 로직과 동일)
        _is_sp = trial_summary.get("is_smart_place")
        if _is_sp is False:
            sg_action = "스마트플레이스 등록하기 (smartplace.naver.com) — AI 브리핑 노출의 첫 번째 조건입니다"
        else:
            _missing_actions = []
            if has_intro is False:
                _missing_actions.append("소개글에 핵심 키워드 2~3개 포함한 2문장 작성")
            if has_recent_post is False:
                _missing_actions.append("소식 탭에 최근 작업 사진 1~2장 + 짧은 글 올리기")
            sg_action = " → ".join(_missing_actions[:2]) if _missing_actions else sg_default_action
        # 4단계 현재 위치 도트
        _stages = ["survival", "stability", "growth", "dominance"]
        _stage_idx = _stages.index(growth_stage)
        dots_html = "".join(
            f'<span style="display:inline-block; width:8px; height:8px; border-radius:50%; margin:0 3px; background:{"#1d4ed8" if i <= _stage_idx else "#e2e8f0"};"></span>'
            for i in range(4)
        )
        growth_section = f"""
    <div style="background:{sg_bg}; border:1px solid {sg_bd}; border-radius:8px; padding:12px 16px; margin-bottom:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:12px; color:#94a3b8; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">성장 단계</span>
        <span style="font-size:12px; font-weight:700; color:{sg_color}; background:rgba(0,0,0,0.06); padding:2px 10px; border-radius:12px;">{sg_label} · {sg_range}</span>
      </div>
      <div style="text-align:center; margin-bottom:8px;">{dots_html}</div>
      <p style="font-size:12px; color:{sg_color}; margin:0; line-height:1.6;"><strong>이번 주 할 일:</strong> {sg_action}</p>
    </div>"""

    # ── 섹션 5B: 경쟁사 비교 ─────────────────────────────────────────────────
    competitor_section = ""
    if top_competitor_name:
        my_blog = blog_mentions if blog_mentions is not None else 0
        comp_blog = top_competitor_blog if top_competitor_blog is not None else "?"
        if isinstance(comp_blog, int) and isinstance(my_blog, int):
            gap = comp_blog - my_blog
            gap_text = f"+{gap}건 앞섬" if gap > 0 else "동등 이상"
            gap_color = "#991b1b" if gap > 0 else "#14532d"
        else:
            gap_text = "데이터 없음"
            gap_color = "#94a3b8"
        competitor_section = f"""
    <div style="margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid #f1f5f9;">
      <p style="font-size:12px; color:#94a3b8; font-weight:700; margin:0 0 10px; letter-spacing:0.08em; text-transform:uppercase;">지역 경쟁사 비교</p>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr>
          <td style="padding:6px 0; color:#64748b; width:90px;">항목</td>
          <td style="padding:6px 8px; color:#1e293b; font-weight:600; text-align:center;">내 가게</td>
          <td style="padding:6px 8px; color:#1e293b; font-weight:600; text-align:center;">1위 경쟁사<br><span style="font-size:11px; font-weight:400; color:#64748b;">{top_competitor_name}</span></td>
        </tr>
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:6px 0; color:#64748b;">블로그 언급</td>
          <td style="padding:6px 8px; text-align:center; color:#1d4ed8; font-weight:700;">{my_blog}건</td>
          <td style="padding:6px 8px; text-align:center; color:#dc2626; font-weight:700;">{comp_blog}건</td>
        </tr>
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:6px 0; color:#64748b;">격차</td>
          <td colspan="2" style="padding:6px 8px; text-align:center; color:{gap_color}; font-weight:600;">{gap_text}</td>
        </tr>
      </table>
    </div>"""

    # ── 섹션 6: 이번 스캔에서 발견한 것 (trial page FindingsCard 동일 로직) ──────
    _ACTIVE_SET = {"restaurant", "cafe", "bakery", "bar", "accommodation"}
    _LIKELY_SET = {"beauty", "nail", "pet", "fitness", "yoga", "pharmacy"}
    _is_active_likely = cat_lower in _ACTIVE_SET or cat_lower in _LIKELY_SET
    _bm = int(blog_mentions) if blog_mentions is not None else 0

    _findings: list[tuple[str, bool, str, str]] = []  # (icon, positive, title, desc)

    # Finding 1: 네이버 AI 브리핑 / 블로그 언급
    if _is_active_likely:
        if ai_mentioned is False:
            _findings.append(("📍", False,
                "ChatGPT 검색에 아직 등장하지 않습니다",
                "소개글 Q&A·리뷰 키워드가 핵심 개선 포인트입니다. 네이버 AI 브리핑 노출 여부는 정식 스캔에서 별도 확인합니다."))
        elif ai_mentioned is True:
            _findings.append(("✅", True,
                "ChatGPT 검색에 등장하고 있습니다",
                "ChatGPT에 이미 노출 중입니다. 네이버 AI 브리핑 노출은 정식 스캔에서 확인하세요. 경쟁 가게보다 더 자주 등장하려면 키워드 다양성을 높여야 합니다."))
        else:
            _findings.append(("📍", False,
                "ChatGPT 검색 노출 여부를 확인했습니다",
                "소개글 Q&A·리뷰 키워드가 충분하면 AI가 내 가게를 더 잘 인식합니다."))
    else:
        if _bm < 5:
            _findings.append(("📝", False,
                f"블로그 후기가 {_bm}건으로 적습니다",
                "네이버 검색 노출과 ChatGPT 학습 데이터 모두 블로그 언급 수가 영향을 줍니다."))
        else:
            _findings.append(("✅", True,
                f"블로그 후기 {_bm}건 발견됐습니다",
                "어느 정도 쌓여 있습니다. 경쟁 가게 대비 더 많이 확보하면 노출이 더 늘어납니다."))

    # Finding 2: 키워드 갭
    if missing_kws:
        _kw_sample = "', '".join(missing_kws[:2])
        _findings.append(("🔑", False,
            f"경쟁 가게가 쓰는 키워드 {len(missing_kws)}개가 없습니다",
            f"'{_kw_sample}' 등이 소개글·리뷰에 없습니다. 이 키워드들이 있어야 AI가 추천할 때 포함됩니다."))
    elif has_intro is False:
        _findings.append(("✏️", False,
            "소개글이 충분하지 않습니다",
            "AI는 소개글을 읽고 내 가게를 추천합니다. 가게 특징·서비스를 구체적으로 작성하세요."))
    else:
        _findings.append(("✅", True,
            "소개글과 키워드가 잘 갖춰져 있습니다",
            "기본 콘텐츠는 준비됐습니다. 정기적인 소식 업데이트로 최신성을 유지하세요."))

    # Finding 3: 스마트플레이스 / 소식
    _sp_val = trial_summary.get("is_smart_place")
    if _sp_val is False:
        _findings.append(("🏪", False,
            "스마트플레이스 정보가 불완전합니다",
            "스마트플레이스는 네이버 AI 브리핑의 기본 조건입니다. 소개글·사진·영업시간이 완전해야 합니다."))
    elif has_recent_post is False:
        _findings.append(("📅", False,
            "최근 소식이 없습니다",
            "최근 업데이트가 없으면 AI가 사업장을 비활성 상태로 판단할 수 있습니다. 소식 1개를 게시하세요."))
    else:
        _findings.append(("✅", True,
            "스마트플레이스 기본 정보가 갖춰져 있습니다",
            "기본 상태는 양호합니다. 소식 탭을 정기 업데이트하면 더 좋습니다."))

    def _finding_row(icon: str, positive: bool, title: str, desc: str) -> str:
        bg = "background:#f0fdf4;" if positive else ""
        title_color = "#166534" if positive else "#1e293b"
        return (
            f'<div style="padding:12px 14px; border-bottom:1px solid #f1f5f9; {bg}display:flex; gap:10px;">'
            f'<span style="font-size:18px; line-height:1.4; flex-shrink:0;">{icon}</span>'
            f'<div><p style="font-size:13px; font-weight:600; color:{title_color}; margin:0 0 3px; line-height:1.4;">{title}</p>'
            f'<p style="font-size:12px; color:#475569; margin:0; line-height:1.5;">{desc}</p></div></div>'
        )

    findings_rows = "".join(_finding_row(*f) for f in _findings[:3])
    improvements_section = f"""
    <div style="margin-bottom:20px;">
      <p style="font-size:12px; color:#94a3b8; font-weight:700; margin:0 0 8px; letter-spacing:0.08em; text-transform:uppercase;">이번 스캔에서 발견한 것</p>
      <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">{findings_rows}</div>
      <p style="font-size:11px; color:#94a3b8; margin:6px 0 0; text-align:right;">정확한 항목별 점수·경쟁사 비교는 구독 후 매주 자동 측정합니다</p>
    </div>"""

    # ── 측정 근거 (ScanEvidenceCard 동일) ────────────────────────────────────
    _evidence_items = [f"🤖 ChatGPT에 '{biz_name}' {_TRIAL_CHATGPT_SAMPLE_N}회 질의"]
    _evidence_items.append("📍 네이버 AI 브리핑 자동 점검")
    if _bm > 0:
        _evidence_items.append(f"📝 블로그 후기 {_bm}건 발견")
    if _sp_val is True or smart_place_completeness is not None:
        _evidence_items.append("✅ 스마트플레이스 자동 점검 완료")
    evidence_section = f"""
    <div style="background:#f8fafc; border-radius:8px; padding:10px 14px; margin-bottom:20px;">
      <p style="font-size:11px; color:#64748b; font-weight:600; margin:0 0 6px;">🔍 이렇게 측정했습니다</p>
      <p style="font-size:12px; color:#475569; margin:0; line-height:1.8;">{"  ·  ".join(_evidence_items)}</p>
    </div>"""

    # ── 핵심 발견 1가지 (우선순위 기반) ─────────────────────────────────────
    if _sp_val is False:
        _f_title = "스마트플레이스 미등록"
        _f_desc = "스마트플레이스는 네이버 AI 브리핑 노출의 기본 조건입니다. 등록하지 않으면 소개글을 아무리 잘 써도 AI에 노출되지 않습니다."
        _f_neg = True
    elif has_intro is False:
        _f_title = "소개글 없음 — AI가 내 가게를 설명할 수 없습니다"
        _f_desc = f"AI는 소개글을 읽고 '{biz_name}'을 추천합니다. 업종명·지역·대표 서비스를 포함해 200자 이상 작성하세요."
        _f_neg = True
    elif has_recent_post is False:
        _f_title = "최근 소식 없음 — AI가 가게를 비활성으로 판단할 수 있습니다"
        _f_desc = "오늘 찍은 사진 1장 + 한 줄 글이면 됩니다. 소식이 있어야 AI가 가게를 현재 운영 중으로 인식합니다."
        _f_neg = True
    elif missing_kws:
        _f_title = f"'{missing_kws[0]}' 키워드 — 내 소개글에 없습니다"
        _f_desc = "경쟁 가게는 이 키워드를 쓰는데 내 가게 소개글에 없습니다. 자연스럽게 한 문장에 포함하세요."
        _f_neg = True
    elif ai_mentioned is False:
        _f_title = f"ChatGPT {_TRIAL_CHATGPT_SAMPLE_N}회 질의 — '{biz_name}' 0번 등장"
        _f_desc = "소개글 키워드 다양성을 높이면 수개월 후 ChatGPT 학습 데이터에 포함될 가능성이 높아집니다."
        _f_neg = True
    else:
        _f_title = "기본 설정이 갖춰져 있습니다"
        _f_desc = "소개글·소식이 있습니다. 다음 단계는 경쟁 가게 대비 블로그 언급 수를 늘리는 것입니다."
        _f_neg = False

    _f_bg     = "#fef2f2" if _f_neg else "#f0fdf4"
    _f_border = "#fecaca" if _f_neg else "#86efac"
    _f_color  = "#991b1b" if _f_neg else "#14532d"

    # 경쟁사 블로그 비교 블록
    _comp_html = ""
    if top_competitor_name:
        _my_b  = int(blog_mentions) if blog_mentions is not None else 0
        _cp_b  = top_competitor_blog if isinstance(top_competitor_blog, (int, float)) else None
        if _cp_b is not None:
            _gap    = int(_cp_b) - _my_b
            _gap_s  = f"경쟁 가게가 {_gap:,}건 앞서 있습니다" if _gap > 0 else "내 가게가 앞서 있거나 동등합니다"
            _comp_html = (
                '<div style="background:#f8fafc; border-radius:8px; padding:14px 16px; margin:0 0 20px;">'
                '<p style="font-size:11px; color:#94a3b8; font-weight:700; margin:0 0 10px; letter-spacing:0.08em;">블로그 노출 비교 (네이버 검색 기준)</p>'
                '<table style="width:100%; font-size:13px; border-collapse:collapse;">'
                f'<tr><td style="padding:6px 0; color:#64748b;">내 가게</td>'
                f'<td style="padding:6px 0; text-align:right; color:#1d4ed8; font-weight:700;">{_my_b:,}건</td></tr>'
                f'<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px 0; color:#64748b;">1위 {top_competitor_name}</td>'
                f'<td style="padding:6px 0; text-align:right; color:#dc2626; font-weight:700;">{int(_cp_b):,}건</td></tr>'
                '</table>'
                f'<p style="font-size:12px; color:#64748b; margin:8px 0 0;">→ {_gap_s} · 블로그 언급이 많을수록 ChatGPT 학습 데이터에 포함될 가능성이 높아집니다</p>'
                '</div>'
            )

    subject = f"[{biz_name}] AI 스캔 완료 — 지금 바로 할 1가지"
    html = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:520px; margin:0 auto; padding:28px 20px; color:#1e293b;">
  <p style="font-size:12px; color:#94a3b8; margin:0 0 16px;">AEOlab · {biz_name} · {cat_ko}{f" · {region}" if region else ""} · {today_str}</p>

  <h1 style="font-size:18px; color:#1e293b; margin:0 0 20px; line-height:1.4; font-weight:700;">스캔에서 발견한 것 — 지금 바로 할 1가지</h1>

  <div style="background:{_f_bg}; border:1px solid {_f_border}; border-radius:10px; padding:16px 18px; margin:0 0 20px;">
    <p style="font-size:13px; color:{_f_color}; font-weight:700; margin:0 0 8px;">{_f_title}</p>
    <p style="font-size:13px; color:{_f_color}; margin:0; line-height:1.6;">{_f_desc}</p>
  </div>

  {_comp_html}

  <div style="text-align:center; margin:0 0 24px;">
    <a href="https://smartplace.naver.com/" style="background:#03c75a; color:#ffffff; text-decoration:none; padding:13px 28px; border-radius:8px; font-size:14px; font-weight:700; display:inline-block;">
      스마트플레이스 바로가기 →
    </a>
    <p style="font-size:12px; color:#94a3b8; margin:8px 0 0;">네이버 스마트플레이스 사장님 페이지로 이동합니다</p>
  </div>

  <div style="border-top:1px solid #f1f5f9; padding-top:16px; margin:0 0 20px;">
    <p style="font-size:13px; color:#475569; margin:0 0 12px; line-height:1.6;">이 스캔 결과를 30일 보관하고 매주 변화를 자동 추적하려면 아래 링크로 가입하세요.</p>
    <div style="text-align:center;">
      <a href="{magic_link}" style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:11px 24px; border-radius:8px; font-size:13px; font-weight:700; display:inline-block;">결과 보관하고 매주 추적하기 →</a>
      <p style="font-size:11px; color:#94a3b8; margin:6px 0 0;">링크 유효 24시간 · 첫 달 50% 할인 Basic 4,950원 · 언제든 해지</p>
    </div>
  </div>

  <p style="font-size:11px; color:#cbd5e1; text-align:center; line-height:1.6;">
    ChatGPT·Gemini 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.<br>
    순위·언급 수는 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.<br>
    이 메일은 aeolab.co.kr/trial 무료 진단 신청 시 입력하신 이메일로 발송됐습니다. 수신 거부는 답장으로 알려주세요.<br>
    AEOlab · <a href="https://aeolab.co.kr" style="color:#cbd5e1;">aeolab.co.kr</a>
  </p>
</div>
"""
    return await send_email(to_email, subject, html)


# ─── 가입 후 미결제 사용자 전환 알림 시퀀스 (D+7/14/30) ─────────────────────


def _conversion_d7_html(biz_name: str = "", category: str = "") -> tuple[str, str]:
    if biz_name:
        subject = f"[{biz_name}] 가입 7일 — 경쟁 가게는 지금 AI에 나오고 있어요"
        h1_text = f"{biz_name}, 가입 7일이 지났습니다"
    else:
        subject = "[AEOlab] 경쟁 가게는 지금 AI에 나오고 있어요"
        h1_text = "가입 후 7일이 지났습니다"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0;">{h1_text}</h1>
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


def _conversion_d14_html(biz_name: str = "", category: str = "") -> tuple[str, str]:
    if biz_name:
        subject = f"[{biz_name}] 2주가 지났어요 — 아직 AI 노출 점수를 확인하지 못하셨나요?"
        h1_text = f"{biz_name}, 가입 2주가 지났습니다"
    else:
        subject = "[AEOlab] 2주가 지났어요 — 아직 AI 노출 점수를 확인하지 못하셨나요?"
        h1_text = "가입 2주 — 아직 AI 노출 점수를 확인하지 못하셨나요?"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#bfdbfe; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0;">{h1_text}</h1>
  </div>

  <p style="font-size:15px; line-height:1.8; margin:0 0 20px;">
    같은 업종 경쟁 가게들은 지금 AI 검색 노출을 위해 꾸준히 개선하고 있습니다.<br>
    내 가게는 아직 시작하지 못했나요?
  </p>

  <div style="background:#f8fafc; border-radius:10px; padding:20px; margin-bottom:20px;">
    <p style="font-size:14px; color:#1e293b; line-height:1.8; margin:0;">
      네이버 AI 브리핑·ChatGPT에서 <strong>경쟁 가게보다 먼저 검색되는 가게</strong>는
      소개글 300자 이상 + 최근 소식 업데이트 + 리뷰 30개 이상을 꾸준히 유지합니다.<br>
      Basic 플랜으로 매주 자동 측정해 내 가게가 경쟁 가게 대비 어느 위치인지 확인하세요.
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


def _conversion_d30_html(biz_name: str = "", category: str = "") -> tuple[str, str]:
    if biz_name:
        subject = f"[{biz_name}] 마지막 안내 — 첫 달 50% 할인이 기다리고 있어요"
        h1_text = f"{biz_name}, 마지막 안내드립니다"
    else:
        subject = "[AEOlab] 마지막 안내 — 첫 달 50% 할인이 기다리고 있어요"
        h1_text = "마지막 안내드립니다"
    body = f"""
<div style="font-family: 'Apple SD Gothic Neo', Malgun Gothic, sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <div style="background:linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%); border-radius:12px; padding:24px; margin-bottom:24px; text-align:center;">
    <p style="color:#e0e7ff; font-size:13px; margin:0 0 4px; font-weight:600; letter-spacing:0.05em;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#ffffff; font-size:22px; margin:0 0 8px;">{h1_text}</h1>
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
    biz_name: str = "",
    category: str = "",
) -> bool:
    """가입 후 미결제 사용자 전환 유도 이메일 (D+7/14/30).

    Args:
        email:    수신자 이메일
        day:      7 | 14 | 30
        biz_name: 사업장명 (개인화용, 없으면 기본 문구)
        category: 업종 코드 (향후 업종별 분기용)

    Returns:
        True if 발송 성공
    """
    if day == 7:
        subject, html = _conversion_d7_html(biz_name=biz_name, category=category)
    elif day == 14:
        subject, html = _conversion_d14_html(biz_name=biz_name, category=category)
    elif day == 30:
        subject, html = _conversion_d30_html(biz_name=biz_name, category=category)
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
    소개글 보완·리뷰 답변·소식 업데이트를 꾸준히 유지하세요.
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
                '<span style="font-size:15px; color:#86efac; font-weight:600; margin-left:10px;">▲ 개선됨</span>'
            )
        elif delta < 0:
            delta_html = (
                '<span style="font-size:15px; color:#fca5a5; font-weight:600; margin-left:10px;">▼ 하락</span>'
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
    <div style="background:rgba(255,255,255,0.15); border-radius:8px; display:inline-flex; align-items:center; padding:10px 24px; gap:8px;">
      <span style="color:#ffffff; font-size:26px; font-weight:800;">{_score_label(current_score)}</span>
      {delta_html}
    </div>
  </div>

  <div style="display:flex; gap:12px; margin-bottom:20px;">
    <div style="flex:1; background:#eff6ff; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#3b82f6; margin:0 0 4px; font-weight:600;">이번 주 AI 언급</p>
      <p style="font-size:28px; font-weight:bold; color:#1d4ed8; margin:0;">{ai_citations_count}건</p>
    </div>
    <div style="flex:1; background:#f0fdf4; border-radius:10px; padding:16px; text-align:center;">
      <p style="font-size:12px; color:#16a34a; margin:0 0 4px; font-weight:600;">현재 AI 노출 현황</p>
      <p style="font-size:22px; font-weight:bold; color:#15803d; margin:0;">{_score_label(current_score)}</p>
    </div>
  </div>

  {keywords_section}

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


async def send_operator_delivery_notification(
    order_id: str,
    package_name: str,
    amount: int,
    user_id: str,
) -> bool:
    """새 대행 서비스 주문 결제 완료 시 운영자(contact@aeolab.co.kr)에게 이메일 알림."""
    operator_email = os.getenv("OPERATOR_EMAIL", "contact@aeolab.co.kr")
    subject = f"[AEOlab 대행] 새 주문 접수 — {package_name} ({amount:,}원)"
    html = f"""
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width:480px; margin:0 auto; padding:24px; color:#1e293b;">
  <div style="background:#1d4ed8; border-radius:10px; padding:16px 20px; margin-bottom:20px; text-align:center;">
    <p style="color:#bfdbfe; font-size:12px; margin:0 0 4px;">대행 서비스 신규 주문</p>
    <h1 style="color:#fff; font-size:18px; font-weight:700; margin:0;">{package_name}</h1>
    <p style="color:#93c5fd; font-size:22px; font-weight:800; margin:6px 0 0;">{amount:,}원</p>
  </div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
    <tr>
      <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:13px; width:90px;">주문 ID</td>
      <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:13px; font-weight:600; word-break:break-all;">{order_id}</td>
    </tr>
    <tr>
      <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:13px;">사용자 ID</td>
      <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:13px;">{user_id[:8]}…</td>
    </tr>
  </table>
  <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
    <p style="font-size:13px; color:#166534; margin:0; font-weight:600;">영업일 3일 내 사용자에게 연락해 주세요.</p>
  </div>
  <div style="text-align:center;">
    <a href="https://aeolab.co.kr/admin" style="background:#1d4ed8; color:#fff; text-decoration:none; padding:10px 24px; border-radius:8px; font-size:14px; font-weight:600; display:inline-block;">관리자 페이지에서 확인</a>
  </div>
  <p style="font-size:11px; color:#94a3b8; margin-top:20px; text-align:center;">AEOlab · contact@aeolab.co.kr</p>
</div>
"""
    try:
        ok = await send_email(operator_email, subject, html)
        if ok:
            logger.info(f"send_operator_delivery_notification OK: order_id={order_id}")
        return ok
    except Exception as e:
        logger.warning(f"send_operator_delivery_notification 예외 (order_id={order_id}): {e}")
        return False
