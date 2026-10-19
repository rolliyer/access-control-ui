from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import create_app
from app.store import MemoryStore
from tests.conftest import DEV_ADMIN, by_email, by_key


def iso(days: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def test_health(client: TestClient):
    assert client.get("/healthz").text == "ok\n"


def test_lists_use_camel_case(client: TestClient):
    users = client.get("/api/users").json()
    assert len(users) == 9
    assert {"userId", "email", "isActive", "createdAt"} <= users[0].keys()
    assert len(client.get("/api/domains").json()) == 5
    assert client.get("/api/me").json() == {"email": DEV_ADMIN}


class TestUsers:
    def test_create_normalizes_and_records_actor(self, client: TestClient):
        res = client.post(
            "/api/users",
            json={
                "email": " Jane.Doe@RollerDigital.com ",
                "firstName": "Jane",
                "lastName": "Doe",
                "department": " ",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["email"] == "jane.doe@rollerdigital.com"
        assert body["department"] is None
        assert body["createdBy"] == DEV_ADMIN
        assert body["isActive"] is True

    def test_rejects_duplicates_and_other_domains(self, client: TestClient):
        dup = client.post(
            "/api/users",
            json={"email": "test.support@rollerdigital.com", "firstName": "A", "lastName": "B"},
        )
        assert dup.status_code == 409
        assert "already exists" in dup.json()["message"]

        other = client.post(
            "/api/users", json={"email": "x@gmail.com", "firstName": "A", "lastName": "B"}
        )
        assert other.status_code == 422
        assert "rollerdigital.com" in other.json()["message"]

    def test_patch_changes_only_sent_fields(self, client: TestClient):
        user = by_email(client, "test.finance@rollerdigital.com")
        res = client.patch(f"/api/users/{user['userId']}", json={"department": None})
        assert res.status_code == 200
        body = res.json()
        assert body["department"] is None
        assert body["firstName"] == user["firstName"]
        assert body["updatedBy"] == DEV_ADMIN

        deactivated = client.patch(f"/api/users/{user['userId']}", json={"isActive": False})
        assert deactivated.json()["isActive"] is False

    def test_unknown_user_is_404(self, client: TestClient):
        res = client.patch("/api/users/nope", json={"firstName": "X"})
        assert res.status_code == 404
        assert res.json() == {"message": "User not found."}


class TestGrants:
    def test_grant_duplicate_revoke_regrant(self, client: TestClient):
        user = by_email(client, "test.noroles@rollerdigital.com")
        role = by_key(client, "support_lead")
        grant = {
            "userId": user["userId"],
            "roleId": role["roleId"],
            "grantedAt": iso(),
            "expiresAt": iso(180),
            "grantedBy": "Boss@RollerDigital.com",
            "reason": "Covering support",
        }

        created = client.post("/api/grants", json=grant)
        assert created.status_code == 201
        assert created.json()["grantedBy"] == "boss@rollerdigital.com"

        assert client.post("/api/grants", json=grant).status_code == 409

        revoked = client.post(f"/api/grants/{created.json()['userRoleId']}/revoke")
        assert revoked.status_code == 200
        assert revoked.json()["revokedBy"] == DEV_ADMIN
        # Append-only: the revoked row is still listed.
        ids = [g["userRoleId"] for g in client.get("/api/grants").json()]
        assert created.json()["userRoleId"] in ids
        # Revoking twice is refused; granting again is allowed.
        assert client.post(f"/api/grants/{created.json()['userRoleId']}/revoke").status_code == 409
        assert client.post("/api/grants", json=grant).status_code == 201

    def test_rules(self, client: TestClient):
        user = by_email(client, "test.noroles@rollerdigital.com")
        role = by_key(client, "support_lead")
        base = {
            "userId": user["userId"],
            "roleId": role["roleId"],
            "grantedAt": iso(),
            "expiresAt": iso(30),
            "grantedBy": "boss@rollerdigital.com",
        }

        self_approved = client.post("/api/grants", json={**base, "grantedBy": user["email"]})
        assert self_approved.status_code == 422
        assert "cannot be the person" in self_approved.json()["message"]

        backwards = client.post("/api/grants", json={**base, "expiresAt": iso(-1)})
        assert backwards.status_code == 422

        client.patch(f"/api/roles/{role['roleId']}", json={"isActive": False})
        retired = client.post("/api/grants", json=base)
        assert retired.status_code == 422
        assert "retired" in retired.json()["message"]


class TestRolesAndPermissions:
    def test_create_role_validates_key(self, client: TestClient):
        bad = client.post("/api/roles", json={"roleKey": "Support-Analyst", "roleName": "X"})
        assert bad.status_code == 422
        ok = client.post(
            "/api/roles", json={"roleKey": "support_analyst", "roleName": "Support Analyst"}
        )
        assert ok.status_code == 201
        dup = client.post("/api/roles", json={"roleKey": "support_analyst", "roleName": "Y"})
        assert dup.status_code == 409

    def test_set_permissions_keeps_unchanged_rows(self, client: TestClient):
        role = by_key(client, "sales_ops")
        before = [
            p for p in client.get("/api/role-permissions").json() if p["roleId"] == role["roleId"]
        ]
        sales_id = next(p["rolePermissionId"] for p in before if p["resourceKey"] == "sales")

        res = client.put(
            f"/api/roles/{role['roleId']}/permissions",
            json={
                "permissions": [
                    {"resourceType": "domain", "resourceKey": "sales"},
                    {"resourceType": "domain", "resourceKey": "finance"},
                ]
            },
        )
        assert res.status_code == 200
        after = {p["resourceKey"]: p["rolePermissionId"] for p in res.json()}
        assert set(after) == {"sales", "finance"}
        assert after["sales"] == sales_id

    def test_rejects_unknown_resources(self, client: TestClient):
        role = by_key(client, "sales_ops")
        res = client.put(
            f"/api/roles/{role['roleId']}/permissions",
            json={
                "permissions": [
                    {"resourceType": "domain", "resourceKey": "Support"},
                    {"resourceType": "tier", "resourceKey": "god_mode"},
                ]
            },
        )
        assert res.status_code == 422
        assert "domain:Support" in res.json()["message"]
        assert "tier:god_mode" in res.json()["message"]


def test_bad_request_body_is_a_readable_message(client: TestClient):
    res = client.post("/api/users", json={"email": "a@rollerdigital.com"})
    assert res.status_code == 422
    assert res.json()["message"].startswith("Invalid firstName")


def test_admin_allowlist(settings):
    settings.admin_emails = "someone.else@rollerdigital.com"
    client = TestClient(create_app(settings, store=MemoryStore.seeded()))
    res = client.get("/api/users")
    assert res.status_code == 403
    assert "not an access-control admin" in res.json()["message"]
