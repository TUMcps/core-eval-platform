"""REST API for the shared domain.

Variant-agnostic: submission validation, step-graph building, and scoring are all
delegated to the active competition, so these viewsets never mention VNN or ARCH.
"""
import io
import os
import zipfile

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Case, IntegerField, Q, When
from django.http import HttpResponse
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from comp_eval_platform.competitions import get_competition
from comp_eval_platform.compute import get_backend
from comp_eval_platform.compute.base import ImageError

from .models import Benchmark, Category, Instance, Result, Task, Tool, Track, User
from .models.execution import StepStatus
from .serializers import (
    BenchmarkSerializer,
    CategorySerializer,
    InstanceSerializer,
    ResultSerializer,
    TaskListSerializer,
    TaskSerializer,
    ToolSerializer,
    TrackSerializer,
    UserSerializer,
)


class IsEnabled(permissions.BasePermission):
    """Authenticated and enabled to submit."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "enabled", False))


class IsOrganizer(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if request.method in permissions.SAFE_METHODS:
            return bool(u and u.is_authenticated)
        return bool(u and u.is_authenticated and getattr(u, "is_organizer", False))


def _zip_dir(directory: str) -> bytes:
    """Zip a directory's files, flattened to paths relative to it. Held in memory: an
    exported run is a results.csv plus a few gzipped counterexamples."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, _dirs, files in os.walk(directory):
            for name in sorted(files):
                full = os.path.join(root, name)
                archive.write(full, os.path.relpath(full, directory))
    return buf.getvalue()


def _validate(submission):
    """The competition's own rules, plus: the active compute backend has to be able to
    boot the requested base image. Rejected here so a submission that could never run
    is refused at submit time instead of failing a task later."""
    try:
        get_competition().validate_submission(submission)
    except DjangoValidationError as exc:
        raise DRFValidationError(exc.messages)
    try:
        get_backend().resolve_image(getattr(submission, "base_image", "") or "")
    except ImageError as exc:
        raise DRFValidationError([str(exc)])


class ToolViewSet(viewsets.ModelViewSet):
    queryset = Tool.objects.all().order_by("-created_at")
    serializer_class = ToolSerializer
    permission_classes = [IsEnabled]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        """Validate the tool against the competition spec, then create and start a
        Task (which builds the step graph and executes the first step)."""
        tool = self.get_object()
        _validate(tool)
        task = Task.objects.create(owner=request.user, tool=tool)
        task.start()
        task.refresh_from_db()  # start() advances the machine on refreshed copies
        return Response(TaskSerializer(task).data, status=201)


class BenchmarkViewSet(viewsets.ModelViewSet):
    queryset = Benchmark.objects.all().order_by("-created_at").prefetch_related("instances")
    serializer_class = BenchmarkSerializer
    permission_classes = [IsEnabled]

    def create(self, request, *args, **kwargs):
        # Variants without user-chosen categories (VNN) file every benchmark under a
        # single implicit 'default' category. Inject it before validation so the
        # category/name uniqueness check still runs.
        data = request.data
        if not data.get("category") and not get_competition().uses_categories:
            category, _ = Category.objects.get_or_create(name="default")
            data = {**data, "category": str(category.id)}
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["post"])
    def load(self, request):
        """Load a whole category's benchmarks from one central repo (ARCH). Body:
        ``{category, repository, hash}``; fans instances.csv into Benchmarks."""
        data = request.data
        try:
            benchmarks = get_competition().load_benchmarks(
                category_name=data.get("category"),
                repository=data.get("repository", ""),
                ref=data.get("hash", ""),
                owner=request.user,
            )
        except NotImplementedError:
            raise DRFValidationError("This competition does not support bulk benchmark loading.")
        except DjangoValidationError as exc:
            raise DRFValidationError(exc.messages)
        return Response(BenchmarkSerializer(benchmarks, many=True).data, status=201)

    @action(detail=True, methods=["post"])
    def add_instances(self, request, pk=None):
        """Bulk-add instances: body is a list of {name, spec, order}."""
        benchmark = self.get_object()
        created = Instance.objects.bulk_create([
            Instance(benchmark=benchmark, name=i["name"], spec=i.get("spec", {}), order=i.get("order", n))
            for n, i in enumerate(request.data)
        ])
        return Response(InstanceSerializer(created, many=True).data, status=201)


class TrackViewSet(viewsets.ModelViewSet):
    """Organizer-managed track curation (read open to any authenticated user)."""

    queryset = Track.objects.all().order_by("name").prefetch_related("benchmarks")
    serializer_class = TrackSerializer
    permission_classes = [IsOrganizer]

    @action(detail=True, methods=["get"])
    def scoreboard(self, request, pk=None):
        """The competition's scoreboard for this track."""
        track = self.get_object()
        board = get_competition().score(track)
        return Response({"columns": board.columns, "rows": board.rows})


class TaskPagination(PageNumberPagination):
    """One overview page at a time; the client pages/searches server-side so an
    admin's full submission list is never shipped at once."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class TaskViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Task.objects.all().order_by("-created_at")
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = TaskPagination

    def get_serializer_class(self):
        # The overview omits per-step data (avoids a log query per step).
        return TaskListSerializer if self.action == "list" else TaskSerializer

    def get_queryset(self):
        qs = (Task.objects.all().order_by("-created_at")
              .select_related("owner", "tool", "tool__category", "benchmark",
                              "benchmark__category", "category")
              .prefetch_related("step_set"))
        if self.action == "retrieve":
            # The detail page shows per-step logs; prefetch them (list omits steps).
            qs = qs.prefetch_related("step_set__logs_rel")
        # The toolkit and benchmark overview pages each want only their own kind;
        # filtering here avoids shipping the other kind for the client to drop.
        kind = self.request.query_params.get("type")
        if kind == "tool":
            qs = qs.filter(tool__isnull=False)
        elif kind == "benchmark":
            # A benchmark submission is a named benchmark (VNN) or a whole-category
            # load (ARCH, no benchmark FK); the overview shows both.
            qs = qs.filter(Q(benchmark__isnull=False) | Q(category__isnull=False))
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(tool__name__icontains=search)
                           | Q(benchmark__name__icontains=search)
                           | Q(category__name__icontains=search))
        # Match the overview's grouping (mirrors statusGroupRank in the client):
        # queued first, then running, then finished; newest-first within each group.
        # A stable rank keeps running submissions on the first page under pagination.
        qs = qs.annotate(_rank=Case(
            When(outcome="pending", then=0),
            When(outcome="running", then=1),
            default=2, output_field=IntegerField(),
        )).order_by("_rank", "-created_at")
        u = self.request.user
        return qs if getattr(u, "is_admin", False) else qs.filter(owner=u)

    def _may_manage(self, request, task):
        return request.user.is_admin or task.owner_id == request.user.id

    @action(detail=True, methods=["get"], url_path="results-archive")
    def results_archive(self, request, pk=None):
        """Zip of the artifacts an export step pushed (results.csv, counterexamples),
        selected by the step's ``order``. A run submitted without result export never
        pushed anything, so it has no archive to offer."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        try:
            order = int(request.query_params.get("step", ""))
        except ValueError:
            return Response({"error": "step is required"}, status=400)
        step = task.step_set.filter(order=order).first()
        if step is None:
            return Response({"error": "no such step"}, status=404)
        if step.status != StepStatus.DONE:
            return Response({"error": "results not exported yet"}, status=409)
        directory = get_competition().exported_artifacts_dir(step)
        if not directory or not os.path.isdir(directory):
            return Response({"error": "results not found in the exported repository"}, status=404)
        name = f"task{task.id}_{os.path.basename(directory)}"
        response = HttpResponse(_zip_dir(directory), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{name}.zip"'
        return response

    @action(detail=True, methods=["get"], url_path="download")
    def download_results(self, request, pk=None):
        """Download all benchmark results for a task as a ZIP.
        Unified version supporting both VNN (payloads, name-based logs) 
        and ARCH (figures, id-based logs, robust fallbacks)."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        if not task.done:
            return Response({"error": "task not finished yet"}, status=409)

        buf = io.BytesIO()
        files_added = 0

        # Precompute (N+1 Optimization): Execute database queries once before the loop
        # 1. Create maps for ID-to-Name and Name-to-ID matching
        all_benchmarks = Benchmark.objects.all()
        bench_id_to_name = {b.id: b.name for b in all_benchmarks}
        bench_name_to_id = {b.name: b.id for b in all_benchmarks}

        # 2. Fetch and group all Result rows for this task in a single query
        all_results = Result.objects.filter(task=task).select_related("instance")
        results_by_bench_id = {}
        for r in all_results:
            b_id = r.benchmark_id
            if b_id not in results_by_bench_id:
                results_by_bench_id[b_id] = []
            results_by_bench_id[b_id].append(r)

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for step in task.steps:
                if step.kind != "run_benchmark":
                    continue

                payload = step.payload or {}
                benchmark_name = payload.get("benchmark_name")
                benchmark_id = payload.get("benchmark_id")

                # ID Cast, Name-ID Verification using precomputed maps instead of queries
                if benchmark_id:
                    try:
                        benchmark_id = int(benchmark_id)
                    except (ValueError, TypeError):
                        pass

                if benchmark_name and not benchmark_id:
                    benchmark_id = bench_name_to_id.get(benchmark_name)
                elif benchmark_id and not benchmark_name:
                    benchmark_name = bench_id_to_name.get(benchmark_id, f"benchmark_{benchmark_id}")

                if not benchmark_name:
                    continue

                # Zip Slip protection: remove dangerous characters
                safe_benchmark_name = str(benchmark_name).replace("/", "_").replace("\\", "_").replace("..", "")
                if not safe_benchmark_name.strip():
                    safe_benchmark_name = f"benchmark_{benchmark_id or 'unknown'}"

                # 1. Read from Payload 
                results_csv_str = payload.get("results_csv")

                # 2. Read from Precomputed Database Results 
                if not results_csv_str:
                    step_results = results_by_bench_id.get(benchmark_id, [])
                    if not step_results and benchmark_name:
                        b_id_from_name = bench_name_to_id.get(benchmark_name)
                        step_results = results_by_bench_id.get(b_id_from_name, [])

                    if step_results:
                        lines = ["benchmark,instance,result,time"]
                        for result in step_results:
                            instance_name = result.instance.name if result.instance else ""
                            lines.append(f"{safe_benchmark_name},{instance_name},{result.result},{result.time or ''}")
                        results_csv_str = "\n".join(lines)

                # 3. Read from Physical Logs
                if not results_csv_str:
                    possible_paths = []
                    if benchmark_id:
                        possible_paths.extend([
                            f"/app/logs/results_{benchmark_id}.csv",
                            os.path.join(settings.BASE_DIR, "logs", f"results_{benchmark_id}.csv"),
                            os.path.join(settings.BASE_DIR, "..", "logs", f"results_{benchmark_id}.csv")
                        ])
                    if benchmark_name:
                        possible_paths.append(os.path.join(settings.BASE_DIR, "logs", f"results_{benchmark_name}.csv"))

                    for csv_path in possible_paths:
                        if os.path.exists(csv_path):
                            with open(csv_path, "r", encoding="utf-8") as f:
                                results_csv_str = f.read()
                            break

                # CSV Writing
                if results_csv_str:
                    zf.writestr(f"{safe_benchmark_name}/results.csv", results_csv_str)
                    files_added += 1

                # Log Writing
                log_text = getattr(step, "logs", "")
                if log_text:
                    zf.writestr(f"{safe_benchmark_name}/run.log", log_text)
                    files_added += 1

                # 4. Collecting Figures 
                # Since these folders will not be found in the VNN, os.path.isdir() will be silently skipped and will not give an error.
                possible_fig_dirs = [
                    os.path.join(settings.BASE_DIR, "logs", "figures", benchmark_name),
                    os.path.join(settings.DATA_DIR, "figures", benchmark_name),
                    f"/app/logs/figures/{benchmark_name}"
                ]
                
                figures_dir = None
                for d in possible_fig_dirs:
                    if os.path.isdir(d):
                        figures_dir = d
                        break

                if figures_dir:
                    for root, _dirs, files in os.walk(figures_dir):
                        for fname in files:
                            fpath = os.path.join(root, fname)
                            rel_path = os.path.relpath(fpath, figures_dir)
                            arcname = os.path.join(safe_benchmark_name, "figures", rel_path)
                            zf.write(fpath, arcname)
                            files_added += 1

            # If no files are created during the task, the system will issue an error report instead of crashing.
            if files_added == 0:
                summary_info = f"Task ID: {task.id}\nName: {getattr(task, 'name', 'N/A')}\nOutcome: {getattr(task, 'outcome', 'unknown')}\nCreated At: {getattr(task, 'created_at', 'unknown')}\n"
                zf.writestr("task_summary.txt", summary_info)
                for step in task.steps:
                    step_log = getattr(step, "logs", "")
                    if step_log:
                        zf.writestr(f"steps/step_{step.order}_{step.kind}.log", step_log)

        buf.seek(0)
        response = HttpResponse(buf.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="task_{task.id}_results.zip"'
        return response

    @action(detail=True, methods=["post"])
    def abort(self, request, pk=None):
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        task.abort()
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="abort-benchmark")
    def abort_benchmark(self, request, pk=None):
        """Abort only the currently-running benchmark and let the rest of the submission
        continue (the run steps stop their measurement and advance to the next benchmark);
        the task itself keeps going. Valid only while a benchmark-run step is active."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        step = task.current_step
        if task.done or step is None or not step.handler.can_abort_benchmark():
            return Response({"error": "No benchmark is running to abort."}, status=400)
        task.abort_benchmark()
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        """Continue a paused task by advancing past its held step."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        if task.current_step is not None:
            task.step_succeeded(check_status=False)
            task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def change_owner(self, request, pk=None):
        """Reassign this submission to another enabled user (admin only)."""
        if not getattr(request.user, "is_admin", False):
            return Response(status=403)
        task = self.get_object()
        user = User.objects.filter(id=request.data.get("owner"), enabled=True).first()
        if user is None:
            return Response({"error": "unknown or disabled user"}, status=400)
        task.owner = user
        task.save(update_fields=["owner"])
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    def destroy(self, request, *args, **kwargs):
        """Delete a finished submission (cascades steps/logs/results; the benchmark
        row survives). A running task must be aborted first."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        if not task.done:
            return Response({"error": "Abort the submission before deleting it."}, status=400)
        task.delete()
        return Response(status=204)


class ResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Ordered by the instance's own order so a run reads in the order it ran, not
        # by write time.
        qs = (Result.objects.all()
              .select_related("instance", "benchmark")
              .order_by("benchmark__name", "instance__order", "created_at"))
        for param, field in (("tool", "tool_id"), ("benchmark", "benchmark_id"), ("task", "task_id")):
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})
        return qs


class CategoryViewSet(viewsets.ModelViewSet):
    """Read open to any authenticated user; create/edit is organizer-only."""

    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsOrganizer]


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "is_admin", False))


class UserViewSet(viewsets.ModelViewSet):
    """Admin user management: list + enable/disable + set role."""

    queryset = User.objects.all().order_by("email")
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "patch", "head", "options"]
