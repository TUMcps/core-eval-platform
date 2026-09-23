"""Which host GPUs a job container is given."""
import pytest

from comp_eval_platform.compute.base import gpu_run_args


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("COMP_DOCKER_GPU", raising=False)
    monkeypatch.delenv("COMP_DOCKER_GPU_DEVICES", raising=False)


def test_no_gpus_unless_asked():
    assert gpu_run_args("local") == []


def test_every_gpu_by_default(monkeypatch):
    monkeypatch.setenv("COMP_DOCKER_GPU", "all")
    assert gpu_run_args("local") == ["--gpus", "all"]


def test_gpu_node_type_gets_gpus_without_the_switch():
    assert gpu_run_args("g5.8xlarge") == ["--gpus", "all"]


@pytest.mark.parametrize("devices, flag", [("1", '"device=1"'), (" 0,1 ", '"device=0,1"')])
def test_devices_pick_host_gpus(monkeypatch, devices, flag):
    monkeypatch.setenv("COMP_DOCKER_GPU", "1")
    monkeypatch.setenv("COMP_DOCKER_GPU_DEVICES", devices)
    assert gpu_run_args("local") == ["--gpus", flag]


def test_devices_alone_do_not_switch_gpus_on(monkeypatch):
    monkeypatch.setenv("COMP_DOCKER_GPU_DEVICES", "1")
    assert gpu_run_args("local") == []
