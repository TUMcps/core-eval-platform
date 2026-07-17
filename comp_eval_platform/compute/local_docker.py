"""Local Docker backend: run each submission in a container on the backend host.

A container is made to look exactly like an EC2 node (SSH-reachable ``ubuntu``
user with our key) so every per-step script works unchanged. Only the lifecycle
(run / inspect / rm) is Docker-specific. Requires the host Docker socket mounted
and the ``docker`` CLI on PATH. Ported from VNN onto the ``Node`` model.
"""
import os
import subprocess
import uuid
from typing import List, Optional

from django.utils import timezone

from .base import ComputeBackend, ImageError, ProvisionError
from .shell import service_id

SERVICE_LABEL = "VNNCompServiceId"
READY_MARKER = "/tmp/vnncomp_ready"
_GPU_TYPES = {"p3.2xlarge", "g5.8xlarge"}


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


class DockerError(Exception):
    pass


def _docker(args: List[str], *, timeout: int = 60, check: bool = True) -> str:
    proc = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise DockerError(f"docker {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


class LocalDockerBackend(ComputeBackend):
    name = "local_docker"

    @property
    def network(self) -> str:
        return _env("VNNCOMP_DOCKER_NETWORK", "eval-platform_default")

    @property
    def ssh_key(self) -> str:
        return _env("VNNCOMP_DOCKER_SSH_KEY", "/root/.ssh/vnncomp.pem")

    def resolve_image(self, image: str) -> str:
        """No image requested -> the platform default. An AMI id is an EC2 image and
        cannot be booted here: reject it instead of silently substituting the default,
        which would run the submission against an image nobody asked for."""
        if not image:
            return _env("VNNCOMP_DEFAULT_DOCKER_IMAGE", "ubuntu:22.04")
        if image.startswith("ami-"):
            raise ImageError(
                f"{image!r} is an AWS AMI id, but this deployment runs submissions in "
                f"local Docker. Submit a Docker image reference (e.g. 'ubuntu:22.04') "
                f"instead, or switch the execution backend to aws."
            )
        return image

    def _public_key(self) -> str:
        proc = subprocess.run(["ssh-keygen", "-y", "-f", self.ssh_key], capture_output=True, text=True, timeout=15)
        if proc.returncode != 0:
            raise DockerError(f"Cannot read SSH key {self.ssh_key}: {proc.stderr.strip()}")
        return proc.stdout.strip()

    # -- lifecycle --------------------------------------------------------
    def provision(self, node_type: str, image: str, eni=None) -> None:
        try:
            name = f"{_env('VNNCOMP_DOCKER_NAME_PREFIX', 'eval')}-{uuid.uuid4().hex[:12]}"
            run_args = [
                "run", "-d", "--name", name,
                "--label", f"{SERVICE_LABEL}={service_id()}",
                "--label", "VNNCompManaged=true",
                "--network", self.network,
                "--entrypoint", "sleep",
            ]
            gpu_env = _env("VNNCOMP_DOCKER_GPU", "").lower() in ("1", "true", "all", "yes")
            if gpu_env or node_type in _GPU_TYPES:
                run_args += ["--gpus", "all"]
            run_args += [image, "infinity"]
            container_id = _docker(run_args, timeout=120).strip()

            ip = self._container_ip(container_id)
            # Docker recycles IPs; drop any stale host key so accept-new works.
            if ip:
                subprocess.run(["ssh-keygen", "-R", ip], capture_output=True, timeout=15)
            self._start_bootstrap(container_id)

            from comp_eval_platform.core.models import Node

            Node.objects.create(
                id=container_id, created_at=timezone.now(), node_type=node_type or "local",
                image=image, state="running", reachability="none", ip=ip or None,
            )
        except (DockerError, subprocess.SubprocessError) as exc:
            raise ProvisionError(f"could not start a container from image {image!r}: {exc}") from exc

    def sync_instances(self) -> None:
        from comp_eval_platform.core.models import Node

        for node in Node.objects.all():
            state = self._container_state(node.id)
            if state is None:
                print("Deleting node (container gone)", node)
                node.delete()
                continue
            node.state = state
            node.ip = self._container_ip(node.id) or node.ip
            if state == "running" and self._is_ready(node.id):
                node.reachability = "ok"
            node.save()

    def terminate(self, node) -> None:
        _docker(["rm", "-f", node.id], timeout=60, check=False)

    # -- docker helpers ---------------------------------------------------
    def _container_ip(self, container_id: str) -> str:
        try:
            out = _docker([
                "inspect", "-f",
                "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
                container_id,
            ], timeout=15)
            return out.strip()
        except DockerError:
            return ""

    def _container_state(self, container_id: str) -> Optional[str]:
        try:
            out = _docker(["inspect", "-f", "{{.State.Status}}", container_id], timeout=15, check=False).strip()
        except subprocess.SubprocessError:
            return None
        return out or None

    def _is_ready(self, container_id: str) -> bool:
        proc = subprocess.run(
            ["docker", "exec", container_id, "test", "-f", READY_MARKER],
            capture_output=True, text=True, timeout=15,
        )
        return proc.returncode == 0

    def _start_bootstrap(self, container_id: str) -> None:
        root = os.getenv("SCRIPT_ROOT") or os.getenv("AWS_SCRIPT_ROOT") or os.getcwd()
        script = os.path.join(root, "scripts", "docker", "bootstrap_node.sh")
        _docker(["cp", script, f"{container_id}:/tmp/bootstrap_node.sh"], timeout=30)
        _docker([
            "exec", "-d", "-u", "0",
            "-e", f"AUTHORIZED_KEY={self._public_key()}",
            container_id, "bash", "/tmp/bootstrap_node.sh",
        ], timeout=30)
