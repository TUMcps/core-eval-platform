# Administration

## Accounts and roles

Email is the login identifier. The first account created through signup becomes an enabled
administrator; later accounts start disabled and cannot log in until an administrator
enables them.

| Role | Capabilities |
| --- | --- |
| `user` | Use enabled participant features; task management is owner-scoped, subject to the catalog API caveat below |
| `organizer` | User capabilities plus organizer-authorized catalog API operations; shared curation pages are limited |
| `admin` | Full platform API and shared administration access, settings, users, and ownership changes |

The shared Admin > Users page currently supports enabling accounts and assigning roles.
The Django admin also exposes catalog, task, result, node, and runtime-setting records for
careful maintenance, but it requires a separately configured Django staff or superuser
account; the first platform administrator is not automatically granted Django staff access.

## Runtime settings

Runtime settings live in one database row and can be changed without rebuilding images.
Static deployment settings such as `ACTIVE_COMPETITION`, `MAX_PARALLEL_NODES`, and
`SCHEDULER_AUTOSTART` still require environment/configuration changes.

| Setting | Current behavior |
| --- | --- |
| `scheduler_enabled` | Implemented. Stops or starts scheduler work; submissions are refused while disabled. |
| `execution_backend` | Implemented. Selects `local_docker`, `remote_docker`, or `aws`. |
| `users_can_submit_tools` | Implemented. Admins remain allowed. |
| `users_can_submit_benchmarks` | Implemented. Admins remain allowed. |
| `submission_timeout` | Implemented as hours of task/node overhead and orphan cleanup. |
| `benchmark_timeout` | Implemented in task backstops; VNN also enforces it per benchmark step. |
| `enforce_timeouts` | Implemented for task-owning nodes and VNN benchmark steps. Orphan cleanup remains active. |
| `terminate_at_end` | Stored and shown, but the current generic shutdown handler always terminates the worker. |
| `terminate_on_failure` | Stored and shown, but terminal tasks currently proceed to shutdown regardless of this value. |
| `allow_non_admin_login` | Stored and shown, but login currently checks only the user's `enabled` flag. |
| `allow_full_evaluation` | Stored and shown, but evaluation-mode availability is not currently filtered by it. |

The last four settings are compatibility fields rather than effective feature flags;
changing them does not alter current behavior.

## Submission ownership

Task lists are private to their owner unless the viewer is an administrator. Owners and
admins may abort, resume, download, and delete eligible tasks. The shared detail pages
provide an admin-only ownership reassignment control, limited to enabled target accounts.

Reassigning a task does not rewrite the owner of its durable `Tool` or `Benchmark` catalog
entry. Catalog ownership is separate from task ownership.

API visibility: the generic `Tool` and `Benchmark` viewsets are not filtered by owner,
and any enabled user can mutate those catalog records. The `Result` viewset is readable by
any authenticated user. Task records are owner-scoped, while catalog metadata and
normalized results are shared across those authenticated API users.

## Features not present in the shared admin UI

The current admin UI does not provide:

- login/impersonation as another user;
- create/delete AWS ENI actions;
- a manual scheduler/AWS refresh button;
- database backup or restore actions;
- arbitrary infrastructure shell operations.

AWS ENI and MAC fields still exist on the user model and can be populated through a
controlled administrative process. The retired legacy endpoints are not present.
