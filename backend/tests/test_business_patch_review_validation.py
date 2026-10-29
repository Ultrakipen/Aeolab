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


# ── review_count 정의 통일 (2026-10-29): 방문자 리뷰 수와 같은 값 ─────────────────────────────
def test_review_count_forced_to_visitor_count():
    from routers.business import normalize_review_count
    f = {"visitor_review_count": 600, "receipt_review_count": 600, "review_count": 1200}   # 옛 클라이언트의 합계 전송
    normalize_review_count(f)
    assert f["review_count"] == 600 and f["receipt_review_count"] == 600


def test_review_count_untouched_without_visitor():
    from routers.business import normalize_review_count
    f = {"review_count": 50}
    normalize_review_count(f)
    assert f == {"review_count": 50}
    g = {"name": "x"}
    normalize_review_count(g)
    assert g == {"name": "x"}


def test_patch_normalizes_before_update_and_clients_do_not_sum():
    import inspect, os
    from routers import business
    src = inspect.getsource(business.update_business)
    assert src.index("normalize_review_count(filtered)") < src.index(".update(filtered)")
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for rel in ("frontend/components/dashboard/BusinessQuickEditPanel.tsx", "frontend/app/(dashboard)/settings/BusinessManager.tsx"):
        t = open(os.path.join(root, rel), encoding="utf-8").read()
        assert "review_count: visitorReviewCount," in t or "review_count: editForm.visitor_review_count ?? 0," in t, rel
        assert "review_count: visitorReviewCount + receiptReviewCount" not in t and "review_count: (editForm.visitor_review_count ?? 0) + " not in t, rel
