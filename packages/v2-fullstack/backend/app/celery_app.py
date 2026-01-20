"""
Celery Application Configuration

Reference:
- docs/v2/v2实施细则/14-Celery基础设施-细则.md
"""

from celery import Celery

celery_app = Celery(
    "igloo",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",
    include=["app.tasks.risk_calculation"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)
