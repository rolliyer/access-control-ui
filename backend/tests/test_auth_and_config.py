import pytest
from fastapi.testclient import TestClient

from app.auth import IAP_JWT_HEADER
from app.config import ConfigError, Settings
from app.main import create_app
from app.store import MemoryStore
from app.store.memory import SRIDHAR

AUDIENCE = "/projects/123/locations/us-central1/services/access-control-ui"


def fake_verifier(token: str, audience: str) -> dict:
    if token != "good-token" or audience != AUDIENCE:
        raise ValueError("bad token")
    return {"email": "Mayank.Agarwal@rollerdigital.com"}


@pytest.fixture
def iap_client(domains_file) -> TestClient:
    settings = Settings(auth_mode="iap", iap_audience=AUDIENCE, domains_file=domains_file)
    return TestClient(create_app(settings, store=MemoryStore.seeded(), iap_verifier=fake_verifier))


class TestIap:
    def test_no_token_is_401(self, iap_client: TestClient):
        res = iap_client.get("/api/users")
        assert res.status_code == 401

    def test_plain_email_header_is_not_trusted(self, iap_client: TestClient):
        res = iap_client.get(
            "/api/users",
            headers={"x-goog-authenticated-user-email": f"accounts.google.com:{SRIDHAR}"},
        )
        assert res.status_code == 401

    def test_invalid_token_is_401(self, iap_client: TestClient):
        assert iap_client.get("/api/users", headers={IAP_JWT_HEADER: "forged"}).status_code == 401

    def test_valid_token_identifies_the_admin(self, iap_client: TestClient):
        res = iap_client.get("/api/me", headers={IAP_JWT_HEADER: "good-token"})
        assert res.status_code == 200
        assert res.json() == {"email": "mayank.agarwal@rollerdigital.com"}

    def test_health_needs_no_auth(self, iap_client: TestClient):
        assert iap_client.get("/healthz").status_code == 200


class TestConfigSafety:
    def test_iap_needs_audience(self, domains_file):
        with pytest.raises(ConfigError, match="IAP_AUDIENCE"):
            create_app(Settings(auth_mode="iap", domains_file=domains_file))

    def test_dev_auth_refused_on_cloud_run(self, domains_file, monkeypatch):
        monkeypatch.setenv("K_SERVICE", "access-control-ui")
        with pytest.raises(ConfigError, match="not allowed on Cloud Run"):
            create_app(Settings(auth_mode="dev", domains_file=domains_file))

    def test_bigquery_needs_project(self, domains_file):
        with pytest.raises(ConfigError, match="BQ_PROJECT"):
            create_app(Settings(auth_mode="dev", store="bigquery", domains_file=domains_file))

    def test_reads_environment(self, monkeypatch):
        monkeypatch.setenv("STORE", "bigquery")
        monkeypatch.setenv("BQ_PROJECT", "ent-data-warehouse-dev")
        monkeypatch.setenv(
            "ADMIN_EMAILS", " Sridhar.Iyer@rollerdigital.com, mayank.agarwal@rollerdigital.com ,"
        )
        settings = Settings()
        assert settings.store == "bigquery"
        assert settings.admin_email_set == {
            "sridhar.iyer@rollerdigital.com",
            "mayank.agarwal@rollerdigital.com",
        }
