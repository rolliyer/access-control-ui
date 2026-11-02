"""REST routes under /api. The contract matches frontend/src/api/adapters/http-adapter.ts.

Every route needs an admin (global or team). Reads are open to any admin; the
service decides which writes each admin may make."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from .auth import Admin
from .models import (
    AddGroupMemberInput,
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
    Role,
    RolePermission,
    SetPermissionsInput,
    Team,
    TeamAdmin,
    UpdateGroupInput,
    UpdateRoleInput,
    UpdateTeamInput,
    UpdateUserInput,
    User,
    UserRole,
)
from .service import AccessControlService


def get_service(request: Request) -> AccessControlService:
    return request.app.state.service


Service = Annotated[AccessControlService, Depends(get_service)]

router = APIRouter(prefix="/api")
CREATED = status.HTTP_201_CREATED


@router.get("/me")
def me(service: Service, admin: Admin) -> Me:
    return service.me(admin)


@router.get("/domains")
def list_domains(service: Service, _: Admin) -> list[Domain]:
    return service.list_domains()


# ── Users ─────────────────────────────────────────────────────────────────


@router.get("/users")
def list_users(service: Service, _: Admin) -> list[User]:
    return service.list_users()


@router.post("/users", status_code=CREATED)
def create_user(body: CreateUserInput, service: Service, admin: Admin) -> User:
    return service.create_user(body, admin)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UpdateUserInput, service: Service, admin: Admin) -> User:
    return service.update_user(user_id, body, admin)


# ── Roles & permissions ───────────────────────────────────────────────────


@router.get("/roles")
def list_roles(service: Service, _: Admin) -> list[Role]:
    return service.list_roles()


@router.post("/roles", status_code=CREATED)
def create_role(body: CreateRoleInput, service: Service, admin: Admin) -> Role:
    return service.create_role(body, admin)


@router.patch("/roles/{role_id}")
def update_role(role_id: str, body: UpdateRoleInput, service: Service, admin: Admin) -> Role:
    return service.update_role(role_id, body, admin)


@router.get("/role-permissions")
def list_permissions(service: Service, _: Admin) -> list[RolePermission]:
    return service.list_permissions()


@router.put("/roles/{role_id}/permissions")
def set_role_permissions(
    role_id: str, body: SetPermissionsInput, service: Service, admin: Admin
) -> list[RolePermission]:
    return service.set_role_permissions(role_id, body.permissions, admin)


# ── Direct grants (legacy: list and revoke only) ──────────────────────────


@router.get("/grants")
def list_grants(service: Service, _: Admin) -> list[UserRole]:
    return service.list_grants()


@router.post("/grants/{user_role_id}/revoke")
def revoke_grant(user_role_id: str, service: Service, admin: Admin) -> UserRole:
    return service.revoke_grant(user_role_id, admin)


# ── Teams ─────────────────────────────────────────────────────────────────


@router.get("/teams")
def list_teams(service: Service, _: Admin) -> list[Team]:
    return service.list_teams()


@router.post("/teams", status_code=CREATED)
def create_team(body: CreateTeamInput, service: Service, admin: Admin) -> Team:
    return service.create_team(body, admin)


@router.patch("/teams/{team_id}")
def update_team(team_id: str, body: UpdateTeamInput, service: Service, admin: Admin) -> Team:
    return service.update_team(team_id, body, admin)


@router.get("/team-admins")
def list_team_admins(service: Service, _: Admin) -> list[TeamAdmin]:
    return service.list_team_admins()


@router.post("/teams/{team_id}/admins", status_code=CREATED)
def add_team_admin(
    team_id: str, body: AddTeamAdminInput, service: Service, admin: Admin
) -> TeamAdmin:
    return service.add_team_admin(team_id, body, admin)


@router.post("/team-admins/{team_admin_id}/remove")
def remove_team_admin(team_admin_id: str, service: Service, admin: Admin) -> TeamAdmin:
    return service.remove_team_admin(team_admin_id, admin)


# ── Groups ────────────────────────────────────────────────────────────────


@router.get("/groups")
def list_groups(service: Service, _: Admin) -> list[Group]:
    return service.list_groups()


@router.post("/groups", status_code=CREATED)
def create_group(body: CreateGroupInput, service: Service, admin: Admin) -> Group:
    return service.create_group(body, admin)


@router.patch("/groups/{group_id}")
def update_group(group_id: str, body: UpdateGroupInput, service: Service, admin: Admin) -> Group:
    return service.update_group(group_id, body, admin)


@router.get("/group-members")
def list_group_members(service: Service, _: Admin) -> list[GroupMember]:
    return service.list_group_members()


@router.post("/groups/{group_id}/members", status_code=CREATED)
def add_group_member(
    group_id: str, body: AddGroupMemberInput, service: Service, admin: Admin
) -> GroupMember:
    return service.add_group_member(group_id, body, admin)


@router.post("/group-members/{group_member_id}/remove")
def remove_group_member(group_member_id: str, service: Service, admin: Admin) -> GroupMember:
    return service.remove_group_member(group_member_id, admin)


@router.get("/group-roles")
def list_group_roles(service: Service, _: Admin) -> list[GroupRole]:
    return service.list_group_roles()


@router.post("/groups/{group_id}/roles", status_code=CREATED)
def add_group_role(
    group_id: str, body: AddGroupRoleInput, service: Service, admin: Admin
) -> GroupRole:
    return service.add_group_role(group_id, body, admin)


@router.post("/group-roles/{group_role_id}/revoke")
def revoke_group_role(group_role_id: str, service: Service, admin: Admin) -> GroupRole:
    return service.revoke_group_role(group_role_id, admin)
