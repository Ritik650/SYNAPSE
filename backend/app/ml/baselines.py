"""Per-metric rolling statistical baselines from DB."""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.health_metric import HealthMetric


_TRACKED = [
    "hrv_rmssd", "rhr", "sleep_duration_min", "sleep_efficiency",
    "mood_self", "stress_self", "steps", "screen_time_min",
    "spo2", "resp_rate", "glucose", "weight_kg",
]

_WINDOWS = {"30d": 30, "60d": 60, "90d": 90}


def compute_baselines(db: Session, user_id: str) -> dict:
    """Return {metric_type: {window: {mean, std, p10, p90, n}}} for all tracked metrics."""
    now = datetime.now(timezone.utc)
    result = {}

    for metric in _TRACKED:
        result[metric] = {}
        for label, days in _WINDOWS.items():
            since = now - timedelta(days=days)
            rows = (
                db.query(HealthMetric.value)
                .filter(
                    HealthMetric.user_id == user_id,
                    HealthMetric.metric_type == metric,
                    HealthMetric.ts >= since,
                )
                .all()
            )
            vals = sorted(r[0] for r in rows if r[0] is not None)
            n = len(vals)
            if n < 3:
                result[metric][label] = {"mean": None, "std": None, "p10": None, "p90": None, "n": n}
                continue

            mean = sum(vals) / n
            variance = sum((v - mean) ** 2 for v in vals) / n
            std = variance ** 0.5

            p10_idx = max(0, int(n * 0.10) - 1)
            p90_idx = min(n - 1, int(n * 0.90))

            result[metric][label] = {
                "mean": round(mean, 3),
                "std":  round(std, 3),
                "p10":  round(vals[p10_idx], 3),
                "p90":  round(vals[p90_idx], 3),
                "n":    n,
            }

    return result


def z_score(value: float, baseline: dict) -> float | None:
    """Compute z-score of value against 30d baseline stats."""
    stats = baseline.get("30d", {})
    mean = stats.get("mean")
    std  = stats.get("std")
    if mean is None or std is None or std < 1e-6:
        return None
    return round((value - mean) / std, 3)
