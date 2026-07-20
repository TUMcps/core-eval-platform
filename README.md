# comp-eval-platform

Core engine for a modular **competition-evaluation platform**. Users submit tools and
benchmarks; the code runs on a provisioned worker, and results are collected, scored, and
displayed. Django REST backend + React/TypeScript (Vite) frontend.

Individual competitions are **plugins** in their own repos
([`vnn-comp`](https://github.com/VNN-COMP/vnn-eval-platform),
[`arch-comp`](https://github.com/ARCH-COMP/arch-eval-platform), …). This repo is the shared
library they all depend on; each deployment runs exactly one variant.

## Getting started

You don't run this repo on its own — run a variant, which mounts this one as its core. Clone
both **side by side** under the same parent directory:

```bash
git clone https://github.com/TUMcps/core-eval-platform.git   comp-eval-platform
git clone https://github.com/VNN-COMP/vnn-eval-platform.git  vnn-comp-new
# ...or the ARCH variant: https://github.com/ARCH-COMP/arch-eval-platform.git  arch-comp-new
cd vnn-comp-new && docker compose up --build
```

See the variant's README (`vnn-comp-new`, `arch-comp-new`) for its port and details.

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
