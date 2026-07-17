"""Competition contract + selection.

Mirrors the ``ComputeBackend`` pattern (``get_backend()``), with two deliberate
differences:

* Competitions **self-register** from their plugin's ``AppConfig.ready()`` (the
  core does not import them), so a new variant is a separate installable package.
* Selection reads the static Django setting ``ACTIVE_COMPETITION`` — a deployment
  runs exactly one variant, so this is config, not a runtime DB toggle (unlike
  ``execution_backend``, which stays a runtime setting on the compute axis).

A ``Competition`` bundles the six seams that differ between variants; everything
else (scheduler, node lifecycle, users/auth, storage, live logs, REST/frontend
shell) is shared core. Concrete signatures firm up as the model layer lands; the
domain nouns referenced here (Submission, Task, TaskStep, Run, Track, …) are the
clean-schema core models introduced next.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # model layer lands next; keep the contract import-light for now
    from comp_eval_platform.core.models import (
        Run,
        Submission,
        Task,
        TaskStep,
        Track,
    )
    from comp_eval_platform.results import Presentation, ResultRecord, Scoreboard


class Competition(ABC):
    """One competition variant. Subclass in a plugin and ``register`` it.

    Categories (ARCH's AINNCS/AFF/NLN…; VNN has one implicit default) are a
    first-class core grouping. A variant may specialize the parse/score/spec
    seams per category — dispatch on ``obj.category`` inside these methods; the
    core does not force a single parser or scorer across categories.
    """

    #: Registry key. A variant is live when this equals ``settings.ACTIVE_COMPETITION``.
    name: str
    #: Human-facing name for the UI.
    display_name: str = ""
    #: Whether benchmarks are grouped into user-chosen categories (ARCH: AFF/NLN/…)
    #: or a single implicit ``default`` one (VNN). Drives the submission form.
    uses_categories: bool = True

    # (1) Submission spec + validation ------------------------------------
    @abstractmethod
    def validate_submission(self, submission: "Submission") -> None:
        """Raise ``ValidationError`` if an uploaded tool/benchmark violates this
        competition's spec. Called at submit time, before anything runs."""

    # (2) Step-graph builder ----------------------------------------------
    @abstractmethod
    def build_steps(self, task: "Task") -> list["TaskStep"]:
        """Ordered steps for ``task``, sliced as finely as this competition's
        interface allows (generalizes VNN's ``_define_steps``): the structured
        rung is install-once → per-instance prepare/run → parse → score → export."""

    # (3) Node scripts + I/O contract -------------------------------------
    def script_root(self) -> str:
        """Filesystem root of this competition's node scripts (install /
        prepare_instance / run_instance). Default: ``scripts/`` beside the plugin."""
        raise NotImplementedError

    # (4) Result parsing → normalized records -----------------------------
    @abstractmethod
    def parse_results(self, run: "Run", artifacts_dir: str) -> list["ResultRecord"]:
        """Turn a finished run's raw node output into normalized per-instance
        records (instance, result, time, …) plus competition-specific ``extra``.
        May dispatch per-category."""

    # (5) Scoring ---------------------------------------------------------
    @abstractmethod
    def score(self, track: "Track") -> "Scoreboard":
        """Compute the scoreboard for a track. Per-competition/-category; the
        core imposes no scoring formula."""

    # (6) Presentation / export -------------------------------------------
    def presentation(self) -> "Presentation":
        """UI hints (submission-form fields, result columns, score view) and
        export behavior contributed to the shared frontend shell. Default:
        generic results table, no export."""
        raise NotImplementedError

    def exported_artifacts_dir(self, step: "TaskStep") -> str | None:
        """Directory of the files this export step pushed (results, counterexamples,
        …), which the core serves as a download. Only the variant knows where its
        export writes. Default: none, i.e. the step offers no download."""
        return None

    def step_timeout_hours(self, step: "TaskStep") -> int | None:
        """The wall-clock cap this step runs under, for the pipeline's timer. Only the
        variant knows which of its kinds it caps in ``while_active``. Default: none."""
        return None

    # Branding assets (favicon, hero image) ------------------------------
    def assets_dir(self) -> str | None:
        """Directory of branding asset files this variant ships (favicon, hero
        image). Default: none. Override to e.g. ``assets/`` beside the plugin."""
        return None

    def asset_path(self, name: str) -> str | None:
        """Resolve a branding asset name to a file path under ``assets_dir``,
        or ``None`` if absent. Rejects path traversal so the core can serve it
        directly at ``/api/competition/assets/<name>``."""
        root = self.assets_dir()
        if not root:
            return None
        root = os.path.normpath(root)
        full = os.path.normpath(os.path.join(root, name))
        if os.path.commonpath([root, full]) != root:
            return None  # escaped the assets dir
        return full if os.path.isfile(full) else None


_REGISTRY: dict[str, type[Competition]] = {}


def register(cls: type[Competition]) -> type[Competition]:
    """Register a ``Competition`` subclass. Call from the plugin's
    ``AppConfig.ready()`` (or use as a class decorator). Idempotent per name."""
    if not getattr(cls, "name", None):
        raise ValueError(f"{cls.__name__} must set a non-empty `name`")
    _REGISTRY[cls.name] = cls
    return cls


def registered() -> dict[str, type[Competition]]:
    """The currently registered competitions, keyed by ``name``."""
    return dict(_REGISTRY)


def get_competition() -> Competition:
    """The competition selected by ``settings.ACTIVE_COMPETITION``."""
    from django.conf import settings

    name = getattr(settings, "ACTIVE_COMPETITION", None)
    if not name:
        raise RuntimeError("ACTIVE_COMPETITION is not set")
    try:
        return _REGISTRY[name]()
    except KeyError:
        raise RuntimeError(
            f"ACTIVE_COMPETITION={name!r} is not registered; "
            f"known: {sorted(_REGISTRY)}. Is its plugin app in INSTALLED_APPS?"
        )
