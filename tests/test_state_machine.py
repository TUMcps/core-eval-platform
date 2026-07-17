"""Task/TaskStep advance semantics: success, failure, timeout, abort, and that a
terminal outcome still runs the trailing shutdown to release the worker."""
import uuid

import pytest

pytestmark = pytest.mark.django_db


def _mk_task(kinds):
    """A RUNNING task with the given step kinds; step 0 active (as after start())."""
    from comp_eval_platform.core.models import Category, Task, TaskStep, Tool, User

    u = User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw", enabled=True)
    cat = Category.objects.create(name=f"c{uuid.uuid4().hex[:6]}")
    tool = Tool.objects.create(owner=u, category=cat, name="t")
    task = Task.objects.create(owner=u, tool=tool, outcome="running")
    steps = [TaskStep.objects.create(task=task, kind=k, order=i) for i, k in enumerate(kinds)]
    task.current_step = steps[0]
    task.save(update_fields=["current_step"])
    steps[0].mark_active()
    return task, steps


def test_happy_path_completes_and_marks_all_done():
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    task, steps = _mk_task(["t_ok", "t_ok", SHUTDOWN_KIND])
    task.current_step.handler.execute()  # cascades through the whole graph

    task.refresh_from_db()
    assert task.outcome == Outcome.SUCCEEDED
    assert task.current_step is None
    for s in steps:
        s.refresh_from_db()
        assert s.status == "done"


def test_failure_finalizes_and_still_runs_shutdown():
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    task, (ok, fail, shutdown) = _mk_task(["t_ok", "t_fail", SHUTDOWN_KIND])
    task.current_step.handler.execute()

    task.refresh_from_db()
    assert task.outcome == Outcome.FAILED
    fail.refresh_from_db(), shutdown.refresh_from_db()
    assert fail.status == "aborted"
    assert shutdown.status == "done"  # worker released even on failure


def test_abort_finalizes_and_runs_shutdown():
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    task, steps = _mk_task(["t_ok", "t_ok", SHUTDOWN_KIND])
    task.abort()

    task.refresh_from_db()
    assert task.outcome == Outcome.ABORTED
    steps[2].refresh_from_db()
    assert steps[2].status == "done"


def test_timeout_finalizes():
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    task, _ = _mk_task(["t_ok", "t_ok", SHUTDOWN_KIND])
    task.timeout(check_status=False)

    task.refresh_from_db()
    assert task.outcome == Outcome.TIMED_OUT


def test_finalize_without_shutdown_still_finishes():
    from comp_eval_platform.core.models.execution import Outcome

    task, _ = _mk_task(["t_ok", "t_fail"])
    task.current_step.handler.execute()

    task.refresh_from_db()
    assert task.outcome == Outcome.FAILED
    assert task.done
    assert task.current_step is None


def test_finalize_is_idempotent():
    from comp_eval_platform.core.models.execution import Outcome

    task, _ = _mk_task(["t_ok", "t_ok"])
    task.abort()
    task.refresh_from_db()
    first = task.outcome
    task.timeout(check_status=False)  # already terminal → no-op
    task.refresh_from_db()
    assert task.outcome == first == Outcome.ABORTED


def test_retrying_step_is_bounded_and_fails_the_task(settings):
    """A retrying step re-executes from step_failed, so one whose execute() fails
    synchronously must not ping-pong with it until the stack overflows."""
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    settings.MAX_STEP_RETRIES = 3
    task, (retry, shutdown) = _mk_task(["t_retry_fail", SHUTDOWN_KIND])
    task.current_step.handler.execute()

    task.refresh_from_db(), retry.refresh_from_db(), shutdown.refresh_from_db()
    assert retry.retries == 3
    assert task.outcome == Outcome.FAILED
    assert shutdown.status == "done"  # worker still released


def test_assign_claims_a_free_node_matching_the_resolved_image():
    """A backend may resolve the requested image (empty -> its default) and stores the
    resolved value on the Node, so matching has to resolve too — otherwise a task can
    never claim the node it just provisioned and waits on `assign` forever."""
    from comp_eval_platform.core.models import Node

    task, (assign, _ok) = _mk_task(["assign", "t_ok"])  # tool has no base_image
    Node.objects.create(id="c1", node_type="local", image="ubuntu:22.04",
                        state="running", reachability="ok", ip="10.0.0.2")

    task.current_step.handler.execute()

    task.refresh_from_db(), assign.refresh_from_db()
    assert task.node is not None and task.node.id == "c1"
    assert assign.status == "done"


def test_assign_fails_the_task_when_the_image_is_invalid_for_the_backend():
    """An AMI id cannot boot under local_docker. It must fail with a readable reason
    rather than silently run against a substituted image or wait on `assign` forever."""
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND, Outcome

    task, (assign, shutdown) = _mk_task(["assign", SHUTDOWN_KIND])
    task.tool.base_image = "ami-0d70546e43a941d70"
    task.tool.save(update_fields=["base_image"])

    task.current_step.handler.execute()

    task.refresh_from_db(), assign.refresh_from_db(), shutdown.refresh_from_db()
    assert task.outcome == Outcome.FAILED
    assert "AMI" in assign.logs and "ami-0d70546e43a941d70" in assign.logs
    assert shutdown.status == "done"


def test_start_builds_graph_from_competition():
    from comp_eval_platform.core.models import Category, Task, Tool, User
    from comp_eval_platform.core.models.execution import Outcome

    u = User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw", enabled=True)
    cat = Category.objects.create(name=f"c{uuid.uuid4().hex[:6]}")
    tool = Tool.objects.create(owner=u, category=cat, name="t")
    task = Task.objects.create(owner=u, tool=tool)

    task.start()  # test competition builds [t_ok, t_ok, shutdown]

    task.refresh_from_db()
    assert task.step_set.count() == 3
    assert task.outcome == Outcome.SUCCEEDED
