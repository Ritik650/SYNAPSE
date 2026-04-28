"""Shared pytest fixtures for Synapse backend tests."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Patch DB before importing app so all modules pick up the test engine
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

import backend.app.db.session as sess
sess.engine = engine
sess.SessionLocal = TestSession

# Import app AFTER patching — this triggers all model imports which register with Base
from backend.app.main import app  # noqa: E402
from backend.app.db.base import Base  # noqa: E402
from backend.app.db.session import get_db  # noqa: E402

# Create all tables now that models are registered
Base.metadata.create_all(engine)


def override_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "test@synapse-demo.com",
        "password": "testpass123",
        "name": "Test User",
    })
    r = client.post("/api/v1/auth/login", json={
        "email": "test@synapse-demo.com",
        "password": "testpass123",
    })
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def db():
    session = TestSession()
    yield session
    session.close()
