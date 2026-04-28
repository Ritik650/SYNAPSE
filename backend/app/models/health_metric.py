import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base


def utcnow():
    return datetime.now(timezone.utc)


METRIC_TYPES = [
    "hr", "hrv_rmssd", "rhr", "resp_rate", "spo2", "temp_skin",
    "bp_sys", "bp_dia", "glucose", "weight", "body_fat_pct",
    "sleep_duration_min", "sleep_efficiency", "deep_sleep_min", "rem_sleep_min",
    "light_sleep_min", "awake_min", "sleep_score",
    "steps", "active_minutes", "vo2max", "calories_active", "calories_resting",
    "screen_time_min", "mood_self", "stress_self", "energy_self", "pain_self",
    "aqi", "weather_temp", "pollen",
]

METRIC_SOURCES = [
    "apple_health", "fitbit", "google_fit", "garmin", "oura",
    "manual", "voice", "derived", "lab",
]


class HealthMetric(Base):
    __tablename__ = "health_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="metrics")  # noqa: F821

    __table_args__ = (
        Index("ix_health_metrics_user_ts_type", "user_id", "ts", "metric_type"),
    )
