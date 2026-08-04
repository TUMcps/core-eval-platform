"""Worker-server side helpers for remote_docker."""
import json
import os
import re
import subprocess
import uuid
from datetime import datetime
from datetime import timezone as dt_timezone

# Constants used for container management and identification
SERVICE_LABEL = "CompEvalServiceId"
READY_MARKER = "/tmp/vnncomp_ready"
_GPU_TYPES = {"p3.2xlarge", "g5.8xlarge"}
_REAP_GRACE_SECONDS = 300


def _env(name: str, default: str) -> str:
    """Fetch an environment variable with a fallback default value."""
    return os.getenv(name, default)


def _docker(args, *, timeout: int = 60, check: bool = True) -> str:
    """
    Execute a Docker CLI command and return its standard output.
    
    :param args: List of arguments for the docker command.
    :param timeout: Maximum execution time in seconds.
    :param check: If True, raises a RuntimeError when the command fails.
    """
    proc = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        raise RuntimeError(f"docker {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def _bootstrap_script() -> str:
    """
    Locate the bootstrap script used to initialize new Docker nodes.
    Checks environment-defined roots first, then falls back to the default relative path.
    """
    for root in (os.getenv("SCRIPT_ROOT"), os.getenv("AWS_SCRIPT_ROOT")):
        if root:
            override = os.path.join(root, "scripts", "docker", "bootstrap_node.sh")
            if os.path.isfile(override):
                return override
    # Default fallback path based on current file location
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "docker", "bootstrap_node.sh")


def _container_ip(container_id: str) -> str:
    """Retrieve the IP address of a given Docker container."""
    try:
        return _docker(["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", container_id], timeout=15).strip()
    except Exception:
        return ""


def _container_state(container_id: str) -> str:
    """Get the current running state of a Docker container (e.g., 'running', 'exited')."""
    try:
        return _docker(["inspect", "-f", "{{.State.Status}}", container_id], timeout=15, check=False).strip()
    except Exception:
        return ""


def _container_labels(container_id: str) -> dict:
    """Fetch and parse the JSON labels assigned to a Docker container."""
    try:
        out = _docker(["inspect", "-f", "{{json .Config.Labels}}", container_id], timeout=15, check=False).strip()
        return json.loads(out) if out else {}
    except Exception:
        return {}


def _container_created_at(container_id: str) -> str:
    """Get the creation timestamp string of a container."""
    return _docker(["inspect", "-f", "{{.State.StartedAt}}", container_id], timeout=15, check=False).strip()


def _container_age(container_id: str) -> float:
    """Calculate how many seconds have passed since the container was started."""
    out = _container_created_at(container_id)
    # Extract the timestamp ignoring fractional seconds and timezone offsets
    match = re.match(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})", out)
    if not match:
        return 0.0
    
    started = datetime.strptime(match.group(1), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=dt_timezone.utc)
    return (datetime.now(dt_timezone.utc) - started).total_seconds()


def _is_ready(container_id: str) -> bool:
    """Check if the container has finished its bootstrap process by looking for a ready marker file."""
    proc = subprocess.run(["docker", "exec", container_id, "test", "-f", READY_MARKER], capture_output=True, text=True, timeout=15)
    return proc.returncode == 0


def provision(*, service_id: str, node_type: str, image: str, authorized_key: str, eni: str | None = None) -> dict:
    """
    Create, start, and bootstrap a new Docker container to serve as a worker node.
    
    Returns a dictionary containing the new container's metadata (id, ip, state, etc.).
    """
    # Generate a unique name for the container
    name = f"{_env('VNNCOMP_DOCKER_NAME_PREFIX', 'eval')}-{uuid.uuid4().hex[:12]}"
    
    # Base arguments for running the container in detached mode
    run_args = [
        "run", "-d", "--name", name,
        "--label", f"{SERVICE_LABEL}={service_id}",
        "--label", "CompEvalManaged=true",
        "--label", f"CompEvalNodeType={node_type}",
        "--label", f"CompEvalImage={image}",
        "--network", _env("VNNCOMP_DOCKER_NETWORK", "eval-platform_default"),
        "--entrypoint", "sleep",
    ]
    
    # Attach GPU resources if required by environment or node type
    gpu_env = _env("VNNCOMP_DOCKER_GPU", "").lower() in ("1", "true", "all", "yes")
    if gpu_env or node_type in _GPU_TYPES:
        run_args += ["--gpus", "all"]
        
    run_args += [image, "infinity"]
    
    # Start the container
    container_id = _docker(run_args, timeout=120).strip()
    ip = _container_ip(container_id)
    
    # Clear any old SSH host keys for this IP to prevent strict host key checking failures
    if ip:
        subprocess.run(["ssh-keygen", "-R", ip], capture_output=True, timeout=15)
        
    # Copy and execute the bootstrap script inside the new container
    script = _bootstrap_script()
    _docker(["cp", script, f"{container_id}:/tmp/bootstrap_node.sh"], timeout=30)
    _docker(["exec", "-d", "-u", "0", "-e", f"AUTHORIZED_KEY={authorized_key}", container_id, "bash", "/tmp/bootstrap_node.sh"], timeout=30)
    
    return {
        "id": container_id, 
        "node_type": node_type or "local", 
        "image": image, 
        "state": "running", 
        "reachability": "ok" if _is_ready(container_id) else "none", 
        "ip": ip or None, 
        "created_at": _container_created_at(container_id)
    }


def list_nodes(*, service_id: str) -> list[dict]:
    """
    List all managed Docker containers associated with a specific service ID.
    Constructs a metadata dictionary for each valid container found.
    """
    out = _docker(["ps", "-q", "--no-trunc", "--filter", f"label={SERVICE_LABEL}={service_id}"], check=False)
    nodes: list[dict] = []
    
    for container_id in out.split():
        labels = _container_labels(container_id)
        state = _container_state(container_id)
        if not state:
            continue
            
        nodes.append({
            "id": container_id, 
            "node_type": labels.get("CompEvalNodeType", "local"), 
            "image": labels.get("CompEvalImage", ""), 
            "state": state, 
            "reachability": "ok" if state == "running" and _is_ready(container_id) else "none", 
            "ip": _container_ip(container_id) or None, 
            "created_at": _container_created_at(container_id)
        })
        
    return nodes


def terminate(container_id: str) -> None:
    """Forcefully remove a specific Docker container."""
    _docker(["rm", "-f", container_id], timeout=60, check=False)


def reap_untracked(*, service_id: str, tracked_ids: list[str]) -> None:
    """
    Remove containers that belong to this service but are not in the tracked list.
    Allows a grace period for newly created containers to avoid terminating them prematurely.
    """
    out = _docker(["ps", "-q", "--no-trunc", "--filter", f"label={SERVICE_LABEL}={service_id}"], check=False)
    tracked = set(tracked_ids)
    
    for container_id in out.split():
        # Skip containers that are being actively tracked or are still within their startup grace period
        if container_id in tracked or _container_age(container_id) < _REAP_GRACE_SECONDS:
            continue
        # Terminate untracked, older containers (garbage collection)
        _docker(["rm", "-f", container_id], timeout=60, check=False)