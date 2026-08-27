import uuid
import uuid as _uuid

from .base import ComputeBackend


class LocalBackend(ComputeBackend):
    name = "local"

    def resolve_image(self, image: str) -> str:
        return image or "local"

    def provision(self, node_type: str, image: str, eni=None, owner=None) -> None:
        from comp_eval_platform.core.models import Node
        from django.utils import timezone

        Node.objects.create(
            id=_uuid.uuid4(),
            node_type=node_type or "local",
            image=image or "local",
            state="running",
            reachability="ok",
            ip="localhost",
            created_at=timezone.now(),
        )

    def sync_instances(self) -> None:
        pass

    def terminate(self, node) -> None:
        node.delete()
