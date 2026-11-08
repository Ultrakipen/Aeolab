"""크몽용 이미지 렌더링 — 서비스 코드와 무관한 독립 스크립트.
사용: backend_venv\\Scripts\\python.exe docs\\kmong_assets\\src\\render.py
출력: docs/kmong_assets/*.png (썸네일 652x488, 상세 이미지 가로 1000)"""
import pathlib
from playwright.sync_api import sync_playwright

SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent

with sync_playwright() as p:
    b = p.chromium.launch()
    # 메인 이미지: 크몽 가이드 652x488 (4:3), jpg/png
    pg = b.new_page(viewport={"width": 652, "height": 488}, device_scale_factor=1)
    pg.goto((SRC / "01_thumbnail.html").as_uri())
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / "01_thumbnail_652x488.png"))
    pg.screenshot(path=str(OUT / "01_thumbnail_652x488.jpg"), type="jpeg", quality=95)
    pg.close()
    # 상세 이미지: 가로 1000, 높이는 내용에 맞춤
    for name in ["02_intro", "03_features", "04_process", "05_info", "06_notice", "07_blog_mock", "08_competitor_mock", "09_report_1", "10_report_2", "11_report_3", "12_report_4"]:
        pg = b.new_page(viewport={"width": 1000, "height": 800}, device_scale_factor=1)
        pg.goto((SRC / f"{name}.html").as_uri())
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
        pg.close()
    b.close()
print("done")
