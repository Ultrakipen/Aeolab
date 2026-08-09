import io
import logging

logger = logging.getLogger("aeolab")

# 폰트 경로 — 서버(Ubuntu)와 Windows 개발 환경 모두 지원
FONT_PATHS_BOLD = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/malgunbd.ttf",  # Windows 개발용
]
FONT_PATHS_REGULAR = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/malgun.ttf",
]


def _load_font(paths: list, size: int):
    """폰트 경로 순서대로 시도, 없으면 기본 폰트"""
    try:
        from PIL import ImageFont
        for path in paths:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
        return ImageFont.load_default()
    except ImportError:
        return None


def _score_stage_label(score: float) -> str:
    """점수 → 텍스트 레이블. share_card.py _score_stage_label과 동일 임계값
    (75/55/30) 유지 — 드리프트 시 두 파일 함께 갱신할 것. CLAUDE.md 점수 표시
    원칙(숫자 노출 금지) — 카카오 알림으로 자동 발송되는 이미지라 특히 엄격 적용."""
    s = score or 0
    if s >= 75:
        return "AI 검색 노출 양호"
    if s >= 55:
        return "AI 검색 노출 개선 중"
    if s >= 30:
        return "AI 검색 노출 미흡"
    return "AI 검색 노출 시작 전"


async def generate_comparison_card(
    before_img_bytes: bytes,
    after_img_bytes: bytes,
    business_name: str,
    before_score: float,
    after_score: float,
    platform: str = "ChatGPT",
) -> bytes:
    """
    Before / After 이미지를 나란히 합성해 카드 이미지 생성
    카카오톡 공유용 (1200x630 권장 사이즈)
    pip install Pillow 필요
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        logger.error("Pillow not installed. Run: pip install Pillow")
        raise

    W, H = 1200, 630
    card = Image.new("RGB", (W, H), "#1B3A6B")  # 네이비 배경

    # Before 영역 (좌측)
    before = Image.open(io.BytesIO(before_img_bytes)).resize((560, 400))
    card.paste(before, (20, 130))

    # After 영역 (우측)
    after = Image.open(io.BytesIO(after_img_bytes)).resize((560, 400))
    card.paste(after, (620, 130))

    draw = ImageDraw.Draw(card)
    font_bold_28 = _load_font(FONT_PATHS_BOLD, 28)
    font_reg_18 = _load_font(FONT_PATHS_REGULAR, 18)
    font_reg_14 = _load_font(FONT_PATHS_REGULAR, 14)

    # 제목
    draw.text(
        (600, 50),
        f"{business_name} AI 노출 변화",
        fill="white",
        font=font_bold_28,
        anchor="mm",
    )

    # Before 라벨 — 원점수 노출 금지, 단계 레이블로 표시(before_score 실제값 기준)
    draw.rectangle([20, 90, 580, 125], fill="#555555")
    draw.text(
        (300, 107),
        f"이전  |  {_score_stage_label(before_score)}",
        fill="white",
        anchor="mm",
        font=font_reg_18,
    )

    # After 라벨 (강조) — "노출 N회/100회"는 total_score를 마치 카운트인 것처럼
    # 오도 표시하던 문구였음(2026-08-09 발견, CLAUDE.md 점수 표시 원칙 위반)
    draw.rectangle([620, 90, 1180, 125], fill="#2E5BA8")
    draw.text(
        (900, 107),
        f"30일 후  |  {_score_stage_label(after_score)}",
        fill="white",
        anchor="mm",
        font=font_reg_18,
    )

    # AEOlab 워터마크
    draw.text(
        (600, 610),
        "Powered by AEOlab",
        fill="#AACCEE",
        anchor="mm",
        font=font_reg_14,
    )

    buf = io.BytesIO()
    card.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
