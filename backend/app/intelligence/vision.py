"""Meal photo analysis via Claude vision."""
from sqlalchemy.orm import Session
from .client import call_claude_vision, load_prompt, SAFETY_FOOTER
from ..models.health_metric import HealthMetric


async def analyze_meal_photo(image_bytes: bytes, media_type: str, user_id: str, db: Session) -> dict:
    system = (
        "You are a registered dietitian analyzing a meal photo. "
        "Return ONLY a valid JSON object matching the specified schema. No markdown."
    )
    user_msg = (
        "Analyze this meal photo. Return JSON with keys: "
        "items_identified (list), estimated_portion (str), "
        "macros (calories, protein_g, carbs_g, fat_g, fiber_g), "
        "glycemic_load_estimate (str), what_is_great (str), "
        "what_is_missing (str), hydration_suggestion (str), next_meal_balance (str)."
        f"\n\n{SAFETY_FOOTER}"
    )
    try:
        result = call_claude_vision(system, user_msg, image_bytes, media_type, max_tokens=1024)
        if isinstance(result, str):
            import json
            result = json.loads(result)
        return result
    except Exception as e:
        return {
            "items_identified": ["Unable to analyze"],
            "estimated_portion": "Unknown",
            "macros": {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0},
            "glycemic_load_estimate": "unknown",
            "what_is_great": "Analysis unavailable.",
            "what_is_missing": "Analysis unavailable.",
            "hydration_suggestion": "Stay hydrated.",
            "next_meal_balance": "Balance your next meal.",
            "error": str(e),
        }
