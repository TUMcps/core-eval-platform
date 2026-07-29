"""Remote Docker backend."""
import json
from datetime import datetime
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone

from .base import ComputeBackend, ImageError, ProvisionError
from .shell import service_id


def _base_url(host: str, port: int | None) -> str:
    host = (host or "").strip()
    if host.startswith(("http://", "https://")):
        return host.rstrip("/")
    return f"http://{host}:{port}" if port else f"http://{host}"


def _json_request(base_url: str, path: str, payload: dict | None = None, *, timeout: int = 30) -> dict:
    data = json.dumps(payload or {}).encode("utf-8") if payload is not None else None
    url = f"{base_url.rstrip('/')}{path}"
    req = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST" if payload is not None else "GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ProvisionError(f"remote worker service {url} failed: {exc}") from exc


class RemoteDockerBackend(ComputeBackend):
    name = "remote_docker"

    def resolve_image(self, image: str) -> str:
        if not image:
            return "ubuntu:22.04"
        if image.startswith("ami-"):
            raise ImageError("AWS AMI ids cannot run on remote Docker; submit a Docker image reference instead.")
        return image

    def worker_service_url_for_user(self, user) -> str:
        host = getattr(user, "worker_service_url", "") or getattr(settings, "REMOTE_DOCKER_WORKER_URL", "localhost")
        port = getattr(user, "worker_service_port", None) or getattr(settings, "REMOTE_DOCKER_WORKER_PORT", 9001)
        return _base_url(host, port)

    def _all_service_urls(self) -> list[str]:
        from comp_eval_platform.core.models import Node, User

        urls = {self.worker_service_url_for_user(None)}
        for user in User.objects.exclude(worker_service_url__isnull=True).exclude(worker_service_url=""):
            urls.add(self.worker_service_url_for_user(user))
        for node_url in Node.objects.exclude(worker_service_url__isnull=True).exclude(worker_service_url="").values_list("worker_service_url", flat=True):
            urls.add(node_url)
        return sorted(urls)

    def provision(self, node_type: str, image: str, eni: Optional[str] = None, owner=None) -> None:
        from comp_eval_platform.core.models import Node

        base_url = self.worker_service_url_for_user(owner)
        response = _json_request(base_url, "/provision", {"service_id": service_id(), "node_type": node_type, "image": image, "authorized_key": self._public_key(), "eni": eni})
        Node.objects.create(id=response["id"], created_at=self._parse_timestamp(response.get("created_at")) or timezone.now(), node_type=response.get("node_type") or node_type or "local", image=response.get("image") or image, worker_service_url=base_url, state=response.get("state") or "running", reachability=response.get("reachability") or "none", ip=response.get("ip") or None)

    def sync_instances(self) -> None:
        from comp_eval_platform.core.models import Node

        for base_url in self._all_service_urls():
            try:
                response = _json_request(base_url, f"/nodes?{urlencode({'service_id': service_id()})}")
            except ProvisionError as exc:
                print(f"RemoteDockerBackend.sync_instances skipped {base_url}: {exc}")
                continue
            seen: set[str] = set()
            for row in response.get("nodes", []):
                seen.add(row["id"])
                node, created = Node.objects.get_or_create(id=row["id"], defaults={"created_at": self._parse_timestamp(row.get("created_at")) or timezone.now(), "node_type": row.get("node_type") or "local", "image": row.get("image") or "", "worker_service_url": base_url, "state": row.get("state") or "", "reachability": row.get("reachability") or "", "ip": row.get("ip") or None})
                if not created:
                    node.worker_service_url = base_url
                    node.node_type = row.get("node_type") or node.node_type
                    node.image = row.get("image") or node.image
                    node.state = row.get("state") or node.state
                    node.reachability = row.get("reachability") or node.reachability
                    node.ip = row.get("ip") or node.ip
                    node.save(update_fields=["worker_service_url", "node_type", "image", "state", "reachability", "ip"])
            for node in Node.objects.filter(worker_service_url=base_url):
                if node.id not in seen:
                    node.delete()
            _json_request(base_url, "/reap", {"service_id": service_id(), "tracked_ids": sorted(seen)})

    def terminate(self, node) -> None:
        base_url = node.worker_service_url or self.worker_service_url_for_user(None)
        _json_request(base_url, "/terminate", {"container_id": node.id})

    @staticmethod
    def _parse_timestamp(value: str | None):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    def _public_key(self) -> str:
        from .local_docker import LocalDockerBackend

        return LocalDockerBackend()._public_key()