# Compute backends

The compute backend owns only worker lifecycle: reconcile, provision, and terminate.
Plugin step handlers use the same SSH-oriented worker contract regardless of backend.

## Current backends

| Backend | Current status | Use |
| --- | --- | --- |
| `local_docker` | Worker lifecycle implemented and configured by the plugin Compose stacks | Starts isolated worker containers on the backend host |
| `remote_docker` | Implemented; requires a separately operated worker service | Starts containers on another Docker host |
| `aws` | Adapter implemented; lifecycle and image validation are deployment work | Manages EC2 through deployment-supplied scripts and AWS configuration |
| `local` | Development/internal fallback | Runs against localhost without an isolated worker |

The administration page exposes `local_docker`, `remote_docker`, and `aws`.

## Local Docker

`local_docker` requires:

- the Docker CLI in the backend image;
- the host Docker socket mounted into the backend;
- `COMP_DOCKER_NETWORK` naming a network shared by backend and workers;
- `COMP_DOCKER_SSH_KEY` readable by provisioning; node operations use
  `NODE_SSH_KEY` when set and otherwise fall back to that same key;
- a Docker base image, or `COMP_DEFAULT_DOCKER_IMAGE` as the fallback.

Core starts each worker with deployment labels, bootstraps an `ubuntu` user and SSH
access, tracks it as a `Node`, and removes it during shutdown. The backend only reaps
containers carrying the current deployment's service label.

This status covers worker lifecycle. The repositories do not contain end-to-end coverage
for every competition's install, run, and export scripts across Docker paths and mounts.

Do not mount the Docker socket into an untrusted web deployment without understanding the
host-level privilege it grants. Treat the backend container as privileged infrastructure.

## Remote Docker

From an ARCH or VNN deployment checkout on the worker machine, start the remote worker
service with:

```bash
python deploy/manage.py worker_service --host 0.0.0.0 --port 9001
```

The website uses `REMOTE_DOCKER_WORKER_URL` and `REMOTE_DOCKER_WORKER_PORT`. A user may
configure a personal worker service URL and port from the Account page; those values
override the deployment defaults for that user's submissions.

The service exposes health, node listing, provisioning, termination, and reap operations.
It does not provide authentication or TLS itself. Bind it to a trusted network, firewall
it to the orchestrator, or place it behind an authenticated transport. Do not expose it
directly to the public internet.

The orchestrator must be able to reach the service, the orchestrator must be able to SSH
to the returned worker address, and the worker must be able to reach `ROOT_URL`.

## AWS

The AWS adapter discovers and tags owned EC2 instances, supports an optional ENI, and uses
the same SSH and callback contract as Docker workers. The current core and plugin trees do
not ship the complete AWS lifecycle shell set referenced by the adapter, including the
instance-listing, status, creation, and termination scripts. Therefore selecting `aws`
alone is not sufficient for a working deployment.

A working AWS deployment includes those scripts beneath `SCRIPT_ROOT/scripts`, an AWS CLI
and SSH key outside version control, a worker-reachable `ROOT_URL`, and deployment-specific
security groups, instance images, service tags, and cleanup behavior.

## Image rules

Docker backends reject values beginning with `ami-`. The AWS backend currently passes the
submitted image string through without enforcing AMI syntax. In addition, the normal
browser form endpoints do not call compute-image validation before creating a task; only
the lower-level tool `run` action does. Frontend field requirements are therefore
convenience checks rather than an API-level image compatibility guarantee.

## Deployment identity

`EVAL_SERVICE_ID` identifies workers owned by one deployment; `COMP_SERVICE_ID` remains a
compatibility alias. Set a stable, unique value in multi-deployment environments so one
installation never reconciles or removes another installation's workers.
