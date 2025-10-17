# Reconciliation Server

Express-based API that manages contracts, purchase orders, invoices, and reconciliation insights.

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file if you want to enable OpenAI-powered reconciliation:

```
PORT=4000
OPENAI_API_KEY=sk-...
```

## Key Endpoints

- `POST /api/auth/email` – temporary email login returning a development token.
- `POST /api/auth/google` – simulated Google login for testing.
- `POST /api/contracts` / `GET /api/contracts`
- `POST /api/purchase-orders` / `GET /api/purchase-orders`
- `POST /api/invoices` / `GET /api/invoices`
- `POST /api/files/upload` – accepts PDF, CSV, Excel, JPG invoices/contracts and returns extraction status metadata.
- `POST /api/reconcile` – runs deterministic rules and optional OpenAI analysis, returning structured findings.
- `GET /api/dashboard` – aggregated discrepancy records for the admin portal.

Each response follows the JSON formats defined in the project requirements so the UI and external systems can rely on consistent schemas.
