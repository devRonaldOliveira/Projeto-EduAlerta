from fastapi import FastAPI

from app.api.routes.attendance import class_attendance_router, router as attendance_router
from app.api.routes.classes import router as classes_router
from app.api.routes.health import router as health_router
from app.api.routes.students import router as students_router
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API do projeto EduAlerta.",
)
app.include_router(health_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(class_attendance_router)
