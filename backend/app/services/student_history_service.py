from datetime import date

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.student_class_history import StudentClassHistory
from app.repositories.class_repository import ClassRepository
from app.repositories.student_class_history_repository import StudentClassHistoryRepository
from app.repositories.student_repository import StudentRepository


class StudentHistoryNotFoundError(Exception):
    """Indica que o estudante não existe."""


class TransferClassNotFoundError(Exception):
    """Indica que a turma de destino não existe."""


class InvalidTransferError(Exception):
    """Indica uma transferência incompatível com o histórico atual."""


class StudentHistoryService:
    """Coordena leitura do histórico e transferências transacionais."""

    def __init__(
        self,
        student_repository: StudentRepository | None = None,
        class_repository: ClassRepository | None = None,
        history_repository: StudentClassHistoryRepository | None = None,
    ) -> None:
        self.student_repository = student_repository or StudentRepository()
        self.class_repository = class_repository or ClassRepository()
        self.history_repository = history_repository or StudentClassHistoryRepository()

    def list_history(self, db: Session, student_id: int) -> list[StudentClassHistory]:
        if self.student_repository.get_by_id(db, student_id) is None:
            raise StudentHistoryNotFoundError
        return self.history_repository.list_for_student(db, student_id)

    def transfer(
        self,
        db: Session,
        *,
        student_id: int,
        class_id: int,
        transfer_date: date,
    ) -> StudentClassHistory:
        student = self.student_repository.get_by_id(db, student_id)
        if student is None:
            raise StudentHistoryNotFoundError
        if not self.class_repository.get_by_id(db, class_id):
            raise TransferClassNotFoundError

        current = self.history_repository.current_for_student(db, student_id)
        if current is not None:
            if current.class_id == class_id:
                raise InvalidTransferError("Student already belongs to this class")
            if transfer_date < current.start_date:
                raise InvalidTransferError(
                    "Transfer date cannot be before the current enrollment start date"
                )
            current.end_date = transfer_date

        new_history = StudentClassHistory(
            student_id=student_id,
            class_id=class_id,
            start_date=transfer_date,
            end_date=None,
        )
        student.class_id = class_id
        self.history_repository.add(db, new_history)

        try:
            db.commit()
            db.refresh(new_history)
            db.refresh(student)
        except SQLAlchemyError:
            db.rollback()
            raise
        return new_history
