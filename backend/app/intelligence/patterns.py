"""Pattern Discovery — find personal causal patterns using ML + Claude."""
import json
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from .client import call_claude_json, SAFETY_FOOTER
from ..models.health_metric import HealthMetric
from ..models.event import Event
from ..models.intelligence import Pattern
from ..ml.correlation import correlation_summary


def _build_feature_matrix(db: Session, user_id: str) -> tuple[list, list]:
    """Return (daily_feature_dicts, daily_event_lists) for last 90 days."""
    since = datetime.now(timezone.utc) - timedelta(days=90)
    metrics = (
        db.query(HealthMetric)
        .filter(HealthMetric.user_id == user_id, HealthMetric.ts >= since)
        .order_by(HealthMetric.ts)
        .all()
    )
    events = (
        db.query(Event)
        .filter(Event.user_id == user_id, Event.ts >= since,
                Event.event_type.in_(["illness_onset", "illness_resolve", "symptom",
                                      "workout", "calendar_event"]))
        .order_by(Event.ts)
        .all()
    )

    from collections import defaultdict
    daily_m: dict[str, list] = defaultdict(list)
    for m in metrics:
        day = m.ts.date().isoformat() if hasattr(m.ts, "date") else m.ts[:10]
        daily_m[day].append({"type": m.metric_type, "value": m.value})

    daily_e: dict[str, list] = defaultdict(list)
    for e in events:
        day = e.ts.date().isoformat() if hasattr(e.ts, "date") else e.ts[:10]
        daily_e[day].append({"type": e.event_type, "title": e.title})

    # Build daily feature rows
    days_sorted = sorted(set(list(daily_m.keys()) + list(daily_e.keys())))
    feature_rows = []
    for day in days_sorted:
        mlist = daily_m.get(day, [])
        emap = {}
        for m in mlist:
            if m["type"] not in emap:
                emap[m["type"]] = []
            emap[m["type"]].append(m["value"])
        row = {k: round(sum(v)/len(v), 2) for k, v in emap.items()}
        row["date"] = day
        row["events"] = daily_e.get(day, [])
        feature_rows.append(row)

    return feature_rows, days_sorted


def discover_patterns(db: Session, user_id: str) -> list[dict]:
    feature_rows, _ = _build_feature_matrix(db, user_id)
    if len(feature_rows) < 14:
        return []

    # Condense for Claude (keep last 90 days, summarise)
    condensed = []
    for row in feature_rows[-90:]:
        condensed.append({
            "date":         row["date"],
            "sleep_h":      round(row.get("sleep_duration_min", 0) / 60, 1) if row.get("sleep_duration_min") else None,
            "screen_min":   row.get("screen_time_min"),
            "hrv":          row.get("hrv_rmssd"),
            "rhr":          row.get("rhr"),
            "mood":         row.get("mood_self"),
            "stress":       row.get("stress_self"),
            "steps":        row.get("steps"),
            "n_calendar":   sum(1 for e in row["events"] if e["type"] == "calendar_event"),
            "events":       [e["type"] + ":" + e["title"][:30] for e in row["events"]
                             if e["type"] in ("illness_onset", "illness_resolve", "symptom", "workout")],
        })

    corr_context = correlation_summary(db, user_id)

    system = (
        "You are a biostatistician searching for personal causal health patterns. "
        "Look for repeating antecedent-consequent sequences with consistent lag times. "
        "Return ONLY valid JSON array."
    )

    user_msg = (
        f"90-day daily health timeline:\n{json.dumps(condensed, indent=2)}\n\n"
        f"Statistical lead-lag correlations pre-computed by ML:\n{corr_context}\n\n"
        "Find 2–5 causal patterns. For each pattern return:\n"
        '{"title": "...", "description": "...", '
        '"antecedent": {"description": "...", "metrics": [], "thresholds": {}}, '
        '"consequent": {"description": "...", "events": []}, '
        '"lag_hours_min": 0, "lag_hours_max": 0, "support_observations": 0, '
        '"confidence": 0.0, "suggested_intervention": "..."}\n'
        "Pay close attention to: migraine events and what precedes them. "
        "Illness onset and what preceded it. How running affected recovery metrics. "
        "Use the pre-computed correlations to support or refute pattern candidates.\n\n"
        f"{SAFETY_FOOTER}"
    )

    try:
        raw = call_claude_json(system, user_msg, max_tokens=2048)
        if not isinstance(raw, list):
            raw = raw.get("patterns", []) if isinstance(raw, dict) else []
    except Exception:
        raw = []

    now = datetime.now(timezone.utc)

    # Mark existing active patterns stale
    db.query(Pattern).filter(
        Pattern.user_id == user_id,
        Pattern.status == "active",
    ).update({"status": "stale"})

    # Insert new patterns
    saved = []
    for p in raw:
        pat = Pattern(
            id=str(uuid.uuid4()),
            user_id=user_id,
            discovered_at=now,
            title=p.get("title", "Unnamed pattern"),
            description=p.get("description"),
            antecedent_json=json.dumps(p.get("antecedent")),
            consequent_json=json.dumps(p.get("consequent")),
            lag_hours=float((p.get("lag_hours_min", 0) + p.get("lag_hours_max", 24)) / 2),
            occurrences=int(p.get("support_observations", 0)),
            n_observations=int(p.get("support_observations", 0)),
            confidence=float(p.get("confidence", 0.5)),
            suggested_intervention=p.get("suggested_intervention"),
            status="active",
            last_seen_at=now,
        )
        db.add(pat)
        saved.append({
            "id": pat.id, "title": pat.title, "confidence": pat.confidence,
            "occurrences": pat.occurrences, "suggested_intervention": pat.suggested_intervention,
        })

    db.commit()
    return saved
