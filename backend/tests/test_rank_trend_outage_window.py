"""키워드 순위 30일 추이는 측정 장애 기간(2026-09-02~10-25)의 값을 그리지 않는다 (2026-11-01).

장애 기간에 저장된 score_history.keyword_rank_avg=99.0은 '미노출'이 아니라 실패가 섞인 값이다. 이 값을 시계열에 그대로 그리면
하라식당(30일 창 29점 중 25점이 99.0)이 "99위 → 25위 급상승"으로 보였다. 실제 서버 데이터 기준 영향 사업장 3곳.
"""
import re
from datetime import date

from routers.report import RANK_MEASUREMENT_TRUSTED_FROM, _rank_trend_since


def test_window_never_starts_before_the_measurement_recovered():
    # 수정이 10-26 17:52 KST에 배포돼 그날 새벽 순위 잡은 수정 전 코드 → 신뢰 가능한 첫 날은 10-27
    assert RANK_MEASUREMENT_TRUSTED_FROM == "2026-10-27"
    assert _rank_trend_since(date(2026, 11, 1)) == "2026-10-27"    # 30일 전(10-02)이 아니라 복구 다음 날
    assert _rank_trend_since(date(2026, 11, 26)) == "2026-10-27"   # 30일 전이 정확히 10-27
    assert _rank_trend_since(date(2026, 12, 1)) == "2026-11-01"    # 이후에는 원래 30일 창
    # 장애 기간(복구 당일 10-26 포함)의 어떤 날짜도 창에 들어오지 않는다
    for d in (date(2026, 10, 2), date(2026, 10, 25), date(2026, 10, 26)):
        assert d.isoformat() < _rank_trend_since(date(2026, 11, 1))


def test_endpoint_uses_the_guarded_window_not_a_plain_30_days():
    src = open("routers/report.py", encoding="utf-8").read()
    i = src.index("async def get_naver_seo_strength")
    body = src[i:i + 5000]
    assert re.search(r'\.gte\("score_date",\s*_rank_trend_since\(date\.today\(\)\)\)', body), \
        "순위 추이 조회가 장애 기간을 거르는 시작일을 써야 한다"
    # 블로그 추이는 이 장애와 무관하므로 원래 30일 창을 그대로 쓴다
    assert 'blog_score_history' in body and 'gte("analyzed_date", thirty_days_ago)' in body
