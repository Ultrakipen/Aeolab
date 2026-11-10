"""재가입 반복 이용 방어(discount_guard) 동작 시험 (2026-11-10).

DB는 메모리 가짜로 바꾼다(운영 DB를 건드리지 않는다). 만료·해제·목적 분리·fail-open·원문 미저장을 실제 판정으로 확인한다.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from services import discount_guard as dg


class FakeDB:
    def __init__(self):
        self.businesses = {}      # user_id -> [dict]
        self.profiles = {}        # user_id -> phone
        self.keys = []            # discount_used_keys 행
        self.fail = False
        self.calls = 0
        self.upserted = []


class Q:
    def __init__(self, db, table):
        self.db, self.table, self.f, self.op, self.payload = db, table, [], "select", None

    def select(self, *_a, **_k):
        return self

    def limit(self, *_a):
        return self

    def eq(self, k, v):
        self.f.append(("eq", k, v))
        return self

    def in_(self, k, v):
        self.f.append(("in", k, list(v)))
        return self

    def is_(self, k, v):
        self.f.append(("is_null", k, v))
        return self

    def gt(self, k, v):
        self.f.append(("gt", k, v))
        return self

    def lt(self, k, v):
        self.f.append(("lt", k, v))
        return self

    def upsert(self, rows, on_conflict=None):
        self.op, self.payload = "upsert", rows
        return self

    def delete(self):
        self.op = "delete"
        return self

    def update(self, p):
        self.op, self.payload = "update", p
        return self


def _match(row, filters):
    for op, k, v in filters:
        cur = row.get(k)
        if op == "eq" and cur != v:
            return False
        if op == "in" and cur not in v:
            return False
        if op == "is_null" and cur is not None:
            return False
        if op == "gt" and not (cur is not None and str(cur) > str(v)):
            return False
        if op == "lt" and not (cur is not None and str(cur) < str(v)):
            return False
    return True


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("DISCOUNT_KEY_GUARD_ENABLED", "true")
    monkeypatch.setenv("DISCOUNT_KEY_PEPPER", "test-pepper")
    monkeypatch.delenv("DISCOUNT_KEY_RETENTION_DAYS", raising=False)
    db = FakeDB()

    async def fake_execute(q):
        db.calls += 1
        if db.fail:
            raise RuntimeError("db down")
        if q.table == "businesses":
            uid = next(v for op, k, v in q.f if op == "eq" and k == "user_id")
            return SimpleNamespace(data=list(db.businesses.get(uid, [])))
        if q.table == "profiles":
            uid = next(v for op, k, v in q.f if op == "eq" and k == "user_id")
            return SimpleNamespace(data=[{"phone": db.profiles[uid]}] if uid in db.profiles else [])
        assert q.table == "discount_used_keys"
        if q.op == "select":
            return SimpleNamespace(data=[dict(r) for r in db.keys if _match(r, q.f)])
        if q.op == "upsert":
            for row in q.payload:
                db.upserted.append(dict(row))
                ident = (row["purpose"], row["key_type"], row["key_hash"])
                db.keys = [r for r in db.keys if (r["purpose"], r["key_type"], r["key_hash"]) != ident]
                db.keys.append(dict(row))
            return SimpleNamespace(data=q.payload)
        if q.op == "delete":
            gone = [r for r in db.keys if _match(r, q.f)]
            db.keys = [r for r in db.keys if r not in gone]
            return SimpleNamespace(data=gone)
        if q.op == "update":
            hit = [r for r in db.keys if _match(r, q.f)]
            for r in hit:
                r.update(q.payload)
            return SimpleNamespace(data=hit)

    monkeypatch.setattr(dg, "execute", fake_execute)
    monkeypatch.setattr(dg, "get_client", lambda: SimpleNamespace(table=lambda n: Q(db, n)))
    return db


def run(coro):
    return asyncio.run(coro)


BIZ_A = [{"naver_place_id": "1234567890", "kakao_place_id": "987654321", "business_registration_no": None}]


# ── 정규화 ──
@pytest.mark.parametrize("raw,expected", [
    ("Foo.Bar+promo@Gmail.com", "foobar@gmail.com"),
    ("foo.bar@googlemail.com", "foobar@gmail.com"),
    ("foo.bar@naver.com", "foo.bar@naver.com"),          # gmail이 아니면 점은 의미가 있다
    ("foo+x@naver.com", "foo@naver.com"),
    ("  A@B.CO  ", "a@b.co"),
    ("no-at-sign", None), ("", None), (None, None), ("@x.com", None),
])
def test_normalize_email(raw, expected):
    assert dg.normalize_email(raw) == expected


def test_normalize_digits():
    assert dg.normalize_digits("123-45-67890", 10, 10) == "1234567890"
    assert dg.normalize_digits("123", 5, 20) is None
    assert dg.normalize_digits(None, 5, 20) is None
    assert dg.normalize_digits("abc", 5, 20) is None


def test_compute_keys_dedupes_and_skips_invalid():
    keys = dg.compute_keys("A.b+x@gmail.com", BIZ_A + [{"naver_place_id": "1234567890"}, {"naver_place_id": "12"}])
    assert keys.count((dg.KEY_NAVER, "1234567890")) == 1
    assert (dg.KEY_EMAIL, "ab@gmail.com") in keys and (dg.KEY_KAKAO, "987654321") in keys
    assert not any(v == "12" for _, v in keys)


# ── 해시 ──
def test_key_hash_is_deterministic_and_scoped(env):
    h1 = dg.key_hash("discount", "naver_place", "1234567890")
    assert h1 == dg.key_hash("discount", "naver_place", "1234567890") and len(h1) == 64
    assert h1 != dg.key_hash("trial", "naver_place", "1234567890")
    assert h1 != dg.key_hash("discount", "kakao_place", "1234567890")


def test_key_hash_needs_pepper_and_changes_with_it(monkeypatch):
    monkeypatch.delenv("DISCOUNT_KEY_PEPPER", raising=False)
    assert dg.key_hash("discount", "email", "a@b.co") is None
    monkeypatch.setenv("DISCOUNT_KEY_PEPPER", "p1")
    a = dg.key_hash("discount", "email", "a@b.co")
    monkeypatch.setenv("DISCOUNT_KEY_PEPPER", "p2")
    assert a != dg.key_hash("discount", "email", "a@b.co")


# ── 꺼짐·비밀값 없음: 아무것도 읽거나 쓰지 않는다 ──
def test_disabled_does_not_touch_db(env, monkeypatch):
    monkeypatch.setenv("DISCOUNT_KEY_GUARD_ENABLED", "false")
    env.businesses["u1"] = BIZ_A
    assert run(dg.prior_use_conflict("discount", "u1", "a@b.co")) is None
    assert run(dg.record_use("discount", "u1", "a@b.co")) == 0
    assert env.calls == 0


def test_flag_on_without_pepper_is_disabled(env, monkeypatch):
    monkeypatch.delenv("DISCOUNT_KEY_PEPPER", raising=False)
    assert dg.guard_enabled() is False
    assert run(dg.record_use("discount", "u1", "a@b.co")) == 0 and env.calls == 0


def test_default_is_off(monkeypatch):
    monkeypatch.delenv("DISCOUNT_KEY_GUARD_ENABLED", raising=False)
    monkeypatch.setenv("DISCOUNT_KEY_PEPPER", "x")
    assert dg.guard_enabled() is False


# ── 핵심 시나리오: 탈퇴 후 재가입 ──
def test_rejoin_with_same_place_but_new_email_is_caught(env):
    env.businesses["old"] = BIZ_A
    assert run(dg.record_use("discount", "old", "first@example.com")) >= 3
    # 계정이 지워진 뒤: 다른 user_id·다른 이메일, 같은 사업장 식별값
    env.businesses["new"] = [{"naver_place_id": "1234567890", "kakao_place_id": None, "business_registration_no": None}]
    assert run(dg.prior_use_conflict("discount", "new", "other@example.com")) == dg.KEY_NAVER


def test_rejoin_with_same_email_alias_but_no_place_is_caught(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "first.name@gmail.com"))
    env.businesses["new"] = [{"naver_place_id": None}]
    assert run(dg.prior_use_conflict("discount", "new", "firstname+deal@gmail.com")) == dg.KEY_EMAIL


def test_unrelated_new_customer_is_not_flagged(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "first@example.com"))
    env.businesses["new"] = [{"naver_place_id": "5555555555", "kakao_place_id": "111222333"}]
    assert run(dg.prior_use_conflict("discount", "new", "someone@example.com")) is None


def test_purposes_are_isolated(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "a@example.com"))
    env.businesses["new"] = BIZ_A
    assert run(dg.prior_use_conflict("trial", "new", "z@example.com")) is None
    assert run(dg.prior_use_conflict("discount", "new", "z@example.com")) is not None


def test_expired_key_does_not_conflict(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "a@example.com"))
    for r in env.keys:
        r["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    env.businesses["new"] = BIZ_A
    assert run(dg.prior_use_conflict("discount", "new", "z@example.com")) is None


def test_released_key_does_not_conflict_and_rerecord_clears_release(env):
    env.businesses["old"] = [{"naver_place_id": "1234567890"}]
    run(dg.record_use("discount", "old", "a@example.com"))
    # 네이버 키와 이메일 키를 해제하면 같은 가게라도 더는 일치하지 않는다(사업 양도 구제)
    assert run(dg.release("discount", "naver_place", "1234567890")) == 1
    assert run(dg.release("discount", "email", "a@example.com")) == 1
    env.businesses["new"] = [{"naver_place_id": "1234567890"}]
    assert run(dg.prior_use_conflict("discount", "new", "z@example.com")) is None
    run(dg.record_use("discount", "new", "z@example.com"))      # 다시 이용하면 그 키의 기록이 되살아난다
    naver_h = dg.key_hash("discount", "naver_place", "1234567890")
    old_email_h = dg.key_hash("discount", "email", "a@example.com")
    by_hash = {r["key_hash"]: r for r in env.keys}
    assert by_hash[naver_h]["released_at"] is None            # 새로 이용한 사업장 키는 다시 유효
    assert by_hash[old_email_h]["released_at"] is not None    # 이번 이용과 무관한 옛 이메일 키는 해제 그대로
    assert run(dg.prior_use_conflict("discount", "newer", "q@example.com")) is None   # 아직 사업장 정보가 없는 제3자는 무관
    env.businesses["third"] = [{"naver_place_id": "1234567890"}]
    assert run(dg.prior_use_conflict("discount", "third", "q@example.com")) == dg.KEY_NAVER


def test_only_hashes_are_stored_never_raw_values(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "first.name@gmail.com"))
    blob = repr(env.upserted)
    for raw in ("1234567890", "987654321", "firstname", "gmail.com", "first.name"):
        assert raw not in blob, raw
    assert all(len(r["key_hash"]) == 64 for r in env.upserted)


def test_retention_sets_expiry(env, monkeypatch):
    monkeypatch.setenv("DISCOUNT_KEY_RETENTION_DAYS", "90")
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "a@example.com"))
    exp = datetime.fromisoformat(env.upserted[0]["expires_at"])
    assert 89 <= (exp - datetime.now(timezone.utc)).days <= 90
    monkeypatch.setenv("DISCOUNT_KEY_RETENTION_DAYS", "1")
    assert dg.retention_days() == 30          # 하한
    monkeypatch.setenv("DISCOUNT_KEY_RETENTION_DAYS", "garbage")
    assert dg.retention_days() == 365


def test_fail_open_on_db_error(env):
    env.businesses["u"] = BIZ_A
    env.fail = True
    assert run(dg.prior_use_conflict("discount", "u", "a@example.com")) is None
    assert run(dg.record_use("discount", "u", "a@example.com")) == 0


def test_purge_expired_removes_only_expired(env):
    env.businesses["old"] = BIZ_A
    run(dg.record_use("discount", "old", "a@example.com"))
    n_all = len(env.keys)
    env.keys[0]["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert run(dg.purge_expired()) == 1 and len(env.keys) == n_all - 1


def test_unknown_purpose_is_ignored(env):
    assert run(dg.prior_use_conflict("coupon", "u", "a@b.co")) is None
    assert run(dg.record_use("coupon", "u", "a@b.co")) == 0


# ── 연락처 키 (2026-11-10) ──
@pytest.mark.parametrize("raw,expected", [
    ("010-1234-5678", "01012345678"), ("+82 10-1234-5678", "01012345678"), ("82-2-123-4567", "021234567"),
    ("02-123-4567", "021234567"), ("1588-1234", None), ("010", None), ("00000000000", None), ("abc", None), (None, None),
])
def test_normalize_phone(raw, expected):
    assert dg.normalize_phone(raw) == expected


def test_compute_keys_includes_profile_and_business_phone_deduped():
    keys = dg.compute_keys("a@b.co", [{"phone": "010-1234-5678"}], "01012345678")
    assert keys.count((dg.KEY_PHONE, "01012345678")) == 1
    assert dg.compute_keys("a@b.co", [{"phone": "1588-1234"}], None).count((dg.KEY_PHONE, "15881234")) == 0


def test_rejoin_with_same_phone_but_new_email_and_no_place_is_caught(env):
    env.businesses["old"] = BIZ_A
    env.profiles["old"] = "010-1234-5678"
    run(dg.record_use("discount", "old", "first@example.com"))
    env.businesses["new"] = [{"naver_place_id": None}]
    env.profiles["new"] = "+82 10 1234 5678"
    assert run(dg.prior_use_conflict("discount", "new", "other@example.com")) == dg.KEY_PHONE


def test_different_phone_is_not_flagged_and_lookup_failure_skips_only_phone(env, monkeypatch):
    env.businesses["old"] = BIZ_A
    env.profiles["old"] = "010-1234-5678"
    run(dg.record_use("discount", "old", "first@example.com"))
    env.businesses["new"] = [{"naver_place_id": "5555555555"}]
    env.profiles["new"] = "010-9999-8888"
    assert run(dg.prior_use_conflict("discount", "new", "x@example.com")) is None
    # 연락처 조회만 실패해도 사업장 키 판정은 계속된다
    env.businesses["again"] = [{"naver_place_id": "1234567890"}]
    async def boom(uid):
        raise RuntimeError("x")
    orig = dg.execute
    async def selective(q):
        if q.table == "profiles":
            raise RuntimeError("profiles down")
        return await orig(q)
    monkeypatch.setattr(dg, "execute", selective)
    assert run(dg.prior_use_conflict("discount", "again", "z@example.com")) == dg.KEY_NAVER


def test_release_phone_clears_the_key(env):
    env.businesses["old"] = [{"naver_place_id": None}]
    env.profiles["old"] = "010-1234-5678"
    run(dg.record_use("discount", "old", None))
    assert run(dg.release("discount", dg.KEY_PHONE, "010 1234 5678")) == 1
    env.businesses["new"] = [{"naver_place_id": None}]
    env.profiles["new"] = "01012345678"
    assert run(dg.prior_use_conflict("discount", "new", None)) is None
