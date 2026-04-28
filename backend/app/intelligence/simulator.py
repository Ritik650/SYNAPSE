"""What-If Simulator — project effects of health interventions using Claude."""
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from .client import call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric


def run_simulation(interventions: dict, duration_days: int, db: Session, user_id: str) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=30)

    baselines = {}
    for mt in ["rhr", "hrv_rmssd", "sleep_duration_min", "sleep_efficiency",
               "mood_self", "steps", "energy_self", "stress_self"]:
        r = (db.query(func.avg(HealthMetric.value))
               .filter(HealthMetric.user_id == user_id,
                       HealthMetric.metric_type == mt,
                       HealthMetric.ts >= since)
               .first())
        if r and r[0]:
            baselines[mt] = round(r[0], 2)

    intervention_lines = []
    LABELS = {
        "extra_sleep_hours": "Additional sleep per night",
        "daily_steps_increase": "Daily step count increase",
        "screen_time_reduction_hours": "Screen time reduction per day",
        "meditation_minutes": "Daily meditation",
        "alcohol_units_reduction": "Weekly alcohol reduction",
    }
    for key, val in interventions.items():
        if val > 0:
            label = LABELS.get(key, key.replace("_", " ").title())
            unit = "hours" if "hours" in key else ("k steps" if "steps" in key else ("minutes" if "minutes" in key else "units"))
            intervention_lines.append(f"- {label}: +{val} {unit}")

    if not intervention_lines:
        return {
            "summary": "No interventions selected. Adjust at least one slider and run again.",
            "projected_changes": [],
            "timeline": "",
            "caveats": [],
            "disclaimer": SAFETY_FOOTER,
        }

    interventions_text = "\n".join(intervention_lines)

    system = (
        "You are a health systems modeler. Given current baselines and proposed lifestyle interventions, "
        "project realistic physiological changes over the specified window. Be specific and evidence-based. "
        "Return ONLY valid JSON with no markdown."
    )

    user_msg = (
        f"Proposed interventions over {duration_days} days:\n{interventions_text}\n\n"
        f"Current 30-day baselines:\n{json.dumps(baselines, indent=2)}\n\n"
        "Return JSON with exactly these keys:\n"
        '{"summary": "2-3 sentence overview of expected outcomes", '
        '"projected_changes": [{"metric": "HRV", "direction": "increase", "magnitude": "+8-12ms", "confidence": "moderate"}], '
        '"timeline": "When key changes will be noticeable", '
        '"caveats": ["Individual variation", "..."], '
        '"disclaimer": "..."}\n\n'
        f"direction must be one of: increase, decrease, stable.\n{SAFETY_FOOTER}"
    )

    try:
        return call_claude_json(system, user_msg, max_tokens=1536)
    except Exception as e:
        return {
            "summary": f"Simulation unavailable: {e}",
            "projected_changes": [],
            "timeline": "",
            "caveats": [],
            "disclaimer": SAFETY_FOOTER,
        }
