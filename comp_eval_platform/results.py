"""Value types exchanged across the Competition seams (not DB models).

A plugin's ``parse_results`` returns ``ResultRecord``s (which core persists into
``Result`` rows); ``score`` returns a ``Scoreboard``; ``presentation`` returns a
``Presentation`` describing what the frontend shell should render for this variant.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ResultRecord:
    """One normalized per-instance outcome parsed from a run's node output."""

    instance: str  # instance name within the benchmark
    result: str  # normalized verdict (e.g. sat/unsat/holds/violated/unknown/error/timeout)
    time: Optional[float] = None  # runtime in seconds
    extra: dict = field(default_factory=dict)  # competition/category-specific fields


@dataclass
class Scoreboard:
    """A rendered scoreboard: column names + row dicts keyed by those columns."""

    columns: list[str]
    rows: list[dict[str, Any]]


@dataclass
class Presentation:
    """What the active variant contributes to the frontend shell."""

    #: Columns to show in the per-instance results table (beyond instance/result/time).
    result_columns: list[str] = field(default_factory=list)
    #: Submission-form field specs the shell renders for this variant's uploads.
    submission_fields: list[dict] = field(default_factory=list)
    #: Columns to show on the scoreboard.
    score_columns: list[str] = field(default_factory=list)
