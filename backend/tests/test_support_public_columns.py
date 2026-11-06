"""공개 문의 게시판이 노출하는 컬럼을 고정한다 (2026-11-07).

GET /api/support/public은 인증 없이 호출된다. 본문·첨부·작성자 ID가 섞이지 않게 select 목록을 테스트로 막고,
익명 직접 조회 정책(public_answered_tickets)이 스키마 기록에서 닫히는지도 확인한다.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTER = (ROOT / "backend" / "routers" / "support.py").read_text(encoding="utf-8")
SQL = (ROOT / "scripts" / "supabase_schema.sql").read_text(encoding="utf-8")
FORBIDDEN = ("body", "attachment_urls", "user_id", "email", "phone")


def _public_select() -> str:
    m = re.search(r'@router\.get\("/public"[^\n]*\n(?:.*\n){0,30}?.*?\.select\("([^"]+)"\)', ROUTER)
    assert m, "GET /public 라우트의 select 목록을 찾지 못했다"
    return m.group(1)


def test_public_list_selects_only_board_columns():
    cols = [c.strip() for c in _public_select().split(",")]
    assert cols == ["id", "category", "title", "status", "view_count", "created_at", "answered_at"]
    assert not [c for c in cols if c in FORBIDDEN]


def test_anonymous_direct_read_policy_is_dropped_in_schema_log():
    created = SQL.find('CREATE POLICY "public_answered_tickets"')
    dropped = SQL.rfind('DROP POLICY IF EXISTS "public_answered_tickets" ON support_tickets')
    assert dropped != -1 and (created == -1 or dropped > created)


def test_replies_policy_no_longer_exposes_public_tickets_replies():
    last = SQL.rfind('CREATE POLICY "user_see_own_replies" ON support_replies')
    tail = SQL[last:]
    assert "visibility" not in tail.split("$$")[0][:700] and "t.user_id = (SELECT auth.uid())" in tail[:700]
