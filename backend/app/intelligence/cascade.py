"""Causal Cascade Explainer — reconstructs cause-and-effect chain leading to a health event."""
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from .client import call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric
from ..models.event import Event


def _window_data(db: Session, user_id: str, anchor_ts: datetime, days: int = 14) -> dict:
    since = anchor_ts - timedelta(days=days)
    metrics = (
        db.query(HealthMetric)
        .filter(HealthMetric.user_id == user_id,
                HealthMetric.ts >= since,
                HealthMetric.ts <= anchor_ts)
        .order_by(HealthMetric.ts)
        .all()
    )
    events = (
        db.query(Event)
        .filter(Event.user_id == user_id,
                Event.ts >= since,
                Event.ts <= anchor_ts)
        .order_by(Event.ts)
        .all()
    )

    from collections import defaultdict
    by_day: dict[str, dict] = defaultdict(dict)
    for m in metrics:
        day = m.ts.date().isoformat() if hasattr(m.ts, "date") else m.ts[:10]
        if m.metric_type not in by_day[day]:
            by_day[day][m.metric_type] = []
        by_day[day][m.metric_type].append(round(m.value, 2))

    # Daily means
    daily = {day: {k: round(sum(v)/len(v), 2) for k, v in metrics_dict.items()}
             for day, metrics_dict in sorted(by_day.items())}

    event_list = [
        {"day": (e.ts.date().isoformat() if hasattr(e.ts, "date") else e.ts[:10]),
         "type": e.event_type, "title": e.title, "metadata": e.metadata_json}
        for e in events
    ]
    return {"daily_metrics": daily, "events": event_list}


def explain_cascade(event: Event, db: Session, user_id: str) -> dict:
    anchor = event.ts if isinstance(event.ts, datetime) else datetime.fromisoformat(str(event.ts))
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)

    window = _window_data(db, user_id, anchor, days=14)

    system = (
        "You are a clinical analyst reconstructing the cause-and-effect chain leading to a health event. "
        "Return ONLY valid JSON. Be specific about numbers and timeframes. "
        "Weights in contributing_factors must sum to approximately 1.0."
    )

    user_msg = (
        f"Event: {event.title} ({event.event_type}) on {anchor.date().isoformat()}\n"
        f"Description: {event.description or 'None'}\n\n"
        f"14-day daily metrics before event:\n{json.dumps(window['daily_metrics'], indent=2)}\n\n"
        f"Events in window:\n{json.dumps(window['events'], indent=2)}\n\n"
        "Return JSON:\n"
        '{"narrative": "...", "timeline_summary": [{"day_offset": -7, "key_event": "..."}], '
        '"contributing_factors": [{"factor": "...", "weight": 0.0, "evidence": "...", "metric_refs": ["..."]}], '
        '"confidence": 0.0, "alternative_explanations": ["..."]}\n\n'
        f"{SAFETY_FOOTER}"
    )

    try:
        return call_claude_json(system, user_msg, max_tokens=2048)
    except Exception as e:
        return {
            "narrative": f"Could not generate cascade explanation: {e}",
            "timeline_summary": [],
            "contributing_factors": [],
            "confidence": 0.0,
            "alternative_explanations": [],
        }
