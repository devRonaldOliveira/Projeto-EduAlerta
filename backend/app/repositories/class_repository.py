from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.class_model import Class


class ClassRepository:
    """Encapsula consultas de turmas no banco existente."""

    def list_all(self, db: Session) -> list[Class]:
        statement = select(Class).order_by(Class.id)
        return list(db.scalars(statement))

    def get_by_id(self, db: Session, class_id: int) -> Class | None:
        return db.get(Class, class_id)

    def add(self, db: Session, class_item: Class) -> Class:
        db.add(class_item)
        return class_item
