from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração da aplicação e do banco existente."""

    app_name: str = "EduAlerta API"
    app_env: str = "development"
    database_host: str
    database_port: int = 3306
    database_name: str
    database_user: str
    database_password: SecretStr

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Retorna uma instância reutilizável das configurações."""

    return Settings()
