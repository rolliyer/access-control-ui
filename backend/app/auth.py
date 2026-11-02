"""Who is calling, and what may they administer?

Two kinds of admin:
  * global admins (ADMIN_EMAILS): manage everything — teams, roles, permissions.
  * team admins (the team_admins table): manage their own team's groups.

In production the service sits behind Identity-Aware Proxy (IAP). IAP adds a
signed JWT (`x-goog-iap-jwt-assertion`) to every request; we verify its
signature and audience rather than trusting the plain-text email header,
which anything that bypasses IAP could forge.
"""

from collections.abc import Callable
from dataclasses import dataclass
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


@dataclass(frozen=True)
class Actor:
    """The signed-in admin."""

    email: str
    is_global_admin: bool
    # Teams this person administers (as a team admin).
    team_ids: frozenset[str] = frozenset()

    def can_manage_team(self, team_id: str | None) -> bool:
        return self.is_global_admin or (team_id is not None and team_id in self.team_ids)


def require_admin(request: Request) -> Actor:
    """FastAPI dependency: the signed-in admin, or 401/403."""
    email = resolve_email(request)
    if email is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in through IAP to use this API.")
    # An empty ADMIN_EMAILS makes everyone a global admin (local development only).
    admins = request.app.state.settings.admin_email_set
    if not admins or email in admins:
        return Actor(email=email, is_global_admin=True)
    team_ids = request.app.state.service.admin_team_ids(email)
    if not team_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"{email} is not an access-control admin.")
    return Actor(email=email, is_global_admin=False, team_ids=team_ids)


Admin = Annotated[Actor, Depends(require_admin)]
