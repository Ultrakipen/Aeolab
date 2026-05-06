"""
공유 카드 PNG 생성 서비스 (600×400)
기획서 v7.2 홈페이지 개선 v1.0 후속 작업 A안 2-3
카카오톡 Feed 템플릿 공유용 이미지

디자인 (600x400 PNG):
- 상단 파란색 띠(#2563eb, 56px) + "AEOlab · AI 검색 노출 진단"
- 중앙 점수 카드: 점수 72px bold + "/ 100점" + 사업장 이름 + 업종 평균 비교
- 하단 부가 정보 2줄: 네이버 AI 브리핑 노출률 + ChatGPT 인용 횟수
- 하단 회색 고지: "무료 진단 · 회원가입 불필요"
"""
import io
import logging
from typing import Optional

_logger = logging.getLogger("aeolab")

# 폰트 경로 — Ubuntu 서버 / Windows 개발 환경 자동 선택
# gap_card.py, before_after_card.py 패턴 재활용
_FONT_BOLD_PATHS = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/malgunbd.ttf",  # Windows 개발용
]
_FONT_REG_PATHS = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/malgun.ttf",
]


# 업종 코드 → 한국어 레이블 (gap_card.py의 _CATEGORY_KO 중 공유 카드에서 자주 쓰는 것만)
# 공유 카드는 카드 공간이 좁으므로 짧은 레이블을 우선
_CATEGORY_LABELS: dict[str, str] = {
    "restaurant": "음식점",
    "cafe": "카페",
    "bakery": "베이커리",
    "bar": "술집",
    "beauty": "미용실",
    "nail": "네일샵",
    "medical": "병원",
    "pharmacy": "약국",
    "fitness": "헬스장",
    "yoga": "요가·필라테스",
    "pet": "반려동물",
    "education": "교육",
    "tutoring": "과외",
    "legal": "법률사무소",
    "realestate": "부동산",
    "interior": "인테리어",
    "auto": "자동차정비",
    "cleaning": "청소대행",
    "shopping": "쇼핑몰",
    "fashion": "패션",
    "photo": "사진스튜디오",
    "video": "영상제작",
    "design": "디자인",
    "accommodation": "숙박",
    "other": "사업장",
}


def _category_label(category: str) -> str:
    """카테고리 코드 → 소상공인 한국어 레이블. 매핑 없으면 '사업장'."""
    if not category:
        return "사업장"
    return _CATEGORY_LABELS.get(category.lower().strip(), "사업장")


def _region_label(region: Optional[str]) -> str:
    """'서울특별시 강남구' → '강남구'. 첫 토큰이 '특별시/광역시'면 두 번째 토큰 사용."""
    if not region:
        return ""
    parts = region.strip().split()
    if not parts:
        return ""
    # 첫 토큰만 있으면 그대로 반환
    if len(parts) == 1:
        return parts[0]
    # 시/도 뒤 구/군/시만 뽑기 (예: "서울특별시 강남구" → "강남구")
    return parts[1]


def _load_font(paths: list[str], size: int):
    """폰트 경로 순서대로 시도, 실패 시 Pillow 기본 폰트 폴백 + 경고 로그"""
    try:
        from PIL import ImageFont
    except ImportError:
        _logger.error("Pillow not installed. Run: pip install Pillow")
        raise

    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    _logger.warning(
        f"share_card: TTF 폰트 로드 실패 (size={size}), Pillow 기본 폰트 사용. "
        f"시도 경로: {paths}"
    )
    return ImageFont.load_default()


def render_trial_share_card(
    score: float,
    business_name: str,
    category_label: Optional[str] = None,
    region: Optional[str] = None,
    category_avg: Optional[float] = None,
    naver_ai_rate: Optional[float] = None,
    chatgpt_cite_rate: Optional[float] = None,
) -> bytes:
    """
    트라이얼 진단 결과 공유용 600×400 PNG 카드 생성

    Args:
        score: 진단 점수 (0-100)
        business_name: 사업장 이름 (길면 truncate)
        category_label: 업종 한국어 레이블 (예: "카페"). None이면 "사업장"
        region: 지역 문자열 (예: "강남" 또는 "서울특별시 강남구")
        category_avg: 업종 평균 점수 (없으면 비교 줄 생략)
        naver_ai_rate: 네이버 AI 브리핑 노출률 (0-100, None이면 생략)
        chatgpt_cite_rate: ChatGPT 100회 중 인용 횟수 (None이면 생략)

    Returns:
        PNG bytes
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        _logger.error("Pillow not installed. Run: pip install Pillow")
        raise

    W, H = 600, 400
    card = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(card)

    # ── 상단 파란색 띠 (56px) ─────────────────────────────────────
    BAND_H = 56
    draw.rectangle([0, 0, W, BAND_H], fill="#2563EB")

    # 폰트 로드
    f_brand    = _load_font(_FONT_BOLD_PATHS, 18)
    f_score    = _load_font(_FONT_BOLD_PATHS, 72)
    f_score_u  = _load_font(_FONT_REG_PATHS,  24)
    f_biz      = _load_font(_FONT_BOLD_PATHS, 28)
    f_compare  = _load_font(_FONT_REG_PATHS,  16)
    f_sub      = _load_font(_FONT_REG_PATHS,  18)
    f_notice   = _load_font(_FONT_REG_PATHS,  14)

    # 브랜드 라벨
    draw.text((24, BAND_H // 2), "AEOlab · AI 검색 노출 진단",
              fill="#FFFFFF", font=f_brand, anchor="lm")

    # ── 중앙 점수 영역 ──────────────────────────────────────────
    # 점수는 정수로 반올림 표기
    score_int = max(0, min(100, int(round(score or 0))))

    # "67" (큰 숫자) + "/ 100점" 을 한 줄에 조합 배치
    score_text = str(score_int)
    unit_text  = " / 100점"

    # 점수 텍스트 너비 측정
    try:
        score_bbox = draw.textbbox((0, 0), score_text, font=f_score)
        score_w = score_bbox[2] - score_bbox[0]
        unit_bbox = draw.textbbox((0, 0), unit_text, font=f_score_u)
        unit_w = unit_bbox[2] - unit_bbox[0]
    except Exception:
        # 기본 폰트 폴백 시 textbbox 미지원 가능
        score_w = len(score_text) * 40
        unit_w = len(unit_text) * 12

    total_w = score_w + unit_w
    score_y = BAND_H + 32       # 상단 띠 바로 아래 여백
    start_x = (W - total_w) // 2

    draw.text((start_x, score_y), score_text, fill="#1F2937", font=f_score, anchor="lt")
    # unit은 숫자 베이스라인과 맞추기 위해 조금 아래
    draw.text((start_x + score_w, score_y + 38), unit_text,
              fill="#6B7280", font=f_score_u, anchor="lt")

    # 사업장 이름 (중앙 정렬, 12자 이상이면 truncate)
    biz_display = business_name or "내 가게"
    if len(biz_display) > 14:
        biz_display = biz_display[:13] + "…"
    biz_y = score_y + 100
    draw.text((W // 2, biz_y), biz_display, fill="#1F2937",
              font=f_biz, anchor="mm")

    # 업종·지역 비교 (category_avg가 있을 때만)
    cat_lbl = category_label or "사업장"
    region_lbl = _region_label(region)
    if category_avg is not None:
        try:
            avg_int = int(round(float(category_avg)))
        except (TypeError, ValueError):
            avg_int = None
        if avg_int is not None:
            prefix = f"{region_lbl} {cat_lbl}" if region_lbl else cat_lbl
            compare_text = f"{prefix} 업종 평균 {avg_int}점"
            draw.text((W // 2, biz_y + 30), compare_text,
                      fill="#6B7280", font=f_compare, anchor="mm")

    # ── 하단 부가 정보 2줄 ────────────────────────────────────
    # 위치: 사업장 이름 아래, 하단 고지 위
    sub_base_y = 300  # 두 줄의 첫 줄 기준 y
    sub_lines: list[str] = []
    if naver_ai_rate is not None:
        try:
            rate_int = max(0, min(100, int(round(float(naver_ai_rate)))))
            sub_lines.append(f"네이버 AI 브리핑 노출률 {rate_int}%")
        except (TypeError, ValueError):
            pass
    if chatgpt_cite_rate is not None:
        try:
            cite_int = max(0, int(round(float(chatgpt_cite_rate))))
            sub_lines.append(f"ChatGPT 인용 {cite_int}/100회")
        except (TypeError, ValueError):
            pass

    for i, line in enumerate(sub_lines[:2]):
        draw.text((W // 2, sub_base_y + i * 26), line,
                  fill="#374151", font=f_sub, anchor="mm")

    # ── 하단 고지 (회색) ────────────────────────────────────
    draw.text((W // 2, H - 24), "무료 진단 · 회원가입 불필요",
              fill="#9CA3AF", font=f_notice, anchor="mm")

    buf = io.BytesIO()
    card.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_placeholder_share_card() -> bytes:
    """
    trial_id 미존재 또는 필수 데이터 누락 시 반환할 기본 공유 카드.
    점수·사업장 이름 없는 범용 브랜드 카드.
    """
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        _logger.error("Pillow not installed. Run: pip install Pillow")
        raise

    W, H = 600, 400
    card = Image.new("RGB", (W, H), "#FFFFFF")
    draw = ImageDraw.Draw(card)

    BAND_H = 56
    draw.rectangle([0, 0, W, BAND_H], fill="#2563EB")

    f_brand   = _load_font(_FONT_BOLD_PATHS, 18)
    f_head    = _load_font(_FONT_BOLD_PATHS, 32)
    f_sub     = _load_font(_FONT_REG_PATHS,  18)
    f_notice  = _load_font(_FONT_REG_PATHS,  14)

    draw.text((24, BAND_H // 2), "AEOlab · AI 검색 노출 진단",
              fill="#FFFFFF", font=f_brand, anchor="lm")

    draw.text((W // 2, 170), "내 가게 AI 노출,",
              fill="#1F2937", font=f_head, anchor="mm")
    draw.text((W // 2, 210), "지금 무료로 확인해보세요",
              fill="#1F2937", font=f_head, anchor="mm")

    draw.text((W // 2, 270), "네이버·ChatGPT 노출 여부 30초 진단",
              fill="#374151", font=f_sub, anchor="mm")

    draw.text((W // 2, H - 24), "무료 진단 · 회원가입 불필요",
              fill="#9CA3AF", font=f_notice, anchor="mm")

    buf = io.BytesIO()
    card.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
