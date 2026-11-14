"""Testes do contrato HTTP de health check."""

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.database.connection import get_db
from app.main import app


class FakeSession:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    def execute(self, statement: object) -> None:
        if self.should_fail:
            raise SQLAlchemyError("simulated database failure")

    def close(self) -> None:
        pass


def override_db() -> Generator[FakeSession, None, None]:
    yield FakeSession()


def failing_db() -> Generator[FakeSession, None, None]:
    yield FakeSession(should_fail=True)


def test_health_returns_api_and_database_status() -> None:
    app.dependency_overrides[get_db] = override_db
    try:
        response = TestClient(app).get("/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_returns_503_when_database_is_unavailable() -> None:
    app.dependency_overrides[get_db] = failing_db
    try:
        response = TestClient(app).get("/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_docs_is_available() -> None:
    response = TestClient(app).get("/docs")

    assert response.status_code == 200
