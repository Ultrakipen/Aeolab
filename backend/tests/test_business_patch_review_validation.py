"""사용자 입력 별점·리뷰 수 PATCH 범위 검증 (2026-10-29). 수정 API는 dict라 범위 검증이 없었다."""
import pytest
from fastapi import HTTPException

from routers.business import _validate_review_inputs


@pytest.mark.parametrize("payload", [
    {"avg_rating": 500},
    {"avg_rating": -1},
    {"avg_rating": 5.01},
    {"avg_rating": "4.5"},
    {"avg_rating": True},
    {"review_count": -3},
    {"review_count": 1.5},
    {"review_count": "10"},
    {"visitor_review_count": 10**9},
    {"receipt_review_count": False},
])
def test_invalid_rejected(payload):
    with pytest.raises(HTTPException) as e:
        _validate_review_inputs(payload)
    assert e.value.status_code == 400


@pytest.mark.parametrize("payload", [
    {"avg_rating": 0}, {"avg_rating": 5}, {"avg_rating": 4.6},
    {"review_count": 0}, {"review_count": 12345},
    {"avg_rating": None, "review_count": None},
    {"name": "x"},
])
def test_valid_accepted(payload):
    _validate_review_inputs(payload)


def test_patch_calls_validation_before_update():
    import inspect
    from routers import business
    src = inspect.getsource(business.update_business)
    assert src.index("_validate_review_inputs(filtered)") < src.index('.update(filtered)')
