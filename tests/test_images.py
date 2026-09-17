"""Background image pulls: provisioning never waits on a download."""
import subprocess

import pytest

from comp_eval_platform.compute import images
from comp_eval_platform.compute.base import ProvisionPending


class _Pull:
    """A stand-in for the ``docker pull`` process."""

    def __init__(self, returncode=None, stderr=""):
        self.returncode = returncode
        self.stderr = type("S", (), {"read": staticmethod(lambda: stderr)})()

    def poll(self):
        return self.returncode


@pytest.fixture
def docker(monkeypatch):
    """Fake ``docker image inspect`` (``present``) and ``docker pull`` (``started``)."""
    state = {"present": False, "started": []}

    def run(args, **_kwargs):
        assert args[:3] == ["docker", "image", "inspect"]
        return subprocess.CompletedProcess(args, 0 if state["present"] else 1)

    def popen(args, **_kwargs):
        state["started"].append(args)
        return _Pull()

    monkeypatch.setattr(images.subprocess, "run", run)
    monkeypatch.setattr(images.subprocess, "Popen", popen)
    monkeypatch.setattr(images, "_pulls", {})
    return state


def test_present_image_needs_no_pull(docker):
    docker["present"] = True
    images.ensure_image("ubuntu:22.04")
    assert docker["started"] == []


def test_missing_image_is_pulled_once_while_pending(docker):
    for _ in range(3):
        with pytest.raises(ProvisionPending, match="big:latest"):
            images.ensure_image("big:latest")
    assert docker["started"] == [["docker", "pull", "big:latest"]]


def test_failed_pull_is_reported_then_retried(docker):
    images._pulls["nope:1"] = _Pull(returncode=1, stderr="manifest unknown")
    with pytest.raises(RuntimeError, match="manifest unknown"):
        images.ensure_image("nope:1")
    with pytest.raises(ProvisionPending):
        images.ensure_image("nope:1")
    assert docker["started"] == [["docker", "pull", "nope:1"]]


def test_remote_backend_turns_a_pending_reply_into_provision_pending(monkeypatch):
    from comp_eval_platform.compute import remote_docker

    monkeypatch.setattr(remote_docker, "_json_request",
                        lambda *a, **k: {"pending": "downloading image big:latest"})
    monkeypatch.setattr(remote_docker.RemoteDockerBackend, "_public_key", lambda self: "ssh-ed25519 AAAA")
    monkeypatch.setattr(remote_docker, "service_id", lambda: "svc")
    backend = remote_docker.RemoteDockerBackend()
    monkeypatch.setattr(backend, "worker_service_url_for_user", lambda _u: "http://worker:9001")
    with pytest.raises(ProvisionPending, match="big:latest"):
        backend.provision("local", "big:latest")
