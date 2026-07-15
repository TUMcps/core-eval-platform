"""Seed the RuntimeSettings singleton from env / the configured backend.

For local_docker it seeds ready-to-run (scheduler on, submissions open); for aws
it stays conservative. Mirrors VNN's init_settings.
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from comp_eval_platform.core.models import RuntimeSettings


class Command(BaseCommand):
    help = "Initialize/seed the RuntimeSettings singleton."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Re-seed defaults for the current backend.")

    def handle(self, *args, **opts):
        s = RuntimeSettings.get()
        backend = getattr(settings, "EXECUTION_BACKEND", "local_docker")
        s.execution_backend = backend
        if backend == "local_docker":
            # Local dev: ready to run.
            s.scheduler_enabled = True
            s.users_can_submit_benchmarks = True
            s.users_can_submit_tools = True
        elif opts["reset"]:
            # AWS: conservative — nothing on until an admin flips it.
            s.scheduler_enabled = False
            s.users_can_submit_benchmarks = False
            s.users_can_submit_tools = False
        s.save()
        self.stdout.write(self.style.SUCCESS(f"RuntimeSettings seeded (execution_backend={backend})."))
