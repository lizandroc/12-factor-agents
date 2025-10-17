# Reconciliation Client

React single-page application built with Vite. The UI exposes contract, purchase order, invoice, and dashboard portals that connect to the reconciliation server.

## Getting Started

```bash
npm install
npm run dev
```

By default the Vite dev server proxies API calls to `http://localhost:4000`. Update `vite.config.js` if your backend runs elsewhere.

## Features

- **Authentication Sandbox**: Trigger development-only Google/email login flows.
- **Contract Upload Portal**: Upload files (PDF, CSV, Excel, JPG) and capture metadata according to the required schema.
- **PO Management Portal**: Create structured purchase orders with multiple line items.
- **Invoice Management Portal**: Record invoices, upload source documents, and initiate reconciliation.
- **Admin Dashboard**: Review discrepancies, rule checks, logged errors, and LLM recommendations in one place.

The UI consumes the JSON structures defined in the project brief so the backend and dashboard stay aligned with reconciliation reporting requirements.
