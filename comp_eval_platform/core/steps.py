"""Step behavior, keyed by ``TaskStep.kind``.

A ``StepHandler`` is bound to a step and carries what a VNN polymorphic step
subclass used to (execute / status_check / retry / on_marked_done / …). The
active competition registers its own kinds (install, run_instance, export, …);
core ships the two generic ones every variant needs: ``assign`` (attach/provision
a worker) and ``shutdown`` (release it).
"""
from comp_eval_platform.core.models.execution import SHUTDOWN_KIND

_STEP_HANDLERS: dict = {}


def register_step_handler(cls):
    """Register a StepHandler by its ``kind``. Use as a decorator; call from a
    plugin's AppConfig.ready() (import side effect) for plugin kinds."""
    if not getattr(cls, "kind", None):
        raise ValueError(f"{cls.__name__} must set a non-empty `kind`")
    _STEP_HANDLERS[cls.kind] = cls
    return cls


def get_step_handler(kind: str):
    try:
        return _STEP_HANDLERS[kind]
    except KeyError:
        raise RuntimeError(f"No StepHandler registered for kind {kind!r}; known: {sorted(_STEP_HANDLERS)}")


class StepHandler:
    """Base behavior. Bound to one ``TaskStep``; the framework has already set the
    step active before calling ``execute`` (also re-called on retry)."""

    kind: str = ""

    def __init__(self, step):
        self.step = step

    @property
    def task(self):
        return self.step.task

    def execute(self):
        """Kick off the step's work. Default: nothing (a pure marker step)."""

    def status_check(self):
        """Ensure the task still has a live worker; a lost node fails the task
        unless this step considers node-loss a valid end (VNN semantics)."""
        if self.task.node is None:
            if self.is_instance_loss_valid_end():
                self.task.step_succeeded(check_status=False)
            else:
                self.task.step_failed(check_status=False)

    def while_active(self):
        """Called each scheduler tick while this step is active (e.g. to enforce a
        per-benchmark wall-clock cap). Default: nothing."""

    def retry_until_success(self) -> bool:
        return False

    def on_marked_done(self):
        """Freeze derived state now the step is done (e.g. score result severity)."""

    def is_instance_loss_valid_end(self) -> bool:
        return False

    def can_be_aborted(self) -> bool:
        return True

    def can_abort_benchmark(self) -> bool:
        return False

    def abort_benchmark(self):
        raise NotImplementedError

    def description(self) -> str:
        return self.step.kind


@register_step_handler
class AssignHandler(StepHandler):
    """Attach a free worker to the task, or ask the backend to provision one.
    Stays active across scheduler ticks until a node is ready."""

    kind = "assign"

    def _node_type(self) -> str:
        subject = self.task.tool or self.task.benchmark
        extra = getattr(subject, "extra", {}) or {}
        return extra.get("node_type") or "local"

    def _image(self) -> str:
        return (self.task.tool.base_image if self.task.tool else "") or ""

    def _try_assign(self):
        from comp_eval_platform.core.models import Node

        node = Node.get_next_available(self._node_type(), self._image())
        if node is not None:
            node.task = self.task
            node.save(update_fields=["task"])
            self.task.step_succeeded(check_status=False)
            return
        # No free worker: provision one, but honor the parallelism cap. Each worker
        # runs its benchmarks sequentially; MAX_PARALLEL_NODES bounds how many run
        # at once (VNN on shared AWS nodes, ARCH on Glados containers).
        from django.conf import settings

        max_nodes = getattr(settings, "MAX_PARALLEL_NODES", 1)
        if Node.objects.count() >= max_nodes:
            return  # wait for a node to free up; the scheduler retries next tick
        from comp_eval_platform.compute import get_backend

        get_backend().provision(self._node_type(), self._image())

    def execute(self):
        self._try_assign()

    def status_check(self):
        # Node not attached yet is the normal waiting state here, not a failure.
        if self.task.node is None:
            self._try_assign()


@register_step_handler
class ShutdownHandler(StepHandler):
    """Release the worker and finish the task."""

    kind = SHUTDOWN_KIND

    def execute(self):
        node = self.task.node
        if node is not None:
            try:
                node.terminate()
            except Exception as exc:  # tearing down must not wedge the task
                print(f"shutdown: node terminate failed (ignored): {exc!r}")
        self.task.step_succeeded(check_status=False)

    def can_be_aborted(self) -> bool:
        return False

    def status_check(self):
        # Node already gone is expected here.
        return
