"""Seed the database with synthetic demo data for Aarav Shah."""

import uuid
from datetime import datetime, timezone, date, timedelta
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import hash_password
from ..models.user import User
from ..models.health_metric import HealthMetric
from ..models.event import Event
from ..models.records import (
    Medication, MedicationDose, Symptom, LabResult, LabValue, Meal, VoiceNote
)
from ..models.intelligence import HealthScoreSnapshot
from .synthetic import generate_all, DEMO_EMAIL, BASE_DATE, N_DAYS, _build_state, SEED

import numpy as np

settings = get_settings()


def _purge_demo_user_data(db: Session, user_id: str) -> None:
    """Delete all health data for the demo user (idempotent)."""
    db.query(MedicationDose).filter(
        MedicationDose.medication_id.in_(
            db.query(Medication.id).filter(Medication.user_id == user_id)
        )
    ).delete(synchronize_session=False)
    db.query(LabValue).filter(
        LabValue.lab_result_id.in_(
            db.query(LabResult.id).filter(LabResult.user_id == user_id)
        )
    ).delete(synchronize_session=False)
    for model in [HealthMetric, Event, Medication, Symptom, LabResult, Meal, VoiceNote,
                  HealthScoreSnapshot]:
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
    db.commit()


def _compute_day_score(state: dict) -> dict:
    """Compute health score for a single synthetic day from its state dict."""
    sleep_min  = state["sleep_min"]
    sleep_eff  = state["sleep_eff"]
    hrv        = state["hrv"]
    rhr        = state["rhr"]
    steps      = state["steps"]
    mood       = state["mood"]
    stress     = state["stress"]
    ill        = state["ill"]
    migraine   = state["migraine"]

    ill_penalty = 0.75 if (ill or migraine) else 1.0

    dur_score  = min(100.0, (sleep_min / 480) * 100)
    eff_score  = float(sleep_eff)
    sleep_score = (dur_score * 0.6 + eff_score * 0.4) * ill_penalty

    hrv_score  = min(100.0, (hrv / 60) * 100)
    rhr_score  = min(100.0, (58 / max(rhr, 1)) * 100)
    recovery_score = (hrv_score * 0.5 + rhr_score * 0.5) * ill_penalty

    activity_score = float(min(100.0, (steps / 10000) * 100))

    mind_score = float(min(100.0, (mood / 10 * 60) + ((10 - stress) / 10 * 40)))
    stress_score = float(min(100.0, (10 - stress) / 10 * 100))
    nutrition_score = 60.0  # static, no per-day calorie data

    overall = (
        sleep_score     * 0.25 +
        recovery_score  * 0.25 +
        activity_score  * 0.20 +
        mind_score      * 0.15 +
        nutrition_score * 0.10 +
        stress_score    * 0.05
    )

    return {
        "overall":        round(overall, 1),
        "sleep_score":    round(sleep_score, 1),
        "recovery_score": round(recovery_score, 1),
        "activity_score": round(activity_score, 1),
        "mind_score":     round(mind_score, 1),
        "nutrition_score":round(nutrition_score, 1),
        "stress_score":   round(stress_score, 1),
        "readiness":      round(recovery_score * 0.6 + sleep_score * 0.4, 1),
    }


def _generate_score_snapshots(user_id: str) -> list[dict]:
    """Generate 120-day HealthScoreSnapshot records from synthetic state data."""
    rng = np.random.default_rng(SEED)
    snapshots = []
    for day in range(N_DAYS):
        state = _build_state(day, rng)
        scores = _compute_day_score(state)
        snap_date = (BASE_DATE + timedelta(days=day)).date()
        snapshots.append({
            "id":              str(uuid.uuid4()),
            "user_id":         user_id,
            "date":            snap_date,
            "overall":         scores["overall"],
            "sleep_score":     scores["sleep_score"],
            "recovery_score":  scores["recovery_score"],
            "activity_score":  scores["activity_score"],
            "mind_score":      scores["mind_score"],
            "nutrition_score": scores["nutrition_score"],
            "stress_score":    scores["stress_score"],
            "readiness":       scores["readiness"],
        })
    return snapshots


def seed_demo(db: Session) -> dict:
    """
    Idempotently seed 120 days of demo data for Aarav Shah.
    Returns stats about what was inserted.
    """
    # Find or create demo user
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=DEMO_EMAIL,
            hashed_password=hash_password(settings.demo_user_password),
            name="Aarav Shah",
            sex="M",
            height_cm=174.0,
            weight_kg=68.5,
            timezone="Asia/Kolkata",
            locale="en",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Clear existing data
    _purge_demo_user_data(db, user.id)

    # Generate
    data = generate_all(user.id)

    # Bulk insert — using add_all for simplicity with SQLite
    BATCH = 500

    def _parse_dt(v):
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return v
        return v

    _DT_FIELDS = {"ts", "scheduled_at", "taken_at", "started_at", "resolved_at",
                  "drawn_at", "generated_at", "last_completed_at", "expires_at",
                  "interactions_checked_at"}
    _DATE_FIELDS = {"start_date", "end_date", "dob"}

    def _coerce(row: dict) -> dict:
        out = {}
        for k, v in row.items():
            if k in _DT_FIELDS:
                out[k] = _parse_dt(v)
            elif k in _DATE_FIELDS and isinstance(v, str):
                try:
                    out[k] = date.fromisoformat(v)
                except ValueError:
                    out[k] = v
            else:
                out[k] = v
        return out

    def _bulk(model_cls, rows):
        for i in range(0, len(rows), BATCH):
            objs = [model_cls(**_coerce(r)) for r in rows[i:i+BATCH]]
            db.add_all(objs)
            db.flush()

    _bulk(HealthMetric,    data["metrics"])
    _bulk(Event,           data["events"])
    _bulk(Medication,      data["medications"])
    _bulk(MedicationDose,  data["medication_doses"])
    _bulk(Symptom,         data["symptoms"])
    _bulk(LabResult,       data["lab_results"])
    _bulk(LabValue,        data["lab_values"])
    _bulk(Meal,            data["meals"])
    _bulk(VoiceNote,       data["voice_notes"])

    # Score snapshots — computed directly from synthetic state (no DB queries needed)
    score_rows = _generate_score_snapshots(user.id)
    db.add_all([HealthScoreSnapshot(**r) for r in score_rows])

    db.commit()

    return {
        "user_id":        user.id,
        "metrics":        len(data["metrics"]),
        "events":         len(data["events"]),
        "medications":    len(data["medications"]),
        "doses":          len(data["medication_doses"]),
        "symptoms":       len(data["symptoms"]),
        "lab_results":    len(data["lab_results"]),
        "lab_values":     len(data["lab_values"]),
        "meals":          len(data["meals"]),
        "voice_notes":    len(data["voice_notes"]),
        "score_snapshots":len(score_rows),
    }
