"""Node matching, RuntimeSettings singleton, Result.store, user roles."""
import uuid

import pytest

pytestmark = pytest.mark.django_db


def test_node_get_next_available_matches_type_and_image():
    from comp_eval_platform.core.models import Node

    n = Node.objects.create(id="n1", node_type="local", image="img:1",
                            state="running", reachability="ok", ip="1.2.3.4")
    assert Node.get_next_available("local", "img:1") == n
    assert Node.get_next_available("local", "other") is None
    assert Node.get_next_available("gpu", "img:1") is None
    # Empty image request skips the image filter (resolved-default case).
    assert Node.get_next_available("local", "") == n


def test_node_not_available_when_busy_or_unreachable():
    from comp_eval_platform.core.models import Category, Node, Task, Tool, User

    u = User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw")
    cat = Category.objects.create(name="c")
    task = Task.objects.create(owner=u, tool=Tool.objects.create(owner=u, category=cat, name="t"))
    Node.objects.create(id="busy", node_type="local", state="running", reachability="ok",
                        ip="1.1.1.1", task=task)
    Node.objects.create(id="unreach", node_type="local", state="running", reachability="none", ip="2.2.2.2")
    assert Node.get_next_available("local", "") is None


def test_runtime_settings_is_singleton():
    from comp_eval_platform.core.models import RuntimeSettings

    a = RuntimeSettings.get()
    a.submission_timeout = 9
    a.save()
    b = RuntimeSettings.get()
    assert b.submission_timeout == 9
    assert RuntimeSettings.objects.count() == 1


def test_result_store_links_instances():
    from comp_eval_platform.core.models import (
        Benchmark, Category, Instance, Result, Task, Tool, User,
    )
    from comp_eval_platform.results import ResultRecord

    u = User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw")
    cat = Category.objects.create(name="c")
    tool = Tool.objects.create(owner=u, category=cat, name="t")
    bench = Benchmark.objects.create(owner=u, category=cat, name="b")
    inst = Instance.objects.create(benchmark=bench, name="i1")
    task = Task.objects.create(owner=u, tool=tool)

    records = [
        ResultRecord(instance="i1", result="sat", time=1.5, extra={"k": "v"}),
        ResultRecord(instance="i_missing", result="unknown", time=None),
    ]
    Result.store(task, tool, bench, cat, records, instances_by_name={"i1": inst})

    rows = Result.objects.order_by("result")
    assert rows.count() == 2
    sat = Result.objects.get(result="sat")
    assert sat.instance == inst
    assert sat.time == 1.5
    assert sat.extra == {"k": "v"}
    assert Result.objects.get(result="unknown").instance is None


def test_user_roles():
    from comp_eval_platform.core.models import Role, User

    u = User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw")
    assert not u.is_admin and not u.is_organizer and not u.enabled
    u.role = Role.ORGANIZER
    assert u.is_organizer and not u.is_admin
    admin = User.objects.create_superuser(email="root@x.test", password="pw")
    assert admin.is_admin and admin.is_organizer and admin.enabled and admin.is_staff
