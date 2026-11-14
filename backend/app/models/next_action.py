from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class NextActionStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class NextAction(Base):
    __tablename__ = "next_actions"
    __table_args__ = (
        Index("idx_next_action_case", "follow_up_case_id"),
        Index("idx_next_action_due_date", "due_date"),
        Index("idx_next_action_responsible", "responsible_user_id"),
        Index("idx_next_action_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follow_up_case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "follow_up_cases.id",
            name="fk_next_action_case",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    responsible_user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey(
            "users.id",
            name="fk_next_action_responsible",
            onupdate="CASCADE",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[NextActionStatus] = mapped_column(
        Enum(NextActionStatus, native_enum=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
