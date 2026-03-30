"""
갭 카드 PNG 생성 서비스
기획서 v7.2 § 3.2 — 주간 경쟁사 AI 순위 카드 (카카오톡 공유 바이럴용)
800×480 PNG, 네이비 배경, 수평 바 차트
"""
import io
import logging
from datetime import date

_logger = logging.getLogger("aeolab")

# 폰트 경로 — Ubuntu 서버 / Windows 개발 환경 자동 선택
_BOLD = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/malgunbd.ttf",
]
_REG = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/malgun.ttf",
]


def _font(paths: list, size: int):
    try:
        from PIL import ImageFont
        for p in paths:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default()
    except ImportError:
        return None


def _bar_color(is_me: bool, score: float) -> str:
    if is_me:
        return "#06B6D4"   # 청록 — 내 가게 강조
    if score >= 60:
        return "#EF4444"   # 빨강 — 강한 경쟁자
    if score >= 40:
        return "#F59E0B"   # 주황
    return "#4B5563"       # 회색 — 약한 경쟁자


def generate_gap_card(
    business_name: str,
    region: str,
    category: str,
    my_score: float,
    competitor_items: list[dict],   # [{"name": str, "score": float, "is_me"?: bool}]
    hint: str = "",
) -> bytes:
    """
    경쟁사 순위 갭 카드 PNG 생성

    Args:
        business_name: 내 사업장명
        region: 지역
        category: 업종
        my_score: 내 총점
        competitor_items: 경쟁사 리스트 (score 내림차순 정렬 후 전달)
        hint: 개선 힌트 문구

    Returns:
        PNG bytes
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        _logger.error("Pillow not installed. Run: pip install Pillow")
        raise

    W, H = 800, 480
    MARGIN = 40
    BAR_X = 240        # 바 시작 X 좌표
    BAR_MAX_W = 460    # 바 최대 너비
    ROW_H = 52

    card = Image.new("RGB", (W, H), "#0F2542")
    draw = ImageDraw.Draw(card)

    f_title  = _font(_BOLD, 20)
    f_date   = _font(_REG,  13)
    f_name   = _font(_BOLD, 15)
    f_score  = _font(_REG,  14)
    f_hint   = _font(_REG,  13)
    f_badge  = _font(_BOLD, 13)
    f_water  = _font(_REG,  12)

    today_str = date.today().strftime("%Y.%m.%d")
    region_label = region.split()[0] if region else region
    title = f"{region_label} {category} AI 경쟁 현황"

    # 제목
    draw.text((MARGIN, 24), title, fill="#06B6D4", font=f_title)
    draw.text((MARGIN, 50), f"매주 자동 생성 · {today_str}", fill="#4B6A8A", font=f_date)

    # 구분선
    draw.line([(MARGIN, 72), (W - MARGIN, 72)], fill="#1E3A5F", width=1)

    # 순위 행 그리기
    # 내 사업장이 목록에 없으면 추가
    items = list(competitor_items)
    has_me = any(it.get("is_me") for it in items)
    if not has_me:
        items.append({"name": business_name, "score": my_score, "is_me": True})

    # 점수 내림차순 정렬 후 상위 6개
    items = sorted(items, key=lambda x: x.get("score", 0), reverse=True)[:6]

    y = 88
    for rank, item in enumerate(items, 1):
        is_me = item.get("is_me", False)
        score = float(item.get("score", 0))
        name  = item.get("name", "")
        bar_w = int(score / 100 * BAR_MAX_W)
        color = _bar_color(is_me, score)

        label_fill = "#FFFFFF" if is_me else "#9CA3AF"
        prefix = "▶ " if is_me else f"{rank}위 "

        # 순위 + 이름 (최대 7자 truncate)
        display_name = name[:7] + ("…" if len(name) > 7 else "")
        draw.text((MARGIN, y + 4), prefix + display_name, fill=label_fill, font=f_name)

        # 바 배경
        draw.rectangle([BAR_X, y + 6, BAR_X + BAR_MAX_W, y + 30], fill="#1E3A5F", outline=None)

        # 바
        if bar_w > 0:
            draw.rectangle([BAR_X, y + 6, BAR_X + bar_w, y + 30], fill=color)

        # 점수 텍스트
        draw.text((BAR_X + BAR_MAX_W + 8, y + 8), f"{score:.0f}점", fill=label_fill, font=f_score)

        # 내 가게 배지
        if is_me:
            badge_x = BAR_X + BAR_MAX_W + 52
            draw.rectangle([badge_x, y + 4, badge_x + 44, y + 28], fill="#06B6D4", outline=None)
            draw.text((badge_x + 22, y + 16), "내 가게", fill="#FFFFFF", font=f_badge, anchor="mm")

        y += ROW_H

    # 개선 힌트
    if hint:
        draw.line([(MARGIN, H - 60), (W - MARGIN, H - 60)], fill="#1E3A5F", width=1)
        draw.text((MARGIN, H - 46), f"개선 시 예상: {hint}", fill="#FCD34D", font=f_hint)

    # 워터마크
    draw.text((W - MARGIN, H - 16), "Powered by AEOlab", fill="#2E4D70", font=f_water, anchor="rs")

    buf = io.BytesIO()
    card.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def generate_and_upload_gap_card(
    business_id: str,
    business_name: str,
    region: str,
    category: str,
    my_score: float,
    competitor_items: list[dict],
    hint: str = "",
) -> str | None:
    """갭 카드 생성 → Supabase Storage 업로드 → 공개 URL 반환"""
    try:
        from db.supabase_client import get_client
        png_bytes = generate_gap_card(
            business_name, region, category, my_score, competitor_items, hint
        )
        supabase = get_client()
        today_str = date.today().strftime("%Y%m%d")
        path = f"gap_cards/{business_id}/{today_str}.png"

        supabase.storage.from_("before-after").upload(
            path, png_bytes,
            {"content-type": "image/png", "upsert": "true"},
        )
        url = supabase.storage.from_("before-after").get_public_url(path)
        return url
    except Exception as e:
        _logger.warning(f"Gap card upload failed: {e}")
        return None
