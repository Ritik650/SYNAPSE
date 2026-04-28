#!/usr/bin/env python3
"""
Standalone wrapper to preview or export synthetic generator output.
Run: python data/synthetic_generator.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.synthetic import generate_all, N_DAYS, BASE_DATE

DEMO_USER_ID = "preview-user-id"

def main():
    print(f"Generating {N_DAYS}-day dataset starting {BASE_DATE.date()} ...")
    data = generate_all(DEMO_USER_ID)

    for key, val in data.items():
        print(f"  {key:20s}: {len(val)} records")

    # Dump summary to stdout
    print("\nSample metric (first HR record):")
    hr = [m for m in data["metrics"] if m["metric_type"] == "hr"]
    if hr:
        print(json.dumps(hr[0], indent=2, default=str))

    print("\nSample event (first illness event):")
    illness = [e for e in data["events"] if e["event_type"] == "illness_onset"]
    if illness:
        print(json.dumps(illness[0], indent=2, default=str))

    print("\nStory arc verification:")
    migraines = [e for e in data["events"] if e["event_type"] == "symptom" and "migraine" in e["title"].lower()]
    print(f"  Migraine events: {len(migraines)} (expected 3)")
    print(f"  Migraine dates:  {[e['ts'][:10] for e in migraines]}")

    illness_onset = [e for e in data["events"] if e["event_type"] == "illness_onset"]
    print(f"  Illness onset:   {[e['ts'][:10] for e in illness_onset]}")

    workouts = [e for e in data["events"] if e["event_type"] == "workout"]
    print(f"  Workout events:  {len(workouts)} (starting from day 60+)")

    print("\nGenerator OK.")

if __name__ == "__main__":
    main()
