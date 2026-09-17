"""Background pulls of worker base images.

``docker run`` pulls a missing image inline, and a multi-GB image outlasts any request or
scheduler tick waiting on it. Provisioning starts the pull here instead and reports the
worker as pending until the image is present.
"""
import subprocess
import threading

from .base import ProvisionPending

_lock = threading.Lock()
_pulls: dict[str, subprocess.Popen] = {}


def ensure_image(image: str) -> None:
    """Return once ``image`` is present locally. Until then, start (or keep) a background
    ``docker pull`` and raise ProvisionPending; raise RuntimeError if that pull failed."""
    present = subprocess.run(["docker", "image", "inspect", image],
                             capture_output=True, timeout=30).returncode == 0
    if present:
        return
    with _lock:
        proc = _pulls.get(image)
        if proc is not None and proc.poll() is not None:
            del _pulls[image]
            if proc.returncode != 0:
                error = (proc.stderr.read() if proc.stderr else "").strip()
                raise RuntimeError(f"docker pull {image} failed: {error}")
            return  # the pull finished between the inspect and here
        if proc is None:
            # Progress goes nowhere: only the error text is ever read back.
            _pulls[image] = subprocess.Popen(
                ["docker", "pull", image],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            )
    raise ProvisionPending(f"downloading image {image}; the worker starts once it is there")
