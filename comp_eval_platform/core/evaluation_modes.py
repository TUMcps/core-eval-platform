"""Shared evaluation mode definitions for toolkit submissions."""
from __future__ import annotations

from enum import Enum


class EvaluationMode(str, Enum):
    ALL = "all"
    RANDOM10 = "random10"
    FIRST = "first"


EVALUATION_MODE_OPTIONS = (
    {"value": EvaluationMode.ALL.value, "label": "All instances (final evaluation)"},
    {"value": EvaluationMode.RANDOM10.value, "label": "10 random instances"},
    {"value": EvaluationMode.FIRST.value, "label": "First instance only (test)"},
)
