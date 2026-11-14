from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AttendanceCreate(BaseModel):
    """Dados necessários para registrar uma frequência diária."""

    student_id: int
    record_date: date
    classes_scheduled: int = Field(ge=0)
    classes_attended: int = Field(ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_attendance_count(self) -> "AttendanceCreate":
        if self.classes_attended > self.classes_scheduled:
            raise ValueError("classes_attended cannot exceed classes_scheduled")
        return self


class AttendanceResponse(BaseModel):
    """Representação pública de um registro de frequência."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    record_date: date
    classes_scheduled: int
    classes_attended: int
    notes: str | None
    recorded_by: int | None
    created_at: datetime


class AttendanceListResponse(BaseModel):
    """Resposta paginada de registros de frequência."""

    items: list[AttendanceResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class AttendanceSummaryResponse(BaseModel):
    """Totais e classificação agregados no período solicitado."""

    start_date: date | None
    end_date: date | None
    total_students: int
    students_with_data: int
    total_records: int
    classes_scheduled: int
    classes_attended: int
    classes_missed: int
    attendance_percentage: float | None
    classification: Literal["Regular", "Atenção", "Alerta", "Sem dados"]
    distribution: dict[str, int]


class StudentAttendanceSummaryResponse(BaseModel):
    """Resumo individual de frequência no período solicitado."""

    student_id: int
    start_date: date | None
    end_date: date | None
    total_records: int
    classes_scheduled: int
    classes_attended: int
    classes_missed: int
    attendance_percentage: float | None
    classification: Literal["Regular", "Atenção", "Alerta", "Sem dados"]


class AttendanceTimelinePoint(BaseModel):
    """Agregado de frequência de um dia para gráfico temporal."""

    record_date: date
    classes_scheduled: int
    classes_attended: int
    attendance_percentage: float | None


class AttendanceTimelineResponse(BaseModel):
    """Série diária de frequência agregada."""

    start_date: date | None
    end_date: date | None
    points: list[AttendanceTimelinePoint]


class StudentMonthlyAttendancePoint(BaseModel):
    """Agregado mensal de frequência de um estudante."""

    year: int
    month: int
    classes_scheduled: int
    classes_attended: int
    classes_missed: int
    attendance_percentage: float | None
    classification: Literal["Regular", "Atenção", "Alerta", "Sem dados"]


class StudentMonthlyAttendanceResponse(BaseModel):
    """Histórico mensal agregado de um estudante."""

    student_id: int
    start_date: date | None
    end_date: date | None
    months: list[StudentMonthlyAttendancePoint]


class AttendanceAlertItem(BaseModel):
    """Alerta calculado dinamicamente a partir dos registros."""

    student_id: int
    student_name: str
    class_id: int | None
    attendance_percentage: float | None
    classification: Literal["Regular", "Atenção", "Alerta", "Sem dados"]
    consecutive_absence_records: int
    reasons: list[str]


class AttendanceAlertsResponse(BaseModel):
    """Lista dinâmica de estudantes com alertas de frequência."""

    start_date: date | None
    end_date: date | None
    items: list[AttendanceAlertItem]
