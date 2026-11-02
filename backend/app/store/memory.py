"""In-memory store for local development and tests. Data resets on restart."""

import threading
from datetime import UTC, datetime, timedelta

from ..models import (
    Group,
    GroupMember,
    GroupRole,
    Role,
    RolePermission,
    Team,
    TeamAdmin,
    User,
    UserRole,
)

# Table name -> primary key column.
_KEYS = {
    "users": "user_id",
    "roles": "role_id",
    "permissions": "role_permission_id",
    "grants": "user_role_id",
    "teams": "team_id",
    "team_admins": "team_admin_id",
    "groups": "group_id",
    "group_members": "group_member_id",
    "group_roles": "group_role_id",
}


class MemoryStore:
    def __init__(self, **tables: list):
        unknown = set(tables) - set(_KEYS)
        if unknown:
            raise TypeError(f"Unknown tables: {', '.join(sorted(unknown))}")
        self._lock = threading.Lock()
        self._tables: dict[str, list] = {name: list(tables.get(name) or []) for name in _KEYS}

    @classmethod
    def seeded(cls, now: datetime | None = None) -> "MemoryStore":
        return cls(**seed_data(now or datetime.now(UTC)))

    # Copies on the way in and out, so callers can't mutate stored rows.

    def _list(self, table: str) -> list:
        with self._lock:
            return [row.model_copy() for row in self._tables[table]]

    def _insert(self, table: str, row) -> None:
        with self._lock:
            self._tables[table].append(row.model_copy())

    def _replace(self, table: str, row) -> None:
        key = _KEYS[table]
        with self._lock:
            rows = self._tables[table]
            for i, existing in enumerate(rows):
                if getattr(existing, key) == getattr(row, key):
                    rows[i] = row.model_copy()
                    return

    def list_users(self) -> list[User]:
        return self._list("users")

    def insert_user(self, user: User) -> None:
        self._insert("users", user)

    def update_user(self, user: User) -> None:
        self._replace("users", user)

    def list_roles(self) -> list[Role]:
        return self._list("roles")

    def insert_role(self, role: Role) -> None:
        self._insert("roles", role)

    def update_role(self, role: Role) -> None:
        self._replace("roles", role)

    def list_permissions(self) -> list[RolePermission]:
        return self._list("permissions")

    def change_permissions(self, add: list[RolePermission], remove_ids: list[str]) -> None:
        with self._lock:
            removed = set(remove_ids)
            self._tables["permissions"] = [
                p for p in self._tables["permissions"] if p.role_permission_id not in removed
            ] + [p.model_copy() for p in add]

    def list_grants(self) -> list[UserRole]:
        return self._list("grants")

    def revoke_grant(self, grant: UserRole) -> None:
        self._replace("grants", grant)

    def list_teams(self) -> list[Team]:
        return self._list("teams")

    def insert_team(self, team: Team) -> None:
        self._insert("teams", team)

    def update_team(self, team: Team) -> None:
        self._replace("teams", team)

    def list_team_admins(self) -> list[TeamAdmin]:
        return self._list("team_admins")

    def insert_team_admin(self, admin: TeamAdmin) -> None:
        self._insert("team_admins", admin)

    def remove_team_admin(self, admin: TeamAdmin) -> None:
        self._replace("team_admins", admin)

    def list_groups(self) -> list[Group]:
        return self._list("groups")

    def insert_group(self, group: Group) -> None:
        self._insert("groups", group)

    def update_group(self, group: Group) -> None:
        self._replace("groups", group)

    def list_group_members(self) -> list[GroupMember]:
        return self._list("group_members")

    def insert_group_member(self, member: GroupMember) -> None:
        self._insert("group_members", member)

    def remove_group_member(self, member: GroupMember) -> None:
        self._replace("group_members", member)

    def list_group_roles(self) -> list[GroupRole]:
        return self._list("group_roles")

    def insert_group_role(self, group_role: GroupRole) -> None:
        self._insert("group_roles", group_role)

    def revoke_group_role(self, group_role: GroupRole) -> None:
        self._replace("group_roles", group_role)


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

    def day(offset: int) -> datetime:
        return now + timedelta(days=offset)

    # key, name, description, admin
    team_defs = [
        ("data", "Data", "Data platform and analytics engineering", SRIDHAR),
        ("sales", "Sales", "Sales and revenue operations", ABHISEKH),
        ("support", "Support", "Customer support", MAYANK),
        ("finance", "Finance", "Finance and accounting", None),
    ]
    teams = [
        Team(
            team_id=next_id("team"),
            team_key=key,
            team_name=name,
            description=desc,
            is_active=True,
            created_at=created,
            created_by=SRIDHAR,
        )
        for key, name, desc, _ in team_defs
    ]
    team_id = {t.team_key: t.team_id for t in teams}
    team_admins = [
        TeamAdmin(
            team_admin_id=next_id("tadmin"),
            team_id=team_id[key],
            email=admin,
            added_at=created,
            added_by=SRIDHAR,
        )
        for key, _, _, admin in team_defs
        if admin
    ]

    # key, name, description, owning team (None = global admins only)
    role_defs = [
        ("sales_ops", "Sales Ops", "Sales operations and analysts", "sales"),
        ("customer_success", "Customer Success", "Customer success team", None),
        ("support_lead", "Support Lead", "Support leadership", "support"),
        (
            "finance_analyst",
            "Finance Analyst",
            "Finance team — sees bookings to reconcile",
            "finance",
        ),
        ("exec", "Executive", "Leadership — every domain", None),
        ("data_admin", "Data Admin", "Data team — every domain plus exploratory SQL", "data"),
        (
            "sales_analyst",
            "Sales Analyst",
            "Can see sales metrics: pipeline, ACV, win rate",
            "sales",
        ),
        (
            "support_analyst",
            "Support Analyst",
            "Can see support metrics: ticket volume, SLAs, CSAT, resolution time",
            "support",
        ),
    ]
    team_name = {t.team_key: t.team_name for t in teams}
    roles = [
        Role(
            role_id=next_id("role"),
            role_key=key,
            role_name=name,
            description=desc,
            team_id=team_id[team] if team else None,
            owner_team=team_name[team] if team else None,
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

    # key, name, team, roles
    group_defs = [
        ("data_admins", "Data Admins", "data", ["data_admin"]),
        ("sales_analysts", "Sales Analysts", "sales", ["sales_analyst"]),
        ("support_analysts", "Support Analysts", "support", ["support_analyst"]),
        ("finance_close", "Finance Close", "finance", ["finance_analyst"]),
    ]
    groups = [
        Group(
            group_id=next_id("group"),
            group_key=key,
            group_name=name,
            team_id=team_id[team],
            is_active=True,
            created_at=created,
            created_by=SRIDHAR,
        )
        for key, name, team, _ in group_defs
    ]
    group_id = {g.group_key: g.group_id for g in groups}
    group_roles = [
        GroupRole(
            group_role_id=next_id("grole"),
            group_id=group_id[key],
            role_id=role_id[role],
            granted_at=created,
            granted_by=SRIDHAR,
        )
        for key, _, _, role_keys in group_defs
        for role in role_keys
    ]

    # email, group, added_at, expires_at, removed_at, approver, reason
    member_defs = [
        (
            SRIDHAR,
            "data_admins",
            day(-45),
            day(135),
            None,
            ABHISEKH,
            "Builds the access-control tooling",
        ),
        (MAYANK, "support_analysts", day(-10), day(170), None, SRIDHAR, "Support metrics access"),
        (SHIVANI, "sales_analysts", day(-1), day(1), None, SRIDHAR, "Temporary 1-day access"),
        (SHIVANI, "support_analysts", day(-1), day(1), None, SRIDHAR, "Temporary 1-day access"),
        (
            SHIVANI,
            "finance_close",
            day(-200),
            day(-20),
            None,
            SRIDHAR,
            "Quarter-end reconciliation",
        ),
        (ABHISEKH, "sales_analysts", day(-5), day(360), None, SRIDHAR, "1-year access to sales"),
        (
            ABHISEKH,
            "support_analysts",
            day(-5),
            day(360),
            None,
            SRIDHAR,
            "1-year access to support",
        ),
    ]
    group_members = [
        GroupMember(
            group_member_id=next_id("member"),
            group_id=group_id[key],
            user_id=user_id[email],
            added_at=added,
            added_by=SRIDHAR,
            approved_by=approver,
            expires_at=expires,
            removed_at=removed,
            removed_by=SRIDHAR if removed else None,
            reason=reason,
        )
        for email, key, added, expires, removed, approver, reason in member_defs
    ]

    # Direct grants from before groups existed: one revoked, one still active.
    grants = [
        UserRole(
            user_role_id=next_id("grant"),
            user_id=user_id[MAYANK],
            role_id=role_id["support_lead"],
            granted_at=day(-40),
            granted_by=SRIDHAR,
            expires_at=day(140),
            revoked_at=day(-11),
            revoked_by=SRIDHAR,
            reason="Replaced by Support Analysts group",
        ),
        UserRole(
            user_role_id=next_id("grant"),
            user_id=user_id[SHIVANI],
            role_id=role_id["customer_success"],
            granted_at=day(-30),
            granted_by=SRIDHAR,
            expires_at=day(60),
            reason="Granted before groups — move to a group",
        ),
    ]

    return {
        "users": users,
        "roles": roles,
        "permissions": permissions,
        "grants": grants,
        "teams": teams,
        "team_admins": team_admins,
        "groups": groups,
        "group_members": group_members,
        "group_roles": group_roles,
    }
