"""Care Circle API — invite members and manage health data sharing."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User
from ..models.intelligence import CareCircleMember

router = APIRouter(prefix="/care-circle", tags=["care-circle"])


class InviteRequest(BaseModel):
    email: str
    name: str
    role: str = "supporter"


class ShareToggleRequest(BaseModel):
    share_labs: bool = True
    share_vitals: bool = True
    share_medications: bool = True
    share_symptoms: bool = True


@router.get("/members")
def list_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = db.query(CareCircleMember).filter_by(user_id=current_user.id).all()
    return [
        {
            "id": m.id,
            "email": m.email,
            "name": m.name,
            "role": m.role,
            "status": m.invite_status,
            "share_labs": m.share_labs,
            "share_vitals": m.share_vitals,
            "share_medications": m.share_medications,
            "share_symptoms": m.share_symptoms,
            "invited_at": m.invited_at.isoformat() if m.invited_at else None,
        }
        for m in members
    ]


@router.post("/invite")
def invite_member(
    req: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(CareCircleMember).filter_by(
        user_id=current_user.id, email=req.email
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This person is already in your care circle.")

    member = CareCircleMember(
        user_id=current_user.id,
        email=req.email,
        name=req.name,
        role=req.role,
        invite_status="pending",
        share_labs=True,
        share_vitals=True,
        share_medications=False,
        share_symptoms=True,
        invited_at=datetime.now(timezone.utc),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"message": f"Invitation sent to {req.email}", "id": member.id}


@router.patch("/members/{member_id}/sharing")
def update_sharing(
    member_id: str,
    req: ShareToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(CareCircleMember).filter_by(
        id=member_id, user_id=current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    member.share_labs = req.share_labs
    member.share_vitals = req.share_vitals
    member.share_medications = req.share_medications
    member.share_symptoms = req.share_symptoms
    db.commit()
    return {"message": "Sharing preferences updated."}


@router.delete("/members/{member_id}")
def remove_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(CareCircleMember).filter_by(
        id=member_id, user_id=current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    db.delete(member)
    db.commit()
    return {"message": "Member removed."}
