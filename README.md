# Core Evaluation Platform

This is the core component powering the evaluation platforms of **[VNN-COMP](https://github.com/VNN-COMP/vnn-eval-platform)**
and **[ARCH-COMP](https://github.com/ARCH-COMP/arch-eval-platform)** — the shared engine both
competitions build on.

Core engine for a modular **competition-evaluation platform**. Users submit tools and
benchmarks; the code runs on a provisioned worker, and results are collected, scored, and
displayed. Django REST backend + React/TypeScript (Vite) frontend.

Individual competitions are **plugins** in their own repos
([`vnn-comp`](https://github.com/VNN-COMP/vnn-eval-platform),
[`arch-comp`](https://github.com/ARCH-COMP/arch-eval-platform), …). This repo is the shared
library they all depend on; each deployment runs exactly one variant.

## Getting started

You don't run this repo on its own — run a variant, which vendors this repo as a pinned
`./core` git submodule. Clone the variant recursively:

```bash
git clone --recurse-submodules https://github.com/VNN-COMP/vnn-eval-platform.git
# ...or the ARCH variant: https://github.com/ARCH-COMP/arch-eval-platform.git
cd vnn-eval-platform && docker compose up --build
```

See the variant's README for its port and details. A variant moves its core pin with
[`scripts/bump-core.sh`](scripts/bump-core.sh), shipped here and run as `core/scripts/bump-core.sh`.

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
