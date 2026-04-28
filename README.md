# Synapse — Personal Health Intelligence Platform

> **Claude-powered health OS** that transforms raw wearable data into clinical narratives, causal patterns, and proactive whispers.

Built for the Anthropic Hackathon. Targets judges, doctors, and investors who want to see what AI can do for personal health beyond chatbots.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  Dashboard · Time Machine · Patterns · Whispers · Body Twin     │
│  Sleep · Recovery · Mind · Meals · Symptoms · Labs · Meds       │
│  Simulator · Doctor Mode · Care Circle · Settings               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (axios)
┌──────────────────────────▼──────────────────────────────────────┐
│                   BACKEND (FastAPI + SQLAlchemy)                 │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   API Layer  │  │  ML Module   │  │  Intelligence Layer    │ │
│  │  42 endpoints│  │  Baselines   │  │  brief.py              │ │
│  │  auth        │  │  IsoForest   │  │  cascade.py            │ │
│  │  timeline    │  │  Correlation │  │  patterns.py           │ │
│  │  score       │  └──────────────┘  │  whisper.py            │ │
│  │  records     │                    │  vision.py             │ │
│  │  reports     │  ┌──────────────┐  │  voice.py              │ │
│  │  care-circle │  │   SQLite     │  │  lab.py                │ │
│  └─────────────┘  │   (dev)      │  │  triage.py             │ │
│                   │   Postgres   │  │  simulator.py          │ │
│                   │   (prod)     │  │  doctor.py             │ │
│                   └──────────────┘  └──────────┬─────────────┘ │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │ Anthropic SDK
                                          ┌────────▼────────┐
                                          │ claude-sonnet-4-5│
                                          │  10 prompt types │
                                          │  retry + JSON    │
                                          │  parsing layer   │
                                          └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Charts | Recharts (AreaChart, ComposedChart, LineChart) |
| Animation | Framer Motion |
| State | TanStack Query (server), Zustand (auth) |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| AI | Anthropic claude-sonnet-4-5 |
| PDF | ReportLab |
| ML | Pure Python (IsolationForest approximation, Pearson correlation) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Anthropic API key

### 1. Clone and install

```bash
git clone https://github.com/your-org/synapse.git
cd synapse
make install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
```

### 3. Start development servers

```bash
make dev
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

### 4. Seed demo data

```bash
make demo-reset
# Or: open http://localhost:5173, log in, Settings → Reset to Demo State
```

### 5. Log in

```
Email:    aarav@synapse.demo
Password: synapse2025
```

---

## Demo Data

The demo user is **Aarav Shah**, a 24-year-old software engineer in Delhi.

120 days of deterministic synthetic data (`SEED=42`) with three story arcs:

| Arc | Days | Story |
|-----|------|-------|
| Illness episode | 28–42 | HRV drops, RHR spikes, sleep degrades — 36h precursor visible |
| Running arc | 60–95 | Morning runs begin → RHR drops 4 bpm, sleep improves, mood rises |
| Migraine pattern | 100–115 | Each migraine preceded by <6h sleep + >200min screen time |

---

## Key Features

### Claude Intelligence Layer
- **Daily Brief** — narrative summary of the day's health state
- **Causal Cascade** — explains what triggered a health event, with precursor timeline
- **Pattern Discovery** — lead-lag behavioral patterns over 120 days
- **Whispers** — proactive unsolicited health nudges ranked by urgency
- **Symptom Triage** — red-flag detection with emergency routing
- **What-If Simulator** — projects effects of lifestyle interventions
- **Doctor Prep** — clinical brief + downloadable PDF for physician visits
- **Meal Vision** — photo → macros + AI nutrition coaching
- **Voice Notes** — audio → transcript → health signal extraction
- **Lab Interpreter** — PDF → structured flags + plain-language summary

### ML Module (pure Python, no sklearn)
- Per-metric rolling baselines (30/60/90-day windows, P10/P90)
- IsolationForest anomaly detection approximation
- Lead-lag Pearson correlation for pattern candidate generation

### Records System
- Symptoms, Medications, Lab Results, Meals, Voice Notes
- Goals, Habits, Doctor Visits
- Care Circle with per-member data sharing controls

---

## Project Structure

```
synapse/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers (42 endpoints)
│   │   ├── intelligence/ # Claude prompt modules (10 types)
│   │   ├── ml/           # Baselines, anomaly, correlation
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── services/     # Seed + synthetic data
│   │   └── main.py
│   ├── tests/            # pytest (29 tests, 100% green)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # 16 pages (all wired)
│   │   ├── components/   # Shell, Sidebar, Card, Toaster
│   │   ├── lib/          # api.ts, utils, toast, types
│   │   └── store/        # Zustand auth store
│   └── tests/e2e/        # Playwright (13 E2E scenarios)
├── Makefile
├── docker-compose.yml
├── render.yaml           # Render backend deploy
├── vercel.json           # Vercel frontend deploy
├── DEMO_SCRIPT.md        # 5-minute judge walkthrough
└── PROMPTS.md            # All 10 Claude prompt templates
```

---

## Running Tests

```bash
# Backend (pytest, 29 tests)
make test

# Frontend E2E (Playwright, 13 scenarios)
# Requires: both servers running
make test-e2e

# Both
make test-all
```

---

## Deployment

### Backend → Render

```bash
# Install Render CLI, then:
render deploy
# Or push to GitHub and connect via Render dashboard
# render.yaml is pre-configured
```

### Frontend → Vercel

```bash
vercel deploy
# vercel.json routes SPA correctly
# Set VITE_API_URL env var to your Render backend URL
```

---

## Safety & Ethics

Every Claude output includes:
> *"This output is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making health decisions."*

The symptom triage system is tuned to be **conservative** — it routes to emergency services for any ambiguous high-acuity symptom. Synapse is a decision-support tool, not a diagnostic device.

---

## License

MIT — see LICENSE file.
