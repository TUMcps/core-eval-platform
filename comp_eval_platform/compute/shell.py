"""Shelling out to the node scripts (SSH into ``ubuntu@<ip>``).

Scripts live under ``$SCRIPT_ROOT/scripts/<dir>/<name>``. ``_get`` runs one and
returns its stdout (used for lifecycle + status); ``_ping`` fires one and ignores
output (used to kick off per-step work on the node). Ported from VNN's
``_get``/``_ping``; ``SCRIPT_ROOT`` replaces the old ``AWS_SCRIPT_ROOT`` env name
(both are honored).
"""
import os
import subprocess
import uuid


class ScriptError(Exception):
    pass


def _script_root() -> str:
    return os.getenv("SCRIPT_ROOT") or os.getenv("AWS_SCRIPT_ROOT") or os.getcwd()


def _path(dir: str, script: str) -> str:
    return os.path.join(_script_root(), "scripts", dir, script)


def _get(dir: str, script: str, params: dict = None, *, timeout: int = 15) -> str:
    params = params or {}
    try:
        stdout = subprocess.check_output(
            [_path(dir, script)],
            env=dict(os.environ, **params),
            stderr=subprocess.STDOUT,
            timeout=timeout,
        ).decode("ascii", errors="ignore")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ScriptError(f"{script} failed: {exc}")
    if "port 22: Connection timed out" in stdout:
        raise ScriptError(f"{script}: ssh timed out")
    return stdout


def _ping(dir: str, script: str, params: dict = None) -> None:
    """Fire-and-forget: start the script, ignore its output (the node reports back
    via the /update/<id>/success|failure callback)."""
    params = params or {}
    subprocess.Popen(
        [_path(dir, script)],
        env=dict(os.environ, **params),
        stderr=subprocess.STDOUT,
    )


def _node_ssh_key() -> str:
    return (os.getenv("NODE_SSH_KEY") or os.getenv("VNNCOMP_DOCKER_SSH_KEY")
            or os.path.join(os.path.expanduser("~"), ".ssh", "vnncomp.pem"))


def node_exec(ip: str, cmd: str, *, timeout: int = 15) -> str:
    """Run a command on a node over SSH and return its raw stdout. Best-effort:
    returns "" on any SSH/timeout error (node not up yet, torn down, transient)."""
    try:
        out = subprocess.run(
            ["ssh", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10",
             "-i", _node_ssh_key(), f"ubuntu@{ip}", cmd],
            capture_output=True, text=True, timeout=timeout,
        )
        return out.stdout
    except (subprocess.SubprocessError, OSError):
        return ""


def fetch_node_log(ip: str, remote_path: str, *, tail_bytes: int = 1_000_000, timeout: int = 15) -> str:
    """Tail a node log file, for live logs during a run. ``remote_path`` is relative
    to ubuntu's home (e.g. ``logs/generate.log``). Bounded so a verbose step (e.g. a
    generator spamming a progress bar) can't bloat the DB row or the poll payload."""
    return node_exec(ip, f"tail --bytes {tail_bytes} {remote_path} 2>/dev/null || true", timeout=timeout)


def service_id() -> str:
    """Stable id tagging the workers this deployment owns (so we never manage
    someone else's). From ``EVAL_SERVICE_ID`` env (``VNNCOMP_SERVICE_ID`` still
    honored for compatibility), else the hostname, else an ephemeral uuid."""
    return (os.getenv("EVAL_SERVICE_ID") or os.getenv("VNNCOMP_SERVICE_ID")
            or os.getenv("HOSTNAME") or str(uuid.uuid4()))
