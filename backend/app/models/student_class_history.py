from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class StudentClassHistory(Base):
    __tablename__ = "student_class_history"
    __table_args__ = (
        Index("idx_history_class", "class_id"),
        Index("idx_history_student", "student_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "students.id",
            name="fk_history_student",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    class_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "classes.id",
            name="fk_history_class",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
