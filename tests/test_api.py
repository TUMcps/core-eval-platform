"""REST API: submit + run a tool, publish a benchmark, read a scoreboard.

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


def test_benchmark_add_instances_and_publish(api, category):
    resp = api.post("/api/benchmarks/", {"category": str(category.id), "name": "b1"}, format="json")
    assert resp.status_code == 201, resp.content
    bid = resp.json()["id"]

    add = api.post(f"/api/benchmarks/{bid}/add_instances/",
                   [{"name": "i1"}, {"name": "i2"}], format="json")
    assert add.status_code == 201
    assert len(add.json()) == 2

    pub = api.post(f"/api/benchmarks/{bid}/publish/")
    assert pub.status_code == 200
    assert pub.json()["published"] is True


def test_track_scoreboard(api):
    from comp_eval_platform.core.models import Track

    track = Track.objects.create(name="main")
    resp = api.get(f"/api/tracks/{track.id}/scoreboard/")
    assert resp.status_code == 200
    assert resp.json()["columns"] == ["tool", "solved"]
