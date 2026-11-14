from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("enrollment_code", name="uq_students_enrollment_code"),
        Index("fk_students_class", "class_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    enrollment_code: Mapped[str] = mapped_column(String(50), nullable=False)
    class_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "classes.id",
            name="fk_students_class",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    guardian_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    guardian_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
