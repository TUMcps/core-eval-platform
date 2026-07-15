"""Pluggable compute backends: where submissions run.

The task state machine and per-node scripts (which SSH to a node's IP) are
backend-agnostic; only lifecycle (provision / sync / terminate) differs between
AWS EC2 and local Docker. Select via the ``execution_backend`` runtime setting.
"""
from .base import ComputeBackend, get_backend

__all__ = ["ComputeBackend", "get_backend"]
