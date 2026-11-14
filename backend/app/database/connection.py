from collections.abc import Generator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def build_database_url() -> URL:
    """Monta a URL sem interpolar manualmente a senha na string."""

    settings = get_settings()
    return URL.create(
        drivername="mysql+pymysql",
        username=settings.database_user,
        password=settings.database_password.get_secret_value(),
        host=settings.database_host,
        port=settings.database_port,
        database=settings.database_name,
    )


engine = create_engine(
    build_database_url(),
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """Abre uma sessão por requisição e garante seu fechamento."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
