"""Testes das consultas HTTP de turmas."""

from collections.abc import Generator, Iterable

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.database.connection import get_db
from app.main import app
from app.models.class_model import Class


class FakeScalarResult:
    def __init__(self, items: Iterable[Class]) -> None:
        self.items = items

    def __iter__(self):
        return iter(self.items)


class FakeClassSession:
    def __init__(self, should_fail_commit: bool = False) -> None:
        self.should_fail_commit = should_fail_commit
        self.classes = [
            Class(id=1, name="1º Ano A", active=True),
            Class(id=2, name="1º Ano B", active=False),
        ]

    def scalars(self, statement: object) -> FakeScalarResult:
        return FakeScalarResult(self.classes)

    def get(self, model: type[Class], class_id: int) -> Class | None:
        return next((item for item in self.classes if item.id == class_id), None)

    def add(self, class_item: Class) -> None:
        class_item.id = 3
        self.classes.append(class_item)

    def commit(self) -> None:
        if self.should_fail_commit:
            raise IntegrityError(None, None, Exception("duplicate"))

    def refresh(self, class_item: Class) -> None:
        pass

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass


def override_db() -> Generator[FakeClassSession, None, None]:
    yield FakeClassSession()


def duplicate_db() -> Generator[FakeClassSession, None, None]:
    yield FakeClassSession(should_fail_commit=True)


def test_list_classes_returns_existing_classes() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/classes")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "1º Ano A", "active": True},
        {"id": 2, "name": "1º Ano B", "active": False},
    ]


def test_get_class_returns_existing_class() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/classes/1")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "1º Ano A", "active": True}


def test_get_class_returns_404_when_class_does_not_exist() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/classes/99")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Class not found"}


def test_create_class_returns_201() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).post("/classes", json={"name": "2º Ano A"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json() == {"id": 3, "name": "2º Ano A", "active": True}


def test_update_class_returns_updated_class() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).patch("/classes/1", json={"active": False})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "1º Ano A", "active": False}


def test_create_class_returns_409_for_duplicate_name() -> None:
    app.dependency_overrides[get_db] = duplicate_db
    try:
        response = TestClient(app).post("/classes", json={"name": "1º Ano A"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json() == {"detail": "Class name already exists"}
