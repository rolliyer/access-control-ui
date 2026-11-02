from fastapi.testclient import TestClient

from app.main import create_app
from app.store import MemoryStore
from app.store.memory import ABHISEKH, MAYANK, SHIVANI, SRIDHAR
from tests.conftest import DEV_ADMIN, by_email, by_key, iso


def test_health(client: TestClient):
    assert client.get("/healthz").text == "ok\n"


def test_lists_use_camel_case(client: TestClient):
    users = client.get("/api/users").json()
    assert len(users) == 4
    assert {"userId", "email", "isActive", "createdAt"} <= users[0].keys()
    assert len(client.get("/api/domains").json()) == 5
    me = client.get("/api/me").json()
    assert me["email"] == DEV_ADMIN
    assert me["isGlobalAdmin"] is True
    assert len(me["adminTeamIds"]) == 4


class TestUsers:
    def test_create_normalizes_and_records_actor(self, client_without_abhisekh: TestClient):
        res = client_without_abhisekh.post(
            "/api/users",
            json={
                "email": " Abhisekh.Banerjee@RollerDigital.com ",
                "firstName": "Abhisekh",
                "lastName": "Banerjee",
                "department": " ",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["email"] == ABHISEKH
        assert body["department"] is None
        assert body["createdBy"] == DEV_ADMIN
        assert body["isActive"] is True

    def test_rejects_duplicates_and_other_domains(self, client: TestClient):
        dup = client.post(
            "/api/users",
            json={"email": MAYANK, "firstName": "Mayank", "lastName": "Agarwal"},
        )
        assert dup.status_code == 409
        assert "already exists" in dup.json()["message"]

        other = client.post(
            "/api/users",
            json={
                "email": "mayank.agarwal@gmail.com",
                "firstName": "Mayank",
                "lastName": "Agarwal",
            },
        )
        assert other.status_code == 422
        assert "rollerdigital.com" in other.json()["message"]

    def test_patch_changes_only_sent_fields(self, client: TestClient):
        user = by_email(client, MAYANK)
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


class TestLegacyGrants:
    def test_no_new_direct_grants(self, client: TestClient):
        user = by_email(client, ABHISEKH)
        role = by_key(client, "finance_analyst")
        res = client.post(
            "/api/grants",
            json={
                "userId": user["userId"],
                "roleId": role["roleId"],
                "grantedAt": iso(),
                "grantedBy": SRIDHAR,
            },
        )
        assert res.status_code == 405

    def test_revoke_keeps_the_row(self, client: TestClient):
        open_grant = next(g for g in client.get("/api/grants").json() if g["revokedAt"] is None)
        revoked = client.post(f"/api/grants/{open_grant['userRoleId']}/revoke")
        assert revoked.status_code == 200
        assert revoked.json()["revokedBy"] == DEV_ADMIN
        # Append-only: the revoked row is still listed.
        ids = [g["userRoleId"] for g in client.get("/api/grants").json()]
        assert open_grant["userRoleId"] in ids
        assert client.post(f"/api/grants/{open_grant['userRoleId']}/revoke").status_code == 409


class TestRolesAndPermissions:
    def test_create_role_validates_key(self, client: TestClient):
        bad = client.post("/api/roles", json={"roleKey": "Support-Analyst", "roleName": "X"})
        assert bad.status_code == 422
        ok = client.post(
            "/api/roles", json={"roleKey": "renewals_analyst", "roleName": "Renewals Analyst"}
        )
        assert ok.status_code == 201
        dup = client.post("/api/roles", json={"roleKey": "renewals_analyst", "roleName": "Y"})
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
    res = client.post("/api/users", json={"email": MAYANK})
    assert res.status_code == 422
    assert res.json()["message"].startswith("Invalid firstName")


def test_admin_allowlist(settings):
    # Shivani is neither in ADMIN_EMAILS nor a team admin.
    settings.admin_emails = MAYANK
    settings.dev_user_email = SHIVANI
    client = TestClient(create_app(settings, store=MemoryStore.seeded()))
    res = client.get("/api/users")
    assert res.status_code == 403
    assert "not an access-control admin" in res.json()["message"]
