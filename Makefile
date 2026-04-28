# Synapse — developer convenience targets
.PHONY: help dev backend frontend test demo-reset seed build lint \
        docker-up docker-down install install-backend install-frontend

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 5173
DEMO_TOKEN    ?= $(shell cat .demo_token 2>/dev/null)

help:
	@echo ""
	@echo "  Synapse Makefile"
	@echo ""
	@echo "  make dev            Start backend + frontend in parallel"
	@echo "  make backend        Start backend only (uvicorn, hot-reload)"
	@echo "  make frontend       Start frontend only (vite dev)"
	@echo "  make install        Install all dependencies"
	@echo "  make test           Run backend pytest suite"
	@echo "  make test-e2e       Run Playwright E2E tests"
	@echo "  make demo-reset     Reseed to perfect demo state in <5s"
	@echo "  make seed           Same as demo-reset"
	@echo "  make build          Build frontend for production"
	@echo "  make lint           TypeScript type-check"
	@echo "  make docker-up      Start full stack via docker-compose"
	@echo "  make docker-down    Stop docker-compose stack"
	@echo ""

# ── Installation ──────────────────────────────────────────────────────────────
install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

# ── Development servers ───────────────────────────────────────────────────────
dev:
	@echo "Starting Synapse (backend :$(BACKEND_PORT) + frontend :$(FRONTEND_PORT))..."
	@trap 'kill 0' SIGINT; \
	  (cd backend && uvicorn app.main:app --reload --port $(BACKEND_PORT)) & \
	  (cd frontend && npm run dev -- --port $(FRONTEND_PORT)) & \
	  wait

backend:
	cd backend && uvicorn app.main:app --reload --port $(BACKEND_PORT)

frontend:
	cd frontend && npm run dev -- --port $(FRONTEND_PORT)

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	cd frontend && npm run build

lint:
	cd frontend && npx tsc --noEmit

# ── Tests ─────────────────────────────────────────────────────────────────────
test:
	cd backend && python -m pytest tests/ -v --tb=short

test-e2e:
	cd frontend && npx playwright test

test-all: test test-e2e

# ── Demo Reset ────────────────────────────────────────────────────────────────
# Resets Synapse to the perfect demo state.
# The backend must be running. If DEMO_TOKEN is not set, it will register+login.
demo-reset seed:
	@echo "Resetting Synapse demo data..."
	@if [ -z "$(DEMO_TOKEN)" ]; then \
	  echo "  No token found — registering demo user..."; \
	  curl -s -X POST http://localhost:$(BACKEND_PORT)/api/v1/auth/register \
	    -H 'Content-Type: application/json' \
	    -d '{"email":"aarav@synapse.demo","password":"synapse2025","name":"Aarav Shah"}' > /dev/null 2>&1 || true; \
	  TOKEN=$$(curl -s -X POST http://localhost:$(BACKEND_PORT)/api/v1/auth/login \
	    -H 'Content-Type: application/json' \
	    -d '{"email":"aarav@synapse.demo","password":"synapse2025"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"); \
	  echo $$TOKEN > .demo_token; \
	else \
	  TOKEN=$(DEMO_TOKEN); \
	fi; \
	curl -s -X POST http://localhost:$(BACKEND_PORT)/api/v1/ingest/seed-demo \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H 'Content-Type: application/json' | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓', d.get('message','Done'))"; \
	echo "Demo reset complete."

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	docker-compose up --build -d
	@echo "Synapse running at http://localhost:5173"

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	rm -f backend/synapse.db backend/.demo_token .demo_token
	rm -rf frontend/dist frontend/playwright-report frontend/test-results
	find backend -name "*.pyc" -delete
	find backend -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
