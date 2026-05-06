"""
AEOlab PDF 리포트 생성 서비스 (reportlab 기반)
한글 지원: NotoSansCJK 또는 시스템 폰트 fallback
"""
import io
import os
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _register_korean_font():
    """한글 폰트 등록 (NotoSansCJK → Malgun Gothic → 기본 폰트 순 fallback)"""
    font_candidates = [
        # Linux/Docker (iwinv 서버)
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJKkr-Regular.otf",
        # Windows 로컬 개발
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothic.ttf",
    ]
    for path in font_candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("Korean", path))
                return "Korean"
            except Exception:
                continue
    return "Helvetica"  # fallback (한글 깨짐 허용)


FONT_NAME = _register_korean_font()

PLATFORM_LABELS = {
    "gemini": "Gemini AI",
    "chatgpt": "ChatGPT",
    "naver": "네이버 AI 브리핑",
    "google": "Google AI Overview",
}


def generate_pdf_report(
    biz: dict,
    latest_scan: dict,
    history: list,
    guide: Optional[dict] = None,
    keyword_ranks_history: Optional[list] = None,
) -> bytes:
    """AI Visibility 리포트 PDF 생성 → bytes 반환"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2.5 * cm,
        bottomMargin=2 * cm,
        title=f"AEOlab 리포트 — {biz.get('name', '')}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title_KO", parent=styles["Title"], fontName=FONT_NAME, fontSize=20, spaceAfter=6
    )
    h2_style = ParagraphStyle(
        "H2_KO", parent=styles["Heading2"], fontName=FONT_NAME, fontSize=13,
        textColor=colors.HexColor("#1d4ed8"), spaceBefore=14, spaceAfter=4
    )
    body_style = ParagraphStyle(
        "Body_KO", parent=styles["Normal"], fontName=FONT_NAME, fontSize=10, spaceAfter=4
    )
    small_style = ParagraphStyle(
        "Small_KO", parent=styles["Normal"], fontName=FONT_NAME, fontSize=8,
        textColor=colors.gray
    )

    story = []
    today = datetime.now().strftime("%Y년 %m월 %d일")

    # ── 헤더 ──────────────────────────────────────────────────────────────────
    story.append(Paragraph("AEOlab AI Visibility Report", title_style))
    story.append(Paragraph(
        f"{biz.get('name', '')} · {biz.get('region', '')} {biz.get('category', '')} | 발행: {today}",
        small_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb"), spaceAfter=10))

    # ── 총점 카드 ─────────────────────────────────────────────────────────────
    total_score = latest_scan.get("total_score", 0)
    story.append(Paragraph("AI Visibility Score", h2_style))
    score_data = [
        ["총점", "AI 노출빈도", "스캔일"],
        [
            f"{total_score:.1f}점",
            f"{latest_scan.get('exposure_freq', 0):.0f}/100회",
            (latest_scan.get("scanned_at") or "")[:10],
        ],
    ]
    score_table = Table(score_data, colWidths=[5 * cm, 5 * cm, 5 * cm])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d4ed8")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTSIZE", (0, 1), (-1, 1), 16),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [colors.HexColor("#eff6ff")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#bfdbfe")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#bfdbfe")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 10))

    # ── 점수 항목별 breakdown ─────────────────────────────────────────────────
    bd = latest_scan.get("score_breakdown") or {}
    if bd:
        story.append(Paragraph("항목별 점수", h2_style))
        bd_labels = {
            "exposure_freq": ("AI 검색 노출 빈도", "30%"),
            "review_quality": ("리뷰 품질", "20%"),
            "schema_score": ("AI 인식 정보", "15%"),
            "online_mentions": ("온라인 언급", "15%"),
            "info_completeness": ("정보 완성도", "10%"),
            "content_freshness": ("콘텐츠 최신성", "10%"),
        }
        bd_data = [["항목", "가중치", "점수"]]
        for key, (label, weight) in bd_labels.items():
            val = bd.get(key, "-")
            bd_data.append([label, weight, f"{val:.1f}" if isinstance(val, (int, float)) else str(val)])
        bd_table = Table(bd_data, colWidths=[7 * cm, 3.5 * cm, 4.5 * cm])
        bd_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(bd_table)
        story.append(Spacer(1, 10))

    # ── 플랫폼별 노출 현황 ────────────────────────────────────────────────────
    story.append(Paragraph("AI 플랫폼별 노출 현황", h2_style))
    platform_data = [["플랫폼", "언급 여부", "발췌 내용"]]
    for key, label in PLATFORM_LABELS.items():
        result_key = f"{key}_result"
        r = latest_scan.get(result_key) or {}
        mentioned = "✓ 언급됨" if r.get("mentioned") else "✗ 미언급"
        excerpt = (r.get("excerpt") or "")[:40]
        platform_data.append([label, mentioned, excerpt])
    p_table = Table(platform_data, colWidths=[4 * cm, 3 * cm, 8 * cm])
    p_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(p_table)
    story.append(Spacer(1, 10))

    # ── 30일 점수 추세 ────────────────────────────────────────────────────────
    if history:
        story.append(Paragraph("30일 점수 추세", h2_style))
        hist_data = [["날짜", "총점", "AI노출(/100)", "주간변화"]]
        for h in history[:10]:
            hist_data.append([
                (h.get("score_date") or "")[:10],
                f"{h.get('total_score', 0):.1f}",
                f"{h.get('exposure_freq', 0):.0f}",
                f"{h.get('weekly_change', 0):+.1f}",
            ])
        hist_table = Table(hist_data, colWidths=[4 * cm, 3.5 * cm, 4 * cm, 3.5 * cm])
        hist_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(hist_table)
        story.append(Spacer(1, 10))

    # ── 키워드 노출 현황 ──────────────────────────────────────────────────────
    if keyword_ranks_history:
        # keyword_ranks_history: [{"scanned_at": ..., "keyword_ranks": {...}}, ...]
        from collections import defaultdict
        kw_data: dict[str, list] = defaultdict(list)
        for scan_row in keyword_ranks_history:
            ranks = scan_row.get("keyword_ranks") or {}
            if isinstance(ranks, dict):
                for kw, rd in ranks.items():
                    if isinstance(rd, dict):
                        kw_data[kw].append(rd)

        if kw_data:
            story.append(Paragraph("키워드 노출 현황", h2_style))
            story.append(Paragraph(
                "※ 측정 시점·기기·로그인 상태에 따라 순위가 달라질 수 있습니다",
                small_style,
            ))
            story.append(Spacer(1, 4))

            def _avg_r(vals: list, key: str) -> str:
                nums = [int(v[key]) for v in vals if v.get(key) is not None and int(v[key]) < 99]
                return f"{round(sum(nums)/len(nums),1)}" if nums else "미노출"

            kw_pdf_data = [["키워드", "PC 평균", "모바일 평균", "플레이스 평균", "측정 횟수"]]
            for kw, entries in sorted(kw_data.items()):
                kw_pdf_data.append([
                    kw[:20],
                    _avg_r(entries, "pc"),
                    _avg_r(entries, "mobile"),
                    _avg_r(entries, "place"),
                    str(len(entries)),
                ])
            kw_table = Table(kw_pdf_data, colWidths=[5 * cm, 3 * cm, 3 * cm, 3 * cm, 2 * cm])
            kw_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]))
            story.append(kw_table)
            story.append(Spacer(1, 10))
        else:
            story.append(Paragraph("키워드 노출 현황", h2_style))
            story.append(Paragraph("키워드 순위 측정 후 표시됩니다.", body_style))
            story.append(Spacer(1, 6))

    # ── 개선 가이드 요약 ──────────────────────────────────────────────────────
    if guide:
        story.append(Paragraph("AI 개선 가이드 요약", h2_style))
        summary = guide.get("summary", "")
        if summary:
            story.append(Paragraph(summary, body_style))
        items = guide.get("items_json") or []
        for item in items[:5]:
            if isinstance(item, dict):
                title = item.get("title", "")
                desc = item.get("description", "")
                story.append(Paragraph(f"• <b>{title}</b>: {desc}", body_style))
            else:
                story.append(Paragraph(f"• {item}", body_style))
        story.append(Spacer(1, 6))

    # ── 푸터 ──────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"), spaceAfter=4))
    story.append(Paragraph(
        f"본 리포트는 AEOlab(aeolab.co.kr)에서 자동 생성되었습니다. | {today}",
        small_style,
    ))

    doc.build(story)
    return buffer.getvalue()
