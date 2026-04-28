"""Symptom Triage — structured clinical response with safety escalation."""
from datetime import datetime, timezone, timedelta
import json
from sqlalchemy.orm import Session

from .client import call_claude, call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric

RED_FLAG_KEYWORDS = [
    "chest pain", "shortness of breath", "can't breathe", "confusion",
    "suicidal", "suicide", "anaphylaxis", "severe bleeding", "unconscious",
    "stroke", "numbness face", "sudden vision", "severe abdominal",
]

EMERGENCY_RESPONSE = {
    "severity": "urgent",
    "red_flag_detected": True,
    "message": (
        "One or more symptoms you described may require immediate emergency care. "
        "Please call emergency services or go to the nearest emergency room immediately."
    ),
    "emergency_contacts": {
        "India Emergency": "112",
        "iCall Mental Health": "9152987821",
        "Vandrevala Foundation": "1860-2662-345",
    },
    "disclaimer": (
        "Synapse is not a medical device and cannot assess medical emergencies. "
        "This is an automatic safety response. Please seek emergency care now."
    ),
}


def triage_symptoms(symptoms_text: str, db: Session, user_id: str) -> dict:
    # Safety check — red flag escalation bypasses all other logic
    lowered = symptoms_text.lower()
    if any(kw in lowered for kw in RED_FLAG_KEYWORDS):
        return EMERGENCY_RESPONSE

    # Gather recent context
    since = datetime.now(timezone.utc) - timedelta(days=7)
    recent = {}
    for mt in ["rhr", "hrv_rmssd", "sleep_duration_min", "mood_self", "stress_self"]:
        from sqlalchemy import func
        r = (db.query(func.avg(HealthMetric.value))
               .filter(HealthMetric.user_id == user_id,
                       HealthMetric.metric_type == mt,
                       HealthMetric.ts >= since)
               .first())
        if r and r[0]:
            recent[mt] = round(r[0], 2)

    system = (
        "You are a triage clinician. You are NOT diagnosing. "
        "Return ONLY valid JSON. Always end with a disclaimer. "
        "If any red-flag symptoms appear (chest pain, severe breathing difficulty, confusion, "
        "suicidal ideation, anaphylaxis, severe bleeding), return only an emergency escalation."
    )

    user_msg = (
        f"Symptoms described: {symptoms_text}\n\n"
        f"Recent 7-day context:\n{json.dumps(recent, indent=2)}\n\n"
        "Return JSON:\n"
        '{"likely_categories": [{"category": "...", "notes": "..."}], '
        '"red_flags_to_watch": ["..."], '
        '"when_to_seek_care": "...", '
        '"monitor_at_home": ["..."], '
        '"bring_to_doctor": ["..."], '
        '"disclaimer": "..."}\n\n'
        f"{SAFETY_FOOTER}"
    )

    try:
        result = call_claude_json(system, user_msg, max_tokens=1024)
        result["red_flag_detected"] = False
        return result
    except Exception as e:
        return {
            "red_flag_detected": False,
            "likely_categories": [],
            "red_flags_to_watch": ["Seek care if symptoms worsen"],
            "when_to_seek_care": "If symptoms worsen or persist beyond 48 hours.",
            "monitor_at_home": ["Rest", "Hydrate", "Monitor temperature"],
            "bring_to_doctor": ["Duration", "Severity progression"],
            "disclaimer": SAFETY_FOOTER.strip(),
            "error": str(e),
        }
