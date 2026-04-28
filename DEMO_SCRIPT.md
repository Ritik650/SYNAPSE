# Synapse — 5-Minute Demo Script

> **Audience:** Hackathon judges, potential investors, doctors  
> **Setup:** Backend on `:8000`, frontend on `:5173` (or live URL). Demo data pre-seeded via `make demo-reset`.

---

## Before You Start (30 seconds)

1. Run `make demo-reset` — seeds 120 days of Aarav Shah's data in < 5 seconds
2. Open `http://localhost:5173` in Chrome
3. Log in: `aarav@synapse.demo` / `synapse2025`

---

## Minute 1 — The Dashboard Story

**Say:** "This is Aarav, a 24-year-old software engineer in Delhi. He's been tracking his health for 120 days. Synapse has built a complete picture of his health — let me show you what Claude can do with that."

**Show:**
- The **Health Score ring** — currently around 72 (post-illness recovery)
- The **score sparkline** showing the illness dip (days 35-42) and the running arc improvement
- The **Daily Brief card** — one paragraph narrative from Claude summarizing Aarav's state
- The **Whisper feed** — 3 proactive nudges Claude generated without being asked

**Hit:** "Notice Claude doesn't just dump numbers — it tells a coherent story. This brief took 2.3 seconds."

---

## Minute 2 — Time Machine + Causal Cascade

**Navigate to:** `/timeline`

**Say:** "Now watch this. I'm going to show you the 120-day multi-metric view and then click into the illness event."

**Show:**
- Scroll the date range toggle to **120 days** — all metrics appear
- Point to the **trough around Feb 5** where HRV drops and RHR spikes simultaneously
- Click the **illness event reference line** — the Causal Cascade Modal opens

**Say:** "Claude analyzed what happened here. It detected a 36-hour precursor window: screen time spiked, HRV started dropping, sleep shortened. This is the kind of pattern that would take a doctor an hour to spot in a chart review. Claude did it in 4 seconds."

---

## Minute 3 — Patterns + Whispers

**Navigate to:** `/patterns`

**Say:** "Synapse runs a pattern discovery job over Aarav's entire history. These are causal chains Claude found."

**Show:**
- Expand the **"Screen Time → Sleep"** pattern card — antecedent/consequent flow diagram
- Show the **confidence bar** and correlation strength
- Click **Refresh Patterns** — Claude re-runs the analysis live

**Navigate to:** `/whispers`

**Say:** "Whispers are proactive micro-insights. They're not triggered by the user — Claude generates them on a schedule, ranked by clinical urgency."

**Show:**
- Filter by **urgent** — one whisper about the migraine pattern (screen time + sleep < 6h)
- Open the evidence table showing z-scores for each data point
- Give thumbs up — "The feedback loop retrains which whispers surface first"

---

## Minute 4 — Body Twin + Records

**Navigate to:** `/body`

**Say:** "The Body Twin gives a system-level view. Each ring is a body system scored from Claude's analysis."

**Show:**
- The 6 animated SVG rings — point to Cardiovascular recovering (post-illness)
- The Claude-generated one-liner per system
- The overall readiness bar

**Navigate to:** `/sleep`

**Say:** "Every record page has real data from wearables, analyzed by Claude."

**Show:**
- 90-day sleep duration AreaChart — the illness dip is clearly visible at week 5
- The efficiency chart — 85% reference line

**Navigate to:** `/symptoms`

**Show:**
- The **Symptom Triage Assistant** — type "sharp chest pain radiating to left arm"
- Hit Triage — Claude returns a red-flag emergency response in < 3 seconds
- "This is the safety layer. Claude always tells you when to see a real doctor."

---

## Minute 5 — Doctor Mode + Demo Reset

**Navigate to:** `/doctor`

**Say:** "This is the feature doctors actually ask for. A structured clinical brief they can read in 90 seconds before the appointment."

**Show:**
- Type: "Annual check-up — concerned about recurring fatigue and elevated resting heart rate"
- Hit **Generate Doctor Brief**
- Watch Claude return: executive summary, key metrics table, flagged labs, top 5 questions
- Click **Download PDF** — a professional-looking A4 PDF downloads instantly

**Say:** "The patient walks in with this. The doctor has everything: HRV trends, lab flags, active symptoms, and Claude's suggested diagnostic questions. All in 90 seconds."

**Final beat:**
- Navigate to `/settings`
- Hit **Reset to Demo State**
- "And if you want to run the demo again for the next judge — one button, five seconds."

---

## Key Numbers to Mention

| Metric | Value |
|--------|-------|
| Daily Brief generation | < 3 seconds |
| Cascade explanation | < 4 seconds |
| Symptom triage | < 3 seconds |
| Doctor prep report | < 8 seconds |
| Demo reset | < 5 seconds |
| 120-day synthetic dataset | 8,400+ data points |
| API endpoints | 42 |
| Claude calls per session | ~6 |

---

## Q&A Prep

**"Is this real data?"**  
"The demo uses synthetic data — a medically realistic 120-day simulation of a real patient journey with three distinct story arcs. The AI analysis is 100% real Claude calls."

**"What makes this different from other health apps?"**  
"Most apps show dashboards. Synapse tells stories. Every number is connected to a narrative, every pattern is explained, every anomaly generates a whisper. Claude is the engine, not a chatbot bolted on top."

**"How do you handle privacy?"**  
"All processing is local — no health data leaves the device without explicit consent. The Care Circle feature gives the patient full control over what each person can see."

**"What's the revenue model?"**  
"B2C subscription for individuals, B2B API licensing for clinics who want to offer patients a pre-visit intelligence layer."
