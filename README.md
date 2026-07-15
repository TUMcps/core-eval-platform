# comp-eval-platform

Core engine for a modular **competition-evaluation platform**. Users submit code (tools and
benchmarks), the code runs on a provisioned worker, results are collected, scored, and displayed.

Individual competitions are **plugins**: [`vnn-comp`](https://gitlab.lrz.de/cps/nnv/websites),
[`arch-comp`](https://gitlab.lrz.de/cps/nnv/websites), and future ones are variants of this one core.
Each deployment runs exactly one variant.

## Two orthogonal axes

- **Competition** — which variant is live (`ACTIVE_COMPETITION`). A plugin registers a `Competition`
  subclass into the core registry on app startup; the engine stays variant-agnostic.
- **Compute backend** — *what a worker is* (`EXECUTION_BACKEND = aws | local_docker`). A competition
  emits steps that "run on a worker"; the backend decides whether that is an EC2 instance or a
  Docker container. Concurrency is one core setting, `max_parallel_nodes` — a worker runs its
  benchmarks sequentially; N workers run in parallel.

## Repo layout

This repo is the **core library** (published as the `comp-eval-platform` pip package). A variant is a
separate repo (e.g. `vnn-comp`) containing its plugin app **plus** its deploy config, depending on
this package. Core updates are a version bump, never a fork merge.

## Design

See [`docs/unified-platform.md`](docs/unified-platform.md) for the full architecture and the
decisions behind it.

## Status

Early scaffolding. Built out of the VNN-COMP orchestrator; see the design doc for the migration path.
