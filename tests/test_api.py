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


def test_track_scoreboard(api):
    from comp_eval_platform.core.models import Track

    track = Track.objects.create(name="main")
    resp = api.get(f"/api/tracks/{track.id}/scoreboard/")
    assert resp.status_code == 200
    assert resp.json()["columns"] == ["tool", "solved"]


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
