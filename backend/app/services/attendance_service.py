from datetime import date, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.attendance_record import AttendanceRecord
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.student_repository import StudentRepository


class AttendanceResourceNotFoundError(Exception):
    """Indica que um estudante ou turma solicitado não existe."""


class InvalidAttendancePeriodError(Exception):
    """Indica um intervalo de datas invertido."""


def classify_attendance(classes_scheduled: int, classes_attended: int) -> tuple[float | None, str]:
    """Aplica as faixas acordadas: Regular >=75%, Atenção >=60%, Alerta <60%."""
    if classes_scheduled == 0:
        return None, "Sem dados"
    exact_percentage = classes_attended / classes_scheduled * 100
    percentage = round(exact_percentage, 1)
    if exact_percentage >= 75:
        classification = "Regular"
    elif exact_percentage >= 60:
        classification = "Atenção"
    else:
        classification = "Alerta"
    return percentage, classification


class AttendanceStudentNotFoundError(Exception):
    """Indica que o estudante do lançamento não existe."""


class InactiveStudentAttendanceError(Exception):
    """Indica tentativa de lançamento para estudante inativo."""


class FutureAttendanceDateError(Exception):
    """Indica tentativa de lançamento de frequência futura."""


class DuplicateAttendanceError(Exception):
    """Indica que já existe frequência para estudante e data."""


class AttendanceService:
    """Valida e persiste registros de frequência diária."""

    def __init__(
        self,
        attendance_repository: AttendanceRepository | None = None,
        student_repository: StudentRepository | None = None,
    ) -> None:
        self.attendance_repository = attendance_repository or AttendanceRepository()
        self.student_repository = student_repository or StudentRepository()

    def create_record(
        self,
        db: Session,
        *,
        student_id: int,
        record_date: date,
        classes_scheduled: int,
        classes_attended: int,
        notes: str | None,
    ) -> AttendanceRecord:
        student = self.student_repository.get_by_id(db, student_id)
        if student is None:
            raise AttendanceStudentNotFoundError
        if not student.is_active:
            raise InactiveStudentAttendanceError
        if record_date > date.today():
            raise FutureAttendanceDateError
        if self.attendance_repository.get_by_student_and_date(db, student_id, record_date):
            raise DuplicateAttendanceError

        record = AttendanceRecord(
            student_id=student_id,
            record_date=record_date,
            classes_scheduled=classes_scheduled,
            classes_attended=classes_attended,
            notes=notes,
            recorded_by=None,
            created_at=datetime.now(),
        )
        self.attendance_repository.add(db, record)
        try:
            db.commit()
            db.refresh(record)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateAttendanceError from exc
        return record
