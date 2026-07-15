#!/usr/bin/env python
"""Dev/test entrypoint for the core package itself. Variant deployments ship
their own manage.py pointing at their project settings."""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "comp_eval_platform.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
