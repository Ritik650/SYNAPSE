from fastapi import APIRouter
from ..intelligence.client import ping_claude

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
