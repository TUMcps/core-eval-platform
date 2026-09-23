# Core evaluation platform documentation

This directory documents the shared platform used by competition plugins such as
ARCH-COMP and VNN-COMP. It is the source of truth for behavior that does not belong to
one competition.

## Documents

- [Architecture](architecture.md) — ownership boundaries, data model, and request flow.
- [Execution and tasks](execution-and-tasks.md) — task state machine, scheduler, logs,
  retries, timeouts, and operator controls.
- [Compute backends](compute-backends.md) — local Docker, remote Docker, and AWS.
- [Administration](administration.md) — accounts, roles, runtime settings, and current
  feature status.
- [Configuration and operations](configuration-and-operations.md) — environment
  variables, startup, deployment checks, backup boundaries, and troubleshooting.
- [Security](security.md) — secrets, worker trust boundaries, and safe documentation.

Participant-facing instructions belong to each competition plugin. The shared frontend
renders those instructions from the plugin's `guides.py`; this directory is for developers
and operators.

## Scope

Core documentation covers behavior implemented by `comp_eval_platform`, including:

- accounts, roles, authentication, or submission ownership;
- task and step state transitions;
- scheduler behavior, timeouts, live logs, or callbacks;
- worker provisioning and compute backends;
- shared REST endpoints or frontend pages;
- database and deployment configuration shared by all competitions.

Plugin documentation covers competition repository contracts, step graphs, result parsers,
scoring rules, categories, and benchmark formats.
