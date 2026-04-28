import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.health_metric import HealthMetric
from ..models.event import Event
from ..models.records import Symptom
from ..services.seed import seed_demo

router = APIRouter(prefix="/ingest", tags=["ingest"])

UPLOAD_DIR = "uploads"


def _save_upload(file: UploadFile, subdir: str) -> str:
    os.makedirs(f"{UPLOAD_DIR}/{subdir}", exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    fname = f"{uuid.uuid4()}{ext}"
    path = f"{UPLOAD_DIR}/{subdir}/{fname}"
    with open(path, "wb") as f:
        f.write(file.file.read())
    return f"/{path}"


@router.post("/seed-demo")
def seed_demo_endpoint(db: Session = Depends(get_db)):
    """Idempotently seed 120-day Aarav dataset. Returns JWT for demo user."""
    from ..core.security import create_access_token
    from ..services.synthetic import DEMO_EMAIL
    from ..models.user import User as UserModel

    stats = seed_demo(db)

    # Return a login token for the demo user so the frontend can log in
    user = db.query(UserModel).filter(UserModel.email == DEMO_EMAIL).first()
    token = create_access_token(user.id) if user else None

    return {"message": "Demo data seeded", "token": token, **stats}


# ── Manual entry endpoints ───────────────────────────────────────────────────

class ManualMetricRequest(BaseModel):
    metric_type: str
    value: float
    unit: Optional[str] = None
    ts: Optional[str] = None
    source: str = "manual"

class ManualEventRequest(BaseModel):
    event_type: str
    title: str
    description: Optional[str] = None
    ts: Optional[str] = None
    metadata_json: Optional[str] = None

class ManualSymptomRequest(BaseModel):
    name: str
    severity: int = 5
    started_at: Optional[str] = None
    body_region: Optional[str] = None
    notes: Optional[str] = None


@router.post("/manual/metric", status_code=201)
def manual_metric(
    req: ManualMetricRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    ts = req.ts or datetime.now(timezone.utc).isoformat()
    metric = HealthMetric(
        id=str(uuid.uuid4()), user_id=current_user.id,
        ts=ts, metric_type=req.metric_type,
        value=req.value, unit=req.unit, source=req.source,
    )
    db.add(metric)
    db.commit()
    return {"id": metric.id}


@router.post("/manual/event", status_code=201)
def manual_event(
    req: ManualEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    ts = req.ts or datetime.now(timezone.utc).isoformat()
    event = Event(
        id=str(uuid.uuid4()), user_id=current_user.id,
        ts=ts, event_type=req.event_type,
        title=req.title, description=req.description,
        metadata_json=req.metadata_json,
    )
    db.add(event)
    db.commit()
    return {"id": event.id}


@router.post("/manual/symptom", status_code=201)
def manual_symptom(
    req: ManualSymptomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    started = req.started_at or datetime.now(timezone.utc).isoformat()
    sym = Symptom(
        id=str(uuid.uuid4()), user_id=current_user.id,
        name=req.name, severity=req.severity,
        started_at=started, body_region=req.body_region,
        notes=req.notes,
    )
    db.add(sym)
    db.commit()
    return {"id": sym.id}


# ── File upload endpoints ────────────────────────────────────────────────────

@router.post("/meal-photo")
async def upload_meal_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    import json
    from ..models.records import Meal
    from ..intelligence.vision import analyze_meal_photo

    url = _save_upload(file, "meals")
    with open(url.lstrip("/"), "rb") as f:
        img_bytes = f.read()

    media_type = file.content_type or "image/jpeg"
    analysis = await analyze_meal_photo(img_bytes, media_type, current_user.id, db)

    meal = Meal(
        id=str(uuid.uuid4()), user_id=current_user.id,
        ts=datetime.now(timezone.utc).isoformat(),
        photo_url=url,
        claude_analysis_json=json.dumps(analysis),
        calories_est=float(analysis.get("macros", {}).get("calories", 0)),
        protein_g=float(analysis.get("macros", {}).get("protein_g", 0)),
        carbs_g=float(analysis.get("macros", {}).get("carbs_g", 0)),
        fat_g=float(analysis.get("macros", {}).get("fat_g", 0)),
        fiber_g=float(analysis.get("macros", {}).get("fiber_g", 0)),
    )
    db.add(meal)
    db.commit()
    return {"id": meal.id, "analysis": analysis}


@router.post("/lab-pdf")
async def upload_lab_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from ..models.records import LabResult, LabValue
    from ..intelligence.lab import interpret_lab_pdf
    import json

    url = _save_upload(file, "labs")
    with open(url.lstrip("/"), "rb") as f:
        pdf_bytes = f.read()

    result_data = await interpret_lab_pdf(pdf_bytes, current_user.id, db)

    lab = LabResult(
        id=str(uuid.uuid4()), user_id=current_user.id,
        panel_name=result_data.get("panel_name", "Lab Report"),
        drawn_at=datetime.now(timezone.utc).isoformat(),
        source_pdf_url=url,
        claude_summary=result_data.get("summary"),
        flags_json=json.dumps(result_data.get("flags", [])),
    )
    db.add(lab)
    db.flush()

    for v in result_data.get("values", []):
        db.add(LabValue(id=str(uuid.uuid4()), lab_result_id=lab.id, **v))

    db.commit()
    return {"id": lab.id, "panel_name": lab.panel_name}


@router.post("/voice")
async def upload_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from ..models.records import VoiceNote
    from ..intelligence.voice import analyze_voice_note
    import json

    url = _save_upload(file, "voice")
    analysis = await analyze_voice_note(url, current_user.id, db)

    note = VoiceNote(
        id=str(uuid.uuid4()), user_id=current_user.id,
        ts=datetime.now(timezone.utc).isoformat(),
        audio_url=url,
        transcript=analysis.get("transcript", ""),
        claude_extraction_json=json.dumps(analysis),
        mood_score=float(analysis.get("mood_self_estimate", 5)),
        symptoms_extracted=json.dumps(analysis.get("symptoms_mentioned", [])),
        topics=json.dumps(analysis.get("topics", [])),
    )
    db.add(note)
    db.commit()
    return {"id": note.id, "analysis": analysis}
