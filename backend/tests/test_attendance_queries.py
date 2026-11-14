"""Testes das regras de leitura e agregação de frequência."""

from datetime import date

import pytest

from app.services.attendance_service import InvalidAttendancePeriodError, classify_attendance
from app.services.attendance_query_service import AttendanceQueryService


class FakeAttendanceRepository:
    def active_student_period_totals(self, db, *, class_id, start_date, end_date):
        return [
            (1, "Ana Silva", 1, 10, 8),
            (2, "Bia Souza", 1, 10, 7),
            (3, "Caio Lima", 1, 10, 5),
            (4, "Dani Reis", 1, 0, 0),
        ]

    def period_totals(
        self, db, *, student_id=None, class_id=None, start_date=None, end_date=None, active_only=True
    ):
        if student_id == 1:
            return {
                "classes_scheduled": 10,
                "classes_attended": 8,
                "total_records": 2,
                "students_with_data": 1,
            }
        return {
            "classes_scheduled": 40,
            "classes_attended": 30,
            "total_records": 8,
            "students_with_data": 3,
        }

    def student_exists(self, db, student_id):
        return student_id in (1, 2, 3, 4)

    def monthly_totals(self, db, *, student_id, start_date, end_date):
        return [(2026, 8, 10, 8), (2026, 9, 10, 7)]

    def attendance_rows_until(self, db, *, end_date):
        return [
            (1, date(2026, 10, 1), 5, 0),
            (1, date(2026, 10, 2), 5, 0),
            (1, date(2026, 10, 3), 5, 0),
            (1, date(2026, 10, 4), 5, 0),
            (1, date(2026, 10, 5), 5, 0),
            (2, date(2026, 10, 1), 5, 0),
            (2, date(2026, 10, 2), 5, 4),
            (3, date(2026, 10, 1), 5, 0),
        ]


class FakeClassRepository:
    def get_by_id(self, db, class_id):
        return object() if class_id == 1 else None


@pytest.fixture
def service() -> AttendanceQueryService:
    return AttendanceQueryService(FakeAttendanceRepository(), FakeClassRepository())


@pytest.mark.parametrize(
    ("scheduled", "attended", "expected_percentage", "expected_classification"),
    [
        (0, 0, None, "Sem dados"),
        (100, 75, 75.0, "Regular"),
        (100, 60, 60.0, "Atenção"),
        (100, 59, 59.0, "Alerta"),
        (1000, 749, 74.9, "Atenção"),
    ],
)
def test_classify_attendance_boundaries(
    scheduled: int, attended: int, expected_percentage: float | None, expected_classification: str
) -> None:
    assert classify_attendance(scheduled, attended) == (expected_percentage, expected_classification)


def test_summary_aggregates_counts_and_distribution(service: AttendanceQueryService) -> None:
    result = service.summary(None, start_date=None, end_date=None)

    assert result["classes_scheduled"] == 40
    assert result["classes_attended"] == 30
    assert result["attendance_percentage"] == 75.0
    assert result["distribution"] == {"Regular": 1, "Atenção": 1, "Alerta": 1, "Sem dados": 1}


def test_student_summary_has_individual_contract(service: AttendanceQueryService) -> None:
    result = service.student_summary(None, student_id=1, start_date=None, end_date=None)

    assert result["total_records"] == 2
    assert result["classes_missed"] == 2
    assert result["classification"] == "Regular"


def test_monthly_history_returns_classification_per_month(service: AttendanceQueryService) -> None:
    result = service.student_monthly(None, student_id=1, start_date=None, end_date=None)

    assert [month["month"] for month in result["months"]] == [8, 9]
    assert [month["classification"] for month in result["months"]] == ["Regular", "Atenção"]


def test_alerts_use_five_absences_and_partial_attendance_breaks_streak(
    service: AttendanceQueryService,
) -> None:
    result = service.alerts(None, start_date=None, end_date=date(2026, 10, 5))
    items = {item["student_id"]: item for item in result["items"]}

    assert items[1]["consecutive_absence_records"] == 5
    assert "5 ou mais faltas consecutivas registradas" in items[1]["reasons"]
    assert items[2]["consecutive_absence_records"] == 0
    assert items[2]["classification"] == "Atenção"
    assert items[3]["classification"] == "Alerta"
    assert 4 not in items


def test_query_service_rejects_inverted_period(service: AttendanceQueryService) -> None:
    with pytest.raises(InvalidAttendancePeriodError):
        service.summary(None, start_date=date(2026, 10, 2), end_date=date(2026, 10, 1))


def test_swagger_exposes_sprint_three_read_endpoints() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/attendance/summary" in paths
    assert "/attendance/timeline" in paths
    assert "/attendance/alerts" in paths
    assert "/students/{student_id}/attendance/monthly" in paths
    assert "/classes/{class_id}/attendance/summary" in paths
