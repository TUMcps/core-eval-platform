# Core Evaluation Platform

Core engine for a modular **competition-evaluation platform**. Users submit tools and
benchmarks; the code runs on a provisioned worker, and results are collected, scored, and
displayed. Django REST backend + React/TypeScript (Vite) frontend.

This is the core component powering the evaluation platforms of **[VNN-COMP](https://vnn.repeatability.cps.cit.tum.de/)**
and **[ARCH-COMP](https://arch.repeatability.cps.cit.tum.de/)**.

Individual competitions are **plugins** in their own repos
([`vnn-eval-platform`](https://github.com/VNN-COMP/vnn-eval-platform),
[`arch-eval-platform`](https://github.com/ARCH-COMP/arch-eval-platform), …).

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

Frontend tests cover shared status/result formatting, API list handling, authentication state,
protected-route access, and toolkit and benchmark submission workflows:

```bash
cd frontend
npm ci
npm test
```

Backend tests can be run with:

```bash
docker run --rm -v "$PWD:/core" -w /core python:3.11-slim \
  sh -c "pip install -q -e '.[dev]' && pytest"
```

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` runs for pushes to every branch, pull
requests, and manual dispatches. It runs the core Python tests and tests and builds the shared
frontend.

## Design

Full architecture and rationale in [`docs/unified-platform.md`](docs/unified-platform.md).
