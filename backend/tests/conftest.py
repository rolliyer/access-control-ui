import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.store import MemoryStore

DEV_ADMIN = "dev.admin@rollerdigital.com"
DOMAINS = ["sales", "renewals", "customer_success", "support", "finance"]


@pytest.fixture
def domains_file(tmp_path: Path) -> Path:
    path = tmp_path / "domains.json"
    path.write_text(
        json.dumps(
            [
                {"key": k, "label": k.title(), "metricCount": 1, "loadedByAgent": True}
                for k in DOMAINS
            ]
        )
    )
    return path


@pytest.fixture
def settings(domains_file: Path) -> Settings:
    return Settings(auth_mode="dev", dev_user_email=DEV_ADMIN, domains_file=domains_file)


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings, store=MemoryStore.seeded()))


def by_email(client: TestClient, email: str) -> dict:
    return next(u for u in client.get("/api/users").json() if u["email"] == email)


def by_key(client: TestClient, role_key: str) -> dict:
    return next(r for r in client.get("/api/roles").json() if r["roleKey"] == role_key)
