from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.class_model import Class
from app.repositories.class_repository import ClassRepository


class DuplicateClassNameError(Exception):
    """Indica que o nome da turma já existe."""


class ClassService:
    """Coordena consultas de turmas sem conhecer detalhes HTTP."""

    def __init__(self, repository: ClassRepository | None = None) -> None:
        self.repository = repository or ClassRepository()

    def list_classes(self, db: Session) -> list[Class]:
        return self.repository.list_all(db)

    def get_class(self, db: Session, class_id: int) -> Class | None:
        return self.repository.get_by_id(db, class_id)

    def create_class(self, db: Session, name: str, active: bool) -> Class:
        class_item = Class(name=name, active=active)
        self.repository.add(db, class_item)
        try:
            db.commit()
            db.refresh(class_item)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateClassNameError from exc
        return class_item

    def update_class(
        self,
        db: Session,
        class_id: int,
        name: str | None = None,
        active: bool | None = None,
    ) -> Class | None:
        class_item = self.repository.get_by_id(db, class_id)
        if class_item is None:
            return None

        if name is not None:
            class_item.name = name
        if active is not None:
            class_item.active = active

        try:
            db.commit()
            db.refresh(class_item)
        except IntegrityError as exc:
            db.rollback()
            raise DuplicateClassNameError from exc
        return class_item
