"""GA4 랜딩 페이지(모바일) 이탈률·스크롤 깊이 1회성 조회 스크립트.

사용법:
    source backend_venv/Scripts/activate
    python backend/scripts/ga4_landing_report.py [days]
"""
import os
import sys

os.environ.setdefault(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(os.path.dirname(__file__), "..", "secrets", "ga4-service-account.json"),
)

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
    FilterExpression,
    FilterExpressionList,
    Filter,
)

PROPERTY_ID = "534323124"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 28

client = BetaAnalyticsDataClient()

# 1) 랜딩(/) 페이지 · 디바이스별 이탈률·참여율·세션수
req1 = RunReportRequest(
    property=f"properties/{PROPERTY_ID}",
    date_ranges=[DateRange(start_date=f"{DAYS}daysAgo", end_date="today")],
    dimensions=[Dimension(name="deviceCategory"), Dimension(name="landingPage")],
    metrics=[
        Metric(name="sessions"),
        Metric(name="bounceRate"),
        Metric(name="engagementRate"),
        Metric(name="averageSessionDuration"),
    ],
    dimension_filter=FilterExpression(
        filter=Filter(
            field_name="landingPage",
            string_filter=Filter.StringFilter(value="/", match_type=Filter.StringFilter.MatchType.EXACT),
        )
    ),
    limit=10,
)
res1 = client.run_report(req1)

print(f"=== 랜딩(/) 페이지 · 최근 {DAYS}일 · 디바이스별 ===")
if not res1.rows:
    print("(데이터 없음 — 기간 내 세션 0건이거나 권한 문제)")
for row in res1.rows:
    device = row.dimension_values[0].value
    sessions = row.metric_values[0].value
    bounce = row.metric_values[1].value
    engagement = row.metric_values[2].value
    avg_dur = row.metric_values[3].value
    print(
        f"  {device:10s} sessions={sessions:>6}  bounceRate={float(bounce)*100:5.1f}%  "
        f"engagementRate={float(engagement)*100:5.1f}%  avgSessionDuration={float(avg_dur):5.1f}s"
    )

# 2) scroll 이벤트 — GA4 Enhanced Measurement 는 90% 스크롤 도달 시 1회성 이벤트로 기록
req2 = RunReportRequest(
    property=f"properties/{PROPERTY_ID}",
    date_ranges=[DateRange(start_date=f"{DAYS}daysAgo", end_date="today")],
    dimensions=[Dimension(name="deviceCategory")],
    metrics=[Metric(name="eventCount"), Metric(name="sessions")],
    dimension_filter=FilterExpression(
        and_group=FilterExpressionList(
            expressions=[
                FilterExpression(
                    filter=Filter(
                        field_name="eventName",
                        string_filter=Filter.StringFilter(value="scroll", match_type=Filter.StringFilter.MatchType.EXACT),
                    )
                ),
                FilterExpression(
                    filter=Filter(
                        field_name="pagePath",
                        string_filter=Filter.StringFilter(value="/", match_type=Filter.StringFilter.MatchType.EXACT),
                    )
                ),
            ]
        )
    ),
)
res2 = client.run_report(req2)

print(f"\n=== scroll 이벤트(90% 도달) · 최근 {DAYS}일 · 디바이스별 ===")
if not res2.rows:
    print("(scroll 이벤트 없음 — Enhanced Measurement 미설정 또는 데이터 없음)")
for row in res2.rows:
    device = row.dimension_values[0].value
    count = row.metric_values[0].value
    sessions = row.metric_values[1].value
    print(f"  {device:10s} scrollEvents={count:>6}  sessions(전체)={sessions:>6}")
