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


def service_id() -> str:
    """Stable id tagging the workers this deployment owns (so we never manage
    someone else's). From ``VNNCOMP_SERVICE_ID`` env, else an ephemeral uuid."""
    return os.getenv("VNNCOMP_SERVICE_ID") or os.getenv("HOSTNAME") or str(uuid.uuid4())
