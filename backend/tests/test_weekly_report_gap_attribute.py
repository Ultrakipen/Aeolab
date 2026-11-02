"""주간 성적표 잡이 DimensionGap의 없는 속성(gap_score)을 읽어 매주 AttributeError가 나던 결함 방지 (2026-11-02).

jobs.py의 worst_dim 선택이 DimensionGap 모델의 실제 필드만 쓰는지 확인한다.
"""
import pathlib
import re

from models.gap import DimensionGap

JOBS = pathlib.Path(__file__).resolve().parent.parent / "scheduler" / "jobs.py"


def test_dimension_gap_has_no_gap_score_field():
    assert "gap_score" not in DimensionGap.model_fields
    assert "gap_to_top" in DimensionGap.model_fields


def test_jobs_only_reads_existing_dimension_gap_fields():
    src = JOBS.read_text(encoding="utf-8")
    assert not re.search(r"lambda d: d\.gap_score\b", src)
    assert "key=lambda d: d.gap_to_top" in src


def test_worst_dimension_is_the_largest_gap_to_top():
    dims = [
        DimensionGap(dimension_key=k, dimension_label=k, my_score=0, top_score=g, avg_score=0, gap_to_top=g,
                     gap_reason=k, improvement_potential="high", weight=0.1, priority=i)
        for i, (k, g) in enumerate([("a", 5.0), ("b", 20.0), ("c", 1.0)], 1)
    ]
    assert max(dims, key=lambda d: d.gap_to_top).dimension_key == "b"
