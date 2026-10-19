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
    """A grant. Append-only: revoking sets revoked_at, the row stays."""

    user_role_id: str
    user_id: str
    role_id: str
    granted_at: datetime
    granted_by: str
    expires_at: datetime | None = None
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
    owner_team: str | None = None
    approver_email: str | None = None


class UpdateRoleInput(ApiModel):
    """Only the fields sent are changed. The role key can't change."""

    role_name: str | None = None
    description: str | None = None
    owner_team: str | None = None
    approver_email: str | None = None
    is_active: bool | None = None


class PermissionRef(ApiModel):
    resource_type: ResourceType
    resource_key: str


class SetPermissionsInput(ApiModel):
    permissions: list[PermissionRef] = Field(default_factory=list)


class GrantRoleInput(ApiModel):
    user_id: str
    role_id: str
    granted_at: datetime
    expires_at: datetime | None = None
    granted_by: str
    reason: str | None = None


class Me(ApiModel):
    email: str
