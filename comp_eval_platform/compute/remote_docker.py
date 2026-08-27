"""Remote Docker backend."""
import json
from datetime import datetime
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.utils import timezone
# Updated import: Inheriting from BaseDockerBackend
from .base import BaseDockerBackend, ProvisionError
from .shell import service_id


def _base_url(host: str, port: int | None) -> str:
    """
    Constructs and returns a properly formatted base URL from the given host and port.
    Ensures the URL has a scheme (defaults to http) and no trailing slashes.
    """
    host = (host or "").strip()
    if host.startswith(("http://", "https://")):
        return host.rstrip("/")
    return f"http://{host}:{port}" if port else f"http://{host}"


def _json_request(base_url: str, path: str, payload: dict | None = None, *, timeout: int = 30) -> dict:
    """
    Sends a JSON HTTP request (POST if payload exists, otherwise GET) to the remote worker service.
    
    Args:
        base_url: The base URL of the remote service.
        path: The API endpoint path.
        payload: Optional dictionary payload to send as JSON.
        timeout: Request timeout in seconds.
        
    Returns:
        The parsed JSON response as a dictionary.
        
    Raises:
        ProvisionError: If the HTTP request fails, times out, or returns invalid JSON.
    """
    data = json.dumps(payload or {}).encode("utf-8") if payload is not None else None
    url = f"{base_url.rstrip('/')}{path}"
    req = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST" if payload is not None else "GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ProvisionError(f"remote worker service {url} failed: {exc}") from exc


class RemoteDockerBackend(BaseDockerBackend):
    """Remote Docker compute backend, leveraging shared helpers from BaseDockerBackend."""
    name = "remote_docker"

    # Overrides the error message generator from BaseDockerBackend.
    # The common resolve_image logic is now inherited, eliminating code duplication.
    def image_error_message(self, image: str) -> str:
        """Remote Docker specific error message when an invalid AWS AMI is requested."""
        return "AWS AMI ids cannot run on remote Docker; submit a Docker image reference instead."

    def worker_service_url_for_user(self, user) -> str:
        """
        Retrieves the worker service URL for a specific user, falling back to Django settings.
        """
        host = getattr(user, "worker_service_url", "") or getattr(settings, "REMOTE_DOCKER_WORKER_URL", "localhost")
        port = getattr(user, "worker_service_port", None) or getattr(settings, "REMOTE_DOCKER_WORKER_PORT", 9001)
        return _base_url(host, port)

    def _all_service_urls(self) -> list[str]:
        """
        Aggregates and returns a unique list of all active remote worker service URLs 
        defined in the system (from settings, users, and existing nodes).
        """
        from comp_eval_platform.core.models import Node, User

        urls = {self.worker_service_url_for_user(None)}
        for user in User.objects.exclude(worker_service_url__isnull=True).exclude(worker_service_url=""):
            urls.add(self.worker_service_url_for_user(user))
        for node_url in Node.objects.exclude(worker_service_url__isnull=True).exclude(worker_service_url="").values_list("worker_service_url", flat=True):
            urls.add(node_url)
        return sorted(urls)

    def provision(self, node_type: str, image: str, eni: Optional[str] = None, owner=None) -> None:
        """
        Provisions a new Docker container on the remote worker service and creates a local Node record.
        """
        from comp_eval_platform.core.models import Node

        base_url = self.worker_service_url_for_user(owner)
        # Using the inherited _public_key() method from BaseDockerBackend instead of local instantiation workaround
        response = _json_request(base_url, "/provision", {"service_id": service_id(), "node_type": node_type, "image": image, "authorized_key": self._public_key(), "eni": eni})
        Node.objects.create(id=response["id"], created_at=self._parse_timestamp(response.get("created_at")) or timezone.now(), node_type=response.get("node_type") or node_type or "local", image=response.get("image") or image, worker_service_url=base_url, state=response.get("state") or "running", reachability=response.get("reachability") or "none", ip=response.get("ip") or None)

    def sync_instances(self) -> None:
        """Synchronise the local Node database with the actual containers running on each worker service.

        For every known worker service URL, fetches the list of live containers and reconciles
        them against the Node table:
        - Nodes reported by the worker are created or updated in the database.
        - Nodes that are no longer reported by the worker are deleted from the database.
        - The worker is asked to reap any containers it manages that are not tracked by this backend.
        """
        from comp_eval_platform.core.models import Node

        for base_url in self._all_service_urls():
            # Fetch the current list of containers from this worker service.
            # If the worker is unreachable, skip it and continue with the next URL.
            try:
                response = _json_request(base_url, f"/nodes?{urlencode({'service_id': service_id()})}")
            except ProvisionError as exc:
                print(f"RemoteDockerBackend.sync_instances skipped {base_url}: {exc}")
                continue

            seen: set[str] = set()

            for row in response.get("nodes", []):
                seen.add(row["id"])

                # Create a new Node row if this container is not yet in the database,
                # or update the existing row with the latest state reported by the worker.
                node, created = Node.objects.get_or_create(
                    id=row["id"],
                    defaults={
                        "created_at": self._parse_timestamp(row.get("created_at")) or timezone.now(),
                        "node_type": row.get("node_type") or "local",
                        "image": row.get("image") or "",
                        "worker_service_url": base_url,
                        "state": row.get("state") or "",
                        "reachability": row.get("reachability") or "",
                        "ip": row.get("ip") or None,
                    },
                )
                if not created:
                    # Keep the stored record in sync with what the worker actually sees.
                    node.worker_service_url = base_url
                    node.node_type = row.get("node_type") or node.node_type
                    node.image = row.get("image") or node.image
                    node.state = row.get("state") or node.state
                    node.reachability = row.get("reachability") or node.reachability
                    node.ip = row.get("ip") or node.ip
                    node.save(update_fields=[
                        "worker_service_url", "node_type", "image",
                        "state", "reachability", "ip",
                    ])

            # Remove any Node rows whose containers were not reported by this worker —
            # they have been terminated externally or lost.
            for node in Node.objects.filter(worker_service_url=base_url):
                if node.id not in seen:
                    node.delete()

            # Ask the worker to clean up containers it manages that this backend
            # no longer tracks (e.g. orphans from a previous backend instance).
            _json_request(base_url, "/reap", {
                "service_id": service_id(),
                "tracked_ids": sorted(seen),
            })

    def terminate(self, node) -> None:
        """
        Sends a termination request to the remote worker service to stop and remove the specified container.
        """
        base_url = node.worker_service_url or self.worker_service_url_for_user(None)
        _json_request(base_url, "/terminate", {"container_id": node.id})

    @staticmethod
    def _parse_timestamp(value: str | None):
        """
        Parses an ISO format timestamp string into a datetime object, handling timezone 'Z' notation.
        """
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
