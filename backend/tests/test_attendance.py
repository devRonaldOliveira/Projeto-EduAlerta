"""Testes do registro de frequência."""

from collections.abc import Generator
from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient

from app.database.connection import get_db
from app.main import app
from app.models.attendance_record import AttendanceRecord
from app.models.student import Student


class FakeAttendanceSession:
    def __init__(
        self,
        *,
        student_exists: bool = True,
        student_active: bool = True,
        duplicate: bool = False,
    ) -> None:
        self.student = (
            Student(
                id=1,
                name="Ana Silva",
                enrollment_code="MAT-001",
                class_id=1,
                birth_date=None,
                guardian_name=None,
                guardian_contact=None,
                is_active=student_active,
                created_at=datetime(2026, 1, 1, 8, 0),
            )
            if student_exists
            else None
        )
        self.duplicate = duplicate
        self.records: list[AttendanceRecord] = []

    def get(self, model: type[Student], object_id: int) -> Student | None:
        return self.student if object_id == 1 else None

    def scalar(self, statement: object) -> AttendanceRecord | None:
        if self.duplicate:
            return AttendanceRecord(id=1)
        return None

    def add(self, record: AttendanceRecord) -> None:
        record.id = 1
        self.records.append(record)

    def commit(self) -> None:
        pass

    def refresh(self, record: AttendanceRecord) -> None:
        pass

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass


def attendance_db() -> Generator[FakeAttendanceSession, None, None]:
    yield FakeAttendanceSession()


def inactive_student_db() -> Generator[FakeAttendanceSession, None, None]:
    yield FakeAttendanceSession(student_active=False)


def duplicate_attendance_db() -> Generator[FakeAttendanceSession, None, None]:
    yield FakeAttendanceSession(duplicate=True)


def test_create_attendance_returns_201() -> None:
    app.dependency_overrides[get_db] = attendance_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today()),
                "classes_scheduled": 5,
                "classes_attended": 4,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["classes_scheduled"] == 5
    assert response.json()["classes_attended"] == 4
    assert response.json()["recorded_by"] is None


def test_create_attendance_allows_zero_scheduled_classes() -> None:
    app.dependency_overrides[get_db] = attendance_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today()),
                "classes_scheduled": 0,
                "classes_attended": 0,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201


def test_create_attendance_rejects_future_date() -> None:
    app.dependency_overrides[get_db] = attendance_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today() + timedelta(days=1)),
                "classes_scheduled": 5,
                "classes_attended": 5,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json() == {"detail": "Cannot register attendance for a future date"}


def test_create_attendance_rejects_inactive_student() -> None:
    app.dependency_overrides[get_db] = inactive_student_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today()),
                "classes_scheduled": 5,
                "classes_attended": 5,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Cannot register attendance for an inactive student"
    }


def test_create_attendance_rejects_duplicate_record() -> None:
    app.dependency_overrides[get_db] = duplicate_attendance_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today()),
                "classes_scheduled": 5,
                "classes_attended": 5,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 409


def test_create_attendance_rejects_attended_above_scheduled() -> None:
    app.dependency_overrides[get_db] = attendance_db
    try:
        response = TestClient(app).post(
            "/attendance",
            json={
                "student_id": 1,
                "record_date": str(date.today()),
                "classes_scheduled": 3,
                "classes_attended": 4,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
