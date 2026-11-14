from datetime import date
from math import ceil

from sqlalchemy.orm import Session

from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.class_repository import ClassRepository
from app.services.attendance_service import (
    AttendanceResourceNotFoundError,
    InvalidAttendancePeriodError,
    classify_attendance,
)


class AttendanceQueryService:
    """Monta contratos de leitura sem misturar cálculos às rotas HTTP."""

    def __init__(
        self,
        attendance_repository: AttendanceRepository | None = None,
        class_repository: ClassRepository | None = None,
    ) -> None:
        self.attendance_repository = attendance_repository or AttendanceRepository()
        self.class_repository = class_repository or ClassRepository()

    @staticmethod
    def _validate_period(start_date: date | None, end_date: date | None) -> None:
        if start_date is not None and end_date is not None and end_date < start_date:
            raise InvalidAttendancePeriodError

    def list_records(
        self,
        db: Session,
        *,
        page: int,
        page_size: int,
        student_id: int | None,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        if student_id is not None and not self.attendance_repository.student_exists(db, student_id):
            raise AttendanceResourceNotFoundError("Student not found")
        self._ensure_class_exists(db, class_id)
        records, total = self.attendance_repository.list_records(
            db,
            student_id=student_id,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        return {
            "items": records,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": ceil(total / page_size) if total else 0,
        }

    def summary(
        self,
        db: Session,
        *,
        start_date: date | None,
        end_date: date | None,
        class_id: int | None = None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        self._ensure_class_exists(db, class_id)
        student_totals = self.attendance_repository.active_student_period_totals(
            db, class_id=class_id, start_date=start_date, end_date=end_date
        )
        totals = self.attendance_repository.period_totals(
            db,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
        )
        distribution = {"Regular": 0, "Atenção": 0, "Alerta": 0, "Sem dados": 0}
        for _, _, _, scheduled, attended in student_totals:
            _, classification = classify_attendance(scheduled, attended)
            distribution[classification] += 1
        percentage, classification = classify_attendance(
            totals["classes_scheduled"], totals["classes_attended"]
        )
        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_students": len(student_totals),
            "students_with_data": totals["students_with_data"],
            "total_records": totals["total_records"],
            "classes_scheduled": totals["classes_scheduled"],
            "classes_attended": totals["classes_attended"],
            "classes_missed": totals["classes_scheduled"] - totals["classes_attended"],
            "attendance_percentage": percentage,
            "classification": classification,
            "distribution": distribution,
        }

    def class_summary(
        self,
        db: Session,
        *,
        class_id: int,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, object]:
        return self.summary(
            db,
            start_date=start_date,
            end_date=end_date,
            class_id=class_id,
        )

    def timeline(
        self,
        db: Session,
        *,
        start_date: date | None,
        end_date: date | None,
        class_id: int | None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        self._ensure_class_exists(db, class_id)
        points = []
        for record_date, scheduled, attended in self.attendance_repository.daily_totals(
            db, class_id=class_id, start_date=start_date, end_date=end_date
        ):
            percentage, _ = classify_attendance(scheduled, attended)
            points.append(
                {
                    "record_date": record_date,
                    "classes_scheduled": scheduled,
                    "classes_attended": attended,
                    "attendance_percentage": percentage,
                }
            )
        return {"start_date": start_date, "end_date": end_date, "points": points}

    def student_summary(
        self,
        db: Session,
        *,
        student_id: int,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        if not self.attendance_repository.student_exists(db, student_id):
            raise AttendanceResourceNotFoundError("Student not found")
        totals = self.attendance_repository.period_totals(
            db,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
            active_only=False,
        )
        percentage, classification = classify_attendance(
            totals["classes_scheduled"], totals["classes_attended"]
        )
        return {
            "student_id": student_id,
            "start_date": start_date,
            "end_date": end_date,
            "total_records": totals["total_records"],
            "classes_scheduled": totals["classes_scheduled"],
            "classes_attended": totals["classes_attended"],
            "classes_missed": totals["classes_scheduled"] - totals["classes_attended"],
            "attendance_percentage": percentage,
            "classification": classification,
        }

    def student_monthly(
        self,
        db: Session,
        *,
        student_id: int,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        if not self.attendance_repository.student_exists(db, student_id):
            raise AttendanceResourceNotFoundError("Student not found")
        months = []
        for year, month, scheduled, attended in self.attendance_repository.monthly_totals(
            db,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
        ):
            percentage, classification = classify_attendance(scheduled, attended)
            months.append(
                {
                    "year": year,
                    "month": month,
                    "classes_scheduled": scheduled,
                    "classes_attended": attended,
                    "classes_missed": scheduled - attended,
                    "attendance_percentage": percentage,
                    "classification": classification,
                }
            )
        return {
            "student_id": student_id,
            "start_date": start_date,
            "end_date": end_date,
            "months": months,
        }

    def alerts(
        self,
        db: Session,
        *,
        start_date: date | None,
        end_date: date | None,
    ) -> dict[str, object]:
        self._validate_period(start_date, end_date)
        student_totals = self.attendance_repository.active_student_period_totals(
            db, class_id=None, start_date=start_date, end_date=end_date
        )
        rows = self.attendance_repository.attendance_rows_until(
            db, end_date=end_date or date.today()
        )
        current_streaks: dict[int, int] = {}
        previous_student_id: int | None = None
        for student_id, _, scheduled, attended in rows:
            if student_id != previous_student_id:
                current_streaks[student_id] = 0
                previous_student_id = student_id
            if scheduled == 0:
                continue
            if attended == 0:
                current_streaks[student_id] += 1
            else:
                current_streaks[student_id] = 0

        alert_items = []
        for student_id, name, class_id, scheduled, attended in student_totals:
            percentage, classification = classify_attendance(scheduled, attended)
            reasons = []
            if classification == "Alerta":
                reasons.append("Frequência abaixo de 60% no período selecionado")
            elif classification == "Atenção":
                reasons.append("Frequência de 60% a menos de 75% no período selecionado")
            streak = current_streaks.get(student_id, 0)
            if streak >= 5:
                reasons.append("5 ou mais faltas consecutivas registradas")
            if reasons:
                alert_items.append(
                    {
                        "student_id": student_id,
                        "student_name": name,
                        "class_id": class_id,
                        "attendance_percentage": percentage,
                        "classification": classification,
                        "consecutive_absence_records": streak,
                        "reasons": reasons,
                    }
                )
        alert_items.sort(
            key=lambda item: (
                item["classification"] != "Alerta",
                -item["consecutive_absence_records"],
                item["student_name"].casefold(),
            )
        )
        return {"start_date": start_date, "end_date": end_date, "items": alert_items}

    def _ensure_class_exists(self, db: Session, class_id: int | None) -> None:
        if class_id is not None and self.class_repository.get_by_id(db, class_id) is None:
            raise AttendanceResourceNotFoundError("Class not found")
