"""Node callback endpoints.

A worker reports step completion by curling back to
``ROOT_URL/update/<task_id>/success|failure`` (so ROOT_URL must be node-reachable).
These advance the state machine. An optional request body is stored as the current
step's log. Ported from VNN's /update/<id>/success|failure views.
"""
from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt


def _task(task_id):
    from comp_eval_platform.core.models import Task

    return Task.objects.filter(id=task_id).first()


def _store_log(task, request):
    body = request.body.decode("utf-8", errors="ignore") if request.body else ""
    if body and task.current_step is not None:
        task.current_step.set_log(body)


@csrf_exempt
def update_success(request, task_id):
    task = _task(task_id)
    if task is None:
        return HttpResponseNotFound("unknown task")
    _store_log(task, request)
    task.step_succeeded(check_status=False)
    return HttpResponse("ok")


@csrf_exempt
def update_failure(request, task_id):
    task = _task(task_id)
    if task is None:
        return HttpResponseNotFound("unknown task")
    _store_log(task, request)
    task.step_failed(check_status=False)
    return HttpResponse("ok")
