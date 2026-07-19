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
    from apscheduler.jobstores.memory import MemoryJobStore
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger

    from comp_eval_platform.core.jobs import automatic_update

    _scheduler = BackgroundScheduler(
        jobstores={"default": MemoryJobStore()},
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


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=True)
        _scheduler = None
