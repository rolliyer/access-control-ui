"""App factory: API under /api, the built UI everywhere else, one process.

Run locally (from backend/):
    AUTH_MODE=dev uv run uvicorn app.main:create_app --factory --reload --port 8000
"""

import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response

from .api import router
from .auth import IapVerifier, google_iap_verifier, resolve_email
from .config import Settings
from .domains import DomainCatalog
from .service import AccessControlError, AccessControlService
from .store import AccessControlStore, create_store

# uvicorn configures this logger, so messages show up in Cloud Run logs.
log = logging.getLogger("uvicorn.error")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


def create_app(
    settings: Settings | None = None,
    store: AccessControlStore | None = None,
    iap_verifier: IapVerifier = google_iap_verifier,
) -> FastAPI:
    settings = settings or Settings()
    settings.check()

    app = FastAPI(
        title="Access Control API",
        description="Manage who can see which data in the Roller analytics agent.",
        docs_url=None,
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.iap_verifier = iap_verifier
    app.state.service = AccessControlService(
        store or create_store(settings), DomainCatalog.from_file(settings.domains_file)
    )
    log.info(
        "Starting: store=%s auth=%s ui=%s",
        settings.store,
        settings.auth_mode,
        settings.static_dir or "off",
    )

    _add_error_handlers(app)
    _add_security_headers(app, settings)
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.api_route("/healthz", methods=["GET", "HEAD"], include_in_schema=False)
    def healthz() -> PlainTextResponse:
        return PlainTextResponse("ok\n")

    app.include_router(router)
    if settings.static_dir is not None:
        _serve_ui(app, settings.static_dir)
    return app


def _add_error_handlers(app: FastAPI) -> None:
    """Every error is JSON `{ "message": ... }`, which the UI shows to the admin."""

    @app.exception_handler(AccessControlError)
    def access_control_error(_: Request, exc: AccessControlError) -> JSONResponse:
        return JSONResponse({"message": exc.message}, status_code=exc.status_code)

    @app.exception_handler(HTTPException)
    def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse({"message": str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    def request_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
        message = f"Invalid {field}: {first.get('msg', 'bad value')}"
        return JSONResponse({"message": message}, status_code=422)


def _add_security_headers(app: FastAPI, settings: Settings) -> None:
    csp = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        f"img-src 'self' data:; font-src 'self'; connect-src {settings.csp_connect_src}; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        response.headers["Content-Security-Policy"] = csp
        return response


def _serve_ui(app: FastAPI, static_dir: Path) -> None:
    root = static_dir.resolve()
    index = root / "index.html"

    @app.api_route("/config.js", methods=["GET", "HEAD"], include_in_schema=False)
    def runtime_config(request: Request) -> Response:
        # The UI talks to this API; the signed-in admin is the default approver.
        config = {
            "apiMode": "http",
            "apiBaseUrl": "/api",
            "actorEmail": resolve_email(request) or "",
        }
        body = f"window.__APP_CONFIG__ = {json.dumps(config)}\n"
        return Response(
            body, media_type="application/javascript", headers={"Cache-Control": "no-store"}
        )

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def ui(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        file = (root / path).resolve()
        if path and file.is_file() and root in file.parents:
            # Fingerprinted build output can be cached forever; everything else is re-checked.
            immutable = file.parent == root / "assets"
            cache = "public, max-age=31536000, immutable" if immutable else "no-cache"
            return FileResponse(file, headers={"Cache-Control": cache})
        if path.startswith("assets/"):
            raise HTTPException(404, "Not found.")
        # Client-side routes (e.g. /users/123) get the app shell.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
