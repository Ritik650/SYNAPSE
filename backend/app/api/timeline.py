from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.health_metric import HealthMetric
from ..models.event import Event

router = APIRouter(tags=["timeline"])


def _parse_dt(s: Optional[str], default: datetime) -> datetime:
    if not s:
        return default
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return default


def _aggregate_daily(rows: list[HealthMetric]) -> list[dict]:
    """Group hourly/point metrics into daily means for a given metric_type."""
    from collections import defaultdict
    buckets: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        day_key = r.ts.date().isoformat() if hasattr(r.ts, "date") else r.ts[:10]
        buckets[day_key].append(r.value)
    result = []
    for day_str in sorted(buckets):
        vals = buckets[day_str]
        result.append({
            "ts": f"{day_str}T00:00:00+00:00",
            "value": round(sum(vals) / len(vals), 2),
        })
    return result


def _to_hourly(rows: list[HealthMetric]) -> list[dict]:
    return [{"ts": r.ts.isoformat() if hasattr(r.ts, "isoformat") else r.ts,
             "value": round(r.value, 2)} for r in rows]


@router.get("/timeline")
def get_timeline(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    metrics: Optional[str] = Query(None, description="Comma-separated metric types"),
    granularity: str = Query("day", regex="^(hour|day)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    dt_from = _parse_dt(from_, now - timedelta(days=120))
    dt_to   = _parse_dt(to,    now)

    requested = [m.strip() for m in metrics.split(",")] if metrics else None

    q = db.query(HealthMetric).filter(
        HealthMetric.user_id == current_user.id,
        HealthMetric.ts >= dt_from,
        HealthMetric.ts <= dt_to,
    )
    if requested:
        q = q.filter(HealthMetric.metric_type.in_(requested))

    rows = q.order_by(HealthMetric.ts).all()

    # Group by metric_type
    from collections import defaultdict
    by_type: dict[str, list[HealthMetric]] = defaultdict(list)
    for r in rows:
        by_type[r.metric_type].append(r)

    tracks = []
    for mtype, mrows in sorted(by_type.items()):
        data = _to_hourly(mrows) if granularity == "hour" else _aggregate_daily(mrows)
        tracks.append({
            "metric_type": mtype,
            "data": data,
        })

    return {
        "from": dt_from.isoformat(),
        "to":   dt_to.isoformat(),
        "granularity": granularity,
        "tracks": tracks,
    }


@router.get("/events")
def get_events(
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    types: Optional[str] = Query(None, description="Comma-separated event types"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    dt_from = _parse_dt(from_, now - timedelta(days=120))
    dt_to   = _parse_dt(to,    now)

    q = db.query(Event).filter(
        Event.user_id == current_user.id,
        Event.ts >= dt_from,
        Event.ts <= dt_to,
    )
    if types:
        type_list = [t.strip() for t in types.split(",")]
        q = q.filter(Event.event_type.in_(type_list))

    events = q.order_by(Event.ts).all()
    return [
        {
            "id": e.id,
            "ts": e.ts.isoformat() if hasattr(e.ts, "isoformat") else e.ts,
            "event_type": e.event_type,
            "title": e.title,
            "description": e.description,
            "metadata_json": e.metadata_json,
        }
        for e in events
    ]


@router.get("/metrics/baselines")
def get_baselines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return 30/60/90-day baselines (mean ± std) per metric type."""
    now = datetime.now(timezone.utc)
    windows = {"30d": 30, "60d": 60, "90d": 90}
    result: dict[str, dict] = {}

    for label, days in windows.items():
        since = now - timedelta(days=days)
        rows = (
            db.query(HealthMetric.metric_type,
                     func.avg(HealthMetric.value).label("mean"),
                     func.min(HealthMetric.value).label("min"),
                     func.max(HealthMetric.value).label("max"))
            .filter(
                HealthMetric.user_id == current_user.id,
                HealthMetric.ts >= since,
            )
            .group_by(HealthMetric.metric_type)
            .all()
        )
        for r in rows:
            if r.metric_type not in result:
                result[r.metric_type] = {}
            result[r.metric_type][label] = {
                "mean": round(r.mean, 2) if r.mean else None,
                "min":  round(r.min,  2) if r.min  else None,
                "max":  round(r.max,  2) if r.max  else None,
            }

    return result
