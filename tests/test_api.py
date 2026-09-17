"""REST API: submit + run a tool, add benchmark instances, read a scoreboard.

These exercise the variant-agnostic seams via the registered test competition."""
import pytest

pytestmark = pytest.mark.django_db


def test_create_and_run_tool(api, category):
    resp = api.post("/api/tools/", {
        "category": str(category.id), "name": "mytool", "repository": "https://example/repo",
    }, format="json")
    assert resp.status_code == 201, resp.content
    tool_id = resp.json()["id"]

    # run: validates via the competition, builds steps, executes to completion.
    run = api.post(f"/api/tools/{tool_id}/run/")
    assert run.status_code == 201, run.content
    body = run.json()
    assert body["outcome"] == "succeeded"
    assert len(body["steps"]) == 3


def test_toolkit_submission_records_its_environment(api, category):
    """The form sends KEY=VALUE lines; the tool keeps them as a dict for the step
    handlers, so one toolkit can be entered twice in different configurations."""
    from comp_eval_platform.core.models import RuntimeSettings, Tool

    settings = RuntimeSettings.get()
    settings.users_can_submit_tools = True
    settings.scheduler_enabled = True
    settings.save()

    resp = api.post("/api/toolkit/submit/", {
        "name": "mytool", "repository": "https://example/repo", "ami": "img",
        "env": "# the fast one\nTOOL_MODE=fast\n\nOMP_NUM_THREADS=1\nnonsense\n",
    }, format="json")
    assert resp.status_code == 201, resp.content
    tool = Tool.objects.get(name="mytool")
    assert tool.extra["env"] == {"TOOL_MODE": "fast", "OMP_NUM_THREADS": "1"}


def test_toolkit_form_exposes_the_random10_mode(api):
    resp = api.get("/api/toolkit/form_data/")
    assert resp.status_code == 200, resp.content
    modes = resp.json()["run_networks_options"]
    assert [m["value"] for m in modes] == ["all", "random10", "first"]


def test_run_requires_enabled_user(category):
    from rest_framework.test import APIClient

    from comp_eval_platform.core.models import Tool, User

    disabled = User.objects.create_user(email="off@x.test", password="pw", enabled=False)
    tool = Tool.objects.create(owner=disabled, category=category, name="t", repository="r")
    client = APIClient()
    client.force_authenticate(disabled)
    assert client.post(f"/api/tools/{tool.id}/run/").status_code == 403


def test_benchmark_add_instances(api, category):
    resp = api.post("/api/benchmarks/", {"category": str(category.id), "name": "b1"}, format="json")
    assert resp.status_code == 201, resp.content
    bid = resp.json()["id"]

    add = api.post(f"/api/benchmarks/{bid}/add_instances/",
                   [{"name": "i1"}, {"name": "i2"}], format="json")
    assert add.status_code == 201
    assert len(add.json()) == 2


def test_new_benchmark_is_always_assigned_to_default_group(api, category, monkeypatch):
    from comp_eval_platform.competitions import get_competition

    comp = get_competition()
    monkeypatch.setattr(type(comp), "benchmark_groups",
                        lambda self: ("default", "test", "regular", "extended"))

    created = api.post("/api/benchmarks/", {
        "category": str(category.id), "name": "good", "group": "regular",
    }, format="json")
    assert created.status_code == 201, created.content
    assert created.json()["group"] == "default"

    updated = api.patch(
        f"/api/benchmarks/{created.json()['id']}/", {"group": "regular"}, format="json",
    )
    assert updated.status_code == 200, updated.content
    assert updated.json()["group"] == "default"


def test_only_admin_can_assign_a_valid_benchmark_group(api, category, monkeypatch):
    from rest_framework.test import APIClient

    from comp_eval_platform.competitions import get_competition
    from comp_eval_platform.core.models import Benchmark, Role, User

    comp = get_competition()
    monkeypatch.setattr(type(comp), "benchmark_groups",
                        lambda self: ("default", "test", "regular", "extended"))
    benchmark = Benchmark.objects.create(category=category, name="grouped")

    forbidden = api.post(
        f"/api/benchmarks/{benchmark.id}/set_group/", {"group": "regular"}, format="json",
    )
    assert forbidden.status_code == 403

    admin = User.objects.create_user(
        email="group-admin@x.test", password="pw", enabled=True, role=Role.ADMIN,
    )
    admin_api = APIClient()
    admin_api.force_authenticate(admin)

    invalid = admin_api.post(
        f"/api/benchmarks/{benchmark.id}/set_group/", {"group": "mystery"}, format="json",
    )
    assert invalid.status_code == 400
    assert "Unknown benchmark group" in str(invalid.json())

    changed = admin_api.post(
        f"/api/benchmarks/{benchmark.id}/set_group/", {"group": "regular"}, format="json",
    )
    assert changed.status_code == 200, changed.content
    assert changed.json()["group"] == "regular"


def test_benchmark_submission_starts_in_default_and_preserves_admin_assignment(
        api, monkeypatch):
    from comp_eval_platform.competitions import get_competition
    from comp_eval_platform.core.models import Benchmark, RuntimeSettings

    comp = get_competition()
    monkeypatch.setattr(type(comp), "uses_categories", False)
    monkeypatch.setattr(type(comp), "benchmark_groups",
                        lambda self: ("default", "test", "regular", "extended"))
    settings = RuntimeSettings.get()
    settings.scheduler_enabled = True
    settings.users_can_submit_benchmarks = True
    settings.save(update_fields=["scheduler_enabled", "users_can_submit_benchmarks"])

    submitted = api.post("/api/benchmark/submit/", {
        "name": "submitted", "repository": "https://example.test/benchmark.git",
        "group": "regular",
    }, format="json")
    assert submitted.status_code == 201, submitted.content
    benchmark = Benchmark.objects.get(name="submitted")
    assert benchmark.group == "default"

    benchmark.group = "regular"
    benchmark.save(update_fields=["group"])
    resubmitted = api.post("/api/benchmark/submit/", {
        "name": "submitted", "repository": "https://example.test/updated.git",
        "group": "extended",
    }, format="json")
    assert resubmitted.status_code == 201, resubmitted.content
    benchmark.refresh_from_db()
    assert benchmark.group == "regular"


def test_toolkit_form_orders_benchmarks_by_configured_group(api, category, user, monkeypatch):
    from comp_eval_platform.competitions import get_competition
    from comp_eval_platform.core.models import Benchmark

    comp = get_competition()
    monkeypatch.setattr(type(comp), "benchmark_groups",
                        lambda self: ("test", "regular", "extended"))
    Benchmark.objects.create(owner=user, category=category, name="Zulu", group="regular", published=True)
    Benchmark.objects.create(owner=user, category=category, name="Alpha", group="extended", published=True)
    Benchmark.objects.create(owner=user, category=category, name="Smoke", group="test", published=True)

    body = api.get("/api/toolkit/form_data/").json()
    benchmarks = body["benchmark_categories"][category.name]["benchmarks"]

    assert body["benchmark_groups"] == ["test", "regular", "extended"]
    assert [(b["group"], b["name"]) for b in benchmarks] == [
        ("test", "Smoke"), ("regular", "Zulu"), ("extended", "Alpha"),
    ]


def test_track_scoreboard(api):
    from comp_eval_platform.core.models import Track

    track = Track.objects.create(name="main")
    resp = api.get(f"/api/tracks/{track.id}/scoreboard/")
    assert resp.status_code == 200
    assert resp.json()["columns"] == ["tool", "solved"]
    assert resp.json()["groups"] == [
        {"name": "default", "columns": ["tool", "solved"], "rows": []},
    ]


def test_scoreboard_exposes_each_configured_group(api, monkeypatch):
    from comp_eval_platform.competitions import get_competition
    from comp_eval_platform.core.models import Track
    from comp_eval_platform.results import Scoreboard

    comp = get_competition()
    monkeypatch.setattr(type(comp), "benchmark_groups", lambda self: ("test", "regular"))
    monkeypatch.setattr(type(comp), "score_group", lambda self, track, group: Scoreboard(
        columns=["tool", "solved"], rows=[{"tool": group, "solved": 1}],
    ))
    track = Track.objects.create(name="grouped")

    groups = api.get(f"/api/tracks/{track.id}/scoreboard/").json()["groups"]

    assert [group["name"] for group in groups] == ["test", "regular"]
    assert [group["rows"][0]["tool"] for group in groups] == ["test", "regular"]


def test_task_progress_uses_current_catalog_group_and_snapshot_fallback(api, category, user):
    from comp_eval_platform.core.models import Benchmark, Task, TaskStep, Tool

    benchmark = Benchmark.objects.create(
        owner=user, category=category, name="catalog-name", group="regular",
    )
    tool = Tool.objects.create(owner=user, category=category, name="tool")
    task = Task.objects.create(owner=user, tool=tool)
    TaskStep.objects.create(task=task, kind="run_benchmark", order=0, payload={
        "benchmark_id": str(benchmark.id),
        "benchmark_name": "snapshot-name",
        "benchmark_group": "test",
    })
    TaskStep.objects.create(task=task, kind="run_benchmark", order=1, payload={
        "benchmark_id": str(benchmark.id),
    })
    TaskStep.objects.create(task=task, kind="run_benchmark", order=2, payload={
        "benchmark_id": "999999", "benchmark_name": "removed",
        "benchmark_group": "extended",
    })

    progress = api.get(f"/api/tasks/{task.id}/").json()["benchmark_progress"]

    assert [(item["name"], item["group"]) for item in progress] == [
        ("snapshot-name", "regular"), ("catalog-name", "regular"),
        ("removed", "extended"),
    ]


def _rows(resp):
    data = resp.json()
    return data.get("results", data) if isinstance(data, dict) else data


@pytest.fixture
def export_task(user, category, tmp_path, monkeypatch):
    """A task with a done 'export' step whose artifacts the test competition points at."""
    from comp_eval_platform.competitions import get_competition
    from comp_eval_platform.core.models import Task, TaskStep, Tool

    tool = Tool.objects.create(owner=user, category=category, name="t", repository="r")
    task = Task.objects.create(owner=user, tool=tool)
    step = TaskStep.objects.create(task=task, kind="t_ok", order=0, status="done")
    (tmp_path / "results.csv").write_text("onnx/a.onnx,vnnlib/p.vnnlib,unsat,1.0\n")
    (tmp_path / "a_p.counterexample.gz").write_bytes(b"\x1f\x8b binary")
    monkeypatch.setattr(type(get_competition()), "exported_artifacts_dir",
                        lambda self, s: str(tmp_path) if s.status == "done" else None,
                        raising=False)
    return task, step


def test_results_archive_zips_the_exported_files(api, export_task):
    import io
    import zipfile

    task, step = export_task

    resp = api.get(f"/api/tasks/{task.id}/results-archive/?step={step.order}")

    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/zip"
    assert "attachment" in resp["Content-Disposition"]
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        assert sorted(z.namelist()) == ["a_p.counterexample.gz", "results.csv"]
        assert z.read("results.csv").decode().startswith("onnx/a.onnx")


def test_results_archive_409s_before_the_export_finished(api, export_task):
    task, step = export_task
    step.status = "active"
    step.save(update_fields=["status"])

    resp = api.get(f"/api/tasks/{task.id}/results-archive/?step={step.order}")

    assert resp.status_code == 409
    assert "not exported yet" in resp.json()["error"]


def test_results_archive_is_not_readable_by_another_user(api, export_task, django_user_model):
    """A submission's artifacts are the owner's (or an admin's), not everyone's."""
    from rest_framework.test import APIClient

    task, step = export_task
    other = django_user_model.objects.create_user(
        email="someone@else.test", password="pw", enabled=True)
    client = APIClient()
    client.force_authenticate(other)

    resp = client.get(f"/api/tasks/{task.id}/results-archive/?step={step.order}")

    assert resp.status_code in (403, 404)  # scoped queryset hides it before the check


def test_results_for_a_task_carry_names_and_run_order(api, category, user):
    """What the submission page's results table reads: one task's rows, in run order,
    named rather than by FK id."""
    from comp_eval_platform.core.models import Benchmark, Instance, Result, Task, Tool

    tool = Tool.objects.create(owner=user, category=category, name="t", repository="r")
    bench = Benchmark.objects.create(owner=user, category=category, name="acasxu")
    task = Task.objects.create(owner=user, tool=tool)
    other = Task.objects.create(owner=user, tool=tool)
    second = Instance.objects.create(benchmark=bench, name="net_b/prop_1", order=1)
    first = Instance.objects.create(benchmark=bench, name="net_a/prop_1", order=0)
    # Created out of run order, so only ordering by the instance's order sorts them right.
    Result.objects.create(task=task, tool=tool, benchmark=bench, category=category,
                          instance=second, result="sat", time=2.0)
    Result.objects.create(task=task, tool=tool, benchmark=bench, category=category,
                          instance=first, result="unsat", time=1.0)
    Result.objects.create(task=other, tool=tool, benchmark=bench, category=category,
                          instance=first, result="timeout", time=9.0)

    rows = _rows(api.get(f"/api/results/?task={task.id}"))

    assert [(r["instance_name"], r["result"]) for r in rows] == [
        ("net_a/prop_1", "unsat"), ("net_b/prop_1", "sat"),  # the other task's row is excluded
    ]
    assert rows[0]["benchmark_name"] == "acasxu"


def test_abort_benchmark_endpoint_aborts_only_the_running_step(api, category, user):
    """POST /tasks/<id>/abort-benchmark/ cuts the running benchmark short (recorded
    Aborted) and advances, while a step that is not an abortable benchmark is rejected."""
    from comp_eval_platform.core.models import Task, TaskStep, Tool
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND

    tool = Tool.objects.create(owner=user, category=category, name="t")
    task = Task.objects.create(owner=user, tool=tool, outcome="running")
    run = TaskStep.objects.create(task=task, kind="t_abortable", order=0)
    TaskStep.objects.create(task=task, kind="t_ok", order=1)
    TaskStep.objects.create(task=task, kind=SHUTDOWN_KIND, order=2)
    task.current_step = run
    task.save(update_fields=["current_step"])
    run.mark_active()

    resp = api.post(f"/api/tasks/{task.id}/abort-benchmark/")
    assert resp.status_code == 200, resp.content
    run.refresh_from_db()
    assert run.status == "aborted"

    # The task advanced past the run; the current step is no longer abortable, so a
    # second call is rejected rather than aborting an unrelated step.
    again = api.post(f"/api/tasks/{task.id}/abort-benchmark/")
    assert again.status_code == 400


def test_result_without_an_instance_still_serializes(api, category, user):
    """Runs from before instances were recorded have a null instance FK."""
    from comp_eval_platform.core.models import Benchmark, Result, Task, Tool

    tool = Tool.objects.create(owner=user, category=category, name="t", repository="r")
    bench = Benchmark.objects.create(owner=user, category=category, name="acasxu")
    task = Task.objects.create(owner=user, tool=tool)
    Result.objects.create(task=task, tool=tool, benchmark=bench, category=category,
                          instance=None, result="unsat", time=50.36)

    rows = _rows(api.get(f"/api/results/?task={task.id}"))

    assert rows[0]["instance_name"] is None
    assert rows[0]["result"] == "unsat"
