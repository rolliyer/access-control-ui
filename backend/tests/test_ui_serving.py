from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.store import MemoryStore
from tests.conftest import DEV_ADMIN


@pytest.fixture
def ui_client(settings, tmp_path: Path) -> TestClient:
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<html>app shell</html>")
    (static / "favicon.svg").write_text("<svg/>")
    (static / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "secret.txt").write_text("do not serve")
    settings.static_dir = static
    return TestClient(create_app(settings, store=MemoryStore.seeded()))


def test_index_and_client_routes_get_the_app_shell(ui_client: TestClient):
    for path in ["/", "/users/123", "/roles"]:
        res = ui_client.get(path)
        assert res.status_code == 200
        assert "app shell" in res.text
        assert res.headers["cache-control"] == "no-cache"


def test_assets_are_cached_forever(ui_client: TestClient):
    res = ui_client.get("/assets/index-abc123.js")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert ui_client.get("/favicon.svg").headers["cache-control"] == "no-cache"


def test_missing_asset_and_unknown_api_are_404(ui_client: TestClient):
    assert ui_client.get("/assets/missing.js").status_code == 404
    res = ui_client.get("/api/nope")
    assert res.status_code == 404
    assert res.json() == {"message": "Not found."}


def test_no_path_traversal(ui_client: TestClient):
    res = ui_client.get("/..%2Fsecret.txt")
    assert "do not serve" not in res.text


def test_runtime_config_points_ui_at_this_api(ui_client: TestClient):
    res = ui_client.get("/config.js")
    assert res.headers["cache-control"] == "no-store"
    assert '"apiMode": "http"' in res.text
    assert f'"actorEmail": "{DEV_ADMIN}"' in res.text


def test_security_headers(ui_client: TestClient):
    headers = ui_client.get("/").headers
    assert headers["x-frame-options"] == "DENY"
    assert headers["x-content-type-options"] == "nosniff"
    assert "frame-ancestors 'none'" in headers["content-security-policy"]


def test_head_requests_are_supported(ui_client: TestClient):
    for path in ["/", "/healthz", "/config.js", "/assets/index-abc123.js"]:
        assert ui_client.head(path).status_code == 200, path
