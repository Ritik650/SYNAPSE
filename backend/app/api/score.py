"""Health score computation endpoint."""
from datetime import datetime, timezone, timedelta, date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.health_metric import HealthMetric
from ..models.intelligence import HealthScoreSnapshot

router = APIRouter(tags=["score"])

# Score weights
_WEIGHTS = {
    "sleep":    0.25,
    "recovery": 0.25,
    "activity": 0.20,
    "mind":     0.15,
    "nutrition":0.10,
    "stress":   0.05,
}


def _latest(db: Session, user_id: str, metric_type: str, since: datetime) -> float | None:
    row = (
        db.query(HealthMetric.value)
        .filter(
            HealthMetric.user_id == user_id,
            HealthMetric.metric_type == metric_type,
            HealthMetric.ts >= since,
        )
        .order_by(HealthMetric.ts.desc())
        .first()
    )
    return row[0] if row else None


def _mean(db: Session, user_id: str, metric_type: str, since: datetime) -> float | None:
    row = (
        db.query(func.avg(HealthMetric.value))
        .filter(
            HealthMetric.user_id == user_id,
            HealthMetric.metric_type == metric_type,
            HealthMetric.ts >= since,
        )
        .first()
    )
    return row[0] if row and row[0] is not None else None


def compute_score(db: Session, user_id: str) -> dict:
    now   = datetime.now(timezone.utc)
    d1    = now - timedelta(days=1)
    d7    = now - timedelta(days=7)
    d30   = now - timedelta(days=30)

    # ── Sleep score ────────────────────────────────────────────────────────
    sleep_dur  = _latest(db, user_id, "sleep_duration_min", d1) or _mean(db, user_id, "sleep_duration_min", d7)
    sleep_eff  = _latest(db, user_id, "sleep_efficiency",   d1) or _mean(db, user_id, "sleep_efficiency",   d7)
    sleep_score = 0.0
    if sleep_dur:
        dur_score = min(100, (sleep_dur / 480) * 100)  # 8h = 100
        eff_score = float(sleep_eff or 75)
        sleep_score = dur_score * 0.6 + eff_score * 0.4

    # ── Recovery score (HRV & RHR vs 30d baseline) ─────────────────────────
    rhr_now    = _latest(db, user_id, "rhr",       d1)
    hrv_now    = _latest(db, user_id, "hrv_rmssd", d1)
    rhr_base   = _mean(db, user_id, "rhr",       d30)
    hrv_base   = _mean(db, user_id, "hrv_rmssd", d30)
    recovery_score = 70.0  # default
    if rhr_now and rhr_base and hrv_now and hrv_base:
        rhr_delta = (rhr_base - rhr_now) / max(rhr_base, 1) * 100   # +ve = improved
        hrv_delta = (hrv_now - hrv_base) / max(hrv_base, 1) * 100   # +ve = improved
        recovery_score = float(min(100, max(10, 70 + rhr_delta * 1.5 + hrv_delta * 1.5)))

    # ── Activity score ─────────────────────────────────────────────────────
    steps = _latest(db, user_id, "steps", d1) or _mean(db, user_id, "steps", d7) or 0
    activity_score = float(min(100, (steps / 10000) * 100))

    # ── Mind score (mood / stress) ─────────────────────────────────────────
    mood   = _latest(db, user_id, "mood_self",   d1) or _mean(db, user_id, "mood_self",   d7) or 5
    stress = _latest(db, user_id, "stress_self", d1) or _mean(db, user_id, "stress_self", d7) or 5
    mind_score = float(min(100, (mood / 10 * 60) + ((10 - stress) / 10 * 40)))

    # ── Nutrition score (placeholder — improves when meals logged) ─────────
    nutrition_score = 60.0

    # ── Stress component ──────────────────────────────────────────────────
    stress_score = float(min(100, (10 - (stress or 5)) / 10 * 100))

    # ── Overall ───────────────────────────────────────────────────────────
    overall = (
        sleep_score    * _WEIGHTS["sleep"] +
        recovery_score * _WEIGHTS["recovery"] +
        activity_score * _WEIGHTS["activity"] +
        mind_score     * _WEIGHTS["mind"] +
        nutrition_score* _WEIGHTS["nutrition"] +
        stress_score   * _WEIGHTS["stress"]
    )

    return {
        "date":           date.today().isoformat(),
        "overall":        round(overall, 1),
        "sleep_score":    round(sleep_score, 1),
        "recovery_score": round(recovery_score, 1),
        "activity_score": round(activity_score, 1),
        "mind_score":     round(mind_score, 1),
        "nutrition_score":round(nutrition_score, 1),
        "stress_score":   round(stress_score, 1),
        "readiness":      round((recovery_score * 0.6 + sleep_score * 0.4), 1),
        "narrative":      None,
    }


@router.get("/score/today")
def score_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_score(db, current_user.id)


@router.get("/score/history")
def score_history(
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(HealthScoreSnapshot)
        .filter(HealthScoreSnapshot.user_id == current_user.id)
        .order_by(HealthScoreSnapshot.date.desc())
        .limit(days)
        .all()
    )
    return [
        {
            "date":           r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date),
            "overall":        r.overall,
            "sleep_score":    r.sleep_score,
            "recovery_score": r.recovery_score,
            "activity_score": r.activity_score,
            "mind_score":     r.mind_score,
            "nutrition_score":r.nutrition_score,
            "stress_score":   r.stress_score,
            "readiness":      r.readiness,
        }
        for r in rows
    ]
