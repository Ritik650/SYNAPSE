"""Voice note transcript analysis via Claude."""
from sqlalchemy.orm import Session
from .client import call_claude_json, SAFETY_FOOTER


async def analyze_voice_note(audio_url: str, user_id: str, db: Session) -> dict:
    # In production, transcribe audio first (Whisper or similar).
    # For demo, we receive the URL and return a structured extraction.
    # The actual transcript comes from the upload; here we return a stub.
    return {
        "transcript": "(Transcript would appear here after audio processing)",
        "mood_self_estimate": 6,
        "energy_self_estimate": 6,
        "stress_self_estimate": 4,
        "symptoms_mentioned": [],
        "topics": ["general"],
        "summary": "Voice note received. Transcript processing pending.",
    }


async def analyze_transcript(transcript: str, user_id: str, db: Session) -> dict:
    system = (
        "You are a reflective listener and symptom-aware nurse. "
        "Analyze this voice journal entry and return ONLY valid JSON. No markdown."
    )
    user_msg = (
        f"Transcript:\n{transcript}\n\n"
        "Return JSON with keys: mood_self_estimate (1-10), energy_self_estimate (1-10), "
        "stress_self_estimate (1-10), symptoms_mentioned (list of {symptom, severity_estimate, duration_mentioned}), "
        "topics (list of str), summary (str), follow_ups_to_log (list of str)."
        f"\n\n{SAFETY_FOOTER}"
    )
    try:
        return call_claude_json(system, user_msg, max_tokens=1024)
    except Exception as e:
        return {
            "mood_self_estimate": 6, "energy_self_estimate": 6, "stress_self_estimate": 4,
            "symptoms_mentioned": [], "topics": [], "summary": "Analysis unavailable.",
            "error": str(e),
        }
