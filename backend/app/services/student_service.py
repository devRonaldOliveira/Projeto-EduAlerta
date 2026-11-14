from datetime import date, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.student_class_history import StudentClassHistory
from app.models.student import Student
from app.repositories.student_repository import StudentRepository


class DuplicateEnrollmentCodeError(Exception):
    """Indica que a matrícula já existe."""


class ClassNotFoundError(Exception):
    """Indica que a turma informada não existe."""


class StudentNotFoundError(Exception):
    """Indica que o estudante não existe."""


class StudentService:
    """Coordena consultas sem conhecer detalhes HTTP."""

    def __init__(self, repository: StudentRepository | None = None) -> None:
        self.repository = repository or StudentRepository()

    def get_student(self, db: Session, student_id: int) -> Student | None:
        return self.repository.get_by_id(db, student_id)

    def list_students(
        self,
        db: Session,
        *,
        page: int,
        page_size: int,
        class_id: int | None,
        is_active: bool | None,
        search: str | None,
    ) -> tuple[list[Student], int]:
        return self.repository.list_filtered(
            db,
            page=page,
            page_size=page_size,
            class_id=class_id,
            is_active=is_active,
            search=search,
        )

    def create_student(
        self,
        db: Session,
        *,
        name: str,
        enrollment_code: str,
        class_id: int | None,
        birth_date: date | None,
        guardian_name: str | None,
        guardian_contact: str | None,
        is_active: bool,
    ) -> Student:
        if self.repository.get_by_enrollment_code(db, enrollment_code) is not None:
            raise DuplicateEnrollmentCodeError
        if class_id is not None and not self.repository.class_exists(db, class_id):
            raise ClassNotFoundError

        student = Student(
            name=name,
            enrollment_code=enrollment_code,
            class_id=class_id,
            birth_date=birth_date,
            guardian_name=guardian_name,
            guardian_contact=guardian_contact,
            is_active=is_active,
            created_at=datetime.now(),
        )
        self.repository.add(db, student)
        try:
            db.flush()
            if class_id is not None:
                db.add(
                    StudentClassHistory(
                        student_id=student.id,
                        class_id=class_id,
                        start_date=date.today(),
                        end_date=None,
                    )
                )
            db.commit()
            db.refresh(student)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateEnrollmentCodeError from exc
        return student

    def update_student(
        self,
        db: Session,
        student_id: int,
        changes: dict[str, object],
    ) -> Student:
        student = self.repository.get_by_id(db, student_id)
        if student is None:
            raise StudentNotFoundError

        if "enrollment_code" in changes:
            existing = self.repository.get_by_enrollment_code(
                db, str(changes["enrollment_code"])
            )
            if existing is not None and existing.id != student_id:
                raise DuplicateEnrollmentCodeError

        for field, value in changes.items():
            setattr(student, field, value)

        try:
            db.commit()
            db.refresh(student)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateEnrollmentCodeError from exc
        return student

    def deactivate_student(self, db: Session, student_id: int) -> Student:
        student = self.repository.get_by_id(db, student_id)
        if student is None:
            raise StudentNotFoundError

        student.is_active = False
        db.commit()
        db.refresh(student)
        return student
