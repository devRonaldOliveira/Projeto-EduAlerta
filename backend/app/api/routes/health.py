from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.health import HealthResponse


router = APIRouter(tags=["health"])

"""Endpoint de disponibilidade da API e do banco."""


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Verifica a disponibilidade da API e do banco",
    responses={503: {"description": "Banco de dados indisponível"}},
)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    """Executa uma consulta neutra e não altera dados do banco."""

    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc

    return HealthResponse(status="ok", database="connected")
