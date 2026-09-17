"""APScheduler with a single worker for strictly sequential processing.

One job, ``automatic_update``, runs every ``AUTOMATIC_UPDATE_INTERVAL`` seconds.
Started from the core AppConfig.ready() (guarded so it runs once, not under
management commands). Ported from VNN's scheduler.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_scheduler = None


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    from apscheduler.executors.pool import ThreadPoolExecutor
    from apscheduler.jobstores.memory import MemoryJobStore
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger

    from comp_eval_platform.core.jobs import automatic_update

    _scheduler = BackgroundScheduler(
        jobstores={"default": MemoryJobStore()},
        # One thread, so jobs queued by run_soon never overlap a tick.
        executors={"default": ThreadPoolExecutor(1)},
        timezone=settings.TIME_ZONE,
        job_defaults={"coalesce": True, "max_instances": 1},
    )
    interval = getattr(settings, "AUTOMATIC_UPDATE_INTERVAL", 10)
    _scheduler.add_job(
        automatic_update,
        trigger=IntervalTrigger(seconds=interval),
        id="automatic_update",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info("APScheduler started (interval=%ss)", interval)


def run_soon(func, *args) -> bool:
    """Queue ``func(*args)`` on the scheduler's worker, behind any job in progress.
    Returns False when no scheduler runs in this process, so the caller runs it itself."""
    if _scheduler is None:
        return False
    # No misfire limit: a queued job must still run however long the tick before it took.
    _scheduler.add_job(func, args=args, misfire_grace_time=None)
    return True


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=True)
        _scheduler = None
