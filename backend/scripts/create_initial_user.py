"""Cria manualmente um usuário inicial com senha protegida por Argon2id.

Execute a partir da pasta ``backend`` após configurar o arquivo ``.env``.
O script solicita os dados no terminal e nunca recebe a senha pela linha de comando.
"""

from datetime import datetime
from getpass import getpass

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.connection import SessionLocal
from app.models.user import User


def required_input(label: str) -> str:
    """Lê um valor obrigatório sem assumir padrões de negócio."""

    value = input(f"{label}: ").strip()
    if not value:
        raise ValueError(f"{label} is required")
    return value


def read_password() -> str:
    """Lê a senha duas vezes sem exibi-la no terminal."""

    password = getpass("Senha: ")
    confirmation = getpass("Confirme a senha: ")
    if not password:
        raise ValueError("Password is required")
    if password != confirmation:
        raise ValueError("Passwords do not match")
    return password


def main() -> None:
    """Persiste um usuário ativo após confirmação explícita do operador."""

    try:
        name = required_input("Nome")
        email = required_input("E-mail").lower()
        role = required_input("Função")
        password = read_password()
    except ValueError as exc:
        print(f"Operação cancelada: {exc}")
        return

    confirmation = input(
        f"Criar usuário ativo '{email}' com a função '{role}'? Digite CRIAR para confirmar: "
    ).strip()
    if confirmation.casefold() != "criar":
        print("Operação cancelada.")
        return

    session = SessionLocal()
    try:
        existing_user = session.scalar(select(User).where(User.email == email))
        if existing_user is not None:
            print("Operação cancelada: já existe um usuário com esse e-mail.")
            return

        user = User(
            name=name,
            email=email,
            password_hash=PasswordHasher().hash(password),
            role=role,
            is_active=True,
            created_at=datetime.now(),
        )
        session.add(user)
        session.commit()
        print(f"Usuário criado com sucesso. ID: {user.id}")
    except IntegrityError:
        session.rollback()
        print("Operação cancelada: não foi possível criar o usuário.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
