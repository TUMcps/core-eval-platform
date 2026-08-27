"""Competition + step-handler registries and selection."""
import pytest


def test_get_competition_returns_active():
    from comp_eval_platform.competitions import get_competition

    assert get_competition().name == "test"


def test_registered_lists_test_competition():
    from comp_eval_platform.competitions import registered

    assert "test" in registered()


def test_core_step_handlers_registered():
    from comp_eval_platform.core.models.execution import SHUTDOWN_KIND
    from comp_eval_platform.core.steps import get_step_handler

    assert get_step_handler("assign").kind == "assign"
    assert get_step_handler(SHUTDOWN_KIND).kind == SHUTDOWN_KIND


def test_unknown_handler_raises():
    from comp_eval_platform.core.steps import get_step_handler

    with pytest.raises(RuntimeError):
        get_step_handler("does-not-exist")


@pytest.mark.django_db
def test_local_backend_provision_creates_assignable_node():
    from comp_eval_platform.compute.local import LocalBackend
    from comp_eval_platform.core.models import Node

    LocalBackend().provision("local", "local")

    node = Node.get_next_available("local", "local")
    assert node is not None
    assert node.state == "running"
    assert node.reachability == "ok"
    assert node.ip == "127.0.0.1"


def test_register_rejects_nameless():
    from comp_eval_platform.competitions import Competition, register

    class Nameless(Competition):
        name = ""

        def validate_submission(self, s):
            pass

        def build_steps(self, t):
            return []

        def parse_results(self, r, d):
            return []

        def score(self, t):
            return None

    with pytest.raises(ValueError):
        register(Nameless)
