import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.store import MemoryStore
from app.store.memory import ABHISEKH, SRIDHAR, seed_data

DEV_ADMIN = SRIDHAR
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


@pytest.fixture
def client_without_abhisekh(settings: Settings) -> TestClient:
    """Sample data minus Abhisekh, so tests can add him as a new user."""
    from datetime import UTC, datetime

    data = seed_data(datetime.now(UTC))
    gone = next(u for u in data["users"] if u.email == ABHISEKH)
    data["users"] = [u for u in data["users"] if u is not gone]
    data["grants"] = [g for g in data["grants"] if g.user_id != gone.user_id]
    return TestClient(create_app(settings, store=MemoryStore(**data)))


def by_email(client: TestClient, email: str) -> dict:
    return next(u for u in client.get("/api/users").json() if u["email"] == email)


def by_key(client: TestClient, role_key: str) -> dict:
    return next(r for r in client.get("/api/roles").json() if r["roleKey"] == role_key)
