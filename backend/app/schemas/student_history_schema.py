from datetime import date

from pydantic import BaseModel, ConfigDict


class StudentClassHistoryResponse(BaseModel):
    """Representação de um vínculo entre estudante e turma."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    class_id: int
    start_date: date
    end_date: date | None


class StudentTransferCreate(BaseModel):
    """Dados necessários para transferir um estudante."""

    class_id: int
    transfer_date: date
