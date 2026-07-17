"""ComputeBackend interface + selection.

A worker is a ``Node`` row (the generic host table). Backends differ only in the
three lifecycle methods; per-step execution is backend-agnostic (every script
SSHes to ``ubuntu@<ip>``). Selected by the ``execution_backend`` runtime setting.
"""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from comp_eval_platform.core.models import Node


class ImageError(Exception):
    """The requested base image is not something this backend can boot."""


class ProvisionError(Exception):
    """Starting a worker failed; the message is shown to the submitter."""


class ComputeBackend(ABC):
    name: str

    @abstractmethod
    def sync_instances(self) -> None:
        """Reconcile Node rows with reality (create/update/delete, set reachability)."""

    @abstractmethod
    def provision(self, node_type: str, image: str, eni: Optional[str] = None) -> None:
        """Start a new worker of the given type/image. ``image`` is an AMI id (aws) or
        a Docker image ref (local_docker), already passed through ``resolve_image``.
        Raises ProvisionError (with the backend's own error) if the worker cannot start
        — a submission that cannot run must fail loudly rather than wait forever."""

    @abstractmethod
    def terminate(self, node: "Node") -> None:
        """Tear down the worker backing this row (best-effort)."""

    def resolve_image(self, image: str) -> str:
        """The image this backend will actually boot for ``image``, raising ImageError
        if it cannot boot it at all. Node rows store the resolved value, so callers must
        match on this rather than on the raw request, or a node can never be matched
        back to the task that asked for it."""
        return image


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
