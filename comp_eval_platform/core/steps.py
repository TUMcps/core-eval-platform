"""Step behavior, keyed by ``TaskStep.kind``.

A ``StepHandler`` is bound to a step and carries what a VNN polymorphic step
subclass used to (execute / status_check / retry / on_marked_done / …). The
active competition registers its own kinds (install, run_instance, export, …);
core ships the generic ones every variant needs: ``assign`` (attach/provision a
worker), ``shutdown`` (release it), and ``pause`` (hold for an operator).
"""
from comp_eval_platform.core.models.execution import PAUSE_KIND, SHUTDOWN_KIND

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

    #: This step's live log file (relative to the node's ubuntu home), or None if it
    #: has no node-side log. When set, ``while_active`` tails it into the DB each tick.
    node_log_path: str = None

    def __init__(self, step):
        self.step = step

    @property
    def task(self):
        return self.step.task

    @property
    def node_ip(self):
        """This task's worker IP, or None if no node is attached yet."""
        node = self.task.node
        return node.ip if node is not None else None

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
        """Each scheduler tick while active. Default streams the node log; overriders
        (e.g. wall-clock caps) should call ``super()``."""
        self.refresh_node_log()

    def refresh_node_log(self):
        """Tail this step's node log into its DB log. No-op without a log or node."""
        if not self.node_log_path:
            return
        node = self.task.node
        if node is None or not node.ip:
            return
        from django.conf import settings

        from comp_eval_platform.compute.shell import fetch_node_log

        tail = getattr(settings, "LIVE_LOG_TAIL_BYTES", 1_000_000)
        text = fetch_node_log(node.ip, self.node_log_path, tail_bytes=tail)
        if text:
            self.step.set_log(text)

    def retry_until_success(self) -> bool:
        return False

    def collect_results(self, remote_path: str):
        """Pull a run's results.csv off the node into a temp dir for ``parse_results``.
        Read now because the node is torn down before the task ends. Stores the file
        verbatim on the step (the submission page shows it as-is) and returns the temp
        dir, or ``None`` when the run produced nothing. The caller removes the dir."""
        import os
        import tempfile

        from comp_eval_platform.compute.shell import node_exec

        ip = self.node_ip
        if ip is None:
            return None
        csv_text = node_exec(ip, f"cat {remote_path} 2>/dev/null")
        if not csv_text.strip():
            return None
        self.step.payload = {**(self.step.payload or {}), "results_csv": csv_text}
        self.step.save(update_fields=["payload"])
        directory = tempfile.mkdtemp(prefix=f"results_{self.task.id}_")
        with open(os.path.join(directory, "results.csv"), "w") as fh:
            fh.write(csv_text)
        return directory

    def refresh_run_progress(self, remote_path: str, benchmark, has_header: bool = False):
        """While a run is active, tail its partial results.csv into the step payload so the
        UI shows the file — and a processed-count — as instances land, not only at the end.
        Stores ``payload['results_csv']`` verbatim and ``payload['progress'] = {processed,
        total}`` (total = the benchmark's instance count, falling back to the rows seen).
        No-op until the first row is written."""
        from comp_eval_platform.compute.shell import node_exec
        from comp_eval_platform.core.models import Instance

        ip = self.node_ip
        if ip is None or benchmark is None:
            return
        csv_text = node_exec(ip, f"cat {remote_path} 2>/dev/null")
        rows = [ln for ln in csv_text.splitlines() if ln.strip()]
        if has_header and rows:
            rows = rows[1:]  # ARCH's harness writes a header; VNN's rows stand alone
        if not rows:
            return
        total = Instance.objects.filter(benchmark=benchmark).count() or len(rows)
        self.step.payload = {**(self.step.payload or {}), "results_csv": csv_text,
                             "progress": {"processed": len(rows), "total": total}}
        self.step.save(update_fields=["payload"])

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
        """The image as the backend will boot it, so matching a free node agrees with
        what provision() stored on it."""
        from comp_eval_platform.compute import get_backend

        requested = (self.task.tool.base_image if self.task.tool else "") or ""
        return get_backend().resolve_image(requested)

    def _eni(self):
        """AWS ENI to attach so the worker gets a stable MAC (many verification
        tools license by MAC): ``use_own_eni`` -> the owner's assigned ENI; else an
        explicit ENI from the submission; else None (random MAC). Docker backends
        ignore this."""
        tool = self.task.tool
        extra = (tool.extra if tool else {}) or {}
        if extra.get("use_own_eni"):
            return getattr(self.task.owner, "aws_eni", None) or None
        return (extra.get("eni") or "").strip() or None

    def _fail(self, reason: str):
        """A submission that can never run must say why and stop, not sit on `assign`."""
        print(f"assign failed for {self.task}: {reason}")
        self.step.set_log(f"[ERROR] {reason}")
        self.task.step_failed(check_status=False)

    def _try_assign(self):
        from comp_eval_platform.compute import get_backend
        from comp_eval_platform.compute.base import ImageError, ProvisionError
        from comp_eval_platform.core.models import Node

        try:
            image = self._image()
        except ImageError as exc:
            self._fail(str(exc))
            return
            
        backend = get_backend()
        
        # Retrieve the user-specific remote worker service URL. 
        # This ensures the task looks for an available node that is hosted on the user's specific worker instance.
        worker_service_url = getattr(backend, "worker_service_url_for_user", lambda _u: "")(self.task.owner)
        node = Node.get_next_available(self._node_type(), image, worker_service_url=worker_service_url or "")
        
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
        try:
            # Pass the task owner to the provision method so the backend knows 
            # which user's remote worker service should create and host the new node.
            backend.provision(self._node_type(), image, self._eni(), owner=self.task.owner)
        except ProvisionError as exc:
            self._fail(str(exc))

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


@register_step_handler
class PauseHandler(StepHandler):
    """Hold the task until an operator resumes it (the ``resume`` API advances
    past it). Stays active indefinitely."""

    kind = PAUSE_KIND

    def status_check(self):
        return  # never auto-advance