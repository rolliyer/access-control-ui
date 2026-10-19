"""Business rules for managing access. Same behaviour as the frontend mock
(frontend/src/api/adapters/mock-adapter.ts), so the UI works the same against both."""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime

from . import rules
from .domains import DomainCatalog
from .models import (
    CreateRoleInput,
    CreateUserInput,
    Domain,
    GrantRoleInput,
    PermissionRef,
    Role,
    RolePermission,
    UpdateRoleInput,
    UpdateUserInput,
    User,
    UserRole,
)
from .store import AccessControlStore


class AccessControlError(Exception):
    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(AccessControlError):
    status_code = 404


class ConflictError(AccessControlError):
    status_code = 409


class ValidationError(AccessControlError):
    status_code = 422


def _check(error: str | None) -> None:
    if error:
        raise ValidationError(error)


def _new_id() -> str:
    return str(uuid.uuid4())


class AccessControlService:
    def __init__(
        self,
        store: AccessControlStore,
        domains: DomainCatalog,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ):
        self._store = store
        self._domains = domains
        self._clock = clock

    # ── Domains ─────────────────────────────────────────────────────────

    def list_domains(self) -> list[Domain]:
        return self._domains.all()

    # ── Users ───────────────────────────────────────────────────────────

    def list_users(self) -> list[User]:
        return self._store.list_users()

    def create_user(self, data: CreateUserInput, actor: str) -> User:
        email = rules.normalize_email(data.email)
        _check(rules.email_error(email))
        _check(rules.required_error(data.first_name, "First name"))
        _check(rules.required_error(data.last_name, "Last name"))
        if any(u.email == email for u in self._store.list_users()):
            raise ConflictError(f"A user with email {email} already exists.")

        user = User(
            user_id=_new_id(),
            email=email,
            first_name=rules.clean(data.first_name),
            last_name=rules.clean(data.last_name),
            department=rules.clean(data.department),
            is_active=True,
            created_at=self._clock(),
            created_by=actor,
        )
        self._store.insert_user(user)
        return user

    def update_user(self, user_id: str, patch: UpdateUserInput, actor: str) -> User:
        users = self._store.list_users()
        user = self._find(users, lambda u: u.user_id == user_id, "User")
        sent = patch.model_fields_set

        if "email" in sent and patch.email is not None:
            email = rules.normalize_email(patch.email)
            _check(rules.email_error(email))
            if any(u.email == email and u.user_id != user_id for u in users):
                raise ConflictError(f"A user with email {email} already exists.")
            user.email = email
        if "first_name" in sent:
            user.first_name = rules.clean(patch.first_name)
        if "last_name" in sent:
            user.last_name = rules.clean(patch.last_name)
        if "department" in sent:
            user.department = rules.clean(patch.department)
        if "is_active" in sent and patch.is_active is not None:
            user.is_active = patch.is_active

        user.updated_at = self._clock()
        user.updated_by = actor
        self._store.update_user(user)
        return user

    # ── Roles ───────────────────────────────────────────────────────────

    def list_roles(self) -> list[Role]:
        return self._store.list_roles()

    def create_role(self, data: CreateRoleInput, actor: str) -> Role:
        _check(rules.role_key_error(data.role_key))
        _check(rules.required_error(data.role_name, "Role name"))
        if data.approver_email and data.approver_email.strip():
            _check(rules.email_error(data.approver_email))
        if any(r.role_key == data.role_key for r in self._store.list_roles()):
            raise ConflictError(f"A role with key {data.role_key} already exists.")

        role = Role(
            role_id=_new_id(),
            role_key=data.role_key,
            role_name=data.role_name.strip(),
            description=rules.clean(data.description),
            owner_team=rules.clean(data.owner_team),
            approver_email=self._clean_email(data.approver_email),
            is_active=True,
            created_at=self._clock(),
            created_by=actor,
        )
        self._store.insert_role(role)
        return role

    def update_role(self, role_id: str, patch: UpdateRoleInput, actor: str) -> Role:
        role = self._find(self._store.list_roles(), lambda r: r.role_id == role_id, "Role")
        sent = patch.model_fields_set

        if "role_name" in sent and patch.role_name is not None:
            _check(rules.required_error(patch.role_name, "Role name"))
            role.role_name = patch.role_name.strip()
        if "description" in sent:
            role.description = rules.clean(patch.description)
        if "owner_team" in sent:
            role.owner_team = rules.clean(patch.owner_team)
        if "approver_email" in sent:
            if patch.approver_email and patch.approver_email.strip():
                _check(rules.email_error(patch.approver_email))
            role.approver_email = self._clean_email(patch.approver_email)
        if "is_active" in sent and patch.is_active is not None:
            role.is_active = patch.is_active

        role.updated_at = self._clock()
        role.updated_by = actor
        self._store.update_role(role)
        return role

    # ── Permissions ─────────────────────────────────────────────────────

    def list_permissions(self) -> list[RolePermission]:
        return self._store.list_permissions()

    def set_role_permissions(
        self, role_id: str, refs: list[PermissionRef], actor: str
    ) -> list[RolePermission]:
        """Replace a role's permission set. Unchanged rows keep their ids."""
        self._find(self._store.list_roles(), lambda r: r.role_id == role_id, "Role")

        unknown = [
            f"{p.resource_type}:{p.resource_key}"
            for p in refs
            if (p.resource_type == "domain" and not self._domains.has(p.resource_key))
            or (p.resource_type == "tier" and p.resource_key not in rules.TIERS)
        ]
        if unknown:
            # Mirrors validate.sql's "unknown resource": such rows grant nothing, silently.
            raise ValidationError(f"Unknown resource(s): {', '.join(unknown)}.")

        wanted = {(p.resource_type, p.resource_key) for p in refs}
        current = [p for p in self._store.list_permissions() if p.role_id == role_id]
        have = {(p.resource_type, p.resource_key) for p in current}

        remove_ids = [
            p.role_permission_id for p in current if (p.resource_type, p.resource_key) not in wanted
        ]
        now = self._clock()
        add = [
            RolePermission(
                role_permission_id=_new_id(),
                role_id=role_id,
                resource_type=rtype,
                resource_key=rkey,
                created_at=now,
                created_by=actor,
            )
            for rtype, rkey in sorted(wanted - have)
        ]
        self._store.change_permissions(add=add, remove_ids=remove_ids)
        return [p for p in self._store.list_permissions() if p.role_id == role_id]

    # ── Grants ──────────────────────────────────────────────────────────

    def list_grants(self) -> list[UserRole]:
        return self._store.list_grants()

    def grant_role(self, data: GrantRoleInput, actor: str) -> UserRole:
        user = self._find(self._store.list_users(), lambda u: u.user_id == data.user_id, "User")
        role = self._find(self._store.list_roles(), lambda r: r.role_id == data.role_id, "Role")
        _check(rules.grantor_error(data.granted_by, user.email))
        _check(rules.grant_dates_error(data.granted_at, data.expires_at))
        if not role.is_active:
            raise ValidationError(f"Role {role.role_key} is retired.")

        now = self._clock()
        if any(
            g.user_id == user.user_id and g.role_id == role.role_id and rules.is_grant_open(g, now)
            for g in self._store.list_grants()
        ):
            raise ConflictError(f"{user.email} already holds {role.role_name}. Revoke it first.")

        grant = UserRole(
            user_role_id=_new_id(),
            user_id=user.user_id,
            role_id=role.role_id,
            granted_at=data.granted_at,
            granted_by=rules.normalize_email(data.granted_by),
            expires_at=data.expires_at,
            reason=rules.clean(data.reason),
        )
        self._store.insert_grant(grant)
        return grant

    def revoke_grant(self, user_role_id: str, actor: str) -> UserRole:
        grant = self._find(
            self._store.list_grants(), lambda g: g.user_role_id == user_role_id, "Grant"
        )
        if grant.revoked_at is not None:
            raise ConflictError("This grant is already revoked.")
        grant.revoked_at = self._clock()
        grant.revoked_by = actor
        self._store.revoke_grant(grant)
        return grant

    # ── Helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _find(items, predicate, label: str):
        for item in items:
            if predicate(item):
                return item
        raise NotFoundError(f"{label} not found.")

    @staticmethod
    def _clean_email(value: str | None) -> str | None:
        cleaned = rules.clean(value)
        return rules.normalize_email(cleaned) if cleaned else None
