from datetime import date

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.attendance_record import AttendanceRecord
from app.models.student import Student
from app.models.student_class_history import StudentClassHistory


class AttendanceRepository:
    """Encapsula consultas e inserções de frequência."""

    def get_by_student_and_date(
        self,
        db: Session,
        student_id: int,
        record_date: date,
    ) -> AttendanceRecord | None:
        statement = select(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.record_date == record_date,
        )
        return db.scalar(statement)

    def add(self, db: Session, record: AttendanceRecord) -> AttendanceRecord:
        db.add(record)
        return record

    @staticmethod
    def _record_conditions(
        *,
        student_id: int | None,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
        active_only: bool,
    ) -> list[object]:
        conditions: list[object] = []
        if student_id is not None:
            conditions.append(AttendanceRecord.student_id == student_id)
        if start_date is not None:
            conditions.append(AttendanceRecord.record_date >= start_date)
        if end_date is not None:
            conditions.append(AttendanceRecord.record_date <= end_date)
        if active_only:
            conditions.append(Student.is_active.is_(True))
        if class_id is not None:
            conditions.append(
                exists(
                    select(1).where(
                        StudentClassHistory.student_id == AttendanceRecord.student_id,
                        StudentClassHistory.class_id == class_id,
                        StudentClassHistory.start_date <= AttendanceRecord.record_date,
                        or_(
                            StudentClassHistory.end_date.is_(None),
                            StudentClassHistory.end_date > AttendanceRecord.record_date,
                        ),
                    )
                )
            )
        return conditions

    def _record_statement(
        self,
        *,
        student_id: int | None,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
        active_only: bool = True,
    ):
        conditions = self._record_conditions(
            student_id=student_id,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
            active_only=active_only,
        )
        return select(AttendanceRecord).join(
            Student, Student.id == AttendanceRecord.student_id
        ).where(*conditions)

    def list_records(
        self,
        db: Session,
        *,
        student_id: int | None,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AttendanceRecord], int]:
        statement = self._record_statement(
            student_id=student_id,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
            active_only=False,
        )
        count_statement = select(func.count()).select_from(statement.subquery())
        total = db.scalar(count_statement) or 0
        page_statement = statement.order_by(AttendanceRecord.record_date.desc(), AttendanceRecord.id)
        page_statement = page_statement.offset(offset).limit(limit)
        return list(db.scalars(page_statement)), total

    def period_totals(
        self,
        db: Session,
        *,
        student_id: int | None = None,
        class_id: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        active_only: bool = True,
    ) -> dict[str, int]:
        statement = self._record_statement(
            student_id=student_id,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
            active_only=active_only,
        ).with_only_columns(
            func.coalesce(func.sum(AttendanceRecord.classes_scheduled), 0),
            func.coalesce(func.sum(AttendanceRecord.classes_attended), 0),
            func.count(AttendanceRecord.id),
            func.count(func.distinct(AttendanceRecord.student_id)),
        )
        scheduled, attended, records, students = db.execute(statement).one()
        return {
            "classes_scheduled": int(scheduled),
            "classes_attended": int(attended),
            "total_records": int(records),
            "students_with_data": int(students),
        }

    def daily_totals(
        self,
        db: Session,
        *,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
    ) -> list[tuple[date, int, int]]:
        statement = self._record_statement(
            student_id=None,
            class_id=class_id,
            start_date=start_date,
            end_date=end_date,
        ).with_only_columns(
            AttendanceRecord.record_date,
            func.sum(AttendanceRecord.classes_scheduled),
            func.sum(AttendanceRecord.classes_attended),
        )
        statement = statement.group_by(AttendanceRecord.record_date).order_by(
            AttendanceRecord.record_date
        )
        return [(day, int(scheduled), int(attended)) for day, scheduled, attended in db.execute(statement)]

    def monthly_totals(
        self,
        db: Session,
        *,
        student_id: int,
        start_date: date | None,
        end_date: date | None,
    ) -> list[tuple[int, int, int, int]]:
        statement = self._record_statement(
            student_id=student_id,
            class_id=None,
            start_date=start_date,
            end_date=end_date,
            active_only=False,
        ).with_only_columns(
            func.year(AttendanceRecord.record_date),
            func.month(AttendanceRecord.record_date),
            func.sum(AttendanceRecord.classes_scheduled),
            func.sum(AttendanceRecord.classes_attended),
        )
        statement = statement.group_by(
            func.year(AttendanceRecord.record_date),
            func.month(AttendanceRecord.record_date),
        ).order_by(
            func.year(AttendanceRecord.record_date),
            func.month(AttendanceRecord.record_date),
        )
        return [
            (int(year), int(month), int(scheduled), int(attended))
            for year, month, scheduled, attended in db.execute(statement)
        ]

    def active_student_period_totals(
        self,
        db: Session,
        *,
        class_id: int | None,
        start_date: date | None,
        end_date: date | None,
    ) -> list[tuple[int, str, int | None, int, int]]:
        attendance_conditions: list[object] = []
        if start_date is not None:
            attendance_conditions.append(AttendanceRecord.record_date >= start_date)
        if end_date is not None:
            attendance_conditions.append(AttendanceRecord.record_date <= end_date)
        if class_id is not None:
            attendance_conditions.extend(
                [
                    exists(
                        select(1).where(
                            StudentClassHistory.student_id == AttendanceRecord.student_id,
                            StudentClassHistory.class_id == class_id,
                            StudentClassHistory.start_date <= AttendanceRecord.record_date,
                            or_(
                                StudentClassHistory.end_date.is_(None),
                                StudentClassHistory.end_date > AttendanceRecord.record_date,
                            ),
                        )
                    )
                ]
            )

        attendance_source = select(
            AttendanceRecord.student_id.label("student_id"),
            func.sum(AttendanceRecord.classes_scheduled).label("scheduled"),
            func.sum(AttendanceRecord.classes_attended).label("attended"),
        ).select_from(AttendanceRecord)
        attendance_source = (
            attendance_source.where(*attendance_conditions)
            .group_by(AttendanceRecord.student_id)
            .subquery()
        )

        statement = (
            select(
                Student.id,
                Student.name,
                Student.class_id,
                func.coalesce(attendance_source.c.scheduled, 0),
                func.coalesce(attendance_source.c.attended, 0),
            )
            .select_from(Student)
            .outerjoin(attendance_source, attendance_source.c.student_id == Student.id)
            .where(Student.is_active.is_(True))
        )
        if class_id is not None:
            history_conditions: list[object] = [
                StudentClassHistory.student_id == Student.id,
                StudentClassHistory.class_id == class_id,
            ]
            if end_date is not None:
                history_conditions.append(StudentClassHistory.start_date <= end_date)
            if start_date is not None:
                history_conditions.append(
                    or_(
                        StudentClassHistory.end_date.is_(None),
                        StudentClassHistory.end_date > start_date,
                    )
                )
            history_exists = exists(select(1).where(*history_conditions))
            statement = statement.where(history_exists)
        statement = statement.order_by(Student.id)
        return [
            (int(student_id), name, class_id_value, int(scheduled), int(attended))
            for student_id, name, class_id_value, scheduled, attended in db.execute(statement)
        ]

    def student_exists(self, db: Session, student_id: int) -> bool:
        return db.get(Student, student_id) is not None

    def attendance_rows_until(
        self,
        db: Session,
        *,
        end_date: date,
    ) -> list[tuple[int, date, int, int]]:
        statement = (
            select(
                AttendanceRecord.student_id,
                AttendanceRecord.record_date,
                AttendanceRecord.classes_scheduled,
                AttendanceRecord.classes_attended,
            )
            .join(Student, Student.id == AttendanceRecord.student_id)
            .where(
                Student.is_active.is_(True),
                AttendanceRecord.record_date <= end_date,
            )
            .order_by(AttendanceRecord.student_id, AttendanceRecord.record_date)
        )
        return [
            (int(student_id), day, int(scheduled), int(attended))
            for student_id, day, scheduled, attended in db.execute(statement)
        ]
