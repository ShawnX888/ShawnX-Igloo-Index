"""
Celery Application Configuration

Reference:
- docs/v2/v2实施细则/14-Celery基础设施-细则.md
"""

import os

from celery import Celery

DEFAULT_REDIS_URL = "redis://localhost:6379/0"
DEFAULT_RESULT_BACKEND = "redis://localhost:6379/1"

celery_app = Celery(
    "igloo",
    broker=os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", DEFAULT_REDIS_URL)),
    backend=os.getenv("CELERY_RESULT_BACKEND", DEFAULT_RESULT_BACKEND),
    include=["app.tasks.risk_calculation", "app.tasks.claim_calculation"],
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
