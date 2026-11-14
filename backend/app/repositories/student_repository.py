from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.class_model import Class
from app.models.student import Student


class StudentRepository:
    """Encapsula consultas de estudantes no banco existente."""

    def get_by_id(self, db: Session, student_id: int) -> Student | None:
        return db.get(Student, student_id)

    def get_by_enrollment_code(self, db: Session, enrollment_code: str) -> Student | None:
        statement = select(Student).where(Student.enrollment_code == enrollment_code)
        return db.scalar(statement)

    def class_exists(self, db: Session, class_id: int) -> bool:
        return db.get(Class, class_id) is not None

    def add(self, db: Session, student: Student) -> Student:
        db.add(student)
        return student

    def list_filtered(
        self,
        db: Session,
        *,
        page: int,
        page_size: int,
        class_id: int | None,
        is_active: bool | None,
        search: str | None,
    ) -> tuple[list[Student], int]:
        filters = []
        if class_id is not None:
            filters.append(Student.class_id == class_id)
        if is_active is not None:
            filters.append(Student.is_active == is_active)
        if search:
            search_term = f"%{search}%"
            filters.append(
                or_(
                    Student.name.ilike(search_term),
                    Student.enrollment_code.ilike(search_term),
                )
            )

        total_statement = select(func.count()).select_from(Student).where(*filters)
        total = db.scalar(total_statement) or 0
        statement: Select[tuple[Student]] = (
            select(Student)
            .where(*filters)
            .order_by(Student.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(db.scalars(statement)), total
