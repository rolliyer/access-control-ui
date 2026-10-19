"""Who is calling, and are they allowed to administer access?

In production the service sits behind Identity-Aware Proxy (IAP). IAP adds a
signed JWT (`x-goog-iap-jwt-assertion`) to every request; we verify its
signature and audience rather than trusting the plain-text email header,
which anything that bypasses IAP could forge.
"""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status

from .config import Settings

IAP_JWT_HEADER = "x-goog-iap-jwt-assertion"
IAP_CERTS_URL = "https://www.gstatic.com/iap/verify/public_key"

# (token, audience) -> claims. Raises ValueError if the token is invalid.
IapVerifier = Callable[[str, str], dict[str, Any]]


def google_iap_verifier(token: str, audience: str) -> dict[str, Any]:
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_token(
        token, google_requests.Request(), audience=audience, certs_url=IAP_CERTS_URL
    )


def resolve_email(request: Request) -> str | None:
    """The caller's email, or None if they are not authenticated."""
    settings: Settings = request.app.state.settings
    if settings.auth_mode == "dev":
        return settings.dev_user_email.strip().lower()

    token = request.headers.get(IAP_JWT_HEADER)
    if not token or not settings.iap_audience:
        return None
    verifier: IapVerifier = request.app.state.iap_verifier
    try:
        claims = verifier(token, settings.iap_audience)
    except ValueError:
        return None
    email = claims.get("email")
    return email.strip().lower() if isinstance(email, str) and email.strip() else None


def require_admin(request: Request) -> str:
    """FastAPI dependency: the admin's email, or 401/403."""
    email = resolve_email(request)
    if email is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in through IAP to use this API.")
    admins = request.app.state.settings.admin_email_set
    if admins and email not in admins:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{email} is not an access-control admin.")
    return email


Admin = Annotated[str, Depends(require_admin)]
