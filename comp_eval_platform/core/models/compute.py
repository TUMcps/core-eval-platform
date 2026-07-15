"""The worker/node table — the generic host a submission runs on.

One row per worker, populated by the active ``ComputeBackend`` (EC2 instances for
aws, containers for local_docker). Per-step scripts only need a reachable
``ubuntu@ip`` SSH host, so backends differ solely in lifecycle (sync/provision/
terminate); everything downstream reads this table.
"""
from django.db import models
from django.utils import timezone


class Node(models.Model):
    #: Backend-assigned id (EC2 instance id, or container id/name).
    id = models.CharField(max_length=255, primary_key=True)
    created_at = models.DateTimeField(default=timezone.now)
    #: Hardware/size hint the backend interprets (e.g. "t2.large", or "local").
    node_type = models.CharField(max_length=64, default="local")
    #: Base image: AMI id (aws) or Docker image ref (local_docker).
    image = models.CharField(max_length=255, blank=True)
    state = models.CharField(max_length=50, blank=True)
    reachability = models.CharField(max_length=50, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    task = models.ForeignKey(
        "core.Task", on_delete=models.SET_NULL, null=True, blank=True, related_name="nodes",
    )

    class Meta:
        db_table = "core_node"

    def __str__(self):
        return f"{self.id}: {self.node_type} {self.ip} ({self.state}, {self.reachability})"

    def is_available(self) -> bool:
        return self.state == "running" and self.reachability == "ok" and bool(self.ip)

    def terminate(self) -> None:
        """Bank this node's runtime onto its task, then tear it down via the backend."""
        from comp_eval_platform.compute import get_backend

        duration = (timezone.now() - self.created_at).total_seconds()
        if self.task is not None:
            self.task.total_runtime = int(duration)
            self.task.save(update_fields=["total_runtime"])
        get_backend().terminate(self)

    @classmethod
    def get_next_available(cls, node_type: str, image: str):
        """A free, reachable node of the given type/image (or None)."""
        return (
            cls.objects.filter(
                state="running", reachability="ok", task__isnull=True,
                node_type=node_type, image=image,
            )
            .exclude(ip__isnull=True)
            .first()
        )
