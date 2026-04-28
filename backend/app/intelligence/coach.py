"""Health Score narrator and Body Twin state generator."""
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from .client import call_claude, SAFETY_FOOTER
from ..models.health_metric import HealthMetric


def _metric_avg(db: Session, user_id: str, mtype: str, days: int = 7) -> float | None:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    r = (db.query(func.avg(HealthMetric.value))
           .filter(HealthMetric.user_id == user_id,
                   HealthMetric.metric_type == mtype,
                   HealthMetric.ts >= since)
           .first())
    return round(r[0], 2) if r and r[0] else None


def _score_to_100(value: float | None, optimal: float, direction: str = "higher") -> float:
    if value is None:
        return 50.0
    if direction == "higher":
        return float(min(100, max(10, (value / optimal) * 100)))
    else:  # lower is better
        return float(min(100, max(10, (optimal / max(value, 1)) * 100)))


def body_twin_state(db: Session, user_id: str) -> dict:
    rhr     = _metric_avg(db, user_id, "rhr",            7)
    hrv     = _metric_avg(db, user_id, "hrv_rmssd",      7)
    sleep_h = (_metric_avg(db, user_id, "sleep_duration_min", 7) or 0) / 60
    sleep_e = _metric_avg(db, user_id, "sleep_efficiency", 7)
    glucose = _metric_avg(db, user_id, "glucose",         7)
    mood    = _metric_avg(db, user_id, "mood_self",       7)
    stress  = _metric_avg(db, user_id, "stress_self",     7)
    steps   = _metric_avg(db, user_id, "steps",           7)
    spo2    = _metric_avg(db, user_id, "spo2",            7)
    resp    = _metric_avg(db, user_id, "resp_rate",       7)

    # System scores (0–100, 100 = optimal)
    cardio_score = (
        _score_to_100(hrv,  60,  "higher") * 0.5 +
        _score_to_100(rhr,  58,  "lower")  * 0.5
    )
    sleep_score = (
        _score_to_100(sleep_h, 8.0, "higher") * 0.6 +
        _score_to_100(sleep_e, 85,  "higher") * 0.4
    )
    metabolic_score = _score_to_100(glucose or 90, 90, "lower") if glucose else 70.0
    mental_score = (
        _score_to_100(mood,   8.0, "higher") * 0.6 +
        _score_to_100(stress, 2.0, "lower")  * 0.4
    )
    musculo_score = _score_to_100(steps or 5000, 10000, "higher")
    immune_score  = 70.0  # baseline without lab data

    systems = {
        "cardio":          {"score": round(cardio_score,  1), "label": "Cardiovascular",
                            "metrics": {"rhr": rhr, "hrv": hrv}},
        "sleep":           {"score": round(sleep_score,   1), "label": "Sleep & Recovery",
                            "metrics": {"sleep_h": round(sleep_h, 1), "sleep_efficiency": sleep_e}},
        "metabolic":       {"score": round(metabolic_score,1),"label": "Metabolic",
                            "metrics": {"glucose": glucose}},
        "mental":          {"score": round(mental_score,  1), "label": "Mind & Stress",
                            "metrics": {"mood": mood, "stress": stress}},
        "musculoskeletal": {"score": round(musculo_score, 1), "label": "Activity",
                            "metrics": {"steps": steps}},
        "immune":          {"score": round(immune_score,  1), "label": "Immune",
                            "metrics": {"spo2": spo2}},
    }

    # Claude one-liners per system
    snapshot = json.dumps({k: {"score": v["score"], **v["metrics"]} for k, v in systems.items()})
    system_prompt = (
        "You are a health coach. For each body system, write exactly one warm, specific, 10-15 word sentence. "
        "Return ONLY valid JSON: {system_name: one_liner_string}."
    )
    try:
        one_liners = call_claude(
            system_prompt,
            f"System scores and metrics:\n{snapshot}\nReturn one-liner for each system.",
            max_tokens=400,
            expect_json=True,
        )
        import re, json as _json
        one_liners = re.sub(r"^```(?:json)?\s*", "", one_liners.strip(), flags=re.MULTILINE)
        one_liners = re.sub(r"\s*```$", "", one_liners.strip(), flags=re.MULTILINE)
        one_liners_dict = _json.loads(one_liners)
    except Exception:
        one_liners_dict = {}

    for k in systems:
        systems[k]["one_liner"] = one_liners_dict.get(k, "Looking good overall.")

    return {"systems": systems}
