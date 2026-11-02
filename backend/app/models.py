"""API models. JSON uses camelCase to match frontend/src/types/access-control.ts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ResourceType = Literal["domain", "tier"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Rows (mirror the BigQuery tables) ─────────────────────────────────────


class User(ApiModel):
    user_id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    department: str | None = None
    entra_object_id: str | None = None
    is_active: bool
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None


class Role(ApiModel):
    role_id: str
    role_key: str
    role_name: str
    description: str | None = None
    # The team that owns the role. NULL = only global admins may hand it out.
    team_id: str | None = None
    owner_team: str | None = None
    approver_email: str | None = None
    entra_group: str | None = None
    is_active: bool
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None


class RolePermission(ApiModel):
    role_permission_id: str
    role_id: str
    resource_type: ResourceType
    resource_key: str
    created_at: datetime
    created_by: str


class UserRole(ApiModel):
    """A direct grant to one person (legacy: access now goes through groups).
    Append-only: revoking sets revoked_at, the row stays."""

    user_role_id: str
    user_id: str
    role_id: str
    granted_at: datetime
    granted_by: str
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    revoked_by: str | None = None
    reason: str | None = None


class Team(ApiModel):
    """A part of Roller that manages its own groups (Sales, Support, ...)."""

    team_id: str
    team_key: str
    team_name: str
    description: str | None = None
    is_active: bool
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None


class TeamAdmin(ApiModel):
    """Someone who manages one team's groups. Append-only: removing sets removed_at."""

    team_admin_id: str
    team_id: str
    email: str
    added_at: datetime
    added_by: str
    removed_at: datetime | None = None
    removed_by: str | None = None


class Group(ApiModel):
    """A set of people who get the same roles. Owned by one team."""

    group_id: str
    group_key: str
    group_name: str
    description: str | None = None
    team_id: str
    # Optional: the Entra group this will be synced from later.
    entra_group_id: str | None = None
    is_active: bool
    created_at: datetime
    created_by: str
    updated_at: datetime | None = None
    updated_by: str | None = None


class GroupMember(ApiModel):
    """A person in a group. Append-only: removing sets removed_at, the row stays."""

    group_member_id: str
    group_id: str
    user_id: str
    added_at: datetime
    added_by: str
    approved_by: str
    expires_at: datetime | None = None
    removed_at: datetime | None = None
    removed_by: str | None = None
    reason: str | None = None


class GroupRole(ApiModel):
    """A role given to a group. Append-only: revoking sets revoked_at."""

    group_role_id: str
    group_id: str
    role_id: str
    granted_at: datetime
    granted_by: str
    revoked_at: datetime | None = None
    revoked_by: str | None = None
    reason: str | None = None


class Domain(ApiModel):
    key: str
    label: str
    metric_count: int
    loaded_by_agent: bool


# ── Inputs ────────────────────────────────────────────────────────────────


class CreateUserInput(ApiModel):
    email: str
    first_name: str
    last_name: str
    department: str | None = None


class UpdateUserInput(ApiModel):
    """Only the fields sent are changed."""

    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    department: str | None = None
    is_active: bool | None = None


class CreateRoleInput(ApiModel):
    role_key: str
    role_name: str
    description: str | None = None
    team_id: str | None = None
    approver_email: str | None = None


class UpdateRoleInput(ApiModel):
    """Only the fields sent are changed. The role key can't change."""

    role_name: str | None = None
    description: str | None = None
    team_id: str | None = None
    approver_email: str | None = None
    is_active: bool | None = None


class PermissionRef(ApiModel):
    resource_type: ResourceType
    resource_key: str


class SetPermissionsInput(ApiModel):
    permissions: list[PermissionRef] = Field(default_factory=list)


class CreateTeamInput(ApiModel):
    team_key: str
    team_name: str
    description: str | None = None


class UpdateTeamInput(ApiModel):
    """Only the fields sent are changed. The team key can't change."""

    team_name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class AddTeamAdminInput(ApiModel):
    email: str


class CreateGroupInput(ApiModel):
    group_key: str
    group_name: str
    team_id: str
    description: str | None = None
    entra_group_id: str | None = None


class UpdateGroupInput(ApiModel):
    """Only the fields sent are changed. The key and team can't change."""

    group_name: str | None = None
    description: str | None = None
    entra_group_id: str | None = None
    is_active: bool | None = None


class AddGroupMemberInput(ApiModel):
    user_id: str
    added_at: datetime
    expires_at: datetime | None = None
    approved_by: str
    reason: str | None = None


class AddGroupMembersInput(ApiModel):
    """Add many people at once, by email. Same dates, approver and reason for all."""

    emails: list[str]
    added_at: datetime
    expires_at: datetime | None = None
    approved_by: str
    reason: str | None = None
    # Emails not yet in `users` are added as new people (name taken from the email).
    create_missing_users: bool = False


class SkippedEmail(ApiModel):
    email: str
    reason: str


class AddGroupMembersResult(ApiModel):
    added: list[GroupMember]
    created_users: list[User]
    skipped: list[SkippedEmail]


class AddGroupRoleInput(ApiModel):
    role_id: str
    reason: str | None = None


class Me(ApiModel):
    email: str
    is_global_admin: bool
    # Teams this person administers (all teams for a global admin).
    admin_team_ids: list[str]
