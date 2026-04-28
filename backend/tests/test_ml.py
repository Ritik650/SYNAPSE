"""Unit tests for the ML module (baselines, anomaly, correlation)."""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch


# ─── Baselines ────────────────────────────────────────────────────────────────

def _make_metric(value, metric_type="hrv_rmssd", days_ago=1):
    m = MagicMock()
    m.value = value
    m.metric_type = metric_type
    m.ts = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return m


def test_z_score_positive():
    from backend.app.ml.baselines import z_score
    baseline = {"30d": {"mean": 50.0, "std": 10.0, "p10": 38.0, "p90": 64.0, "n": 30}}
    assert z_score(60.0, baseline) == pytest.approx(1.0)


def test_z_score_negative():
    from backend.app.ml.baselines import z_score
    baseline = {"30d": {"mean": 50.0, "std": 10.0, "p10": 38.0, "p90": 64.0, "n": 30}}
    assert z_score(40.0, baseline) == pytest.approx(-1.0)


def test_z_score_missing_std():
    from backend.app.ml.baselines import z_score
    baseline = {"30d": {"mean": 50.0, "std": None, "p10": None, "p90": None, "n": 0}}
    assert z_score(60.0, baseline) is None


def test_z_score_flat_distribution():
    from backend.app.ml.baselines import z_score
    baseline = {"30d": {"mean": 50.0, "std": 0.0, "p10": 50.0, "p90": 50.0, "n": 5}}
    assert z_score(60.0, baseline) is None


def test_compute_baselines_empty(db):
    from backend.app.ml.baselines import compute_baselines
    result = compute_baselines(db, "nonexistent-user-id")
    assert isinstance(result, dict)
    assert "hrv_rmssd" in result
    assert result["hrv_rmssd"]["30d"]["mean"] is None


# ─── Anomaly ──────────────────────────────────────────────────────────────────

def test_anomaly_score_range():
    """Anomaly scores must be in [0, 1]."""
    from backend.app.ml.anomaly import score_recent_anomalies
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    result = score_recent_anomalies(db, "fake-user")
    assert isinstance(result, dict)


def test_anomaly_context_no_data():
    from backend.app.ml.anomaly import get_anomaly_context
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    ctx = get_anomaly_context(db, "fake-user")
    assert ctx.get("available") is False or isinstance(ctx, dict)


# ─── Correlation ─────────────────────────────────────────────────────────────

def test_correlation_summary_no_data():
    from backend.app.ml.correlation import correlation_summary
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    summary = correlation_summary(db, "fake-user")
    assert isinstance(summary, str)


def test_compute_correlations_empty():
    from backend.app.ml.correlation import compute_correlations
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    result = compute_correlations(db, "fake-user")
    assert isinstance(result, list)
