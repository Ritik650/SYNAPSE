from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db.deps import get_db
from ..intelligence.client import ping_claude
from ..services.seed import seed_demo

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    claude_status = "unchecked"
    try:
        result = await ping_claude()
        claude_status = result
    except Exception as e:
        claude_status = f"error: {str(e)[:60]}"

    return {
        "status": "ok",
        "service": "Synapse",
        "tagline": "Your biology, finally understood.",
        "message": "Synapse online",
        "claude": claude_status,
    }


@router.post("/seed")
async def seed_demo_data(db: Session = Depends(get_db)):
    """Generate 120 days of demo health data for aarav@synapse.demo"""
    try:
        stats = seed_demo(db)
        return {
            "status": "success",
            "message": "Demo data seeded successfully",
            "user": "aarav@synapse.demo",
            "password": "synapse-demo-2024",
            "days": 120,
            "data": stats
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
