from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClassResponse(BaseModel):
    """Representação pública de uma turma existente."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    active: bool


class ClassCreate(BaseModel):
    """Dados necessários para cadastrar uma turma."""

    name: str = Field(min_length=1, max_length=50)
    active: bool = True


class ClassUpdate(BaseModel):
    """Campos permitidos na atualização parcial de uma turma."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    active: bool | None = None

    @model_validator(mode="after")
    def ensure_at_least_one_field(self) -> "ClassUpdate":
        if self.name is None and self.active is None:
            raise ValueError("At least one field must be provided")
        return self
