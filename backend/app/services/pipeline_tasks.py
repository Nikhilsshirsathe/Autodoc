"""
Background task runner for the document extraction pipeline.

Uses a daemon thread by default so the pipeline survives uvicorn hot-reloads
and doesn't block the HTTP event loop.

If USE_CELERY=True in settings, dispatches to Celery workers instead.
"""
from __future__ import annotations

import logging
import threading

from app.core.config import settings

logger = logging.getLogger(__name__)


def run_pipeline_task(document_id: str) -> None:
    """
    Entry point for pipeline execution.
    Called from a background thread or Celery worker.
    """
    logger.info("Starting pipeline for document %s", document_id)
    from app.services.document_service import DocumentService
    service = DocumentService()
    try:
        result = service.run_extraction_pipeline(document_id)
        logger.info(
            "Pipeline completed for %s: %d fields, %d tables, %d chunks",
            document_id,
            result.get("fields_extracted", 0),
            result.get("tables_extracted", 0),
            result.get("chunks_created", 0),
        )
    except Exception as exc:
        logger.error("Pipeline failed for %s: %s", document_id, exc, exc_info=True)


def dispatch_pipeline(document_id: str, background_tasks=None) -> None:
    """
    Dispatch the extraction pipeline.

    Priority order:
    1. Celery  — if USE_CELERY=True and Celery is reachable
    2. Thread  — detached daemon thread (default, survives hot-reload)
    3. Sync    — synchronous fallback (testing only)

    The `background_tasks` parameter is accepted but intentionally ignored —
    FastAPI BackgroundTasks are tied to the request lifecycle and die on
    uvicorn hot-reload, which kills long-running pipelines mid-flight.
    """
    if settings.USE_CELERY:
        try:
            from celery import Celery
            celery_app = Celery(
                "ipoai",
                broker=settings.REDIS_URL,
                backend=settings.REDIS_URL,
            )
            celery_app.conf.task_serializer = "json"
            celery_app.conf.result_serializer = "json"
            celery_app.conf.accept_content = ["json"]
            celery_app.send_task("app.tasks.run_pipeline_task", args=[document_id])
            logger.info("Dispatched pipeline to Celery for document %s", document_id)
            return
        except Exception as exc:
            logger.warning(
                "Celery dispatch failed (%s) — falling back to thread", exc
            )

    # Run in a daemon thread so it:
    # - Doesn't block the HTTP event loop
    # - Survives uvicorn hot-reloads (daemon=False would block shutdown)
    # - Doesn't die when the request that triggered it completes
    thread = threading.Thread(
        target=run_pipeline_task,
        args=(document_id,),
        name=f"pipeline-{document_id[:8]}",
        daemon=True,
    )
    thread.start()
    logger.info(
        "Dispatched pipeline to thread %s for document %s",
        thread.name,
        document_id,
    )
