"""
AEOlab PDF 리포트 생성 서비스 — v5.0
3페이지 구조 / 실측 데이터 기반 / 스크린샷 임베드 / 체크리스트

Page 1: AI 검색 현황 (실측 수치 + 스크린샷)
Page 2: 30일 점수 추이 + 항목별 점수 분석 + 강점 + 개선 포인트
Page 3: 이번 달 실행 체크리스트 + 키워드 순위

업종 분기: ACTIVE(네이버 AI 대상) / LIKELY(확대예정) / INACTIVE(비대상 → SEO 집중)
한글: NanumGothic TTF
"""
import io
import logging
import os
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak, Image as RLImage,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_logger = logging.getLogger(__name__)

# ── 폰트 ─────────────────────────────────────────────────────────────────────

def _register_korean_font() -> str:
    for path in [
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf",
        "/usr/share/fonts/noto-cjk/NotoSansCJKkr-Regular.otf",
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothic.ttf",
    ]:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("Korean", path))
                return "Korean"
            except Exception as e:
                _logger.warning(f"Korean font registration failed ({path}): {e}")
    return "Helvetica"

FONT_NAME = _register_korean_font()

# ── 업종 분류 ─────────────────────────────────────────────────────────────────

_ACTIVE_CATS = {"restaurant", "cafe", "bakery", "bar", "accommodation"}
_LIKELY_CATS = {"beauty", "nail", "skincare", "massage", "spa",
                "pet", "fitness", "yoga", "pharmacy", "dance", "ballet", "semi_permanent"}

_KO_CAT = {
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "바·주점",
    "beauty": "미용실", "nail": "네일샵", "medical": "병원·의원", "pharmacy": "약국",
    "fitness": "헬스·피트니스", "yoga": "요가·필라테스", "pet": "반려동물",
    "education": "교육", "tutoring": "학원·과외", "legal": "법률",
    "realestate": "부동산", "interior": "인테리어", "auto": "자동차",
    "cleaning": "청소·세탁", "shopping": "쇼핑", "fashion": "패션",
    "photo": "사진", "video": "영상", "design": "디자인",
    "accommodation": "숙박", "other": "기타",
}

def _elig(category: str, is_franchise: bool, bd: dict) -> str:
    saved = (bd or {}).get("briefing_eligibility", "")
    if saved in ("active", "likely", "inactive"):
        return saved
    if is_franchise:
        return "inactive"
    cat = (category or "").lower()
    if cat in _ACTIVE_CATS:
        return "active"
    if cat in _LIKELY_CATS:
        return "likely"
    return "inactive"

# ── 점수 등급 ─────────────────────────────────────────────────────────────────

def _grade(val) -> str:
    try:
        v = float(val)
        return "high" if v >= 70 else ("mid" if v >= 40 else "low")
    except (TypeError, ValueError):
        return "low"

def _stage(score: float) -> tuple[str, str]:
    for thr, lbl, desc in [
        (85, "최적화 완료",  "AI 검색 최적화가 매우 잘 되어 있습니다."),
        (70, "활성화 단계",  "AI 검색에서 활발하게 노출되고 있습니다."),
        (50, "성장 단계",    "AI 검색 노출이 꾸준히 성장하고 있습니다."),
        (30, "기반 구축 중", "기본 최적화가 진행 중입니다."),
        (0,  "초기 단계",    "AI 검색 최적화를 본격적으로 시작할 단계입니다."),
    ]:
        if score >= thr:
            return lbl, desc
    return "초기 단계", "AI 검색 최적화를 본격적으로 시작할 단계입니다."

# ── 이미지 다운로드 ───────────────────────────────────────────────────────────

def _fetch_image(url: str, w_cm: float = 13.5, h_cm: float = 8.5) -> Optional[object]:
    """이미지 URL → ReportLab Image. Supabase storage URL은 service role key로 인증."""
    if not url:
        return None
    try:
        import requests as _req
        headers = {"User-Agent": "AEOlab-PDF/5.0"}
        # Supabase storage URL: private/public 버킷 모두 service role key로 접근
        if "supabase" in url and "/storage/" in url:
            svc_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
            if svc_key:
                headers["Authorization"] = f"Bearer {svc_key}"
        r = _req.get(url, timeout=10, headers=headers)
        if r.status_code != 200:
            _logger.warning(f"Image fetch HTTP {r.status_code} ({url[:60]})")
            return None
        buf = io.BytesIO(r.content)
        return RLImage(buf, width=w_cm * cm, height=h_cm * cm)
    except Exception as e:
        _logger.warning(f"Image fetch failed ({url[:60]}): {e}")
        return None

# ── AI 플랫폼 결과 파싱 ───────────────────────────────────────────────────────

def _parse_gemini(r: dict) -> dict:
    freq  = int(r.get("exposure_freq") or 0)
    n     = int(r.get("sample_size") or 50)
    rate  = round(freq / n * 100, 1) if n else 0.0
    cites = r.get("citations") or []
    excerpt = cites[0].get("excerpt", "") if cites and isinstance(cites[0], dict) else ""
    return {"freq": freq, "n": n, "rate": rate, "excerpt": str(excerpt)[:80]}

def _parse_chatgpt(r: dict) -> dict:
    freq    = int(r.get("exposure_freq") or 0)
    n       = int(r.get("sample_size") or 50)
    rate    = round(freq / n * 100, 1) if n else 0.0
    cites   = r.get("citations") or []
    excerpt = cites[0].get("excerpt", "") if cites and isinstance(cites[0], dict) else ""
    queries = r.get("queries_used") or []
    return {"freq": freq, "n": n, "rate": rate, "excerpt": str(excerpt)[:80],
            "queries": [str(q) for q in queries[:3]]}

def _parse_naver(r: dict, elig: str) -> dict:
    if elig == "inactive":
        return {"eligible": False}
    in_briefing = bool(r.get("in_briefing") or r.get("mentioned"))
    excerpt     = str(r.get("excerpt") or "")[:80]
    kw_results  = r.get("keyword_results") or {}
    return {"eligible": True, "in_briefing": in_briefing,
            "excerpt": excerpt, "kw_results": kw_results}

def _parse_google(r: dict) -> dict:
    mentioned = bool(r.get("mentioned"))
    excerpt   = str(r.get("excerpt") or "")[:80]
    return {"mentioned": mentioned, "excerpt": excerpt}

# ── 개선 항목 데이터 ──────────────────────────────────────────────────────────

_IMPROVE_ITEMS = {
    "keyword_gap_score": {
        "label": "키워드 노출",
        "w_desc": "주요 검색어에서 사업장이 충분히 노출되지 않고 있습니다.",
        "steps_with_website": [
            "사업장을 대표하는 키워드 3개를 정하세요. 방식: '지역 + 업종 + 특징' 조합.\n"
            "   예) '강남 영어학원' / '성인 영어 회화' / '직장인 영어 과외'\n"
            "   같은 키워드를 모든 글에 똑같이 넣는 것은 역효과입니다.\n"
            "   포스팅마다 하나의 키워드를 다른 각도(수강 후기, 커리큘럼 소개, Q&A)로 다루세요.",
            "스마트플레이스 소개글에 위 키워드를 자연스럽게 포함해 200자 이상 작성하세요.",
            "네이버 블로그에 해당 키워드로 월 2회 이상 포스팅을 작성하세요.",
        ],
        "steps_no_website": [
            "사업장 대표 키워드 3개를 '지역+업종+특징' 조합으로 정하세요.\n"
            "   예) '강남 영어학원' / '성인 영어 회화' / '직장인 영어 과외'\n"
            "   포스팅마다 하나의 키워드를 다른 각도로 자연스럽게 사용하세요.",
            "스마트플레이스 소개글에 위 키워드를 포함해 200자 이상 작성하세요.",
            "네이버 블로그에 해당 키워드로 월 2회 이상 포스팅을 작성하세요.",
        ],
    },
    "smart_place_completeness": {
        "label": "스마트플레이스 완성도",
        "w_desc": "스마트플레이스 기본 정보 입력이 부족합니다.",
        "steps_with_website": [
            "영업시간·휴무일·주소·전화번호를 정확히 입력하세요.",
            "외관·내부·메뉴·시그니처 카테고리별 사진을 각 2~3장씩, 총 10장 이상 등록하세요.\n"
            "   AI는 사진 수와 카테고리 다양성을 신뢰도 지표로 활용합니다.",
            "소개글 200자 이상 작성: 업종·지역·특징 키워드를 자연스럽게 포함하세요.",
        ],
        "steps_no_website": [
            "영업시간·휴무일·주소·전화번호를 정확히 입력하세요.",
            "외관·내부·메뉴·시그니처 카테고리별 사진을 각 2~3장씩, 총 10장 이상 등록하세요.",
            "소개글 200자 이상 작성: 업종·지역·특징 키워드를 자연스럽게 포함하세요.",
        ],
    },
    "review_quality": {
        "label": "리뷰 관리",
        "w_desc": "고객 리뷰에 대한 응대가 부족합니다.",
        "steps_with_website": [
            "최근 리뷰 10개에 24시간 내 답글을 다세요.\n"
            "   긍정 리뷰: 감사 인사 + 서비스 한 줄 안내\n"
            "   부정 리뷰: 불편 사항 인정 + 개선 의지 표현 (삭제 요청 금지)",
            "카운터에 'QR코드 리뷰 요청 카드'를 비치하고 방문 고객에게 안내하세요.",
            "리뷰 수가 10개 미만이라면 블로그 체험단 1회 진행으로 빠르게 확보하세요.",
        ],
        "steps_no_website": [
            "최근 리뷰 10개에 24시간 내 답글을 다세요.\n"
            "   긍정 리뷰: 감사 인사 + 서비스 한 줄 안내\n"
            "   부정 리뷰: 불편 사항 인정 + 개선 의지 표현",
            "카운터에 'QR코드 리뷰 요청 카드'를 비치하고 방문 고객에게 안내하세요.",
            "리뷰 수가 10개 미만이라면 블로그 체험단 1회 진행으로 빠르게 확보하세요.",
        ],
    },
    "naver_exposure_confirmed": {
        "label": "네이버 AI 브리핑 노출",
        "w_desc": "현재 네이버 AI 브리핑에 노출되지 않고 있습니다.",
        "steps_with_website": [
            "스마트플레이스 소개글을 200자 이상으로 작성하고 대표 키워드를 포함하세요.",
            "사진 카테고리(외관·내부·메뉴판·시그니처·가격판)를 모두 등록하세요.",
            "최근 1개월 내 리뷰 답글 3건 이상을 유지하세요.",
        ],
        "steps_no_website": [
            "스마트플레이스 소개글을 200자 이상으로 작성하고 대표 키워드를 포함하세요.",
            "사진 카테고리(외관·내부·메뉴판·시그니처·가격판)를 모두 등록하세요.",
            "최근 1개월 내 리뷰 답글 3건 이상을 유지하세요.",
        ],
    },
    "multi_ai_exposure": {
        "label": "글로벌 AI 노출",
        "w_desc": "ChatGPT·Gemini에서 사업장이 아직 언급되지 않고 있습니다.",
        "steps_with_website": [
            "블로그·SNS에 사업장 소개 콘텐츠를 월 2회 이상 꾸준히 게시하세요.\n"
            "   AI는 외부 콘텐츠를 학습해 사용자 질문에 답변합니다.",
            "웹사이트·스마트플레이스·카카오맵·구글맵에 사업장 이름·주소·전화번호가 동일한지 확인하세요.",
            "구글 비즈니스 프로필(business.google.com)을 등록하세요. 무료이며 3~4주 내 효과가 나타납니다.",
        ],
        "steps_no_website": [
            "블로그·SNS에 사업장 소개 콘텐츠를 월 2회 이상 꾸준히 게시하세요.",
            "스마트플레이스·카카오맵·구글맵에 사업장 이름·주소·전화번호가 동일한지 확인하세요.",
            "구글 비즈니스 프로필(business.google.com)을 무료로 등록하세요.",
        ],
    },
    "schema_seo": {
        "label": "웹사이트 AI 최적화",
        "w_desc_with_website": "웹사이트가 있지만 AI 검색 최적화가 이루어지지 않았습니다.",
        "w_desc_no_website": "웹사이트가 없어 구글·ChatGPT 등이 사업장 정보를 충분히 인식하지 못합니다.",
        "steps_with_website": [
            "웹사이트 제목(title) 태그와 설명(meta description)에 주요 키워드를 포함하세요.",
            "사업장명·주소·전화번호·영업시간을 JSON-LD 구조화 데이터로 추가하세요.\n"
            "   AEOlab '스키마 생성' 기능으로 코드를 자동 생성할 수 있습니다.",
            "모든 사진에 alt 텍스트(키워드 포함)를 추가하세요.",
        ],
        "steps_no_website": [
            "네이버 모두(modoo.at) 또는 카카오 채널을 무료로 개설하세요.\n"
            "   간단한 홈페이지 역할을 하며 구글·AI 검색 노출에 도움이 됩니다.",
            "모두 페이지에 사업장명·주소·전화번호·영업시간·서비스 소개를 상세히 입력하세요.",
            "개설 후 구글 비즈니스 프로필에 해당 URL을 등록하세요.",
        ],
    },
    "online_mentions_t2": {
        "label": "온라인 언급량",
        "w_desc": "온라인 공간에서의 사업장 언급이 적습니다.",
        "steps_with_website": [
            "방문 고객에게 네이버 블로그·인스타그램 후기 작성을 요청하고 소정의 혜택을 제공하세요.",
            "블로그 체험단(서울 기준 5~10만원)을 1회 진행하면 언급량을 빠르게 늘릴 수 있습니다.",
            "지역 맘카페·네이버 카페에 사업장 이벤트 소식을 게시하세요.",
        ],
        "steps_no_website": [
            "방문 고객에게 네이버 블로그·인스타그램 후기 작성을 요청하고 소정의 혜택을 제공하세요.",
            "블로그 체험단 1회 진행으로 언급량을 빠르게 늘릴 수 있습니다.",
            "지역 맘카페·네이버 카페에 사업장 이벤트 소식을 게시하세요.",
        ],
    },
    "google_presence": {
        "label": "Google AI 노출",
        "w_desc": "Google AI 검색에서 사업장이 노출되지 않고 있습니다.",
        "steps_with_website": [
            "구글 비즈니스 프로필(business.google.com)을 등록하세요. 무료입니다.",
            "사진 10장 이상, 영업시간, 서비스 카테고리를 모두 입력하세요.",
            "구글 리뷰에 정기적으로 답글을 달면 Google AI 노출 가능성이 높아집니다.",
        ],
        "steps_no_website": [
            "구글 비즈니스 프로필(business.google.com)을 등록하세요. 무료입니다.",
            "사진 10장 이상, 영업시간, 서비스 카테고리를 모두 입력하세요.",
            "구글 리뷰에 정기적으로 답글을 달면 Google AI 노출 가능성이 높아집니다.",
        ],
    },
}

_STRENGTH_CONTEXT = {
    "keyword_gap_score": (
        "키워드 노출",
        "주요 검색어에서 사업장이 잘 발견되고 있습니다.",
        "고객이 검색할 때 경쟁 업체보다 먼저 노출될 가능성이 높습니다.",
    ),
    "smart_place_completeness": (
        "스마트플레이스 완성도",
        "스마트플레이스 정보가 완벽하게 입력되어 있습니다.",
        "AI가 사업장 정보를 완전하게 인식합니다. 정보가 누락된 경쟁 업체보다 유리한 위치입니다.",
    ),
    "review_quality": (
        "리뷰 관리",
        "고객 리뷰가 활발하고 응대가 잘 이루어지고 있습니다.",
        "리뷰 답글은 AI 신뢰도의 핵심 신호입니다. 경쟁 업체 대비 AI 노출 가능성이 높습니다.",
    ),
    "naver_exposure_confirmed": (
        "네이버 AI 브리핑",
        "네이버 AI 브리핑에 노출되고 있습니다.",
        "검색 상단 AI 답변에 포함되어 클릭률이 일반 검색보다 최대 27% 높습니다.",
    ),
    "multi_ai_exposure": (
        "글로벌 AI 노출",
        "ChatGPT·Gemini 등 글로벌 AI에서 언급되고 있습니다.",
        "글로벌 AI 사용자가 사업장을 추천받을 수 있습니다. 젊은 층·외국인 유입에 효과적입니다.",
    ),
    "schema_seo": (
        "웹사이트 AI 최적화",
        "웹사이트가 AI 검색에 최적화되어 있습니다.",
        "구글·ChatGPT 등이 사업장 웹사이트 정보를 정확하게 인식합니다.",
    ),
    "online_mentions_t2": (
        "온라인 언급량",
        "블로그·포털 등에서 활발하게 언급되고 있습니다.",
        "풍부한 온라인 언급은 AI가 사업장을 신뢰할 만한 정보로 판단하는 근거가 됩니다.",
    ),
    "google_presence": (
        "Google AI 노출",
        "Google AI 검색에서 사업장이 노출되고 있습니다.",
        "구글을 사용하는 외국인·젊은 층 고객이 사업장을 발견할 수 있습니다.",
    ),
}

# ── 스타일 ────────────────────────────────────────────────────────────────────

def _S(f: str) -> dict:
    b = getSampleStyleSheet()
    def ps(name, parent="Normal", **kw):
        return ParagraphStyle(name, parent=b[parent], fontName=f, **kw)
    return {
        "title":   ps("T",  "Title",   fontSize=18, spaceAfter=3),
        "h2":      ps("H2", "Heading2",fontSize=12,
                      textColor=colors.HexColor("#1d4ed8"), spaceBefore=12, spaceAfter=4),
        "h3":      ps("H3", "Heading3",fontSize=10,
                      textColor=colors.HexColor("#374151"), spaceBefore=6, spaceAfter=2),
        "body":    ps("BD", fontSize=10, spaceAfter=3, leading=16),
        "small":   ps("SM", fontSize=8, textColor=colors.gray, spaceAfter=2, leading=12),
        "sub":     ps("SB", fontSize=9, leftIndent=12,
                      textColor=colors.HexColor("#4b5563"), spaceAfter=2, leading=13),
        "good":    ps("GD", fontSize=10, textColor=colors.HexColor("#166534"),
                      spaceBefore=3, spaceAfter=1, leading=15),
        "good_sub":ps("GS", fontSize=8, leftIndent=12,
                      textColor=colors.HexColor("#14532d"), spaceAfter=4, leading=12),
        "warn":    ps("WN", fontSize=10, textColor=colors.HexColor("#92400e"),
                      spaceBefore=4, spaceAfter=1, leading=15),
        "action":  ps("AC", fontSize=9, leftIndent=16,
                      textColor=colors.HexColor("#1e3a5f"), spaceAfter=1, leading=13),
        "note":    ps("NT", fontSize=8, leftIndent=16,
                      textColor=colors.HexColor("#6b7280"), spaceAfter=5, leading=12),
        "seo_h":   ps("SH", fontSize=10, spaceBefore=5, spaceAfter=1,
                      textColor=colors.HexColor("#7c3aed"), leading=15),
        "seo_b":   ps("S2", fontSize=9, leftIndent=12,
                      textColor=colors.HexColor("#4c1d95"), spaceAfter=4, leading=13),
        "chk":     ps("CK", fontSize=10, leftIndent=8, spaceAfter=5, leading=16),
        "pg_head": ps("PH", "Heading2", fontSize=11,
                      textColor=colors.HexColor("#374151"), spaceBefore=0, spaceAfter=4),
    }

# ── 공통 ─────────────────────────────────────────────────────────────────────

def _hr(story, color="#e5e7eb", thick=0.5, after=6):
    story.append(HRFlowable(width="100%", thickness=thick,
                             color=colors.HexColor(color), spaceAfter=after))

def _page_header(story, biz_name: str, page_title: str, date: str, S: dict):
    row = Table([[
        Paragraph(f"<b>{biz_name}</b>  AI 검색 진단 리포트", S["pg_head"]),
        Paragraph(f"{page_title}  |  {date}", S["small"]),
    ]], colWidths=[10 * cm, 5.6 * cm])
    row.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (-1, -1), FONT_NAME),
        ("VALIGN",    (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN",     (1, 0), (1, 0),   "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0),  1, colors.HexColor("#1d4ed8")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(row)
    story.append(Spacer(1, 8))

def _banner(text: str, bg: str, border: str, S: dict):
    t = Table([[Paragraph(text, S["body"])]], colWidths=[15.6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor(bg)),
        ("BOX",           (0, 0), (-1, -1), 1.5, colors.HexColor(border)),
        ("FONTNAME",      (0, 0), (-1, -1), FONT_NAME),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))
    return t

def _trend(history: list) -> str:
    if not history or len(history) < 2:
        return ""
    def _s(r): return float(r.get("total_score") or r.get("unified_score") or 0)
    diff = _s(history[0]) - _s(history[-1])
    if abs(diff) < 1:
        return f"최근 {len(history)}회 측정 동안 점수 변화 거의 없음"
    return f"최근 {len(history)}회 측정 동안 {abs(diff):.1f}점 {'상승' if diff > 0 else '하락'}"


def _section_bg(story: list, text: str, bg: str = "#eff6ff", fg: str = "#1d4ed8"):
    t = Table(
        [[Paragraph(f"<b>{text}</b>",
                    ParagraphStyle("sbg", fontName=FONT_NAME, fontSize=11,
                                   textColor=colors.HexColor(fg), leading=14))]],
        colWidths=[15.6 * cm],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor(bg)),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))


def _score_card_row(total: float, nav: dict, gpt: dict, gem: dict, elig: str) -> Table:
    stage_lbl, _ = _stage(total)

    def _card(label: str, value: str, sub: str, bg: str, fg: str) -> Table:
        sl = ParagraphStyle("", fontName=FONT_NAME, fontSize=7.5,
                            textColor=colors.HexColor(fg), leading=10)
        sv = ParagraphStyle("", fontName=FONT_NAME, fontSize=20,
                            textColor=colors.HexColor(fg), leading=22)
        ss = ParagraphStyle("", fontName=FONT_NAME, fontSize=7,
                            textColor=colors.HexColor(fg), leading=9)
        inner = Table(
            [[Paragraph(label, sl)], [Paragraph(value, sv)], [Paragraph(sub, ss)]],
            colWidths=[3.6 * cm],
        )
        inner.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor(bg)),
            ("TOPPADDING",    (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("LEFTPADDING",   (0, 0), (-1, -1), 9),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("BOX",           (0, 0), (-1, -1), 1, colors.HexColor("#e5e7eb")),
        ]))
        return inner

    if elig == "inactive":
        n_v, n_s, n_bg, n_fg = "비대상", "업종 미지원", "#f3f4f6", "#6b7280"
    elif nav.get("in_briefing"):
        n_v, n_s, n_bg, n_fg = "노출중", "AI 브리핑 인용", "#dcfce7", "#166534"
    elif nav.get("eligible"):
        n_v, n_s, n_bg, n_fg = "미노출", "최적화 필요", "#fef2f2", "#991b1b"
    else:
        n_v, n_s, n_bg, n_fg = "비대상", "업종 미지원", "#f3f4f6", "#6b7280"

    gpt_ok = gpt["rate"] > 0
    gem_ok = gem["rate"] > 0

    row = [
        _card("종합 점수", f"{total:.0f}점", stage_lbl, "#eff6ff", "#1e40af"),
        _card("네이버 AI", n_v, n_s, n_bg, n_fg),
        _card("ChatGPT", f"{gpt['rate']:.0f}%", f"{gpt['freq']}/{gpt['n']}회",
              "#dcfce7" if gpt_ok else "#fef2f2", "#166534" if gpt_ok else "#991b1b"),
        _card("Gemini AI", f"{gem['rate']:.0f}%", f"{gem['freq']}/{gem['n']}회",
              "#dcfce7" if gem_ok else "#fef2f2", "#166534" if gem_ok else "#991b1b"),
    ]
    outer = Table([row], colWidths=[4.0 * cm] * 4)
    outer.setStyle(TableStyle([
        ("LEFTPADDING",  (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    return outer


# ── 30일 점수 추이 막대 차트 (Page 2 신규) ────────────────────────────────────

def _history_chart(history: list) -> Optional[Drawing]:
    """최근 12회 점수 이력을 막대 차트로 반환. 데이터 없으면 None."""
    if not history:
        return None

    def _score(r):
        try:
            return float(r.get("total_score") or r.get("unified_score") or 0)
        except (TypeError, ValueError):
            return 0.0

    def _date_label(r):
        raw = r.get("scanned_at") or r.get("created_at") or ""
        try:
            return raw[5:10]  # MM-DD
        except Exception as _e:
            _logger.warning("pdf date parse failed: raw=%s err=%s", raw, _e)
            return ""

    # 오래된 것부터 최근 순 (최대 12회)
    records = list(reversed(history[:12]))
    n = len(records)
    if n == 0:
        return None

    # 레이아웃 상수
    W = 15.6 * cm
    H = 5.2 * cm
    PL = 1.5 * cm   # left padding (Y축 레이블)
    PR = 0.3 * cm
    PT = 0.3 * cm
    PB = 1.2 * cm   # bottom padding (날짜 레이블)

    chart_w = W - PL - PR
    chart_h = H - PT - PB

    d = Drawing(W, H)

    # Y축 격자선 (0/25/50/75/100)
    for y_val in (0, 25, 50, 75, 100):
        y_px = PB + chart_h * (y_val / 100)
        line = Line(PL, y_px, W - PR, y_px)
        line.strokeColor = colors.HexColor("#e5e7eb")
        line.strokeWidth = 0.5
        d.add(line)
        # Y축 레이블
        lbl = String(PL - 4, y_px - 3, str(y_val),
                     fontName=FONT_NAME, fontSize=6,
                     textAnchor="end",
                     fillColor=colors.HexColor("#9ca3af"))
        d.add(lbl)

    # 막대
    bar_gap = 3
    bar_w = (chart_w - bar_gap * (n - 1)) / n if n > 0 else chart_w

    for i, rec in enumerate(records):
        score = _score(rec)
        bar_h = chart_h * min(score, 100) / 100
        x = PL + i * (bar_w + bar_gap)
        y = PB

        # 색상 결정
        if score >= 70:
            bar_color = "#22c55e"
        elif score >= 40:
            bar_color = "#f59e0b"
        else:
            bar_color = "#ef4444"

        rect = Rect(x, y, bar_w, bar_h,
                    fillColor=colors.HexColor(bar_color),
                    strokeColor=colors.HexColor(bar_color),
                    strokeWidth=0)
        d.add(rect)

        # 막대 위 점수 레이블
        score_lbl = String(x + bar_w / 2, y + bar_h + 2,
                           f"{score:.0f}",
                           fontName=FONT_NAME, fontSize=6,
                           textAnchor="middle",
                           fillColor=colors.HexColor("#374151"))
        d.add(score_lbl)

        # 하단 날짜 레이블
        date_lbl = String(x + bar_w / 2, PB - 10,
                          _date_label(rec),
                          fontName=FONT_NAME, fontSize=5.5,
                          textAnchor="middle",
                          fillColor=colors.HexColor("#6b7280"))
        d.add(date_lbl)

    return d


# ── 항목별 점수 분석 표 (Page 2 신규) ────────────────────────────────────────

def _breakdown_table(bd: dict, elig: str) -> Table:
    """Track1/Track2 항목별 점수를 표로 반환."""

    # 항목 정의: (bd_key, 항목명, 트랙, 구분, 측정 의미)
    _ITEMS = [
        ("keyword_gap_score",        "키워드 노출",         "T1", "네이버", "검색어 발견 가능성"),
        ("smart_place_completeness", "스마트플레이스 완성도", "T1", "네이버", "정보 완성도·신뢰도"),
        ("review_quality",           "리뷰 관리",           "T1", "네이버", "고객 반응 신호"),
        ("naver_exposure_confirmed", "네이버 AI 브리핑",    "T1", "네이버", "AI 브리핑 직접 노출"),
        ("multi_ai_exposure",        "글로벌 AI 노출",      "T2", "글로벌", "ChatGPT·Gemini 언급"),
        ("schema_seo",               "웹사이트 SEO",        "T2", "글로벌", "웹사이트 AI 인식"),
        ("online_mentions_t2",       "온라인 언급량",        "T2", "글로벌", "온라인 콘텐츠 양"),
        ("google_presence",          "Google AI 노출",      "T2", "글로벌", "Google AI 노출"),
    ]

    def _cell_ps(fg: str, size: int = 8) -> ParagraphStyle:
        return ParagraphStyle("", fontName=FONT_NAME, fontSize=size,
                              textColor=colors.HexColor(fg), leading=11)

    header_ps = ParagraphStyle("", fontName=FONT_NAME, fontSize=8,
                                textColor=colors.white, leading=11)

    rows = [[
        Paragraph("구분",     header_ps),
        Paragraph("항목",     header_ps),
        Paragraph("점수",     header_ps),
        Paragraph("평가",     header_ps),
        Paragraph("측정 의미", header_ps),
    ]]

    style_cmds = [
        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.0, colors.HexColor("#3b82f6")),
        ("BOX",           (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]

    row_idx = 1
    for bd_key, label, track, division, meaning in _ITEMS:
        # INACTIVE 업종은 네이버 AI 브리핑 제외
        if elig == "inactive" and bd_key == "naver_exposure_confirmed":
            continue

        val = bd.get(bd_key)

        # 구분 셀 색상
        if track == "T1":
            div_bg, div_fg = "#eff6ff", "#1d4ed8"
        else:
            div_bg, div_fg = "#f5f3ff", "#7c3aed"

        # 점수·평가 셀 색상
        if val is None:
            score_txt = "—"
            eval_txt  = "—"
            score_bg  = "#f9fafb"
            score_fg  = "#6b7280"
            eval_bg   = "#f9fafb"
            eval_fg   = "#6b7280"
        else:
            try:
                fval = float(val)
            except (TypeError, ValueError):
                fval = 0.0
            score_txt = f"{fval:.0f}점"
            if fval >= 70:
                score_bg, score_fg = "#dcfce7", "#166534"
                eval_bg,  eval_fg  = "#dcfce7", "#166534"
                eval_txt = "우수"
            elif fval >= 40:
                score_bg, score_fg = "#fef9c3", "#92400e"
                eval_bg,  eval_fg  = "#fef9c3", "#92400e"
                eval_txt = "보통"
            else:
                score_bg, score_fg = "#fef2f2", "#991b1b"
                eval_bg,  eval_fg  = "#fef2f2", "#991b1b"
                eval_txt = "개선필요"

        rows.append([
            Paragraph(f"{track} {division}", _cell_ps(div_fg)),
            Paragraph(label,     _cell_ps("#1f2937")),
            Paragraph(score_txt, _cell_ps(score_fg)),
            Paragraph(eval_txt,  _cell_ps(eval_fg)),
            Paragraph(meaning,   _cell_ps("#374151")),
        ])

        # 구분 셀 배경
        style_cmds.append(("BACKGROUND", (0, row_idx), (0, row_idx), colors.HexColor(div_bg)))
        # 점수 셀 배경
        style_cmds.append(("BACKGROUND", (2, row_idx), (2, row_idx), colors.HexColor(score_bg)))
        # 평가 셀 배경
        style_cmds.append(("BACKGROUND", (3, row_idx), (3, row_idx), colors.HexColor(eval_bg)))

        row_idx += 1

    t = Table(rows, colWidths=[1.8 * cm, 3.8 * cm, 1.8 * cm, 2.2 * cm, 6.0 * cm])
    t.setStyle(TableStyle(style_cmds))
    return t


# ── 키워드 순위 색상 헬퍼 (Page 3 개선) ──────────────────────────────────────

def _rank_info(entries: list, key: str) -> tuple[str, str, str]:
    """(표시텍스트, 텍스트색, 배경색) 반환.
    naver_keyword_rank.py는 pc_rank/mobile_rank/place_rank 키로 저장하므로
    key="pc_rank" 형태로 호출해야 함. None 값은 미노출로 처리."""
    nums = []
    for v in entries:
        try:
            val = v.get(key)
            if val is None:
                continue
            iv = int(val)
            if 0 < iv < 99:
                nums.append(iv)
        except (TypeError, ValueError):
            pass
    if not nums:
        return "미노출", "#991b1b", "#fef2f2"
    avg = sum(nums) / len(nums)
    if avg <= 10:
        return f"{avg:.0f}위", "#166534", "#dcfce7"
    elif avg <= 30:
        return f"{avg:.0f}위", "#92400e", "#fef9c3"
    else:
        return f"{avg:.0f}위", "#374151", "#f8fafc"


# ── 메인 ─────────────────────────────────────────────────────────────────────

def generate_pdf_report(
    biz: dict,
    latest_scan: dict,
    history: list,
    guide: Optional[dict] = None,
    keyword_ranks_history: Optional[list] = None,
    screenshots: Optional[list] = None,
    blog_analysis: Optional[dict] = None,
) -> bytes:
    buf = io.BytesIO()
    S   = _S(FONT_NAME)
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=2.2 * cm, leftMargin=2.2 * cm,
        topMargin=2.2 * cm, bottomMargin=2 * cm,
        title=f"AEOlab 리포트 — {biz.get('name', '')}",
    )
    story = []
    today      = datetime.now().strftime("%Y년 %m월 %d일")
    biz_name   = biz.get("name", "")
    category   = biz.get("category", "")
    region     = biz.get("region", "")
    has_web    = bool(biz.get("website_url", "").strip())
    keywords   = biz.get("keywords") or []
    is_franc   = bool(biz.get("is_franchise", False))
    bd         = latest_scan.get("score_breakdown") or {}
    total      = float(latest_scan.get("total_score") or latest_scan.get("unified_score") or 0)
    scan_date  = (latest_scan.get("scanned_at") or "")[:10]
    elig       = _elig(category, is_franc, bd)
    stage_lbl, stage_desc = _stage(total)

    # 플랫폼 결과 파싱
    gem = _parse_gemini(latest_scan.get("gemini_result") or {})
    gpt = _parse_chatgpt(latest_scan.get("chatgpt_result") or {})
    nav = _parse_naver(latest_scan.get("naver_result") or {}, elig)
    goo = _parse_google(latest_scan.get("google_result") or {})

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PAGE 1 — AI 검색 현황 (실측 데이터)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    _page_header(story, biz_name, "1/3  AI 검색 현황", today, S)

    # 기본 정보 한 줄
    ko_cat = _KO_CAT.get(category, category)
    story.append(Paragraph(
        f"{region}  ·  {ko_cat}  |  측정일: {scan_date}  |  {_trend(history)}",
        S["small"],
    ))
    story.append(Spacer(1, 8))

    # ── 핵심 지표 카드 (4박스) ──────────────────────────────────────────────
    story.append(_score_card_row(total, nav, gpt, gem, elig))
    story.append(Spacer(1, 10))
    _hr(story, after=6)

    # 채널 안내 배너
    if elig == "inactive":
        btext = ("【비대상 업종】  네이버 AI 브리핑은 음식점·카페·숙박 등 일부 업종만 대상입니다 (네이버 공식 정책). "
                 "이 사업장은 ChatGPT · Gemini · Google AI 최적화에 집중해야 합니다.")
        story.append(_banner(btext, "#fef9c3", "#ca8a04", S))
    elif elig == "likely":
        btext = ("【확대 예정 업종】  현재 네이버 AI 탭 베타 확대 중인 업종입니다. "
                 "지금 스마트플레이스를 최적화해 두면 정식 오픈 시 유리합니다.")
        story.append(_banner(btext, "#ecfdf5", "#059669", S))
    else:
        btext = ("【노출 대상 업종】  네이버 AI 브리핑 노출 대상 업종입니다. "
                 "스마트플레이스 최적화가 AI 노출의 핵심입니다.")
        story.append(_banner(btext, "#eff6ff", "#2563eb", S))
    story.append(Spacer(1, 8))

    # ── AI 플랫폼별 실측 노출 현황 ──────────────────────────────────────────
    _section_bg(story, "AI 플랫폼별 실측 노출 현황")

    def _st(text, fg, bold=False):
        return Paragraph(
            f"<b>{text}</b>" if bold else text,
            ParagraphStyle("ps", fontName=FONT_NAME, fontSize=9,
                           textColor=colors.HexColor(fg), leading=13),
        )

    # 헤더 행 스타일
    pf_style = [
        ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
        ("FONTNAME",      (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE",      (0, 0), (-1, 0), 9),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEBELOW",     (0, 0), (-1, 0), 1.5, colors.HexColor("#3b82f6")),
    ]

    pf_rows = [[
        Paragraph("플랫폼", ParagraphStyle("h", fontName=FONT_NAME, fontSize=9,
                                           textColor=colors.white, leading=12)),
        Paragraph("상태", ParagraphStyle("h", fontName=FONT_NAME, fontSize=9,
                                         textColor=colors.white, leading=12)),
        Paragraph("측정 결과 상세", ParagraphStyle("h", fontName=FONT_NAME, fontSize=9,
                                                  textColor=colors.white, leading=12)),
    ]]

    def _add_row(platform, status_text, status_ok, detail, row_idx, is_neutral=False):
        bg = "#f0fdf4" if status_ok else ("#f9fafb" if is_neutral else "#fff7f7")
        fg = "#166534" if status_ok else ("#6b7280" if is_neutral else "#991b1b")
        pf_style.append(("BACKGROUND", (1, row_idx), (1, row_idx), colors.HexColor(bg)))
        pf_rows.append([
            _st(platform, "#1f2937", bold=True),
            _st(status_text, fg, bold=True),
            Paragraph(detail, ParagraphStyle("d", fontName=FONT_NAME, fontSize=8,
                                             textColor=colors.HexColor("#374151"), leading=12)),
        ])

    # 네이버 AI 브리핑
    if not nav["eligible"]:
        _add_row("네이버 AI 브리핑", "비대상 업종",
                 False,
                 "네이버 공식 정책상 현재 이 업종은 AI 브리핑 서비스 미지원",
                 1, is_neutral=True)
    else:
        ok  = nav["in_briefing"]
        exc = f'  발췌: "{nav["excerpt"]}"' if nav.get("excerpt") else ""
        _add_row("네이버 AI 브리핑",
                 "노출됨" if ok else "미노출",
                 ok,
                 ("AI 브리핑에 사업장이 포함되어 있습니다." + exc) if ok
                 else "현재 미노출 — 스마트플레이스 소개글·사진 보강 권장",
                 1)

    # ChatGPT
    gpt_ok  = gpt["freq"] > 0
    gpt_q   = "  질문 예시: " + ", ".join(f'"{q}"' for q in gpt["queries"][:2]) if gpt["queries"] else ""
    gpt_exc = f'  발췌: "{gpt["excerpt"]}"' if gpt.get("excerpt") else ""
    _add_row("ChatGPT",
             f"{gpt['freq']}/{gpt['n']}회  ({gpt['rate']}%)",
             gpt_ok,
             (f"총 {gpt['n']}회 질문 중 {gpt['freq']}회 언급됨" + gpt_exc + gpt_q) if gpt_ok
             else f"총 {gpt['n']}회 질문에서 미언급{gpt_q}  ·  블로그·SNS 콘텐츠 강화 권장",
             2)

    # Gemini
    gem_ok  = gem["freq"] > 0
    gem_exc = f'  발췌: "{gem["excerpt"]}"' if gem.get("excerpt") else ""
    _add_row("Gemini AI",
             f"{gem['freq']}/{gem['n']}회  ({gem['rate']}%)",
             gem_ok,
             (f"총 {gem['n']}회 질문 중 {gem['freq']}회 언급됨" + gem_exc) if gem_ok
             else f"총 {gem['n']}회 질문에서 미언급  ·  구조화 콘텐츠 및 구글 등록 권장",
             3)

    # Google AI
    goo_ok  = goo["mentioned"]
    goo_exc = f'  발췌: "{goo["excerpt"]}"' if goo.get("excerpt") else ""
    _add_row("Google AI Overview",
             "노출됨" if goo_ok else "미노출",
             goo_ok,
             ("Google AI 검색에 노출 중입니다." + goo_exc) if goo_ok
             else "미노출 — 구글 비즈니스 프로필 등록 권장 (무료, Gemini 수주 / Google AI Overview 수개월 반영)",
             4)

    pf_table = Table(pf_rows, colWidths=[3.8 * cm, 2.8 * cm, 9.0 * cm])
    pf_table.setStyle(TableStyle(pf_style))
    story.append(pf_table)
    story.append(Spacer(1, 10))

    # ── 스크린샷 분류: 블로그 vs AI 브리핑 ──────────────────────────────────
    # 버그 수정: "blog" 포함 또는 before/blog_keyword/naver/keyword 타입 모두 수집
    blog_shots, ai_shots = [], []
    for s in (screenshots or []):
        url = s.get("image_url") or ""
        ct  = (s.get("capture_type") or "").lower()
        if "google" in ct or not url:
            continue
        kw = s.get("keyword") or s.get("query_used") or ct or "검색 결과"
        if "naver_ai" in ct:
            if len(ai_shots) < 1:
                ai_shots.append((kw, url))
        elif "blog" in ct or ct in ("before", "blog_keyword", "naver", "keyword"):
            # 비교카드(after_Xd)는 제외 — 블로그 raw 스크린샷만 수집
            if len(blog_shots) < 2:
                blog_shots.append((kw, url))

    cap_style = ParagraphStyle("cap", fontName=FONT_NAME, fontSize=8,
                               textColor=colors.HexColor("#6b7280"), leading=11, spaceAfter=4)

    def _show_shot(shots, heading, heading_bg="#f8fafc", heading_fg="#374151"):
        if not shots:
            return
        _section_bg(story, heading, bg=heading_bg, fg=heading_fg)
        if len(shots) == 1:
            # 1개: 전체폭
            img = _fetch_image(shots[0][1], w_cm=14.0, h_cm=8.0)
            if img:
                story.append(img)
                story.append(Paragraph(shots[0][0], cap_style))
        else:
            # 2개: 좌우 나란히 (각 6.8cm 폭)
            img_cells = []
            for kw_i, url_i in shots[:2]:
                img_i = _fetch_image(url_i, w_cm=6.8, h_cm=5.0)
                cell = [img_i, Paragraph(kw_i, cap_style)] if img_i else [Paragraph(kw_i, cap_style)]
                img_cells.append(cell)
            if len(img_cells) == 2:
                two_col = Table([img_cells], colWidths=[7.6 * cm, 7.6 * cm])
                two_col.setStyle(TableStyle([
                    ("VALIGN",      (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING",(0, 0), (-1, -1), 2),
                ]))
                story.append(two_col)
            elif img_cells:
                for cell in img_cells:
                    for el in cell:
                        story.append(el)
        story.append(Spacer(1, 8))

    if elig == "inactive":
        # INACTIVE: 블로그 검색 스크린샷이 네이버 노출의 유일한 시각적 증거
        _show_shot(blog_shots, "네이버 블로그 검색 노출 현황  (네이버 SEO 증거)", "#eff6ff", "#1d4ed8")
    else:
        # ACTIVE/LIKELY: AI 브리핑 먼저, 블로그 두 번째
        _show_shot(ai_shots, "네이버 AI 브리핑 스크린샷", "#f8fafc", "#374151")
        _show_shot(blog_shots, "네이버 블로그 검색 스크린샷", "#f8fafc", "#374151")

    # ── 블로그 진단 ────────────────────────────────────────────────────────────
    blog_ok = blog_analysis and not blog_analysis.get("error")
    if blog_ok:
        _section_bg(story, "블로그 진단  (네이버 블로그 SEO 분석)", bg="#f0fdf4", fg="#166534")
        platform_map = {"naver": "네이버 블로그", "tistory": "티스토리",
                        "wordpress": "워드프레스", "other": "기타 블로그"}
        fresh_map    = {"active": "활발 (월 2회+)", "normal": "보통 (월 1회)",
                        "stale": "미흡 (분기 1회)", "inactive": "비활성 (6개월+)"}
        b_platform  = platform_map.get(blog_analysis.get("platform", ""), "블로그")
        b_post_cnt  = blog_analysis.get("post_count", 0)
        b_freshness = fresh_map.get(blog_analysis.get("freshness", ""), "측정 중")
        b_readiness = float(blog_analysis.get("ai_readiness_score") or 0)
        # keyword_coverage: float (0~100 퍼센트 단위), covered/missing_keywords: list
        _kw_cov_raw = blog_analysis.get("keyword_coverage") or 0
        b_covered   = blog_analysis.get("covered_keywords") or []
        b_missing   = blog_analysis.get("missing_keywords") or []
        b_coverage  = float(_kw_cov_raw) if not isinstance(_kw_cov_raw, dict) else 0.0
        # 저장된 coverage가 0이지만 covered_keywords가 있으면 리스트에서 역산 (과거 DB 불일치 보정)
        if b_coverage == 0 and (b_covered or b_missing):
            _total_kw = len(b_covered) + len(b_missing)
            b_coverage = round(len(b_covered) / _total_kw * 100, 1) if _total_kw > 0 else 0.0
        b_top_rec   = blog_analysis.get("top_recommendation") or ""

        bl_summary_rows = [
            [_st("플랫폼", "#374151", bold=True), _st(b_platform, "#1f2937"),
             _st("총 포스트", "#374151", bold=True), _st(f"{b_post_cnt}개", "#1f2937")],
            [_st("발행 빈도", "#374151", bold=True), _st(b_freshness, "#1f2937"),
             _st("AI 적합도", "#374151", bold=True), _st(f"{b_readiness:.0f}점 / 100점", "#1f2937")],
            [_st("키워드 커버율", "#374151", bold=True), _st(f"{b_coverage:.0f}%", "#1f2937"),
             _st("", "#374151"), _st("", "#374151")],
        ]
        bl_t = Table(bl_summary_rows, colWidths=[3.2*cm, 4.5*cm, 3.2*cm, 4.7*cm])
        bl_t.setStyle(TableStyle([
            ("FONTNAME",      (0, 0), (-1, -1), FONT_NAME),
            ("FONTSIZE",      (0, 0), (-1, -1), 9),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS",(0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc"), colors.white]),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
        ]))
        story.append(bl_t)
        story.append(Spacer(1, 4))

        if b_covered:
            story.append(Paragraph(
                "✓  포함된 키워드:  " + "  /  ".join(str(k) for k in b_covered[:6]),
                ParagraphStyle("bgood", fontName=FONT_NAME, fontSize=8,
                               textColor=colors.HexColor("#166534"), leading=12),
            ))
        if b_missing:
            story.append(Paragraph(
                "✗  빠진 키워드:  " + "  /  ".join(str(k) for k in b_missing[:6]),
                ParagraphStyle("bwarn", fontName=FONT_NAME, fontSize=8,
                               textColor=colors.HexColor("#991b1b"), leading=12),
            ))
        if b_top_rec:
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                f"핵심 권고:  {b_top_rec}",
                ParagraphStyle("brec", fontName=FONT_NAME, fontSize=8,
                               textColor=colors.HexColor("#1d4ed8"), leading=12),
            ))
        story.append(Spacer(1, 8))
    elif elig != "inactive":
        # 블로그 미등록 안내 (ACTIVE/LIKELY 업종만 표시)
        _section_bg(story, "블로그 진단", bg="#f8fafc", fg="#374151")
        story.append(Paragraph(
            "블로그 URL 미등록 — 설정 > 사업장 정보에서 블로그 주소를 등록하면 진단이 표시됩니다.",
            S["small"],
        ))
        story.append(Spacer(1, 8))

    # ── 실측 키워드 (사용자 등록 키워드) ────────────────────────────────────
    if keywords:
        _section_bg(story, "등록 키워드", bg="#f8fafc", fg="#374151")
        story.append(Paragraph(
            "현재 등록된 키워드:  " + "  /  ".join(str(k) for k in keywords[:6]),
            S["body"],
        ))
        story.append(Paragraph(
            "키워드 순위 측정 결과는 3페이지에서 확인하세요.",
            S["small"],
        ))
        story.append(Spacer(1, 6))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PAGE 2 — 점수 분석 + 강점 + 개선 포인트
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(PageBreak())
    _page_header(story, biz_name, "2/3  점수 분석 · 강점 · 개선 포인트", today, S)

    # ── [NEW] 30일 점수 추이 차트 ────────────────────────────────────────────
    chart = _history_chart(history)
    if chart:
        _section_bg(story, "30일 점수 추이  (측정 이력)")
        story.append(Paragraph("※ 초록 70점+, 주황 40-70점, 빨강 40점 미만", S["small"]))
        story.append(Spacer(1, 4))
        story.append(chart)
        story.append(Spacer(1, 8))

    # ── [NEW] 항목별 점수 분석 표 ────────────────────────────────────────────
    _section_bg(story, "항목별 점수 분석  (Track1 네이버 + Track2 글로벌)")
    story.append(_breakdown_table(bd, elig))
    story.append(Spacer(1, 10))
    _hr(story)

    # ── 강점 ──────────────────────────────────────────────────────────────────
    _section_bg(story, "현재 잘 되고 있는 것  (계속 유지하세요)", bg="#dcfce7", fg="#166534")
    strengths_found = False
    for key, (lbl, desc, why) in _STRENGTH_CONTEXT.items():
        if elig == "inactive" and key == "naver_exposure_confirmed":
            continue
        val = bd.get(key)
        if val is not None and _grade(val) == "high":
            pct = float(val)
            strengths_found = True
            block = [
                Paragraph(f"✓  {lbl}  ({pct:.0f}점)", S["good"]),
                Paragraph(f"   {desc}", S["sub"]),
                Paragraph(f"   {why}", S["good_sub"]),
            ]
            story.append(KeepTogether(block))

    if not strengths_found:
        story.append(Paragraph(
            "아직 뚜렷한 강점이 없습니다. 아래 개선 사항을 실행하면 빠르게 강점 항목이 생깁니다.",
            S["body"],
        ))
    story.append(Spacer(1, 10))
    _hr(story)

    # ── 개선 포인트 ───────────────────────────────────────────────────────────
    _section_bg(story, "지금 개선하면 효과적인 것  (우선순위 순)", bg="#fef9c3", fg="#92400e")

    low_items, mid_items = [], []
    for key, info in _IMPROVE_ITEMS.items():
        if elig == "inactive" and key == "naver_exposure_confirmed":
            continue
        val = bd.get(key)
        score = float(val) if val is not None else 0.0
        lv = _grade(val) if val is not None else "low"
        step_key = "steps_with_website" if has_web else "steps_no_website"

        # schema_seo는 w_desc가 분기됨
        if key == "schema_seo":
            w_desc = info["w_desc_with_website"] if has_web else info["w_desc_no_website"]
        else:
            w_desc = info.get("w_desc", "")

        steps = info.get(step_key) or info.get("steps_with_website") or []
        entry = (key, info["label"], w_desc, steps, score)
        if lv == "low":
            low_items.append(entry)
        elif lv == "mid":
            mid_items.append(entry)

    all_items = (low_items + mid_items)[:5]
    for i, (key, label, w_desc, steps, score) in enumerate(all_items, 1):
        score_txt = f"현재 {score:.0f}점" if score > 0 else "미측정"
        block = [
            Paragraph(f"{i}.  {label}  ({score_txt})", S["warn"]),
            Paragraph(f"   현황: {w_desc}", S["sub"]),
            Spacer(1, 2),
        ]
        for j, step in enumerate(steps[:3], 1):
            # 줄바꿈 포함 step을 단락으로 처리
            step_clean = step.replace("\n", "<br/>")
            block.append(Paragraph(f"   {j})  {step_clean}", S["action"]))
        block.append(Spacer(1, 8))
        story.append(KeepTogether(block))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PAGE 3 — 실행 체크리스트 + 키워드 순위
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    story.append(PageBreak())
    _page_header(story, biz_name, "3/3  실행 체크리스트", today, S)

    # ── 이번 달 실행 체크리스트 ─────────────────────────────────────────────
    _section_bg(story, "이번 달 실행 계획  (체크하며 실행하세요)")

    # 가이드 있으면 가이드 기반, 없으면 개선 항목 기반
    checklist: list[tuple[str, str]] = []
    if guide and guide.get("items_json"):
        raw = guide["items_json"]
        if isinstance(raw, list):
            for item in raw[:5]:
                if isinstance(item, dict):
                    title = item.get("title") or item.get("action") or ""
                    desc  = item.get("description") or item.get("detail") or ""
                    if title and title not in [c[0] for c in checklist]:
                        checklist.append((str(title), str(desc)[:120]))

    # 가이드 항목이 부족하면 개선 항목 첫 번째 step으로 보충
    for _, label, _, steps, _ in all_items:
        if len(checklist) >= 6:
            break
        first_step = (steps[0] if steps else "").split("\n")[0][:80]
        item_title = f"{label}: {first_step}"
        if item_title not in [c[0] for c in checklist]:
            checklist.append((label, first_step))

    for i, (title, desc) in enumerate(checklist[:6], 1):
        block = [Paragraph(f"□  {i}.  {title}", S["chk"])]
        if desc and desc.strip() and desc.strip() != title.strip():
            block.append(Paragraph(f"      {desc}", S["note"]))
        story.append(KeepTogether(block))

    story.append(Spacer(1, 10))

    # ── INACTIVE 전용: 글로벌 AI SEO 5단계 ─────────────────────────────────
    if elig == "inactive":
        story.append(Spacer(1, 6))
        _section_bg(story, "글로벌 AI SEO 전략  (비대상 업종 집중 플랜)", bg="#f5f3ff", fg="#7c3aed")
        story.append(Paragraph(
            "네이버 AI 브리핑 비대상 업종은 아래 5단계로 ChatGPT·Gemini·Google AI 노출을 높이세요.",
            S["small"],
        ))
        story.append(Spacer(1, 4))
        seo_steps = [
            ("구글 비즈니스 프로필 등록",
             "business.google.com에서 무료 등록. 사진 10장·영업시간·전화번호 입력.\n"
             "구글 지도·Gemini 앱 노출 가능성이 높아집니다 (Google AI Overview는 서버 환경상 직접 측정이 어려운 상태입니다)."),
            ("콘텐츠 전략 (월 2회 블로그)",
             "사업장 소개·서비스 안내·FAQ 형식으로 네이버 블로그에 월 2회 이상 작성.\n"
             "AI는 이 콘텐츠를 학습해 사용자 질문에 답변합니다."),
            ("모두(modoo) 또는 카카오 채널 개설" if not has_web else "웹사이트 JSON-LD 구조화 데이터 추가",
             ("무료 웹페이지 역할. 사업장명·주소·전화번호·서비스 소개를 상세히 입력하세요." if not has_web
              else "AEOlab '스키마 생성' 기능으로 JSON-LD 코드를 자동 생성할 수 있습니다.")),
            ("NAP 일관성 관리",
             "네이버지도·카카오맵·구글맵·홈페이지에 사업장 이름·주소·전화번호가 동일한지 확인.\n"
             "불일치하면 AI가 사업장을 다른 곳으로 인식해 노출이 줄어듭니다."),
            ("리뷰 생태계 구축",
             "구글 리뷰 10개 + 네이버 블로그 후기 20개 확보 목표.\n"
             "QR코드 리뷰 요청 카드를 카운터에 비치하는 것이 가장 효과적입니다."),
        ]
        for i, (title, desc) in enumerate(seo_steps, 1):
            desc_clean = desc.replace("\n", "<br/>")
            block = [
                Paragraph(f"STEP {i}.  {title}", S["seo_h"]),
                Paragraph(desc_clean, S["seo_b"]),
                Spacer(1, 3),
            ]
            story.append(KeepTogether(block))
        story.append(Spacer(1, 8))

    # ── 키워드 검색 순위 ──────────────────────────────────────────────────────
    if keyword_ranks_history:
        from collections import defaultdict
        kw_data: dict = defaultdict(list)
        for sr in keyword_ranks_history:
            ranks = sr.get("keyword_ranks") or {}
            if isinstance(ranks, dict):
                for kw, rd in ranks.items():
                    # 버그 수정: "_context" 같은 내부 메타 키 건너뜀
                    if kw.startswith("_"):
                        continue
                    if isinstance(rd, dict):
                        kw_data[kw].append(rd)
        if kw_data:
            story.append(Spacer(1, 6))
            _section_bg(story, "키워드 검색 순위  (실측, 최근 평균)")
            story.append(Paragraph(
                "※ 측정 시점·기기·로그인 상태에 따라 순위가 달라질 수 있습니다.",
                S["small"],
            ))
            story.append(Spacer(1, 4))

            # 헤더 행
            def _rank_cell_ps(fg: str) -> ParagraphStyle:
                return ParagraphStyle("", fontName=FONT_NAME, fontSize=9,
                                      textColor=colors.HexColor(fg), leading=13)

            kw_rows = [[
                Paragraph("키워드",    _rank_cell_ps("#ffffff")),
                Paragraph("PC 순위",   _rank_cell_ps("#ffffff")),
                Paragraph("모바일 순위", _rank_cell_ps("#ffffff")),
                Paragraph("플레이스 순위", _rank_cell_ps("#ffffff")),
                Paragraph("측정 횟수",  _rank_cell_ps("#ffffff")),
            ]]

            kw_style_cmds = [
                ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#1e3a5f")),
                ("FONTNAME",      (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE",      (0, 0), (-1, -1), 9),
                ("ALIGN",         (1, 0), (-1, -1), "CENTER"),
                ("BOX",           (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID",     (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("TOPPADDING",    (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING",   (0, 0), (-1, -1), 6),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]

            for row_i, (kw, entries) in enumerate(sorted(kw_data.items()), 1):
                pc_txt,  pc_fg,  pc_bg  = _rank_info(entries, "pc_rank")
                mob_txt, mob_fg, mob_bg = _rank_info(entries, "mobile_rank")
                pl_txt,  pl_fg,  pl_bg  = _rank_info(entries, "place_rank")

                kw_rows.append([
                    Paragraph(str(kw)[:20], _rank_cell_ps("#1f2937")),
                    Paragraph(pc_txt,  _rank_cell_ps(pc_fg)),
                    Paragraph(mob_txt, _rank_cell_ps(mob_fg)),
                    Paragraph(pl_txt,  _rank_cell_ps(pl_fg)),
                    Paragraph(str(len(entries)) + "회", _rank_cell_ps("#374151")),
                ])

                # 순위 셀 배경색 동적 적용
                kw_style_cmds.append(("BACKGROUND", (1, row_i), (1, row_i), colors.HexColor(pc_bg)))
                kw_style_cmds.append(("BACKGROUND", (2, row_i), (2, row_i), colors.HexColor(mob_bg)))
                kw_style_cmds.append(("BACKGROUND", (3, row_i), (3, row_i), colors.HexColor(pl_bg)))

            kw_t = Table(kw_rows, colWidths=[5 * cm, 2.5 * cm, 2.8 * cm, 3.0 * cm, 2.3 * cm])
            kw_t.setStyle(TableStyle(kw_style_cmds))
            story.append(kw_t)
            story.append(Spacer(1, 4))
            story.append(Paragraph(
                "【미노출 기준】 검색 순위 20위 밖이거나 측정 데이터가 없는 경우 '미노출'로 표시됩니다. "
                "PC = 네이버 통합검색  ·  모바일 = 네이버 모바일 통합검색  ·  플레이스 = 네이버 플레이스 탭. "
                "서울 기준 서버 IP(비로그인)로 측정하므로 실제 개인 환경과 다를 수 있습니다.",
                S["small"],
            ))
            story.append(Spacer(1, 8))

    # ── 푸터 ──────────────────────────────────────────────────────────────────
    _hr(story, thick=0.5)
    story.append(Paragraph(
        "본 리포트는 AEOlab(aeolab.co.kr)이 자동 생성한 AI 검색 노출 진단 결과입니다. "
        "측정 시점·기기·로그인 상태에 따라 실제 결과와 다를 수 있습니다.",
        S["small"],
    ))

    doc.build(story)
    return buf.getvalue()
