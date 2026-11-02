from fastapi.testclient import TestClient

from app.config import Settings
from app.store.memory import ABHISEKH, MAYANK, SHIVANI, SRIDHAR
from tests.conftest import (
    DEV_ADMIN,
    by_email,
    by_group_key,
    by_key,
    by_team_key,
    iso,
    team_admin_client,
)


def member_body(user: dict, approver: str = SRIDHAR, days: int = 90) -> dict:
    return {
        "userId": user["userId"],
        "addedAt": iso(),
        "expiresAt": iso(days),
        "approvedBy": approver,
        "reason": "Joined the team",
    }


class TestTeams:
    def test_global_admin_creates_team_and_admin(self, client: TestClient):
        res = client.post("/api/teams", json={"teamKey": "marketing", "teamName": "Marketing"})
        assert res.status_code == 201
        team = res.json()
        assert team["createdBy"] == DEV_ADMIN
        assert (
            client.post("/api/teams", json={"teamKey": "marketing", "teamName": "X"}).status_code
            == 409
        )
        assert (
            client.post("/api/teams", json={"teamKey": "Mkt-1", "teamName": "X"}).status_code == 422
        )

        admin = client.post(
            f"/api/teams/{team['teamId']}/admins",
            json={"email": " Shivani.Semwal@RollerDigital.com "},
        )
        assert admin.status_code == 201
        assert admin.json()["email"] == SHIVANI
        again = client.post(f"/api/teams/{team['teamId']}/admins", json={"email": SHIVANI})
        assert again.status_code == 409

        removed = client.post(f"/api/team-admins/{admin.json()['teamAdminId']}/remove")
        assert removed.status_code == 200
        assert removed.json()["removedBy"] == DEV_ADMIN

    def test_team_admin_cannot_manage_teams(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        assert client.post("/api/teams", json={"teamKey": "x", "teamName": "X"}).status_code == 403
        support = by_team_key(client, "support")
        res = client.post(f"/api/teams/{support['teamId']}/admins", json={"email": SHIVANI})
        assert res.status_code == 403


class TestTeamAdminScope:
    def test_me_lists_own_teams(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        me = client.get("/api/me").json()
        assert me["isGlobalAdmin"] is False
        assert me["adminTeamIds"] == [by_team_key(client, "support")["teamId"]]

    def test_manages_own_group_only(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)  # Support admin
        shivani = by_email(client, SHIVANI)

        own = by_group_key(client, "support_analysts")
        res = client.post(f"/api/groups/{own['groupId']}/members", json=member_body(shivani))
        # Shivani is already in support_analysts in the sample data.
        assert res.status_code == 409

        other = by_group_key(client, "sales_analysts")
        res = client.post(f"/api/groups/{other['groupId']}/members", json=member_body(shivani))
        assert res.status_code == 403
        assert "your own team" in res.json()["message"]

        sales = by_team_key(client, "sales")
        res = client.post(
            "/api/groups",
            json={"groupKey": "sneaky", "groupName": "Sneaky", "teamId": sales["teamId"]},
        )
        assert res.status_code == 403

    def test_can_give_only_own_team_roles(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        support = by_team_key(client, "support")
        group = client.post(
            "/api/groups",
            json={
                "groupKey": "support_leads",
                "groupName": "Support Leads",
                "teamId": support["teamId"],
            },
        ).json()

        own_role = by_key(client, "support_lead")
        res = client.post(
            f"/api/groups/{group['groupId']}/roles", json={"roleId": own_role["roleId"]}
        )
        assert res.status_code == 201

        finance_role = by_key(client, "finance_analyst")
        res = client.post(
            f"/api/groups/{group['groupId']}/roles", json={"roleId": finance_role["roleId"]}
        )
        assert res.status_code == 403
        assert "another team" in res.json()["message"]

    def test_policy_is_global_only(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        role = by_key(client, "support_analyst")
        res = client.put(
            f"/api/roles/{role['roleId']}/permissions",
            json={"permissions": [{"resourceType": "domain", "resourceKey": "finance"}]},
        )
        assert res.status_code == 403
        assert client.post("/api/roles", json={"roleKey": "x", "roleName": "X"}).status_code == 403
        user = by_email(client, SHIVANI)
        assert (
            client.patch(f"/api/users/{user['userId']}", json={"isActive": False}).status_code
            == 403
        )

    def test_team_admin_can_add_people(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        res = client.post(
            "/api/users",
            json={
                "email": "new.person@rollerdigital.com",
                "firstName": "New",
                "lastName": "Person",
            },
        )
        assert res.status_code == 201
        assert res.json()["createdBy"] == MAYANK


class TestGroups:
    def test_membership_lifecycle(self, client: TestClient):
        group = by_group_key(client, "finance_close")
        abhisekh = by_email(client, ABHISEKH)

        self_approved = client.post(
            f"/api/groups/{group['groupId']}/members", json=member_body(abhisekh, approver=ABHISEKH)
        )
        assert self_approved.status_code == 422
        assert "cannot be the person" in self_approved.json()["message"]

        backwards = client.post(
            f"/api/groups/{group['groupId']}/members", json=member_body(abhisekh, days=-1)
        )
        assert backwards.status_code == 422

        added = client.post(f"/api/groups/{group['groupId']}/members", json=member_body(abhisekh))
        assert added.status_code == 201
        body = added.json()
        assert body["addedBy"] == DEV_ADMIN
        assert body["approvedBy"] == SRIDHAR

        dup = client.post(f"/api/groups/{group['groupId']}/members", json=member_body(abhisekh))
        assert dup.status_code == 409

        member_id = body["groupMemberId"]
        removed = client.post(f"/api/group-members/{member_id}/remove")
        assert removed.status_code == 200
        assert client.post(f"/api/group-members/{member_id}/remove").status_code == 409
        # Append-only: the removed row is still listed, and the person can be added again.
        assert member_id in [m["groupMemberId"] for m in client.get("/api/group-members").json()]
        again = client.post(f"/api/groups/{group['groupId']}/members", json=member_body(abhisekh))
        assert again.status_code == 201

    def test_group_roles(self, client: TestClient):
        group = by_group_key(client, "sales_analysts")
        role = by_key(client, "exec")  # no team: global admins only
        added = client.post(
            f"/api/groups/{group['groupId']}/roles",
            json={"roleId": role["roleId"], "reason": "QBR"},
        )
        assert added.status_code == 201
        dup = client.post(f"/api/groups/{group['groupId']}/roles", json={"roleId": role["roleId"]})
        assert dup.status_code == 409

        revoked = client.post(f"/api/group-roles/{added.json()['groupRoleId']}/revoke")
        assert revoked.status_code == 200
        assert revoked.json()["revokedBy"] == DEV_ADMIN

    def test_retired_group_takes_no_members(self, client: TestClient):
        group = by_group_key(client, "finance_close")
        client.patch(f"/api/groups/{group['groupId']}", json={"isActive": False})
        res = client.post(
            f"/api/groups/{group['groupId']}/members", json=member_body(by_email(client, ABHISEKH))
        )
        assert res.status_code == 422
        assert "retired" in res.json()["message"]

    def test_role_team_sets_owner_team(self, client: TestClient):
        finance = by_team_key(client, "finance")
        res = client.post(
            "/api/roles",
            json={
                "roleKey": "renewals_analyst",
                "roleName": "Renewals",
                "teamId": finance["teamId"],
            },
        )
        assert res.status_code == 201
        assert res.json()["ownerTeam"] == "Finance"
        unknown = client.post(
            "/api/roles", json={"roleKey": "other_role", "roleName": "X", "teamId": "nope"}
        )
        assert unknown.status_code == 404


class TestBulkAdd:
    def bulk(self, client: TestClient, group_key: str, emails: list[str], **extra) -> dict:
        group = by_group_key(client, group_key)
        body = {
            "emails": emails,
            "addedAt": iso(),
            "expiresAt": iso(90),
            "approvedBy": SRIDHAR,
            "reason": "Team onboarding",
            **extra,
        }
        return client.post(f"/api/groups/{group['groupId']}/members/bulk", json=body)

    def test_adds_known_people_and_explains_skips(self, client: TestClient):
        res = self.bulk(
            client,
            "finance_close",
            [
                " Abhisekh.Banerjee@RollerDigital.com ",
                MAYANK,
                MAYANK,  # duplicate in the list: counted once
                SRIDHAR,  # the approver
                "new.person@rollerdigital.com",  # not in the app
                "someone@gmail.com",
            ],
        )
        assert res.status_code == 200
        body = res.json()
        assert sorted(m["userId"] for m in body["added"]) == sorted(
            [by_email(client, ABHISEKH)["userId"], by_email(client, MAYANK)["userId"]]
        )
        assert body["createdUsers"] == []
        reasons = {s["email"]: s["reason"] for s in body["skipped"]}
        assert reasons == {
            SRIDHAR: "The approver can't approve their own access.",
            "new.person@rollerdigital.com": "Not in the app yet.",
            "someone@gmail.com": "Not a valid @rollerdigital.com email.",
        }

        again = self.bulk(client, "finance_close", [ABHISEKH]).json()
        assert again["added"] == []
        assert again["skipped"] == [{"email": ABHISEKH, "reason": "Already in the group."}]

    def test_can_create_missing_people(self, client: TestClient):
        res = self.bulk(
            client, "finance_close", ["jane.doe-smith@rollerdigital.com"], createMissingUsers=True
        )
        body = res.json()
        assert len(body["added"]) == 1
        [user] = body["createdUsers"]
        assert (user["firstName"], user["lastName"]) == ("Jane", "Doe Smith")
        assert user["createdBy"] == DEV_ADMIN
        assert by_email(client, "jane.doe-smith@rollerdigital.com")["isActive"] is True

    def test_limits(self, client: TestClient):
        assert self.bulk(client, "finance_close", [" ", ""]).status_code == 422
        too_many = [f"p{i}@rollerdigital.com" for i in range(501)]
        assert self.bulk(client, "finance_close", too_many).status_code == 422

    def test_team_admin_scope(self, settings: Settings):
        client = team_admin_client(settings, MAYANK)
        assert self.bulk(client, "sales_analysts", [SHIVANI]).status_code == 403
