"""The single background job: refresh workers, then advance every in-progress task.

Strictly sequential (one APScheduler worker). Parallelism is in the *workers*
(multiple nodes/containers), not here. No-ops unless the scheduler is enabled.
Ported from VNN's automatic_update / fetch_updates / process_tasks + the node
timeout backstops (AwsManager._apply_timeout_backstops).
"""
import datetime
import traceback

from django.utils import timezone


def fetch_updates():
    """Reconcile Node rows via the active backend, then apply wall-clock backstops."""
    from comp_eval_platform.compute import get_backend

    get_backend().sync_instances()
    _apply_timeout_backstops()


def _apply_timeout_backstops():
    from comp_eval_platform.core.models import Node, RuntimeSettings

    s = RuntimeSettings.get()
    enforce = s.enforce_timeouts
    for node in Node.objects.all():
        if node.task is not None:
            timeout_hours = node.task.effective_timeout_hours()
        else:
            timeout_hours = s.submission_timeout
        # Orphan nodes are leaked infra, always cleaned up; task-owning nodes only
        # when enforcement is on.
        too_old = node.created_at < timezone.now() - datetime.timedelta(hours=timeout_hours)
        if (enforce or node.task is None) and too_old:
            print(f"Node past {timeout_hours}h backstop, terminating", node)
            if node.task is not None and not node.task.done:
                node.task.timeout()
            else:
                node.terminate()
        elif node.task is None and node.created_at < timezone.now() - datetime.timedelta(minutes=15):
            print("Orphan node older than 15 min, terminating", node)
            node.terminate()


def process_tasks():
    """Status-check then advance every in-progress task. Each task is isolated so
    one task's transient error never aborts the whole cycle."""
    from comp_eval_platform.core.models import Task

    for task in Task.get_in_progress():
        try:
            task.refresh_from_db()
            if task.current_step is not None:
                task.current_step.refresh_from_db()
                task.current_step.handler.status_check()
        except Exception:
            print(f"status_check failed for {task}; continuing")
            traceback.print_exc()

    for task in Task.get_in_progress():
        try:
            task.refresh_from_db()
            if task.current_step is not None:
                task.current_step.handler.while_active()
        except Exception:
            print(f"while_active failed for {task}; continuing")
            traceback.print_exc()


def automatic_update():
    """Periodic job. No-ops unless the scheduler is enabled (master switch)."""
    from comp_eval_platform.core.models import RuntimeSettings

    if not RuntimeSettings.get().scheduler_enabled:
        return {"success": False, "message": "scheduler disabled"}
    fetch_updates()
    process_tasks()
    return {"success": True}
