"""Reports API — Doctor Prep clinical brief + PDF download."""
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..core.deps import get_current_user
from ..models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


class DoctorPrepRequest(BaseModel):
    visit_reason: str
    visit_date: str
    physician_name: str = ""


@router.post("/doctor-prep")
def doctor_prep(
    req: DoctorPrepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.doctor import generate_doctor_prep
    return generate_doctor_prep(req.visit_reason, req.visit_date, db, current_user.id)


@router.post("/doctor-prep/pdf")
def doctor_prep_pdf(
    req: DoctorPrepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..intelligence.doctor import generate_doctor_prep
    report = generate_doctor_prep(req.visit_reason, req.visit_date, db, current_user.id)
    pdf_bytes = _build_pdf(report)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="synapse-doctor-brief-{req.visit_date}.pdf"'
        },
    )


def _build_pdf(report: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm,
    )

    styles = getSampleStyleSheet()
    meta = report.get("_meta", {})

    # Custom styles
    title_style = ParagraphStyle(
        "SynapseTitle",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=4,
    )
    heading_style = ParagraphStyle(
        "SynapseHeading",
        parent=styles["Heading2"],
        fontSize=11,
        textColor=colors.HexColor("#3B82F6"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "SynapseBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
    )
    small_style = ParagraphStyle(
        "SynapseSmall",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#64748B"),
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#94A3B8"),
        borderPadding=8,
        backColor=colors.HexColor("#F8FAFC"),
    )

    story = []

    # Header
    story.append(Paragraph("Synapse Health Brief", title_style))
    story.append(Paragraph(
        f"Prepared for: <b>{meta.get('patient_name', 'Patient')}</b>  ·  "
        f"Visit: {meta.get('visit_date', '—')}  ·  "
        f"Reason: {meta.get('visit_reason', '—')}",
        small_style,
    ))
    story.append(Paragraph(
        f"Generated: {meta.get('generated_at', '')[:16].replace('T', ' ')} UTC",
        small_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))

    # Executive Summary
    story.append(Paragraph("Executive Summary", heading_style))
    story.append(Paragraph(report.get("executive_summary", "—"), body_style))

    # Key Metrics
    key_metrics = report.get("key_metrics", {})
    if key_metrics:
        story.append(Paragraph("Key Metrics (30-Day Average)", heading_style))
        rows = [["Metric", "Value"]] + [[k, str(v)] for k, v in key_metrics.items()]
        t = Table(rows, colWidths=[7*cm, 10*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)

    # Flagged Labs
    flagged_labs = report.get("flagged_labs", [])
    if flagged_labs:
        story.append(Paragraph("Flagged Lab Values", heading_style))
        lab_rows = [["Marker", "Value", "Interpretation"]]
        for fl in flagged_labs:
            lab_rows.append([
                fl.get("marker", ""),
                str(fl.get("value", "")),
                fl.get("interpretation", ""),
            ])
        lt = Table(lab_rows, colWidths=[5*cm, 3*cm, 9*cm])
        lt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EF4444")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFF5F5"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(lt)

    # Active Concerns
    concerns = report.get("active_concerns", [])
    if concerns:
        story.append(Paragraph("Active Concerns", heading_style))
        for c in concerns:
            story.append(Paragraph(f"• {c}", body_style))

    # Top 5 Questions
    questions = report.get("top_5_questions", [])
    if questions:
        story.append(Paragraph("Questions to Ask Your Doctor", heading_style))
        for i, q in enumerate(questions, 1):
            story.append(Paragraph(f"{i}. {q}", body_style))

    # Medication Review
    med_review = report.get("medication_review", [])
    if med_review:
        story.append(Paragraph("Medication Review Notes", heading_style))
        for m in med_review:
            story.append(Paragraph(f"• {m}", body_style))

    # Suggested Tests
    tests = report.get("suggested_tests", [])
    if tests:
        story.append(Paragraph("Suggested Tests / Follow-ups", heading_style))
        for test in tests:
            story.append(Paragraph(f"• {test}", body_style))

    # Disclaimer
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0")))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "IMPORTANT: This document was generated by Synapse, an AI-powered personal health intelligence "
        "platform. It is informational only and does not constitute a medical diagnosis, clinical assessment, "
        "or treatment recommendation. All clinical decisions must be made by a licensed healthcare professional "
        "with full access to the patient's medical history. Not a substitute for professional medical advice.",
        disclaimer_style,
    ))

    doc.build(story)
    return buf.getvalue()
