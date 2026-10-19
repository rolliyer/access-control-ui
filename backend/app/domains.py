"""The metric-domain catalogue.

A domain is a folder under semantic/metrics/ in bapps-edp-analytics-mcp.
`npm run sync:domains` (frontend/) writes them to a JSON file; the backend
serves that file. The Docker image bakes it in at build time.
"""

import json
from pathlib import Path

from .models import Domain


class DomainCatalog:
    def __init__(self, domains: list[Domain]):
        self._domains = sorted(domains, key=lambda d: d.label)
        self._keys = frozenset(d.key for d in domains)

    @classmethod
    def from_file(cls, path: Path) -> "DomainCatalog":
        return cls([Domain.model_validate(item) for item in json.loads(path.read_text())])

    def all(self) -> list[Domain]:
        return list(self._domains)

    def has(self, key: str) -> bool:
        return key in self._keys
