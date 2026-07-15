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
