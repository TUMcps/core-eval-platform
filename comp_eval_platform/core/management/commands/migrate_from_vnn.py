"""One-off ETL: import a legacy VNN-COMP database (the _db_ SQLAlchemy-shim schema)
into the clean schema.

Reads the old Postgres directly and recreates:
  vnncomp_users            -> core.User (password hashes copied verbatim)
  vnncomp_toolkit_tasks    -> core.Tool + core.Task (a tool run)
  vnncomp_benchmark_tasks  -> core.Benchmark + core.Task
  vnncomp_task_steps       -> core.TaskStep  (terminal bookkeeping steps fold into Task.outcome)
  vnncomp_logs             -> core.Log
  vnncomp_settings         -> core.RuntimeSettings

Run in the backend container, pointing --host at the old DB, e.g.:
  manage.py migrate_from_vnn --host vnn-old-db --flush
"""
import os

import psycopg2
import psycopg2.extras
from django.core.management.base import BaseCommand
from django.db import transaction

from comp_eval_platform.core.models import (
    Benchmark, Category, Log, RuntimeSettings, Task, TaskStep, Tool, User,
)

# Old polymorphic step type -> new step kind. Terminal types are handled via outcome.
KIND_MAP = {
    "task_assign": "assign", "task_shutdown": "shutdown", "task_pause": "vnn_pause",
    "task_toolkit_create": "vnn_create", "task_benchmark_create": "vnn_create",
    "task_toolkit_initialize": "vnn_initialize", "task_benchmark_initialize": "vnn_initialize",
    "task_toolkit_clone": "vnn_clone", "task_benchmark_clone": "vnn_clone",
    "task_toolkit_install": "vnn_install", "task_toolkit_post_install": "vnn_post_install",
    "task_toolkit_restart": "vnn_restart",
    "task_toolkit_run": "run_benchmark", "task_benchmark_run": "run_benchmark",
    "task_toolkit_github_export": "vnn_export", "task_benchmark_github_export": "vnn_export",
}
TERMINAL = {"task_failure": "failed", "task_timeout": "timed_out", "task_abortion": "aborted"}


def _step_status(done, active, aborted):
    if aborted:
        return "aborted"
    if done:
        return "done"
    if active:
        return "active"
    return "pending"


class Command(BaseCommand):
    help = "Import a legacy VNN-COMP database into the clean schema."

    def add_arguments(self, parser):
        parser.add_argument("--host", default=os.getenv("OLD_DB_HOST", "vnn-old-db"))
        parser.add_argument("--dbname", default="vnncomp_db")
        parser.add_argument("--user", default="vnncomp_user")
        parser.add_argument("--password", default="vnncomp_password")
        parser.add_argument("--flush", action="store_true", help="Delete existing new-schema data first.")

    def handle(self, *args, **opts):
        conn = psycopg2.connect(host=opts["host"], dbname=opts["dbname"], user=opts["user"], password=opts["password"])
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        with transaction.atomic():
            if opts["flush"]:
                for M in (Log, TaskStep, Task, Tool, Benchmark):
                    M.objects.all().delete()
                User.objects.exclude(is_superuser=True).delete()
            category, _ = Category.objects.get_or_create(name="default")

            umap = self._users(cur)
            self.stdout.write(f"users: {len(umap)}")
            task_map, outcomes = self._tasks(cur, umap, category)
            self.stdout.write(f"tasks: {len(task_map)}")
            step_map = self._steps(cur, task_map, outcomes)
            self.stdout.write(f"steps: {len(step_map)}")
            n_logs = self._logs(cur, step_map)
            self.stdout.write(f"logs: {n_logs}")
            self._settings(cur)

        conn.close()
        self.stdout.write(self.style.SUCCESS("VNN-COMP import complete."))

    # -- users ------------------------------------------------------------
    def _users(self, cur):
        cur.execute("SELECT * FROM vnncomp_users")
        umap = {}
        for r in cur.fetchall():
            email = (r.get("username") or r.get("email") or "").strip()
            if not email:
                continue
            u, _ = User.objects.get_or_create(email=email, defaults={
                "name": (r.get("name") or "").strip(),
                "role": "admin" if r["admin"] else "user",
                "enabled": bool(r["enabled"]),
                "is_staff": bool(r["is_staff"]),
                "is_superuser": bool(r["is_superuser"]),
                "aws_eni": r.get("eni"), "aws_mac": r.get("mac"),
                "deleted_runtime": r.get("deleted_runtime") or 0,
            })
            u.password = r["password"] or ""  # copy the hash so logins keep working
            u.name = (r.get("name") or "").strip()  # backfill on re-runs, not just create
            u.save(update_fields=["password", "name"])
            if r.get("created_on"):
                User.objects.filter(pk=u.pk).update(created_at=r["created_on"])
            umap[r["id"]] = u
        return umap

    # -- tasks (toolkit -> Tool+Task, benchmark -> Benchmark+Task) ---------
    def _tasks(self, cur, umap, category):
        cur.execute("""
            SELECT t.*, tk._db_user_id AS tk_user, tk._db_eni, tk._db_post_install_tool,
                   tk._db_run_networks, tk._db_run_install_as_root, tk._db_run_tool_as_root,
                   bm._db_user_id AS bm_user, bm._db_vnnlib_version, bm._db_onnx_dir, bm._db_vnnlib_dir
            FROM vnncomp_tasks t
            LEFT JOIN vnncomp_toolkit_tasks tk ON tk.task_ptr_id = t._db_id
            LEFT JOIN vnncomp_benchmark_tasks bm ON bm.task_ptr_id = t._db_id
            ORDER BY t._db_id
        """)
        task_map, outcomes = {}, {}
        for r in cur.fetchall():
            owner = umap.get(r["tk_user"] or r["bm_user"])
            created = r["_db_created_at"]
            if r["_db_type"] == "toolkit_task":
                tool = Tool.objects.create(
                    owner=owner, category=category, name=r["_db_name"] or "toolkit",
                    repository=r["_db_repository"] or "", hash=r["_db_hash"] or "",
                    base_image=r["_db_ami"] or "", script_dir=r["_db_script_dir"] or "",
                    extra={"post_install_tool": r["_db_post_install_tool"], "eni": r["_db_eni"],
                           "run_networks": r["_db_run_networks"],
                           "run_install_as_root": r["_db_run_install_as_root"],
                           "run_tool_as_root": r["_db_run_tool_as_root"]},
                )
                task = Task.objects.create(owner=owner, tool=tool, total_runtime=r["_db_total_runtime"])
                if created:
                    Tool.objects.filter(pk=tool.pk).update(created_at=created)
            else:
                name = r["_db_name"] or "benchmark"
                extra = {"vnnlib_version": r["_db_vnnlib_version"], "onnx_dir": r["_db_onnx_dir"],
                         "vnnlib_dir": r["_db_vnnlib_dir"], "repository": r["_db_repository"],
                         "hash": r["_db_hash"] or ""}
                # One Benchmark row per name: a re-submission overwrites it (latest config
                # wins), but each submission still becomes its own Task so the history stays.
                bench, is_new = Benchmark.objects.get_or_create(
                    category=category, name=name, defaults={"owner": owner, "extra": extra})
                if is_new:
                    if created:
                        Benchmark.objects.filter(pk=bench.pk).update(created_at=created)
                else:
                    bench.owner, bench.extra = owner, extra
                    bench.save(update_fields=["owner", "extra"])
                task = Task.objects.create(owner=owner, benchmark=bench, total_runtime=r["_db_total_runtime"])
            if created:
                Task.objects.filter(pk=task.pk).update(created_at=created)
            task_map[r["_db_id"]] = task
            outcomes[r["_db_id"]] = {"terminal": None, "any_active": False, "any_pending": False, "task": task}
        return task_map, outcomes

    # -- steps ------------------------------------------------------------
    def _steps(self, cur, task_map, outcomes):
        cur.execute("""
            SELECT s._db_id, s._db_task_id, s._db_type, s.done, s.active, s._db_aborted,
                   s._db_run_as_root, tr.benchmark_name, tr._db_started_at, tr._db_finished_at
            FROM vnncomp_task_steps s
            LEFT JOIN tasks_toolkitrun tr ON tr.taskstep_ptr_id = s._db_id
            ORDER BY s._db_task_id, s._db_id
        """)
        rows = cur.fetchall()
        step_objs, step_meta, order_by_task = [], [], {}
        for r in rows:
            task = task_map.get(r["_db_task_id"])
            if task is None:
                continue
            oc = outcomes.get(r["_db_task_id"])
            if r["_db_type"] in TERMINAL:
                if oc and oc["terminal"] is None:
                    oc["terminal"] = TERMINAL[r["_db_type"]]
                continue
            kind = KIND_MAP.get(r["_db_type"], r["_db_type"].replace("task_", "vnn_"))
            status = _step_status(r["done"], r["active"], r["_db_aborted"])
            if oc:
                if status == "active":
                    oc["any_active"] = True
                elif status == "pending":
                    oc["any_pending"] = True
            order = order_by_task.get(r["_db_task_id"], 0)
            order_by_task[r["_db_task_id"]] = order + 1
            payload = {}
            if kind == "run_benchmark":
                payload["benchmark_name"] = r["benchmark_name"] or (task.tool.name if task.tool_id else "benchmark")
            step_objs.append(TaskStep(
                task=task, kind=kind, order=order, status=status,
                run_as_root=bool(r["_db_run_as_root"]), payload=payload,
                started_at=r["_db_started_at"], finished_at=r["_db_finished_at"],
            ))
            step_meta.append(r["_db_id"])

        TaskStep.objects.bulk_create(step_objs, batch_size=1000)
        step_map = {old_id: obj for old_id, obj in zip(step_meta, step_objs)}

        # Derive each task's outcome now that all steps are seen.
        from comp_eval_platform.core.models.execution import Outcome
        for oc in outcomes.values():
            task = oc["task"]
            if oc["terminal"]:
                task.outcome = oc["terminal"]
            elif oc["any_active"] or oc["any_pending"]:
                task.outcome = Outcome.RUNNING
            else:
                task.outcome = Outcome.SUCCEEDED
            task.save(update_fields=["outcome"])
        return step_map

    # -- logs -------------------------------------------------------------
    def _logs(self, cur, step_map):
        cur.execute("SELECT _db_step_id, _db_text FROM vnncomp_logs")
        logs = [Log(step=step_map[r["_db_step_id"]], text=r["_db_text"] or "")
                for r in cur.fetchall() if r["_db_step_id"] in step_map]
        Log.objects.bulk_create(logs, batch_size=1000)
        return len(logs)

    # -- settings ---------------------------------------------------------
    def _settings(self, cur):
        cur.execute("SELECT * FROM vnncomp_settings LIMIT 1")
        r = cur.fetchone()
        if not r:
            return
        s = RuntimeSettings.get()
        s.scheduler_enabled = bool(r["_db_aws_enabled"])
        s.execution_backend = r["_db_execution_backend"] or "local_docker"
        s.terminate_at_end = bool(r["_db_aws_terminate_at_end"])
        s.terminate_on_failure = bool(r["_db_aws_terminate_on_failure"])
        s.allow_non_admin_login = bool(r["_db_allow_non_admin_login"])
        s.users_can_submit_benchmarks = bool(r["_db_users_can_submit_benchmarks"])
        s.users_can_submit_tools = bool(r["_db_users_can_submit_tools"])
        s.submission_timeout = r["_db_submission_timeout"] or 4
        s.benchmark_timeout = r["_db_benchmark_timeout"] or 6
        s.enforce_timeouts = bool(r["_db_enforce_timeouts"])
        s.allow_full_evaluation = bool(r["_db_allow_full_evaluation"])
        s.save()
