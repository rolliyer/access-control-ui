"""Checks the SQL and parameters the BigQuery store sends, using a fake client.
(It does not talk to BigQuery.)"""

from datetime import UTC, datetime

import pytest

from app.models import RolePermission, User, UserRole
from app.store.bigquery import BigQueryStore

NOW = datetime(2026, 10, 19, tzinfo=UTC)


class FakeRow(dict):
    pass


class FakeJob:
    def __init__(self, rows):
        self._rows = rows

    def result(self):
        return self._rows


class FakeClient:
    def __init__(self, rows=None):
        self.calls: list[tuple[str, dict]] = []
        self._rows = rows or []

    def query(self, sql, job_config):
        params = {p.name: p for p in job_config.query_parameters}
        self.calls.append((sql, params))
        return FakeJob(self._rows)


def make_store(rows=None) -> tuple[BigQueryStore, FakeClient]:
    client = FakeClient(rows)
    return BigQueryStore(
        "ent-data-warehouse-dev", "roller_analytics_agent_access_control", client=client
    ), client


def test_rejects_unsafe_identifiers():
    with pytest.raises(ValueError):
        BigQueryStore("proj`; DROP TABLE x; --", "ds", client=FakeClient())


def test_insert_user_is_parameterized():
    store, client = make_store()
    store.insert_user(
        User(
            user_id="u1",
            email="a'b@rollerdigital.com",
            is_active=True,
            created_at=NOW,
            created_by="admin@rollerdigital.com",
        )
    )
    sql, params = client.calls[0]
    assert sql.startswith(
        "INSERT INTO `ent-data-warehouse-dev.roller_analytics_agent_access_control.users`"
    )
    assert "a'b" not in sql  # the value travels as a parameter only
    assert params["email_0"].value == "a'b@rollerdigital.com"
    assert params["is_active_0"].type_ == "BOOL"
    assert params["created_at_0"].type_ == "TIMESTAMP"


def test_list_users_maps_rows():
    row = FakeRow(
        user_id="u1",
        email="a@rollerdigital.com",
        first_name="A",
        last_name="B",
        department=None,
        entra_object_id=None,
        is_active=True,
        created_at=NOW,
        created_by="x@rollerdigital.com",
        updated_at=None,
        updated_by=None,
    )
    store, _ = make_store([row])
    assert store.list_users()[0].email == "a@rollerdigital.com"


def test_permission_changes_run_in_one_transaction():
    store, client = make_store()
    add = RolePermission(
        role_permission_id="p9",
        role_id="r1",
        resource_type="domain",
        resource_key="finance",
        created_at=NOW,
        created_by="x@rollerdigital.com",
    )
    store.change_permissions(add=[add], remove_ids=["p1", "p2"])
    assert len(client.calls) == 1
    sql, params = client.calls[0]
    assert sql.startswith("BEGIN TRANSACTION;")
    assert "DELETE FROM" in sql and "IN UNNEST(@remove_ids)" in sql
    assert sql.rstrip().endswith("COMMIT TRANSACTION;")
    assert params["remove_ids"].values == ["p1", "p2"]
    assert params["resource_key_0"].value == "finance"


def test_revoke_never_overwrites_an_earlier_revoke():
    store, client = make_store()
    store.revoke_grant(
        UserRole(
            user_role_id="g1",
            user_id="u1",
            role_id="r1",
            granted_at=NOW,
            granted_by="x@rollerdigital.com",
            revoked_at=NOW,
            revoked_by="admin@rollerdigital.com",
        )
    )
    sql, params = client.calls[0]
    assert sql.startswith("UPDATE")
    assert "AND revoked_at IS NULL" in sql
    assert "DELETE" not in sql
    assert params["user_role_id"].value == "g1"
