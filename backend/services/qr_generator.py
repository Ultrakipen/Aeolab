"""
리뷰 유도 QR 카드 이미지 생성 (A6 인쇄용 PNG)
qrcode[pil] + Pillow 사용
"""
import logging
from io import BytesIO
from pathlib import Path

logger = logging.getLogger("aeolab")

_FONT_BOLD_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJKkr-Bold.otf",
]
_FONT_REG_PATHS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJKkr-Regular.otf",
]


def _find_font(paths: list[str]):
    from PIL import ImageFont
    for p in paths:
        if Path(p).exists():
            return p
    return None


def _load_font(paths: list[str], size: int):
    from PIL import ImageFont
    path = _find_font(paths)
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def generate_review_qr_card(
    business_name: str,
    naver_review_url: str,
    qr_message: str,
    category: str = "",
) -> BytesIO:
    """리뷰 유도 QR 카드 이미지 생성 (A6, 1240×874px @300dpi)

    Args:
        business_name: 가게 이름
        naver_review_url: QR 코드가 가리킬 URL
        qr_message: 손님에게 보여줄 유도 문구
        category: 업종 코드 (색상 테마 결정용)

    Returns:
        PNG BytesIO
    """
    try:
        import qrcode
        from PIL import Image, ImageDraw

        # 카드 크기 (A6: 148×105mm, 300dpi → 1748×1240px, 절반 크기로 출력)
        W, H = 874, 620

        # 업종별 메인 컬러
        _COLOR_MAP: dict[str, str] = {
            "restaurant": "#e63946", "cafe": "#6f4e37", "beauty": "#be185d",
            "clinic": "#0369a1", "academy": "#7c3aed", "fitness": "#16a34a",
            "pet": "#d97706", "legal": "#374151", "shopping": "#0284c7",
        }
        accent = _COLOR_MAP.get(category, "#1d4ed8")

        img = Image.new("RGB", (W, H), "#ffffff")
        draw = ImageDraw.Draw(img)

        # 상단 컬러 헤더 (H의 30%)
        header_h = int(H * 0.3)
        draw.rectangle([0, 0, W, header_h], fill=accent)

        # 가게 이름
        font_name = _load_font(_FONT_BOLD_PATHS, 42)
        font_msg = _load_font(_FONT_REG_PATHS, 22)
        font_small = _load_font(_FONT_REG_PATHS, 18)

        # 가게 이름 (헤더 가운데)
        name_bbox = draw.textbbox((0, 0), business_name, font=font_name)
        name_w = name_bbox[2] - name_bbox[0]
        name_x = (W - name_w) // 2
        name_y = (header_h - (name_bbox[3] - name_bbox[1])) // 2
        draw.text((name_x, name_y), business_name, font=font_name, fill="#ffffff")

        # QR 코드 생성 (왼쪽 중앙)
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(naver_review_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

        qr_size = int(H * 0.55)
        qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)
        qr_x = int(W * 0.05)
        qr_y = header_h + int((H - header_h - qr_size) // 2)
        img.paste(qr_img, (qr_x, qr_y))

        # 메시지 텍스트 (오른쪽)
        text_x = qr_x + qr_size + 24
        text_w = W - text_x - 24

        # 네이버 리뷰 유도 타이틀
        title = "리뷰로 응원해주세요!"
        draw.text((text_x, qr_y + 12), title, font=font_name, fill=accent)

        # 유도 문구 (줄 바꿈 처리)
        words = qr_message.split()
        lines: list[str] = []
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            bbox = draw.textbbox((0, 0), test, font=font_msg)
            if bbox[2] - bbox[0] > text_w and line:
                lines.append(line)
                line = w
            else:
                line = test
        if line:
            lines.append(line)

        msg_y = qr_y + 72
        for ln in lines[:4]:
            draw.text((text_x, msg_y), ln, font=font_msg, fill="#374151")
            msg_y += 32

        # 하단 안내
        hint = "QR 코드를 스캔하면\n네이버 리뷰 페이지로 이동합니다"
        draw.text(
            (qr_x, qr_y + qr_size + 8),
            hint,
            font=font_small,
            fill="#94a3b8",
        )

        # 하단 구분선 + AEOlab 워터마크
        draw.line([0, H - 28, W, H - 28], fill="#e2e8f0", width=1)
        draw.text((W - 150, H - 22), "powered by AEOlab", font=font_small, fill="#cbd5e1")

        buf = BytesIO()
        img.save(buf, format="PNG", dpi=(300, 300))
        buf.seek(0)
        return buf

    except ImportError as e:
        logger.error(f"qr_generator import error: {e} — pip install qrcode[pil] 필요")
        raise
    except Exception as e:
        logger.error(f"QR 카드 생성 실패: {e}", exc_info=True)
        raise
