"""Execution state machine: a Task owns an ordered list of TaskSteps and advances
through them. Ported from VNN's Task/TaskStep, with two clean-schema changes:

* Steps are **data** (``kind`` + status + payload); behavior lives in a
  ``StepHandler`` registered by kind (see ``core/steps.py``), not in polymorphic
  subclasses. The active competition's ``build_steps`` emits the rows.
* Terminal outcomes (fail/timeout/abort) are recorded on ``Task.outcome`` instead
  of pseudo terminal steps. On a terminal outcome the machine still jumps to the
  trailing ``shutdown`` step so the worker is released, then finishes.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Outcome(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"
    TIMED_OUT = "timed_out", "Timed out"
    ABORTED = "aborted", "Aborted"


TERMINAL_OUTCOMES = (Outcome.SUCCEEDED, Outcome.FAILED, Outcome.TIMED_OUT, Outcome.ABORTED)


class StepStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACTIVE = "active", "Active"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"
    ABORTED = "aborted", "Aborted"


#: Well-known step kind that releases the worker; the machine keeps it runnable
#: even on a terminal outcome so a failed/aborted task still tears its node down.
SHUTDOWN_KIND = "shutdown"

#: Well-known step kind that holds the task until an operator resumes it (the
#: ``resume`` API advances past it). Never auto-advances.
PAUSE_KIND = "pause"


class Task(models.Model):
    """One execution job of the step machine, processing a Tool or a Benchmark."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tasks",
    )
    # Exactly one subject is set: a tool-run task iterates the track's benchmarks
    # into per-benchmark/-instance steps; a benchmark task processes a submission.
    tool = models.ForeignKey("core.Tool", on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    benchmark = models.ForeignKey("core.Benchmark", on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")

    current_step = models.ForeignKey(
        "core.TaskStep", on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
    )
    outcome = models.CharField(max_length=16, choices=Outcome.choices, default=Outcome.PENDING)
    total_runtime = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_task"

    def __str__(self):
        subject = self.tool or self.benchmark
        return f"Task #{self.id} [{subject}]"

    # --- Queries ---------------------------------------------------------
    @property
    def steps(self):
        return self.step_set.order_by("order")

    @property
    def node(self):
        return self.nodes.first()

    @property
    def done(self) -> bool:
        return self.outcome in TERMINAL_OUTCOMES

    def effective_timeout_hours(self) -> int:
        """Per-task wall-clock backstop (hours): the submission overhead allowance
        plus the per-benchmark budget for every benchmark this task runs."""
        from comp_eval_platform.core.models.settings import RuntimeSettings

        s = RuntimeSettings.get()
        n_benchmarks = self.step_set.filter(kind="run_benchmark").count() or 1
        return s.submission_timeout + n_benchmarks * s.benchmark_timeout

    # --- Lifecycle -------------------------------------------------------
    def start(self):
        """Build the step graph from the active competition and execute the first step."""
        from comp_eval_platform.competitions import get_competition

        get_competition().build_steps(self)  # creates ordered TaskStep rows
        first = self.steps.first()
        self.outcome = Outcome.RUNNING
        self._set_current_step(first)
        self.save()
        if self.current_step is not None:
            try:
                self.current_step.handler.execute()
            except Exception:
                # A provisioning/execute error must not fail the submit request: the
                # step stays active and the scheduler retries it (as process_tasks does).
                import traceback
                print(f"start(): initial execute failed for {self}; scheduler will retry")
                traceback.print_exc()

    def _set_current_step(self, step):
        """Mark the old current step done, activate the new one. Mirrors VNN's
        update_current_step (which committed each change so partial progress
        survives a later execute() throwing)."""
        old = self.current_step
        if old is not None:
            old.refresh_from_db()
            if old.status not in (StepStatus.DONE, StepStatus.ABORTED, StepStatus.FAILED):
                old.mark_done()
        self.current_step = step
        self.save(update_fields=["current_step"])
        if step is not None:
            step.mark_active()
        elif self.outcome == Outcome.RUNNING:
            # No steps left and nothing went wrong → the task succeeded.
            self.outcome = Outcome.SUCCEEDED
            self.save(update_fields=["outcome"])

    def step_succeeded(self, check_status: bool = True):
        self.refresh_from_db()
        step = self.current_step
        if step is None:
            return
        if check_status:
            step.handler.status_check()
        self._set_current_step(step.next_step())
        self.refresh_from_db()
        if self.current_step is not None:
            self.current_step.handler.execute()

    def step_failed(self, check_status: bool = True):
        if self.done:
            return
        step = self.current_step
        if step is not None and check_status:
            step.handler.status_check()
        if step is not None and step.handler.retry_until_success():
            step.handler.execute()
            return
        self._finalize(Outcome.FAILED)

    def timeout(self, check_status: bool = True):
        if self.done:
            return
        if check_status and self.current_step is not None:
            self.current_step.handler.status_check()
        self._finalize(Outcome.TIMED_OUT)

    def abort(self):
        if self.done:
            return
        self._finalize(Outcome.ABORTED)

    def abort_benchmark(self):
        """Abort only the running benchmark and continue with the rest of the task."""
        step = self.current_step
        assert step is not None and step.handler.can_abort_benchmark()
        step.handler.abort_benchmark()

    def _finalize(self, outcome: str):
        """Record a terminal outcome, abort remaining work, but still run the
        trailing shutdown step so the worker is released. Idempotent."""
        if self.done:
            return
        self.outcome = outcome
        self.save(update_fields=["outcome"])
        shutdown = (
            self.step_set.filter(kind=SHUTDOWN_KIND)
            .exclude(status__in=[StepStatus.DONE, StepStatus.ABORTED])
            .order_by("order")
            .first()
        )
        for s in self.steps:
            if shutdown is not None and s.pk == shutdown.pk:
                continue
            if s.status not in (StepStatus.DONE, StepStatus.ABORTED, StepStatus.FAILED):
                s.mark_aborted()
        if shutdown is not None:
            self.current_step = shutdown
            self.save(update_fields=["current_step"])
            shutdown.mark_active()
            shutdown.handler.execute()
        else:
            self.current_step = None
            self.save(update_fields=["current_step"])

    @classmethod
    def get_in_progress(cls):
        return list(cls.objects.exclude(outcome__in=TERMINAL_OUTCOMES).exclude(outcome=Outcome.PENDING))


class TaskStep(models.Model):
    """A single step (data). Behavior comes from the handler registered for ``kind``."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="step_set")
    kind = models.CharField(max_length=64)  # StepHandler registry key
    order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=StepStatus.choices, default=StepStatus.PENDING)
    run_as_root = models.BooleanField(default=True)
    #: Per-step data (e.g. benchmark id, instance name, version, run_networks).
    payload = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "core_task_step"
        ordering = ["order"]

    def __str__(self):
        return f"{self.kind}[{self.order}] ({self.status})"

    @property
    def handler(self):
        from comp_eval_platform.core.steps import get_step_handler

        return get_step_handler(self.kind)(self)

    @property
    def done(self) -> bool:
        return self.status == StepStatus.DONE

    @property
    def active(self) -> bool:
        return self.status == StepStatus.ACTIVE

    @property
    def aborted(self) -> bool:
        return self.status == StepStatus.ABORTED

    @property
    def logs(self) -> str:
        log = self.logs_rel.order_by("-created_at").first()
        return log.text if log is not None else ""

    def set_log(self, text: str):
        """Replace this step's log with ``text`` (latest wins)."""
        self.logs_rel.all().delete()
        Log.objects.create(step=self, text=text)

    def next_step(self):
        """The next not-yet-started step in order, or None."""
        return self.task.step_set.filter(order__gt=self.order, status=StepStatus.PENDING).order_by("order").first()

    def mark_active(self):
        self.status = StepStatus.ACTIVE
        if self.started_at is None:
            self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at"])

    def mark_done(self):
        self.status = StepStatus.DONE
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "finished_at"])
        self.handler.on_marked_done()  # freeze derived state (e.g. scored severity)

    def mark_aborted(self):
        self.status = StepStatus.ABORTED
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "finished_at"])


class Log(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    step = models.ForeignKey(TaskStep, on_delete=models.CASCADE, related_name="logs_rel")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_log"
