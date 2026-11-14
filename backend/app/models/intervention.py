from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Intervention(Base):
    __tablename__ = "interventions"
    __table_args__ = (
        Index("idx_intervention_case", "follow_up_case_id"),
        Index("idx_intervention_date", "performed_at"),
        Index("idx_intervention_responsible", "responsible_user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follow_up_case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "follow_up_cases.id",
            name="fk_intervention_case",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    responsible_user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "users.id",
            name="fk_intervention_responsible",
            onupdate="CASCADE",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    performed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
