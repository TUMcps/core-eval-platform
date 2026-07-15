"""Competition plugin contract + registry.

A competition (VNN-COMP, ARCH-COMP, …) is a plugin that subclasses
``Competition`` and registers itself, so the core engine stays variant-agnostic.
"""
from .base import Competition, get_competition, register, registered

__all__ = ["Competition", "get_competition", "register", "registered"]
