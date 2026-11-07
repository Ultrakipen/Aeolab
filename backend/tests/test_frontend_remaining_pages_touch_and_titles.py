"""남은 로그인 후 페이지 점검(2026-11-07 밤: /history·/delivery/new) 회귀 방지 — 프런트 소스 구조 검사.

- history 표의 '1위 블로그' 열: PC에서 188px에서 잘리는데 전체 제목을 볼 수단이 없었다 → title(툴팁) 추가·폭 확대.
- history 빈 상태 CTA 링크(높이 20px)와 delivery/new 상단 이동 링크(높이 20px)의 터치 영역을 키웠다.
서버 테스트가 frontend 폴더를 읽는다 — 프런트를 먼저 배포한 뒤 백엔드(테스트)를 배포한다.
"""
from pathlib import Path

FE = Path(__file__).resolve().parents[2] / "frontend" / "app" / "(dashboard)"
BLOG = (FE / "history" / "BlogScreenshotSection.tsx").read_text(encoding="utf-8")
HIST = (FE / "history" / "page.tsx").read_text(encoding="utf-8")
NEW = (FE / "delivery" / "new" / "page.tsx").read_text(encoding="utf-8")


def test_history_top1_blog_title_is_truncated_only_with_a_tooltip():
    i = BLOG.index('<span className="truncate block"')
    span = BLOG[i:i + 200]
    assert 'title={top1?.blog_name || top1?.title || undefined}' in span
    j = BLOG.rfind("<td", 0, i)
    assert "max-w-[180px] lg:max-w-[260px]" in BLOG[j:i]


def test_history_empty_state_cta_has_touch_height():
    i = HIST.index("대시보드에서 지금 측정")
    assert "min-h-[44px]" in HIST[i - 220:i]
    assert 'className="inline-block text-sm font-semibold text-blue-600 hover:underline"' not in HIST


def test_delivery_new_breadcrumb_link_has_touch_height():
    i = NEW.index(">대행 서비스</a>")
    assert "min-h-[44px]" in NEW[i - 160:i]


def test_history_refresh_icon_button_has_touch_size_and_accessible_name():
    i = BLOG.index("onClick={handleRefresh}")
    block = BLOG[i:i + 420]
    assert "min-h-[40px] min-w-[40px]" in block                 # 모바일에서 아이콘만 보일 때 40×28이던 것
    assert 'aria-label="최신 분석 결과 불러오기"' in block


BC = (FE / "blog-analysis" / "BlogClient.tsx").read_text(encoding="utf-8")


def test_blog_analysis_chart_label_is_not_below_12px_and_touch_targets_are_larger():
    # 차트 라벨 '평균 N건'이 SVG 배율 1로 11px 렌더링되던 것(2026-11-07 실측)
    i = BC.index('value: `평균 ${data.avg_count}건`')
    assert "fontSize: 13" in BC[i:i + 160] and "fontSize: 11" not in BC[i:i + 160]
    # 제외(×) 버튼 16px → 32px(+음수 마진으로 칩 높이 유지), 접근성 이름은 유지
    j = BC.index("handleExcludeKeyword(kw)")
    chip = BC[j:j + 520]
    assert "w-8 h-8" in chip and "w-4 h-4 rounded-full hover:bg-red-300" not in chip and "aria-label={`${kw} 제외`}" in chip
    # 단독 링크·버튼 높이 20px → 40~44px
    assert "inline-flex items-center min-h-[44px] -my-3 text-indigo-600 hover:underline ml-auto shrink-0" in BC      # 측정 방법론 보기
    k = BC.index("블로그 열기 <ExternalLink")
    assert "min-h-[40px]" in BC[k - 220:k]
    m = BC.index("주제 복사")
    assert "min-h-[40px]" in BC[m - 700:m]
    n = BC.index("사업장 변경\n")
    assert "min-h-[40px]" in BC[n - 400:n]
