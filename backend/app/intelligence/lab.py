"""Lab report PDF interpretation via Claude."""
from sqlalchemy.orm import Session
from .client import call_claude_json, SAFETY_FOOTER


async def interpret_lab_pdf(pdf_bytes: bytes, user_id: str, db: Session) -> dict:
    # Extract text from PDF
    text = ""
    try:
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        text = "(Could not extract PDF text)"

    system = (
        "You are a lab medicine physician explaining results to a patient. "
        "Return ONLY valid JSON. No markdown. Never diagnose."
    )
    user_msg = (
        f"Lab report text:\n{text[:3000]}\n\n"
        "Return JSON with keys: panel_name (str), summary (str, plain English), "
        "values (list of {marker, value, unit, ref_low, ref_high, flag}), "
        "flags (list of flagged marker names)."
        f"\n\n{SAFETY_FOOTER}"
    )
    try:
        return call_claude_json(system, user_msg, max_tokens=2048)
    except Exception as e:
        return {
            "panel_name": "Lab Report",
            "summary": "Could not interpret this report automatically. Please review with your physician.",
            "values": [],
            "flags": [],
            "error": str(e),
        }
