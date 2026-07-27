# Core Evaluation Platform

This is the core component powering the evaluation platforms of **[VNN-COMP](https://vnn.repeatability.cps.cit.tum.de/)**
and **[ARCH-COMP](https://arch.repeatability.cps.cit.tum.de/)** — the shared engine both
competitions build on.

Core engine for a modular **competition-evaluation platform**. Users submit tools and
benchmarks; the code runs on a provisioned worker, and results are collected, scored, and
displayed. Django REST backend + React/TypeScript (Vite) frontend.

Individual competitions are **plugins** in their own repos
([`vnn-comp`](https://github.com/VNN-COMP/vnn-eval-platform),
[`arch-comp`](https://github.com/ARCH-COMP/arch-eval-platform), …). This repo is the shared
library they all depend on; each deployment runs exactly one variant.

## Getting started

Clone either variant and follow the Getting Started guide there.

If you want to use this core component for a new submission platform,
it also might be best to check out how this was done for each of the existing variants.
Don't hesitate to reach out for any questions regarding this!

## Requirements

- Docker + Docker Compose (Docker Desktop on macOS/Windows). The dev backend mounts the host
  Docker socket to run worker containers.
- Git.

## Tests

```bash
docker run --rm -v "$PWD:/core" -w /core python:3.11-slim \
  sh -c "pip install -q -e '.[dev]' && pytest"
```

## Design

Full architecture and rationale in [`docs/unified-platform.md`](docs/unified-platform.md).
