from typing import Annotated
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.attendance_schema import (
    AttendanceAlertsResponse,
    AttendanceCreate,
    AttendanceListResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
    AttendanceTimelineResponse,
    StudentAttendanceSummaryResponse,
    StudentMonthlyAttendanceResponse,
)
from app.services.attendance_query_service import AttendanceQueryService
from app.services.attendance_service import (
    AttendanceService,
    AttendanceStudentNotFoundError,
    DuplicateAttendanceError,
    FutureAttendanceDateError,
    AttendanceResourceNotFoundError,
    InactiveStudentAttendanceError,
    InvalidAttendancePeriodError,
)


router = APIRouter(prefix="/attendance", tags=["attendance"])
DbSession = Annotated[Session, Depends(get_db)]
class_attendance_router = APIRouter(tags=["attendance"])

"""Rotas de registro de frequência."""


@router.post(
    "",
    response_model=AttendanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registra frequência diária",
)
def create_attendance(payload: AttendanceCreate, db: DbSession) -> AttendanceResponse:
    """Cria um lançamento diário sem alterar registros existentes."""

    try:
        return AttendanceService().create_record(
            db,
            student_id=payload.student_id,
            record_date=payload.record_date,
            classes_scheduled=payload.classes_scheduled,
            classes_attended=payload.classes_attended,
            notes=payload.notes,
        )
    except AttendanceStudentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        ) from exc
    except InactiveStudentAttendanceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot register attendance for an inactive student",
        ) from exc
    except FutureAttendanceDateError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot register attendance for a future date",
        ) from exc
    except DuplicateAttendanceError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this student and date",
        ) from exc


@router.get("", response_model=AttendanceListResponse, summary="Lista registros de frequência")
def list_attendance(
    db: DbSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    student_id: int | None = Query(default=None, ge=1),
    class_id: int | None = Query(default=None, ge=1),
    start_date: date | None = None,
    end_date: date | None = None,
) -> AttendanceListResponse:
    """Lista registros com filtros inclusivos e paginação."""

    try:
        return AttendanceQueryService().list_records(
            db,
            page=page,
            page_size=page_size,
            student_id=student_id,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/summary", response_model=AttendanceSummaryResponse, summary="Resumo geral de frequência")
def attendance_summary(
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    class_id: int | None = Query(default=None, ge=1),
) -> AttendanceSummaryResponse:
    """Agrega frequência e distribuição dos estudantes ativos."""

    try:
        return AttendanceQueryService().summary(
            db,
            start_date=start_date,
            end_date=end_date,
            class_id=class_id,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/timeline", response_model=AttendanceTimelineResponse, summary="Série diária de frequência")
def attendance_timeline(
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
    class_id: int | None = Query(default=None, ge=1),
) -> AttendanceTimelineResponse:
    """Retorna pontos diários agregados para gráficos."""

    try:
        return AttendanceQueryService().timeline(
            db,
            start_date=start_date,
            end_date=end_date,
            class_id=class_id,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/alerts", response_model=AttendanceAlertsResponse, summary="Alertas dinâmicos de frequência")
def attendance_alerts(
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AttendanceAlertsResponse:
    """Calcula alertas de atenção, risco e faltas consecutivas."""

    try:
        return AttendanceQueryService().alerts(
            db,
            start_date=start_date,
            end_date=end_date,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc


@class_attendance_router.get(
    "/students/{student_id}/attendance/summary",
    response_model=StudentAttendanceSummaryResponse,
    summary="Resumo de frequência do estudante",
)
def student_attendance_summary(
    student_id: int,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> StudentAttendanceSummaryResponse:
    """Retorna totais e classificação do estudante no período."""

    try:
        result = AttendanceQueryService().student_summary(
            db,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
        )
        return result
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@class_attendance_router.get(
    "/students/{student_id}/attendance/monthly",
    response_model=StudentMonthlyAttendanceResponse,
    summary="Histórico mensal de frequência do estudante",
)
def student_attendance_monthly(
    student_id: int,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> StudentMonthlyAttendanceResponse:
    """Retorna totais e classificação agrupados por mês."""

    try:
        return AttendanceQueryService().student_monthly(
            db,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@class_attendance_router.get(
    "/classes/{class_id}/attendance/summary",
    response_model=AttendanceSummaryResponse,
    summary="Resumo de frequência da turma",
)
def class_attendance_summary(
    class_id: int,
    db: DbSession,
    start_date: date | None = None,
    end_date: date | None = None,
) -> AttendanceSummaryResponse:
    """Agrega registros associados à turma vigente em cada data."""

    try:
        return AttendanceQueryService().class_summary(
            db,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
        )
    except InvalidAttendancePeriodError as exc:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date") from exc
    except AttendanceResourceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
