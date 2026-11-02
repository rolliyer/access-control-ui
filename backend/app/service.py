"""Business rules for managing access. Same behaviour as the frontend mock
(frontend/src/api/adapters/mock-adapter.ts), so the UI works the same against both."""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime

from . import rules
from .auth import Actor
from .domains import DomainCatalog
from .models import (
    AddGroupMemberInput,
    AddGroupMembersInput,
    AddGroupMembersResult,
    AddGroupRoleInput,
    AddTeamAdminInput,
    CreateGroupInput,
    CreateRoleInput,
    CreateTeamInput,
    CreateUserInput,
    Domain,
    Group,
    GroupMember,
    GroupRole,
    Me,
    PermissionRef,
    Role,
    RolePermission,
    SkippedEmail,
    Team,
    TeamAdmin,
    UpdateGroupInput,
    UpdateRoleInput,
    UpdateTeamInput,
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


class ForbiddenError(AccessControlError):
    status_code = 403


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


# BigQuery allows 10,000 query parameters; a member row uses 10.
MAX_BULK_EMAILS = 500


def _require_global(actor: Actor) -> None:
    if not actor.is_global_admin:
        raise ForbiddenError("Only global admins can do this.")


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

    # ── Who is calling ──────────────────────────────────────────────────

    def admin_team_ids(self, email: str) -> frozenset[str]:
        """Active teams this person currently administers."""
        active_teams = {t.team_id for t in self._store.list_teams() if t.is_active}
        return frozenset(
            a.team_id
            for a in self._store.list_team_admins()
            if a.email == email and a.removed_at is None and a.team_id in active_teams
        )

    def me(self, actor: Actor) -> Me:
        team_ids = (
            [t.team_id for t in self._store.list_teams()]
            if actor.is_global_admin
            else sorted(actor.team_ids)
        )
        return Me(email=actor.email, is_global_admin=actor.is_global_admin, admin_team_ids=team_ids)

    # ── Domains ─────────────────────────────────────────────────────────

    def list_domains(self) -> list[Domain]:
        return self._domains.all()

    # ── Users ───────────────────────────────────────────────────────────

    def list_users(self) -> list[User]:
        return self._store.list_users()

    def create_user(self, data: CreateUserInput, actor: Actor) -> User:
        """Any admin may add a person (team admins need to, to add them to a group)."""
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
            created_by=actor.email,
        )
        self._store.insert_user(user)
        return user

    def update_user(self, user_id: str, patch: UpdateUserInput, actor: Actor) -> User:
        # Deactivating someone removes access granted by every team.
        _require_global(actor)
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
        user.updated_by = actor.email
        self._store.update_user(user)
        return user

    # ── Roles ───────────────────────────────────────────────────────────

    def list_roles(self) -> list[Role]:
        return self._store.list_roles()

    def create_role(self, data: CreateRoleInput, actor: Actor) -> Role:
        _require_global(actor)
        _check(rules.role_key_error(data.role_key))
        _check(rules.required_error(data.role_name, "Role name"))
        if data.approver_email and data.approver_email.strip():
            _check(rules.email_error(data.approver_email))
        if any(r.role_key == data.role_key for r in self._store.list_roles()):
            raise ConflictError(f"A role with key {data.role_key} already exists.")
        team = self._team_or_none(data.team_id)

        role = Role(
            role_id=_new_id(),
            role_key=data.role_key,
            role_name=data.role_name.strip(),
            description=rules.clean(data.description),
            team_id=team.team_id if team else None,
            owner_team=team.team_name if team else None,
            approver_email=self._clean_email(data.approver_email),
            is_active=True,
            created_at=self._clock(),
            created_by=actor.email,
        )
        self._store.insert_role(role)
        return role

    def update_role(self, role_id: str, patch: UpdateRoleInput, actor: Actor) -> Role:
        _require_global(actor)
        role = self._find(self._store.list_roles(), lambda r: r.role_id == role_id, "Role")
        sent = patch.model_fields_set

        if "role_name" in sent and patch.role_name is not None:
            _check(rules.required_error(patch.role_name, "Role name"))
            role.role_name = patch.role_name.strip()
        if "description" in sent:
            role.description = rules.clean(patch.description)
        if "team_id" in sent:
            team = self._team_or_none(patch.team_id)
            role.team_id = team.team_id if team else None
            role.owner_team = team.team_name if team else None
        if "approver_email" in sent:
            if patch.approver_email and patch.approver_email.strip():
                _check(rules.email_error(patch.approver_email))
            role.approver_email = self._clean_email(patch.approver_email)
        if "is_active" in sent and patch.is_active is not None:
            role.is_active = patch.is_active

        role.updated_at = self._clock()
        role.updated_by = actor.email
        self._store.update_role(role)
        return role

    # ── Permissions ─────────────────────────────────────────────────────

    def list_permissions(self) -> list[RolePermission]:
        return self._store.list_permissions()

    def set_role_permissions(
        self, role_id: str, refs: list[PermissionRef], actor: Actor
    ) -> list[RolePermission]:
        """Replace a role's permission set. Unchanged rows keep their ids.
        Global admins only: otherwise a team could widen its own role to any domain."""
        _require_global(actor)
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
                created_by=actor.email,
            )
            for rtype, rkey in sorted(wanted - have)
        ]
        self._store.change_permissions(add=add, remove_ids=remove_ids)
        return [p for p in self._store.list_permissions() if p.role_id == role_id]

    # ── Direct grants (legacy) ──────────────────────────────────────────
    # Access is now given through groups. Old direct grants can be listed and
    # revoked, but no new ones are created.

    def list_grants(self) -> list[UserRole]:
        return self._store.list_grants()

    def revoke_grant(self, user_role_id: str, actor: Actor) -> UserRole:
        _require_global(actor)
        grant = self._find(
            self._store.list_grants(), lambda g: g.user_role_id == user_role_id, "Grant"
        )
        if grant.revoked_at is not None:
            raise ConflictError("This grant is already revoked.")
        grant.revoked_at = self._clock()
        grant.revoked_by = actor.email
        self._store.revoke_grant(grant)
        return grant

    # ── Teams ───────────────────────────────────────────────────────────

    def list_teams(self) -> list[Team]:
        return self._store.list_teams()

    def create_team(self, data: CreateTeamInput, actor: Actor) -> Team:
        _require_global(actor)
        _check(rules.key_error(data.team_key, "Team key", "customer_success"))
        _check(rules.required_error(data.team_name, "Team name"))
        if any(t.team_key == data.team_key for t in self._store.list_teams()):
            raise ConflictError(f"A team with key {data.team_key} already exists.")
        team = Team(
            team_id=_new_id(),
            team_key=data.team_key,
            team_name=data.team_name.strip(),
            description=rules.clean(data.description),
            is_active=True,
            created_at=self._clock(),
            created_by=actor.email,
        )
        self._store.insert_team(team)
        return team

    def update_team(self, team_id: str, patch: UpdateTeamInput, actor: Actor) -> Team:
        _require_global(actor)
        team = self._find(self._store.list_teams(), lambda t: t.team_id == team_id, "Team")
        sent = patch.model_fields_set
        if "team_name" in sent and patch.team_name is not None:
            _check(rules.required_error(patch.team_name, "Team name"))
            team.team_name = patch.team_name.strip()
        if "description" in sent:
            team.description = rules.clean(patch.description)
        if "is_active" in sent and patch.is_active is not None:
            team.is_active = patch.is_active
        team.updated_at = self._clock()
        team.updated_by = actor.email
        self._store.update_team(team)
        return team

    def list_team_admins(self) -> list[TeamAdmin]:
        return self._store.list_team_admins()

    def add_team_admin(self, team_id: str, data: AddTeamAdminInput, actor: Actor) -> TeamAdmin:
        _require_global(actor)
        team = self._find(self._store.list_teams(), lambda t: t.team_id == team_id, "Team")
        email = rules.normalize_email(data.email)
        _check(rules.email_error(email))
        if any(
            a.team_id == team.team_id and a.email == email and a.removed_at is None
            for a in self._store.list_team_admins()
        ):
            raise ConflictError(f"{email} is already an admin of {team.team_name}.")
        admin = TeamAdmin(
            team_admin_id=_new_id(),
            team_id=team.team_id,
            email=email,
            added_at=self._clock(),
            added_by=actor.email,
        )
        self._store.insert_team_admin(admin)
        return admin

    def remove_team_admin(self, team_admin_id: str, actor: Actor) -> TeamAdmin:
        _require_global(actor)
        admin = self._find(
            self._store.list_team_admins(), lambda a: a.team_admin_id == team_admin_id, "Team admin"
        )
        if admin.removed_at is not None:
            raise ConflictError("This admin is already removed.")
        admin.removed_at = self._clock()
        admin.removed_by = actor.email
        self._store.remove_team_admin(admin)
        return admin

    # ── Groups ──────────────────────────────────────────────────────────

    def list_groups(self) -> list[Group]:
        return self._store.list_groups()

    def create_group(self, data: CreateGroupInput, actor: Actor) -> Group:
        team = self._find(self._store.list_teams(), lambda t: t.team_id == data.team_id, "Team")
        self._require_team(actor, team.team_id)
        if not team.is_active:
            raise ValidationError(f"Team {team.team_name} is retired.")
        _check(rules.key_error(data.group_key, "Group key", "support_analysts"))
        _check(rules.required_error(data.group_name, "Group name"))
        if any(g.group_key == data.group_key for g in self._store.list_groups()):
            raise ConflictError(f"A group with key {data.group_key} already exists.")
        group = Group(
            group_id=_new_id(),
            group_key=data.group_key,
            group_name=data.group_name.strip(),
            description=rules.clean(data.description),
            team_id=team.team_id,
            entra_group_id=rules.clean(data.entra_group_id),
            is_active=True,
            created_at=self._clock(),
            created_by=actor.email,
        )
        self._store.insert_group(group)
        return group

    def update_group(self, group_id: str, patch: UpdateGroupInput, actor: Actor) -> Group:
        group = self._group_for(group_id, actor)
        sent = patch.model_fields_set
        if "group_name" in sent and patch.group_name is not None:
            _check(rules.required_error(patch.group_name, "Group name"))
            group.group_name = patch.group_name.strip()
        if "description" in sent:
            group.description = rules.clean(patch.description)
        if "entra_group_id" in sent:
            group.entra_group_id = rules.clean(patch.entra_group_id)
        if "is_active" in sent and patch.is_active is not None:
            group.is_active = patch.is_active
        group.updated_at = self._clock()
        group.updated_by = actor.email
        self._store.update_group(group)
        return group

    # ── Group members ───────────────────────────────────────────────────

    def list_group_members(self) -> list[GroupMember]:
        return self._store.list_group_members()

    def add_group_member(
        self, group_id: str, data: AddGroupMemberInput, actor: Actor
    ) -> GroupMember:
        group = self._group_for(group_id, actor)
        if not group.is_active:
            raise ValidationError(f"Group {group.group_name} is retired.")
        user = self._find(self._store.list_users(), lambda u: u.user_id == data.user_id, "User")
        _check(rules.grantor_error(data.approved_by, user.email))
        _check(rules.grant_dates_error(data.added_at, data.expires_at))
        now = self._clock()
        if any(
            m.group_id == group.group_id
            and m.user_id == user.user_id
            and rules.is_membership_open(m, now)
            for m in self._store.list_group_members()
        ):
            raise ConflictError(
                f"{user.email} is already in {group.group_name}. Remove them first."
            )
        member = GroupMember(
            group_member_id=_new_id(),
            group_id=group.group_id,
            user_id=user.user_id,
            added_at=data.added_at,
            added_by=actor.email,
            approved_by=rules.normalize_email(data.approved_by),
            expires_at=data.expires_at,
            reason=rules.clean(data.reason),
        )
        self._store.insert_group_member(member)
        return member

    def add_group_members(
        self, group_id: str, data: AddGroupMembersInput, actor: Actor
    ) -> AddGroupMembersResult:
        """Add many people at once. People who can't be added are skipped with a
        reason, rather than failing the whole list."""
        group = self._group_for(group_id, actor)
        if not group.is_active:
            raise ValidationError(f"Group {group.group_name} is retired.")
        approver = rules.normalize_email(data.approved_by)
        _check(rules.email_error(approver))
        _check(rules.grant_dates_error(data.added_at, data.expires_at))

        emails = list(dict.fromkeys(rules.normalize_email(e) for e in data.emails if e.strip()))
        if not emails:
            raise ValidationError("Paste or upload at least one email.")
        if len(emails) > MAX_BULK_EMAILS:
            raise ValidationError(f"Add at most {MAX_BULK_EMAILS} people at a time.")

        now = self._clock()
        users = {u.email: u for u in self._store.list_users()}
        in_group = {
            m.user_id
            for m in self._store.list_group_members()
            if m.group_id == group.group_id and rules.is_membership_open(m, now)
        }

        created: list[User] = []
        members: list[GroupMember] = []
        skipped: list[SkippedEmail] = []
        for email in emails:
            reason = None
            user = users.get(email)
            if rules.email_error(email):
                reason = "Not a valid @rollerdigital.com email."
            elif email == approver:
                reason = "The approver can't approve their own access."
            elif user is None and not data.create_missing_users:
                reason = "Not in the app yet."
            elif user is not None and not user.is_active:
                reason = "This person is deactivated."
            elif user is not None and user.user_id in in_group:
                reason = "Already in the group."
            if reason:
                skipped.append(SkippedEmail(email=email, reason=reason))
                continue

            if user is None:
                first, last = rules.name_from_email(email)
                user = User(
                    user_id=_new_id(),
                    email=email,
                    first_name=first,
                    last_name=last,
                    is_active=True,
                    created_at=now,
                    created_by=actor.email,
                )
                created.append(user)
            members.append(
                GroupMember(
                    group_member_id=_new_id(),
                    group_id=group.group_id,
                    user_id=user.user_id,
                    added_at=data.added_at,
                    added_by=actor.email,
                    approved_by=approver,
                    expires_at=data.expires_at,
                    reason=rules.clean(data.reason),
                )
            )

        if created:
            self._store.insert_users(created)
        if members:
            self._store.insert_group_members(members)
        return AddGroupMembersResult(added=members, created_users=created, skipped=skipped)

    def remove_group_member(self, group_member_id: str, actor: Actor) -> GroupMember:
        member = self._find(
            self._store.list_group_members(),
            lambda m: m.group_member_id == group_member_id,
            "Membership",
        )
        self._group_for(member.group_id, actor)
        if member.removed_at is not None:
            raise ConflictError("This person is already removed from the group.")
        member.removed_at = self._clock()
        member.removed_by = actor.email
        self._store.remove_group_member(member)
        return member

    # ── Group roles ─────────────────────────────────────────────────────

    def list_group_roles(self) -> list[GroupRole]:
        return self._store.list_group_roles()

    def add_group_role(self, group_id: str, data: AddGroupRoleInput, actor: Actor) -> GroupRole:
        group = self._group_for(group_id, actor)
        role = self._find(self._store.list_roles(), lambda r: r.role_id == data.role_id, "Role")
        if not role.is_active:
            raise ValidationError(f"Role {role.role_key} is retired.")
        # A team can hand out only its own roles; anything else needs a global admin.
        if not actor.is_global_admin and role.team_id != group.team_id:
            raise ForbiddenError(
                f"{role.role_name} belongs to another team. Ask a global admin to add it."
            )
        if any(
            gr.group_id == group.group_id and gr.role_id == role.role_id and gr.revoked_at is None
            for gr in self._store.list_group_roles()
        ):
            raise ConflictError(f"{group.group_name} already has {role.role_name}.")
        group_role = GroupRole(
            group_role_id=_new_id(),
            group_id=group.group_id,
            role_id=role.role_id,
            granted_at=self._clock(),
            granted_by=actor.email,
            reason=rules.clean(data.reason),
        )
        self._store.insert_group_role(group_role)
        return group_role

    def revoke_group_role(self, group_role_id: str, actor: Actor) -> GroupRole:
        group_role = self._find(
            self._store.list_group_roles(),
            lambda gr: gr.group_role_id == group_role_id,
            "Group role",
        )
        self._group_for(group_role.group_id, actor)
        if group_role.revoked_at is not None:
            raise ConflictError("This role is already removed from the group.")
        group_role.revoked_at = self._clock()
        group_role.revoked_by = actor.email
        self._store.revoke_group_role(group_role)
        return group_role

    # ── Helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _require_team(actor: Actor, team_id: str) -> None:
        if not actor.can_manage_team(team_id):
            raise ForbiddenError("You can only manage your own team's groups.")

    def _group_for(self, group_id: str, actor: Actor) -> Group:
        """The group, if the actor may manage it."""
        group = self._find(self._store.list_groups(), lambda g: g.group_id == group_id, "Group")
        self._require_team(actor, group.team_id)
        return group

    def _team_or_none(self, team_id: str | None) -> Team | None:
        team_id = rules.clean(team_id)
        if team_id is None:
            return None
        return self._find(self._store.list_teams(), lambda t: t.team_id == team_id, "Team")

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
