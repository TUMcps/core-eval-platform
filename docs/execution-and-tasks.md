# Execution and tasks

## State machine

A task starts as `pending`, becomes `running` when its first step activates, and finishes
as `succeeded`, `failed`, `timed_out`, or `aborted`. Steps are ordered data records with
the statuses `pending`, `active`, `done`, `failed`, or `aborted`.

The active plugin decides which steps exist. Core supplies the generic handlers:

- `assign` attaches a free compatible worker or asks the compute backend to provision one;
- `pause` waits until an owner or admin resumes the task;
- `shutdown` releases the worker and completes cleanup.

Plugin handlers implement stages such as installation, benchmark execution, validation,
generation, conversion, and export.

## Scheduler

APScheduler starts only when `SCHEDULER_AUTOSTART=True`. On every configured interval its
single background job:

1. returns immediately if the database setting `scheduler_enabled` is false;
2. asks the active compute backend to reconcile `Node` rows with real workers;
3. applies node and task timeout backstops;
4. calls `status_check()` for every active task;
5. calls `while_active()` for every still-active step.

The scheduler loop is deliberately single-threaded. Work still runs concurrently because
multiple workers execute between scheduler ticks. `MAX_PARALLEL_NODES` limits the number
of workers the assignment handler can provision.

## Callbacks and logs

Long-running node scripts call one of these endpoints:

```text
POST <ROOT_URL>/update/<task-id>/success
POST <ROOT_URL>/update/<task-id>/failure
```

The optional request body becomes the current step's latest log. During an active step,
the scheduler can also tail the handler's declared node log. `LIVE_LOG_TAIL_BYTES` bounds
the stored tail so verbose jobs cannot grow the database and API response indefinitely.

`ROOT_URL` must resolve from the worker, not only from the browser or backend container.
For Docker Compose this is normally an internal service URL; remote workers need a
reachable routed address.

## Result collection

Run handlers must collect their artifacts while the worker still exists. Core can copy a
`results.csv` into a temporary directory and stores the raw CSV on the step payload for
display and downloads. The plugin parser converts it into normalized `Result` rows.

Partial CSV content may be copied into the payload while a benchmark is running, allowing
the detail page to show processed and total instance counts. Aborting only the current
benchmark finalizes any partial results and advances to the next benchmark when the plugin
supports that operation.

## Retries and failure behavior

A handler may declare that it should retry until success. Clone and installation steps
typically do this because network failures can be transient. Retries are bounded by
`MAX_STEP_RETRIES`; exhaustion fails the task.

On failure, timeout, or full-task abort, core marks remaining non-cleanup steps aborted and
jumps to the trailing `shutdown` step. Worker termination is best-effort so a cleanup error
does not wedge the database state.

## Timeouts

When `enforce_timeouts` is enabled, a task-owning node receives an effective backstop of:

```text
submission_timeout + (max(1, number of benchmark run steps) × benchmark_timeout)
```

The minimum one-benchmark allowance applies even to tasks with no benchmark run step.

Orphan workers are always subject to cleanup. An unassigned node older than 15 minutes is
terminated, and older unassigned nodes are bounded by `submission_timeout`.

A plugin can additionally apply a per-step timeout. VNN-COMP currently applies
`benchmark_timeout` to each benchmark run. Tool-level per-instance timeouts remain part of
the competition's node harness rather than the generic core state machine.

## Operator controls

An owner or admin can abort a task, abort only a supported current benchmark, resume a
paused task, download available results, and delete a finished task. Deleting a task
cascades its steps, logs, and results but does not delete the durable benchmark catalog
entry. An admin can reassign a task to another enabled account.
