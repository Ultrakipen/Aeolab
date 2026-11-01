"""score_breakdown에서 '점수 항목'만 고르는 공통 헬퍼 (2026-11-01).

저장된 score_breakdown에는 점수 외에 `'user_group': 'INACTIVE'`, `'missing': [...]`, `'model_version': 'v3.1'`, `'track1_detail': {...}`,
`'google_captcha_blocked': False` 같은 숫자가 아닌 값이 섞여 있다(최근 스캔 60건 전부 확인). 이 값을 그대로 min()/sorted()/float()에 넣으면
TypeError·ValueError가 나서 갭 카드 생성, 스캔 완료 알림, 점수 설명 API가 통째로 실패했다 — 같은 결함이 세 곳에서 따로 나와 한 곳으로 모은다.
"""
from __future__ import annotations

from typing import Iterable, Optional


def numeric_breakdown_items(breakdown: Optional[dict], allowed: Optional[Iterable[str]] = None) -> list[tuple[str, float]]:
    """(키, 점수) 목록 — 숫자(int/float, bool 제외)인 항목만. `allowed`가 있으면 그 키만."""
    allow = set(allowed) if allowed is not None else None
    out: list[tuple[str, float]] = []
    for k, v in (breakdown or {}).items():
        if allow is not None and k not in allow:
            continue
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            continue
        out.append((k, float(v)))
    return out
