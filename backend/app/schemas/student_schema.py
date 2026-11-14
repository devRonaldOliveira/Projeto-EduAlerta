from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StudentResponse(BaseModel):
    """Representação pública de um estudante."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    enrollment_code: str
    class_id: int | None
    birth_date: date | None
    guardian_name: str | None
    guardian_contact: str | None
    is_active: bool
    created_at: datetime


class StudentCreate(BaseModel):
    """Dados necessários para cadastrar um estudante."""

    name: str = Field(min_length=1, max_length=150)
    enrollment_code: str = Field(min_length=1, max_length=50)
    class_id: int | None = None
    birth_date: date | None = None
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_contact: str | None = Field(default=None, max_length=50)
    is_active: bool = True


class StudentUpdate(BaseModel):
    """Campos cadastrais permitidos na atualização de um estudante."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=150)
    enrollment_code: str | None = Field(default=None, min_length=1, max_length=50)
    birth_date: date | None = None
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_contact: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def ensure_at_least_one_field(self) -> "StudentUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class StudentListResponse(BaseModel):
    """Resposta paginada da listagem de estudantes."""

    items: list[StudentResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
