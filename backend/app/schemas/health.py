from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Resposta de uma API e banco disponíveis."""

    status: str
    database: str
