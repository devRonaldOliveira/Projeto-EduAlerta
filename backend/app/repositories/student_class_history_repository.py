from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.student_class_history import StudentClassHistory


class StudentClassHistoryRepository:
    """Encapsula consultas e inserções do histórico."""

    def list_for_student(self, db: Session, student_id: int) -> list[StudentClassHistory]:
        statement = (
            select(StudentClassHistory)
            .where(StudentClassHistory.student_id == student_id)
            .order_by(StudentClassHistory.start_date, StudentClassHistory.id)
        )
        return list(db.scalars(statement))

    def current_for_student(
        self,
        db: Session,
        student_id: int,
    ) -> StudentClassHistory | None:
        statement = (
            select(StudentClassHistory)
            .where(
                StudentClassHistory.student_id == student_id,
                StudentClassHistory.end_date.is_(None),
            )
            .order_by(StudentClassHistory.start_date.desc())
        )
        return db.scalar(statement)

    def add(self, db: Session, history: StudentClassHistory) -> StudentClassHistory:
        db.add(history)
        return history
