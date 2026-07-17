"""AWS EC2 backend. Lifecycle shells out to the aws-cli scripts; per-step
execution is untouched (steps SSH to the node IP). Ported from VNN onto ``Node``;
``node_type`` is now the EC2 type string directly (e.g. "t2.large").
"""
import json
from typing import List, Optional

from django.utils import timezone

from .base import ComputeBackend, ProvisionError
from .shell import ScriptError, _get, service_id

SERVICE_ID_TAG = "VNNCompServiceId"


def _tags(instance: dict) -> dict:
    return {t["Key"]: t.get("Value", "") for t in instance.get("Tags") or []}


class AwsBackend(ComputeBackend):
    name = "aws"

    def sync_instances(self) -> None:
        from comp_eval_platform.core.models import Node

        sid = service_id()
        seen: List[Node] = []
        foreign = 0
        for instance in json.loads(_get("", "list_running_instances.sh")):
            state = instance["State"]["Name"]
            if state == "terminated":
                continue
            tags = _tags(instance)
            if "IgnoreForVNNComp" in tags:
                continue
            try:
                node = Node.objects.get(id=instance["Id"])
            except Node.DoesNotExist:
                node = None

            is_ours = tags.get(SERVICE_ID_TAG) == sid
            is_assigned = node is not None and node.task_id is not None
            if not is_ours and not is_assigned:
                if state == "running":
                    foreign += 1
                continue

            if node is None:
                node = Node.objects.create(
                    id=instance["Id"], created_at=timezone.now(), node_type=instance["Type"],
                    image=instance["Ami"], state=state, reachability="none", ip=instance["Ip"] or None,
                )
            else:
                node.state = state
                node.ip = instance["Ip"] or node.ip
            seen.append(node)

        if foreign:
            print(f"WARNING: {foreign} running AWS instance(s) not owned by this service ({sid}); not managed.")

        seen_ids = {n.id for n in seen}
        for node in Node.objects.all():
            if node.id not in seen_ids:
                print("Deleting node", node)
                node.delete()

        for status in json.loads(_get("", "list_instance_status.sh")).get("InstanceStatuses", []):
            for node in seen:
                if node.id == status["InstanceId"]:
                    node.reachability = status["InstanceStatus"]["Status"]

        for node in seen:
            node.save()

    def provision(self, node_type: str, image: str, eni: Optional[str] = None) -> None:
        params = {"type": node_type, "ami": image, "vnncomp_service_id": service_id()}
        try:
            if eni is None:
                _get("toolkit", "create_new_instance.sh", params)
            else:
                _get("toolkit", "create_new_instance_with_eni.sh", {**params, "eni": eni})
        except ScriptError as exc:
            raise ProvisionError(f"could not start a {node_type} instance from {image!r}: {exc}") from exc

    def terminate(self, node) -> None:
        try:
            _get("", "terminate_instance.sh", {"id": node.id})
        except ScriptError as exc:
            print(f"AwsBackend.terminate failed (ignored): {exc}")
