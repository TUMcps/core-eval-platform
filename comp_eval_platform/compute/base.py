"""ComputeBackend interface + selection.

A worker is a ``Node`` row (the generic host table). Backends differ only in the
three lifecycle methods; per-step execution is backend-agnostic (every script
SSHes to ``ubuntu@<ip>``). Selected by the ``execution_backend`` runtime setting.
"""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from comp_eval_platform.core.models import Node


class ComputeBackend(ABC):
    name: str

    @abstractmethod
    def sync_instances(self) -> None:
        """Reconcile Node rows with reality (create/update/delete, set reachability)."""

    @abstractmethod
    def provision(self, node_type: str, image: str, eni: Optional[str] = None) -> bool:
        """Start a new worker of the given type/image. ``image`` is an AMI id (aws)
        or a Docker image ref (local_docker). Returns True on success."""

    @abstractmethod
    def terminate(self, node: "Node") -> None:
        """Tear down the worker backing this row (best-effort)."""


_REGISTRY: dict = {}


def _registry() -> dict:
    # Lazy import so Django apps are loaded before backends touch models.
    if not _REGISTRY:
        from .aws import AwsBackend
        from .local_docker import LocalDockerBackend

        for cls in (AwsBackend, LocalDockerBackend):
            _REGISTRY[cls.name] = cls
    return _REGISTRY


def get_backend() -> ComputeBackend:
    """The backend selected by the ``execution_backend`` runtime setting."""
    from comp_eval_platform.core.models import RuntimeSettings

    name = RuntimeSettings.get().execution_backend
    reg = _registry()
    return reg.get(name, reg["local_docker"])()
