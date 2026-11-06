"""supabase_schema.sql에서 역할 제한 없는 '모두 허용' 정책이 뒤에서 닫히는지 검사한다 (2026-11-07).

`CREATE POLICY ... USING (true) WITH CHECK (true)`는 TO 절이 없으면 roles={public}이라 anon 키(공개)만으로 읽기·쓰기·삭제가 된다.
이름이 service_*여도 마찬가지다(2026-09-22 trial_scans 이메일 유출, 2026-11-06 naver_prescan 발견). 서비스 롤은 RLS를 우회하므로
그런 정책은 필요 없다. 이 파일은 마이그레이션을 이어 붙이는 기록이라 '앞에서 만들고 뒤에서 DROP'도 허용하되 DROP이 반드시 있어야 한다.
공개 읽기(FOR SELECT)와 대기자 등록(waitlist FOR INSERT)은 의도된 공개다.
"""
import re
from pathlib import Path

SQL = (Path(__file__).resolve().parents[2] / "scripts" / "supabase_schema.sql").read_text(encoding="utf-8")

_POLICY = re.compile(r'CREATE POLICY\s+"?([^"\s]+)"?\s+ON\s+(?:public\.)?(\w+)(.*?);', re.S | re.I)
_OPEN = re.compile(r'USING\s*\(\s*true\s*\)|WITH CHECK\s*\(\s*true\s*\)', re.I)
_ALLOWED = {("waitlist", "waitlist_insert")}   # 비로그인 대기자 등록(SELECT 정책 없음 — 읽기 불가)


def _risky_creates():
    out = []
    for m in _POLICY.finditer(SQL):
        name, table, body = m.group(1), m.group(2), " ".join(m.group(3).split())
        if not _OPEN.search(body):
            continue
        if re.search(r'FOR\s+SELECT', body, re.I):
            continue
        if (table, name) in _ALLOWED:
            continue
        out.append((table, name, m.start()))
    return out


def _dropped_after(table: str, name: str, pos: int) -> bool:
    pat = re.compile(rf'DROP POLICY\s+IF EXISTS\s+"?{re.escape(name)}"?\s+ON\s+(?:public\.)?{re.escape(table)}\b', re.I)
    return pat.search(SQL, pos) is not None


def test_every_unrestricted_all_policy_is_dropped_later():
    open_forever = [(t, n) for t, n, pos in _risky_creates() if not _dropped_after(t, n, pos)]
    assert not open_forever, f"역할 제한 없는 모두 허용 정책이 닫히지 않음(anon 키로 접근 가능): {open_forever}"


def test_detector_sees_the_known_cases():
    seen = {(t, n) for t, n, _ in _risky_creates()}
    assert ("naver_prescan", "service_naver_prescan_all") in seen
    assert ("trial_scans", "trial_scans_insert") in seen
