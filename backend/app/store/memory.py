"""In-memory store for local development and tests. Data resets on restart."""

import threading
from datetime import UTC, datetime, timedelta

from ..models import Role, RolePermission, User, UserRole


class MemoryStore:
    def __init__(
        self,
        users: list[User] | None = None,
        roles: list[Role] | None = None,
        permissions: list[RolePermission] | None = None,
        grants: list[UserRole] | None = None,
    ):
        self._lock = threading.Lock()
        self._users = list(users or [])
        self._roles = list(roles or [])
        self._permissions = list(permissions or [])
        self._grants = list(grants or [])

    @classmethod
    def seeded(cls, now: datetime | None = None) -> "MemoryStore":
        return cls(**seed_data(now or datetime.now(UTC)))

    # Copies on the way in and out, so callers can't mutate stored rows.

    def list_users(self) -> list[User]:
        with self._lock:
            return [u.model_copy() for u in self._users]

    def insert_user(self, user: User) -> None:
        with self._lock:
            self._users.append(user.model_copy())

    def update_user(self, user: User) -> None:
        with self._lock:
            self._replace(self._users, "user_id", user)

    def list_roles(self) -> list[Role]:
        with self._lock:
            return [r.model_copy() for r in self._roles]

    def insert_role(self, role: Role) -> None:
        with self._lock:
            self._roles.append(role.model_copy())

    def update_role(self, role: Role) -> None:
        with self._lock:
            self._replace(self._roles, "role_id", role)

    def list_permissions(self) -> list[RolePermission]:
        with self._lock:
            return [p.model_copy() for p in self._permissions]

    def change_permissions(self, add: list[RolePermission], remove_ids: list[str]) -> None:
        with self._lock:
            removed = set(remove_ids)
            self._permissions = [
                p for p in self._permissions if p.role_permission_id not in removed
            ] + [p.model_copy() for p in add]

    def list_grants(self) -> list[UserRole]:
        with self._lock:
            return [g.model_copy() for g in self._grants]

    def insert_grant(self, grant: UserRole) -> None:
        with self._lock:
            self._grants.append(grant.model_copy())

    def revoke_grant(self, grant: UserRole) -> None:
        with self._lock:
            self._replace(self._grants, "user_role_id", grant)

    @staticmethod
    def _replace(rows: list, key: str, row) -> None:
        for i, existing in enumerate(rows):
            if getattr(existing, key) == getattr(row, key):
                rows[i] = row.model_copy()
                return


def seed_data(now: datetime) -> dict:
    """Mirrors semantic/access_control/dev_seed.sql (and frontend/src/api/mock/seed.ts)."""
    admin = "sridhar.iyer@rollerdigital.com"
    created = now - timedelta(days=90)
    counter = iter(range(1, 10_000))

    def next_id(prefix: str) -> str:
        return f"{prefix}-{next(counter):04d}"

    role_defs = [
        ("sales_ops", "Sales Ops", "Sales operations and analysts", "RevOps"),
        ("customer_success", "Customer Success", "Customer success team", "Customer Success"),
        ("support_lead", "Support Lead", "Support leadership", "Support"),
        (
            "finance_analyst",
            "Finance Analyst",
            "Finance team — sees bookings to reconcile",
            "Finance",
        ),
        ("exec", "Executive", "Leadership — every domain", "Executive"),
        ("data_admin", "Data Admin", "Data team — every domain plus exploratory SQL", "Data"),
    ]
    roles = [
        Role(
            role_id=next_id("role"),
            role_key=key,
            role_name=name,
            description=desc,
            owner_team=team,
            approver_email=admin,
            is_active=True,
            created_at=created,
            created_by=admin,
        )
        for key, name, desc, team in role_defs
    ]
    role_id = {r.role_key: r.role_id for r in roles}

    all_domains = ["sales", "renewals", "customer_success", "support", "finance"]
    perm_defs = [
        ("sales_ops", "domain", "sales"),
        ("sales_ops", "domain", "renewals"),
        ("customer_success", "domain", "customer_success"),
        ("customer_success", "domain", "renewals"),
        ("support_lead", "domain", "support"),
        ("finance_analyst", "domain", "finance"),
        ("finance_analyst", "domain", "sales"),
        *[("exec", "domain", d) for d in all_domains],
        *[("data_admin", "domain", d) for d in all_domains],
        ("data_admin", "tier", "exploratory"),
    ]
    permissions = [
        RolePermission(
            role_permission_id=next_id("perm"),
            role_id=role_id[key],
            resource_type=rtype,
            resource_key=rkey,
            created_at=created,
            created_by=admin,
        )
        for key, rtype, rkey in perm_defs
    ]

    user_defs = [
        ("sridhar.iyer@rollerdigital.com", "Sridhar", "Iyer", "Data", True),
        ("test.finance@rollerdigital.com", "Test", "Finance", "Finance", True),
        ("test.support@rollerdigital.com", "Test", "Support", "Support", True),
        ("test.admin@rollerdigital.com", "Test", "Admin", "Data", True),
        ("test.expired@rollerdigital.com", "Test", "Expired", "RevOps", True),
        ("test.revoked@rollerdigital.com", "Test", "Revoked", "RevOps", True),
        ("test.inactive@rollerdigital.com", "Test", "Inactive", "RevOps", False),
        ("test.future@rollerdigital.com", "Test", "Future", "RevOps", True),
        ("test.noroles@rollerdigital.com", "Test", "Noroles", "Marketing", True),
    ]
    users = [
        User(
            user_id=next_id("user"),
            email=email,
            first_name=first,
            last_name=last,
            department=dept,
            is_active=active,
            created_at=created,
            created_by=admin,
        )
        for email, first, last, dept, active in user_defs
    ]
    user_id = {u.email: u.user_id for u in users}

    def day(offset: int) -> datetime:
        return now + timedelta(days=offset)

    grant_defs = [
        ("sridhar.iyer@rollerdigital.com", "sales_ops", day(-30), day(150), None, "Dev testing"),
        (
            "test.finance@rollerdigital.com",
            "finance_analyst",
            day(-60),
            day(20),
            None,
            "Joined Finance",
        ),
        (
            "test.support@rollerdigital.com",
            "support_lead",
            day(-10),
            day(170),
            None,
            "Support lead",
        ),
        ("test.admin@rollerdigital.com", "data_admin", day(-45), day(135), None, "Data team"),
        ("test.expired@rollerdigital.com", "sales_ops", day(-200), day(-1), None, "Expired test"),
        (
            "test.revoked@rollerdigital.com",
            "sales_ops",
            day(-20),
            day(160),
            day(-2),
            "Revoked test",
        ),
        ("test.inactive@rollerdigital.com", "sales_ops", day(-20), day(160), None, "Inactive test"),
        ("test.future@rollerdigital.com", "sales_ops", day(1), day(181), None, "Starts tomorrow"),
    ]
    grants = [
        UserRole(
            user_role_id=next_id("grant"),
            user_id=user_id[email],
            role_id=role_id[key],
            granted_at=granted,
            expires_at=expires,
            revoked_at=revoked,
            revoked_by=admin if revoked else None,
            reason=reason,
            granted_by="test.admin@rollerdigital.com" if email == admin else admin,
        )
        for email, key, granted, expires, revoked, reason in grant_defs
    ]
    return {"users": users, "roles": roles, "permissions": permissions, "grants": grants}
