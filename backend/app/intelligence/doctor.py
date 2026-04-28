"""Doctor Prep Report — clinical brief + top-5 questions via Claude."""
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from .client import call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric
from ..models.records import Medication, Symptom, LabResult, LabValue
from ..models.intelligence import Pattern
from ..models.user import User


def _gather_health_summary(db: Session, user_id: str) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=30)
    summary = {}
    for mt in ["rhr", "hrv_rmssd", "sleep_duration_min", "sleep_efficiency",
               "steps", "mood_self", "stress_self", "weight_kg"]:
        r = (db.query(func.avg(HealthMetric.value))
               .filter(HealthMetric.user_id == user_id,
                       HealthMetric.metric_type == mt,
                       HealthMetric.ts >= since)
               .first())
        if r and r[0]:
            summary[mt] = round(r[0], 2)
    return summary


def _gather_lab_flags(db: Session, user_id: str) -> list[dict]:
    labs = (db.query(LabResult).filter(LabResult.user_id == user_id)
             .order_by(LabResult.drawn_at.desc()).limit(5).all())
    flags = []
    for lab in labs:
        flagged = [v for v in lab.values if v.flag in ("high", "low", "critical")]
        for v in flagged:
            flags.append({
                "panel": lab.panel_name,
                "drawn": lab.drawn_at.date().isoformat() if hasattr(lab.drawn_at, "date") else str(lab.drawn_at)[:10],
                "marker": v.marker,
                "value": v.value,
                "unit": v.unit,
                "flag": v.flag,
                "ref": f"{v.ref_low}–{v.ref_high}" if v.ref_low and v.ref_high else None,
            })
    return flags


def _active_symptoms(db: Session, user_id: str) -> list[dict]:
    rows = (db.query(Symptom)
             .filter(Symptom.user_id == user_id, Symptom.resolved_at == None)
             .order_by(Symptom.started_at.desc()).limit(10).all())
    return [{"name": r.name, "severity": r.severity,
             "since": r.started_at.date().isoformat() if hasattr(r.started_at, "date") else str(r.started_at)[:10]}
            for r in rows]


def _active_medications(db: Session, user_id: str) -> list[dict]:
    rows = (db.query(Medication)
             .filter(Medication.user_id == user_id)
             .order_by(Medication.created_at.desc()).limit(10).all())
    return [{"name": r.name, "dose": f"{r.dose}{r.unit}" if r.dose else None,
             "frequency": r.frequency, "prescribed_by": r.prescribed_by}
            for r in rows]


def _active_patterns(db: Session, user_id: str) -> list[str]:
    rows = (db.query(Pattern)
             .filter(Pattern.user_id == user_id, Pattern.status == "active")
             .order_by(Pattern.confidence.desc()).limit(5).all())
    return [f"{r.title} (confidence {int(r.confidence*100)}%)" for r in rows]


def generate_doctor_prep(
    visit_reason: str,
    visit_date: str,
    db: Session,
    user_id: str,
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    name = user.name if user else "Patient"

    summary   = _gather_health_summary(db, user_id)
    lab_flags = _gather_lab_flags(db, user_id)
    symptoms  = _active_symptoms(db, user_id)
    meds      = _active_medications(db, user_id)
    patterns  = _active_patterns(db, user_id)

    system = (
        "You are a medical scribe. Generate a concise clinical brief for a physician. "
        "Return ONLY valid JSON. Never diagnose. Flag items requiring clinical attention."
    )

    user_msg = (
        f"Patient: {name}\n"
        f"Visit reason: {visit_reason}\n"
        f"Visit date: {visit_date}\n\n"
        f"30-day health averages:\n{json.dumps(summary, indent=2)}\n\n"
        f"Flagged lab values:\n{json.dumps(lab_flags, indent=2)}\n\n"
        f"Active symptoms (unresolved):\n{json.dumps(symptoms, indent=2)}\n\n"
        f"Current medications:\n{json.dumps(meds, indent=2)}\n\n"
        f"Discovered health patterns:\n{json.dumps(patterns, indent=2)}\n\n"
        "Return JSON:\n"
        '{"executive_summary": "...", '
        '"key_metrics": {"RHR": "...", "HRV": "...", "Sleep": "...", "Steps": "...", "Mood": "..."}, '
        '"flagged_labs": [{"marker": "...", "value": "...", "interpretation": "..."}], '
        '"active_concerns": ["..."], '
        '"medication_review": ["..."], '
        '"top_5_questions": ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"], '
        '"suggested_tests": ["..."]}\n\n'
        f"{SAFETY_FOOTER}"
    )

    try:
        result = call_claude_json(system, user_msg, max_tokens=2048)
    except Exception as e:
        result = {
            "executive_summary": f"Report generation failed: {e}",
            "key_metrics": summary,
            "flagged_labs": lab_flags,
            "active_concerns": [s["name"] for s in symptoms],
            "medication_review": [m["name"] for m in meds],
            "top_5_questions": [
                "What do my recent lab results mean?",
                "Are my medications appropriate?",
                "How concerned should I be about my patterns?",
                "What lifestyle changes are most impactful?",
                "When should I follow up?",
            ],
            "suggested_tests": [],
        }

    # Attach raw context for PDF generation
    result["_meta"] = {
        "patient_name": name,
        "visit_reason": visit_reason,
        "visit_date": visit_date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "raw_summary": summary,
        "lab_flags": lab_flags,
        "symptoms": symptoms,
        "medications": meds,
    }
    return result
