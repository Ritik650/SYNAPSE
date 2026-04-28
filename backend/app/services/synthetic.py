"""
Synapse Synthetic Data Generator
120 days of correlated health data for demo user Aarav Shah (24M, Delhi).
Deterministic with SEED=42.

Story arcs:
  Arc 1 (Days 28–42): Illness episode — precursors, onset, recovery
  Arc 2 (Days 60–95): Morning runs → RHR drops 4 bpm, sleep improves, mood rises
  Arc 3 (Days 100–115): Migraine pattern — each preceded 36–48h by <6h sleep
                         + >200 min screen time + high calendar density
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np

SEED = 42
BASE_DATE = datetime(2025, 12, 30, 0, 0, 0, tzinfo=timezone.utc)
N_DAYS = 120
DEMO_EMAIL = "aarav@synapse.demo"

# ─── helpers ─────────────────────────────────────────────────────────────────

def _uid() -> str:
    return str(uuid.uuid4())

def _ts(day: int, hour: int = 0, minute: int = 0) -> str:
    return (BASE_DATE + timedelta(days=day, hours=hour, minutes=minute)).isoformat()

def _date(day: int) -> datetime:
    return BASE_DATE + timedelta(days=day)


# ─── exact per-day overrides for story-critical days ─────────────────────────

_OVERRIDES: dict[int, dict] = {
    # Arc 1: pre-illness sleep degradation & calendar stress
    28: {"sleep_min": 330, "screen_min": 195, "stress": 6.5, "mood": 5.5, "n_meetings": 4},
    29: {"sleep_min": 306, "screen_min": 215, "stress": 7.0, "mood": 5.0, "n_meetings": 5},
    30: {"sleep_min": 288, "screen_min": 225, "stress": 7.5, "mood": 4.5, "n_meetings": 5},
    # Arc 1: illness prodrome (RHR/HRV degradation begins)
    31: {"sleep_min": 270, "rhr": 65, "hrv": 47, "stress": 8.0, "mood": 4.0, "energy": 4.0, "n_meetings": 4},
    32: {"sleep_min": 252, "rhr": 66, "hrv": 45, "stress": 8.5, "mood": 3.5, "energy": 3.5, "n_meetings": 5},
    33: {"sleep_min": 240, "rhr": 67, "hrv": 43, "stress": 9.0, "mood": 3.0, "energy": 3.0, "n_meetings": 4},
    34: {"sleep_min": 228, "rhr": 68, "hrv": 41, "stress": 9.0, "mood": 2.5, "energy": 2.5, "n_meetings": 3},
    # Arc 1: active illness
    35: {"sleep_min": 378, "rhr": 72, "hrv": 32, "steps": 480,  "mood": 2.0, "energy": 1.5, "stress": 8.0, "sleep_eff": 62, "ill": True},
    36: {"sleep_min": 396, "rhr": 71, "hrv": 34, "steps": 600,  "mood": 2.0, "energy": 1.5, "stress": 7.5, "sleep_eff": 63, "ill": True},
    37: {"sleep_min": 390, "rhr": 70, "hrv": 36, "steps": 900,  "mood": 2.5, "energy": 2.0, "stress": 7.0, "sleep_eff": 65, "ill": True},
    38: {"sleep_min": 420, "rhr": 69, "hrv": 39, "steps": 1200, "mood": 2.5, "energy": 2.5, "stress": 6.5, "sleep_eff": 68, "ill": True},
    39: {"sleep_min": 432, "rhr": 67, "hrv": 42, "steps": 2000, "mood": 3.0, "energy": 3.0, "stress": 6.0, "sleep_eff": 70, "ill": True},
    40: {"sleep_min": 420, "rhr": 65, "hrv": 45, "steps": 3000, "mood": 3.5, "energy": 3.5, "stress": 5.5, "sleep_eff": 72, "ill": True},
    41: {"sleep_min": 430, "rhr": 63, "hrv": 48, "steps": 4000, "mood": 4.0, "energy": 4.0, "stress": 5.0, "sleep_eff": 74, "ill": True},
    42: {"sleep_min": 435, "rhr": 62, "hrv": 50, "steps": 5000, "mood": 4.5, "energy": 4.5, "stress": 5.0, "sleep_eff": 75},
    # Arc 3: migraine 1 precursors (exactly 36–48h before Day 102)
    100: {"sleep_min": 312, "screen_min": 248, "stress": 7.0, "mood": 5.5, "energy": 5.0, "n_meetings": 4},
    101: {"sleep_min": 324, "screen_min": 228, "stress": 6.5, "mood": 5.8, "energy": 5.5, "n_meetings": 3},
    102: {"sleep_min": 238, "steps": 790,  "mood": 2.0, "energy": 1.5, "stress": 7.5, "screen_min": 38, "migraine": True},
    # Arc 3: migraine 2 precursors
    106: {"sleep_min": 285, "screen_min": 268, "stress": 7.5, "mood": 5.5, "energy": 5.0, "n_meetings": 5},
    107: {"sleep_min": 304, "screen_min": 218, "stress": 7.0, "mood": 5.8, "energy": 5.5, "n_meetings": 3},
    108: {"sleep_min": 208, "steps": 680,  "mood": 1.5, "energy": 1.0, "stress": 8.0, "screen_min": 28, "migraine": True},
    # Arc 3: migraine 3 precursors
    112: {"sleep_min": 298, "screen_min": 258, "stress": 7.5, "mood": 5.5, "energy": 5.0, "n_meetings": 4},
    113: {"sleep_min": 345, "screen_min": 228, "stress": 7.0, "mood": 5.5, "energy": 5.5, "n_meetings": 4},
    114: {"sleep_min": 218, "steps": 870,  "mood": 2.0, "energy": 1.5, "stress": 7.5, "screen_min": 32, "migraine": True},
}

_MIGRAINE_DAYS = {102, 108, 114}
_ILLNESS_DAYS = {35, 36, 37, 38, 39, 40, 41}


# ─── per-day state ────────────────────────────────────────────────────────────

def _build_state(day: int, rng: np.random.Generator) -> dict:
    d = _date(day)
    dow = d.weekday()          # 0=Mon … 6=Sun
    is_weekend = dow >= 5

    # Arc 2: running fitness curve
    run_prog = float(np.clip((day - 60) / 35, 0, 1)) if day >= 60 else 0.0
    rhr_base      = 62.0 - 4.0  * run_prog
    hrv_base      = 55.0 + 8.0  * run_prog
    sleep_eff_base= 78.0 + 6.0  * run_prog
    mood_base     = 6.5  + 1.0  * run_prog
    energy_base   = 6.5  + 1.5  * run_prog
    steps_base    = (8000 + 4000 * run_prog) if not is_weekend else (6500 + 2000 * run_prog)

    # Arc 1: illness recovery tail (days 43–52)
    if 43 <= day <= 52:
        p = (day - 43) / 10.0
        rhr_base   += 4.0 * (1 - p)
        hrv_base   -= 8.0 * (1 - p)
        steps_base *= 0.5 + 0.5 * p
        mood_base  -= 1.5 * (1 - p)
        energy_base-= 2.0 * (1 - p)

    sleep_min = 432 + rng.normal(0, 28)
    if is_weekend:
        sleep_min += 30
    screen_min = 150 + rng.normal(0, 28)
    if is_weekend:
        screen_min += 35

    n_meetings = int(rng.integers(0, 2)) if is_weekend else int(rng.integers(2, 5))

    # Delhi environment
    base_aqi  = 185 - (day / N_DAYS) * 125
    base_temp = 12  + (day / N_DAYS) * 26

    state: dict = {
        "day":         day,
        "date":        d,
        "dow":         dow,
        "is_weekend":  is_weekend,
        "rhr":         rhr_base      + rng.normal(0, 1.2),
        "hrv":         hrv_base      + rng.normal(0, 4.0),
        "sleep_min":   sleep_min,
        "sleep_eff":   sleep_eff_base + rng.normal(0, 3.0),
        "steps":       int(steps_base * (1 + rng.normal(0, 0.18))),
        "screen_min":  screen_min,
        "mood":        mood_base     + rng.normal(0, 0.7),
        "stress":      4.0 + rng.normal(0, 1.0) + (0.8 if not is_weekend else -0.5),
        "energy":      energy_base   + rng.normal(0, 0.6),
        "n_meetings":  n_meetings,
        "ill":         False,
        "migraine":    False,
        "is_run_day":  False,
        "aqi":         float(np.clip(base_aqi  + rng.normal(0, 18), 25, 260)),
        "temp_c":      float(base_temp + rng.normal(0, 2.5)),
        "weight":      None,
    }

    # Apply story-arc overrides
    if day in _OVERRIDES:
        for k, v in _OVERRIDES[day].items():
            state[k] = v

    # Run days (Arc 2)
    if day >= 60 and not state["migraine"] and not state["ill"]:
        if dow < 5:
            state["is_run_day"] = rng.random() > 0.15
        elif dow == 5:
            state["is_run_day"] = rng.random() > 0.30
        else:
            state["is_run_day"] = rng.random() > 0.55

    # Weight every 4 days
    if day % 4 == 0:
        state["weight"] = float(68.5 - run_prog * 1.5 + rng.normal(0, 0.35))

    # Clamp
    state["rhr"]       = float(np.clip(state["rhr"],       45,  110))
    state["hrv"]       = float(np.clip(state["hrv"],       12,  120))
    state["sleep_min"] = float(np.clip(state["sleep_min"], 90,  600))
    state["sleep_eff"] = float(np.clip(state["sleep_eff"], 45,   99))
    state["steps"]     = int  (np.clip(state["steps"],    100, 30000))
    state["screen_min"]= float(np.clip(state.get("screen_min", 150), 0, 480))
    state["mood"]      = float(np.clip(state["mood"],       1,   10))
    state["stress"]    = float(np.clip(state["stress"],     1,   10))
    state["energy"]    = float(np.clip(state["energy"],     1,   10))
    state["n_meetings"]= int  (np.clip(state["n_meetings"], 0,   10))

    return state


# ─── metric generators ────────────────────────────────────────────────────────

def _sleep_breakdown(total_min: float, eff: float, rng: np.random.Generator) -> dict:
    awake = total_min * (1 - eff / 100)
    sleep = total_min - awake
    deep  = sleep * (0.18 + rng.normal(0, 0.03))
    rem   = sleep * (0.22 + rng.normal(0, 0.03))
    light = sleep - deep - rem
    return {
        "deep":  max(0.0, round(deep,  1)),
        "rem":   max(0.0, round(rem,   1)),
        "light": max(0.0, round(light, 1)),
        "awake": max(0.0, round(awake, 1)),
    }


def _day_metrics(day: int, state: dict, rng: np.random.Generator, user_id: str) -> list[dict]:
    rows = []
    ill     = state["ill"]
    migraine= state["migraine"]
    is_run  = state["is_run_day"]

    def row(metric_type, value, hour=6, minute=0, unit="", source="fitbit", confidence=0.95):
        return {
            "id": _uid(), "user_id": user_id,
            "ts": _ts(day, hour, minute),
            "metric_type": metric_type,
            "value": round(float(value), 2),
            "unit": unit, "source": source, "confidence": confidence,
        }

    # ── Morning vitals (6 am) ─────────────────────────────────────────────
    rows.append(row("rhr",       state["rhr"],     unit="bpm"))
    rows.append(row("hrv_rmssd", state["hrv"],     unit="ms"))
    rows.append(row("spo2",      float(np.clip(97.5 + rng.normal(0, 0.5) - (2 if ill else 0), 92, 100)), unit="%"))

    # ── Sleep (logged at 6 am for previous night) ─────────────────────────
    bd = _sleep_breakdown(state["sleep_min"], state["sleep_eff"], rng)
    rows.append(row("sleep_duration_min", state["sleep_min"],  unit="min"))
    rows.append(row("sleep_efficiency",   state["sleep_eff"],  unit="%"))
    rows.append(row("deep_sleep_min",     bd["deep"],           unit="min"))
    rows.append(row("rem_sleep_min",      bd["rem"],            unit="min"))
    rows.append(row("light_sleep_min",    bd["light"],          unit="min"))
    rows.append(row("awake_min",          bd["awake"],          unit="min"))
    rows.append(row("sleep_score",
                    float(np.clip(state["sleep_eff"] * 0.5 + (state["sleep_min"] / 480) * 50, 30, 100)),
                    unit="/100"))

    # ── Intraday HR (every 2 hours) ───────────────────────────────────────
    rhr = state["rhr"]
    for h_idx in range(12):
        hour = h_idx * 2
        if hour < 6:
            base = rhr - 6 + rng.normal(0, 2)    # sleep
        elif hour < 8:
            base = rhr + 4 + rng.normal(0, 3)    # waking
        elif hour < 12:
            base = rhr + 14 + rng.normal(0, 4)   # active morning
        elif hour < 14:
            base = rhr + 10 + rng.normal(0, 3)   # post-lunch
        elif hour < 18:
            base = rhr + 16 + rng.normal(0, 4)   # afternoon peak
        elif hour < 21:
            base = rhr + 10 + rng.normal(0, 3)   # evening
        else:
            base = rhr + 3  + rng.normal(0, 2)   # winding down

        # Run peak at 6 am
        if is_run and hour == 6:
            base = 148 + rng.normal(0, 8)

        if ill:
            base += 12 + rng.normal(0, 3)
        if migraine:
            base += 8  + rng.normal(0, 3)

        rows.append(row("hr", np.clip(base, 38, 200), hour=hour, unit="bpm"))

    # ── Activity (end of day) ─────────────────────────────────────────────
    rows.append(row("steps",          state["steps"],              hour=22, unit=""))
    rows.append(row("active_minutes", max(5, state["steps"] // 100), hour=22, unit="min"))
    rows.append(row("calories_active",
                    float(np.clip(state["steps"] * 0.06 + rng.normal(0, 20), 60, 900)),
                    hour=22, unit="kcal"))
    rows.append(row("screen_time_min", state["screen_min"],        hour=22, unit="min"))

    # ── Mental (evening) ──────────────────────────────────────────────────
    rows.append(row("mood_self",   state["mood"],   hour=20, unit="/10", source="manual", confidence=1.0))
    rows.append(row("stress_self", state["stress"], hour=20, unit="/10", source="manual", confidence=1.0))
    rows.append(row("energy_self", state["energy"], hour=20, unit="/10", source="manual", confidence=1.0))

    # ── Environment (morning) ─────────────────────────────────────────────
    rows.append(row("aqi",         state["aqi"],    hour=8, unit="",  source="derived", confidence=0.9))
    rows.append(row("weather_temp",state["temp_c"], hour=8, unit="°C",source="derived", confidence=0.9))

    # ── Weight (every 4 days) ─────────────────────────────────────────────
    if state["weight"] is not None:
        rows.append(row("weight", state["weight"], hour=7, unit="kg", source="manual", confidence=1.0))

    return rows


# ─── event generators ─────────────────────────────────────────────────────────

_CALENDAR_TITLES = [
    "Team standup", "Project sync", "Study group", "Lecture", "Lab session",
    "Tutorial", "Office hours", "Seminar", "Peer review", "Assignment review",
    "Club meeting", "Group project", "Mock interview", "Career counselling",
]

def _day_events(day: int, state: dict, rng: np.random.Generator, user_id: str) -> list[dict]:
    events = []
    dow = state["dow"]

    def ev(event_type, title, hour=9, minute=0, description="", metadata=None):
        return {
            "id": _uid(), "user_id": user_id,
            "ts": _ts(day, hour, minute),
            "event_type": event_type,
            "title": title,
            "description": description,
            "metadata_json": json.dumps(metadata) if metadata else None,
        }

    # ── Calendar events (weekdays only) ──────────────────────────────────
    if not state["is_weekend"]:
        titles = rng.choice(_CALENDAR_TITLES, size=state["n_meetings"], replace=False)
        hours  = sorted(rng.integers(9, 18, size=state["n_meetings"]).tolist())
        for title, hour in zip(titles, hours):
            events.append(ev("calendar_event", str(title), hour=int(hour),
                             metadata={"duration_min": 60, "type": "academic"}))

    # ── Workouts (Arc 2) ──────────────────────────────────────────────────
    if state["is_run_day"]:
        distance = round(float(4.5 + rng.normal(0, 0.6)), 1)
        pace     = round(float(5.6 + rng.normal(0, 0.3)), 1)
        events.append(ev("workout", f"Morning run — {distance}km",
                          hour=6, minute=15,
                          description=f"{distance}km easy run, {distance*pace:.0f} min total",
                          metadata={"distance_km": distance, "duration_min": round(distance*pace),
                                    "avg_hr": 148, "type": "morning_run"}))

    # ── Illness events (Arc 1) ────────────────────────────────────────────
    if day == 35:
        events.append(ev("illness_onset", "Viral fever onset",
                          hour=8,
                          description="Sudden fever, sore throat, body aches. Started feeling unwell last night.",
                          metadata={"symptoms": ["fever", "sore_throat", "body_ache", "headache"],
                                    "temperature_c": 38.4}))
    if day == 42:
        events.append(ev("illness_resolve", "Recovered from viral fever",
                          hour=10,
                          description="Feeling significantly better. 8-day illness episode.",
                          metadata={"illness_duration_days": 8}))

    # ── Migraine events (Arc 3) ───────────────────────────────────────────
    migraine_hours = {102: 9, 108: 8, 114: 10}
    if day in _MIGRAINE_DAYS:
        events.append(ev("symptom", "Migraine headache",
                          hour=migraine_hours[day],
                          description="Severe bilateral temporal headache, photophobia, nausea. Preceded by poor sleep.",
                          metadata={"severity": 8, "location": "bilateral_temporal",
                                    "triggers_suspected": ["sleep_deprivation", "screen_time", "stress"],
                                    "type": "migraine"}))

    # ── Meal events (every day, 3 times) ─────────────────────────────────
    if not state["migraine"]:
        events.append(ev("meal", "Breakfast", hour=8, minute=30,
                         description="Morning meal", metadata={"type": "breakfast"}))
        events.append(ev("meal", "Lunch", hour=13, minute=0,
                         description="Afternoon meal", metadata={"type": "lunch"}))
        if not state["ill"]:
            events.append(ev("meal", "Dinner", hour=20, minute=0,
                             description="Evening meal", metadata={"type": "dinner"}))

    return events


# ─── medications ─────────────────────────────────────────────────────────────

def _medications(user_id: str) -> list[dict]:
    return [
        {"id": _uid(), "user_id": user_id, "name": "Vitamin D3",    "dose": 1000, "unit": "IU",
         "frequency": "daily", "start_date": _ts(0)[:10], "end_date": None,
         "prescribed_by": "Dr. Mehta", "notes": "For documented Vitamin D insufficiency"},
        {"id": _uid(), "user_id": user_id, "name": "Cetirizine",    "dose": 10,   "unit": "mg",
         "frequency": "daily", "start_date": _ts(0)[:10], "end_date": _ts(45)[:10],
         "prescribed_by": "Dr. Mehta", "notes": "Seasonal hay fever"},
        {"id": _uid(), "user_id": user_id, "name": "Ibuprofen",     "dose": 400,  "unit": "mg",
         "frequency": "as needed", "start_date": _ts(35)[:10], "end_date": _ts(42)[:10],
         "prescribed_by": None, "notes": "Fever and body ache during illness"},
        {"id": _uid(), "user_id": user_id, "name": "Sumatriptan",   "dose": 50,   "unit": "mg",
         "frequency": "as needed", "start_date": _ts(102)[:10], "end_date": None,
         "prescribed_by": "Dr. Mehta", "notes": "Acute migraine treatment"},
        {"id": _uid(), "user_id": user_id, "name": "Cetirizine",    "dose": 10,   "unit": "mg",
         "frequency": "daily", "start_date": _ts(90)[:10], "end_date": None,
         "prescribed_by": "Dr. Mehta", "notes": "Spring pollen season"},
    ]


def _medication_doses(states: list[dict], meds: list[dict], rng: np.random.Generator, user_id: str) -> list[dict]:
    doses = []
    vit_d_id  = meds[0]["id"]
    cet1_id   = meds[1]["id"]
    ibu_id    = meds[2]["id"]
    suma_id   = meds[3]["id"]
    cet2_id   = meds[4]["id"]

    for state in states:
        day = state["day"]
        # Vitamin D: daily, 95% adherence
        if rng.random() < 0.95:
            doses.append({"id": _uid(), "medication_id": vit_d_id,
                          "scheduled_at": _ts(day, 9), "taken_at": _ts(day, 9),
                          "skipped_reason": None})
        else:
            doses.append({"id": _uid(), "medication_id": vit_d_id,
                          "scheduled_at": _ts(day, 9), "taken_at": None,
                          "skipped_reason": "Forgot"})

        # Cetirizine 1: days 0–45
        if day <= 45:
            if rng.random() < 0.90:
                doses.append({"id": _uid(), "medication_id": cet1_id,
                              "scheduled_at": _ts(day, 21), "taken_at": _ts(day, 21),
                              "skipped_reason": None})

        # Ibuprofen: illness days (as needed, ~2x/day)
        if day in _ILLNESS_DAYS:
            for take_hour in [9, 18]:
                if rng.random() < 0.85:
                    doses.append({"id": _uid(), "medication_id": ibu_id,
                                  "scheduled_at": _ts(day, take_hour), "taken_at": _ts(day, take_hour),
                                  "skipped_reason": None})

        # Sumatriptan: migraine days
        if day in _MIGRAINE_DAYS:
            doses.append({"id": _uid(), "medication_id": suma_id,
                          "scheduled_at": _ts(day, 10), "taken_at": _ts(day, 10, 15),
                          "skipped_reason": None})

        # Cetirizine 2: days 90–120
        if day >= 90:
            if rng.random() < 0.90:
                doses.append({"id": _uid(), "medication_id": cet2_id,
                              "scheduled_at": _ts(day, 21), "taken_at": _ts(day, 21),
                              "skipped_reason": None})

    return doses


# ─── symptoms ─────────────────────────────────────────────────────────────────

def _symptoms(states: list[dict], user_id: str) -> list[dict]:
    syms = []

    def sym(name, severity, started_day, started_hour=9, resolved_day=None, body_region=None, notes=""):
        return {
            "id": _uid(), "user_id": user_id,
            "name": name, "severity": severity,
            "started_at": _ts(started_day, started_hour),
            "resolved_at": _ts(resolved_day, 18) if resolved_day else None,
            "body_region": body_region, "notes": notes,
        }

    syms.append(sym("Sore throat",    6, 33, resolved_day=40, body_region="throat",
                    notes="Worsened by Day 35, gradually better"))
    syms.append(sym("Fever",          7, 35, resolved_day=39, body_region="systemic",
                    notes="Peak 38.4°C on Day 35–36"))
    syms.append(sym("Body ache",      5, 35, resolved_day=40, body_region="musculoskeletal"))
    syms.append(sym("Headache",       4, 33, resolved_day=41, body_region="head"))
    syms.append(sym("Fatigue",        6, 35, resolved_day=43, body_region="systemic",
                    notes="Lingering for a week post-fever"))
    syms.append(sym("Migraine",       8, 102, started_hour=9, resolved_day=103, body_region="head",
                    notes="Bilateral temporal, photophobia, nausea. 3rd episode this quarter."))
    syms.append(sym("Migraine",       8, 108, started_hour=8, resolved_day=109, body_region="head",
                    notes="Again after two nights of <6h sleep and late screen time."))
    syms.append(sym("Migraine",       8, 114, started_hour=10, resolved_day=115, body_region="head",
                    notes="Pattern very clear now — short sleep + screen bingeing the two nights before."))

    return syms


# ─── lab results ─────────────────────────────────────────────────────────────

def _lab_results_and_values(user_id: str) -> tuple[list[dict], list[dict]]:
    results, values = [], []

    # ── Lab 1: CBC — Day 15 ───────────────────────────────────────────────
    cbc_id = _uid()
    results.append({
        "id": cbc_id, "user_id": user_id,
        "panel_name": "Complete Blood Count (CBC)",
        "drawn_at": _ts(15, 7),
        "source_pdf_url": "/uploads/labs/cbc_jan2026.pdf",
        "claude_summary": (
            "Your CBC results look healthy overall. Hemoglobin at 14.2 g/dL is well within range "
            "for a young male. White cell count and platelets are normal, suggesting no active infection "
            "at the time of the draw. No flags to discuss with your physician. "
            "\n\n---\n*Synapse is informational only and is not a medical device. "
            "Always consult a licensed clinician for medical decisions.*"
        ),
        "flags_json": json.dumps([]),
    })
    for marker, val, unit, lo, hi, flag in [
        ("Hemoglobin",   14.2, "g/dL",      13.0, 17.0, "normal"),
        ("WBC",           7.5, "×10³/μL",    4.5,  11.0, "normal"),
        ("Platelets",     285, "×10³/μL",  150.0, 400.0, "normal"),
        ("RBC",           5.1, "M/μL",       4.5,   5.9, "normal"),
        ("Hematocrit",   42.5, "%",          40.0,  52.0, "normal"),
        ("MCV",          88.0, "fL",         80.0,  100.0,"normal"),
    ]:
        values.append({"id": _uid(), "lab_result_id": cbc_id,
                       "marker": marker, "value": val, "unit": unit,
                       "ref_low": lo, "ref_high": hi, "flag": flag})

    # ── Lab 2: Lipid Panel — Day 55 ──────────────────────────────────────
    lipid_id = _uid()
    results.append({
        "id": lipid_id, "user_id": user_id,
        "panel_name": "Lipid Panel + Fasting Glucose",
        "drawn_at": _ts(55, 7),
        "source_pdf_url": "/uploads/labs/lipid_feb2026.pdf",
        "claude_summary": (
            "Two values deserve attention. Your LDL at 128 mg/dL sits in the borderline-high range "
            "(optimal is below 100 for most young adults). Your fasting glucose at 104 mg/dL is just "
            "above the normal ceiling of 100 — worth monitoring given that sleep deprivation in the "
            "preceding 2 weeks averaged only 5.4h/night, which can transiently elevate fasting glucose "
            "by 5–10%. HDL at 45 is slightly below the ideal ≥50 for males. Recommend discussing "
            "dietary adjustments and a repeat panel in 6 months with your physician. "
            "\n\n---\n*Synapse is informational only and is not a medical device. "
            "Always consult a licensed clinician for medical decisions.*"
        ),
        "flags_json": json.dumps(["LDL", "Fasting Glucose", "HDL"]),
    })
    for marker, val, unit, lo, hi, flag in [
        ("Total Cholesterol", 195, "mg/dL", None, 200.0, "normal"),
        ("LDL",               128, "mg/dL", None, 100.0, "high"),
        ("HDL",                45, "mg/dL", 50.0, None,  "low"),
        ("Triglycerides",     145, "mg/dL", None, 150.0, "normal"),
        ("Fasting Glucose",   104, "mg/dL", 70.0, 100.0, "high"),
    ]:
        values.append({"id": _uid(), "lab_result_id": lipid_id,
                       "marker": marker, "value": val, "unit": unit,
                       "ref_low": lo, "ref_high": hi, "flag": flag})

    # ── Lab 3: Thyroid + Vitamin D — Day 100 ─────────────────────────────
    thyroid_id = _uid()
    results.append({
        "id": thyroid_id, "user_id": user_id,
        "panel_name": "Thyroid Function + Vitamin D",
        "drawn_at": _ts(100, 7),
        "source_pdf_url": "/uploads/labs/thyroid_apr2026.pdf",
        "claude_summary": (
            "Thyroid function (TSH and Free T4) is completely normal — no signs of hypo- or hyperthyroidism. "
            "However, your Vitamin D at 22 ng/mL remains in the 'insufficient' range (optimal is ≥30 ng/mL). "
            "Despite daily supplementation, your levels haven't fully recovered yet — this is common with "
            "indoor lifestyles in Delhi winters. Continue Vitamin D3 supplementation; the improving AQI "
            "and warmer weather may help increase outdoor sun exposure. "
            "\n\n---\n*Synapse is informational only and is not a medical device. "
            "Always consult a licensed clinician for medical decisions.*"
        ),
        "flags_json": json.dumps(["Vitamin D 25-OH"]),
    })
    for marker, val, unit, lo, hi, flag in [
        ("TSH",             2.8, "mIU/L",  0.4,  4.0,  "normal"),
        ("Free T4",         1.1, "ng/dL",  0.8,  1.8,  "normal"),
        ("Vitamin D 25-OH", 22,  "ng/mL", 30.0, 100.0, "low"),
        ("Hemoglobin",      14.8,"g/dL",  13.0,  17.0, "normal"),
    ]:
        values.append({"id": _uid(), "lab_result_id": thyroid_id,
                       "marker": marker, "value": val, "unit": unit,
                       "ref_low": lo, "ref_high": hi, "flag": flag})

    return results, values


# ─── meals ───────────────────────────────────────────────────────────────────

_MEAL_DATA = [
    (3,  "Poha (breakfast)", 8, {
        "items_identified": ["poha (flattened rice)", "peanuts", "curry leaves", "mustard seeds", "green chili", "onion"],
        "estimated_portion": "1 medium bowl (~250g)",
        "macros": {"calories": 320, "protein_g": 8, "carbs_g": 58, "fat_g": 7, "fiber_g": 4},
        "glycemic_load_estimate": "moderate",
        "what_is_great": "Good carb source for morning energy. Peanuts add healthy fat and protein. Iron-rich.",
        "what_is_missing": "Could use more protein — add a boiled egg or curd alongside.",
        "hydration_suggestion": "Pair with a glass of water or nimbu pani.",
        "next_meal_balance": "Aim for protein-forward at lunch — dal, paneer, or eggs.",
    }),
    (18, "Paneer salad (lunch)", 13, {
        "items_identified": ["mixed greens", "grilled paneer cubes", "cucumber", "tomato", "lemon dressing"],
        "estimated_portion": "Large bowl (~350g)",
        "macros": {"calories": 380, "protein_g": 18, "carbs_g": 22, "fat_g": 20, "fiber_g": 6},
        "glycemic_load_estimate": "low",
        "what_is_great": "Excellent meal — high protein, good fiber, low glycemic load. Great midday fuel.",
        "what_is_missing": "Add some complex carbs — a small roti or quinoa would give sustained energy.",
        "hydration_suggestion": "Aim for 2 glasses of water in the next 2 hours.",
        "next_meal_balance": "Light dinner with carbs would balance the day well.",
    }),
    (45, "Dal khichdi (dinner)", 19, {
        "items_identified": ["yellow moong dal", "basmati rice", "ghee", "cumin", "turmeric", "ginger"],
        "estimated_portion": "1.5 cups (~340g)",
        "macros": {"calories": 290, "protein_g": 12, "carbs_g": 52, "fat_g": 6, "fiber_g": 5},
        "glycemic_load_estimate": "moderate",
        "what_is_great": "Easy-to-digest, gut-friendly meal ideal for recovery. Good protein-carb balance.",
        "what_is_missing": "Add a side of yogurt for probiotics and extra protein during your recovery phase.",
        "hydration_suggestion": "Soup or warm water alongside is great for recovery hydration.",
        "next_meal_balance": "This is a recovery-appropriate meal. Continue light eating tomorrow morning.",
    }),
    (58, "Chicken biryani (lunch)", 13, {
        "items_identified": ["basmati rice", "chicken (bone-in)", "fried onions", "whole spices", "saffron", "raita"],
        "estimated_portion": "2 cups rice + 150g chicken (~550g)",
        "macros": {"calories": 650, "protein_g": 32, "carbs_g": 82, "fat_g": 22, "fiber_g": 3},
        "glycemic_load_estimate": "high",
        "what_is_great": "Good protein from chicken. Spices (cardamom, bay leaf) are anti-inflammatory.",
        "what_is_missing": "Low fiber. The raita is great — could add a salad for greens.",
        "hydration_suggestion": "Drink water 30 min before and after, not during, to aid digestion.",
        "next_meal_balance": "Keep dinner light — vegetable soup or a small salad.",
    }),
    (67, "Oats with fruit (breakfast)", 7, {
        "items_identified": ["rolled oats", "banana", "mixed berries", "chia seeds", "almond milk", "honey"],
        "estimated_portion": "1 large bowl (~380g)",
        "macros": {"calories": 340, "protein_g": 9, "carbs_g": 62, "fat_g": 8, "fiber_g": 9},
        "glycemic_load_estimate": "low-moderate",
        "what_is_great": "Excellent fiber from oats and chia. Berries are rich in antioxidants. Low GI meal.",
        "what_is_missing": "Good as-is. Could add a scoop of protein powder for post-run recovery.",
        "hydration_suggestion": "Great start. Aim to drink 500ml of water in the next hour.",
        "next_meal_balance": "Good foundation. Ensure lunch is protein-rich for muscle recovery after your run.",
    }),
    (82, "Grilled chicken + sabzi (dinner)", 20, {
        "items_identified": ["grilled chicken breast", "bhindi sabzi (okra)", "1 roti", "curd"],
        "estimated_portion": "150g chicken + 1 cup sabzi + 1 roti (~420g)",
        "macros": {"calories": 445, "protein_g": 38, "carbs_g": 35, "fat_g": 12, "fiber_g": 6},
        "glycemic_load_estimate": "low",
        "what_is_great": "Ideal post-run recovery meal. High protein, good fiber, healthy fat from curd.",
        "what_is_missing": "Nothing significant. This is a well-balanced dinner.",
        "hydration_suggestion": "You've likely sweated during your run — aim for 500ml water before bed.",
        "next_meal_balance": "This sets you up well. Morning oats or eggs would complement nicely.",
    }),
    (95, "Idli sambar (breakfast)", 8, {
        "items_identified": ["steamed idli (4 pieces)", "sambar (lentil vegetable soup)", "coconut chutney", "tomato chutney"],
        "estimated_portion": "4 idlis + 1 cup sambar + 2 tbsp chutney (~380g)",
        "macros": {"calories": 380, "protein_g": 12, "carbs_g": 70, "fat_g": 7, "fiber_g": 8},
        "glycemic_load_estimate": "moderate",
        "what_is_great": "Fermented idli is gut-friendly and light. Sambar adds protein and fiber.",
        "what_is_missing": "Could add a boiled egg for more protein to sustain you through morning run.",
        "hydration_suggestion": "Have a large glass of water or fresh lime water alongside.",
        "next_meal_balance": "Protein-forward lunch recommended — you've had mostly carbs this morning.",
    }),
    (110, "Late-night pizza (dinner)", 23, {
        "items_identified": ["pizza (2 slices, pepperoni)", "garlic bread (2 pieces)", "cold drink (cola)"],
        "estimated_portion": "2 pizza slices + bread (~380g) + 300ml cola",
        "macros": {"calories": 720, "protein_g": 22, "carbs_g": 98, "fat_g": 28, "fiber_g": 3},
        "glycemic_load_estimate": "very high",
        "what_is_great": "Some protein from cheese and pepperoni.",
        "what_is_missing": "Vegetables, fiber, and hydration. Very high glycemic load before bed.",
        "hydration_suggestion": "Replace cola with water. High sodium in pizza increases dehydration overnight.",
        "next_meal_balance": "High-GI late meal will likely disrupt sleep quality. Opt for a light protein snack instead next time.",
    }),
]


def _meals(user_id: str) -> list[dict]:
    meals = []
    for day, name, hour, analysis in _MEAL_DATA:
        mac = analysis["macros"]
        meals.append({
            "id": _uid(), "user_id": user_id,
            "ts": _ts(day, hour),
            "photo_url": f"/uploads/meals/meal_{day}.jpg",
            "claude_analysis_json": json.dumps(analysis),
            "calories_est": float(mac["calories"]),
            "protein_g":    float(mac["protein_g"]),
            "carbs_g":      float(mac["carbs_g"]),
            "fat_g":        float(mac["fat_g"]),
            "fiber_g":      float(mac["fiber_g"]),
            "notes": name,
        })
    return meals


# ─── voice notes ─────────────────────────────────────────────────────────────

_VOICE_NOTE_DATA = [
    (5,  8,
     "Feeling pretty good today. Slept around 7 hours last night, felt rested. Had a busy day at college but manageable. Energy's decent.",
     {"mood_self_estimate": 7, "energy_self_estimate": 7, "stress_self_estimate": 3,
      "symptoms_mentioned": [], "topics": ["college", "sleep quality"],
      "summary": "Good day overall, rested, manageable workload."}),
    (15, 21,
     "Long day at college. Back to back presentations and a surprise quiz. Feeling a bit drained. Had some chai late which might affect sleep tonight.",
     {"mood_self_estimate": 6, "energy_self_estimate": 5, "stress_self_estimate": 6,
      "symptoms_mentioned": [{"symptom": "fatigue", "severity_estimate": 4}],
      "topics": ["college stress", "presentations", "late caffeine", "sleep concern"],
      "summary": "Tiring academic day, late caffeine may affect sleep."}),
    (28, 22,
     "Can't seem to sleep properly. Exams coming up next week and I'm stressed about it. Maybe 5 hours sleep last night. Had a mild headache in the afternoon.",
     {"mood_self_estimate": 5, "energy_self_estimate": 4, "stress_self_estimate": 7,
      "symptoms_mentioned": [{"symptom": "headache", "severity_estimate": 3, "duration_mentioned": "afternoon"}],
      "topics": ["exam stress", "poor sleep", "headache"],
      "summary": "Sleep-deprived, exam anxiety building, mild headache."}),
    (33, 20,
     "Not feeling well at all today. Woke up with a sore throat this morning. Body feels achy, low energy. I think I'm coming down with something, maybe a fever starting.",
     {"mood_self_estimate": 3, "energy_self_estimate": 2, "stress_self_estimate": 8,
      "symptoms_mentioned": [
          {"symptom": "sore throat", "severity_estimate": 5},
          {"symptom": "body ache", "severity_estimate": 4},
          {"symptom": "low energy", "severity_estimate": 6},
          {"symptom": "possible fever", "severity_estimate": 3},
      ],
      "topics": ["illness onset", "sore throat", "fatigue"],
      "summary": "Prodromal illness symptoms — sore throat, aches, low energy."}),
    (40, 19,
     "Slowly getting better. Lost almost a full week to this fever and viral infection. Really knocked me out. Grateful the worst is over. Still tired but feeling human again.",
     {"mood_self_estimate": 4, "energy_self_estimate": 4, "stress_self_estimate": 6,
      "symptoms_mentioned": [{"symptom": "residual fatigue", "severity_estimate": 4}],
      "topics": ["illness recovery", "missed classes", "fatigue"],
      "summary": "Recovering from 8-day illness, tired but improving."}),
    (52, 20,
     "Back to normal finally! Exams are done, feeling great. Slept 8 hours last night which I really needed. Energy is back.",
     {"mood_self_estimate": 7, "energy_self_estimate": 7, "stress_self_estimate": 3,
      "symptoms_mentioned": [], "topics": ["recovery complete", "exam relief", "good sleep"],
      "summary": "Full recovery, exam pressure lifted, energy restored."}),
    (62, 19,
     "Started morning runs two days ago! Did 5km today in 28 minutes. Felt amazing afterwards. Energy levels are way up. I should have done this months ago.",
     {"mood_self_estimate": 8, "energy_self_estimate": 8, "stress_self_estimate": 2,
      "symptoms_mentioned": [], "topics": ["new running habit", "exercise", "high energy"],
      "summary": "Enthusiastic about new morning run habit, high energy and mood."}),
    (75, 20,
     "Running five days a week now. Sleep has improved noticeably, I'm actually feeling rested when I wake up, which hasn't happened in a while. Mood is consistently better.",
     {"mood_self_estimate": 8, "energy_self_estimate": 8, "stress_self_estimate": 2,
      "symptoms_mentioned": [], "topics": ["running habit", "improved sleep", "mood improvement"],
      "summary": "Running habit established, sleep quality significantly improved, mood elevated."}),
    (88, 20,
     "Checked my wearable this morning — resting heart rate dropped to 57 BPM. My HRV is going up too. The running is genuinely working on a physiological level.",
     {"mood_self_estimate": 8, "energy_self_estimate": 9, "stress_self_estimate": 2,
      "symptoms_mentioned": [], "topics": ["fitness improvement", "resting heart rate", "HRV", "running results"],
      "summary": "Measurable cardiovascular improvements from running habit — RHR 57, HRV up."}),
    (98, 22,
     "Big project deadline this week. Five meetings today, three tomorrow. Not sleeping well because I'm on the laptop until midnight. Feeling anxious and wired.",
     {"mood_self_estimate": 5, "energy_self_estimate": 4, "stress_self_estimate": 8,
      "symptoms_mentioned": [{"symptom": "anxiety", "severity_estimate": 5}],
      "topics": ["project deadline", "meeting overload", "poor sleep", "late screen time", "stress"],
      "summary": "High workload week — poor sleep from late screens, stress elevated."}),
    (102, 11,
     "Terrible migraine since this morning. Can't look at screens, this headache is really bad. Had to cancel everything today. I think this is the third migraine this quarter.",
     {"mood_self_estimate": 2, "energy_self_estimate": 2, "stress_self_estimate": 8,
      "symptoms_mentioned": [
          {"symptom": "migraine", "severity_estimate": 8, "duration_mentioned": "since morning"},
          {"symptom": "photophobia", "severity_estimate": 6},
          {"symptom": "nausea", "severity_estimate": 5},
      ],
      "topics": ["migraine", "screen sensitivity", "cancelled plans"],
      "summary": "Severe migraine attack — third episode this quarter, cancelled day."}),
    (114, 15,
     "Another migraine. Happened right after two nights of bad sleep and too much screen time. Starting to think there is a clear pattern — every time I sleep less than 6 hours for two nights and stare at my laptop until midnight, I get one of these headaches within 48 hours.",
     {"mood_self_estimate": 3, "energy_self_estimate": 2, "stress_self_estimate": 7,
      "symptoms_mentioned": [
          {"symptom": "migraine", "severity_estimate": 8, "duration_mentioned": "since morning"},
      ],
      "topics": ["migraine", "pattern recognition", "sleep deprivation", "screen time"],
      "summary": "Third migraine — Aarav independently suspects a sleep+screen time trigger pattern.",
      "follow_ups_to_log": ["Track sleep and screen time on migraine-free nights for comparison"]}),
]


def _voice_notes(user_id: str) -> list[dict]:
    notes = []
    for day, hour, transcript, extraction in _VOICE_NOTE_DATA:
        notes.append({
            "id": _uid(), "user_id": user_id,
            "ts": _ts(day, hour),
            "audio_url": f"/uploads/voice/note_{day}.m4a",
            "transcript": transcript,
            "claude_extraction_json": json.dumps(extraction),
            "mood_score": float(extraction.get("mood_self_estimate", 5)),
            "symptoms_extracted": json.dumps(extraction.get("symptoms_mentioned", [])),
            "topics": json.dumps(extraction.get("topics", [])),
        })
    return notes


# ─── main entry point ─────────────────────────────────────────────────────────

def generate_all(user_id: str) -> dict:
    """
    Generate 120 days of correlated health data for demo user Aarav.
    Returns dicts ready for DB insertion (user_id already injected).
    """
    rng = np.random.default_rng(SEED)
    states = [_build_state(day, rng) for day in range(N_DAYS)]

    metrics, events = [], []
    for day, state in enumerate(states):
        metrics.extend(_day_metrics(day, state, rng, user_id))
        events.extend(_day_events(day, state, rng, user_id))

    meds = _medications(user_id)
    doses = _medication_doses(states, meds, rng, user_id)
    symptoms = _symptoms(states, user_id)
    lab_results, lab_values = _lab_results_and_values(user_id)
    meals = _meals(user_id)
    voice_notes = _voice_notes(user_id)

    return {
        "metrics":        metrics,
        "events":         events,
        "medications":    meds,
        "medication_doses": doses,
        "symptoms":       symptoms,
        "lab_results":    lab_results,
        "lab_values":     lab_values,
        "meals":          meals,
        "voice_notes":    voice_notes,
    }
