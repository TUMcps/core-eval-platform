"""Endpoints backing the toolkit/benchmark submission forms (VNN-style).

A toolkit submission = create a Tool (all config options stored in ``extra``) and
immediately run it, returning the new task id the UI redirects to. Form options
(execution backend, instance types, images, benchmark categories) are served here
so the form is a single source of truth with the backend.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Config-option keys carried on a toolkit submission (stored in Tool.extra and read
# by the competition's build_steps / step handlers).
_TOOLKIT_EXTRA_KEYS = [
    "hash", "scripts_dir", "manual_installation_step", "run_installation_script_as_root",
    "run_post_installation_script_as_root", "run_toolkit_as_root", "post_install_tool",
    "vnnlib_version", "run_networks", "pause_after_postinstallation",
    "restart_after_postinstallation", "export_results", "benchmarks", "local_execution",
    "aws_instance_type", "eni", "use_own_eni", "install_as_root", "pause",
]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def toolkit_form_data(request):
    from .models import Benchmark, RuntimeSettings

    s = RuntimeSettings.get()
    categories: dict = {}
    for b in Benchmark.objects.filter(published=True).select_related("category").order_by("category__name", "name"):
        categories.setdefault(b.category.name, {"label": b.category.name, "benchmarks": []})
        categories[b.category.name]["benchmarks"].append({"id": str(b.id), "name": b.name})
    is_admin = getattr(request.user, "is_admin", False)
    return Response({
        "can_submit": s.users_can_submit_tools or is_admin,
        "scheduler_enabled": s.scheduler_enabled,
        "execution_backend": s.execution_backend,
        "instance_types": [
            {"value": "t2.large", "label": "t2.large", "hardware": "CPU", "guidance": "general purpose"},
            {"value": "m5.16xlarge", "label": "m5.16xlarge", "hardware": "CPU", "guidance": "large CPU"},
            {"value": "g5.8xlarge", "label": "g5.8xlarge", "hardware": "GPU", "guidance": "CUDA / accelerated"},
        ],
        "ami_options": [
            {"value": "ubuntu:22.04", "label": "Ubuntu 22.04 (Docker)"},
            {"value": "ami-0892d3c7ee96c0bf7", "label": "Ubuntu 22.04 base AMI"},
        ],
        "run_networks_options": [
            {"value": "all", "label": "All instances (final evaluation)"},
            {"value": "first", "label": "First instance only (test)"},
        ],
        "benchmark_categories": categories,
        "default_eni": getattr(request.user, "aws_eni", "") or "",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def benchmark_form_data(request):
    from comp_eval_platform.competitions import get_competition

    from .models import Category, RuntimeSettings

    s = RuntimeSettings.get()
    comp = get_competition()
    try:
        benchmark_fields = comp.presentation().benchmark_fields
    except NotImplementedError:
        benchmark_fields = []
    return Response({
        "scheduler_enabled": s.scheduler_enabled,
        "can_submit": s.users_can_submit_benchmarks or getattr(request.user, "is_admin", False),
        # Categories are only user-chosen for variants that use them (ARCH); VNN
        # files every benchmark under a single implicit 'default' category.
        "uses_categories": comp.uses_categories,
        "categories": [{"id": str(c.id), "name": c.name} for c in Category.objects.order_by("name")],
        "benchmark_fields": benchmark_fields,
    })


_BENCHMARK_EXTRA_KEYS = ["repository", "hash", "script_dir", "vnnlib_version",
                         "onnx_dir", "vnnlib_dir", "csv_file"]


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def benchmark_submit(request):
    """A benchmark submission = create a Benchmark (config in ``extra``) and run a
    task that generates its instances from the git repo and exports them. Returns
    the task id the UI redirects to. Re-submitting the same name regenerates it."""
    from comp_eval_platform.competitions import get_competition

    from .models import Benchmark, Category, RuntimeSettings, Task

    s = RuntimeSettings.get()
    if not (s.users_can_submit_benchmarks or getattr(request.user, "is_admin", False)):
        return Response({"error": "Submission is currently closed"}, status=403)
    if not s.scheduler_enabled:
        return Response({"error": "Submissions are paused: the scheduler is disabled."}, status=400)

    d = request.data
    name = (d.get("name") or "").strip()
    if not name or not (d.get("repository") or "").strip():
        return Response({"errors": {"name/repository": ["required"]}}, status=400)

    comp = get_competition()
    cat_id = d.get("category")
    if cat_id and comp.uses_categories:
        category = Category.objects.filter(id=cat_id).first()
        if category is None:
            return Response({"errors": {"category": ["unknown category"]}}, status=400)
    else:
        category, _ = Category.objects.get_or_create(name="default")

    extra = {k: d.get(k) for k in _BENCHMARK_EXTRA_KEYS if k in d}
    # Re-submitting a benchmark by name overwrites it (latest config wins); the
    # submission is still its own Task, so the history stays. Only the owner or an
    # admin may overwrite someone else's benchmark; an unowned one is adopted.
    bench = Benchmark.objects.filter(category=category, name=name).first()
    if (bench is not None and bench.owner_id not in (None, request.user.id)
            and not getattr(request.user, "is_admin", False)):
        return Response({"errors": {"name": ["already taken by another user in this category"]}}, status=400)
    if bench is None:
        bench = Benchmark.objects.create(owner=request.user, category=category, name=name, extra=extra)
    else:
        bench.extra = extra
        fields = ["extra"]
        if bench.owner_id is None:
            bench.owner = request.user
            fields.append("owner")
        bench.save(update_fields=fields)

    task = Task.objects.create(owner=request.user, benchmark=bench)
    task.start()
    task.refresh_from_db()
    return Response({"redirect_to": str(task.id)}, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toolkit_submit(request):
    from .models import Benchmark, Category, RuntimeSettings, Task, Tool

    s = RuntimeSettings.get()
    if not (s.users_can_submit_tools or getattr(request.user, "is_admin", False)):
        return Response({"error": "Submission is currently closed"}, status=403)
    if not s.scheduler_enabled:
        return Response({"error": "Submissions are paused: the scheduler is disabled."}, status=400)

    d = request.data
    if not d.get("name") or not d.get("repository"):
        return Response({"errors": {"name/repository": ["required"]}}, status=400)

    # Our Tool lives in one category; derive it from the first selected benchmark
    # (else a 'default' category). Selected benchmark ids are kept in extra.
    bench_ids = d.get("benchmarks") or []
    category = None
    if bench_ids:
        b = Benchmark.objects.filter(id__in=bench_ids).select_related("category").first()
        category = b.category if b else None
    if category is None:
        category, _ = Category.objects.get_or_create(name="default")

    extra = {k: d.get(k) for k in _TOOLKIT_EXTRA_KEYS if k in d}
    tool = Tool.objects.create(
        owner=request.user, category=category, name=d.get("name"),
        repository=d.get("repository", ""), hash=d.get("hash", ""),
        base_image=d.get("ami", ""), script_dir=d.get("scripts_dir", "") or "", extra=extra,
    )
    task = Task.objects.create(owner=request.user, tool=tool)
    task.start()
    task.refresh_from_db()
    return Response({"redirect_to": str(task.id)}, status=201)
