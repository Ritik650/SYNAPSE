"""IsolationForest anomaly detection on multi-metric daily feature vectors."""
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from ..models.health_metric import HealthMetric

_FEATURES = [
    "hrv_rmssd", "rhr", "sleep_duration_min", "sleep_efficiency",
    "mood_self", "stress_self", "steps", "screen_time_min",
]

_FALLBACK = {
    "hrv_rmssd": 50, "rhr": 62, "sleep_duration_min": 420,
    "sleep_efficiency": 82, "mood_self": 6, "stress_self": 4,
    "steps": 7000, "screen_time_min": 120,
}


def _build_daily_matrix(db: Session, user_id: str, days: int) -> tuple[list[str], list[list[float]]]:
    """Return (dates_list, feature_matrix) for the past `days` days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(HealthMetric.ts, HealthMetric.metric_type, HealthMetric.value)
        .filter(
            HealthMetric.user_id == user_id,
            HealthMetric.metric_type.in_(_FEATURES),
            HealthMetric.ts >= since,
        )
        .order_by(HealthMetric.ts)
        .all()
    )

    daily: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for ts, mtype, val in rows:
        day = ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]
        daily[day][mtype].append(val)

    dates = sorted(daily.keys())
    matrix = []
    for day in dates:
        vec = []
        for feat in _FEATURES:
            vals = daily[day].get(feat, [])
            vec.append(sum(vals) / len(vals) if vals else _FALLBACK[feat])
        matrix.append(vec)

    return dates, matrix


def _normalize(matrix: list[list[float]]) -> list[list[float]]:
    """Min-max normalize each feature column."""
    if not matrix:
        return matrix
    n_features = len(matrix[0])
    mins = [min(row[j] for row in matrix) for j in range(n_features)]
    maxs = [max(row[j] for row in matrix) for j in range(n_features)]
    normed = []
    for row in matrix:
        normed.append([
            (row[j] - mins[j]) / max(maxs[j] - mins[j], 1e-6)
            for j in range(n_features)
        ])
    return normed


def _isolation_scores(matrix: list[list[float]], n_trees: int = 100, seed: int = 42) -> list[float]:
    """
    Pure-Python approximation of IsolationForest anomaly scores.
    Returns anomaly_score in [0,1] — higher = more anomalous.
    Uses random subspace + random threshold isolation.
    """
    import random
    rng = random.Random(seed)
    n = len(matrix)
    if n < 4:
        return [0.5] * n

    n_features = len(matrix[0])
    sub_size = max(4, min(n, 256))
    scores = [0.0] * n

    def _path_length(point: list[float], data: list[list[float]], depth: int, limit: int) -> float:
        if depth >= limit or len(data) <= 1:
            c = _c(len(data))
            return depth + c

        feat = rng.randint(0, n_features - 1)
        col = [r[feat] for r in data]
        fmin, fmax = min(col), max(col)
        if fmax == fmin:
            return depth + _c(len(data))

        split = rng.uniform(fmin, fmax)
        left  = [r for r in data if r[feat] < split]
        right = [r for r in data if r[feat] >= split]

        if point[feat] < split:
            next_data = left if left else right
        else:
            next_data = right if right else left

        return _path_length(point, next_data, depth + 1, limit)

    def _c(n: int) -> float:
        if n <= 1:
            return 0.0
        h = sum(1.0 / i for i in range(1, n))
        return 2 * h - (2 * (n - 1) / n)

    limit = int(2 ** (sub_size ** 0.5))
    c_n = _c(sub_size)

    for i, point in enumerate(matrix):
        total_path = 0.0
        for _ in range(n_trees):
            sample = rng.sample(matrix, sub_size)
            total_path += _path_length(point, sample, 0, limit)
        avg_path = total_path / n_trees
        scores[i] = 2 ** (-avg_path / c_n) if c_n > 0 else 0.5

    return scores


def score_recent_anomalies(db: Session, user_id: str, history_days: int = 90) -> dict:
    """
    Fit on 90-day history, score the most recent 7 days.
    Returns {date: anomaly_score} for the last 7 days.
    """
    dates, matrix = _build_daily_matrix(db, user_id, history_days)
    if len(matrix) < 7:
        return {}

    normed = _normalize(matrix)
    scores = _isolation_scores(normed)

    result = {}
    for date, score in zip(dates[-7:], scores[-7:]):
        result[date] = round(score, 4)

    return result


def get_anomaly_context(db: Session, user_id: str) -> dict:
    """
    Return anomaly context for whisper generation.
    Returns most anomalous recent day's features and score.
    """
    recent = score_recent_anomalies(db, user_id)
    if not recent:
        return {"available": False}

    max_date = max(recent, key=lambda d: recent[d])
    max_score = recent[max_date]

    return {
        "available": True,
        "scores": recent,
        "most_anomalous_date": max_date,
        "max_anomaly_score": max_score,
        "features": _FEATURES,
    }
