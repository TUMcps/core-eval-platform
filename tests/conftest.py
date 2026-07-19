"""Shared fixtures + a registered test competition.

Django imports live inside fixtures/functions: the root conftest is imported
before pytest-django calls ``django.setup()``, so touching models/apps at module
top level would raise AppRegistryNotReady. Test modules (imported later, during
collection) may import models normally.
"""
import uuid

import pytest


@pytest.fixture(scope="session", autouse=True)
def register_test_plugin():
    """Register a minimal competition + the test step handlers into the core
    registries, so the engine has something to run under ACTIVE_COMPETITION=test."""
    from comp_eval_platform.competitions import Competition, register
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND
    from comp_eval_platform.core.steps import StepHandler, register_step_handler
    from comp_eval_platform.results import Scoreboard

    @register_step_handler
    class OkHandler(StepHandler):
        kind = "t_ok"

        def execute(self):
            self.task.step_succeeded(check_status=False)

        def status_check(self):
            pass

    @register_step_handler
    class FailHandler(StepHandler):
        kind = "t_fail"

        def execute(self):
            self.task.step_failed(check_status=False)

        def status_check(self):
            pass

    @register_step_handler
    class AbortableHandler(StepHandler):
        """A benchmark-run-like step: abortable on its own, and it records that its
        on_marked_done ran, so a test can assert partial results were finalized. Stays
        active (no execute) until aborted or advanced."""

        kind = "t_abortable"

        def status_check(self):
            pass

        def can_abort_benchmark(self) -> bool:
            return True

        def abort_benchmark(self):
            self.task.step_aborted()

        def on_marked_done(self):
            self.step.payload = {**(self.step.payload or {}), "finalized": True}
            self.step.save(update_fields=["payload"])

    @register_step_handler
    class RetryFailHandler(StepHandler):
        """Fails synchronously *and* asks to be retried — the execute/step_failed
        pair that has to stay bounded."""

        kind = "t_retry_fail"

        def execute(self):
            self.task.step_failed(check_status=False)

        def status_check(self):
            pass

        def retry_until_success(self) -> bool:
            return True

    class TestCompetition(Competition):
        name = "test"
        display_name = "Test"

        def validate_submission(self, submission):
            pass

        def build_steps(self, task):
            from comp_eval_platform.core.models import TaskStep

            for i, kind in enumerate(["t_ok", "t_ok", SHUTDOWN_KIND]):
                TaskStep.objects.create(task=task, kind=kind, order=i)

        def parse_results(self, run, artifacts_dir):
            return []

        def score(self, track):
            return Scoreboard(columns=["tool", "solved"], rows=[])

    register(TestCompetition)
    yield


@pytest.fixture
def user(db):
    from comp_eval_platform.core.models import User

    return User.objects.create_user(email=f"{uuid.uuid4().hex[:8]}@x.test", password="pw", enabled=True)


@pytest.fixture
def category(db):
    from comp_eval_platform.core.models import Category

    return Category.objects.create(name=f"cat-{uuid.uuid4().hex[:6]}")


@pytest.fixture
def api(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(user)
    return client
