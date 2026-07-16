"""
Background task runner for the document extraction pipeline.

Uses FastAPI's built-in BackgroundTasks by default.
If USE_CELERY=True, dispatches to Celery workers instead.
"""
from __future__ import annotations

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def run_pipeline_task(document_id: str) -> None:
    """
    Entry point for background processing.
    Called by FastAPI BackgroundTasks or Celery worker.
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


# ── Optional Celery integration ───────────────────────────────────────────────

_celery_app = None


def _get_celery():
    global _celery_app
    if _celery_app is None:
        try:
            from celery import Celery
            _celery_app = Celery(
                "ipoai",
                broker=settings.REDIS_URL,
                backend=settings.REDIS_URL,
            )
            _celery_app.conf.task_serializer = "json"
            _celery_app.conf.result_serializer = "json"
            _celery_app.conf.accept_content = ["json"]
        except ImportError:
            logger.warning("Celery not installed — background tasks will run in-process")
    return _celery_app


def dispatch_pipeline(document_id: str, background_tasks=None) -> None:
    """
    Dispatch the extraction pipeline.
    - If background_tasks (FastAPI BackgroundTasks) is provided, use it.
    - If USE_CELERY=True, use Celery.
    - Otherwise run synchronously (dev mode).
    """
    if settings.USE_CELERY:
        celery_app = _get_celery()
        if celery_app:
            celery_app.send_task("app.tasks.run_pipeline_task", args=[document_id])
            return

    if background_tasks is not None:
        background_tasks.add_task(run_pipeline_task, document_id)
        return

    # Synchronous fallback (for testing / simple deployments)
    run_pipeline_task(document_id)
