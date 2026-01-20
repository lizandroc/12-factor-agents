# PO Reconciliation Platform

A reference implementation of a purchase order and invoice reconciliation assistant designed for GoDaddy-style hosting deployments. The project consists of a FastAPI backend and a vanilla JavaScript frontend.

## Features

- Contract upload portal with placeholder extraction for PDF, image, and spreadsheet assets.
- Purchase order management including multi-item creation.
- Invoice management with manual entry, file uploads, and reconciliation workflows.
- Administrative dashboard summarising discrepancies and LLM findings.
- Lightweight authentication stub simulating Google or email login flows.
- Optional OpenAI integration via the `OPENAI_API_KEY` environment variable.
- JSON-backed persistence that writes to GoDaddy's NVMe SSD storage without additional databases.

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

## Configuration

The backend honours the following environment variables to better fit shared hosting environments such as GoDaddy's cPanel plans:

- `PO_RECON_STORAGE_ROOT`: Absolute path where uploads, extracted data, and the persistent `state.json` file live. Defaults to `~/po_recon_data` when not provided. Point this to the NVMe-backed storage volume on your hosting account for best performance.
- `PO_RECON_PUBLIC_URL_PREFIX`: URL prefix (e.g. `/storage` or `https://example.com/storage`) used when returning file URLs from the API. Leave blank when downloads are proxied through another service.
- `OPENAI_API_KEY`: Optional. When set the reconciliation service will call the OpenAI Chat Completions API for deeper analysis. Without the key the application returns deterministic placeholder content.

## GoDaddy cPanel Deployment Notes

1. **Upload the codebase** into a directory under your hosting account (for example `~/po-recon`). Create a Python application via cPanel and point it at the `apps/po-recon/backend` folder.
2. **Install dependencies** inside the cPanel-managed virtualenv:

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables** in the cPanel application dashboard. Set at least:

   - `PO_RECON_STORAGE_ROOT=/home/<cpanel-user>/po_recon_data`
   - `PO_RECON_PUBLIC_URL_PREFIX=/storage`
   - `OPENAI_API_KEY=<optional>`

   Make sure the `PO_RECON_STORAGE_ROOT` directory exists and is located on the NVMe SSD volume for fast read/write performance (`mkdir -p ~/po_recon_data/uploads`).

4. **Expose the ASGI app via Passenger** by keeping the provided `passenger_wsgi.py` in `apps/po-recon/backend/`. Passenger loads the FastAPI app through `asgiref`'s ASGI-to-WSGI adapter so it works with GoDaddy's Python hosting stack. In `public_html`, add an `.htaccess` file similar to:

   ```apacheconf
   PassengerAppRoot /home/<cpanel-user>/po-recon/apps/po-recon/backend
   PassengerAppType wsgi
   PassengerStartupFile passenger_wsgi.py
   ```

5. **Serve uploaded files** by mapping the storage folder into `public_html`. The simplest approach is to create a symlink so that `/public_html/storage` points to `~/po_recon_data`. Update `PO_RECON_PUBLIC_URL_PREFIX` if you expose files from a different location.

6. **Deploy the frontend** by copying the contents of `apps/po-recon/frontend` into `public_html/po-recon`. Adjust the `<meta name="po-recon-api-base">` tag (see below) if the API lives on a different subdomain or path.

7. **Replace the authentication stub** with production-ready OAuth (Google, Microsoft, etc.) before onboarding real users.

## Frontend API configuration

The SPA reads the API location from one of the following sources (in order):

1. `window.PO_RECON_API_BASE` global assigned in a separate script tag.
2. `<meta name="po-recon-api-base" content="https://example.com">`.
3. Fallback to `window.location.origin`.

Configure one of these values when deploying the frontend under cPanel so requests are routed to the correct backend URL.

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
