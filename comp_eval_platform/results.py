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
class Branding:
    """Per-variant look of the shared frontend shell. All optional; the shell
    falls back to its neutral defaults for any empty field."""

    #: Theme primary color (hex). Drives buttons, links, accents.
    primary_color: str = ""
    #: Landing-page hero image. A URL: remote, or ``/api/competition/assets/<name>``
    #: for a file the plugin ships (see ``Competition.asset_path``).
    hero_image: str = ""
    #: Cap on the hero's rendered width, in px; 0 uses the shell's default. A
    #: near-square logo needs a tighter cap than a wide banner to match its height.
    hero_max_width: int = 0
    #: Browser-tab icon, same URL rules as ``hero_image``.
    favicon: str = ""


@dataclass
class Landing:
    """Per-variant copy for the landing page. All optional; the shell omits any
    empty piece."""

    #: Hero subtitle under the "<display_name> <year>" title.
    tagline: str = ""
    #: Outbound buttons beside the primary actions, e.g. main site / GitHub.
    links: list[dict] = field(default_factory=list)  # [{"label", "url"}]
    #: Contact emails shown as "Questions? Contact …".
    contacts: list[str] = field(default_factory=list)
    #: Cross-promo box for a sibling competition.
    related: dict = field(default_factory=dict)  # {"text", "label", "url"}


@dataclass
class Guide:
    """The copy for one how-to page, keyed ``"toolkit"``/``"benchmark"`` in
    ``Presentation.guides``. All optional; the shell omits any empty piece, and
    falls back to its own neutral copy for a variant that ships no guide.

    Prose carries a small inline markup the shell renders: ``` `code` ``` and
    ``[label](url)``. Anything longer than a span belongs in a ``code`` block.
    """

    #: Sentence under the page title.
    intro: str = ""
    #: The steps a submission runs, in order, as ``{"title", "details": [str]}``.
    #: Rendered twice: a strip of boxes up top, then a card per step with its
    #: ``details`` paragraphs. Keep the titles short — the strip is one line.
    pipeline: list[dict] = field(default_factory=list)
    #: Prose below the pipeline, as ``{"heading", "blocks": [block]}``. A block is
    #: ``{"type": "text"|"note"|"code"|"bullets", ...}``: "text"/"note" take ``text``,
    #: "code" takes ``code``, "bullets" takes ``items``.
    sections: list[dict] = field(default_factory=list)


@dataclass
class Presentation:
    """What the active variant contributes to the frontend shell."""

    #: Columns to show in the per-instance results table (beyond instance/result/time).
    result_columns: list[str] = field(default_factory=list)
    #: Tool submission-form field specs the shell renders for this variant.
    submission_fields: list[dict] = field(default_factory=list)
    #: Benchmark submission-form field specs (e.g. VNN's vnnlib_version; ARCH: none).
    benchmark_fields: list[dict] = field(default_factory=list)
    #: Columns to show on the scoreboard.
    score_columns: list[str] = field(default_factory=list)
    #: Variant look (theme color, hero image, favicon).
    branding: Branding = field(default_factory=Branding)
    #: Variant landing-page copy (tagline, links, contacts, cross-promo).
    landing: Landing = field(default_factory=Landing)
    #: How-to page copy, keyed "toolkit"/"benchmark". A variant documents its own
    #: scripts and pipeline; the shell knows neither.
    guides: dict[str, Guide] = field(default_factory=dict)
