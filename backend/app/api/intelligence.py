"""Intelligence API endpoints — brief, cascade, patterns, whispers, simulate, triage."""
import json
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.intelligence import Whisper, Pattern, Insight

router = APIRouter(tags=["intelligence"])

# ── Daily Brief ─────────────────────────────────────────────────────────────

_brief_cache: dict[str, dict] = {}  # user_id -> {date, data}


@router.get("/brief/today")
def brief_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.brief import generate_brief
    today = datetime.now(timezone.utc).date().isoformat()
    cached = _brief_cache.get(current_user.id)
    if cached and cached.get("date") == today:
        return cached["data"]
    try:
        data = generate_brief(db, current_user.id)
        _brief_cache[current_user.id] = {"date": today, "data": data}
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brief generation failed: {e}")


# ── Causal Cascade ───────────────────────────────────────────────────────────

class CascadeRequest(BaseModel):
    event_id: str


@router.post("/cascade/explain")
def cascade_explain(
    req: CascadeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.cascade import explain_cascade
    from ..models.event import Event
    event = db.query(Event).filter(
        Event.id == req.event_id,
        Event.user_id == current_user.id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return explain_cascade(event, db, current_user.id)


# ── Patterns ─────────────────────────────────────────────────────────────────

@router.get("/patterns")
def get_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patterns = (
        db.query(Pattern)
        .filter(Pattern.user_id == current_user.id, Pattern.status != "dismissed")
        .order_by(Pattern.discovered_at.desc())
        .all()
    )
    return [
        {
            "id":                   p.id,
            "title":                p.title,
            "description":          p.description,
            "antecedent":           json.loads(p.antecedent_json) if p.antecedent_json else None,
            "consequent":           json.loads(p.consequent_json) if p.consequent_json else None,
            "lag_hours":            p.lag_hours,
            "occurrences":          p.occurrences,
            "n_observations":       p.n_observations,
            "confidence":           p.confidence,
            "last_seen_at":         p.last_seen_at.isoformat() if p.last_seen_at else None,
            "status":               p.status,
            "suggested_intervention": p.suggested_intervention,
            "discovered_at":        p.discovered_at.isoformat(),
        }
        for p in patterns
    ]


@router.post("/patterns/refresh")
def refresh_patterns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.patterns import discover_patterns
    results = discover_patterns(db, current_user.id)
    return {"discovered": len(results), "patterns": results}


# ── Whispers ──────────────────────────────────────────────────────────────────

@router.post("/whispers/generate")
def generate_whisper_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.whisper import generate_whisper
    result = generate_whisper(db, current_user.id)
    if result is None:
        return {"generated": False, "message": "No significant deviations detected today."}
    return {"generated": True, "whisper": result}


@router.get("/whispers/active")
def active_whispers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Whisper)
        .filter(
            Whisper.user_id == current_user.id,
            Whisper.is_active == True,
            (Whisper.expires_at == None) | (Whisper.expires_at > now),
        )
        .order_by(Whisper.generated_at.desc())
        .all()
    )
    return [
        {
            "id":                 w.id,
            "severity":           w.severity,
            "title":              w.title,
            "narrative":          w.narrative,
            "evidence":           json.loads(w.evidence_json) if w.evidence_json else [],
            "confidence":         w.confidence,
            "recommended_actions": [],
            "expires_at":         w.expires_at.isoformat() if w.expires_at else None,
            "generated_at":       w.generated_at.isoformat(),
            "is_active":          w.is_active,
            "helpful":            w.helpful,
            "action_taken":       w.action_taken,
        }
        for w in rows
    ]


class WhisperFeedback(BaseModel):
    helpful: bool
    action_taken: Optional[str] = None


@router.post("/whispers/{whisper_id}/feedback")
def whisper_feedback(
    whisper_id: str,
    req: WhisperFeedback,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    w = db.query(Whisper).filter(
        Whisper.id == whisper_id,
        Whisper.user_id == current_user.id,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Whisper not found")
    w.helpful = req.helpful
    w.action_taken = req.action_taken
    if not req.helpful:
        w.is_active = False
    db.commit()
    return {"ok": True}


# ── What-If Simulator ─────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    interventions: dict = {}
    duration_days: int = 30


@router.post("/simulate")
def simulate(
    req: SimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.simulator import run_simulation
    return run_simulation(req.interventions, req.duration_days, db, current_user.id)


# ── Symptom Triage ────────────────────────────────────────────────────────────

class TriageRequest(BaseModel):
    symptoms_text: str


@router.post("/triage")
def triage(
    req: TriageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.triage import triage_symptoms
    return triage_symptoms(req.symptoms_text, db, current_user.id)


# ── Body Twin ─────────────────────────────────────────────────────────────────

@router.get("/body-twin/state")
def body_twin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.coach import body_twin_state
    return body_twin_state(db, current_user.id)


# ── ML Baselines ──────────────────────────────────────────────────────────────

@router.get("/ml/baselines")
def ml_baselines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..ml.baselines import compute_baselines
    return compute_baselines(db, current_user.id)


@router.get("/ml/anomalies")
def ml_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..ml.anomaly import score_recent_anomalies
    return {"anomaly_scores": score_recent_anomalies(db, current_user.id)}


@router.get("/ml/correlations")
def ml_correlations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..ml.correlation import compute_correlations
    return {"correlations": compute_correlations(db, current_user.id)}
