from fastapi import APIRouter
from app.api.v1.endpoints import documents, projects, rag

router = APIRouter()
router.include_router(documents.router, prefix="/documents", tags=["Documents"])
router.include_router(projects.router, prefix="/projects", tags=["Projects"])
router.include_router(rag.router, prefix="/rag", tags=["RAG"])
