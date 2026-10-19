from ..config import Settings
from .base import AccessControlStore
from .memory import MemoryStore


def create_store(settings: Settings) -> AccessControlStore:
    if settings.store == "bigquery":
        from .bigquery import BigQueryStore  # imported lazily: needs GCP credentials

        assert settings.bq_project  # checked by Settings.check()
        return BigQueryStore(settings.bq_project, settings.bq_dataset)
    return MemoryStore.seeded()


__all__ = ["AccessControlStore", "MemoryStore", "create_store"]
