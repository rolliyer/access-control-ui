"""BigQuery store for the roller_analytics_agent_access_control dataset.

Every value is passed as a query parameter, never formatted into SQL.
Writes use DML (not the streaming API) so rows can be updated straight away —
streamed rows sit in a buffer that blocks UPDATE/DELETE for up to 90 minutes.
"""

import re
from datetime import datetime
from typing import Any

from google.cloud import bigquery

from ..models import Role, RolePermission, User, UserRole

# Column -> BigQuery type, per table (see migrations/003_access_control.sql).
USER_COLUMNS = {
    "user_id": "STRING",
    "email": "STRING",
    "first_name": "STRING",
    "last_name": "STRING",
    "department": "STRING",
    "entra_object_id": "STRING",
    "is_active": "BOOL",
    "created_at": "TIMESTAMP",
    "created_by": "STRING",
    "updated_at": "TIMESTAMP",
    "updated_by": "STRING",
}
ROLE_COLUMNS = {
    "role_id": "STRING",
    "role_key": "STRING",
    "role_name": "STRING",
    "description": "STRING",
    "owner_team": "STRING",
    "approver_email": "STRING",
    "entra_group": "STRING",
    "is_active": "BOOL",
    "created_at": "TIMESTAMP",
    "created_by": "STRING",
    "updated_at": "TIMESTAMP",
    "updated_by": "STRING",
}
PERMISSION_COLUMNS = {
    "role_permission_id": "STRING",
    "role_id": "STRING",
    "resource_type": "STRING",
    "resource_key": "STRING",
    "created_at": "TIMESTAMP",
    "created_by": "STRING",
}
GRANT_COLUMNS = {
    "user_role_id": "STRING",
    "user_id": "STRING",
    "role_id": "STRING",
    "granted_at": "TIMESTAMP",
    "granted_by": "STRING",
    "expires_at": "TIMESTAMP",
    "revoked_at": "TIMESTAMP",
    "revoked_by": "STRING",
    "reason": "STRING",
}

_IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]+$")

Params = dict[str, tuple[str, Any]]  # name -> (BigQuery type, value)


class BigQueryStore:
    def __init__(self, project: str, dataset: str, client: Any | None = None):
        for part in (project, dataset):
            if not _IDENTIFIER.match(part):
                raise ValueError(f"Invalid BigQuery identifier: {part!r}")
        self._prefix = f"{project}.{dataset}"
        self._client = client or bigquery.Client(project=project)

    # ── Users ───────────────────────────────────────────────────────────

    def list_users(self) -> list[User]:
        return [User(**row) for row in self._select("users", USER_COLUMNS)]

    def insert_user(self, user: User) -> None:
        self._insert("users", USER_COLUMNS, [user.model_dump()])

    def update_user(self, user: User) -> None:
        self._update(
            "users",
            USER_COLUMNS,
            user.model_dump(),
            key="user_id",
            fields=[
                "email",
                "first_name",
                "last_name",
                "department",
                "is_active",
                "updated_at",
                "updated_by",
            ],
        )

    # ── Roles ───────────────────────────────────────────────────────────

    def list_roles(self) -> list[Role]:
        return [Role(**row) for row in self._select("roles", ROLE_COLUMNS)]

    def insert_role(self, role: Role) -> None:
        self._insert("roles", ROLE_COLUMNS, [role.model_dump()])

    def update_role(self, role: Role) -> None:
        self._update(
            "roles",
            ROLE_COLUMNS,
            role.model_dump(),
            key="role_id",
            fields=[
                "role_name",
                "description",
                "owner_team",
                "approver_email",
                "is_active",
                "updated_at",
                "updated_by",
            ],
        )

    # ── Permissions ─────────────────────────────────────────────────────

    def list_permissions(self) -> list[RolePermission]:
        return [
            RolePermission(**row) for row in self._select("role_permissions", PERMISSION_COLUMNS)
        ]

    def change_permissions(self, add: list[RolePermission], remove_ids: list[str]) -> None:
        """Removes and adds in one transaction, so a role is never left half-updated."""
        statements: list[str] = []
        params: Params = {}
        if remove_ids:
            statements.append(
                f"DELETE FROM `{self._table('role_permissions')}` "
                "WHERE role_permission_id IN UNNEST(@remove_ids)"
            )
            params["remove_ids"] = ("ARRAY<STRING>", list(remove_ids))
        if add:
            sql, insert_params = self._insert_sql(
                "role_permissions", PERMISSION_COLUMNS, [p.model_dump() for p in add]
            )
            statements.append(sql)
            params.update(insert_params)
        if not statements:
            return
        if len(statements) == 1:
            self._run(statements[0], params)
        else:
            self._run(
                "BEGIN TRANSACTION;\n" + ";\n".join(statements) + ";\nCOMMIT TRANSACTION;", params
            )

    # ── Grants ──────────────────────────────────────────────────────────

    def list_grants(self) -> list[UserRole]:
        return [UserRole(**row) for row in self._select("user_roles", GRANT_COLUMNS)]

    def insert_grant(self, grant: UserRole) -> None:
        self._insert("user_roles", GRANT_COLUMNS, [grant.model_dump()])

    def revoke_grant(self, grant: UserRole) -> None:
        # `revoked_at IS NULL` keeps a revoke from ever overwriting an earlier one.
        self._run(
            f"UPDATE `{self._table('user_roles')}` "
            "SET revoked_at = @revoked_at, revoked_by = @revoked_by "
            "WHERE user_role_id = @user_role_id AND revoked_at IS NULL",
            {
                "revoked_at": ("TIMESTAMP", grant.revoked_at),
                "revoked_by": ("STRING", grant.revoked_by),
                "user_role_id": ("STRING", grant.user_role_id),
            },
        )

    # ── SQL helpers ─────────────────────────────────────────────────────

    def _table(self, name: str) -> str:
        return f"{self._prefix}.{name}"

    def _select(self, table: str, columns: dict[str, str]) -> list[dict[str, Any]]:
        sql = f"SELECT {', '.join(columns)} FROM `{self._table(table)}`"
        return [dict(row.items()) for row in self._run(sql, {})]

    def _insert_sql(
        self, table: str, columns: dict[str, str], rows: list[dict[str, Any]]
    ) -> tuple[str, Params]:
        params: Params = {}
        values = []
        for i, row in enumerate(rows):
            names = []
            for column, bq_type in columns.items():
                name = f"{column}_{i}"
                params[name] = (bq_type, row.get(column))
                names.append(f"@{name}")
            values.append(f"({', '.join(names)})")
        sql = (
            f"INSERT INTO `{self._table(table)}` ({', '.join(columns)}) VALUES {', '.join(values)}"
        )
        return sql, params

    def _insert(self, table: str, columns: dict[str, str], rows: list[dict[str, Any]]) -> None:
        self._run(*self._insert_sql(table, columns, rows))

    def _update(
        self,
        table: str,
        columns: dict[str, str],
        row: dict[str, Any],
        *,
        key: str,
        fields: list[str],
    ) -> None:
        assignments = ", ".join(f"{f} = @{f}" for f in fields)
        sql = f"UPDATE `{self._table(table)}` SET {assignments} WHERE {key} = @{key}"
        params = {name: (columns[name], row[name]) for name in [*fields, key]}
        self._run(sql, params)

    def _run(self, sql: str, params: Params) -> list[Any]:
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                _param(name, bq_type, value) for name, (bq_type, value) in params.items()
            ]
        )
        return list(self._client.query(sql, job_config=job_config).result())


def _param(name: str, bq_type: str, value: Any):
    if bq_type.startswith("ARRAY<"):
        return bigquery.ArrayQueryParameter(name, bq_type[6:-1], value)
    if bq_type == "TIMESTAMP" and isinstance(value, str):
        value = datetime.fromisoformat(value)
    return bigquery.ScalarQueryParameter(name, bq_type, value)
