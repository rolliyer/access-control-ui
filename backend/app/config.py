"""Settings, read from environment variables (see README "Backend settings")."""

import os
from functools import cached_property
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class ConfigError(RuntimeError):
    """Settings that would make the service unsafe or unable to start."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    # Where data lives: "memory" (sample data, resets on restart) or "bigquery".
    store: Literal["memory", "bigquery"] = "memory"
    bq_project: str | None = None
    bq_dataset: str = "roller_analytics_agent_access_control"

    # Who is calling: "iap" verifies Identity-Aware Proxy's signed header;
    # "dev" trusts DEV_USER_EMAIL and is for local development only.
    auth_mode: Literal["iap", "dev"] = "iap"
    iap_audience: str | None = None
    dev_user_email: str = "sridhar.iyer@rollerdigital.com"
    # Comma-separated. Empty = anyone IAP lets through is an admin.
    admin_emails: str = ""

    # Metric domains (written by `npm run sync:domains` in frontend/).
    domains_file: Path = REPO_ROOT / "frontend/src/api/mock/domains.generated.json"
    # Built UI to serve. Unset = API only (e.g. while running `npm run dev`).
    static_dir: Path | None = None
    csp_connect_src: str = "'self'"

    @cached_property
    def admin_email_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.admin_emails.split(",") if e.strip())

    def check(self) -> None:
        """Refuse configurations that are unsafe or incomplete."""
        if self.store == "bigquery" and not self.bq_project:
            raise ConfigError("STORE=bigquery needs BQ_PROJECT.")
        if self.auth_mode == "iap" and not self.iap_audience:
            raise ConfigError(
                "AUTH_MODE=iap needs IAP_AUDIENCE, e.g. "
                "/projects/<PROJECT_NUMBER>/locations/<REGION>/services/access-control-ui. "
                "For local development set AUTH_MODE=dev."
            )
        if self.auth_mode == "dev" and os.environ.get("K_SERVICE"):
            # K_SERVICE is set by Cloud Run. Dev auth trusts everyone as one admin.
            raise ConfigError("AUTH_MODE=dev is not allowed on Cloud Run. Use AUTH_MODE=iap.")
        if self.static_dir is not None and not (self.static_dir / "index.html").is_file():
            raise ConfigError(f"STATIC_DIR={self.static_dir} has no index.html.")
