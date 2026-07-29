"""Worker-server side helpers for remote_docker."""
import json
import os
import re
import subprocess
import uuid
from datetime import datetime
from datetime import timezone as dt_timezone

SERVICE_LABEL = "CompEvalServiceId"
READY_MARKER = "/tmp/vnncomp_ready"
_GPU_TYPES = {"p3.2xlarge", "g5.8xlarge"}
_REAP_GRACE_SECONDS = 300


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


def _docker(args, *, timeout: int = 60, check: bool = True) -> str:
    proc = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise RuntimeError(f"docker {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def _bootstrap_script() -> str:
    for root in (os.getenv("SCRIPT_ROOT"), os.getenv("AWS_SCRIPT_ROOT")):
        if root:
            override = os.path.join(root, "scripts", "docker", "bootstrap_node.sh")
            if os.path.isfile(override):
                return override
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "docker", "bootstrap_node.sh")


def _container_ip(container_id: str) -> str:
    try:
        return _docker(["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", container_id], timeout=15).strip()
    except Exception:
        return ""


def _container_state(container_id: str) -> str:
    try:
        return _docker(["inspect", "-f", "{{.State.Status}}", container_id], timeout=15, check=False).strip()
    except Exception:
        return ""


def _container_labels(container_id: str) -> dict:
    try:
        out = _docker(["inspect", "-f", "{{json .Config.Labels}}", container_id], timeout=15, check=False).strip()
        return json.loads(out) if out else {}
    except Exception:
        return {}


def _container_created_at(container_id: str) -> str:
    return _docker(["inspect", "-f", "{{.State.StartedAt}}", container_id], timeout=15, check=False).strip()


def _container_age(container_id: str) -> float:
    out = _container_created_at(container_id)
    match = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", out)
    if not match:
        return 0.0
    started = datetime.strptime(match.group(1), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=dt_timezone.utc)
    return (datetime.now(dt_timezone.utc) - started).total_seconds()


def _is_ready(container_id: str) -> bool:
    proc = subprocess.run(["docker", "exec", container_id, "test", "-f", READY_MARKER], capture_output=True, text=True, timeout=15)
    return proc.returncode == 0


def provision(*, service_id: str, node_type: str, image: str, authorized_key: str, eni: str | None = None) -> dict:
    name = f"{_env('VNNCOMP_DOCKER_NAME_PREFIX', 'eval')}-{uuid.uuid4().hex[:12]}"
    run_args = [
        "run", "-d", "--name", name,
        "--label", f"{SERVICE_LABEL}={service_id}",
        "--label", "CompEvalManaged=true",
        "--label", f"CompEvalNodeType={node_type}",
        "--label", f"CompEvalImage={image}",
        "--network", _env("VNNCOMP_DOCKER_NETWORK", "eval-platform_default"),
        "--entrypoint", "sleep",
    ]
    gpu_env = _env("VNNCOMP_DOCKER_GPU", "").lower() in ("1", "true", "all", "yes")
    if gpu_env or node_type in _GPU_TYPES:
        run_args += ["--gpus", "all"]
    run_args += [image, "infinity"]
    container_id = _docker(run_args, timeout=120).strip()
    ip = _container_ip(container_id)
    if ip:
        subprocess.run(["ssh-keygen", "-R", ip], capture_output=True, timeout=15)
    script = _bootstrap_script()
    _docker(["cp", script, f"{container_id}:/tmp/bootstrap_node.sh"], timeout=30)
    _docker(["exec", "-d", "-u", "0", "-e", f"AUTHORIZED_KEY={authorized_key}", container_id, "bash", "/tmp/bootstrap_node.sh"], timeout=30)
    return {"id": container_id, "node_type": node_type or "local", "image": image, "state": "running", "reachability": "ok" if _is_ready(container_id) else "none", "ip": ip or None, "created_at": _container_created_at(container_id)}


def list_nodes(*, service_id: str) -> list[dict]:
    out = _docker(["ps", "-q", "--no-trunc", "--filter", f"label={SERVICE_LABEL}={service_id}"], check=False)
    nodes: list[dict] = []
    for container_id in out.split():
        labels = _container_labels(container_id)
        state = _container_state(container_id)
        if not state:
            continue
        nodes.append({"id": container_id, "node_type": labels.get("CompEvalNodeType", "local"), "image": labels.get("CompEvalImage", ""), "state": state, "reachability": "ok" if state == "running" and _is_ready(container_id) else "none", "ip": _container_ip(container_id) or None, "created_at": _container_created_at(container_id)})
    return nodes


def terminate(container_id: str) -> None:
    _docker(["rm", "-f", container_id], timeout=60, check=False)


def reap_untracked(*, service_id: str, tracked_ids: list[str]) -> None:
    out = _docker(["ps", "-q", "--no-trunc", "--filter", f"label={SERVICE_LABEL}={service_id}"], check=False)
    tracked = set(tracked_ids)
    for container_id in out.split():
        if container_id in tracked or _container_age(container_id) < _REAP_GRACE_SECONDS:
            continue
        _docker(["rm", "-f", container_id], timeout=60, check=False)