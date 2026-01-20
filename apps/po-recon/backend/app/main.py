from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import schemas, services, store

DEFAULT_STORAGE_ROOT = Path.home() / "po_recon_data"
STORAGE_ROOT = Path(os.getenv("PO_RECON_STORAGE_ROOT", str(DEFAULT_STORAGE_ROOT))).expanduser().resolve()
PUBLIC_URL_PREFIX = os.getenv("PO_RECON_PUBLIC_URL_PREFIX", "/storage")

UPLOAD_DIR = STORAGE_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

store_instance = store.DataStore(
    upload_dir=UPLOAD_DIR,
    storage_root=STORAGE_ROOT,
    public_url_prefix=PUBLIC_URL_PREFIX,
)
file_service = services.FileExtractionService(store_instance)
llm_service = services.LLMService()
reconciliation_service = services.ReconciliationService(store_instance, llm_service)

app = FastAPI(title="PO Reconciliation Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/auth/login", response_model=schemas.AuthResponse)
def login(email: str, method: schemas.AuthMethod) -> schemas.AuthResponse:
    return store_instance.authenticate(email=email, method=method)


@app.get("/api/users", response_model=List[schemas.User])
def list_users() -> List[schemas.User]:
    return list(store_instance.users.values())


@app.post("/api/contracts/upload", response_model=schemas.EntityResponse)
async def upload_contract(
    vendor_id: str,
    agreement_terms: str,
    file: UploadFile = File(...),
) -> JSONResponse:
    file_type = file.filename.split(".")[-1].lower()
    if file_type not in {"pdf", "jpg", "csv", "xls", "xlsx"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_bytes = await file.read()
    result = file_service.handle_upload(file_bytes, file_type)  # type: ignore[arg-type]
    contract = store_instance.add_contract(
        vendor_id=vendor_id,
        agreement_terms=agreement_terms,
        file_type=file_type,  # type: ignore[arg-type]
        file_path=result["path"],
    )
    entity_response = schemas.EntityResponse(status="success", entity=contract.dict())
    return JSONResponse(content=entity_response.dict())


@app.get("/api/contracts", response_model=List[schemas.Contract])
def get_contracts() -> List[schemas.Contract]:
    return list(store_instance.contracts.values())


@app.post("/api/pos", response_model=schemas.EntityResponse)
def create_po(payload: schemas.POCreateRequest) -> schemas.EntityResponse:
    po_id = payload.po_id or f"PO-{int(datetime.utcnow().timestamp())}"
    po = schemas.PurchaseOrder(
        po_id=po_id,
        vendor_id=payload.vendor_id,
        items=payload.items,
        issue_date=payload.issue_date,
    )
    stored = store_instance.add_purchase_order(po)
    return schemas.EntityResponse(status="success", entity=stored.dict())


@app.get("/api/pos", response_model=List[schemas.PurchaseOrder])
def list_pos() -> List[schemas.PurchaseOrder]:
    return list(store_instance.purchase_orders.values())


@app.post("/api/invoices/upload", response_model=schemas.EntityResponse)
async def upload_invoice(
    vendor_id: str,
    linked_po_id: str,
    file: UploadFile = File(...),
) -> JSONResponse:
    file_type = file.filename.split(".")[-1].lower()
    if file_type not in {"pdf", "jpg", "csv", "xls", "xlsx"}:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_bytes = await file.read()
    result = file_service.handle_upload(file_bytes, file_type)  # type: ignore[arg-type]
    invoice = schemas.Invoice(
        invoice_id=f"INV-{int(datetime.utcnow().timestamp())}",
        vendor_id=vendor_id,
        linked_po_id=linked_po_id,
        items=[],
        received_date=datetime.utcnow(),
        file_type=file_type,  # type: ignore[arg-type]
        file_url=store_instance.to_public_url(result["path"]),
    )
    stored = store_instance.add_invoice(invoice)
    return JSONResponse(content=schemas.EntityResponse(status="success", entity=stored.dict()).dict())


@app.post("/api/invoices/manual", response_model=schemas.EntityResponse)
def create_manual_invoice(payload: schemas.ManualInvoiceCreateRequest) -> schemas.EntityResponse:
    invoice = schemas.Invoice(**payload.dict())
    stored = store_instance.add_invoice(invoice)
    return schemas.EntityResponse(status="success", entity=stored.dict())


@app.get("/api/invoices", response_model=List[schemas.Invoice])
def list_invoices() -> List[schemas.Invoice]:
    return list(store_instance.invoices.values())


@app.post("/api/reconcile", response_model=schemas.ReconciliationResponse)
async def reconcile(linked_po_id: str, linked_invoice_id: str) -> schemas.ReconciliationResponse:
    po = store_instance.get_po(linked_po_id)
    invoice = store_instance.get_invoice(linked_invoice_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    discrepancies = await reconciliation_service.reconcile_po_invoice(po, invoice)
    status: schemas.Literal["success", "partial", "failure"] = "success"
    if discrepancies:
        status = "partial"
    return schemas.ReconciliationResponse(status=status, findings=discrepancies)


@app.get("/api/dashboard", response_model=schemas.DashboardResponse)
def dashboard() -> schemas.DashboardResponse:
    return schemas.DashboardResponse(status="success", data=store_instance.list_discrepancies())


@app.get("/api/rules", response_model=List[schemas.RuleCheck])
def list_rules() -> List[schemas.RuleCheck]:
    return store_instance.list_rule_checks()


@app.get("/api/errors", response_model=List[schemas.LoggedError])
def list_errors() -> List[schemas.LoggedError]:
    return store_instance.list_errors()


@app.get("/api/llm-outputs", response_model=List[schemas.LLMAnalysis])
def list_llm_outputs() -> List[schemas.LLMAnalysis]:
    return store_instance.list_llm_outputs()


@app.get("/healthz")
def healthcheck() -> dict:
    return {"status": "ok"}
