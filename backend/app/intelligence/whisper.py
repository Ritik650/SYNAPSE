"""Whisper Generator — predictive early warnings via Claude."""
import json
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from .client import call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric
from ..models.intelligence import Whisper
from ..ml.anomaly import get_anomaly_context


def _gather_signals(db: Session, user_id: str) -> dict:
    now = datetime.now(timezone.utc)
    d1  = now - timedelta(days=1)
    d7  = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    def last(mtype):
        r = (db.query(HealthMetric.value)
               .filter(HealthMetric.user_id == user_id,
                       HealthMetric.metric_type == mtype,
                       HealthMetric.ts >= d1)
               .order_by(HealthMetric.ts.desc()).first())
        return round(r[0], 2) if r else None

    def avg(mtype, since):
        r = (db.query(func.avg(HealthMetric.value))
               .filter(HealthMetric.user_id == user_id,
                       HealthMetric.metric_type == mtype,
                       HealthMetric.ts >= since)
               .first())
        return round(r[0], 2) if r and r[0] else None

    def std(mtype, since):
        rows = (db.query(HealthMetric.value)
                  .filter(HealthMetric.user_id == user_id,
                          HealthMetric.metric_type == mtype,
                          HealthMetric.ts >= since)
                  .all())
        if not rows or len(rows) < 3:
            return None
        vals = [r[0] for r in rows]
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals)
        return round(variance ** 0.5, 2)

    signals = {}
    for mt in ["hrv_rmssd", "rhr", "sleep_duration_min", "sleep_efficiency",
               "mood_self", "stress_self", "steps", "screen_time_min"]:
        now_val  = last(mt)
        base_val = avg(mt, d30)
        sd_val   = std(mt, d30)
        z = None
        if now_val is not None and base_val is not None and sd_val and sd_val > 0:
            z = round((now_val - base_val) / sd_val, 2)
        signals[mt] = {
            "now":      now_val,
            "baseline": base_val,
            "z":        z,
        }

    # 7-day trend for key metrics
    trend_7d = {}
    for mt in ["hrv_rmssd", "rhr", "sleep_duration_min"]:
        v7  = avg(mt, d7)
        v30 = avg(mt, d30)
        if v7 and v30:
            trend_7d[mt] = round((v7 - v30) / max(abs(v30), 0.1) * 100, 1)

    return {"signals": signals, "trend_7d": trend_7d}


def generate_whisper(db: Session, user_id: str) -> dict | None:
    sigs = _gather_signals(db, user_id)

    # Only run if we have meaningful data
    has_data = any(
        v["now"] is not None for v in sigs["signals"].values()
    )
    if not has_data:
        return None

    anomaly = get_anomaly_context(db, user_id)
    anomaly_note = ""
    if anomaly.get("available") and anomaly["max_anomaly_score"] > 0.65:
        anomaly_note = (
            f"\n\nML anomaly detection: most anomalous day = {anomaly['most_anomalous_date']} "
            f"(score={anomaly['max_anomaly_score']:.3f}). Recent 7-day scores: {anomaly['scores']}"
        )

    system = (
        "You are a vigilant clinician running an early-warning algorithm. "
        "Analyze the patient's current metrics vs their 30-day baseline. "
        "Return either null (no concern today) or a JSON whisper object. "
        "Be conservative — only flag genuine deviations (|z| > 1.5 on multiple metrics). "
        "Never diagnose. Always suggest actions, not diagnoses."
    )

    user_msg = (
        f"Metric signals (now vs 30d baseline, z-scores):\n"
        f"{json.dumps(sigs['signals'], indent=2)}\n\n"
        f"7-day trend vs 30d baseline (% change):\n"
        f"{json.dumps(sigs['trend_7d'], indent=2)}"
        f"{anomaly_note}\n\n"
        "If no significant deviation exists, return: null\n"
        "If deviation warrants attention, return JSON:\n"
        '{"severity": "info|watch|act|urgent", "title": "...", "narrative": "...", '
        '"evidence": [{"metric": "...", "observed": 0, "baseline": 0, "z": 0}], '
        '"confidence": 0.0, "recommended_actions": ["..."], "expires_in_hours": 24}\n\n'
        f"{SAFETY_FOOTER}"
    )

    try:
        result = call_claude_json(system, user_msg, max_tokens=1024)
    except Exception:
        return None

    if result is None or not isinstance(result, dict):
        return None

    # Persist the whisper
    now = datetime.now(timezone.utc)
    whisper = Whisper(
        id=str(uuid.uuid4()),
        user_id=user_id,
        generated_at=now,
        severity=result.get("severity", "info"),
        title=result.get("title", "Health signal detected"),
        narrative=result.get("narrative", ""),
        evidence_json=json.dumps(result.get("evidence", [])),
        confidence=float(result.get("confidence", 0.5)),
        expires_at=now + timedelta(hours=result.get("expires_in_hours", 24)),
        is_active=True,
    )
    db.add(whisper)
    db.commit()
    db.refresh(whisper)

    return {
        "id":                whisper.id,
        "severity":          whisper.severity,
        "title":             whisper.title,
        "narrative":         whisper.narrative,
        "evidence":          result.get("evidence", []),
        "confidence":        whisper.confidence,
        "recommended_actions": result.get("recommended_actions", []),
        "expires_at":        whisper.expires_at.isoformat(),
        "generated_at":      whisper.generated_at.isoformat(),
        "is_active":         True,
        "helpful":           None,
    }
