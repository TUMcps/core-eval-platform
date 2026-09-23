# Architecture

The platform is one shared engine plus one active competition plugin. A deployment runs
exactly one competition, selected by `ACTIVE_COMPETITION`, but may switch its compute
backend at runtime.

## Components

| Component | Responsibility |
| --- | --- |
| Shared React frontend | Authentication, submission forms, task details, logs, results, scoreboards, and administration |
| Django REST backend | Persistent state, validation, APIs, scheduler, callbacks, result storage, and plugin dispatch |
| PostgreSQL | Users, catalog entries, tasks, steps, logs, settings, nodes, and normalized results |
| Competition plugin | Submission rules, step graph, node scripts, result parsing, scoring, presentation, and exports |
| Compute backend | Provision, discover, and terminate workers |
| Worker | Install and run submitted code, write artifacts and logs, and report completion |

The competition and compute axes are independent. For example, ARCH-COMP and VNN-COMP
can both run on `local_docker`; VNN-COMP may also be deployed with AWS when the required
AWS lifecycle integration is supplied.

## Plugin contract

A plugin registers a `Competition` implementation from its Django `AppConfig`. The six
main extension points are:

1. validate tool and benchmark submissions;
2. build an ordered task-step graph;
3. provide node scripts and their input/output contract;
4. parse raw artifacts into normalized results;
5. score organizer-managed tracks;
6. provide UI presentation and export behavior.

Core never imports a specific competition. `ACTIVE_COMPETITION` selects a registered
implementation, and all variant-specific behavior is reached through that contract.

## Durable catalog and executions

Catalog entries and executions are intentionally separate:

- `Category` groups competition-specific formats. ARCH-COMP has several categories;
  VNN-COMP uses an implicit `default` category.
- `Tool` records a submitted tool repository, revision, image, script location, and
  plugin-specific options.
- `Benchmark` records a named set of instances and its logical group.
- `Instance` records one runnable case and a plugin-specific `spec` object.
- `Track` is an organizer-curated collection of benchmarks used for scoreboards.
- `Task` is one execution of a tool or benchmark submission.
- `TaskStep` is one ordered stage in that execution. Its behavior is supplied by a
  registered handler for its `kind`.
- `Result` is a normalized per-instance outcome associated with a task, tool, benchmark,
  category, and optionally a known instance.

Competition-specific values live in JSON fields such as `Tool.extra`, `Benchmark.extra`,
`Instance.spec`, and `TaskStep.payload`. This keeps the core database schema independent
of any one competition.

## End-to-end flow

1. The browser submits a tool or benchmark through the shared API.
2. The form endpoints check permissions and required shared fields. The lower-level tool
   `run` action additionally calls plugin and compute-image validation; the form endpoints
   do not currently share that full validation path.
3. A `Task` is created and the plugin builds its ordered `TaskStep` rows.
4. The generic `assign` step reuses or provisions a compatible worker through the active
   compute backend.
5. Plugin handlers start node-side work. Long-running scripts report success or failure to
   `ROOT_URL/update/<task-id>/...`.
6. The scheduler reconciles workers, checks active steps, tails bounded log output, and
   enforces configured backstops.
7. Completed run steps collect artifacts before shutdown, ask the plugin to parse them,
   and store normalized `Result` rows.
8. The final `shutdown` step releases the worker even after failure, timeout, or abort.
9. Scoreboard requests pass an organizer-managed track to the plugin's scorer.

## Frontend boundary

The frontend is shared. The active plugin currently contributes branding, landing-page
content, participant guides, benchmark-form fields, benchmark groups, and whether toolkit
submissions use categories. The toolkit form otherwise has a shared fixed schema, raw
result CSV is rendered directly, and score columns come from the scorer response.

`Presentation.submission_fields`, `result_columns`, and `score_columns` are exposed as
metadata but are not generic frontend-rendering contracts. Competition-specific rendering
remains part of the shared frontend rather than a plugin-owned frontend fork.
