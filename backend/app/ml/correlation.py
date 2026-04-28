"""Lead-lag cross-correlation to surface pattern candidates for Claude."""
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from ..models.health_metric import HealthMetric

_PAIRS = [
    ("screen_time_min", "sleep_duration_min"),
    ("screen_time_min", "hrv_rmssd"),
    ("steps",           "mood_self"),
    ("sleep_duration_min", "hrv_rmssd"),
    ("sleep_duration_min", "mood_self"),
    ("stress_self",     "rhr"),
    ("stress_self",     "sleep_efficiency"),
    ("rhr",             "hrv_rmssd"),
]

_MAX_LAG = 3  # days


def _daily_series(db: Session, user_id: str, metric: str, days: int = 90) -> dict[str, float]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(HealthMetric.ts, HealthMetric.value)
        .filter(
            HealthMetric.user_id == user_id,
            HealthMetric.metric_type == metric,
            HealthMetric.ts >= since,
        )
        .order_by(HealthMetric.ts)
        .all()
    )
    daily: dict[str, list] = defaultdict(list)
    for ts, val in rows:
        day = ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]
        daily[day].append(val)
    return {d: sum(v) / len(v) for d, v in daily.items()}


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 5:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    dx  = sum((a - mx) ** 2 for a in xs) ** 0.5
    dy  = sum((b - my) ** 2 for b in ys) ** 0.5
    if dx < 1e-9 or dy < 1e-9:
        return None
    return round(num / (dx * dy), 4)


def compute_correlations(db: Session, user_id: str) -> list[dict]:
    """
    Compute lead-lag Pearson correlations for predefined pairs.
    Returns list of significant findings (|r| > 0.3) sorted by |r|.
    """
    results = []

    for lead_metric, lag_metric in _PAIRS:
        lead_series = _daily_series(db, user_id, lead_metric)
        lag_series  = _daily_series(db, user_id, lag_metric)

        all_days = sorted(set(lead_series) | set(lag_series))
        if len(all_days) < 10:
            continue

        for lag_days in range(0, _MAX_LAG + 1):
            xs, ys = [], []
            for i, day in enumerate(all_days):
                if day not in lead_series:
                    continue
                future_idx = i + lag_days
                if future_idx >= len(all_days):
                    continue
                future_day = all_days[future_idx]
                if future_day not in lag_series:
                    continue
                xs.append(lead_series[day])
                ys.append(lag_series[future_day])

            r = _pearson(xs, ys)
            if r is not None and abs(r) > 0.3:
                results.append({
                    "lead":     lead_metric,
                    "lag":      lag_metric,
                    "lag_days": lag_days,
                    "r":        r,
                    "n":        len(xs),
                    "direction": "negative" if r < 0 else "positive",
                })

    results.sort(key=lambda x: abs(x["r"]), reverse=True)
    return results[:10]


def correlation_summary(db: Session, user_id: str) -> str:
    """Return a short prose summary of top correlations for Claude's context."""
    corrs = compute_correlations(db, user_id)
    if not corrs:
        return "No significant lead-lag correlations found in 90-day window."

    lines = []
    for c in corrs[:5]:
        direction = "increases" if c["direction"] == "positive" else "decreases"
        lag_str = f"same day" if c["lag_days"] == 0 else f"{c['lag_days']}d later"
        lines.append(
            f"  • {c['lead']} → {c['lag']} ({lag_str}): r={c['r']}, n={c['n']} days"
        )
    return "Significant correlations found:\n" + "\n".join(lines)
