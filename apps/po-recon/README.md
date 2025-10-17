# PO Reconciliation Platform

A reference implementation of a purchase order and invoice reconciliation assistant designed for GoDaddy-style hosting deployments. The project consists of a FastAPI backend and a vanilla JavaScript frontend.

## Features

- Contract upload portal with placeholder extraction for PDF, image, and spreadsheet assets.
- Purchase order management including multi-item creation.
- Invoice management with manual entry, file uploads, and reconciliation workflows.
- Administrative dashboard summarising discrepancies and LLM findings.
- Lightweight authentication stub simulating Google or email login flows.
- Optional OpenAI integration via the `OPENAI_API_KEY` environment variable.

## Getting Started

### Backend

```bash
cd apps/po-recon/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Serve the static assets using any HTTP server (for development you can use Python's built-in server):

```bash
cd apps/po-recon/frontend
python -m http.server 3000
```

Then open `http://localhost:3000` in your browser. The frontend expects the API to be available at `http://localhost:8000`.

## Running Tests

```bash
cd apps/po-recon/backend
source .venv/bin/activate  # if not already active
pip install -r requirements.txt
pytest
```

## Environment Variables

- `OPENAI_API_KEY`: Optional. When set the reconciliation service will call the OpenAI Chat Completions API for deeper analysis. Without the key the application returns deterministic placeholder content.

## Deployment Notes

- All persistent data is stored in memory and the `uploads/` directory for development convenience. For production use, connect the API to managed storage and databases available through GoDaddy or other hosting providers.
- Replace the authentication stub with a proper OAuth 2.0 / OpenID Connect flow before going live.

## API Surface

The backend exposes the following primary endpoints:

- `POST /api/auth/login`
- `POST /api/contracts/upload`
- `GET /api/contracts`
- `POST /api/pos`
- `GET /api/pos`
- `POST /api/invoices/upload`
- `POST /api/invoices/manual`
- `GET /api/invoices`
- `POST /api/reconcile`
- `GET /api/dashboard`
- `GET /api/rules`
- `GET /api/errors`
- `GET /api/llm-outputs`
- `GET /healthz`

Refer to `app/schemas.py` for the exact JSON payload definitions mandated by the project requirements.
