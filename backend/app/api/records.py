"""Records CRUD — symptoms, medications, labs, meals, voice notes, goals, habits."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.records import (
    Medication, MedicationDose, Symptom,
    LabResult, LabValue, Meal, VoiceNote, DoctorVisit,
)
from ..models.intelligence import Goal, Habit

router = APIRouter(prefix="/records", tags=["records"])


def utcnow():
    return datetime.now(timezone.utc)


# ── Symptoms ─────────────────────────────────────────────────────────────────

class SymptomIn(BaseModel):
    name: str
    severity: int = 5
    started_at: datetime
    resolved_at: Optional[datetime] = None
    body_region: Optional[str] = None
    notes: Optional[str] = None


@router.get("/symptoms")
def list_symptoms(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Symptom)
        .filter(Symptom.user_id == user.id)
        .order_by(Symptom.started_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id, "name": r.name, "severity": r.severity,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "body_region": r.body_region, "notes": r.notes,
        }
        for r in rows
    ]


@router.post("/symptoms", status_code=201)
def create_symptom(
    body: SymptomIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sym = Symptom(
        id=str(uuid.uuid4()), user_id=user.id,
        name=body.name, severity=body.severity,
        started_at=body.started_at, resolved_at=body.resolved_at,
        body_region=body.body_region, notes=body.notes,
    )
    db.add(sym)
    db.commit()
    db.refresh(sym)
    return {"id": sym.id, "name": sym.name}


@router.patch("/symptoms/{symptom_id}/resolve")
def resolve_symptom(
    symptom_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sym = db.query(Symptom).filter(Symptom.id == symptom_id, Symptom.user_id == user.id).first()
    if not sym:
        raise HTTPException(404, "Not found")
    sym.resolved_at = utcnow()
    db.commit()
    return {"id": sym.id, "resolved_at": sym.resolved_at.isoformat()}


# ── Medications ───────────────────────────────────────────────────────────────

class MedicationIn(BaseModel):
    name: str
    dose: Optional[float] = None
    unit: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    prescribed_by: Optional[str] = None
    notes: Optional[str] = None


@router.get("/medications")
def list_medications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Medication)
        .filter(Medication.user_id == user.id)
        .order_by(Medication.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id, "name": r.name, "dose": r.dose, "unit": r.unit,
            "frequency": r.frequency,
            "start_date": str(r.start_date) if r.start_date else None,
            "end_date": str(r.end_date) if r.end_date else None,
            "prescribed_by": r.prescribed_by, "notes": r.notes,
        }
        for r in rows
    ]


@router.post("/medications", status_code=201)
def create_medication(
    body: MedicationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import date as date_type
    start = date_type.fromisoformat(body.start_date) if body.start_date else None
    end   = date_type.fromisoformat(body.end_date)   if body.end_date   else None
    med = Medication(
        id=str(uuid.uuid4()), user_id=user.id,
        name=body.name, dose=body.dose, unit=body.unit,
        frequency=body.frequency, start_date=start, end_date=end,
        prescribed_by=body.prescribed_by, notes=body.notes,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"id": med.id, "name": med.name}


@router.post("/medications/{medication_id}/doses", status_code=201)
def log_dose(
    medication_id: str,
    taken_at: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med = db.query(Medication).filter(Medication.id == medication_id, Medication.user_id == user.id).first()
    if not med:
        raise HTTPException(404, "Medication not found")
    dose = MedicationDose(
        id=str(uuid.uuid4()),
        medication_id=medication_id,
        taken_at=taken_at or utcnow(),
    )
    db.add(dose)
    db.commit()
    return {"id": dose.id, "taken_at": dose.taken_at.isoformat()}


# ── Lab Results ───────────────────────────────────────────────────────────────

@router.get("/labs")
def list_labs(
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(LabResult)
        .filter(LabResult.user_id == user.id)
        .order_by(LabResult.drawn_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for r in rows:
        values = [
            {
                "marker": v.marker, "value": v.value, "unit": v.unit,
                "ref_low": v.ref_low, "ref_high": v.ref_high, "flag": v.flag,
            }
            for v in r.values
        ]
        out.append({
            "id": r.id, "panel_name": r.panel_name,
            "drawn_at": r.drawn_at.isoformat() if r.drawn_at else None,
            "claude_summary": r.claude_summary,
            "values": values,
        })
    return out


@router.get("/labs/{lab_id}")
def get_lab(
    lab_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(LabResult).filter(LabResult.id == lab_id, LabResult.user_id == user.id).first()
    if not r:
        raise HTTPException(404, "Not found")
    import json
    return {
        "id": r.id, "panel_name": r.panel_name,
        "drawn_at": r.drawn_at.isoformat() if r.drawn_at else None,
        "claude_summary": r.claude_summary,
        "flags": json.loads(r.flags_json) if r.flags_json else [],
        "values": [
            {
                "marker": v.marker, "value": v.value, "unit": v.unit,
                "ref_low": v.ref_low, "ref_high": v.ref_high, "flag": v.flag,
            }
            for v in r.values
        ],
    }


# ── Meals ──────────────────────────────────────────────────────────────────────

@router.get("/meals")
def list_meals(
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Meal)
        .filter(Meal.user_id == user.id)
        .order_by(Meal.ts.desc())
        .limit(limit)
        .all()
    )
    import json
    return [
        {
            "id": r.id,
            "ts": r.ts.isoformat() if r.ts else None,
            "photo_url": r.photo_url,
            "calories_est": r.calories_est,
            "protein_g": r.protein_g,
            "carbs_g": r.carbs_g,
            "fat_g": r.fat_g,
            "fiber_g": r.fiber_g,
            "notes": r.notes,
            "analysis": json.loads(r.claude_analysis_json) if r.claude_analysis_json else None,
        }
        for r in rows
    ]


# ── Voice Notes ────────────────────────────────────────────────────────────────

@router.get("/voice-notes")
def list_voice_notes(
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(VoiceNote)
        .filter(VoiceNote.user_id == user.id)
        .order_by(VoiceNote.ts.desc())
        .limit(limit)
        .all()
    )
    import json
    return [
        {
            "id": r.id,
            "ts": r.ts.isoformat() if r.ts else None,
            "transcript": r.transcript,
            "mood_score": r.mood_score,
            "topics": json.loads(r.topics) if r.topics else [],
            "extraction": json.loads(r.claude_extraction_json) if r.claude_extraction_json else None,
        }
        for r in rows
    ]


# ── Goals ─────────────────────────────────────────────────────────────────────

class GoalIn(BaseModel):
    type: str
    target_value: Optional[float] = None
    target_unit: Optional[str] = None
    period: Optional[str] = None
    ends_at: Optional[datetime] = None


@router.get("/goals")
def list_goals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Goal)
        .filter(Goal.user_id == user.id)
        .order_by(Goal.started_at.desc())
        .all()
    )
    return [
        {
            "id": r.id, "type": r.type,
            "target_value": r.target_value, "target_unit": r.target_unit,
            "period": r.period, "current_value": r.current_value,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "ends_at": r.ends_at.isoformat() if r.ends_at else None,
        }
        for r in rows
    ]


@router.post("/goals", status_code=201)
def create_goal(
    body: GoalIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    goal = Goal(
        id=str(uuid.uuid4()), user_id=user.id,
        type=body.type, target_value=body.target_value,
        target_unit=body.target_unit, period=body.period,
        ends_at=body.ends_at,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {"id": goal.id, "type": goal.type}


# ── Habits ─────────────────────────────────────────────────────────────────────

class HabitIn(BaseModel):
    name: str
    schedule_json: Optional[str] = None


@router.get("/habits")
def list_habits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Habit)
        .filter(Habit.user_id == user.id)
        .order_by(Habit.streak_current.desc())
        .all()
    )
    return [
        {
            "id": r.id, "name": r.name,
            "streak_current": r.streak_current, "streak_best": r.streak_best,
            "last_completed_at": r.last_completed_at.isoformat() if r.last_completed_at else None,
        }
        for r in rows
    ]


@router.post("/habits", status_code=201)
def create_habit(
    body: HabitIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    habit = Habit(
        id=str(uuid.uuid4()), user_id=user.id,
        name=body.name, schedule_json=body.schedule_json,
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return {"id": habit.id, "name": habit.name}


@router.post("/habits/{habit_id}/complete")
def complete_habit(
    habit_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user.id).first()
    if not habit:
        raise HTTPException(404, "Not found")
    habit.last_completed_at = utcnow()
    habit.streak_current += 1
    habit.streak_best = max(habit.streak_best, habit.streak_current)
    db.commit()
    return {"id": habit.id, "streak_current": habit.streak_current}


# ── Doctor Visits ─────────────────────────────────────────────────────────────

@router.get("/doctor-visits")
def list_doctor_visits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(DoctorVisit)
        .filter(DoctorVisit.user_id == user.id)
        .order_by(DoctorVisit.ts.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "ts": r.ts.isoformat() if r.ts else None,
            "provider": r.provider, "reason": r.reason,
            "summary": r.summary,
        }
        for r in rows
    ]
