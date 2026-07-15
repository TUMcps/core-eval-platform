"""Core domain models.

Split across submodules but exposed flat so ``from comp_eval_platform.core.models
import Tool`` works and Django sees them under the ``core`` app label.
"""
from .catalog import Benchmark, Category, Instance, Tool, Track
from .users import Role, User

__all__ = [
    "Role",
    "User",
    "Category",
    "Tool",
    "Benchmark",
    "Instance",
    "Track",
]
