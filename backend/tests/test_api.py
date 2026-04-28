"""API integration tests — core endpoints + demo flow."""
import pytest


# ─── Health ───────────────────────────────────────────────────────────────────

def test_health_check(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "message" in data


# ─── Auth ─────────────────────────────────────────────────────────────────────

def test_register_and_login(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "new@synapse-demo.com",
        "password": "pass1234",
        "name": "New User",
    })
    assert r.status_code in (200, 201)
    assert "access_token" in r.json()

    r2 = client.post("/api/v1/auth/login", json={
        "email": "new@synapse-demo.com",
        "password": "pass1234",
    })
    assert r2.status_code == 200
    assert "access_token" in r2.json()


def test_login_wrong_password(client):
    client.post("/api/v1/auth/register", json={
        "email": "wrong@synapse-demo.com",
        "password": "correct",
        "name": "Wrong",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": "wrong@synapse-demo.com",
        "password": "incorrect",
    })
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_me_with_auth(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "email" in data


# ─── Timeline ─────────────────────────────────────────────────────────────────

def test_timeline_requires_auth(client):
    r = client.get("/api/v1/timeline")
    assert r.status_code == 401


def test_timeline_empty_returns_tracks(client, auth_headers):
    r = client.get("/api/v1/timeline", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "tracks" in data
    assert isinstance(data["tracks"], list)


def test_timeline_metric_filter(client, auth_headers):
    r = client.get("/api/v1/timeline", headers=auth_headers, params={"metrics": "hrv_rmssd,rhr"})
    assert r.status_code == 200


# ─── Score ────────────────────────────────────────────────────────────────────

def test_score_today(client, auth_headers):
    r = client.get("/api/v1/score/today", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    # Score endpoint returns 'overall' as the composite field
    assert "overall" in data or "score" in data
    composite = data.get("overall", data.get("score", 0))
    assert 0 <= composite <= 100


def test_score_history(client, auth_headers):
    r = client.get("/api/v1/score/history", headers=auth_headers, params={"days": 7})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Records ─────────────────────────────────────────────────────────────────

def test_symptoms_lifecycle(client, auth_headers):
    r = client.get("/api/v1/records/symptoms", headers=auth_headers)
    assert r.status_code == 200

    r2 = client.post("/api/v1/records/symptoms", headers=auth_headers, json={
        "name": "headache",
        "severity": 6,
        "started_at": "2025-01-01T08:00:00+00:00",
    })
    assert r2.status_code in (200, 201)
    sym_id = r2.json()["id"]

    r3 = client.patch(f"/api/v1/records/symptoms/{sym_id}/resolve", headers=auth_headers)
    assert r3.status_code == 200


def test_medications_lifecycle(client, auth_headers):
    r = client.get("/api/v1/records/medications", headers=auth_headers)
    assert r.status_code == 200

    r2 = client.post("/api/v1/records/medications", headers=auth_headers, json={
        "name": "Metformin",
        "dose": 500,
        "unit": "mg",
        "frequency": "Once daily",
        "start_date": "2025-01-01",
    })
    assert r2.status_code in (200, 201)
    med_id = r2.json()["id"]

    r3 = client.post(f"/api/v1/records/medications/{med_id}/doses", headers=auth_headers)
    assert r3.status_code in (200, 201)


def test_labs_list(client, auth_headers):
    r = client.get("/api/v1/records/labs", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_meals_list(client, auth_headers):
    r = client.get("/api/v1/records/meals", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ─── Care Circle ─────────────────────────────────────────────────────────────

def test_care_circle_lifecycle(client, auth_headers):
    r = client.get("/api/v1/care-circle/members", headers=auth_headers)
    assert r.status_code == 200

    r2 = client.post("/api/v1/care-circle/invite", headers=auth_headers, json={
        "email": "friend@synapse-demo.com",
        "name": "Best Friend",
        "role": "supporter",
    })
    assert r2.status_code in (200, 201)
    member_id = r2.json()["id"]

    r3 = client.patch(
        f"/api/v1/care-circle/members/{member_id}/sharing",
        headers=auth_headers,
        json={"share_labs": False, "share_vitals": True, "share_medications": False, "share_symptoms": True},
    )
    assert r3.status_code == 200

    r4 = client.delete(f"/api/v1/care-circle/members/{member_id}", headers=auth_headers)
    assert r4.status_code == 200


# ─── Seed + End-to-end demo flow ─────────────────────────────────────────────

def test_seed_demo(client, auth_headers):
    r = client.post("/api/v1/ingest/seed-demo", headers=auth_headers)
    assert r.status_code == 200


def test_timeline_after_seed(client, auth_headers):
    # seed-demo creates data for the canonical demo user (aarav@synapse.demo),
    # not the test user — verify the endpoint succeeds and returns a valid shape
    r_seed = client.post("/api/v1/ingest/seed-demo", headers=auth_headers)
    assert r_seed.status_code == 200
    r = client.get("/api/v1/timeline", headers=auth_headers, params={"metrics": "hrv_rmssd"})
    assert r.status_code == 200
    assert "tracks" in r.json()


def test_score_after_seed(client, auth_headers):
    r = client.get("/api/v1/score/today", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    composite = data.get("overall", data.get("score", 0))
    assert composite >= 0


def test_ml_baselines_endpoint(client, auth_headers):
    r = client.get("/api/v1/ml/baselines", headers=auth_headers)
    assert r.status_code == 200


def test_ml_correlations_endpoint(client, auth_headers):
    r = client.get("/api/v1/ml/correlations", headers=auth_headers)
    assert r.status_code == 200
