"""LocalDockerBackend: image validity and reaping containers no Node row tracks.

The docker CLI is stubbed — these assert which containers we decide to remove, which
is the part worth being sure about.
"""
import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def backend():
    from comp_eval_platform.compute.local_docker import LocalDockerBackend

    return LocalDockerBackend()


def _stub_docker(monkeypatch, running, *, age="2026-01-01T00:00:00.000000000Z"):
    """Stub the docker CLI; returns the list of removed container ids."""
    from comp_eval_platform.compute import local_docker

    removed = []

    def fake(args, **kwargs):
        if args[0] == "ps":
            return "\n".join(running)
        if args[0] == "inspect":
            return age
        if args[0] == "rm":
            removed.append(args[-1])
            return ""
        return ""

    monkeypatch.setattr(local_docker, "_docker", fake)
    return removed


def test_reaps_a_container_without_a_node_row(backend, monkeypatch):
    removed = _stub_docker(monkeypatch, ["leaked1"])

    backend._reap_untracked()

    assert removed == ["leaked1"]


def test_never_reaps_a_container_a_node_row_tracks(backend, monkeypatch):
    from comp_eval_platform.core.models import Node

    Node.objects.create(id="live1", node_type="local", image="ubuntu:22.04",
                        state="running", reachability="ok", ip="10.0.0.2")
    removed = _stub_docker(monkeypatch, ["live1", "leaked1"])

    backend._reap_untracked()

    assert removed == ["leaked1"]  # the tracked node is untouched


def test_spares_a_container_too_young_to_be_leaked(backend, monkeypatch):
    """provision() creates the container before its row, so a fresh untracked one may
    just be a concurrent provision that has not written the row yet."""
    from django.utils import timezone

    now = timezone.now().strftime("%Y-%m-%dT%H:%M:%S.000000000Z")
    removed = _stub_docker(monkeypatch, ["justborn"], age=now)

    backend._reap_untracked()

    assert removed == []


def test_unreadable_start_time_is_never_reaped(backend, monkeypatch):
    removed = _stub_docker(monkeypatch, ["weird"], age="")

    backend._reap_untracked()

    assert removed == []


def test_resolve_image_rejects_an_ami_id(backend):
    from comp_eval_platform.compute.base import ImageError

    with pytest.raises(ImageError, match="ami-123"):
        backend.resolve_image("ami-123")


def test_resolve_image_defaults_when_none_requested(backend):
    assert backend.resolve_image("") == "ubuntu:22.04"
    assert backend.resolve_image("myrepo/tool:v1") == "myrepo/tool:v1"
