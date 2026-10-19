"""REST routes under /api. The contract matches frontend/src/api/adapters/http-adapter.ts."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from .auth import Admin
from .models import (
    CreateRoleInput,
    CreateUserInput,
    Domain,
    GrantRoleInput,
    Me,
    Role,
    RolePermission,
    SetPermissionsInput,
    UpdateRoleInput,
    UpdateUserInput,
    User,
    UserRole,
)
from .service import AccessControlService


def get_service(request: Request) -> AccessControlService:
    return request.app.state.service


Service = Annotated[AccessControlService, Depends(get_service)]

router = APIRouter(prefix="/api")


@router.get("/me")
def me(admin: Admin) -> Me:
    return Me(email=admin)


@router.get("/domains")
def list_domains(service: Service, _: Admin) -> list[Domain]:
    return service.list_domains()


@router.get("/users")
def list_users(service: Service, _: Admin) -> list[User]:
    return service.list_users()


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(body: CreateUserInput, service: Service, admin: Admin) -> User:
    return service.create_user(body, admin)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UpdateUserInput, service: Service, admin: Admin) -> User:
    return service.update_user(user_id, body, admin)


@router.get("/roles")
def list_roles(service: Service, _: Admin) -> list[Role]:
    return service.list_roles()


@router.post("/roles", status_code=status.HTTP_201_CREATED)
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


@router.get("/grants")
def list_grants(service: Service, _: Admin) -> list[UserRole]:
    return service.list_grants()


@router.post("/grants", status_code=status.HTTP_201_CREATED)
def grant_role(body: GrantRoleInput, service: Service, admin: Admin) -> UserRole:
    return service.grant_role(body, admin)


@router.post("/grants/{user_role_id}/revoke")
def revoke_grant(user_role_id: str, service: Service, admin: Admin) -> UserRole:
    return service.revoke_grant(user_role_id, admin)
