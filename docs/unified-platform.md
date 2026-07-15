# Unified Evaluation Platform — Design

Status: **design agreed, implementation starting** (branch `unified-eval-platform`).
Consolidates the decisions from the requirements interview (2026-07-14/15).

## Goal

One evaluation platform, built out of VNN-COMP, where **VNN-COMP, ARCH-COMP, and future
competitions are variants (plugins) of the same core**. Overriding constraint: **a new variant is
a small plugin — minor code, zero edits to core.** Will be open-sourced; each deployment runs
exactly one variant.

Both systems already do the same coarse thing (submit code → run on a worker → store/show results).
They differ only in *how finely the run is structured* and in spec/parser/scorer details. VNN is the
most structured; ARCH is being professionalized to match it (below).

## The two axes (both already exist in VNN, kept orthogonal)

1. **Competition** (NEW axis) — which variant is live. Selected by `ACTIVE_COMPETITION`. Mirrors the
   existing `get_backend()` pattern in `compute/base.py`: an abstract `Competition` base + registry;
   each plugin registers a subclass on `AppConfig.ready()`.
2. **Compute backend** (existing) — *what a worker is*. `EXECUTION_BACKEND = aws | local_docker`
   (today's `VNNCOMP_EXECUTION_BACKEND`). Stays in core, untouched by the competition axis.

A competition emits steps that "run on a worker"; the backend decides whether a worker is an EC2
instance or a Docker container. `vnn-comp + aws` = today's prod; `vnn-comp + local_docker` = local
flow; `arch-comp + local_docker` = Glados. **"Local VNN ≈ new ARCH."**

## Concurrency — resolved to one uniform model

Both systems are: **a worker runs its benchmarks sequentially; N workers run in parallel.** A worker
= one AWS instance (VNN) or one Docker container (ARCH). This is already the `ComputeBackend`
provisioning N nodes. So concurrency is **not** a competition concern — it's a single core setting
`max_parallel_nodes`. The scheduler stays a single-threaded poller that advances all in-progress
tasks each tick; parallelism comes from multiple workers executing between ticks.

## Decomposition-depth ladder (the key principle)

`build_steps()` slices the pipeline as finely as the tool's interface allows:
- **Structured (VNN, ARCH-new)**: install-once → per-instance `prepare`/`run` loop → parse → score → export.
- **Opaque (legacy dockrun)**: 1 step (run a zip, collect). Degenerate endpoint — becomes a trivial
  plugin only if ever needed; **ARCH is being professionalized away from it.**

**ARCH professionalization**: instead of running a submitted zip, an ARCH tool now defines a Docker
base image → we clone the tool into it → run install/license → run benchmarks sequentially via a
`run_instance` script, exactly like VNN-local. This collapses ARCH onto the structured rung.

## Packaging & repos

- `comp-eval-platform` (module `comp_eval_platform`) — **core**, published as a pip package: engine,
  scheduler, node lifecycle (`ComputeBackend`), task/step state machine, users/auth/roles, REST +
  **frontend shell**, storage, live logging, the `Competition` contract + registry, and the shared
  domain models (below).
- `vnn-comp` (module `vnn_comp`) / `arch-comp` (module `arch_comp`) — **one repo per variant** =
  the plugin app **+** its deploy config (compose/env), depending on `comp-eval-platform==x.y`.
  Core updates = version bump, never a fork merge. (Explicitly NOT git forks.)

During initial development we build core + `vnn_comp` in this branch as separate top-level packages,
and split into the two repos at publish time.

## Data model — fresh clean schema

Retrofit VNN's `_db_`/polymorphic/`save_new` shim to **idiomatic Django** (UUID PKs, `JSONField`,
`FileField`). **Fresh schema, migrations from 0001**; migrate current prod data with a one-off ETL
script at cutover. No `_db_` legacy in the new package.

### Shared core nouns
- **Tool** — a submission (repo/base-image + scripts).
- **Benchmark** — a submission that **defines a list of named instances**. Users submit benchmarks in
  both VNN and ARCH. (ARCH benchmark = a category's instance list.)
- **Instance** — a single case; passed to the node as `run_instance(version, benchmark, instance)`.
  Same shape in VNN and ARCH.
- **Run** — result of tool × benchmark (× instance). Normalized result record + competition-specific
  `extra` JSON.
- **Category** — **first-class grouping in core.** Each category can carry its own instance spec,
  run interface, parser, and scorer (generalizes ARCH's `parser_factory[category][tool]`). VNN =
  one implicit default category; `arch_comp` registers AINNCS/AFF/NLN/… each with their own
  spec/parser/scorer. A single `arch-comp` plugin covers all its categories.
- **Track** — **organizer-managed DB rows** (e.g. test/main/extended), created and named per
  deployment. An organizer assigns submitted benchmarks into tracks via the UI. Replaces VNN's
  hardcoded, inflexible track assignment.

### Roles
`user | organizer | admin`. **Organizer** = curate tracks & select benchmarks (no infra/user power);
**admin** = full control. (VNN's current single `admin` flag splits into organizer+admin.)

## The `Competition` contract (six seams; draft)

Each plugin subclass overrides, with sensible defaults so simple variants stay tiny:
1. **submission spec + validation** — what a Tool/Benchmark upload must contain; validated on submit.
2. **`build_steps(task)`** — generalizes `_define_steps()`; emits the step graph at the right depth.
3. **node scripts + I/O contract** — `scripts/<competition>/…` (install / prepare / run_instance).
4. **result parser → normalized record** — per (tool, benchmark, instance). Per-category override.
5. **scorer** — per competition/category; **not** one forced scorer.
6. **presentation/export** — results columns, score view, GitHub export. Frontend: **one shell**,
   plugin-contributed views (form schema, results columns, score view).

## Frontend

Core ships the app shell (auth, nav, submission list, live logs, generic results table). The active
plugin contributes variant-specific pieces (submission form fields, results columns, scoring view)
via config/components — mirrors the backend plugin model.

## Open items to design next
- Exact `Competition` base-class Python signature + registry wiring (mirror `compute/base.py`).
- Clean-schema models module + the cutover ETL from the current `_db_` schema.
- How per-category specialization is registered inside a plugin (category → spec/parser/scorer map).
- Frontend plugin-contribution mechanism (config-driven form/columns vs component injection).
- v1 milestone: **core + `vnn_comp`, VNN still runnable**, then add an ARCH category.
