from fastapi import APIRouter
from app.api.v1.endpoints import documents, projects, rag, auth
from app.api.v1.endpoints.ipo import router as ipo_router

router = APIRouter()
router.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])
router.include_router(projects.router,  prefix="/projects",  tags=["Projects"])
router.include_router(rag.router,       prefix="/rag",       tags=["RAG"])
router.include_router(ipo_router,       prefix="/ipo",       tags=["IPO Generation"])
