"""Validation rules from the access-control guide.

Kept in step with frontend/src/domain/validation.ts and grants.ts: the UI
checks these for fast feedback, the API enforces them.
"""

import re
from datetime import datetime

from .models import GroupMember, UserRole

EMAIL_DOMAIN = "@rollerdigital.com"
_EMAIL = re.compile(r"^[a-z0-9._%+-]+@rollerdigital\.com$")
_KEY = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")

# Special capabilities: features of the agent's code, not metric folders.
TIERS = frozenset({"exploratory", "looker"})


def normalize_email(email: str) -> str:
    """Emails must equal the Entra sign-in name: lowercase, trimmed."""
    return email.strip().lower()


def email_error(email: str) -> str | None:
    value = normalize_email(email)
    if not value:
        return "Email is required."
    if not value.endswith(EMAIL_DOMAIN):
        return f"Only {EMAIL_DOMAIN} addresses are allowed."
    if not _EMAIL.match(value):
        return "Enter a valid email address."
    return None


def required_error(value: str | None, label: str) -> str | None:
    return None if value and value.strip() else f"{label} is required."


def key_error(key: str, label: str = "Role key", example: str = "support_analyst") -> str | None:
    """Role, team and group keys: lowercase words joined with underscores."""
    if not key.strip():
        return f"{label} is required."
    if not _KEY.match(key):
        return f"Use lowercase words joined with underscores, e.g. {example}."
    return None


def role_key_error(role_key: str) -> str | None:
    return key_error(role_key)


def grantor_error(granted_by: str, grantee_email: str) -> str | None:
    if error := email_error(granted_by):
        return error
    if normalize_email(granted_by) == normalize_email(grantee_email):
        return "The approver cannot be the person receiving access."
    return None


def grant_dates_error(granted_at: datetime, expires_at: datetime | None) -> str | None:
    if expires_at is None or expires_at > granted_at:
        return None
    return "Expiry must be after the start date."


def is_grant_open(grant: UserRole, now: datetime) -> bool:
    """Active or not started yet — i.e. still revocable, and blocks a duplicate grant."""
    if grant.revoked_at is not None:
        return False
    return grant.expires_at is None or grant.expires_at > now


def is_membership_open(member: GroupMember, now: datetime) -> bool:
    """Active or not started yet — still removable, and blocks adding the person twice."""
    if member.removed_at is not None:
        return False
    return member.expires_at is None or member.expires_at > now


def clean(value: str | None) -> str | None:
    """Trim; empty becomes None (stored as NULL)."""
    if value is None:
        return None
    value = value.strip()
    return value or None
