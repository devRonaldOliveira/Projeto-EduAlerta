"""Testes da consulta HTTP de estudantes."""

from collections.abc import Generator
from datetime import date, datetime

from fastapi.testclient import TestClient

from app.database.connection import get_db
from app.main import app
from app.models.class_model import Class
from app.models.student import Student
from app.models.student_class_history import StudentClassHistory


class FakeStudentSession:
    def __init__(self) -> None:
        self.student = Student(
            id=1,
            name="Ana Silva",
            enrollment_code="MAT-001",
            class_id=2,
            birth_date=date(2012, 5, 10),
            guardian_name="Responsável",
            guardian_contact="11999999999",
            is_active=True,
            created_at=datetime(2026, 1, 10, 8, 0),
        )

    def get(self, model: type[Student], student_id: int) -> Student | None:
        return self.student if student_id == self.student.id else None

    def commit(self) -> None:
        pass

    def refresh(self, student: Student) -> None:
        pass

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass


def override_db() -> Generator[FakeStudentSession, None, None]:
    yield FakeStudentSession()


def test_get_student_returns_existing_student() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/students/1")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "name": "Ana Silva",
        "enrollment_code": "MAT-001",
        "class_id": 2,
        "birth_date": "2012-05-10",
        "guardian_name": "Responsável",
        "guardian_contact": "11999999999",
        "is_active": True,
        "created_at": "2026-01-10T08:00:00",
    }


def test_get_student_returns_404_when_student_does_not_exist() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/students/99")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Student not found"}


class FakeStudentWriteSession:
    def __init__(self, *, duplicate: bool = False, class_exists: bool = True) -> None:
        self.duplicate = duplicate
        self.has_class = class_exists
        self.students: list[Student] = []
        self.histories: list[StudentClassHistory] = []

    def scalar(self, statement: object) -> int | Student | None:
        statement_text = str(statement)
        if "enrollment_code" in statement_text:
            return Student(id=1) if self.duplicate else None
        return len(self.students)

    def scalars(self, statement: object) -> list[Student]:
        return self.students

    def get(self, model: type[Student] | type[Class], object_id: int) -> Student | Class | None:
        if model is Class:
            return Class(id=object_id, name="1º Ano A", active=True) if self.has_class else None
        return next((item for item in self.students if item.id == object_id), None)

    def add(self, item: Student | StudentClassHistory) -> None:
        if isinstance(item, Student):
            item.id = 1
            self.students.append(item)
        else:
            self.histories.append(item)

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        pass

    def refresh(self, item: Student) -> None:
        pass

    def rollback(self) -> None:
        pass


def write_db() -> Generator[FakeStudentWriteSession, None, None]:
    yield FakeStudentWriteSession()


def duplicate_student_db() -> Generator[FakeStudentWriteSession, None, None]:
    yield FakeStudentWriteSession(duplicate=True)


def missing_class_db() -> Generator[FakeStudentWriteSession, None, None]:
    yield FakeStudentWriteSession(class_exists=False)


def test_list_students_returns_paginated_envelope() -> None:
    session = FakeStudentWriteSession()
    session.students = [
        Student(
            id=1,
            name="Ana",
            enrollment_code="MAT-001",
            class_id=None,
            birth_date=None,
            guardian_name=None,
            guardian_contact=None,
            is_active=True,
            created_at=datetime(2026, 1, 10, 8, 0),
        )
    ]

    def override() -> Generator[FakeStudentWriteSession, None, None]:
        yield session

    app.dependency_overrides[get_db] = override
    try:
        response = TestClient(app).get("/students?page=1&page_size=20&is_active=true")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["page"] == 1
    assert response.json()["page_size"] == 20
    assert response.json()["total"] == 1
    assert response.json()["total_pages"] == 1


def test_create_student_creates_initial_history_when_class_is_provided() -> None:
    session = FakeStudentWriteSession()

    def override() -> Generator[FakeStudentWriteSession, None, None]:
        yield session

    app.dependency_overrides[get_db] = override
    try:
        response = TestClient(app).post(
            "/students",
            json={"name": "Ana", "enrollment_code": "MAT-001", "class_id": 2},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["enrollment_code"] == "MAT-001"
    assert len(session.histories) == 1
    assert session.histories[0].student_id == 1
    assert session.histories[0].class_id == 2


def test_create_student_returns_409_for_duplicate_enrollment() -> None:
    app.dependency_overrides[get_db] = duplicate_student_db
    try:
        response = TestClient(app).post(
            "/students",
            json={"name": "Ana", "enrollment_code": "MAT-001"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
    assert response.json() == {"detail": "Enrollment code already exists"}


def test_create_student_returns_404_for_missing_class() -> None:
    app.dependency_overrides[get_db] = missing_class_db
    try:
        response = TestClient(app).post(
            "/students",
            json={"name": "Ana", "enrollment_code": "MAT-001", "class_id": 99},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Class not found"}


def test_update_student_changes_cadastral_data() -> None:
    session = FakeStudentSession()

    def override() -> Generator[FakeStudentSession, None, None]:
        yield session

    app.dependency_overrides[get_db] = override
    try:
        response = TestClient(app).patch(
            "/students/1",
            json={"guardian_contact": "11888888888"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["guardian_contact"] == "11888888888"


def test_update_student_does_not_accept_direct_class_change() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).patch("/students/1", json={"class_id": 3})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_deactivate_student_preserves_record_and_sets_inactive() -> None:
    session = FakeStudentSession()

    def override() -> Generator[FakeStudentSession, None, None]:
        yield session

    app.dependency_overrides[get_db] = override
    try:
        response = TestClient(app).patch("/students/1/deactivate")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["is_active"] is False


class FakeHistorySession:
    def __init__(self) -> None:
        self.student = Student(
            id=1,
            name="Ana Silva",
            enrollment_code="MAT-001",
            class_id=2,
            birth_date=None,
            guardian_name=None,
            guardian_contact=None,
            is_active=True,
            created_at=datetime(2026, 1, 10, 8, 0),
        )
        self.current = StudentClassHistory(
            id=10,
            student_id=1,
            class_id=2,
            start_date=date(2026, 1, 1),
            end_date=None,
        )
        self.histories = [self.current]

    def get(self, model: type[Student] | type[Class], object_id: int) -> Student | Class | None:
        if model is Student:
            return self.student if object_id == 1 else None
        if model is Class:
            return Class(id=object_id, name="Turma", active=True) if object_id in (2, 3) else None
        return None

    def scalars(self, statement: object) -> list[StudentClassHistory]:
        return self.histories

    def scalar(self, statement: object) -> StudentClassHistory | None:
        return self.current

    def add(self, item: StudentClassHistory) -> None:
        item.id = 11
        self.histories.append(item)

    def commit(self) -> None:
        pass

    def refresh(self, item: Student | StudentClassHistory) -> None:
        pass

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass


def history_db() -> Generator[FakeHistorySession, None, None]:
    yield FakeHistorySession()


def test_list_class_history_returns_ordered_history() -> None:
    app.dependency_overrides[get_db] = history_db
    try:
        response = TestClient(app).get("/students/1/class-history")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": 10,
            "student_id": 1,
            "class_id": 2,
            "start_date": "2026-01-01",
            "end_date": None,
        }
    ]


def test_transfer_closes_current_history_and_creates_new_one() -> None:
    session = FakeHistorySession()

    def override() -> Generator[FakeHistorySession, None, None]:
        yield session

    app.dependency_overrides[get_db] = override
    try:
        response = TestClient(app).post(
            "/students/1/transfers",
            json={"class_id": 3, "transfer_date": "2026-02-01"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json() == {
        "id": 11,
        "student_id": 1,
        "class_id": 3,
        "start_date": "2026-02-01",
        "end_date": None,
    }
    assert session.current.end_date == date(2026, 2, 1)
    assert session.student.class_id == 3


def test_transfer_to_same_class_returns_409() -> None:
    app.dependency_overrides[get_db] = history_db
    try:
        response = TestClient(app).post(
            "/students/1/transfers",
            json={"class_id": 2, "transfer_date": "2026-02-01"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409


def test_transfer_before_current_start_date_returns_409() -> None:
    app.dependency_overrides[get_db] = history_db
    try:
        response = TestClient(app).post(
            "/students/1/transfers",
            json={"class_id": 3, "transfer_date": "2025-12-31"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409
