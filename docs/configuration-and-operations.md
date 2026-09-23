# Configuration and operations

## Configuration sources

Static configuration is read from environment variables when Django starts. Runtime
settings are stored in PostgreSQL and edited through Admin > Settings. When both contain
an execution backend, `init_settings` seeds the initial database value from the static
environment; later UI changes persist in the database.

Important shared variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Django signing secret; replace the development default |
| `DEBUG` / `ALLOWED_HOSTS` | Django exposure controls |
| `ACTIVE_COMPETITION` | Registered plugin selected for this deployment |
| `EXECUTION_BACKEND` | Initial backend seeded into runtime settings |
| `MAX_PARALLEL_NODES` | Maximum tracked workers provisioned concurrently |
| `MAX_STEP_RETRIES` | Retry cap for retryable handlers |
| `SCHEDULER_AUTOSTART` | Whether this web process starts APScheduler |
| `AUTOMATIC_UPDATE_INTERVAL` | Scheduler interval in seconds |
| `ROOT_URL` | Callback base URL reachable from workers |
| `SCRIPT_ROOT` | Active plugin root used to resolve node and lifecycle scripts |
| `NODE_SSH_KEY` | Private key used to connect to workers |
| `LIVE_LOG_TAIL_BYTES` | Maximum node-log tail stored per update |
| `DATA_DIR` / `LOCAL_REPOS_DIR` | Persistent local artifact repositories |
| `BENCHMARKS_PUSH_REPO` / `RESULTS_PUSH_REPO` | Optional remote Git export targets |
| `BENCHMARKS_DEPLOY_KEY` / `RESULTS_DEPLOY_KEY` | Host-side paths to export keys |

Backend-specific variables are documented in [Compute backends](compute-backends.md).
Plugin-specific variables belong in the plugin repository.

## Initialization

After dependencies and the active plugin are installed, run these commands from an ARCH or
VNN deployment checkout (where `deploy/manage.py` is provided):

```bash
python deploy/manage.py migrate
python deploy/manage.py init_settings
```

`init_settings` creates the singleton runtime row. For a newly created local Docker
deployment it enables the scheduler and opens tool and benchmark submissions. Non-local
backends remain conservative when reset. `--reset` re-seeds runtime toggles but preserves
the UI-selected backend on an existing row.

When developing the standalone core repository, use its root `manage.py` instead.

## Production principles

The repository Compose files are development stacks. A production deployment boundary
normally includes:

- a production WSGI server and explicit scheduler ownership;
- TLS and reverse-proxy routing for the frontend, `/api/`, Django admin if enabled, and
  worker callbacks under `/update/`;
- a non-development `SECRET_KEY`, restricted `ALLOWED_HOSTS`, and appropriate CSRF origins;
- durable PostgreSQL and `DATA_DIR` storage;
- constrained access to Docker, SSH, remote worker, and Git export credentials;
- monitoring for scheduler health, worker leaks, callback failures, disk use, and database
  backups.

Run only one scheduler-owning process unless the deployment has added coordination beyond
the current single-process APScheduler design.

## Backup and restore boundary

The platform does not currently ship an automated backup service. Operators must back up:

1. PostgreSQL, which contains all authoritative users, catalog entries, tasks, settings,
   logs, and normalized results;
2. the persistent `DATA_DIR`, which may contain local Git repositories for generated
   benchmarks and exported results;
3. deployment configuration through a secret manager or another protected system.

Do not put database dumps, private keys, `.env` files, or access tokens in the repository.
Test restore procedures in an isolated environment and document them in a private
deployment runbook when they contain infrastructure names or access details.

## Verification after a deployment

At minimum:

1. confirm migrations complete and the backend health endpoint or admin login responds;
2. confirm the frontend can read `/api/competition/` and displays the expected plugin;
3. verify the runtime backend and scheduler state in Admin > Settings;
4. submit a small example benchmark/tool using the intended backend;
5. confirm assignment, callback progression, live logs, result parsing, and shutdown;
6. confirm no unexpected workers remain after completion;
7. verify Git exports only if remote export is intentionally configured.

## Troubleshooting

- Stuck on assignment: check `scheduler_enabled`, `MAX_PARALLEL_NODES`, image type,
  worker-service reachability, and existing `Node` rows.
- Node work finishes but the step stays active: test `ROOT_URL` from the worker and the
  reverse-proxy route for `/update/`.
- No live logs: check worker SSH reachability, the handler's log path, SSH key permissions,
  and `LIVE_LOG_TAIL_BYTES`.
- Docker worker never becomes ready: inspect its bootstrap output, network membership, and
  authorized key.
- Results are absent: inspect the run step's raw CSV payload and verify that the plugin
  wrote the expected path before shutdown.
- Workers leak: verify the scheduler is running, deployment identity is stable, and the
  compute backend can list and terminate its own workers.
