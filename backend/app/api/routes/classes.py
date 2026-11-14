from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.class_schema import ClassCreate, ClassResponse, ClassUpdate
from app.services.class_service import ClassService, DuplicateClassNameError


router = APIRouter(prefix="/classes", tags=["classes"])
DbSession = Annotated[Session, Depends(get_db)]

"""Rotas de consulta de turmas."""

@router.get("", response_model=list[ClassResponse], summary="Lista turmas")
def list_classes(db: DbSession) -> list[ClassResponse]:
    """Retorna as turmas cadastradas, ordenadas pelo identificador."""

    return ClassService().list_classes(db)


@router.get("/{class_id}", response_model=ClassResponse, summary="Consulta uma turma")
def get_class(class_id: int, db: DbSession) -> ClassResponse:
    """Retorna uma turma ou informa que ela não existe."""

    class_item = ClassService().get_class(db, class_id)
    if class_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )
    return class_item


@router.post(
    "",
    response_model=ClassResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cria uma turma",
)
def create_class(payload: ClassCreate, db: DbSession) -> ClassResponse:
    """Cria uma turma sem permitir nomes duplicados."""

    try:
        return ClassService().create_class(db, payload.name, payload.active)
    except DuplicateClassNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Class name already exists",
        ) from exc


@router.patch(
    "/{class_id}",
    response_model=ClassResponse,
    summary="Atualiza uma turma",
)
def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: DbSession,
) -> ClassResponse:
    """Atualiza somente os campos enviados, sem exclusão física."""

    try:
        class_item = ClassService().update_class(
            db,
            class_id,
            name=payload.name,
            active=payload.active,
        )
    except DuplicateClassNameError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Class name already exists",
        ) from exc

    if class_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )
    return class_item
