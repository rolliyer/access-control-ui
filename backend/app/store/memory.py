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


SRIDHAR = "sridhar.iyer@rollerdigital.com"
MAYANK = "mayank.agarwal@rollerdigital.com"
SHIVANI = "shivani.semwal@rollerdigital.com"
ABHISEKH = "abhisekh.banerjee@rollerdigital.com"


def seed_data(now: datetime) -> dict:
    """Sample data: only the four people in the analytics MCP repo's dev grant
    scripts (semantic/access_control/dev_grant_*.sql). The roles are those of
    dev_seed.sql plus sales_analyst and support_analyst from the grant scripts.
    Kept identical to frontend/src/api/mock/seed.ts."""
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
        (
            "sales_analyst",
            "Sales Analyst",
            "Can see sales metrics: pipeline, ACV, win rate",
            "Sales",
        ),
        (
            "support_analyst",
            "Support Analyst",
            "Can see support metrics: ticket volume, SLAs, CSAT, resolution time",
            "Support",
        ),
    ]
    roles = [
        Role(
            role_id=next_id("role"),
            role_key=key,
            role_name=name,
            description=desc,
            owner_team=team,
            approver_email=SRIDHAR,
            is_active=True,
            created_at=created,
            created_by=SRIDHAR,
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
        ("sales_analyst", "domain", "sales"),
        ("support_analyst", "domain", "support"),
    ]
    permissions = [
        RolePermission(
            role_permission_id=next_id("perm"),
            role_id=role_id[key],
            resource_type=rtype,
            resource_key=rkey,
            created_at=created,
            created_by=SRIDHAR,
        )
        for key, rtype, rkey in perm_defs
    ]

    user_defs = [
        (SRIDHAR, "Sridhar", "Iyer", "Data"),
        (MAYANK, "Mayank", "Agarwal", "Support"),
        (SHIVANI, "Shivani", "Semwal", None),
        (ABHISEKH, "Abhisekh", "Banerjee", None),
    ]
    users = [
        User(
            user_id=next_id("user"),
            email=email,
            first_name=first,
            last_name=last,
            department=dept,
            is_active=True,
            created_at=created,
            created_by=SRIDHAR,
        )
        for email, first, last, dept in user_defs
    ]
    user_id = {u.email: u.user_id for u in users}

    def day(offset: int) -> datetime:
        return now + timedelta(days=offset)

    # email, role, granted_at, expires_at, revoked_at, approver, reason
    grant_defs = [
        (
            SRIDHAR,
            "data_admin",
            day(-45),
            day(135),
            None,
            ABHISEKH,
            "Builds the access-control tooling",
        ),
        (MAYANK, "support_analyst", day(-10), day(170), None, SRIDHAR, "Support metrics access"),
        (
            MAYANK,
            "support_lead",
            day(-40),
            day(140),
            day(-11),
            SRIDHAR,
            "Replaced by Support Analyst",
        ),
        (SHIVANI, "sales_analyst", day(-1), day(1), None, SRIDHAR, "Temporary 1-day access"),
        (SHIVANI, "support_analyst", day(-1), day(1), None, SRIDHAR, "Temporary 1-day access"),
        (
            SHIVANI,
            "finance_analyst",
            day(-200),
            day(-20),
            None,
            SRIDHAR,
            "Quarter-end reconciliation",
        ),
        (ABHISEKH, "sales_analyst", day(-5), day(360), None, SRIDHAR, "1-year access to sales"),
        (ABHISEKH, "support_analyst", day(-5), day(360), None, SRIDHAR, "1-year access to support"),
    ]
    grants = [
        UserRole(
            user_role_id=next_id("grant"),
            user_id=user_id[email],
            role_id=role_id[key],
            granted_at=granted,
            expires_at=expires,
            revoked_at=revoked,
            revoked_by=SRIDHAR if revoked else None,
            granted_by=approver,
            reason=reason,
        )
        for email, key, granted, expires, revoked, approver, reason in grant_defs
    ]
    return {"users": users, "roles": roles, "permissions": permissions, "grants": grants}
