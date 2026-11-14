from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.student_history_schema import (
    StudentClassHistoryResponse,
    StudentTransferCreate,
)
from app.schemas.student_schema import (
    StudentCreate,
    StudentListResponse,
    StudentResponse,
    StudentUpdate,
)
from app.services.student_service import (
    ClassNotFoundError,
    DuplicateEnrollmentCodeError,
    StudentNotFoundError,
    StudentService,
)
from app.services.student_history_service import (
    InvalidTransferError,
    StudentHistoryNotFoundError,
    StudentHistoryService,
    TransferClassNotFoundError,
)


router = APIRouter(prefix="/students", tags=["students"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=StudentListResponse, summary="Lista estudantes")
def list_students(
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    class_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
) -> StudentListResponse:
    """Lista estudantes com filtros e paginação estável por identificador."""

    items, total = StudentService().list_students(
        db,
        page=page,
        page_size=page_size,
        class_id=class_id,
        is_active=is_active,
        search=search,
    )
    return StudentListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um estudante",
)
def create_student(payload: StudentCreate, db: DbSession) -> StudentResponse:
    """Cadastra o estudante e seu primeiro vínculo, quando aplicável."""

    try:
        return StudentService().create_student(
            db,
            name=payload.name,
            enrollment_code=payload.enrollment_code,
            class_id=payload.class_id,
            birth_date=payload.birth_date,
            guardian_name=payload.guardian_name,
            guardian_contact=payload.guardian_contact,
            is_active=payload.is_active,
        )
    except ClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        ) from exc
    except DuplicateEnrollmentCodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enrollment code already exists",
        ) from exc


@router.patch(
    "/{student_id}",
    response_model=StudentResponse,
    summary="Atualiza dados cadastrais de um estudante",
)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: DbSession,
) -> StudentResponse:
    """Atualiza dados cadastrais, sem permitir alteração direta da turma."""

    try:
        return StudentService().update_student(
            db,
            student_id,
            payload.model_dump(exclude_unset=True),
        )
    except StudentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        ) from exc
    except DuplicateEnrollmentCodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enrollment code already exists",
        ) from exc


@router.patch(
    "/{student_id}/deactivate",
    response_model=StudentResponse,
    summary="Desativa um estudante",
)
def deactivate_student(student_id: int, db: DbSession) -> StudentResponse:
    """Desativa logicamente sem apagar o histórico do estudante."""

    try:
        return StudentService().deactivate_student(db, student_id)
    except StudentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        ) from exc


@router.get(
    "/{student_id}/class-history",
    response_model=list[StudentClassHistoryResponse],
    summary="Consulta o histórico de turmas",
)
def list_class_history(
    student_id: int,
    db: DbSession,
) -> list[StudentClassHistoryResponse]:
    """Retorna os vínculos do estudante em ordem cronológica."""

    try:
        return StudentHistoryService().list_history(db, student_id)
    except StudentHistoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        ) from exc


@router.post(
    "/{student_id}/transfers",
    response_model=StudentClassHistoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Transfere um estudante de turma",
)
def transfer_student(
    student_id: int,
    payload: StudentTransferCreate,
    db: DbSession,
) -> StudentClassHistoryResponse:
    """Fecha o vínculo atual e cria o próximo em uma transação."""

    try:
        return StudentHistoryService().transfer(
            db,
            student_id=student_id,
            class_id=payload.class_id,
            transfer_date=payload.transfer_date,
        )
    except StudentHistoryNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        ) from exc
    except TransferClassNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        ) from exc
    except InvalidTransferError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("/{student_id}", response_model=StudentResponse, summary="Consulta um estudante")
def get_student(student_id: int, db: DbSession) -> StudentResponse:
    """Retorna um estudante ou informa que ele não existe."""

    student = StudentService().get_student(db, student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return student
