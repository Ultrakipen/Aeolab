"""
ScanContext — 위치 기반 vs 위치 무관 스캔 컨텍스트
도메인 모델 v2.1 § 2
"""
from enum import Enum


class ScanContext(str, Enum):
    LOCATION_BASED = "location_based"   # 오프라인 매장 — 지역 기반 경쟁
    NON_LOCATION   = "non_location"     # 온라인/전문직 — 위치 무관 전국 경쟁
